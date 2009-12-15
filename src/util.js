
var CanvasNode = {};
CanvasNode.util = {};
// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/forEach
CanvasNode.util.forEach =
	Array.prototype.forEach ||
	function(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();
		
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this)
				fun.call(thisp, this[i], i, this);
		}
	};

// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/map
CanvasNode.util.map =
	Array.prototype.map ||
	function(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();
		
		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this)
				res[i] = fun.call(thisp, this[i], i, this);
		}
		
		return res;
	};

// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/filter
CanvasNode.util.filter =
	Array.prototype.filter ||
	function(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function")
			throw new TypeError();
		
		var res = new Array();
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this) {
				var val = this[i]; // in case fun mutates this
				if (fun.call(thisp, val, i, this))
					res.push(val);
			}
		}
		
		return res;
	};

// https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/indexOf
CanvasNode.util.indexOf =
	Array.prototype.indexOf ||
	function(elt /*, from*/) {
		var len = this.length >>> 0;
		
		var from = Number(arguments[1]) || 0;
		from = (from < 0) ? Math.ceil(from) : Math.floor(from);
		if (from < 0)
			from += len;

		for (; from < len; from++) {
			if (from in this && this[from] === elt)
				return from;
		}
		return -1;
	};

CanvasNode.util.remove = function(item) {
	for ( var i = this.length-1; i >= 0; i-- )
	if ( this[i] === item )
		Array.prototype.splice.call(this, i, 1);
};

CanvasNode.util.unique = function() {
	var arr = Array.prototype.slice.call(this);
	for ( var i = arr.length-1; i > 0; --i ) {
		var toRemove = arr[i];
		for ( var j = i-1; j >= 0; --j ) {
			if ( arr[j] === toRemove ) {
				arr.splice(j, 1); // Remove it
				i--; // Our location has changed
			}
		}
	}
	return arr;
};

CanvasNode.util.shallowCopy = function(obj) {
	var newObj = {};
	for ( var k in obj )
		if ( obj.hasOwnProperty(k) )
			newObj[k] = obj[k];
	return newObj;
};

CanvasNode.util.keys =
	Object.keys ||
	function(obj) {
		var keys = [];
		for ( var k in obj )
			if ( obj.hasOwnProperty(k) )
				keys.push(k);
		return keys;
	};

CanvasNode.util.values =
	Object.values ||
	function(obj) {
		var values = [];
		for ( var k in obj )
			if ( obj.hasOwnProperty(k) )
				values.push(obj[k]);
		return values;
	};

CanvasNode.util.count = function(obj) {
	if ( "__count__" in obj )
		return obj.__count__;
	var count = 0;
	for ( var k in obj )
		if ( obj.hasOwnProperty(k) )
			count++;
	return count;
};

CanvasNode.util.create =
	Object.create ||
	function(proto) {
		function P() {}
		P.prototype = proto;
		return new P();
	};

CanvasNode.util.sum = function(arr) {
	var n = 0;
	for ( var i = arr.length-1; i >= 0; --i )
		n += arr[i];
	return n;
};

CanvasNode.util.Iterator = function(list) {
	this._list = list;
	this.index = -1;
	this.hasNext = list.length > 0;
};
CanvasNode.util.Iterator.prototype.next = function() {
	this.index++;
	this.hasNext = this.index+1 < this._list.length;
	this.current = this._list[this.index];
	if ( this.index >= this._list.length )
		throw new Error("Called .next() on iterator when "); // @todo Use the proper error type
	return this._list[this.index];
};

