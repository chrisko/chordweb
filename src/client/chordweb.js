// Chris Koenig <ckoenig@seas.upenn.edu>

var CHECK_PREDECESSOR_EVERY = 5;  // 5s
var STABILIZE_EVERY = 5;  // 5s
var TIMEOUT = 2;  // 2s

function ChordWeb(event_bus) {
    this.event_bus = event_bus;
    this.socket = io.connect("", {
        "max_reconnection_attempts": 3
    });

    this.key = Crypto.SHA1(Math.random().toString());
    this.predecessor = null;
    this.successor = null;

    var cw = this;
    this.socket.on("message", function (message) {
        if (!message.type) {
            this.event_bus.publish("log:error", [ "Received message with no type." ]);
            return;
        }

        var handler_name = cw.handlers[message.type];
        if (!handler_name) {
            this.event_bus.publish("log:error", [ "Received message with unknown type." ]);
            return;
        }

        // And finally call the appropriate handler, sending the message in:
        _.bind(cw[handler_name], cw)(message);
    });

    this.socket.on("disconnect", function () {
        cw.event_bus.publish("log:error", "The server unexpectedly disconnected!");
    });

    // Set our timers for all our periodic mechanisms:
    _.bindAll(this, "send_check_request", "send_stabilize_request");
    setInterval(this.send_check_request, CHECK_PREDECESSOR_EVERY * 1000);
    setInterval(this.send_stabilize_request, STABILIZE_EVERY * 1000);

    _.bindAll(this, "set_local_key", "send_join_request", "send_leave_request");
    event_bus.subscribe("localhost:key_proposed", this.set_local_key);
    this.event_bus.subscribe("localhost:wants_to_join", this.send_join_request);
    this.event_bus.subscribe("localhost:wants_to_leave", this.send_leave_request);
}

ChordWeb.prototype.handlers = {
    "join request": "process_join_request",
    "join response": "process_join_response",
    "leave request": "process_leave_request",
    "leave response": "process_leave_response",
    "check request": "process_check_request",
    "check response": "process_check_response",
    "stabilize request": "process_stabilize_request",
    "stabilize response": "process_stabilize_response",
    "notify": "process_notify"
};

ChordWeb.prototype.set_local_key = function (e, proposed_key) {
    if (this.is_joined()) {
        this.event_bus.publish("log:error", [ "Can't set the local key while joined." ]);
        return;
    }

    this.key = proposed_key;
};

ChordWeb.prototype.set_predecessor = function (predecessor) {
    this.predecessor = predecessor;
    this.event_bus.publish("predecessor:changed", {
        predecessor: predecessor,
        key: this.key
    });
};

ChordWeb.prototype.set_successor = function (successor) {
    this.successor = successor;
    this.event_bus.publish("successor:changed", {
        successor: this.successor,
        key: this.key
    });
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
    // If there's a join request underway, don't send out another:
    if (this.join_state) return;

    // There's no destination here, NB. We'll rely on the server to randomly
    // route this message to a node that's already in the Chord network.
    this.socket.emit("message", {
        type: "join request",
        requester_key: this.key
    });

    this.event_bus.publish("log:info", [ "Sent out a join request." ]);

    // Store the fact that we're waiting for a join response, and set a timer:
    this.join_state = {
        sent_at: new Date(),
        timer: setTimeout(_.bind(this.handle_join_timeout, this), TIMEOUT * 1000)
    };
};

ChordWeb.prototype.handle_join_timeout = function () {
    this.event_bus.publish("log:warn", [ "Our join request timed out! Retrying." ]);
    this.send_join_request();
};

ChordWeb.prototype.process_join_request = function (message) {
    // If we sent a join request and there were no nodes already in the Chord
    // network, then we may have gotten our own request back.
    if (message.requester_key == this.key) {
        // Execute a self-join, making us the only node in the Chord network.
        this.set_successor(this.key);
        this.set_predecessor(this.key);
        this.event_bus.publish("localhost:joined", {
            key: this.key,
            predecessor: this.predecessor,
            successor: this.successor
        });

        // Don't forget to cancel our outstanding timer:
        if (this.join_state) clearTimeout(this.join_state.timer);
        delete this.join_state;

        return;
    }

    if (this.is_key_in_our_range(message.requester_key)) {
        this.event_bus.publish("log:info", [ "A new node in our range just joined!" ]);
        this.event_bus.publish("log:info", [ "Making this new neighbor our predecessor." ]);

        // Change our predecessor to this joining node:
        this.set_predecessor(message.requester_key);

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
        this.event_bus.publish("log:debug", [ "Forwarding on a join request." ]);
    }
};

ChordWeb.prototype.process_join_response = function (message) {
    if (this.is_joined()) {
        this.event_bus.publish("log:error", [ "Got join response while joined!" ]);
        return;
    }

    // Record that we got a response, so our timeout logic doesn't trigger:
    if (this.join_state) clearTimeout(this.join_state.timer);
    delete this.join_state;

    this.event_bus.publish("log:debug", [ "Received join response!" ]);
    this.event_bus.publish("log:info", [ "Joined Chord network." ]);

    // Set our successor, which officially joins us to the Chord network:
    this.set_successor(message.responder_key);
    // Immediately tell our successor about us, and ask for its predecessor:
    this.send_stabilize_request();

    // And tell everyone that we've officially joined the network:
    this.event_bus.publish("localhost:joined", {
        key: this.key,
        successor: this.successor
    });
};

