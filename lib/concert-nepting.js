var ConcertProtocolChars = {
    enq: String.fromCharCode(0x05), // session request
    ack: String.fromCharCode(0x06), // acknowledgement
    nak: String.fromCharCode(0x15), // non-acknowledgement
    stx: String.fromCharCode(0x02), // message start
    etx: String.fromCharCode(0x03), // message end
    eot: String.fromCharCode(0x04) // session end
}

var ConcertProtocolMessage = function(opts) {
    var defaults = {
        origin: 'client',
        version: 'E',  // protocol version; can be 'E' or 'E+'
        pos: '01', // point of sale (cash desk) number (2 chars)
        amount: '00000000', // amount in cents (8 chars, left padded with zeros)
        ind: '1',  // asks for REP field in response ('1' = yes, other = no) (1 char)
        mode: '1', // payment method ('1' = credit card, 'C' = check, other = choice "CARTE CHEQUE") (1 char)
        type: '0', // transaction type ('0' = debit, '1' = credit, '2' = cancellation, '4' = pre-authorization) (1 char)
        dev: '978', // currency ('978' = Euro) (3 chars)
        priv: '0123456789', // private data (10 chars)
        rcpt: 'T012', // ask for client receipt
        status: '', // status ('0' = transaction accepted, '7' = transaction not accepted, '9' = request handled) (1 char)
        rep: ''
    };

    opts = opts || {};

    Object.assign(defaults, opts);

    for (var prop in defaults)
        this[prop] = ( opts[prop] !== undefined ) ? opts[prop] : defaults[prop];
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
        const msg = this.pos + this.amount + this.ind + this.mode + this.type + this.dev + this.priv + this.rcpt;

        const lrc = this.getLrc(msg + ConcertProtocolChars.etx);

        return ConcertProtocolChars.stx + msg + ConcertProtocolChars.etx + lrc;
    }
}

var ConcertProtocolResponse = function(msg)  {
    this.pos = msg.substr(1, 2);
    this.status = msg.substr(3, 1);
    this.amount = msg.substr(4, 8);
    this.mode = msg.substr(12, 1);
    this.rep = msg.substr(13, 55);
    this.dev = msg.substr(68, 3);
    this.priv = msg.substr(71, 10);
    this.receipt = this.trimReceipt(msg.substr(81));
}

ConcertProtocolResponse.prototype = {
    trimReceipt: function(receipt) {
        receipt = receipt.split('\n');

        receipt.pop();

        delete receipt[0];
        delete receipt[1];
        delete receipt[2];

        receipt = Object.values(receipt);

        return receipt.join('\n');
    }
};

module.exports = {
    message: ConcertProtocolMessage,
    chars: ConcertProtocolChars,
    response: ConcertProtocolResponse
}
