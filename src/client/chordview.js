// Chris Koenig <ckoenig@seas.upenn.edu>

function ChordView(event_bus) {
    this.event_bus = event_bus;

    this.elements = { };
    var element_ids = [ "key-input", "join-button", "lookup-button", "leave-button",
                        "set-no-log", "set-debug-log", "set-info-log", "set-warn-log",
                        "set-error-log", "num-errors-if-any" ];

    var cv = this;
    element_ids.forEach(function (i) {
        cv.elements[i] = $("#" + i);
        if (cv.elements[i].length == 0)
            console.log("No such element: " + i);
    });

    this.elements["join-button"].on("click", _.bind(this.join_clicked, this));
    this.elements["leave-button"].on("click", _.bind(this.leave_clicked, this));

    this.elements["set-no-log"]   .on("click", _.bind(this.change_logging, this, "none"));
    this.elements["set-debug-log"].on("click", _.bind(this.change_logging, this, "debug"));
    this.elements["set-info-log"] .on("click", _.bind(this.change_logging, this, "info"));
    this.elements["set-warn-log"] .on("click", _.bind(this.change_logging, this, "warn"));
    this.elements["set-error-log"].on("click", _.bind(this.change_logging, this, "error"));

    _.bindAll(this, "joined_network", "propose_key", "increment_errors", "left_network");
    event_bus.subscribe("localhost:joined", this.joined_network);
    event_bus.subscribe("localhost:key_proposed", this.propose_key);
    event_bus.subscribe("log:error", this.increment_errors);
    event_bus.subscribe("localhost:left", this.left_network);
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

    // Disable a few elements we want to no longer be editable:
    this.elements["join-button"].attr("disabled", true);
    this.elements["key-input"].attr("disabled", true);
};

ChordView.prototype.leave_clicked = function () {
    // Tell ChordWeb to send the join request:
    this.event_bus.publish("localhost:wants_to_leave");
    // And disable the leave and lookup buttons:
    this.elements["leave-button"].attr("disabled", true);
    this.elements["lookup-button"].attr("disabled", true);
};

ChordView.prototype.joined_network = function (e, details) {
    this.elements["key-input"].attr("value", "");
    this.elements["key-input"].attr("disabled", false);
    this.elements["key-input"].attr("placeholder", "Key or string");
    this.elements["leave-button"].attr("disabled", false);
    this.elements["lookup-button"].attr("disabled", false);
    // Swap out the join button for a lookup button:
    this.elements["join-button"].hide();
    this.elements["lookup-button"].show();
};

ChordView.prototype.left_network = function (e, details) {
    this.elements["join-button"].attr("disabled", false);
    this.elements["key-input"].attr("placeholder", "Node Key");
    // Swap out the lookup button for the join button:
    this.elements["lookup-button"].hide();
    this.elements["join-button"].show();
};

ChordView.prototype.propose_key = function (e, proposed_key) {
    this.elements["key-input"].attr("value", proposed_key);
};

ChordView.prototype.increment_errors = function () {
    var span = this.elements["num-errors-if-any"];
    var current_value = parseInt(span.html());
    span.html(current_value + 1);
    this.elements["num-errors-if-any"].show();
};
