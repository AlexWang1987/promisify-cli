# promisify-bash
The library aims to execute commands in local terminal (/bin/bin on Mac cmd.exe on Window)  in promisifing ways.

#usage

```javascript
var bash = require('promisify-bash');

bash('git branch')
  .then(function(d){
    console.log(d);
  })
  .catch(function(e){
    console.log(e);
  })
```
