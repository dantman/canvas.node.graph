
/**
 * A node with a unique id in the graph.
 * Its position is calculated by graph.layout.
 * The node's radius and style define how it looks onscreen.
 */
function Node(graph, id, radius, style, category, label) {
	this.graph = graph;
	this.id = id || "";
	this.radius = radius || Node.radius;
	this.style = style || "default";
	this.category = category || "";
	this.label = label || this.id;
	this.vx = 0;
	this.vy = 0;
	this.force = { x: 0, y: 0 };
	this._visited = false;
	this._betweenness = undefined;
	this._eigenvalue = undefined;
	this.links = new Links;
	
	this.edges = this.links._edges;
}
Node.radius = 8;
Node.prototype.isLeaf = function() {
	return this.links.length == 1;
};
/**
 * Returns True if given node can be reached over traversable edges.
 * To enforce edge direction, use a node==edge.node1 traversable.
 */
Node.prototype.canReach = function(node, traversable, edge) {
	if ( !traversable )
		traversable = function() { return node };
	if ( edge === undefined )
		edge = true;
	if ( typeof node === "string" )
		node = this.graph.nodes[node];
	var nodes = this.graph.nodes;
	CanvasNode.util.forEach.call(nodes, function(n) {
		n._visited = false;
	});
	return Proximity.depthFirstSearch({
		root: this,
		visit: function(n) { return node === n; },
		traversable: traversable
	});
};

Node.prototype.getBetweenness = function() {
	if ( this._betweenness === undefined )
		this.graph.betweennessCentrality();
	return this._betweenness;
};

Node.prototype.getEigenvalue = function() {
	if ( this._eigenvalue === undefined )
		this.graph.eigenvectorCentrality();
	return this._eigenvalue;
};

Node.prototype.getX = function() { return this.vx * this.graph.d; };
Node.prototype.getY = function() { return this.vy * this.graph.d; };

/**
 * True if pt.x, pt.y is inside the node's absolute position.
 */
Node.prototype.contains = function(pt) {
	return Math.abs(this.graph.x + this.getX() - pt.x) < this.radius * 2 &&
		Math.abs(this.graph.y + this.getY() - pt.y) < this.radius * 2;
};

Node.prototype.flatten = function(distance) {
	return Cluster.flatten(this, distance === undefined ? 1 : distance);
};

Node.prototype._and = function(node, distance) {
	if ( distance === undefined )
		 distance = 1;
	return Cluster.intersection(this.flatten(distance), node.flatten(distance));
};

Node.prototype._or = function(node, distance) {
	if ( distance === undefined )
		 distance = 1;
	return Cluster.union(this.flatten(distance), node.flatten(distance));
};

Node.prototype._sub = function(node, distance) {
	if ( distance === undefined )
		 distance = 1;
	return Cluster.difference(this.flatten(distance), node.flatten(distance));
};

Node.prototype.toString = function() {
	return this.id;
};

Node.prototype.equals = function(node) {
	if (!(node instanceof Node))
		return false;
	return this.id === node.id;
};

/**
 * A list in which each node has an associated edge.
 * The edge() method returns the edge for a given node id.
 */
function Links() {
	this._edges = {};
	this.length = 0;
};
Links.prototype._push = Array.prototype.push;
Links.prototype.append = function(node, edge) {
	if ( edge )
		this._edges[node.id] = edge;
	this._push(node);
};
Links.prototype.has = function(node) {
	return CanvasNode.util.indexOf.call(this, node) >= 0;
};
Links.prototype.remove = function(node) {
	delete this._edges[node.id];
	CanvasNode.util.remove.call(this, node);
};
Links.prototype.edge = function(id) {
	if ( id instanceof Node )
		id = id.id;
	return this._edges[id];
};
Links.prototype.iterator = function() {
	return new CanvasNode.util.Iterator(this);
};

function Edge(node1, node2, weight, length, label, properties) {
	this.node1 = node1;
	this.node2 = node2;
	this.weight = weight || 0;
	this.length = length || 1;
	this.label = label || "";
	
	// @todo properties
	// note length must be 1 or more
	// The python does this using a (gs)etter, we need to find another method
};

