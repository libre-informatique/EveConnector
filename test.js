var fs = require('fs');
var https_options = {
    key: fs.readFileSync(__dirname + '/server.key'),
    cert: fs.readFileSync(__dirname + "/server.crt")
}

var EC = require('./eve-connector-server.js').createServer(8164);
