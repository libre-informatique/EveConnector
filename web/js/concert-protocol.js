var ConcertProtocolChars = {
    enq: String.fromCharCode(0x05), // session request
    ack: String.fromCharCode(0x06), // acknoledgement
    nak: String.fromCharCode(0x15), // non-acknoledgement
    stx: String.fromCharCode(0x02), // message start
    etx: String.fromCharCode(0x03), // message end
    eot: String.fromCharCode(0x04) // session end
}

var ConcertProtocolMessage = function(opts) {
    var defaults = {
        origin: 'client',
        version: 'E+',  // protocol version; can be 'E' or 'E+'
        pos: '01', // point of sale (cash desk) number (2 chars)
        amount: '00000000', // amount in cents (8 chars, left padded with zeros)
        ind: '1',  // asks for REP field in response ('1' = yes, other = no) (1 char)
        mode: '1', // payment method ('1' = credit card, 'C' = check, other = choice "CARTE CHEQUE") (1 char)
        type: '0', // transaction type ('0' = debit, '1' = credit, '2' = cancellation, '4' = pre-authorization) (1 char)
        dev: '978', // currency ('978' = Euro) (3 chars)
        priv: '0123456789', // private data (10 chars)
        delay: 'A010', // E+ only. Defines when the EPT response should be sent ('A010' = end of transaction, 'A011' = immediately without validation)
        auto: 'B010', // E+ only. Set to 'B011' to force an authorisation request ('B01x' with x in 0, 1, 2)
        stat: ' ', // status ('0' = transaction accepted, '7' = transaction not accepted) (1 char)
        rep: ' '.repeat(55), // response (55 chars)
    };
    opts = opts || {};
    Object.assign(defaults, opts);
    for (var prop in defaults)
        this[prop] = ( opts[prop] !== undefined ) ? opts[prop] : defaults[prop];

    if ( this.origin != 'client' && this.origin != 'server' )
        throw new Error('ConcertProtocolMessage.origin must be "client" or "server"');
    if ( this.version != 'E' && this.version != 'E+' )
        throw new Error('ConcertProtocolMessage.version must be "E" or "E+"');
}

ConcertProtocolMessage.prototype = {
    // left-pad a number with a caracter ('0' by default)
    pad: function (n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    },

    // compute control byte
    getLrc: function(str){
        var sum = 0x0;
        for ( var i = 0 ; i < str.length ; i++ )
            sum = sum ^ str.charCodeAt(i);
        return String.fromCharCode(sum);
    },

    prepareData: function() {
        this.amount = this.pad(parseInt(this.amount) + '', 8);
        // TODO: validate other fields (lengths and formats)
    },

    encode: function() {
        this.prepareData();
        var msg = this.pos + this.amount + this.ind + this.mode + this.type + this.dev + this.priv;
        if ( this.version == 'E+' )
            msg += this.delay + this.auto;
        if ( this.version == 'E+' && msg.length != 34 )
            throw new Error('Invalid message length for version E+ (should be 34): ' + msg);
        if ( this.version == 'E' && msg.length != 26 )
            throw new Error('Invalid message length for version E:  (should be 26)' + msg);
        var lrc = this.getLrc(msg + ConcertProtocolChars.etx);
        return ConcertProtocolChars.stx + msg + ConcertProtocolChars.etx + lrc;
    }
}

var ConcertProtocolResponse = function(msg) {
    if (msg.length != 83 && msg.length != 28)
        throw new Error('Invalid response length: ' + msg);

    // TODO: check STX, ETX, LRC

    this.pos = msg.substr(1, 2);
    this.stat = msg.substr(3, 1);
    this.amount = msg.substr(4, 8);
    this.mode = msg.substr(12, 1);
    if (msg.length == 83) {
        this.rep = msg.substr(13, 55);
        this.dev = msg.substr(68, 3);
        this.priv = msg.substr(71, 10);
    }
    else {
        this.rep = '';
        this.dev = msg.substr(13, 3);
        this.priv = msg.substr(16, 10);
    }

    this.getStatusText = function() {
        if ( this.stat === '0' ) return 'Transaction accepted';
        if ( this.stat === '7' ) return 'Transaction non accepted';
        if ( this.stat === '9' ) return 'Request handled';
        return 'Status unknown';
    }
}

var ConcertProtocolDevice = function(device, connector) {
    this.device = device;
    this.connector = connector;
    var sendingMsg = {};
    var that = this;

    var send = function(data) {
        return new Promise(function(resolve, reject){
            var EOT = ( data == ConcertProtocolChars.eot );
            // we don't need an ACK when sending EOT
            device.params.readAfterSend = true;
            connector.sendData(device, btoa(data)).then(function(res) {
                var decoded = res !== undefined ? atob(res) : '';
                if ( EOT ) resolve('EOT');
                else if ( decoded == ConcertProtocolChars.ack ) resolve('ACK');
                else if ( decoded == ConcertProtocolChars.nak ) reject('got NAK');
                else reject('Unexpected response from ETP: ' + decoded);
            }).catch(function(err){
                console.error(err);
                reject(err);
            });
        });
    }

    var sendENQ = function() {
        return send(ConcertProtocolChars.enq);
    }

    var sendEOT = function() {
        return send(ConcertProtocolChars.eot);
    }

    var sendData = function() {
        return send(sendingMsg.encode());
    }

    var read = function() {
        return new Promise(function(resolve, reject){
            connector.readData(device).then(function(res){
                console.info('read res = ', atob(res));
                resolve(res);
            }).catch(function(err){
                reject(err);
            });
        });
    }

    this.sendMessage = function(msg) {
        if ( ! msg instanceof ConcertProtocolMessage )
            throw new Error('msg must be an instance of ConcertProtocolMessage');
        sendingMsg = msg;
        sendENQ().then(sendData).then(sendEOT).catch(function(err){
            console.error('Got error', err);
        });
    }

    this.doTransaction = function(msg) {
        if ( ! msg instanceof ConcertProtocolMessage )
            throw new Error('msg must be an instance of ConcertProtocolMessage');
        var writes = [
            btoa(ConcertProtocolChars.enq),
            btoa(msg.encode()),
            btoa(ConcertProtocolChars.eot),
            btoa(ConcertProtocolChars.ack),
            btoa(ConcertProtocolChars.ack)
        ];
        var reads = [
            btoa(ConcertProtocolChars.ack),
            btoa(ConcertProtocolChars.ack),
            btoa(ConcertProtocolChars.enq),
            btoa('*'),
            btoa(ConcertProtocolChars.eot)
        ];
        var data = {writes: writes, reads: reads};
        return connector.sendData(device, data).then(function(res) {
            console.info('doTransaction res = ', atob(res));
            return new ConcertProtocolResponse(atob(res));
        });
    }
}
