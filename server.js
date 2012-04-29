// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

// server.js -- The server code used to serve and coordinate Chord instances.

var express = require("express"),
    socketio = require("socket.io");

var config = {
    port: 5157
};

////////////////////////////////////////////////////////////////////////////////
var server = express.createServer();
var io = socketio.listen(server);

io.sockets.on("connection", function (socket) {
    console.log("socket.io client connected!");
    socket.on("JOIN", function (data) {
        console.log("Received JOIN request!");
        console.log(data);
    });
});

server.configure(function () {
    server.use(express.static("site/static/"));
    server.use(express.errorHandler());
});

////////////////////////////////////////////////////////////////////////////////
//server.get("/", function (req, res) {
//    res.sendfile("src/static/index.html");
//});

////////////////////////////////////////////////////////////////////////////////
server.listen(config.port);
console.log("Server listening on port %d in %s mode",
            server.address().port, server.settings.env);
