# promisify-cli

`promsifiy-cli` is just a cli parser following *nix common line arguments conventions, used by promising way. but it is different.

CLI is just a piece of program, we can just think of it as a `function`, function requires input and give out results. that's all.

`promisify-cli` is trying to make cli more intuitive, using it just like invoking a function.

`promsifiy-cli` converts all command line `flags` `switches` and `arguments` into function params and options.

You can use it building efficient cli tools.

# Usage
CLI Files

```javascript
/*
In package.json adding a new Field `cli`
*/

//WARNING: '-h', '--help', '-v', '--version' are preserved. They are used to print out  Usage or Version information.
{
 ......
  cli:[{
      "flag": "-p"
      //or "flag": "-p --port"              specify multiple flags, short/long flags
      //or "flag": "-p, --port <port>"      indicats *required* param
      //or "flag": "-p --port [port]"       indicats [optional] param
      //"name": "alias name of port"        explicitly to customize its name
      //"required" : true / false           explicitly to specify whether it's optional or must required
      //"value": "defaultValue"             explicitly assign a default value
      //"desc": "description message"       descriptin message
  },
    {
      "flag": "--host"
  }]
......
}

```

```javascript
/*

./index.js

*/

var cli = require('../promisify-cli');

//eg cli: startserver -p 80 --host 192.168.28.3 ./www

cli()
  .spread(function (param, options) {
    console.log('data->', param, options);

    /*
    param: './www'
    options: {
      p: '80',
      host: '192.168.28.3'
    }
    */
  }
  })
  .catch(function (e) {
    console.error('catch->', e.message);
  })
```

# API

> WARNING: `-h`, `--help`, `-v`, `--version` are preserved. They are used to print out Help,Usage,Version information.

* cli([flags[,options]])

  * [flags]

    eg: ['-p',80,'--host','localhost'] to test you  funcationality. default get from `process.argv`   automatically. you don't need to specify it probably.

  * [options]
    * `enableUnkownOptions` if it allows unknown options    from  command line.

# inspired by [commander](https://www.npmjs.com/package/commander)
