var exports = module.exports = {};

var usb = require('usb');
var atob = require('atob');
var btoa = require('btoa');
var when = require('when');

// claimed USB interfaces
var _claimedUsb = [];

// polling USB interfaces
var _pollingUsb = [];

var checkDeviceType = function(device)
{
    if (!device)
        throw ('device is undefined')
    if ( device.type != 'usb' )
        throw (['Device type should be "usb"', device])
    if ( ! device.params )
        throw (['Device params is empty', device])
    if ( !device.params.vid || !device.params.pid )
        throw (['You must provide VID and PID parameters for USB devices', device.params]);
}

var listDevices = function(type) {
    return usb.getDeviceList();
}

var isDeviceAvailable = function(device)
{
    var found = usb.findByIds(parseInt(device.params.vid), parseInt(device.params.pid));
    return ( found !== undefined );
}

var areDevicesAvailable = function(type, devicesList)
{
    var available = { type: type, params: []};
    devicesList.forEach(function(d){
        var device = {type: type, params:{vid: d.vid, pid: d.pid}};
        if (isDeviceAvailable(device))
            available.params.push({vid: d.vid, pid: d.pid});
    });
    return available;
}

var sendData = function(device, data)
{
    //usb.setDebugLevel(4);
    return when.promise(function(resolve, reject){
        checkDeviceType(device);

        var vid = parseInt(device.params.vid);
        var pid = parseInt(device.params.pid);
        var usbdev = usb.findByIds(vid, pid);
        if ( usbdev === undefined) {
            throw new Error('Device not available');
        }
        console.log('Opening device...');
        usbdev.open();
        console.log('Device opened');

        console.log('Resetting device...');
        usbdev.reset(function(error){
            error && reject(error);
            console.log('Device reset');
            var interface = claimUsbInterface(vid, pid);
            var outEp = getEndpoint(interface, 'out');

            // decode base64 data
            var bin = new Buffer(atob(data.toString()), 'binary');

            outEp.on('error', function(epError){
                console.log('outEp error', epError)
                reject(epError);
            });

            console.log('sending data... ');
            outEp.transfer(bin, function(epError, tf_data){
                console.log('...data sent to USB');
                epError && reject(epError);
                resolve(tf_data);
            });

        });
    });
}

var readData = function(device, length)
{
    console.log('usbDevices::readData');
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var interface = claimUsbInterface(device.params.vid, device.params.pid);
        var inEp = getEndpoint(interface, 'in');

        inEp.on('error', function(error) {
            console.log('inEp error', error);
            reject(error);
        });

        length = length || inEp.descriptor.wMaxPacketSize;
        console.log('Start reading in endpoint on device', device);
        inEp.transfer(length, function(error, data){
            error && reject(error);
            console.log('readData:', data);
            // we send back base64 encoded data
            resolve(data != undefined ? btoa(data) : '');
        });
    });
}

var startPoll = function(device, socket)
{
    checkDeviceType(device);
    var interface = claimUsbInterface(device.params.vid, device.params.pid);
    var inEp = getEndpoint(interface, 'in');

    inEp.on('error', function(error) {
        console.log('inEp polling error', error);
    });

    inEp.on('end', function(error) {
        console.log('inEp polling ended');
    });

    inEp.on('data', function(data) {
        if ( data && data.length ) {
            console.log('inEp data received:', data, data.length, device);
            socket.emit('usbPoll', btoa(data));
        }
    });
    console.log('Start polling device...', device);
    inEp.startPoll();
    _pollingUsb.push({
        vid: device.params.vid,
        pid: device.params.pid,
        endpoint: inEp,
        polling: true
    });
}

var stopPoll = function(device)
{
    var polling = _pollingUsb.find(function(item){
        return ( item.vid == device.params.vid && item.pid == device.params.pid );
    });
    if ( polling == undefined )
        throw new Exception('Was not polling');

    polling.endpoint.stopPoll();
}


var claimUsbInterface = function(vid, pid)
{
    vid = parseInt(vid);
    pid = parseInt(pid);

    var usbdev = usb.findByIds(vid, pid);
    if ( usbdev === undefined) {
        throw new Error('Device not available');
    }
    usbdev.open();

    // we use the first interface
    var interface = usbdev.interface(0);

    // Check if interface has already been claimed
    var claimed = _claimedUsb.find(function(device){
        return (device.vid == vid && device.pid == pid);
    });
    if ( claimed == undefined ) {
        console.log('interface not claimed yet');
        if ( process.platform == 'linux' && interface.isKernelDriverActive() )
            interface.detachKernelDriver();
        interface.claim();
        _claimedUsb.push({vid: vid, pid: pid});
    }

    return interface;
}


var getEndpoint = function(interface, direction)
{
    var endpoint = interface.endpoints.find(function(ep){
        return ep.direction === direction;
    });
    if (endpoint == undefined)
        throw new Error(direction + ' enpoint not found on interface');

    return endpoint;
}


var test = function(device)
{
    console.log('test');
    startPoll(device);
    setTimeout(function () {
        //throw(['this is the error']);
        //stopPoll(device);
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
