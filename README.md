EveConnector
=============

USB over WebSocket: Make your browser communicate with USB through WebSockets

Prerequisites
--------------

Install NodeJS & npm the way you like.

On Ubuntu GNU/Linux, you can try :
```bash
curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
sudo apt-get install nodejs
```

Installing
-----------

```$ npm install eve-connector```

Usage
------

to create a server listening on port 8164 :

```js
var EC = require('eve-connector-server.js').createServer(8164);
```

Permissions
------------

### Linux

On most Linux systems, USB devices are mapped with read-only permissions by default. 
To open a device through EveConnector, your user who runs Node.js will need to have write access to it too.
A simple solution is to set a udev rule. Create a file /etc/udev/rules.d/50-yourdevicename.rules with the following content:

```SUBSYSTEM=="usb", ATTR{idVendor}=="[yourdevicevendor]", MODE="0664", GROUP="plugdev"```

Then, just restart the udev daemon: 
```
service udev restart.
```

You can check if device permissions are set correctly by following these steps:

Find the bus and device numbers :
```
lsusb
```

Then

```
ls -al /dev/bus/usb/[bus]/[device]
```

This file should be owned by group "plugdev" and have group write permissions.


But... why "EveConnector"?
---------------------------

"Eve" is the short name for [e-venement](http://www.e-venement.org/) (its source is hosted on github : https://github.com/betaglop/e-venement/). The EveConnector was first designed to communicate from e-venement to USB peripherals... so it was quite natural to call 

License
--------

EveConnector is licensed under the GNU-GPLv3. See [LICENSE](LICENSE)
