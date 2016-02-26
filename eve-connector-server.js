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

    //Devices.test({ type: 'usb', params:{vid: 1305, pid: 1} });

    // WebSockets
    //
    io.on('connection', function(socket) {
        console.log('a user connected');

        socket.emitError = function(channel, error) {
            var err = error.message ? error.message : error;
            socket.emit(channel, {err: err});
        }

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
                socket.emitError('isDeviceAvailable', error);
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
                socket.emitError('areDevicesAvailable', error);
            }
            console.log('areDevicesAvailable answered');
        });

        socket.on('sendData', function(device, data) {
            console.log('received sendData: ', device, 'data...');
            Devices.sendData(device, data).then(
                function(res){
                    socket.emit('sendData', {res: res});
                    console.log('sendData answered');
                },
                function(err){
                    socket.emitError('sendData', err);
                    console.log('sendData answered with error: ', err.message);
                }
            );
        });

        socket.on('readData', function(device, length) {
            console.log('received readData: ', device, length);
            Devices.readData(device, length).then(
                function(res){
                    socket.emit('readData', {res: res});
                    console.log('readData answered');
                },
                function(err){
                    socket.emitError('readData', err);
                    console.log('readData answered with error: ', err.message);
                }
            );
        });

        socket.on('startPoll', function(device) {
            console.log('received startPoll: ', device, 'data...');
            try {
                Devices.startPoll(device, socket);
            }
            catch(error) {
                socket.emitError('startPoll', error);
                console.log('startPoll answered with error:', error);
            }
        });

        socket.on('stopPoll', function(device) {
            console.log('received stopPoll: ', device, 'data...');
            try {
                Devices.stopPoll(device);
            }
            catch(error) {
                socket.emitError('stopPoll', error);
                console.log('stopPoll answered with error:', error);
            }
        });
    });

} // end createServer()

exports.createServer = createServer;
