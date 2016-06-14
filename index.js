/* eslint-disable */
var Promise = require('bluebird');
var fs = require('promisify-fs');
var path = require('path');

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
  this._preservedFlags = ['-h', '--help', '-v', '--version'];
}

/**
 * getMainModule's Package
 * @return promise
 */
Parser.prototype.getMainModulePackage = function () {
  return Promise
    .mapSeries(require.main.paths, function (node_modules_path) {
      var pkg_file_path = path.resolve(node_modules_path, '../package.json');
      return fs
        .fileExists(pkg_file_path)
        .then(function (file_stat) {
          if (file_stat) {
            throw file_stat; //target package is found. stop iteration.
          }
        })
    })
    .then(function () {
      throw 'Warning: The main module of process is not distributed by npm ecosystem.';
    })
    .catch(function (file_stat) {
      return file_stat;
    })
}

/**
 * load from package.json who depend on `promisify-cli`
 * @return {[type]} [description]
 */

Parser.prototype.loadPackageCli = function () {
  return this.getMainModulePackage()
    .then(function (file_stat) {
      if (file_stat) {
        return fs.readJSON(file_stat.abs_path)
      }
      throw new Error('package does"t exist.')
    })
    .then(function (package_json) {
      return [package_json.name, package_json.description, package_json.cli]
    })
    .catch(function (e) {
      var feedbacks = [];
      try {
        var mainModuleAbsFile = process.mainModule.filename;
        //let's consider mainModule as CLI name
        feedbacks.push(mainModuleAbsFile.slice(mainModuleAbsFile.lastIndexOf('/') + 1));
      } catch (e) {}
      return feedbacks;
    })
}

Parser.prototype.loadCliConfig = function () {
  var self = this;

  return self
    .loadPackageCli()
    .spread(function (name, desc, options) {
      self._cliName = name;
      self._desc = desc;

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
          if (!option.name) {
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
      return self._options = options || [];
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
      if (option.flag && ~option.flag.split(/[, ]/)
        .indexOf(flag)) {
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
    if (self._parserOptions && !self._parserOptions['enableUnkownOptions']) {
      var unknownOptions = self._unknownOptions;

      if (unknownOptions.length) {
        throw new Error('These flags are not allowed:\n' + unknownOptions.map(function (unknownOption) {
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
              flagName = longFlagName.split('-')
                .reduce(function (last, crt) {
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
Parser.prototype.getCLI = function () {
  //spread options and params
  var params = [];
  var options = {};

  //cli arments
  if (this._args) params = params.concat(this._args);

  //cli options
  if (this._options) {
    options = this._options.reduce(function (options, option) {
      options[option.name] = option.value;
      return options;
    }, options);
  }

  //cli unknow options
  if (!(this._parserOptions && !this._parserOptions['enableUnkownOptions'])) {
    options = this._unknownOptions.reduce(function (options, option) {
      options[option.name] = option.value;
      return options;
    }, options);
  }

  //cli object
  return {
    params: params,
    options: options,
    help: this.help.bind(this)
  };
}

/**
 * Pad `str` to `width`.
 *
 * @param {String} str
 * @param {Number} width
 * @return {String}
 * @api private
 */

Parser.prototype.pad = function (str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 1)
    .join(' ');
}

Parser.prototype.maxLengthOfOption = function () {
  return this._options.reduce(function (max, option) {
    return Math.max(max, option.flag.length);
  }, 0);
}

/**
 * print out  usage or version
 * These flags (-v, --version, -h, --help ) are preserved.
 * @return promise
 */
Parser.prototype.helpUsage = function () {
  var self = this;

  return Promise.try(function () {
    var preservedFlagExits = false;
    var flag = null;

    if (self._normalizedFlags && self._normalizedFlags.length) {
      for (var i = 0, len = self._normalizedFlags.length; i < len; i++) {
        flag = self._normalizedFlags[i];
        if (~self._preservedFlags.indexOf(flag)) {
          preservedFlagExits = true;
          break;
        }
      }
    }
    if (preservedFlagExits) self.help();
  })
}

Parser.prototype.help = function () {
  var self = this;

  //print out usage
  //print out usage and exit
  var cli = ['',
    'Usage: ' + (self._cliName || 'cli') + ' [options] [params] \n',
    self._desc || '',
    ''
  ].join('\n')

  var helpString = self._preservedFlags.join(', ');
  var max = self.maxLengthOfOption() + 10;
  var max = Math.max(helpString.length, max);

  var optionString = [self.pad(helpString, max) + '  ' + 'Output usage information']
    .concat(self._options.map(function (option) {
      return self.pad(option.flag, max) + '  ' + (option.desc || '');
    }))
    .join('\n')

  console.log(cli + '\nOptions: \n\n' + optionString + '\n\n');
  process.exit(0);
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
      .then(parser.helpUsage.bind(parser))
      .then(parser.assignOptions.bind(parser))
      .then(parser.validateRequireds.bind(parser))
      .then(parser.validateUnknowns.bind(parser))
      .then(parser.getCLI.bind(parser))
  })
}