function Graph(iterations, distance, layout) {
	this.iterations = iterations === undefined ? 1000 : iterations;
	this.distance = distance === undefined ? 1 : distance;
	
	this.nodes = {};
	this.edges = [];
	this.root = undefined;
	
	// Calculates positions for nodes.
	this.layout = new Layout.types[layout||"spring"](this, this.iterations);
	if ( !this.layout && window.console )
		console.warning("There is no layout type named "+(layout||"spring")+" available Graph has been constructed without one.");
	this.d = Node.radius * 2.5 * this.distance;
	
	// Hover, click and drag event handler.
	//this.events = Event.events(this, /*todo*/ ctx); // @todo Make this more dom like
	
	// Enhanced dictionary of all styles.
	this.styles = new Styles(this);
	this.styles.append(new Style("default"));
	this.alpha = 0;
};
Graph.prototype.getDistance = function() {
	return this.d / ( Node.radius * 2.5 );
};
Graph.prototype.setDistance = function(value) {
	this.d = Node.radius * 2.5 * value;
};

/**
 * Create a copy of the graph (by default with nodes and edges).
 */
Graph.prototype.copy = function(empty) {
	var g = new Graph(this.layout.n, this.distance, this.layout.type);
	g.layout = this.layout.copy(g);
	g.styles = this.styles.copy(g);
	//g.events = this.events.copy(g);
	
	if( !empty ) {
		for ( var id in this.nodes ) {
			var n = this.nodes[id];
			g.addNode(n.id, { radius: n.radius, style: n.style, category: n.category, label: n.label, root: (n === this.root) });
		}
		CanvasNode.util.forEach.call(this.edges, function(e) {
			g.addEdge(e.node1.id, e.node2.id, { weight: e.weight, length: e.length, label: e.label });
		});
	}
	
	return g;
};

/**
 * Remove nodes and edges and reset the layout.
 */
Graph.prototype.clear = function() {
	this.nodes = {};
	this.edges = [];
	this.root = undefined;
	
	this.layout.i = 0;
	this.alpha = 0;
};

/**
 * Returns a node object; can be overloaded when the node class is subclassed.
 * @todo Make this more javascripty?
 */
Graph.prototype.newNode = function() {
	var n = CanvasNode.util.create(Node.prototype);
	Node.apply(n, arguments);
	return n;
};

/**
 * Returns an edge object; can be overloaded when the edge class is subclassed.
 * @todo Make this more javascripty?
 */
Graph.prototype.newEdge = function() {
	var n = CanvasNode.util.create(Edge.prototype);
	Edge.apply(n, arguments);
	return n;
};

/**
 * Add node from id and return the node object.
 */
Graph.prototype.addNode = function(id, o) {
	o = o || {};
	
	if ( id in this.nodes )
		return this.nodes[id];
	if ( typeof o.style !== "string" && o.style && o.style.name )
		o.style = o.style.name;
	
	var n = this.newNode(this, id, o.radius, o.style, o.category, o.label);
	this.nodes[n.id] = n;
	
	if ( o.root )
		this.root = n;
	
	return n;
};

/**
 * Add nodes from a list of id's.
 */
Graph.prototype.addNodes = function(nodes) {
	CanvasNode.util.forEach.call(nodes, this.addNode, this);
};

/**
 * Add weighted (0.0-1.0) edge between nodes, creating them if necessary.
 * The weight represents the importance of the connection (not the cost).
 */
Graph.prototype.addEdge = function(id1, id2, o) {
	o = o || {};
	
	if ( id1 === id2 )
		return null;
	
	// These will short circut and just return if the nodes are already exist
	// so we just call them instead of checking, it also simplifies the code
	// in comparison to the python original's equiv
	var n1 = this.addNode(id1);
	var n2 = this.addNode(id2);
	
	// If a-> already exists, don't re-create it.
	// However, b->a may still pass.
	if ( n2.links.has(n1) )
		if ( n2.links.edge(n1).node1 === n1 )
			return this.edge(id1, id2);
	
	o.weight = Math.max(0, Math.min(o.weight, 1));
	
	var e = this.newEdge(n1, n2, o.weight, o.length, o.label);
	this.edges.push(e);
	n1.links.append(n2, e);
	n2.links.append(n1, e);
	
	return e;
};

