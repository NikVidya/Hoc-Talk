'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var maxRoomSize = 10;

var fileServer = new (nodeStatic.Server)();
var app = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Expires', '-1');
    res.setHeader('Pragma', 'no-cache');
    fileServer.serve(req, res);
}).listen(8080);

function allTrue(obj) {
    for (var o in obj) {
        if (!obj[o]) {
            return false;
        }
    }
    return true;
}
var readyStates = new Array();
var mq = new Array();
function MessageQueue() {
    this.elements = [];
}
MessageQueue.prototype.enqueue = function (m, s, t) {
    this.elements.push({
        message: m,
        sender: s,
        target: t
    });
};
MessageQueue.prototype.dequeue = function () {
    return this.elements.shift();
};
MessageQueue.prototype.isEmpty = function () {
    return this.elements.length == 0;
};
MessageQueue.prototype.peek = function () {
    return !this.isEmpty() ? this.elements[0] : undefined;
};

var io = socketIO.listen(app);
io.sockets.on('connection', socket => {

    // convenience function to log server messages on the client
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }

    // relay for client messages
    socket.on('message', (message, senderId, targetId, room) => {
        if (message.type === 'readystate') {
            readyStates[room][senderId] = message.readystate;
        } else {
            mq[room].enqueue(message, senderId, targetId);
            if (allTrue(readyStates[room]) || message.type === 'candidate') {
                log('Client ' + senderId + ' from room ' + room + ' said to client ' + targetId, message);
                socket.to(room).emit('message', mq[room].peek().message, mq[room].peek().sender, mq[room].peek().target);
                mq[room].dequeue();
            }
        }
    });

    socket.on('create or join', room => {
        log('Received request to create or join room ' + room);
        var clientsInRoom = io.sockets.adapter.rooms[room];
        var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0; // if there are clients in room, return the number, else 0
        log('Room ' + room + ' now has ' + numClients + ' client(s)');
        if (numClients === 0) {
            socket.join(room);
            log('Client ID ' + socket.id + ' created room ' + room);
            socket.emit('created', room, socket.id);
            readyStates[room] = new Array();
            mq[room] = new MessageQueue();
        } else if (numClients > 0 && numClients < maxRoomSize) {
            log('Client ID ' + socket.id + ' joined room ' + room);
            io.sockets.in(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(room).emit('ready');
        }
    });

    socket.on('ipaddr', () => {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(details => {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });
})