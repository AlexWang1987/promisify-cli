/* eslint-disable */
var Promise = require('bluebird');
var fs = require('promisify-fs');

/**
 * Option
 */
function Option(flag, val, desc) {}

/**
 * Parser
 */
function Parser(argv, options) {
  this._rawFlags = argv;
  this._parserOptions = options;
}

/**
 * load from local ./cli.xml
 * @return {[type]} [description]
 */
Parser.prototype.loadCliConfig = function () {
  var self = this;
  var cli_file_path = (this._parserOptions && this._parserOptions['cli']) || process.cwd() + '/cli.json';
  return fs.fileExists(cli_file_path)
    .then(function (file_stat) {
      if (file_stat) {
        return fs
          .readJSON(file_stat.abs_path)
          .then(function (options) {
            //parse option
            if (options && options.length) {
              for (var i = 0, len = options.length; i < len; ++i) {
                var option = options[i];
                var flag = option.flag;
                //this option is required or optional
                if (!option.required)
                  option.required = !!~flag.indexOf('<');

                //if it is starting with --no- or -no- it will be false
                if (~flag.indexOf('-no-'))
                  option.value = false;

                //identify it's name
                if (!option.name){
                  var requiredIndicat = flag.match(/<(.+)>/) || flag.match(/\[(.+)\]/)
                  var flagName = flag.match(/--(\w+)/) || flag.match(/-(\w+)/);

                  option.name = (requiredIndicat && requiredIndicat[1]) ||
                  (flagName && flagName[1]) ||
                  flag;
                }

                //description
                if (!option.desc)
                  option.desc = ''
              }
            }
            return self._options = options;
          })
      }
    })
};

/**
 * normolize args
 */
Parser.prototype.normolizeFlags = function () {
  var self = this;
  return Promise.try(function () {
    var _normalizedFlags = [];
    var _rawFlags = self._rawFlags;
    var _flag = null;

    for (var i = 0, len = _rawFlags.length; i < len; ++i) {
      _flag = _rawFlags[i];

      //option terminator -- flag
      if ('--' === _flag) {
        _normalizedFlags = _normalizedFlags.concat(_rawFlags.slice(i + 1));
        break;
      }

      //option -abc short flag combination
      if ('-' === _flag[0] && '-' !== _flag[1] && _flag.length > 2) {
        _flag.slice(1)
          .split('')
          .forEach(function (letter) {
            _normalizedFlags.push('-' + letter);
          });
        continue;
      }

      //option with --name=value pattern
      if (/^--/.test(_flag) && ~_flag.indexOf('=')) {
        _normalizedFlags = _normalizedFlags.concat(_flag.split('='));
        continue;
      }

      _normalizedFlags.push(_flag);
    }

    //save it
    self._normalizedFlags = _normalizedFlags;
  })
}

/**
 * find a option from cli
 * @param  {string} flag -p,--p litter
 * @return {[type]}      [description]
 */
Parser.prototype.getOptionByFlag = function (flag) {
  //flag could be a -,--,literals
  if (this._options) {
    for (var i = 0, len = this._options.length; i < len; ++i) {
      var option = this._options[i];
      if (option.flag && ~option.flag.split(/[, ]/).indexOf(flag)) {
        return option;
      }
    }
  }
}

/**
 * validate all options with required
 * @return {[type]} [description]
 */
Parser.prototype.validateRequireds = function () {
  var self = this;
  return Promise.try(function () {
    if (self._options) {
      for (var i = 0, len = self._options.length; i < len; ++i) {
        var option = self._options[i];
        if (option.required && !option.value) {
          throw new Error(option.name + ' is required' + ', please using ' + option.flag + '  ' + option.desc);
        }
      }
    }
  })
}

/**
 * validate unknown options
 * @return {promise}
 */
Parser.prototype.validateUnknowns = function () {
  var self = this;
  return Promise.try(function () {
    //enableUnkownOptions
    if (self._parserOptions && ! self._parserOptions['enableUnkownOptions']) {
      var unknownOptions = self._unknownOptions;

      if (unknownOptions.length) {
        throw new Error('These flags are not allowed:\n' + unknownOptions.map(function(unknownOption){
          return unknownOption.flag + '\n'
        }));
      }
    }
  })
}


/**
 * assign options baseon normalized flag
 * @return {[type]} [description]
 */
Parser.prototype.assignOptions = function () {
  var self = this;
  return Promise.try(function () {
    var flag = null;
    var option = null;
    var unknownOptions = [];
    var args = [];

    for (var i = 0, len = self._normalizedFlags.length; i < len; ++i) {
      flag = self._normalizedFlags[i];
      option = self.getOptionByFlag(flag);

      //assign value based on option
      if (option) {
        var nextArg = self._normalizedFlags[i + 1];
        if (nextArg && '-' !== nextArg[0]) {
          option.value = nextArg;
          i++;
          continue;
        }
      } else {
        if ('-' == flag[0]) {
          var flagName = '';
          var flagVal = true;

          //long flag with --
          if ('-' == flag[1]) {
            var longFlagName = flag.slice(2);

            //long flag still have -, try to convert to camelCase
            if (~longFlagName.indexOf('-')) {
              // with no-a-b-c
              if (0 === longFlagName.indexOf('no-')) {
                longFlagName = longFlagName.replace('no-', '');
                flagVal = false;
              }

              //camelCase
              flagName = longFlagName.split('-').reduce(function (last, crt) {
                return last + crt[0].toUpperCase() + crt.slice(1)
              })
            } else {
              flagName = longFlagName;
            }
          } else {
            flagName = flag.slice(1);
          }

          unknownOptions.push({
            name: flagName,
            value: flagVal,
            flag: flag,
            required: false,
            desc: "unknown option"
          })
        } else {
          args.push(flag);
        }
      }
    }

    self._unknownOptions = unknownOptions;
    self._args = args;
  })
}

/**
 * get normal params
 * @return {[type]} [description]
 */
Parser.prototype.getParams = function () {
  //spread options and params
  var params = [];
  var allOptions = {};

  //cli arments
  if (this._args) params = params.concat(this._args);

  //cli options
  if (this._options) {
     allOptions = this._options.reduce(function (params, option) {
      params[option.name] = option.value;
      return params;
    }, allOptions);

  }
  //cli unknow options
  if (! (this._parserOptions && ! this._parserOptions['enableUnkownOptions'])) {
     allOptions = this._unknownOptions.reduce(function (params, option) {
      params[option.name] = option.value;
      return params;
    }, allOptions);
  }

  //add all cli options as `options`
  params.push(allOptions);

  return params;
}

/**
 * cli parser
 * @param  {argv} argv which is an optional array. default is `process.argv`
 * @param  {options}  cli / enableUnkownOptions
 * @return  cli-promise    Getting params from cli
 */
var cli = module.exports = function (argv, options) {
  return Promise.try(function () {
    //default argv from process.argv
    if (!argv) argv = process.argv.slice(2);

    //new a parser this argv
    var parser = new Parser(argv, options);

    //load cli xml
    return parser
      .loadCliConfig()
      .then(parser.normolizeFlags.bind(parser))
      .then(parser.assignOptions.bind(parser))
      .then(parser.validateRequireds.bind(parser))
      .then(parser.validateUnknowns.bind(parser))
      .then(parser.getParams.bind(parser))
  })
}

