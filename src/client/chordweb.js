// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

var CHECK_PREDECESSOR_EVERY = 5;  // 5s
var STABILIZE_EVERY = 5;  // 5s
var TIMEOUT = 3;  // 3s

function ChordWeb(event_bus) {
    this.event_bus = event_bus;
    this.connection = io.connect("");  // "" == Autodiscover.

    this.key = Crypto.SHA1(Math.random().toString());
    this.predecessor = null;
    this.successor = null;

    _.bindAll(this, "send_join_request");
    this.event_bus.subscribe("localhost:wants_to_join", this.send_join_request);
}

ChordWeb.prototype.is_joined = function () {
    // If our successor is set, we're part of a Chord network.
    return (successor ? true : false);
}

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
    console.log("Sending join request!");
    //this.connection.send? publish?
};

ChordWeb.prototype.process_join_request = function (message) {
    if (this.is_key_in_our_range(message.requester_key)) {
        // Return a join response to this node.
    } else {
        // Forward the join response on to our successor.
    }
};

ChordWeb.prototype.process_join_response = function (message) {
    this.successor = message.responder_key;
};

// Leaving Logic ///////////////////////////////////////////////////////////////
ChordWeb.prototype.send_leave_request = function () {
    if (!this.is_joined()) return;

    if (this.predecessor) {
    }

    this.successor
};

ChordWeb.prototype.process_leave_request = function (message) {
    console.log("Received leave request!");
};

// Predecessor Check Logic /////////////////////////////////////////////////////
ChordWeb.prototype.send_check_request = function () {
    if (this.predecessor) {
    }
};

ChordWeb.prototype.process_check_request = function (message) {
    if (this.is_joined()) {
    }
};

// Stabilization Logic /////////////////////////////////////////////////////////
ChordWeb.prototype.send_stabilize_request = function () {
    if (this.is_joined()) {
        //this.connection.send
        this.stabilization = {
            sent_at: new Date(),
            transaction_id: parseInt(Math.random() * 1000 * 1000),
            timer: setTimer(TIMEOUT * 1000
        };
    }
};

ChordWeb.prototype.process_stabilize_request = function (message) {
    assert(message.requester_key);
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

    this.stabilization.timer
};
