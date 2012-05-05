// Chris Koenig <ckoenig@seas.upenn.edu>

function ChordGraph(event_bus, svg_id) {
    this.event_bus = event_bus;
    this.svg_id = svg_id;  // The SVG selector text, like "#chord-graph".

    // Grab the SVG element, based on the given element id:
    this.svg = d3.select("#" + this.svg_id);
    if (this.svg.empty()) throw new Error("No element " + this.svg_id);

    this.draw_chord_network();

    // Handle events related to the UI:
    this.svg.on("mousemove", _.bind(this.handle_mouse_event, this));
    this.svg.on("mousedown", _.bind(this.handle_mouse_event, this));

    // And also handle our custom Chord events:
    _.bindAll(this, "initiate_join", "handle_join", "handle_leave",
                    "predecessor_changed", "successor_changed");
    this.event_bus.subscribe("localhost:wants_to_join", this.initiate_join);
    this.event_bus.subscribe("localhost:joined", this.handle_join);
    this.event_bus.subscribe("localhost:left", this.handle_leave);
    this.event_bus.subscribe("predecessor:changed", this.predecessor_changed);
    //this.event_bus.subscribe("successor:changed", this.successor_changed);
}

ChordGraph.prototype.get_circle_pos = function () {
    var svg_width = $("#" + this.svg_id).width(),
        svg_height = $("#" + this.svg_id).height();

    return {
        "cx": (svg_width / 2),
        "cy": (svg_height / 2),
        "r": 100
    };
};

ChordGraph.prototype.draw_chord_network = function () {
    // Calculate the position of the Chord circle:
    var circle_pos = this.get_circle_pos();

    // Draw the circle in the backdrop:
    this.svg.append("g")
        .attr("id", "chord-circle")
      .append("circle")
        .attr("cx", circle_pos.cx)
        .attr("cy", circle_pos.cy)
        .attr("r", circle_pos.r)
        .attr("stroke", "black")
        .attr("stroke-width", 4)
        .attr("fill", "none");

    // And draw the ticks:
    var ticks = this.svg.append("g").attr("id", "ticks");
    var i; for (i = 0; i < 16; i++) {
        var angle = 2 * Math.PI * (i / 16);
        ticks.append("line")
            .attr("x1", circle_pos.cx + Math.sin(angle) * circle_pos.r)
            .attr("y1", circle_pos.cy + Math.cos(angle) * circle_pos.r)
            .attr("x2", circle_pos.cx + Math.sin(angle) * (circle_pos.r - 5))
            .attr("y2", circle_pos.cy + Math.cos(angle) * (circle_pos.r - 5))
            .attr("stroke", "black")
            .attr("stroke-width", 1);
    }
};

ChordGraph.prototype.handle_mouse_event = function () {
    // Work out the mouse position relative to the circle center:
    var circle_pos = this.get_circle_pos();
    var x_relative = d3.event.offsetX - circle_pos.cx,
        y_relative = circle_pos.cy - d3.event.offsetY;  // (Down is +)

    // Get the angle in the first quadrant:
    var angle = Math.atan(Math.abs(x_relative) / Math.abs(y_relative));
    // If the mouse is in another quadrant, correct as necessary:
    if (x_relative > 0 && y_relative < 0) { angle = Math.PI - angle; }
    if (x_relative < 0 && y_relative < 0) { angle = Math.PI + angle; }
    if (x_relative < 0 && y_relative > 0) { angle = 2 * Math.PI - angle; }
    // And we want north (not east) to be our zero point:
    var how_far_along_circle = angle / (2 * Math.PI);

    var random_key = Crypto.SHA1(Math.random().toString());
    var top_part = how_far_along_circle * parseInt("FFFFFF", 16);
    var top_digits = top_part.toString(16).replace(/\..+/, "");
    while (top_digits.length < 6) top_digits = "0" + top_digits;
    var proposed_key = top_digits.toString(16) + random_key.slice(6);

    if (d3.event.type == "mousemove") this.mouse_moved_over(proposed_key);
    if (d3.event.type == "mousedown") this.mouse_clicked_on(proposed_key);
};

