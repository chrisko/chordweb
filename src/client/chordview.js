// Chris Koenig <ckoenig@seas.upenn.edu>

function ChordView(event_bus) {
    this.event_bus = event_bus;

    this.elements = {
        "key-input" : $("#node-key-input"),
        "join-button": $("#join-button"),
        "view-logs": $("#view-logs")
    };

    _.bindAll(this, "join_clicked", "toggle_log_messages",
                    "joined_network", "propose_key");

    this.elements["join-button"].on("click", this.join_clicked);
    this.elements["view-logs"].on("change", this.toggle_log_messages);

    event_bus.subscribe("localhost:joined", this.joined_network);
    event_bus.subscribe("localhost:key_proposed", this.propose_key);
}

ChordView.prototype.toggle_log_messages = function (e) {
    var is_checked = e.target.checked;
    if (is_checked) {
        $("#chord-and-log-container").addClass("row-fluid");
        $("#chord-container").addClass("span6");
        $("#log-container").addClass("span6");
        $("#log-container").show();
    } else {
        $("#chord-and-log-container").removeClass("row-fluid");
        $("#chord-container").removeClass("span6");
        $("#log-container").removeClass("span6");
        $("#log-container").hide();
    }
};

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
