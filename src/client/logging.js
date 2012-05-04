// Chris Koenig <ckoenig@seas.upenn.edu>

function Logging(event_bus, div_id) {
    this.event_bus = event_bus;
    this.div = $("#" + div_id);
    this.socket = io.connect("");

    if (this.div.length == 0) throw new Error("No such element " + div_id);

    _.bindAll(this, "handle_server_message", "log");
    this.socket.on("error", this.handle_server_message);
    this.event_bus.subscribe("log:debug", this.log);
    this.event_bus.subscribe("log:info", this.log);
    this.event_bus.subscribe("log:warn", this.log)
    this.event_bus.subscribe("log:error", this.log);
}

Logging.prototype.log = function (level, message) {
    var class_text = "label";
    class_text += (level == "important") ? " label-important"
                : (level == "warning")   ? " label-warning"
                : (level == "success")   ? " label-success"
                : "";

    this.div.append("<span class=\"" + class_text + "\">"
                  + message + "</div>");
};

Logging.prototype.handle_server_message = function (message) {
    if (!message.text) message.text = "(No message)";
    if (message.level == "error") {
        this.log(message.text, "important");
    } else {
        this.log(message.text);
    }
};
