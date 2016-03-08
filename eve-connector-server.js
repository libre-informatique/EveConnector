var exports = module.exports = {};

process.on('uncaughtException', function(err) {
    console.log('uncaughtException', err);
});

var fs = require('fs');
var https_options = {
    key: fs.readFileSync(__dirname+'/server.key'),
    cert: fs.readFileSync(__dirname+"/server.crt")
}
var usbDevices = require('./usbDevices.js');
var websocketDevices = require('./websocketDevices.js');
var getDeviceModule = function(device) {
    try {
        var type = typeof(device) == 'string' ? device : device.type;
        switch(type) {
            case 'usb':
                return usbDevices;
            case 'websocket':
                return websocketDevices;
            default:
                return false;
        }
    }
    catch(e) {
        return false;
    }
}

var createServer = function(port) {

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

        socket.emitError = function(channel, error) {
            var err = error.message ? error.message : error;
            socket.emit(channel, {err: err});
        }

        socket.on('disconnect', function() {
            console.log('user disconnected');
        });

        socket.on('isDeviceAvailable', function(device) {
            console.log('received isDeviceAvailable: ', device);
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('isDeviceAvailable', ['Device type not supported', device]);
                return;
            }
            devmod.isDeviceAvailable(device).then(
                function(res){
                    socket.emit('isDeviceAvailable', {res: res});
                    console.log('isDeviceAvailable answered');
                },
                function(err){
                    socket.emitError('isDeviceAvailable', err);
                    console.log('isDeviceAvailable answered with error: ', err.message);
                }
            );
        });

        socket.on('areDevicesAvailable', function(query) {
            console.log('received areDevicesAvailable: ', query);
            var type = query.type;
            var list = query.params;
            var devmod = getDeviceModule(type);
            if (!devmod) {
                socket.emitError('areDevicesAvailable', ['Device type not supported', type]);
                return;
            }
            devmod.areDevicesAvailable(type, list).then(
                function(res){
                    if ( Array.isArray(res) ) {
                        res = res.length ? res[0] : { type: type, params: []};
                    }
                    socket.emit('areDevicesAvailable', {res: res});
                    console.log('areDevicesAvailable answered');
                },
                function(err){
                    socket.emitError('areDevicesAvailable', err);
                    console.log('areDevicesAvailable answered with error: ', err.message);
                }
            );
        });

        socket.on('sendData', function(device, data) {
            console.log('received sendData: ', device, 'data...');
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('sendData', ['Device type not supported', device]);
                return;
            }
            devmod.sendData(device, data, socket).then(
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
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('sendData', ['Device type not supported', device]);
                return;
            }
            devmod.readData(device, length).then(
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
            console.log('received startPoll: ', device);
            try {
                var devmod = getDeviceModule(device);
                devmod.startPoll(device, socket);
            }
            catch(error) {
                socket.emitError('startPoll', error);
                console.log('startPoll answered with error:', error);
            }
        });

        socket.on('stopPoll', function(device) {
            console.log('received stopPoll: ', device);
            try {
                var devmod = getDeviceModule(device);
                devmod.stopPoll(device);
            }
            catch(error) {
                socket.emitError('stopPoll', error);
                console.log('stopPoll answered with error:', error);
            }
        });
    });

} // end createServer()


// tests
// TODO remove this
var socket = require('socket.io-client')('ws://localhost:80011', {reconnection: false});
socket.on('connect', function(){
  console.log('connect success');
  socket.on('message', function(data){});
  socket.on('close', function(){});
});
socket.on('connect_error', function(){
  console.log('connect_error');
});




// Display some information about this module (based on package.jon)
require('appinspect').print(module);

exports.createServer = createServer;
