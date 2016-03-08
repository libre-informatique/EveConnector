var exports = module.exports = {};

var atob = require('atob');
var btoa = require('btoa');
var when = require('when');

var checkDeviceType = function(device)
{
    if (!device)
        throw ('device is undefined')
    if ( device.type != 'websocket' )
        throw (['Device type should be "websocket"', device])
    if ( ! device.params )
        throw (['Device params is empty', device])
    if ( !device.params.ip )
        throw (['You must provide ip param for websocket devices', device.params]);
    if ( !device.params.port )
        throw (['You must provide port param for websocket devices', device.params]);
}

var listDevices = function() {
    return [];
}

var isDeviceAvailable = function(device)
{
    console.log('websocketDevices::areDevicesAvailable');
    checkDeviceType(device);
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var url = 'ws://' + device.params.ip + ':' + device.params.port;
        var deviceSocket = require('socket.io-client')(url, {reconnection: false});
        deviceSocket.on('connect', function(){
          console.log('connect success');
          deviceSocket.disconnect();
          resolve({available: true, device: device});
        });
        deviceSocket.on('connect_error', function(){
          resolve({available: false, device: device});
        });
    });
}

var areDevicesAvailable = function(type, devicesList)
{
    console.log('websocketDevices::areDevicesAvailable');
    var available = { type: type, params: []};
    var checks = [];
    devicesList.forEach(function(d){
        var device = {type: type, params:{ip: d.ip, port: d.port}};
        var check = when.promise(function(resolve, reject){
            isDeviceAvailable(device).then(
                function(res){
                    if ( res.available )
                        available.params.push({ip: d.ip, port: d.port});
                    resolve(available);
                },
                function(err){
                    reject(err);
                }
            );
        });
        checks.push(check);
    });
    return when.all(checks);
}

var sendData = function(device, data)
{
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var ip = device.params.ip;
        var port = device.params.port;
        reject('sendData() is not implemented yet for websocket devices');
    });
}

var readData = function(device, length)
{
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var ip = device.params.ip;
        var port = device.params.port;
        reject('readData() is not implemented yet for websocket devices');
    });
}

var startPoll = function(device, socket)
{
    checkDeviceType(device);
    var ip = device.params.ip;
    var port = device.params.port;
    throw new Error('startPoll() is not implemented yet for websocket devices');
}

var stopPoll = function(device) {
    checkDeviceType(device);
    var ip = device.params.ip;
    var port = device.params.port;
    throw new Error('stopPoll() is not implemented yet for websocket devices');
}

var test = function(device)
{
    checkDeviceType(device);
    console.log('test starting...');
    setTimeout(function () {
        //throw(['this is the error']);
        console.log('test end');
    }, 1000);
}

exports.isDeviceAvailable = isDeviceAvailable;
exports.areDevicesAvailable = areDevicesAvailable;
exports.listDevices = listDevices;
exports.sendData = sendData;
exports.startPoll = startPoll;
exports.stopPoll = stopPoll;
exports.readData = readData;
exports.test = test;
