var exports = module.exports = {};

var fs = require('fs');
var https_options = {
    key: fs.readFileSync(__dirname+'/server.key'),
    cert: fs.readFileSync(__dirname+"/server.crt")
}
var Devices = require('./devices.js');

require('appinspect').print(module);

createServer = function(port) {

    // Start server
    //
    var https = require('https');
    var express = require('express');
    var app = express();
    var httpsServer = https.createServer(https_options, app);
    httpsServer.listen(port);
    var io = require('socket.io')(httpsServer);
    console.info('Eve-Connector up and running. Listening on port ' + port);

    // Static web pages
    //
    app.get('/', function (req, res) {
      res.sendFile(__dirname + '/web/index.html');
    });
    app.use('/js', express.static(__dirname + '/web/js'));
    app.use('/test_data', express.static(__dirname + '/web/test_data'));

    // WebSockets
    //
    io.on('connection', function(socket) {
        console.log('a user connected');

        socket.on('disconnect', function() {
            console.log('user disconnected');
        });

        socket.on('isDeviceAvailable', function(device) {
            console.log('received isDeviceAvailable: ', device);
            try {
                var res = {
                    available: Devices.isDeviceAvailable(device),
                    device: device
                };
                socket.emit('isDeviceAvailable', {res: res});
            }
            catch(error) {
                socket.emit('isDeviceAvailable', {err: error});
            }
            console.log('isDeviceAvailable answered');
        });

        socket.on('areDevicesAvailable', function(query) {
            var type = query.type;
            var list = query.params;
            console.log('received areDevicesAvailable: ', query);
            try {
                var res =  Devices.areDevicesAvailable(type, list);
                socket.emit('areDevicesAvailable', {res: res});
            }
            catch(error) {
                socket.emit('areDevicesAvailable', {err: error});
            }
            console.log('areDevicesAvailable answered');
        });

        socket.on('sendData', function(device, data) {
            console.log('received sendData: ', device, 'data...');
            Devices.sendData(device, data).then(
                function(res){
                    Devices.pollDevice(device).then(
                        function(res) {
                            socket.emit('sendData', {res: res});
                            console.log('sendData answered');
                        },
                        function(err) {
                            socket.emit('sendData', {err: err});
                            console.log('sendData answered with error: ', err);
                        }
                    );
                },
                function(err){
                    socket.emit('sendData', {err: err});
                    console.log('sendData answered with error: ', err);
                }
            );
        });
    });

} // end createServer()

exports.createServer = createServer;
