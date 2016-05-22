/* eslint-disable */

var cli = require('../index.js');

cli()
  .then(function (param) {
    console.log('data->', param);
  })
  .catch(function (e) {
    console.error('catch->', e.message);
  })



