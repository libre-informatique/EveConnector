var exports = module.exports = {};

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var parsers = serialport.parsers;
var atob = require('atob');
var btoa = require('btoa');
var when = require('when');
var debug = require('debug')('eve-connector:serial');

// polling USB interfaces
var _pollingUsb = [];



var checkDeviceType = function(device)
{
    if (!device)
        throw ('device is undefined')
    if ( device.type != 'serial' )
        throw (['Device type should be "serial"', device])
    if ( ! device.params )
        throw (['Device params is empty', device])
    if ( !device.params.pnpId && !device.params.comName )
        throw (['You must provide pnpId or comName parameters for serial devices', device.params]);
}

var listDevices = function(type)
{
    return when.promise(function(resolve, reject){
        serialport.list(function (err, ports) {
            if (err) reject(err);
            else resolve(ports);
        });
    });
};

var isDeviceAvailable = function(device)
{
    return when.promise(function(resolve, reject){
        debug('isDeviceAvailable()');
        checkDeviceType(device);
        serialport.list(function (err, ports) {
            if (err)
                reject(err);
            else {
                var comName = device.params.comName;
                var pnpId = device.params.pnpId;
                var available = ports.find(function(port){
                    if (comName && pnpId && comName === port.comName && port.pnpId.includes(pnpId))
                        return true;
                    if (comName && comName === port.comName)
                        return true;
                    if (pnpId &&port.pnpId.includes(pnpId))
                        return true;
                    return false;
                });
                resolve({available: available, device: device});
            }
        });
    });
}

var areDevicesAvailable = function(type, devicesList)
{
    debug('areDevicesAvailable()');
    var available = { type: type, params: []};
    var checks = [];
    devicesList.forEach(function(device){
        var check = when.promise(function(resolve, reject){
            serialport.list(function (err, ports) {
                if (err)
                    reject(err);
                else {
                    var comName = device.comName;
                    var pnpId = device.pnpId;
                    var found = ports.find(function(port){
                        if (comName && pnpId && comName === port.comName && port.pnpId.includes(pnpId))
                            return true;
                        if (comName && comName === port.comName)
                            return true;
                        if (pnpId &&port.pnpId.includes(pnpId))
                            return true;
                        return false;
                    });
                    if (found)
                        available.params.push(found);
                    resolve(available);
                }
            });
        });
        checks.push(check);
    });
    return when.all(checks);
}

var resetData = function(device, socket)
{
    //usb.setDebugLevel(4);
    return when.promise(function(resolve, reject){
        debug('Resetting device (TODO)...');
        resolve('device reset (fake)');
    });
};

var sendData = function(device, data, socket)
{
    debug('sendData()');
    if ( Array.isArray(data.writes) &&  Array.isArray(data.reads) )
        return doTransaction(device, data);

    return getComName(device)
    .then(function(comName){
        return when.promise(function(resolve, reject){
            debug('sending data to comName=' + comName);
            var port = new SerialPort(comName, {
                baudrate: device.params.baudrate ? device.params.baudrate : 9600,
                //parser: serialport.parsers.byteLength(42), // TODO: this is specific to SCD122U
                dataBits: device.params.databits ? device.params.databits : 8,
                parity: device.params.parity ? device.params.parity : 'none',
                stopBits: device.params.stopbits ? device.params.stopbits : 1
            });
            var readAfterSend = device.params.readAfterSend;

            port.on('open', function() {
                data = new Buffer(atob(data.toString()));
                port.write(data, function(err) {
                    if (err) {
                      debug('Error on write: ', err.message);
                      port.close();
                      reject(err);
                    }
                    debug('Message written: ' + data);
                    if ( !readAfterSend ) {
                        port.close();
                        // we send back base64 encoded data
                        resolve(data != undefined ? btoa(data) : '');
                    }
                });
            });

            port.on('data', function(data) {
                debug('got data after send:' + data , data.toString().charCodeAt(0));
                if ( readAfterSend ) {
                    port.close();
                    // we send back base64 encoded data
                    resolve(data != undefined ? btoa(data) : '');
                }
            });

            // open errors will be emitted as an error event
            port.on('error', function(err) {
                debug('serial port Error: ', err.message);
                reject(err);
            });
        });
    });
};


