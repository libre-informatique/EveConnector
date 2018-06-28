const atob = require('atob');
const btoa = require('btoa');
const when = require('when');
const debug = require('debug')('eve-connector:websocket');
const net = require('net');

const ConcertProtocolChars = require('./concert-nepting.js').chars;
const ConcertProtocolResponse = require('./concert-nepting.js').response;
const ConcertProtocolMessage = require('./concert-nepting.js').message;

const isDeviceAvailable = function(device)
{
    debug('isDeviceAvailable()');

    return when.promise(function(resolve, reject){
        const socket = new net.Socket();

        socket.connect(device.params.port, device.params.ip, function() {
            socket.destroy();
            resolve({available: true, device: device});
        });
        
        socket.on('error', function(){
            resolve({available: false, device: device});
        });
    });
}

const payment = function(device, amount)
{
    var messageSent = false;
    var result;

    return when.promise(function(resolve, reject){
        const socket = new net.Socket();
        const message = new ConcertProtocolMessage({amount: amount});

        socket.connect(device.params.port, device.params.ip, function() {
            socket.write(ConcertProtocolChars.enq);
        });

        socket.on('data', function(response) {
            response = atob(response);

            switch(response) {
                case ConcertProtocolChars.enq:
                    socket.write(ConcertProtocolChars.ack);

                    break;

                case ConcertProtocolChars.ack:
                    if(!messageSent) {
                        socket.write(message.encode());

                        messageSent = true;
                    }

                    break;

                case ConcertProtocolChars.nak:

                    resolve('RESULT: failure');

                    break;

                case ConcertProtocolChars.eot:
                    resolve(result);

                    socket.destroy();

                    break;

                default:
                    result = new ConcertProtocolResponse(response);
                    socket.write(ConcertProtocolChars.ack);
                    console.log('RESULT: ', result);
            }
        });

        socket.on('close', function() {
            console.log('Connection closed');
        });
    });
}

module.exports = {
    isDeviceAvailable: isDeviceAvailable,
    payment: payment
}
