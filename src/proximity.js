
var Proximity = {};

/**
 * Simple, multi-purpose depth-first search.
 * 
 * Visits all the nodes connected to the root, depth-first.
 * The visit function is called on each node.
 * Recursion will stop if it returns True, and ubsequently dfs() will return True.
 * The traversable function takes the current node and edge,
 * and returns True if we are allowed to follow this connection to the next node.
 * For example, the traversable for directed edges is follows:
 * lambda node, edge: node == edge.node1
 * 
 * Note: node._visited is expected to be False for all nodes.
 */
Proximity.depthFirstSearch = function(o) {
	if ( !o.root )
		throw new Error("depthFirstSearch object args does not contain a required root.");
	o.visit = o.visit || function(node) { return false; };
	o.traversable = o.traversable || function(node, edge) { return true; };
	
	var stop = o.visit(o.root);
	o.root._visited = true;
	
	var iter = o.root.links.iterator();
	while(iter.hasNext) {
		var node = iter.next();
		if ( stop )
			return true;
		if ( !o.traversable(o.root, o.root.links.edge(node)) )
			continue;
		if ( !node._visited )
			stop = Proximity.depthFirstSearch({ root: node, visit: o.visit, traversable: o.traversable });
	}
	return stop;
};

/**
 * An edge weight map indexed by node id's.
 * 
 * A dictionary indexed by node id1's in which each value is a
 * dictionary of connected node id2's linking to the edge weight.
 * If directed, edges go from id1 to id2, but not the other way.
 * If stochastic, all the weights for the neighbors of a given node sum to 1.
 * A heuristic can be a function that takes two node id's and returns
 * an additional cost for movement between the two nodes.
 */
Proximity.adjacency = function(o) {
	if ( !o.graph )
		throw new Error("adjacency object args does not contain a required graph.");
	o.directed = !!o.directed;
	o.reversed = !!o.reversed;
	o.stochastic = !!o.stochastic;
	
	var v = {};
	for ( var id in o.graph.nodes ) {
		var n = o.graph.nodes[id];
		v[n.id] = {};
	}
	
	CanvasNode.util.forEach.call(o.graph.edges, function(e) {
		var id1 = e[o.reversed?"node2":"node1"].id;
		var id2 = e[o.reversed?"node1":"node2"].id;
		
		v[id1][id2] = 1 - e.weight*0.5;
		
		if ( o.heuristic )
			v[id1][id2] += o.heuristic(id1, id2);
		
		if ( !o.directed )
			v[id2][id1] = v[id1][id2];
		
	});
	
	if ( o.stochastic ) {
		for ( var id1 in v ) {
			var d = CanvasNode.util.sum(CanvasNode.util.values(v[id1]));
			for ( var id2 in v[id1] ) {
				v[id1][id2] = v[id1][id2] / d;
			}
		}
	}
	
	return v;
};

/**
 * Dijkstra algorithm for finding shortest paths.
 * 
 * Connelly Barnes, http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/119466
 * Raises an IndexError between nodes on unconnected graphs. @todo javascripty
 */
Proximity.dijkstraShortestPath = function(graph, id1, id2, heuristic, directed) {
	var G = Proximity.adjacency({ graph: graph, directed: !!directed, heuristic: heuristic });
	var start = id1;
	var end = id2;
	
	// Flatten linked list of form [0,[1,[2,[]]]]
	function flatten(L, callback) {
		while ( L.length > 0 ) {
			callback(L[0]);
			L = L[1];
		}
	}
	
	var q = [{ cost1: 0, v1: start, path: []}] // Array of [cost, path_head, path_rest].
	var visited = {}; // Visited vertices; Python used a Set() of strings
	for(;;) {
		var qq = q.pop();
		visited[qq.v1] = true;
		if ( qq.v1 === end ) {
			var r = flatten(qq.path).slice().reverse()
			r.push(qq.v1);
			return r;
		}
		var path = [qq.v1, qq.path];
		for ( var g in G[qq.v1] ) {
			if ( !visited[g.v2] )
				q.push([qq.cost1 + g.cost2, g.v2, qq.path]);
		}
	}
};

/**
 * Betweenness centrality for nodes in the graph.
 * 
 * Betweenness centrality is a measure of the number of shortests paths that pass through a node.
 * Nodes in high-density areas will get a good score.
 * 
 * The algorithm is Brandes' betweenness centrality,
 * from NetworkX 0.35.1: Aric Hagberg, Dan Schult and Pieter Swart,
 * based on Dijkstra's algorithm for shortest paths modified from Eppstein.
 * https://networkx.lanl.gov/wiki
 */
