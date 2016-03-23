/**********************************************************************************
*
*           This file is part of e-venement.
*
*    e-venement is free software; you can redistribute it and/or modify
*    it under the terms of the GNU General Public License as published by
*    the Free Software Foundation; either version 2 of the License.
*
*    e-venement is distributed in the hope that it will be useful,
*    but WITHOUT ANY WARRANTY; without even the implied warranty of
*    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*    GNU General Public License for more details.
*
*    You should have received a copy of the GNU General Public License
*    along with e-venement; if not, write to the Free Software
*    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*
*    Copyright (c) 2006-2016 Baptiste SIMON <baptiste.simon AT e-glop.net>
*    Copyright (c) 2015-2016 Marcos BEZERRA DE MENEZES <marcos.bezerra AT libre-informatique.fr>
*    Copyright (c) 2006-2016 Libre Informatique [http://www.libre-informatique.fr/]
*
***********************************************************************************/

/**
 * Depends on socket.io (io must be in the global namespace)
 * @param: uri            The uri to call
 * @param: directExecute  Can be undefined or a function(details) to execute as soon as the object is created
 */

var EveConnector = function(uri, directExecute) {

    // Debug functions
    this.log = function(type, msg, obj){
      if ( window.location.hash != '#debug' )
        return;
      switch ( type ) {
        case 'error':
          console.error(msg, obj);
          break;
        case 'info':
          console.info(msg, obj);
          break;
        default:
          console.log(msg, obj);
          break;
      }
    };
    var log      = this.log;

    var onError = function(){ }

    // Starts the connection to the server
    // (io must be in the global namespace: load socket.io before this file)
    this.socket = io(uri);

    this.socket.on('connect', function(){
        //log('info', 'Connected', this);
        ( typeof(directExecute) == 'function' ) && directExecute();
    });
    this.socket.on('connect_error', function(err){
        log('error', 'connect_error', err);
        onError();
    });
    this.socket.on('connect_failed', function(err){
        log('error', 'connect_failed', err);
        onError();
    });
    this.socket.on('error', function(err){
        log('error', 'socket error', err);
        onError();
    });

    this.isDeviceAvailable = function(device) {
        var socket = this.socket;
        return new Promise(function(resolve, reject){
            socket.emit('isDeviceAvailable', device);
            socket.on('isDeviceAvailable', function(msg) {
                if (msg.err)
                    reject(msg.err);
                resolve(msg.res);
            });
        });
    };

    this.startPoll = function(device, callback) {
        var socket = this.socket;
        return new Promise(function(resolve, reject){
            var supported = ['usb', 'websocket'];
            if ( supported.indexOf(device.type) == -1 ) {
                reject('error', 'Device type not supported:', device.type);
            }
            socket.emit('startPoll', device);
            socket.on('startPoll', function(msg) {
                if (msg.err)
                    reject(msg.err);
                else {
                    var event = device.type + 'Poll';
                    socket.on(event, callback);
                    resolve(msg);
                }
            });
        });
    };

    this.stopPoll = function(device) {
        this.socket.emit('stopPoll', device);
    };

    this.areDevicesAvailable = function(query) {
        var socket = this.socket;
        return new Promise(function(resolve, reject){
            socket.emit('areDevicesAvailable', query);
            socket.on('areDevicesAvailable', function(msg) {
                if (msg.err)
                    reject(msg.err);
                resolve(msg.res);
            });
        });
    };

    this.sendData = function(device, data) {
        //console.info('sendData()...');
        var socket = this.socket;
        return new Promise(function(resolve, reject){
            socket.emit('sendData', device, data);
            socket.once('sendData', function(msg) {
              //console.info('...sendData()', msg);
                if (msg.err)
                    reject(msg.err);
                resolve(msg.res);
            });
        });
    };

    this.readData = function(device, data) {
      //console.info('readData()...');
        var socket = this.socket;
        return new Promise(function(resolve, reject){
            socket.emit('readData', device, data);
            socket.once('readData', function(msg) {
                //console.info('...readData()', msg);
                if (msg.err)
                    reject(msg.err);
                resolve(msg.res);
            });
        });
    };
}
