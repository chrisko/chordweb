// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

// server.js -- The server code used to serve and coordinate Chord instances.

var express = require("express"),
    socketio = require("socket.io");

var config = {
    port: 5157
};

var nodes = { };

////////////////////////////////////////////////////////////////////////////////
var server = express.createServer();
server.configure(function () {
    server.use(express.static("site/static/"));
    server.use(express.errorHandler());
});

var io = socketio.listen(server);
io.configure(function () {
    io.set("log level", 1);  // Reduce logging.

    // Production settings, from socket.io documentation:
    io.enable("browser client minification");
    io.enable("browser client etag");
    io.enable("browser client gzip");
});

io.sockets.on("connection", function (socket) {
    socket.on("message", function (message) {
        if (!message.type.match(/stabilize/) && !message.type.match(/check/))
            console.log(message);

        if (message.type == "join request") {
            // Add this new node by its chosen key:
            if (!message.requester_key) {
                console.log("Received join request without a key. Dropping.");
                return;
            }

            if (!message.requester_key.match(/^[0-9a-f]{40}$/i)) {
                console.log("Node tried to join with bad key: \""
                            + message.requester_key + "\". Ignoring.");
                return;
            }

            if (nodes[message.requester_key]) {
                if (nodes[message.requester_key] != socket) {
                    console.log("Node trying to join using an existing key, "
                              + message.requester_key + "! Ignoring.");
                    return;
                }
            }

            // If there's no destination, assign one:
            if (!nodes[message.destination]) {
                var available_nodes = Object.keys(nodes);
                if (available_nodes.length) {
                    // Choose a node at random, if none was specified:
                    var chosen_index = Math.floor(Math.random() * available_nodes.length);
                    message.destination = available_nodes[chosen_index];
                } else {
                    // If we don't have any nodes on file, do a self-join:
                    message.destination = message.requester_key;
                }
            }

            // And add the new node in a couple different places:
            nodes[message.requester_key] = socket;
            socket.key = message.requester_key;
            // And tell everyone there's a new node in town:
            io.sockets.emit("news", { type: "+", node: message.requester_key });
        }

        if (!message.destination) {
            console.log("Received message without destination:");
            return;
        }

        if (!nodes[message.destination]) {
            console.log("Received message for " + message.destination
                        + ", but there's no such node. Dropping.");
            return;
        }

        var destination_socket = nodes[message.destination];
        destination_socket.emit("message", message);
    });

    socket.on("disconnect", function () {
        if (socket.key) {
            // Remove this node from our list, assuming it's there:
            delete nodes[socket.key];
            // And emit the news to all listening clients out there:
            io.sockets.emit("news", { type: "-", node: socket.key });
        }
    });
});


////////////////////////////////////////////////////////////////////////////////
server.listen(config.port);
console.log("ChordWeb server listening on port %d in %s mode...",
            server.address().port, server.settings.env);
