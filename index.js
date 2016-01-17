var width = 1224,
    height = 768,
    radius = Math.min(width, height) / 2.06;

var x = d3.scale.linear()
    .range([0, 2 * Math.PI]);

var y = d3.scale.sqrt()
    .range([0, radius]);

// // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 150, h: 30, s: 3, t: 10
};

// // // Mapping of step names to colors.
// var colors = {
//   "Data Governance": "#5687d1",
//   "Governance Structure": "#7b615c",
//   "Policies & Standards": "#de783b",
//   "Operating Model": "#6ab975",
//   "Monitoring & Measurement": "#a173d1"
// };

var color = d3.scale.category20c();
//console.log(typeof(color));

var svg = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
  .attr("id","container")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 10) + ")");


var partition = d3.layout.partition()
    .sort(null)
    .value(function(d) { return 1; });

var arc = d3.svg.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
    .innerRadius(function(d) { return Math.max(0, y(d.y)); })
    .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });


 function initializeBreadcrumbTrail() {
  // Add the svg area.
  var trail = d3.select("#sequence").append("svg:svg")
      .attr("width", width)
      .attr("height", 50)
      .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

// function drawLegend() {

//   // Dimensions of legend item: width, height, spacing, radius of rounded rect.
//   var li = {
//     w: 300, h: 30, s: 3, r: 3
//   };

//  var legend = d3.select("#legend").append("svg:svg")
//       .attr("width", li.w)
//     .attr("height", d3.keys(color).length * (li.h + li.s));

//   var g = legend.selectAll("g")
//       .data(d3.entries(color))
//       .enter().append("svg:g")
//       .attr("transform", function(d, i) {
//               return "translate(0," + i * (li.h + li.s) + ")";
//            });

//   g.append("svg:rect")
//       .attr("rx", li.r)
//       .attr("ry", li.r)
//       .attr("width", li.w)
//       .attr("height", li.h)
//       .style("fill", function(d) { return d.value; });

// //console.log(g);

//   g.append("svg:text")
//       .attr("x", li.w / 2)
//       .attr("y", li.h / 2)
//       .attr("dy", "0.35em")
//       .attr("text-anchor", "middle")
//       .text(function(d) { return d.key; });

//       //console.log(g);
// }

// function toggleLegend() {
//   var legend = d3.select("#legend");
//   if (legend.style("visibility") == "hidden") {
//     legend.style("visibility", "");
//   } else {
//     legend.style("visibility", "hidden");
//   }
// }

// // Keep track of the node that is currently being displayed as the root.
// var node;
// node = "Data Governance"

d3.text("data.csv", function(text) {
  var csv = d3.csv.parseRows(text);
  var json = buildHierarchy(csv);
  //console.log(json);
  initializeBreadcrumbTrail();
  //drawLegend();
  //d3.select("#togglelegend").on("click", toggleLegend);

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  svg.append("svg:circle")
      .attr("r", radius)
      .style("opacity", 0);


  var value = function(d) { return d.size; };

  var path = svg.datum(json).selectAll("path")
      .data(partition.nodes.value(value))
    .enter().append("path")
    .attr("display", function(d) { return d.depth })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", function(d) { return color(d.name); })
      .style("opacity", 1)
      .on("click", click)
      .on("mouseover", mouseover)
      .each(stash);



// Take a 2-column CSV and transform it into a hierarchical structure suitable
// for a partition layout. The first column is a sequence of step names, from
// root to leaf, separated by hyphens. The second column is a count of how 
// often that sequence occurred.
function buildHierarchy(csv) {
  var root = {"name": csv[0][0], "children": []};
  //console.log(root);
  for (var i = 0; i < csv.length; i++) {
    //var firstnode = csv[i];
    var sequence = csv[i][0];
    var size = +csv[i][1];
    if (isNaN(size)) { // e.g. if this is a header row
      continue;
    }
    var parts = sequence.split("-");
    var currentNode = root;
    for (var j = 0; j < parts.length; j++) {
      var children = currentNode["children"];
      var nodeName = parts[j];
      //console.log(nodeName);
      var childNode;
      if (j + 1 < parts.length) {
   // Not yet at the end of the sequence; move down the tree.
  var foundChild = false;
  for (var k = 0; k < children.length; k++) {
    if (children[k]["name"] == nodeName) {
      childNode = children[k];
      foundChild = true;
      break;
    }
  }
  // If we don't already have a child node for this branch, create it.
  if (!foundChild) {
    childNode = {"name": nodeName, "children": []};
    children.push(childNode);
  }
  currentNode = childNode;
      } else {
  // Reached the end of the sequence; create a leaf node.
  childNode = {"name": nodeName, "size": size};
  children.push(childNode);
      }
    }
  }
  return root;
}

  function click(d) {
    node = d;
    path.transition()
      .duration(1000)
      .attrTween("d", arcTweenZoom(d));
  }

  function mouseover(d) {
    node = d;
   // console.log("Hello");
    // Fade all the segments.
  d3.selectAll("path")
      .style("opacity", 0.3);

  var sequenceArray = getAncestors(d);
  updateBreadcrumbs(sequenceArray);

  // Then highlight only those that are an ancestor of the current segment.
  svg.selectAll("path")
      .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
              })
      .style("opacity", 1);
  } 

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  var points = [];
  points.push("0,0");
  points.push(b.w + ",0");
  points.push(b.w + b.t + "," + (b.h / 2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + "," + (b.h / 2));
  }
  return points.join(" ");
}

  // Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray) {

  // Data join; key function combines name and depth (= position in sequence).
  var g = d3.select("#trail")
      .selectAll("g")
      .data(nodeArray, function(d) { return d.name + d.depth; });

  // Add breadcrumb and label for entering nodes.
  var entering = g.enter().append("svg:g");

  entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .style("fill", function(d) { return color(d.name); });

  entering.append("svg:text")
      .attr("x", (b.w + b.t) / 2)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.name; });

  // Set position for entering and updating nodes.
  g.attr("transform", function(d, i) {
    return "translate(" + i * (b.w + b.s) + ", 0)";
  });

  // Remove exiting nodes.
  g.exit().remove();

  // Now move and update the percentage at the end.
  d3.select("#trail").select("#endlabel")
      .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text("");

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail")
      .style("visibility", "");

}

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {

  // Hide the breadcrumb trail
  d3.select("#trail")
      .style("visibility", "hidden");

  // Deactivate all segments during transition.
  d3.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  d3.selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .each("end", function() {
              d3.select(this).on("mouseover", mouseover);
            });

  d3.select("#explanation")
      .style("visibility", "hidden");
}


  // Given a node in a partition layout, return an array of all of its ancestor
// nodes, highest first, but excluding the root.
function getAncestors(node) {
  var path = [];
  var current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  path.unshift(current);
  return path;
}

}
);

d3.select(self.frameElement).style("height", height + "px");

// Setup for switching data: stash the old values for transition.
function stash(d) {
  d.x0 = d.x;
  d.dx0 = d.dx;
}

// When switching data: interpolate the arcs in data space.
function arcTweenData(a, i) {
  var oi = d3.interpolate({x: a.x0, dx: a.dx0}, a);
  function tween(t) {
    var b = oi(t);
    a.x0 = b.x;
    a.dx0 = b.dx;
    return arc(b);
  }
  if (i == 0) {
   // If we are on the first arc, adjust the x domain to match the root node
   // at the current zoom level. (We only need to do this once.)
    var xd = d3.interpolate(x.domain(), [node.x, node.x + node.dx]);
    return function(t) {
      x.domain(xd(t));
      return tween(t);
    };
  } else {
    return tween;
  }
}

// When zooming: interpolate the scales.
function arcTweenZoom(d) {
  var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
      yd = d3.interpolate(y.domain(), [d.y, 1]),
      yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
  return function(d, i) {
    return i
        ? function(t) { return arc(d); }
        : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
  };
}