Proximity.brandesBetweennessCentrality = function(graph, normalized, directed) {
	if ( !graph )
		throw new Error("graph not passed to brandesBetweennessCentrality");
	if ( normalized === undefined )
		normalized = true;
	directed = !!directed;
	
	var G = CanvasNode.util.keys(graph.nodes);
	var W = Proximity.adjacency({ graph: graph, directed: !!directed });
	
	var betweenness = {};
	for ( var v in graph.nodes )
		betweenness[v] = 0;
	
	for ( var s in graph.nodes ) {
		var S = [];
		var P = {};
		for ( var v in graph.nodes )
			P[v] = [];
		var sigma = {};
		for ( var v in graph.nodes )
			sigma[v] = 0;
		var D = {};
		sigma[s] = 1;
		var seen = { s: 0 };
		var Q = []; // use Q as heap with [distance, node id] lists
		Q.push({ dist: 0, pred: s, v: s });
		while(Q.length) {
			var q = Q.pop();
			if ( q.v in D )
				continue; // already searched this node
			sigma[q.v] = sigma[q.v] + sigma[q.pred]; // count paths
			S.push(q.v);
			D[q.v] = seen[v];
			var iter = graph.node(v).links.iterator();
			while(iter.hasNext) {
				var w = iter.next().id;
				var vw_dist = D[q.v] + W[q.v][w];
				
				if ( !(w in D) && ( !(w in seen) || vw_dist < seen[w] ) ) {
					seen[w] = vw_dist;
					Q.push({ dist: vw_dist, pred: q.v, v: w });
					P[w] = [v];
				} else if ( vw_dist === seen[w] ) { // handle equal paths
					sigma[w] = sigma[w] + sigma[q.v];
					P[w].push(q.v);
				}
			}
		}
		
		var delta = {};
		for ( var v in graph.nodes )
			delta[v] = 0;
		
		while ( S.length ) {
			var w = S.pop();
			for ( var v in P[w] )
				delta[v] = delta[v] + ( sigma[v] / sigma[w] ) * ( 1 + delta[w] );
			if ( w != s )
				betweenness[w] = betweenness[w] + delta[w];
		}
		
		var m;
		if ( normalized ) {
			// Normalize between 0 and 1.
			m = Math.max.apply(Math, CanvasNode.util.values(betweenness));
			if ( m == 0 )
				m = 1;
		} else {
			m = 1;
		}
		
		for ( var id in betweenness )
			betweenness[id] = betweenness[id]/m;
		
		return betweenness;
	}
};

/**
 * Eigenvector centrality for nodes in the graph (like Google's PageRank).
 * 
 * Eigenvector centrality is a measure of the importance of a node in a directed network. 
 * It rewards nodes with a high potential of (indirectly) connecting to high-scoring nodes.
 * Nodes with no incoming connections have a score of zero.
 * If you want to measure outgoing connections, reversed should be False.
 * 
 * The eigenvector calculation is done by the power iteration method.
 * It has no guarantee of convergence.
 * A starting vector for the power iteration can be given in the start dict.
 * 
 * You can adjust the importance of a node with the rating dictionary,
 * which links node id's to a score.
 * 
 * The algorithm is adapted from NetworkX, Aric Hagberg (hagberg@lanl.gov):
 * https://networkx.lanl.gov/attachment/ticket/119/eigenvector_centrality.py
 */
Proximity.eigenvectorCentrality = function(o) {
	if ( !o.graph )
		throw new Error("eigenvectorCentrality object args does not contain a required graph.");
	if ( o.normalized === undefined )
		o.normalized = true;
	if ( o.reversed === undefined )
		o.reversed = true;
	o.rating = {};
	o.iterations = o.iterations || 100;
	if ( o.tolerance === undefined )
		o.tolerance = 0.0001;
	
	var count = CanvasNode.util.count(this.graph.nodes);
	var W = Proximity.adjacency({ graph: o.graph, directed: true, reversed: o.reversed });
	
	function _normalize(x) {
		var s = CanvasNode.util.sum(CanvasNode.util.values(x));
		if ( s != 0 )
			s = 1.0 / s;
		for ( k in x )
			x[k] = x[k] * s;
	}
	
	var x = o.start;
	if ( !x ) {
		x = {};
		for ( var n in graph.nodes )
			x[n] = Math.random();
	}
	_normalize(x);
	
	// Power method: y = Ax multiplication.
	for ( var i = 0; i < o.iterations; i++ ) {
		var x0 = x;
		var x = {};
		for ( var k in x0 )
			x[k] = 0;
		for ( var n in x ) {
			for ( var nbr in W[n] ) {
				var r = n in rating ? rating[n] : 1;
				x[n] += 0.01 + x0[nbr] * W[n][nbr] * r;
			}
		}
		_normalize(x);
		var e;
		for ( var n in x )
			e += Math.abs(x[n]-x0[n]);
		if ( e < count * o.tolerance ) {
			if ( o.normalized ) {
				// Normalize between 0 and 1
				var m = Math.max.apply(Math, CanvasNode.util.values(x));
				if ( m == 0 )
					m = 1;
				x2 = {};
				for ( var id in x )
					x[id] = x[id]/m;
				x = x2;
			}
			return x;
		}
	}
	
	if ( window.console )
		console.warn("node weight is 0 because eigenvector_centrality() did not converge.");
	var x = {};
	for ( var n in graph.nodes )
		x[n] = 0;
	return x;
};

