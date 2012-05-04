// Chris Koenig <ckoenig@seas.upenn.edu>

function ChordView(event_bus) {
    this.event_bus = event_bus;

    this.elements = { };
    var element_ids = [ "key-input", "join-button", "set-no-log", "set-debug-log", "set-info-log", "set-warn-log", "set-error-log" ];
    var cv = this;
    element_ids.forEach(function (i) {
        cv.elements[i] = $("#" + i);
    });

    this.elements["join-button"].on("click", _.bind(this.join_clicked, this));

    this.elements["set-no-log"]   .on("click", _.bind(this.change_logging, this, "none"));
    this.elements["set-debug-log"].on("click", _.bind(this.change_logging, this, "debug"));
    this.elements["set-info-log"] .on("click", _.bind(this.change_logging, this, "info"));
    this.elements["set-warn-log"] .on("click", _.bind(this.change_logging, this, "warn"));
    this.elements["set-error-log"].on("click", _.bind(this.change_logging, this, "error"));

    _.bindAll(this, "joined_network", "propose_key");
    event_bus.subscribe("localhost:joined", this.joined_network);
    event_bus.subscribe("localhost:key_proposed", this.propose_key);
}

ChordView.prototype.change_logging = function (level) {
    if (level == "none") {
        $("#chord-and-log-container").removeClass("row-fluid");
        $("#chord-container").removeClass("span6");
        $("#log-container").removeClass("span6");
        $("#log-container").hide();
    } else {
        $("#chord-and-log-container").addClass("row-fluid");
        $("#chord-container").addClass("span6");
        $("#log-container").addClass("span6");
        $("#log-container").show();
    }

    if (level == "none") return;
    var mapping = { error: 1, warn: 2, info: 3, debug: 4 };
    var numerical = mapping[level];

    Object.keys(mapping).forEach(function (i) {
        var these_messages = $("span.log-message.level-" + i);
        if (mapping[level] < mapping[i]) {
            // E.g., if it's info-level and we just want errors:
            these_messages.hide();
        } else {
            these_messages.show();
        }
    });
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
