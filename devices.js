var exports = module.exports = {};

var usb = require('usb');
var atob = require('atob');
var when = require('when');

checkDeviceType = function(device)
{
    if ( ! device.type )
        throw (['Device type is empty', device])
    if ( ! device.params )
        throw (['Device params is empty', device])
    switch ( device.type ) {
        case 'usb':
            if ( !device.params.vid || !device.params.pid )
                throw (['You must provide VID and PID parameters for USB devices', device.params]);
            break;
        default:
            throw (['Device type not supported', device.type]);
    }
}

listDevices = function(type) {
    switch ( type ) {
        case 'usb':
            return listUsbDevices();
        default:
            throw (['Device type not supported', type]);
    }
}

listUsbDevices = function() {
    return usb.getDeviceList();
}

isDeviceAvailable = function(device)
{
    checkDeviceType(device);
    switch ( device.type ) {
        case 'usb':
            return isUsbDeviceAvailable(device);
        default:
            return false;
    }
}

isUsbDeviceAvailable = function(device)
{
    var found = usb.findByIds(parseInt(device.params.vid), parseInt(device.params.pid));
    return ( found !== undefined );
}

areDevicesAvailable = function(type, devicesList)
{
    var available = { type: type, params: []};
    devicesList.forEach(function(d){
        var device = {type: type, params:{vid: d.vid, pid: d.pid}};
        if (isDeviceAvailable(device))
            available.params.push({vid: d.vid, pid: d.pid});
    });
    return available;
}

sendData = function(device, data) {
    checkDeviceType(device);
    switch ( device.type ) {
        case 'usb':
            return sendDataToUsb(device, data);
        default:
            return false;
    }
}

sendDataToUsb = function(device, data)
{
    return when.promise(function(resolve, reject){
        var usbdev = usb.findByIds(parseInt(device.params.vid), parseInt(device.params.pid));
        if ( usbdev === undefined) {
            reject('Device not available');
        }
        usbdev.open();
        
        console.log('Resetting USB device...')
        usbdev.reset(function(error){
            error && reject(error);

            // we use the first interface
            var interface = usbdev.interface(0);
            if ( interface.isKernelDriverActive() )
                interface.detachKernelDriver();
            interface.claim();

            // we use the first OUT endpoint
            var outEp = interface.endpoints.find(function(ep){
                return ep.direction === "out";
            });
            if (outEp == undefined) {
                console.error('OUT enpoint not found on device')
                reject('OUT enpoint not found on device');
            }

            // decode base64 data
            var bin = new Buffer(atob(data.toString()), 'binary');

            console.log('sending data... ');
            outEp.transfer(bin, function(error, tf_data){
                console.log('...data sent to USB');
                error && reject(error);
                resolve(tf_data);
            });
        });
    });
}

pollDevice = function(device)
{
    return when.promise(function(resolve, reject){
        var usbdev = usb.findByIds(parseInt(device.params.vid), parseInt(device.params.pid));
        if ( usbdev === undefined) {
            reject('Device not available');
        }
        usbdev.open();

        // we use the first interface
        var interface = usbdev.interface(0);
        if ( interface.isKernelDriverActive() )
            interface.detachKernelDriver();
        interface.claim();

        // we use the first IN endpoint
        var inEp = interface.endpoints.find(function(ep){
            return ep.direction === "in";
        });
        if (inEp == undefined) {
            console.log('IN enpoint not found on device')
        }
        else {
            // we start listen to the IN endpoint
            //var session = module.parent.exports.getSession();
            inEp.on('data', function(data) {
                if ( data.length ) {
                    console.log('ondata received:', data, data.length);
                    inEp.stopPoll();
                }

            });
            console.log('Start polling device', device);
            inEp.startPoll();
        }
    });
}


testStar = function() {
    var usbdev = usb.findByIds(1305, 1);

    if ( usbdev === undefined) {
        throw new Error('Device not available');
    }
    usbdev.open();

    // we use the first interface we find
    var interface = usbdev.interface(0);
    if ( interface.isKernelDriverActive() )
        interface.detachKernelDriver();
    interface.claim();

    // TODO: chose the OUT endpoint
    var outEp = interface.endpoints[0];

    var fs = require('fs');

    var data2;
    fs.readFile('../raw_data/test-1805-b64.prn', (err, data) => {
        if (err)
            throw err;

        raw = atob(data.toString());
        data2 = new Buffer(raw, 'binary');
        console.log('data2', data2, data2.byteLength);

        outEp.transfer(data2, function(error, tf_data){
            console.log("transfer error:", error);
        });
    });
}

test = function(device)
{
    console.log('test');
    var d = when.defer();
    setTimeout(function () {
        //throw(['this is the error']);
        d.resolve( 'toto' );
    }, 5000);
    return d.promise;
}

exports.isDeviceAvailable = isDeviceAvailable;
exports.areDevicesAvailable = areDevicesAvailable;
exports.listDevices = listDevices;
exports.sendData = sendData;
exports.pollDevice = pollDevice;
exports.testStar = testStar;
exports.test = test;
