
function Styles(graph) {
	this.guide = new Styleguide(graph);
	this._styles = {};
}
Styles.prototype.apply = function() { this.guide.apply(); };

/**
 * Creates a new style which inherits from the default style,
 * or any other style which name is supplied to the optional template parameter.
 */
Styles.prototype.create = function(stylename, o) {
	o = o || {};
	
	if ( stylename === "default" ) {
		this._styles[stylename] = new Style(stylename, o);
		return this._styles[stylename];
	}
	
	var k = o.template || "default";
	var s = this._styles[stylename] = this._styles[k].copy(stylename); // @todo Python used copy, but perhaps we should take advantage of prototype based inheritance
	s._dict = o;
	return s;
};
Styles.prototype.getStyle = function(stylename) {
	if ( stylename && stylename in this._styles )
		return this._styles[stylename];
	return this._styles["default"];
};
Styles.prototype.append = function(style) {
	this._styles[style.name] = style;
};
Styles.prototype.set = function(key, value) {
	for ( var name in this._styles ) {
		this._styles[name]._dict = value;
	}
};

/**
 * Returns a copy of all styles and a copy of the styleguide.
 */
Styles.prototype.copy = function(graph) {
	var s = new Styles(graph);
	s.guide = this.guide.copy(graph);
	for ( var name in this._styles ) {
		s._styles[name] = this._styles[name].copy();
	}
	return s;
};

/*
 * Each node gets the default colors, type and drawing functions.
 * The guide defines how and when to apply other styles based on node properties.
 * It contains a set of style name keys linked to x(graph, node) functions.
 * If such a function returns True for a node, the style is applied to that node.
 */
function Styleguide(graph) {
	this.graph = graph;
	this.order = [];
	this._styles = {};
}
/**
 * The name of a style and a function that takes a graph and a node.
 * It returns True when the style should be applied to the given node.
 */
Styleguide.prototype.append = function(stylename, fn) {
	this._styles[stylename] = fn;
};
Styleguide.prototype.clear = function() {
	this.order = [];
	this._styles = {};
};
/**
 * Check the rules for each node in the graph and apply the style.
 */
Styleguide.prototype.apply = function() {
	// @todo Perhaps we could optimize the algorithm on the next two lines using
	// an object with no dummy values.
	var sorted = this.order.concat(CanvasNode.util.keys(this._styles));
	var unique = CanvasNode.util.unique.call(sorted);
	for ( var id in this.graph.nodes ) {
		var node = this.graph.nodes[id];
		CanvasNode.util.forEach.call(unique, function(s) {
			if ( s in this._styles && this._styles[s](this.graph, node) )
				node.style = s;
		});
	}
};
/**
 * Returns a copy of the styleguide for the given graph.
 */
Styleguide.prototype.copy = function(graph) {
	var g = new Styleguide(graph);
	g.order = this.order;
	g._styles = CanvasNode.util.shallowCopy(this._styles);
	return g;
};

/**
 * Graph styling.
 * The default style is used for edges.
 * When text is set to None, no id label is displayed.
 */
