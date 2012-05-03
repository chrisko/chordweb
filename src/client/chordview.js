// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

function ChordView(event_bus) {
    this.event_bus = event_bus;

    this.elements = {
        "key-input" : $("#node-key-input"),
        "join-button": $("#join-button")
    };

    _.bindAll(this, "join_clicked", "joined_network", "propose_key");
    this.elements["join-button"].on("click", this.join_clicked);
    event_bus.subscribe("localhost:joined", this.joined_network);
    event_bus.subscribe("localhost:key_proposed", this.propose_key);
}

ChordView.prototype.join_clicked = function () {
    // Tell ChordWeb to send the join request:
    this.event_bus.publish("localhost:wants_to_join");

    // Disable the node key input element:
    this.elements["key-input"].attr("disabled", true);
};

ChordView.prototype.joined_network = function (e, details) {
    this.elements["key-input"].attr("value", details.key);
    this.elements["join-button"].attr("disabled", true);
};

ChordView.prototype.propose_key = function (e, proposed_key) {
    this.elements["key-input"].attr("value", proposed_key);
};
