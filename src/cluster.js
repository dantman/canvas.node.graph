
var Cluster = {};

/**
 * Returns a sorted copy of the list
 */
Cluster.sorted = function(list, cmp, reversed) {
	list = list.slice().sort(cmp);
	if ( reversed )
		list.reverse();
	return list;
};

/**
 * Returns a copy of the list without duplicates.
 */
Cluster.unique = function(list) {
	return CanvasNode.util.unique.call(list);
};

/**
 * Recursively lists the node and its links.
 * 
 * Distance of 0 will return the given [node].
 * Distance of 1 will return a list of the node and all its links.
 * Distance of 2 will also include the linked nodes' links, etc.
 */
Cluster.flatten = function(node, distance) {
	if ( distance === undefined )
		distance = 1;
	
	// When you pass a graph it returns all the node id's in it.
	if ( node.nodes && node.edges )
		return CanvasNode.util.keys(node.nodes);
	
	var all = [node];
	if ( distance >= 1 ) {
		var iter = node.links.iterator();
		while ( iter.hasNext )
			all.push(iter.next().flatten(distance-1));
	}
	
	return Cluster.unique(all);
};

/**
 * Returns the intersection of lists.
 * a & b -> elements that appear in a as well as in b.
 */
Cluster.intersection = function(a, b) {
	var x = [];
	loop:
		for ( var aa = a.length-1; aa >= 0; --aa ) {
			for ( var bb = b.length-1; bb >= 0; --bb ) {
				if ( b[bb] == a[aa] ) {
					x.push(a[aa]);
					continue loop;
				}
			}
		}
	return x.reverse();
};

/**
 * Returns the union of lists.
 * a | b -> all elements from a and all the elements from b.
 */
Cluster.union = function(a, b) {
	return Cluster.unique(a.concat(b));
};
    
/**
 * Returns the difference of lists.
 * a - b -> elements that appear in a but not in b.
 */
Cluster.difference = function(a, b) {
	var x = [];
	loop:
		for ( var aa = a.length-1; aa >= 0; --aa ) {
			for ( var bb = b.length-1; bb >= 0; --bb ) {
				if ( b[bb] == a[aa] )
					continue loop;
			}
			x.push(a[aa]);
		}
	return x.reverse();
};
    
/**
 * Creates the subgraph of the flattened node with given id (or list of id's).
 * Finds all the edges between the nodes that make up the subgraph.
 */
Cluster.subgraph = function(graph, ids, distance) {
	if ( distance === undefined )
		distance = 1;
	
	var g = graph.copy(true);
	
	if ( typeof ids !== "string" )
		ids = [ids];
	if ( typeof ids === "function" ) {
		// id can also be a lambda or function that returns true or false
		// for each node in the graph. We take the id's of nodes that pass.
		var fn = ids;
		ids = [];
		for ( var nId in graph.nodes ) {
			if ( fn(graph.nodes[nId]) )
				ids.push(nId);
		}
	}
	
	for ( var id; id = ids.shift(); ) {
		var flattened = Cluster.flatten(graph[id], distance);
		for ( var n; n = flattened.shift(); ) {
			g.addNode(n.id, n.radius, n.style, n.category, n.label, (n==graph.root));
		}
	}
	
	CanvasNode.util.forEach.call(graph.edges, function(e) {
		if ( e.node1.id in g.nodes && e.node2.id in g.nodes ) {
			g.addEdge(e.node1.id, e.node2.id, e.weight, e.length, e.label);
		}
	});
	
	// Should we look for shortest paths between nodes here? (note retained from python code)
	
	return g;
};

/**
 * A clique is a set of nodes in which each node is connected to all other nodes.
 */
Cluster.isClique = function(graph) {
	return graph.density >= 1.0;
}

/**
 * Returns the largest possible clique for the node with given id.
 */
Cluster.clique = function(graph, id) {
	var clique = [id];
	
	for ( var nId in this.nodes ) {
		var n = this.nodes[nId];
		var friend = true;
		for ( var id2; id2 = clique.shift(); ) {
			if ( n.id === id || !graph.edge(n.id, id) ) {
				friend = false;
				break;
			}
		}
		if ( friend )
			clique.push(n.id);
	}
	
	return clique;
};

/**
 * Returns all the cliques in the graph of at least the given size.
 */
Cluster.cliques = function(graph, threshold) {
	if ( threshold === undefined )
		threshold = 3;
	
	var cliques = [];
	for ( var id in graph.nodes ) {
		var c = Cluster.clique(graph, id);
		if ( c.length >= threshold ) {
			c.sort(); // @note Is this right? In JS this is going to sort id's alphabetically, does this do something different in python?
			// @todo Lets implement some sort of local Set() class instead of doing things like this
			if ( CanvasNode.util.indexOf.call(cliques, c) < 0 )
				cliques.append(c);
		}
	}
	
	return cliques;
};

/**
 * Splits unconnected subgraphs.
 * 
 * For each node in the graph, make a list of its id and all directly connected id's.
 * If one of the nodes in this list intersects with a subgraph,
 * they are all part of that subgraph.
 * Otherwise, this list is part of a new subgraph.
 * Return a list of subgraphs sorted by size (biggest-first).
 */
Cluster.partition = function(graph) {
	var g = [];
	
	for ( var id in this.nodes ) {
		var n = graph.nodes[id];
		var c = [];
		for ( var flattened = Cluster.flatten(n), flat; flat = flattened.shift(); )
			c.push(flat);
		var f = false;
		for ( var i = 0; i < g.length; i++ ) {
			if ( Cluster.intersection(g[i], c).length > 0 ) {
				g[i] = Cluster.union(g[i], c);
				f = true;
				break;
			}
		}
		if ( !f )
			g.push(c);
	}
	
	// If 1 is directly connected to 2 and 3,
	// and 4 is directly connected to 5 and 6, these are separate subgraphs.
	// If we later find that 7 is directly connected to 3 and 6,
	// it will be attached to [1, 2, 3] yielding
	// [1, 2, 3, 6, 7] and [4, 5, 6].
	// These two subgraphs are connected and need to be merged.
	var merged = [];
	for ( var i = 0; i < g.length; i++ ) {
		merged.push(g[i]);
		for ( var j = i+1; j < g.length; j++ ) {
			if ( Cluster.intersection(g[i], g[j]) > 0 ) {
				merged[merged.length-1].push.call(cmerged[merged.length-1], g[j]);
				g[j] = [];
			}
		}
	}
	
	var g = [];
	for ( var m; m = merged.shift(); )
		g.push(graph.subgraph(m, 0));
	
	g.sort(function(a, b) { return b.length - a.length; });
	
	return g;
};

