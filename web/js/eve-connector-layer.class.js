var nodejs = false;
try {
  if ( window !== this )
    nodejs = true;
} catch (e) {
  nodejs = true;
}

/**
 * The EveConnectorLayer is a kind of ApplicationLayer overloaded
 * The EveConnectorLayer overloads the PhysicalLayer for giving it the logical to talk with an EveConnector
 **/
var EveConnectorLayer = function(interactive, pos, currency, mod, type, ind) {
    var current = this;
    this.application = nodejs
        ? require('./application-layer.class.js').createApplicationLayer(interactive, pos, currency, mod, type, ind)
        : new ApplicationLayer(interactive, pos, currency, mod, type, ind);
    this.device     = {};
    this.eveconn    = {};

    // overloads the PhysicalLayer to use an EveConnector instead of a direct connection
    this.application.logical.physical.createClient = function(eveConnectorURL){
        current.eveconn = new EveConnector(eveConnectorURL, function(){
            current._call('clientConnection');
        });
    };

    /**
     * function createClient
     *
     * @param eveConnectorUrl      an URL to connect a EveConnector through websockets
     * @param device               eg. { type: 'websocket', params: { ip: 'xxx.xxx.xxx.xxx', port: 'xxx' } }
     **/
    this.createClient = function(eveConnectorUrl, device){
        this.device = device;
        return this.application.createClient(eveConnectorUrl);
    }

    this.prepareTransaction = function(amount, private){
        this.application.prepareTransaction(amount, private);
    }

    this._call = function(name, data){
        this.application.logical.physical._call(name, data);
    }

    this.application.logical.physical
        .clear([
            'send'
        ])
        .on('clientConnection', function(){
            current.eveconn.startPoll(current.device, function(msg){
                current._call('gotPoll', msg);
            })
            .then(function(res){
                console.info('Polling device...', current.device);
            })
            .catch(function(err){
                console.error('Could not stat polling device', current.device, err);
            });
        })
        .on('send', function(data){
            current.eveconn.sendData(current.device, btoa(data)).then(
               function(res) { console.info("EveConnector.sendData() result:", res); },
               function(err) { console.error("EveConnector.sendData() error:", err); }
            );
            /*
            current.eveconn.isDeviceAvailable(current.device).then(
                function(res){
                    if ( !res.available )
                    {
                        console.error('No device available.');
                        return;
                    }

                },
                function(err){
                    console.error('Device in error.');
                }
            );
            */
        })
        .on('gotPoll', function(msg){
            current.application.logical.physical.events.binary(atob(msg));
        });
    ;
}

if ( nodejs )
exports.createEveConnectLayer = function(interactive, pos, currency, mod, type, ind){
    return new EveConnectorLayer(interactive, pos, currency, mod, type, ind);
}