/**
 * Remove node with given id.
 */
Graph.prototype.removeNode = function(id) {
	if ( id in this.nodes ) {
		var n = this.nodes[id];
		delete this.nodes[id];
		
		// Remove all edges involving id and all links to it.
		this.edges = CanvasNode.util.filter.call(this.edges, function(e) {
			if ( e.node1 === n || e.node2 === n ) {
				e.node1.links.remove(n);
				e.node2.links.remove(n);
				return false; // remove
			}
			return true;
		});
		
	}
	
};

/**
 * Remove edges between nodes with given id's.
 */
Graph.prototype.removeEdge = function(id1, id2) {
	this.edges = CanvasNode.util.filter.call(this.edges, function(e) {
		if ( ( e.node1.id === id1 || e.node2.id === id1 )
		     ( e.node1.id === id2 || e.node2.id === id2 ) ) {
			e.node1.links.remove(e.node2);
			e.node2.links.remove(e.node1);
			return false; // remove
		}
		return true;
	});
};

/**
 * Returns the node in the graph associated with the given id.
 */
Graph.prototype.node = function(id) {
	if ( id in this.nodes )
		return this.nodes[id];
	return null;
};

/**
 * Returns the edge between the nodes with given id1 and id2.
 */
Graph.prototype.edge = function(id1, id2) {
	if ( id1 in this.nodes && id2 in this.nodes ) {
		return this.nodes[id1].links.edge(id2);
	}
	return null;
};

/**
 * Iterates the graph layout and updates node positions.
 */
Graph.prototype.update = function(iterations) {
	if ( iterations === undefined )
		iterations = 10;
	// The graph fades in when initially constructed.
	this.alpha += 0.05;
	this.alpha = Math.min(this.alpha, 1);
	
	// Iterates over the graph's layout.
	// Each step the graph's bounds are recalculated
	// and a number of iterations are processed,
	// more and more as the layout progresses.
	if ( this.layout.i === 0 ) {
		this.layout.prepare();
		this.layout.i++;
	} else if ( this.layout.i === 1 ) {
		this.layout.iterate();
	} else if ( this.layout.i < this.layout.n ) {
		var n = Math.min(iterations, this.layout.i / 10 + 1);
		for ( var i = n; i > 0; i++ )
			this.layout.iterate();
	}
	
	// Calculate the absolute center of the graph.
	var bounds = this.layout.bounds();
	this.x = this.canvas.width - bounds.max.x*this.d - bounds.min.x*this.d;
	this.y = this.canvas.height - bounds.max.y*this.d - bounds.min.y*this.d;
	this.x = this.x / 2;
	this.y = this.y / 2;
	
	return !this.layout.isDone();
};

/**
 * Iterates the graph layout until done.
 */
Graph.prototype.solve = function() {
	this.layout.solve();
	this.alpha = 1;
};

Graph.prototype.isDone = function() {
	return this.layout.isDone();
};

/**
 * Returns the distance from the center to the given node.
 */
Graph.prototype.offset = function(node) {
	return {
		x: this.x + node.getX() - this.canvas.width/2,
		y: this.y + node.getY() - this.canvas.height/2
	};
};

/**
 * Layout the graph incrementally.
 */
