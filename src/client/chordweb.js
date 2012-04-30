// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

var CHECK_PREDECESSOR_EVERY = 5;  // 5s
var STABILIZE_EVERY = 5;  // 5s
var TIMEOUT = 3;  // 3s

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

    this.event_bus.subscribe("localhost:wants_to_join", _.bind(this.send_join_request, this));
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
    return (successor ? true : false);
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

// Joining Logic ///////////////////////////////////////////////////////////////
ChordWeb.prototype.send_join_request = function () {
    this.socket.emit("message", {
        type: "join request",
        requester_key: this.key
    });
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
        return;
    }

    if (this.is_key_in_our_range(message.requester_key)) {
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
    this.successor = message.responder_key;
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

    clearTimeout(this.check.timer);
    delete this.check;
};

ChordWeb.prototype.process_check_request = function (message) {
    if (this.is_joined()) {
        this.socket.emit("message", {
            type: "check response",
            destination: message.requester_key,
            transaction_id: transaction_id
        });
    }
};

ChordWeb.prototype.process_check_response = function (message) {
    if (!this.check) {
        console.log("Received a check response, but nothing's outstanding!");
        return;
    }

    if (message.transaction_id != check.transaction_id) {
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
    if (this.is_joined()) {
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
    }
};

ChordWeb.prototype.process_stabilize_request = function (message) {
    assert(message.requester_key);
};

ChordWeb.prototype.handle_stabilize_timeout = function () {
    console.log("Stabilize message timed out!");
    // TODO
};

ChordWeb.prototype.process_stabilize_response = function (message) {
    assert(message.transaction_id);
    assert(message.responder_key);
    assert(message.responders_predecessor);

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

    // this.stabilization.timer
};
