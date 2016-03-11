
var fs = require('fs');
var https_options = {
    key: fs.readFileSync(__dirname + '/server.key'),
    cert: fs.readFileSync(__dirname + "/server.crt")
}

var EC = require('./eve-connector-server.js').createServer(8164, https_options);

/**
 * EPT emulator test page
 */
var express = require('express');
EC.express.get('/ept-client', function (req, res) {
  res.sendFile(__dirname + '/web/ept-client.html');
});
EC.express.use('/ept-emulator', express.static(__dirname + '/ept-emulator'));
