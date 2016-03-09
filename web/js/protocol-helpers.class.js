var nodejs = false;
try {
    if ( window !== this )
        nodejs = true;
} catch (e) {
    nodejs = true;
}

var ProtocolHelpers = {}

ProtocolHelpers.Physical = {
    messages: {
        0x05: 'enq', // session request
        0x06: 'ack', // session agreement
        0x15: 'nak', // session refusal
        0x02: 'stx', // message start
        0x03: 'etx', // message end
        0x04: 'eot', // session end
        
        enq: 0x05, // session request
        ack: 0x06, // acknoledgement
        nak: 0x15, // non-acknoledgement
        stx: 0x02, // message start
        etx: 0x03, // message end
        eot: 0x04, // session end
    },
    
    getSessionReq:    function(){ return ProtocolHelpers.Physical.encode('enq'); },
    getSessionEnd:    function(){ return ProtocolHelpers.Physical.encode('eot'); },
    getSessionAck:    function(){ return ProtocolHelpers.Physical.encode('ack'); },
    getNack:          function(){ return ProtocolHelpers.Physical.encode('nak'); },
    decode:           function(hexx){ return ProtocolHelpers.Physical.messages[hexx.charCodeAt(0)]; },
    encode:           function(id)  { return String.fromCharCode(ProtocolHelpers.Physical.messages[id]); },
    
    getFrame: function(msg){
        // init
        var packet = ProtocolHelpers.Physical.encode('stx');
        var check = [];
        var data = [];
        
        // the message itself
        check = msg;
        check += ProtocolHelpers.Physical.encode('etx');
        packet += check;
        
        // the checksum
        packet += ProtocolHelpers.Physical.getLrc(check);
        
        return packet;
    },
    
    getMessage: function(frame){
        if ( frame[0] != ProtocolHelpers.Physical.encode('stx') )
        {
            console.error('The frame is not preceded by the expected code: ',frame[0], frame);
            throw ProtocolHelpers.Physical.encode('nak');
        }
        
        if ( frame[frame.length-1] != ProtocolHelpers.Physical.getLrc(frame.slice(1,frame.length-1)) )
        {
            console.error('The frame has a bad checksum');
            throw ProtocolHelpers.Physical.encode('nak');
        }
        
        if ( frame[frame.length-2] != ProtocolHelpers.Physical.encode('etx') )
        {
            console.error('The message is not followed with the expected code');
            throw ProtocolHelpers.Physical.encode('nak');
        }
        
        return frame.slice(1, frame.length-2);
    },
    
    getLrc: function(str){
        var sum = 0x0;
        for ( var i = 0 ; i < str.length ; i++ )
            sum = sum ^ str.charCodeAt(i);
        return String.fromCharCode(sum);
    },
    
    hextoa: function(hexx){
        var hex = hexx.toString();//force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
          str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }
}

ProtocolHelpers.Logical = {};

if ( nodejs )
    exports.getProtocolHelpers = function(){ return ProtocolHelpers; }
