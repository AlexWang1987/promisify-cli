/* eslint-disable */

var cli = require('../index.js');
var Promise = require('bluebird');
var fs = require('promisify-fs');
var path = require('path');

cli()
  .spread(function (param,options) {
    console.log('data->', param,options);
  })
  .catch(function (e) {
    console.error('catch->', e.message);
  })

