/* eslint-disable */

var cli = require('../index.js');

cli(null,{
  enableUnkownOptions:true
})
  .then(function (d) {
    console.log('data->', d);
  })
  .catch(function (e) {
    console.error('catch->', e.message);
  })