var readData = function(device, length)
{
    debug('readData()');
    return getComName(device)
    .then(function(comName){
        return when.promise(function(resolve, reject){
            debug('reading data from comName=' + comName);
            var port = new SerialPort(comName, {
                baudrate: device.params.baudrate ? device.params.baudrate : 9600,
                //parser: serialport.parsers.byteLength(42), // TODO: this is specific to SCD122U
                dataBits: device.params.databits ? device.params.databits : 8,
                parity: device.params.parity ? device.params.parity : 'none',
                stopBits: device.params.stopbits ? device.params.stopbits : 1
            });

            port.on('data', function(data) {
                debug('got data:' + data , data.toString().charCodeAt(0));
                port.close();
                // we send back base64 encoded data
                resolve(data != undefined ? btoa(data) : '');
            });

            port.on('error', function(err) {
                debug('serial port Error: ', err.message);
                reject(err);
            });
        });
    })
}

var doTransaction = function(device, data)
{
    debug('doTransaction()');
    var writes = data.writes || [];
    var reads = data.reads || [];
    var result = '';
    return getComName(device).then(function(comName){
        return when.promise(function(resolve, reject){
            debug('Start transaction with comName=' + comName);
            var port = new SerialPort(comName, {
                baudrate: device.params.baudrate ? device.params.baudrate : 9600,
                //parser: serialport.parsers.byteLength(42), // TODO: this is specific to SCD122U
                dataBits: device.params.databits ? device.params.databits : 8,
                parity: device.params.parity ? device.params.parity : 'none',
                stopBits: device.params.stopbits ? device.params.stopbits : 1
            });

            var done = function() {
                port.close();
                // we send back base64 encoded data
                resolve(result != undefined ? btoa(result) : '');
            }

            var write = function() {
                if ( writes.length > 0 ) {
                    var data = writes.shift();
                    data = new Buffer(atob(data.toString()));
                    port.write(data, function(err) {
                        if (err) {
                          debug('Error on write: ', err.message);
                          port.close();
                          reject(err);
                        }
                        debug('Message written: ' + data);
                        if ( reads.length == 0 ) {
                            if ( writes.length == 0 ) done();
                            else write();
                        }
                    });
                }
                else if ( reads.length == 0 ) done();
            }

            port.on('open', write);

            port.on('data', function(data) {
                debug('got data:' + data , data.toString().charCodeAt(0));
                var found = false;
                if ( reads.length > 0 ) {
                    var next = atob(reads[0]);
                    debug('next:' + next , next.toString().charCodeAt(0));
                    if ( next == '*' ) {
                        result = data;
                        found = true;
                    }
                    if ( next == data )
                        found = true;
                }
                if ( found ) {
                    reads.shift();
                    write();
                }
                if ( reads.length == 0 && writes.length == 0 ) done();
            });

            // open errors will be emitted as an error event
            port.on('error', function(err) {
                debug('serial port Error: ', err.message);
                reject(err);
            });
        });
    });
};

/**
 * returns the comName of the first device having a pnpId containing pnpId
 */
var getComName = function(device)
{
    return when.promise(function(resolve, reject) {
        if (device.params.comName)
            resolve(device.params.comName)

        else serialport.list(function (err, ports) {
            if (err)
                reject(err.msg);
            else {
                var pnpId = device.params.pnpId;
                var found = ports.find(function(port){
                    return pnpId && port.pnpId.includes(pnpId);
                });
                if (found) resolve(found.comName);
                else reject('Device not found for pnpId ' + pnpId);
            }
        });
    });
}


exports.isDeviceAvailable = isDeviceAvailable;
exports.areDevicesAvailable = areDevicesAvailable;
exports.listDevices = listDevices;
exports.sendData = sendData;
exports.readData = readData;
//exports.test = test;
