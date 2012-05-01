// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

var CHECK_PREDECESSOR_EVERY = 5;  // 5s
var STABILIZE_EVERY = 5;  // 5s
var TIMEOUT = 2;  // 2s

function ChordWeb(event_bus) {
    this.event_bus = event_bus;
    this.socket = io.connect("");  // "" == Autodiscover.

    this.key = Crypto.SHA1(Math.random().toString());
    this.predecessor = null;
    this.successor = null;

    var cw = this;
    this.socket.on("message", function (message) {
        if (!message.type) {
            console.log("Received message without type. Dropping.");
            return;
        }

        var handler_name = cw.handlers[message.type];
        if (!handler_name) {
            console.log("No handler for message type %s", message.type);
            return;
        }

        // And finally call the appropriate handler, sending the message in:
        _.bind(cw[handler_name], cw)(message);
    });

    // Set our timers for all our periodic mechanisms:
    _.bindAll(this, "send_check_request", "send_stabilize_request");
    setInterval(this.send_check_request, CHECK_PREDECESSOR_EVERY * 1000);
    setInterval(this.send_stabilize_request, STABILIZE_EVERY * 1000);

    _.bindAll(this, "send_join_request");
    this.event_bus.subscribe("localhost:wants_to_join", this.send_join_request);
}

ChordWeb.prototype.handlers = {
    "join request": "process_join_request",
    "join response": "process_join_response",
    "leave request": "process_leave_request",
    "leave response": "process_leave_response",
    "check request": "process_check_request",
    "check response": "process_check_response",
    "stabilize request": "process_stabilize_request",
    "stabilize response": "process_stabilize_response"
};

ChordWeb.prototype.is_joined = function () {
    // If our successor is set, we're part of a Chord network.
    return (this.successor ? true : false);
};

ChordWeb.prototype.is_key_in_our_range = function (k) {
    // First, if we're the only node in the network, the answer's yes:
    if (this.key == this.successor) return true;

    // In the simpler case, the key's between our successor and us:
    if (k > this.predecessor && k <= this.key) return true;

    // In the more complex case, our range includes the zero point:
    if (this.predecessor > this.key) {
        // If the key's greater than our predecessor, it's before zero:
        if (k > this.predecessor) return true;
        // Similarly, if it's less than our key, it's in our range past zero:
        if (k < this.key) return true;
    }

    // Otherwise, the given key is in another node's range:
    return false;
};

ChordWeb.prototype.is_key_between = function (begin, end, k) {
    if (begin == end) return false;  // Range is a point.
    if (k > begin && k <= end) return true;  // Easy case.
    if (begin > end) {
        if (k > begin) return true;  // Tough case, part A.
        if (k < end) return true;  // Tough case, part B.
    }
    return false;
};

// Joining Logic ///////////////////////////////////////////////////////////////
ChordWeb.prototype.send_join_request = function () {
    this.socket.emit("message", {
        type: "join request",
        requester_key: this.key
    });

    this.join_state = {
        sent_at: new Date(),
        timer: setTimeout(_.bind(this.handle_join_timeout, this), TIMEOUT * 1000)
    };
};

ChordWeb.prototype.handle_join_timeout = function () {
    console.log("Join request timed out! Trying again...");
    this.key = Crypto.SHA1(Math.random().toString());
    this.send_join_request();
};

ChordWeb.prototype.process_join_request = function (message) {
    // If we sent a join request and there were no nodes already in the Chord
    // network, then we may have gotten our own request back.
    if (message.requester_key == this.key) {
        // Execute a self-join, making us the only node in the Chord network.
        this.successor = this.key;
        this.event_bus.publish("localhost:joined", {
            key: this.key,
            successor: this.successor
        });

        // Don't forget to cancel our outstanding timer:
        if (this.join_state) clearTimeout(this.join_state.timer);
        delete this.join_state;

        return;
    }

    if (this.is_key_in_our_range(message.requester_key)) {
        // Change our predecessor to this joining node:
        this.predecessor = message.requester_key;
        this.event_bus.publish("predecessor:changed", {
            predecessor: message.requester_key,
            key: this.key
        });

        // Return a join response to this node.
        this.socket.emit("message", {
            type: "join response",
            destination: message.requester_key,
            responder_key: this.key
        });
    } else {
        // Forward the join response on to our successor.
        message.destination = this.successor;
        this.socket.emit("message", message);
    }
};

ChordWeb.prototype.process_join_response = function (message) {
    if (this.is_joined()) {
        console.log("Received join response while already joined. Ignoring.");
        return;
    }

    // Record that we got a response, so our timeout logic doesn't trigger:
    if (this.join_state) clearTimeout(this.join_state.timer);
    delete this.join_state;

    // Set our successor, which officially joins us to the Chord network:
    this.successor = message.responder_key;
    this.event_bus.publish("successor:changed", {
        successor: this.successor
    });

    this.event_bus.publish("localhost:joined", {
        key: this.key,
        successor: this.successor
    });
};