function Style(name, o) {
	this.name = name;
	
	// Copy all the default colors and typography, as well as methods
	// Defaults for colors and typography.
	// All code is independent of any one canvas context so when drawing you must
	// pass a ctx object to each method. We take advantage of JavaScript's
	// loose objects here, unlike the python version you don't need to call
	// style.method(style, ); because `this` is available to us
	for ( var k in Style.defaults )
		this[k] = Style.defaults[k];
	
	// @todo Port NodeBox Graph's use of the colors library to canvas' gradients and shadows
	
}
Style._color = function(c, o) {
	if ( typeof c === "string" )
		return c;
	for ( var k in o )
		c[k] = o[k];
	return c.alpha === undefined ?
		"rgb("+[c.red, c.green, c.blue].join(', ')+")" :
		"rgba("+[c.red, c.green, c.blue, c.alpha].join(', ')+")";
}
Style.rgb = Style.rgba = function(r, g, b, a) {
	return { red:r, green:g, blue:b, alpha:a };
};
(function() {
	var color = Style.rgba;
	Style.defaults = {
		// default colors and typography
		background:  color(0.18, 0.23, 0.28, 1.00),
		traffic:     color(0.00, 0.00, 0.00, 0.07),
		fill:        color(0.00, 0.00, 0.00, 0.10),
		stroke:      color(0.80, 0.80, 0.80, 0.75),
		strokeWidth: 0.5,
		text:        color(1.00, 1.00, 1.00, 0.85),
		font:        "Verdana",
		fontSize:    12,//10
		textWidth:   100,
		align:       1,
		depth:       true,
		
		// drawing methods
		graphBackground: function(ctx) {
			// Graph background color
			ctx.fillStyle = Style._color(this.background);
			if ( this.depth ) {
				// @todo Port this gradient code
				// clr = colors.color(s.background).darker(0.2)
				// p = s._ctx.rect(0, 0, s._ctx.WIDTH, s._ctx.HEIGHT, draw=False)
				// colors.gradientfill(p, clr, clr.lighter(0.35))
				// colors.shadow(dx=0, dy=0, blur=2, alpha=0.935, clr=s.background)
			}
		},
		graphTraffic: function(ctx, node, alpha) {
			// Visualization of traffic-intensive nodes (based on their centrality).
			if ( alpha === undefined )
				alpha = 1;
			
			var r = Node.radius;
			r += (node.weight+.5) * r * 5;
			if ( this.traffic ) {
				ctx.fillStyle = Style._color(this.traffic, {alpha:this.traffic.alpha*alpha});
				ctx.beginPath();
				ctx.arc(node.getX()-r, node.getY()-r, r, 0, 360, false);
				//ctx.fillOval(node.getX()-r, node.getY()-r, r*2, r*2); // @todo Port oval
				ctx.closePath();
				ctx.fill();
			}
		},
		node: function(ctx, node, alpha) {
			// Visualization of a default node.
			if ( alpha === undefined )
				alpha = 1;
			
			if ( this.depth ) {
				// @todo Port shadows
				// colors.shadow(dx=5, dy=5, blur=10, alpha=0.5*alpha)
			}
			
			var r = node.radius;
			
			if ( this.fill ) {
				ctx.fillStyle = Style._color(this.fill, {alpha:this.fill.alpha*alpha});
				ctx.beginPath();
				//this.fillOval(node.getX()-r, node.getY()-r, r*2, r*2);
				ctx.arc(node.getX(), node.getY(), r, 0, 360, false);
				ctx.closePath();
				ctx.fill();
			}
			if ( this.stroke ) {
				ctx.lineWidth = this.strokeWidth;
				ctx.strokeStyle = Style._color(this.stroke, {alpha:this.stroke.alpha*alpha*3});
				ctx.beginPath();
				//this.strokeOval(node.getX()-r, node.getY()-r, r*2, r*2);
				ctx.moveTo(node.getX()-r, node.getY());
				ctx.arc(node.getX(), node.getY(), r, 180, -180, false);
				ctx.closePath();
				ctx.stroke();
			}
		},
		nodeLabel: function(ctx, node, alpha) {
			// Visualization of a node's id.
			if ( alpha === undefined )
				alpha = 1;
			
			if ( this.text ) {
				// @note JS Canvas does not have lineHeight because it does not wrap
				// @todo We need to implement text wrapping ourself.
				// @todo Port shadows
				ctx.font = this.fontSize + "px " + this.font;
				ctx.fillStyle = Style._color(this.text, {alpha:this.text.alpha*alpha});
				// @todo Center alignment?
				ctx.fillText(node.label, node.getX(), node.getY());
			}
		},
		edge: function(ctx, edge, alpha, weight) {
			// Visualization of a single edge between two nodes.
			if ( alpha === undefined )
				alpha = 1;
			
			if ( (weight && !this.fill) || (!weight && !this.stroke) )
				return;
			
			if ( weight ) {
				ctx.lineWidth = Node.radius*edge.weight;
				ctx.strokeStyle = Style._color(this.fill, {alpha:this.fill.alpha*0.65*alpha});
			} else {
				ctx.lineWidth = this.strokeWidth;
				ctx.strokeStyle = Style._color(this.stroke, {alpha:this.stroke.alpha*0.65*alpha});
			}
			
			ctx.beginPath();
			ctx.moveTo(edge.node1.getX(), edge.node1.getY());
			if ( edge.node2.style === "back" ) {
				throw "Not implemented yet.";
			} else {
				ctx.lineTo(edge.node2.getX(), edge.node2.getY());
			}
			ctx.stroke();
			
		},
		edgeArrow: function(ctx) {},
		edgeLabel: function(ctx, edge, alpha) {
			// Visualization of the label accompanying an edge.
			if ( alpha === undefined )
				alpha = 1;
			
			if ( this.text && edge.label ) {
				ctx.font = this.fontSize*0.75 + "px " + this.font;
				ctx.fillStyle = Style._color(this.text, {alpha:this.text.alpha*alpha});
				
				var textwidth = ctx.measureText(edge.label).width;
				
				// Position the label centrally along the edge line.
				var a = Math.atan2(edge.node2.getY()-edge.node1.getY(), edge.node2.getX()-edge.node1.getX()) / (Math.PI/180);
				var d = Math.sqrt(Math.pow(edge.node2.getX()-edge.node1.getX(), 2) + Math.pow(edge.node2.getY()-edge.node1.getY(), 2));
				var d = Math.abs(d-textwidth) * 0.5;
				
				ctx.save();
				// @todo What was s._ctx.transform("corner") supposed to do in the python version?
				ctx.translate(edge.node1.getX(), edge.node1.getY());
				ctx.rotate(-a);
				ctx.translate(d, this.fontSize);
				ctx.scale(alpha, alpha);
				
				// Flip labels on the left hand side so they are legible.
				if ( 90 < (a%360) && (a%360) < 270 ) {
					ctx.translate(textwidth, -this.fontSize*2);
					// s._ctx.transform(CENTER)
					ctx.rotate(180);
					// s._ctx.transform(CORNER)
				}
				
				ctx.fillText(edge.label, 0, 0);
				ctx.restore();
			}
		},
		path: function(ctx) {},
	};
})();

Style.prototype.copy = function(name) {
	// Copy all attributes, link all monkey patch methods.
	var s = new Style(name || this.name);
	for ( var k in Style.defaults )
		s[k] = this[k];
	return s;
};

