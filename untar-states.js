tar = require ("tar-fs");
fs =  require("fs");

var tarFile = 'states_2018-08-20-00.json.tar';
var target = './out';

// extracting a directory
fs.createReadStream(tarFile).pipe(tar.extract(target));