// Leaving Logic ///////////////////////////////////////////////////////////////
ChordWeb.prototype.send_leave_request = function () {
    if (!this.is_joined()) return;

    if (this.predecessor) {
        console.log("");
    }

    //this.successor
};

ChordWeb.prototype.process_leave_request = function (message) {
    console.log("Received leave request!");
};

// Predecessor Check Logic /////////////////////////////////////////////////////
ChordWeb.prototype.send_check_request = function () {
    if (this.predecessor) {
        var transaction_id = parseInt(Math.random() * 1000 * 1000);

        this.socket.emit("message", {
            type: "check request",
            destination: this.predecessor,
            transaction_id: transaction_id,
            requester_key: this.key
        });

        this.check = {
            sent_at: new Date(),
            timer: setTimeout(_.bind(this.handle_check_timeout, this), TIMEOUT * 1000),
            transaction_id: transaction_id
        };
    }
};

ChordWeb.prototype.handle_check_timeout = function () {
    console.log("Check request timed out! Clearing predecessor.");
    this.predecessor = null;
    this.event_bus.publish("predecessor:changed", {
        predecessor: null,
        key: this.key
    });

    clearTimeout(this.check.timer);
    delete this.check;
};

ChordWeb.prototype.process_check_request = function (message) {
    if (this.is_joined()) {
        this.socket.emit("message", {
            type: "check response",
            destination: message.requester_key,
            transaction_id: message.transaction_id
        });
    }
};

ChordWeb.prototype.process_check_response = function (message) {
    if (!this.check) {
        console.log("Received a check response, but nothing's outstanding!");
        return;
    }

    if (message.transaction_id != this.check.transaction_id) {
        console.log("Received a check response with the wrong transaction id.");
        return;
    }

    // If we're here, it was a successful check response. Don't do anything,
    // really, except *not* clear our predecessor information.

    // Since we got a response, cancel the timer and remove the stored message:
    clearTimeout(this.check.timer);
    delete this.check;
};

// Stabilization Logic /////////////////////////////////////////////////////////
ChordWeb.prototype.send_stabilize_request = function () {
    if (!this.successor) return;
    if (this.successor == this.key) return;

    var transaction_id = parseInt(Math.random() * 1000 * 1000);
    this.socket.emit("message", {
        type: "stabilize request",
        destination: this.successor,
        transaction_id: transaction_id,
        requester_key: this.key
    });

    this.stabilization = {
        sent_at: new Date(),
        transaction_id: transaction_id,
        timer: setTimeout(_.bind(this.handle_stabilize_timeout, this), TIMEOUT * 1000)
    };
};

ChordWeb.prototype.process_stabilize_request = function (message) {
    if (message.requester_key != this.predecessor) {
        if (!this.predecessor || this.is_key_in_our_range(message.requester_key)) {
            this.predecessor = message.requester_key;
            this.event_bus.publish("predecessor:changed", {
                predecessor: message.requester_key,
                key: this.key
            });
        }
    }

    // If we were a one-node network, add this new node as our successor, too:
    if (this.key == this.successor) {
        this.successor = message.requester_key;
    }

    this.socket.emit("message", {
        type: "stabilize response",
        destination: message.requester_key,
        transaction_id: message.transaction_id,
        responder_predecessor: this.predecessor
    });
};

ChordWeb.prototype.handle_stabilize_timeout = function () {
    console.log("Stabilize message timed out! Clearing successor.");
    this.successor = null;
};

ChordWeb.prototype.process_stabilize_response = function (message) {
    // Make sure we're already/still part of a Chord network:
    if (!this.is_joined()) {
        console.log("Received a stabilization response, but not "
                    + "currently part of a Chord network. Ignoring.");
        return;
    }

    // Make sure there's an outstanding stabilization request:
    if (!this.stabilization) {
        console.log("Received a stabilization response, but none "
                    + "are outstanding. Ignoring.");
        return;
    }

    // And now make sure it matches our expected transaction id:
    if (this.stabilization.transaction_id != message.transaction_id) {
        console.log("Received a stabilization response, but its "
            + "transaction id (" + message.transaction_id
            + ") doesn't match what we expect ("
            + this.stabilization.transaction_id + "). Ignoring.");
        return;
    }

    clearTimeout(this.stabilization.timer);
    delete this.stabilization;

    var maybe_successor = message.responder_predecessor;
    if (maybe_successor != this.key) {
        if (this.is_key_between(this.key, this.successor, maybe_successor)) {
            this.successor = maybe_successor;
            this.event_bus.publish("successor:changed", {
                successor: this.successor,
                key: this.key
            });
        }
    }
};
