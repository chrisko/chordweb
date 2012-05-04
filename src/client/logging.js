// Chris Koenig <ckoenig@seas.upenn.edu>

function Logging(event_bus, div_id) {
    this.event_bus = event_bus;
    this.div = $("#" + div_id);
    this.socket = io.connect("");

    if (this.div.length == 0) throw new Error("No such element " + div_id);

    _.bindAll(this, "handle_server_message", "log");
    this.socket.on("error", this.handle_server_message);
    this.event_bus.subscribe("log:debug", _.bind(this.log, this, "debug"));
    this.event_bus.subscribe("log:info",  _.bind(this.log, this, "info"));
    this.event_bus.subscribe("log:warn",  _.bind(this.log, this, "warn"));
    this.event_bus.subscribe("log:error", _.bind(this.log, this, "error"));
}

Logging.prototype.log = function (level, e, message) {
    var outer_span = "<span class=\"log-message level-" + level + "\">";

    // Map the incoming level to its Bootstrap inline label class:
    var label_class = { "debug": "",
                        "info": " label-info",
                        "warn": " label-warning",
                        "error": " label-important" }[level];

    var label_span = "<span class=\"label" + label_class + "\">" + level + "</span>";
    var message_span = "<span class=\"message\">" + message + "</span>";
    this.div.append(outer_span + label_span + "&nbsp;" + message_span + "</span>");
};

Logging.prototype.handle_server_message = function (message) {
    if (!message.text) message.text = "(No message)";
    if (message.level == "error") {
        this.log(message.text, "important");
    } else {
        this.log(message.text);
    }
};
