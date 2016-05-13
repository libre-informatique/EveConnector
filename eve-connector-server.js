var exports = module.exports = {};

process.on('uncaughtException', function(err) {
    debug('uncaughtException', err);
});

var debug = require('debug')('eve-connector:server');
debug('Debug enabled');


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

var Server = function(port, https_options) {

    // Start server
    //
    var https = require('https');
    var express = require('express');
    this.express = express();
    var httpsServer = https.createServer(https_options, this.express);
    httpsServer.listen(port);
    var io = require('socket.io')(httpsServer);
    console.info('Eve-Connector up and running. Listening on port ' + port);
 
    // Static web pages
    //
    this.express.get('/', function (req, res) {
      res.sendFile(__dirname + '/web/index.html');
    });
    this.express.get('/dev', function (req, res) {
        res.sendFile(__dirname + '/web/dev.html');
    });
    this.express.get('/test', function (req, res) {
        res.sendFile(__dirname + '/web/test.html');
    });
    this.express.use('/js', express.static(__dirname + '/web/js'));
    this.express.use('/test_data', express.static(__dirname + '/web/test_data'));

    // WebSockets
    //
    io.on('connection', function(socket) {
        debug('a user connected', socket.id);

        socket.emitError = function(channel, error) {
            var err = error.message ? error.message : error;
            socket.emit(channel, {err: err});
        }

        socket.on('error', function(err){
            debug('socket.on(error)', err);
        });

        socket.on('disconnect', function() {
            debug('user disconnected', socket.id);
        });

        socket.on('isDeviceAvailable', function(device) {
            debug('received isDeviceAvailable: ', device);
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('isDeviceAvailable', ['Device type not supported', device]);
                return;
            }
            devmod.isDeviceAvailable(device).then(
                function(res){
                    socket.emit('isDeviceAvailable', {res: res});
                    debug('isDeviceAvailable answered');
                },
                function(err){
                    socket.emitError('isDeviceAvailable', err);
                    debug('isDeviceAvailable answered with error: ', err.message);
                }
            );
        });

        socket.on('areDevicesAvailable', function(query) {
            debug('received areDevicesAvailable: ', query);
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
                    debug('areDevicesAvailable answered');
                },
                function(err){
                    socket.emitError('areDevicesAvailable', err);
                    debug('areDevicesAvailable answered with error: ', err.message);
                }
            );
        });

        socket.on('sendData', function(device, data) {
            debug('received sendData: ', device, 'data...');
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('sendData', ['Device type not supported', device]);
                return;
            }
            devmod.sendData(device, data, socket).then(
                function(res){
                    socket.emit('sendData', {res: res});
                    debug('sendData answered');
                },
                function(err){
                    socket.emitError('sendData', err);
                    debug('sendData answered with error: ', err.message);
                }
            );
        });

        socket.on('readData', function(device, length) {
            debug('received readData: ', device, length);
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('sendData', ['Device type not supported', device]);
                return;
            }
            devmod.readData(device, length).then(
                function(res){
                    socket.emit('readData', {res: res});
                    debug('readData answered');
                },
                function(err){
                    socket.emitError('readData', err);
                    debug('readData answered with error: ', err.message);
                }
            );
        });

        socket.on('startPoll', function(device) {
            debug('received startPoll: ', device);
            var devmod = getDeviceModule(device);
            if (!devmod) {
                socket.emitError('startPoll', ['Device type not supported', device]);
                return;
            }
            devmod.startPoll(device, socket).then(
                function(res){
                    socket.emit('startPoll', {res: res});
                    debug('startPoll answered');
                },
                function(err){
                    socket.emitError('startPoll', err);
                    debug('startPoll answered with error: ', err.message);
                }
            );
        });

        socket.on('stopPoll', function(device) {
            debug('received stopPoll: ', device);
            try {
                var devmod = getDeviceModule(device);
                devmod.stopPoll(device);
            }
            catch(error) {
                socket.emitError('stopPoll', error);
                debug('stopPoll answered with error:', error);
            }
        });
    });
} // end createServer()


// Display some information about this module (based on package.jon)
require('appinspect').print(module);

exports.createServer = function(port, https_options){
    return new Server(port, https_options);
}
