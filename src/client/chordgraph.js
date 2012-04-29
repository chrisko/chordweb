// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

function ChordGraph(event_bus, svg_id) {
    this.event_bus = event_bus;
    this.svg_id = svg_id;  // The SVG selector text, like "#chord-graph".

    // Grab the SVG element, based on the given element id:
    this.svg = d3.select("#" + this.svg_id);
    if (this.svg.empty()) throw new Error("No element " + this.svg_id);

    this.initialize();
}

ChordGraph.prototype.initialize = function () {
    // Draw the circle in the backdrop:
    console.log("Drawing circle...");

    var svg_width = $("#" + this.svg_id).width(),
        svg_height = $("#" + this.svg_id).height();

    this.svg.append("g")
      .append("circle")
        .attr("cx", svg_width / 2)
        .attr("cy", svg_height / 2)
        .attr("r", 100)
        .attr("stroke", "black")
        .attr("stroke-width", 4)
        .attr("fill", "none");
};