Graph.prototype.draw = function(o) {
	o = o || {}
	o.dx = o.dx || 0;
	o.dy = o.dy || 0;
	o.weighted = o.weighted || false;
	o.directed = o.directed || false;
	o.highlight = o.highlight || [];
	
	// The graph is drawn at the center of the canvas.
	// The weighted and directed parameters visualize edge weight and direction.
	// The highlight specifies list of connected nodes. 
	// The path will be colored according to the "highlight" style.
	// Clicking and dragging events are monitored.
	
	this.update();
	
	var ctx = this.canvas.getContext('2d');
	
	if ( typeof this.x !== "number" || typeof this.y !== "number" || isNaN(this.x) || isNaN(this.y) )
		if ( window.console )
			console.warn("Graph's x or y is not a number { %o, %o }", this.x, this.y);
	
	// Draw the graph background.
	var s = this.styles.getStyle();
	s.graphBackground(ctx);
	
	// Center the graph on the canvas.
	ctx.save();
	ctx.translate(this.x + o.dx, this.y + o.dy);
	
	// Indicate betweenness centrality.
	if ( o.traffic ) {
		if ( typeof o.traffic === "boolean" )
			o.traffic = 5;
		var nodes = this.nodesByBetweenness();
		for ( var i = 0; i < o.traffic && i < nodes.length; i++ ) {
			var n = nodes[i];
			s = this.styles.getStyle(n.style);
			if ( s.graphTraffic )
				s.graphTraffic(ctx, n, this.alpha);
		}
		
	}
	
	// Draw the edges and their labels.
	CanvasNode.util.forEach.call(this.edges, function(e) {
		s = this.styles.getStyle(e.node1.style);
		
		if ( o.weighted )
			s.edge(ctx, e, this.alpha, true);
		
		if ( s.edge )
			s.edge(ctx, e, this.alpha, false);
		
		if ( o.directed )
			s.edgeArrow(ctx, e, 10);
		
		if ( s.edgeLabel )
			s.edgeLabel(ctx, e, this.alpha);
	}, this);
	
	// Draw each node in the graph.
	// Apply individual style to each node (or default).
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		s = this.styles.getStyle(n.style);
		if ( s.node )
			s.node(ctx, n, this.alpha);
	}
	
	// Highlight the given shortest path.
	s = this.styles.getStyle("highlight");
	
	if ( s.path )
		s.path(ctx, this, o.highlight);
	
	// Draw node id's as labels on each node.
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		s = this.styles.getStyle(n.style);
		if ( s.nodeLabel )
			s.nodeLabel(ctx, n, this.alpha);
	}
	
	// Events for clicked and dragged nodes.
	// Nodes will resist being dragged by attraction and repulsion,
	// put the event listener on top to get more direct feedback.
	//this.events.update(); // @todo
	
	ctx.restore();
};

/**
 * Removes all nodes with less or equal links than depth.
 */
Graph.prototype.prune = function(depth) {
	depth = depth || 0;
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		if ( n.links.length <= depth )
			this.removeNode(n.id);
	}
};

/**
 * Returns a list of node id's connecting the two nodes.
 */
Graph.prototype.shortestPath = function(id1, id2, heuristic, directed) {
	directed = !!directed;
	try { return Proximity.dijkstraShortestPath(this, id1, id2, heuristic, directed); }
	catch( e ) { return; }
};

/**
 * Calculates betweenness centrality and returns an node id -> weight dictionary.
 * Node betweenness weights are updated in the process.
 */
Graph.prototype.betweennessCentrality = function(normalized, directed) {
	if ( normalized === undefined )
		normalized = true;
	var bc = Proximity.brandesBetweennessCentrality(this, normalized, !!directed);
	for ( var id in bc )
		this.nodes[id]._betweenness = bc[id];
	return bc;
};

/**
 * Calculates eigenvector centrality and returns an node id -> weight dictionary.
 * Node eigenvalue weights are updated in the process.
 */
Graph.prototype.eigenvectorCentrality = function(normalized, reversed, rating, start, iterations, tolerance) {
	if ( normalized === unsigned )
		normalized = true;
	if ( reversed === unsigned )
		reversed = true;
	rating = rating || {};
	if ( iterations === unsigned )
		iterations = 100;
	if ( tolerance === unsigned )
		tolerance = 0.0001;
	
	var ec = Proximity.eigenvectorCentrality(this, normalized, reversed, rating, start, iterations, tolerance);
	for ( var id in ec )
		this.nodes[id]._eigenvalue = ec[id];
	return ec;
};

/**
 * Returns nodes sorted by betweenness centrality.
 * Nodes with a lot of passing traffic will be at the front of the list.
 */
Graph.prototype.nodesByTraffic =
Graph.prototype.nodesByBetweenness = function(treshold) {
	treshold = treshold || 0;
	var nodes = [];
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		var betweenness = n.getBetweenness();
		if ( betweenness > treshold )
			nodes.push({ node: n, betweenness: betweenness });
	}
	return CanvasNode.util.map.call(
		nodes.sort(function(a, b) { return b.betweenness-a.betweenness; }).reverse(),
		function(i) { return i.node; });
};

