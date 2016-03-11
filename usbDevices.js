var exports = module.exports = {};

var usb = require('usb');
var atob = require('atob');
var btoa = require('btoa');
var when = require('when');
var debug = require('debug')('eve-connector:usb');

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
    return when.promise(function(resolve, reject){
        debug('isDeviceAvailable()');
        checkDeviceType(device);
        var found = usb.findByIds(parseInt(device.params.vid), parseInt(device.params.pid));
        var res = {
            available: ( found !== undefined ),
            device: device
        }
        resolve(res);
    });
}

var areDevicesAvailable = function(type, devicesList)
{
    debug('areDevicesAvailable()');
    var available = { type: type, params: []};
    var checks = [];
    devicesList.forEach(function(d){
        var device = {type: type, params:{vid: d.vid, pid: d.pid}};
        var check = when.promise(function(resolve, reject){
            isDeviceAvailable(device).then(
                function(res){
                    if ( res.available )
                        available.params.push({vid: d.vid, port: d.pid});
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

var sendData = function(device, data, socket)
{
    //usb.setDebugLevel(4);
    return when.promise(function(resolve, reject){
        checkDeviceType(device);

        var wasPolling = isPolling(device);
        stopPoll(device);

        var vid = parseInt(device.params.vid);
        var pid = parseInt(device.params.pid);
        var usbdev = usb.findByIds(vid, pid);
        if ( usbdev === undefined) {
            throw new Error('Device not available');
        }
        usbdev.open();

        debug('Resetting device...');
        usbdev.reset(function(error){
            error && reject(error);
            debug('Device reset');
            try {
                var interface = claimUsbInterface(vid, pid);
                var outEp = getEndpoint(interface, 'out');
                outEp.on('error', function(epError){
                    debug('outEp error', epError)
                    wasPolling && startPoll(device);
                    reject(epError);
                });

                // decode base64 data
                var bin = new Buffer(atob(data.toString()), 'binary');

                debug('sending data... ');
                outEp.transfer(bin, function(epError, tf_data){
                    debug('...data sent to USB');
                    wasPolling && startPoll(device, socket);
                    epError && reject(epError);
                    resolve(tf_data);
                });
            }
            catch(e){
                wasPolling && startPoll(device);
                reject(e);
            }
        });
    });
};



var readData = function(device, length)
{
    debug('readData()');
    return when.promise(function(resolve, reject){
        checkDeviceType(device);
        var interface = claimUsbInterface(device.params.vid, device.params.pid);
        var inEp = getEndpoint(interface, 'in');

        inEp.on('error', function(error) {
            debug('inEp error', error);
            reject(error);
        });

        length = length || inEp.descriptor.wMaxPacketSize;
        debug('Start reading in endpoint on device', device);
        inEp.transfer(length, function(error, data){
            error && reject(error);
            debug('readData:', data);
            // we send back base64 encoded data
            resolve(data != undefined ? btoa(data) : '');
        });
    });
}

var isPolling = function(device) {
    var polling = _pollingUsb.find(function(item){
        return ( item.vid == device.params.vid && item.pid == device.params.pid );
    });
    return polling !== undefined;
}

var getPollingEndpoint = function(device) {
    var polling = _pollingUsb.find(function(item){
        return ( item.vid == device.params.vid && item.pid == device.params.pid );
    });
    return ( polling !== undefined ) ? polling.endpoint : null;
}

var startPoll = function(device, socket)
{
    return when.promise(function(resolve, reject){
        checkDeviceType(device);

        if ( isPolling(device) ) {
            debug('Already polling device...', device);
            return resolve(true);
            debug('we should not get there');
        }

        var interface = claimUsbInterface(device.params.vid, device.params.pid);
        var inEp = getEndpoint(interface, 'in');

        inEp.on('error', function(error) {
            debug('inEp polling error', error);
        });

        inEp.on('end', function(error) {
            debug('inEp polling ended');

            var polling = _pollingUsb.find(function(item){
                return ( item.endpoint == inEp );
            });
            if ( polling !== undefined )
                _pollingUsb.splice(_pollingUsb.indexOf(polling), 1);

            inEp.removeListener('data');
        });

        inEp.on('data', function(data) {
            if ( data && data.length ) {
                debug('inEp data received:', data, data.length, device);
                socket.emit('usbPoll', btoa(data));
            }
        });
        debug('Start polling device...', device);
        inEp.startPoll();
        _pollingUsb.push({
            vid: device.params.vid,
            pid: device.params.pid,
            endpoint: inEp
        });
        resolve(true);
    });
}

var stopPoll = function(device)
{
    checkDeviceType(device);
    var inEndpoint = getPollingEndpoint(device);
    if ( !inEndpoint ) {
        debug('Was not polling device...', device);
        return;
    }
    inEndpoint.stopPoll();
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
    // TODO: implement interface number
    var interface = usbdev.interface(0);

    if ( process.platform == 'linux' && interface.isKernelDriverActive() )
        interface.detachKernelDriver();
    interface.claim();
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
    debug('test');
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