ChordGraph.prototype.mouse_moved_over = function (key) {
    // You can't update the local node's key if you're already joining/joined:
    if (!this.started_join) {
        // If the user already placed the localhost, don't swing it around:
        if (!this.placed_localhost) {
            this.draw_node(key, true);
            this.event_bus.publish("localhost:key_proposed", key);
        }
    }
};

ChordGraph.prototype.mouse_clicked_on = function (key) {
    if (!this.started_join) {
        // A click says "The local key should go *here* on the Chord network."
        // Mark the "placed_localhost" flag, so the user doesn't drag it away:
        this.placed_localhost = true;
        // And place the localhost node there, as in mouse_moved_over():
        this.draw_node(key, true);
        this.event_bus.publish("localhost:key_proposed", key);
    }
};

ChordGraph.prototype.handle_join = function (e, data) {
    // Hide the "waiting to join" spinner:
    $(".spinner").hide();

    this.draw_node(data.key, true);  // true means "localhost".
    this.redraw_range(data.predecessor, data.key);
};

ChordGraph.prototype.handle_leave = function (e, data) {
    this.started_join = false;
    this.placed_localhost = false;
};

ChordGraph.prototype.predecessor_changed = function (e, data) {
    this.redraw_range(data.predecessor, data.key);
};

ChordGraph.prototype.successor_changed = function () {
};

ChordGraph.prototype.redraw_range = function (predecessor, key) {
    if (!this.svg.select("#range").empty()) {
        this.svg.select("#range").remove();
    }

    if (!predecessor) return;  // No range to draw.

    var add_to = (predecessor >= key) ? (2 * Math.PI) : 0;
    var range = d3.svg.arc()
        .startAngle(this.get_key_angle(predecessor))
        .endAngle(this.get_key_angle(key) + add_to)
        .innerRadius(70)
        .outerRadius(90);

    var circle_pos = this.get_circle_pos();
    this.svg.append("g")
        .attr("id", "range")
        .attr("transform", "translate(" + circle_pos.cx + "," + circle_pos.cy + ")")
      .append("path")
        .attr("d", range);
};

ChordGraph.prototype.initiate_join = function () {
    // Used as a marker for the mousemove event:
    this.started_join = true;

    // Create the spinner if it's not already there:
    if ($(".spinner").length == 0) {
        // The parent of the spinner class should be a div, and this code
        // will tell the Spinner constructor to center it in that div:
        var target = this.svg[0].parentNode.id;
        var spinner = new Spinner().spin(target);
    }

    // And display it, in the center of the Chord network:
    $(".spinner").show();
};

ChordGraph.prototype.draw_node = function (key, is_localhost) {
    if (!key) return;  // May be null.

    var angle = this.get_key_angle(key);
    var circle_pos = this.get_circle_pos();

    var new_circle_x = circle_pos.cx + Math.sin(angle) * circle_pos.r;
    var new_circle_y = circle_pos.cy - Math.cos(angle) * circle_pos.r;

    if (is_localhost && !this.svg.select("#localhost").empty()) {
        // The localhost node exists already. Just update its position:
        this.svg.select("#localhost")
            .attr("cx", new_circle_x)
            .attr("cy", new_circle_y);

        return;
    }

    var node = this.svg.append("g")
      .append("circle")
        .attr("id", is_localhost ? "localhost" : key)
        .attr("cx", new_circle_x)
        .attr("cy", new_circle_y)
        .attr("stroke", "black")
        .attr("stroke-width", 4);

    var radius = (is_localhost) ? 5 : 2;
    var fill = (is_localhost) ? "white" : "black";

    node.attr("r", radius)
        .attr("fill", fill);
};

ChordGraph.prototype.get_key_angle = function (key) {
    // Use the first six hex digits to approximate the angle:
    var value = parseInt(key.slice(0, 6), 16),
        max = parseInt("FFFFFF", 16);

    return (2 * Math.PI * (value / max));  // Radians.
};
