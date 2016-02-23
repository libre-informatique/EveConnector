var exports = module.exports = {};

var fs = require('fs');
var https_options = {
    key: fs.readFileSync(__dirname+'/server.key'),
    cert: fs.readFileSync(__dirname+"/server.crt")
}
var Devices = require('./devices.js');

createServer = function(port) {

    var app = require('https').createServer(https_options, handler);
    var io = require('socket.io')(app);

    app.listen(port);
    console.info('Eve-Connector up and running. Listening on port ' + port);

    function handler (req, res) {
        //res.writeHead(200);
        //res.end('Node.js https server.');

        fs.readFile(__dirname + 'web/index.html',
        function (err, data) {
          if (err) {
            res.writeHead(500);
            return res.end('Error loading index.html');
          }

          res.writeHead(200);
          res.end(data);
        });
    }

    io.on('connection', function(socket) {
        console.log('a user connected');

        socket.on('disconnect', function() {
            console.log('user disconnected');
        });

        socket.on('listDevices', function(type) {
            console.log('received listDevices: ', type);
            var list = Devices.listDevices(type);
            socket.emit('listDevices', list);
            console.log('listDevices answered');
        });

        socket.on('isDeviceAvailable', function(device) {
            console.log('received isDeviceAvailable: ', device);
            var res = {
                available: Devices.isDeviceAvailable(device),
                device: device
            };
            socket.emit('isDeviceAvailable', {res: res});
            console.log('isDeviceAvailable answered');
        });

        socket.on('areDevicesAvailable', function(query) {
            var type = query.type;
            var list = query.params;
            console.log('received areDevicesAvailable: ', query);
            var res =  Devices.areDevicesAvailable(type, list);
            socket.emit('areDevicesAvailable', {res: res});
            console.log('areDevicesAvailable answered');
        });

        socket.on('sendData', function(device, data) {
            console.log('received sendData: ', device, 'data...');
            var res =  Devices.sendData(device, data).then(
                function(res){
                    socket.emit('sendData', {res: res});
                    console.log('sendData answered');
                    Devices.pollDevice(device);
                },
                function(err){
                    socket.emit('sendData', {err: err});
                    console.log('sendData answered with error: ', err);
                }
            );
        });
    });

} // end createServer

exports.createServer = createServer;
