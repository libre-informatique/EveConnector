var EPTclient = function() {
    this.eveconn = new EveConnector('https://localhost:8164', function(){
        console.log('EvcConnector');
    });
}
