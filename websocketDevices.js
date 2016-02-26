var exports = module.exports = {};

var atob = require('atob');
var btoa = require('btoa');
var when = require('when');

var checkDeviceType = function(device)
{
    if (!device)
        throw ('device is undefined')
    if ( device.type != 'usb' )
        throw (['Device type should be "usb"', device])
    if ( ! device.params )
        throw (['Device params is empty', device])
    if ( !device.params.url )
        throw (['You must provide url param for websocket devices', device.params]);
}

var listDevices = function() {
    return [];
}

var isDeviceAvailable = function(device)
{
    checkDeviceType(device);
    var url = device.params.url;
    return false;
}

var areDevicesAvailable = function(type, devicesList)
{
    var available = { type: type, params: []};
    devicesList.forEach(function(d){
        var device = {type: type, params:{url: d.url}};
        if (isDeviceAvailable(device))
            available.params.push({url: d.url});
    });
    return available;
}

var sendData = function(device, data)
{
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var url = device.params.url;
        reject('sendData() is not implemented yet for websocket devices');
    });
}

var readData = function(device, length)
{
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var url = device.params.url;
        reject('readData() is not implemented yet for websocket devices');
    });
}

var startPoll = function(device, socket)
{
    checkDeviceType(device);
    var url = device.params.url;
    throw new Error('startPoll() is not implemented yet for websocket devices');
}

var stopPoll = function(device) {
    checkDeviceType(device);
    var url = device.params.url;
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