/**
 * Returns nodes sorted by eigenvector centrality.
 * Nodes with a lot of incoming traffic will be at the front of the list
 */
Graph.prototype.nodesByWeight =
Graph.prototype.nodesByEigenvalue = function(treshold) {
	treshold = treshold || 0;
	var nodes = [];
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		var eigenvalue = n.getEigenvalue();
		if ( eigenvalue > treshold )
			nodes.push({ node: n, eigenvalue: eigenvalue });
	}
	return CanvasNode.util.map.call(
		nodes.sort(function(a, b) { return b.eigenvalue-a.eigenvalue; }).reverse(),
		function(i) { return i.node; });
}

/**
 * Returns nodes with the given category attribute.
 */
Graph.prototype.nodesByCategory = function(category) {
	var nodes = [];
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		if ( n.category === category )
			nodes.push(n);
	}
	return nodes;
};

/**
 * Returns a list of nodes that have only one connection.
 */
Graph.prototype.getLeaves = function() {
	var nodes = [];
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		if ( n.isLeaf() )
			nodes.push(n);
	}
	return nodes;
};

/**
 * Returns a list of leaves, nodes connected to leaves, etc.
 */
Graph.prototype.fringe =
Graph.prototype.crown = function(depth) {
	if ( depth === unsigned )
		depth = 2;
	var nodes = CanvasNode.util.map.call(this.getLeaves(), function(n) {
		n.flatten(depth-1);
	});
	return Cluster.unique(nodes);
};

/**
 * The number of edges in relation to the total number of possible edges.
 */
Graph.prototype.getDensity = function() {
	var nodes = CanvasNode.util.count(this.nodes);
	return 2 * this.edges.length / nodes * (nodes-1);
};

Graph.prototype.isComplete = function() { return this.getDensity() === 1 ; };
Graph.prototype.isDense = function() { return this.getDensity() > 0.65; };
Graph.prototype.isSparse = function() { return this.getDensity() < 0.35; };

Graph.prototype.subgraph
Graph.prototype.sub = function(id, distance) {
	return Cluster.subgraph(this, id, distance||1);
};

Graph.prototype.intersect =
Graph.prototype._and = function(graph) {
	var nodes = Cluster.intersection(Cluster.flatten(this), Cluster.flatten(graph));
	var all = this._or(graph);
	return Cluster.subgraph(all, nodes, 0);
};

Graph.prototype.join =
Graph.prototype._or = function(graph) {
	var g = this.copy();
	for ( var id in this.nodes ) {
		var n = this.nodes[id];
		var root = !g.root && graph.root === n;
		g.addNode(n.id, { radius: n.radius, style: n.style, category: n.category, label: n.label, root: root });
	}
	CanvasNode.util.forEach.call(graph.edges, function(e) {
		g.addEdge(e.node1.id, e.node2.id, { weight: e.weight, length: e.length, label: e.label });
	});
	return g;
};

Graph.prototype.subtract =
Graph.prototype._sub = function(graph) {
	var nodes = Cluster.difference(Cluster.flatten(this), Cluster.flatten(graph));
	var all = this._or(graph);
	return Cluster.subgraph(all, nodes, 0);
};

Graph.prototype.isClique = function() {
	return Cluster.isClique(this);
};

Graph.prototype.clique = function(id, distance) {
	return Cluster.subgraph(this, Cluster.clique(this, id), distance||0);
};

Graph.prototype.cliques = function(threshold, distance) {
	var g = [];
	var c = Cluster.cliques(this, threshold||3);
	CanvasNode.util.forEach.call(c, function(nodes) {
		g.push(Cluster.subgraph(this, nodes, distance||0));
	});
	return g;
};

Graph.prototype.split = function() {
	return Cluster.partition(this);
};

/**
 * Returns a new graph with predefined styling.
 */
function CanvasGraph(o) {
	o = o || {};
	o.depth = o.depth === undefined ? true : !!o.depth;
	var g = new Graph(o.iterations, o.distance, o.layout);
	
	// Styles for different types of nodes.
	var s = Style.style;
	
	// @todo
	
	return g;
}

