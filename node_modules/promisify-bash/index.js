var Promise = require('bluebird');
var exec = require('child_process').exec;

var bash = function(cmd, options) {
  return new Promise(function(resolve, reject) {
    exec(cmd, options, function(error, stdout, stderr) {
      if (error) {
        return reject(stdout || stderr || error)
      }
      resolve(stdout);
    });
  })
}

module.exports = bash;