// Leaving Logic ///////////////////////////////////////////////////////////////
ChordWeb.prototype.send_leave_request = function () {
    if (!this.is_joined()) return;

    // If we're the only node in the Chord network, leaving's pretty easy:
    if (this.successor == this.key) {
        this.leave_chord_network();
        return;
    }

    var leave_request = {
        type: "leave request",
        quitter_key: this.key,
        quitter_successor: this.successor,
        quitter_predecessor: this.predecessor
    };

    // First tell our predecessor, assuming we have one:
    if (this.predecessor) {
        leave_request.destination = this.predecessor;
        this.socket.emit("message", leave_request);
        this.event_bus.publish("log:info", [ "Sent our predecessor a leave request." ]);
    }

    // If there's only two nodes in the Chord network, then our predecessor
    // *is* our successor! In that case, no need to send two leave requests.
    if (this.successor != this.predecessor) {
        leave_request.destination = this.successor;
        this.socket.emit("message", leave_request);
        this.event_bus.publish("log:info", [ "Sent our successor a leave request." ]);
    }
};

ChordWeb.prototype.leave_chord_network = function () {
    this.event_bus.publish("log:info", [ "Leaving the Chord network." ]);
    this.set_predecessor(null);
    this.set_successor(null);

    // Cancel all our outstanding timers and clear any state:
    if (this.check) { clearTimeout(this.check.timer); delete this.check; }
    if (this.stabilization) { clearTimeout(this.stabilization.timer); delete this.stabilization; }
    if (this.join_state) { clearTimeout(this.join_state.timer); delete this.join_state; }

    // And tell everybody else that we've officially left the network:
    this.event_bus.publish("localhost:left");
};

ChordWeb.prototype.process_leave_request = function (message) {
    if (!this.is_joined()) return;

    // First figure out who our quitter is:
    var quitter = (message.quitter_key == this.predecessor) ? "predecessor"
                : (message.quitter_key == this.successor) ? "successor"
                : "somebody else";

    if (this.predecessor = this.successor) {
        if (quitter != "somebody else") {
            // This is the case where we're one of two nodes in the Chord
            // network, and the other guy's leaving. It's both our successor
            // and predecessor, so we need to become a one-node show.
            this.event_bus.publish("log:warn", [ "The only other node is leaving!" ]);
            this.event_bus.publish("log:info", [ "Becoming a one-node Chord network." ]);

            this.set_predecessor(this.key);
            this.set_successor(this.key);
            return;
        }
    }

    if (quitter == "predecessor") {
        this.event_bus.publish("log:warn", [ "Our predecessor is leaving!" ]);
        if (!message.quitter_predecessor) {
            this.event_bus.publish("log:error", [ "Leaving predecessor didn't share its predecessor!" ]);
        } else {
            this.set_predecessor(message.quitter_predecessor);
        }
    }

    if (quitter == "successor") {
        this.event_bus.publish("log:warn", [ "Our successor is leaving!" ]);
        if (!message.quitter_successor) {
            this.event_bus.publish("log:error", [ "Leaving successor didn't share its successor!" ]);
        } else {
            this.set_successor(message.quitter_successor);
        }
    }

    if (quitter == "somebody else") {
        // Somebody other than our predecessor or successor is leaving.
        // The key question here is: who cares? Not us.
        this.event_bus.publish("log:debug", [ "Some node is leaving, but it's not important to us." ]);
    }
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
    this.event_bus.publish("log:debug", [ "Our predecessor check timed out." ]);
    this.event_bus.publish("log:error", [ "Our predecessor is unresponsive!" ]);
    this.event_bus.publish("log:debug", [ "Clearing predecessor." ]);
    this.set_predecessor(null);

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
        this.event_bus.publish("log:warn", [ "Got unexpected check response." ]);
        return;
    }

    if (message.transaction_id != this.check.transaction_id) {
        this.event_bus.publish("log:warn", [ "Check response had unknown transaction id." ]);
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
            if (!this.predecessor) {
                this.event_bus.publish("log:info", [ "Heard from a predecessor!" ]);
            } else {
                this.event_bus.publish("log:info", [ "Got wind of a better predecessor!" ]);
            }

            this.set_predecessor(message.requester_key);
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
    this.event_bus.publish("log:error", [ "Our successor isn't responding!" ]);
    this.event_bus.publish("log:info", [ "Clearing our successor." ]);
    this.successor = null;
};

ChordWeb.prototype.process_stabilize_response = function (message) {
    // Make sure we're already/still part of a Chord network:
    if (!this.is_joined()) {
        this.event_bus.publish("log:error", [ "Got a stabilize response while not in the network." ]);
        return;
    }

    // Make sure there's an outstanding stabilization request:
    if (!this.stabilization) {
        this.event_bus.publish("log:error", [ "Got an unwarranted stabilize response." ]);
        return;
    }

    // And now make sure it matches our expected transaction id:
    if (this.stabilization.transaction_id != message.transaction_id) {
        this.event_bus.publish("log:error", [ "Got a stabilize response with an unknown transaction id." ]);
        return;
    }

    clearTimeout(this.stabilization.timer);
    delete this.stabilization;

    var maybe_successor = message.responder_predecessor;
    if (maybe_successor != this.key) {
        if (this.is_key_between(this.key, this.successor, maybe_successor)) {
            // This also sends a notify request to our current successor:
            this.set_successor(maybe_successor);
        }
    }

    // And send a notification request to this new successor, telling it
    // that we might make a pretty good predecessor. We'll work hard, promise.
    this.socket.emit("message", {
        type: "notify",
        destination: this.successor,
        notifier_key: this.key
    });
};

ChordWeb.prototype.process_notify = function (message) {
    if (!this.predecessor) {
        this.set_predecessor(message.notifier);
    }

    if (this.is_key_in_our_range(message.notifier)) {
        this.set_predecessor(message.notifier);
    }
};
