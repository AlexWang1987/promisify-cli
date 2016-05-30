/* eslint-disable */

var cli = require('../index.js');
var Promise = require('bluebird');
var fs = require('promisify-fs');
var path = require('path');

cli()
  .then(function (cli) {
    cli.help();
  })
  .catch(function (e) {
    console.error('catch->', e);
  })

