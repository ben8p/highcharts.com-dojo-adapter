require([
	'dojo/_base/array',
	'dojo/_base/event',
	'dojo/_base/fx',
	'dojo/_base/kernel',
	'dojo/_base/lang',
	'dojo/_base/sniff',
	'dojo/_base/window',

	'dojo/dom-construct',
	'dojo/dom-geometry',
	'dojo/dom-style',

	'dojo/aspect',
	'dojo/on'
], function(array, baseEvent, baseFx, kernel, lang, sniff, win,
	domConstruct, domGeometry, domStyle,
	aspect, on) {
	// summary:
	//		Dojo adapter for HighStock/HighChart

	var PropLine = function(properties) {
		// summary:
		//		PropLine is an internal class which is used to model the values of
		//		an a group of properties across an animation lifecycle. In
		//		particular, the 'getValue' function handles getting interpolated
		//		values between start and end for a particular value.
		this._properties = properties;
	}, _Adapter;
	PropLine.prototype.getValue = function(r) {
		// summary:
		//		handles getting interpolated values between start and end for a particular value.
		var ret = {}, p, prop, start;
		for(p in this._properties) {
			if(this._properties.hasOwnProperty(p)) {
				prop = this._properties[p];
				start = prop.start;
				if(!lang.isArray(start)) {
					ret[p] = ((prop.end - start) * r) + start;
				}
			}
		}
		return ret;
	};
	_Adapter = {
		useAnim: true, //false to disable animation
		handleAllEvents: true,
		_scriptSignals: null, //internal use only
		_id: 0,

		setAdapterNs: function(el) {
			// summary:
			//		set an Adapter namespace in the given object.
			// el: Object
			//		object where namespace is created
			//console.log('Highcharts.Dojo.Adapter::setAdapterNs');
			if(el) {
				el.dojoAdapter = el.dojoAdapter || {
					signals: {},
					anim: null
				};
			}
		},
		getAdapterNs: function(el) {
			// summary:
			//		get an Adapter namespace from the given object.
			// el: Object
			//		object where namespace is located
			//console.log('Highcharts.Dojo.Adapter::getAdapterNs');
			return el.dojoAdapter;
		},
		init: function(dummyPathAnim) { //jslint ignore: empty_block
			// summary:
			//		Initialize the adapter. This is run once as Highcharts is first run.
			// pathAnim: Object
			//		The helper object to do animations across adapters.
			//console.log('Highcharts.Dojo.Adapter::init');
		},

		setAttr: function(el, params) {
			// summary:
			//		Update attribute or domStyle depending on el type
			// el: Object
			//		The object to update.
			// params: Object
			//		list of properties and value to update
			//console.log('Highcharts.Dojo.Adapter::setAttr', el, params);
			var key;
			if(el.attr) {// SVGElement
				for(key in params) {
					if(params.hasOwnProperty(key)) {
						el.attr(key, params[key]);
					}
				}
			} else {// HTML, #409
				for(key in params) {
					if(params.hasOwnProperty(key)) {
						params[key] += 'px';
					}
				}
				domStyle.set(el, params);
			}
		},

		adapterRun: function(el, method) {
			// summary:
			//		call the method of the element
			//		designed for jQuery -> node.width()
			// el: domNode
			//		The object .
			// method: String
			//		method of the object
			//console.log('Highcharts.Dojo.Adapter::adapterRun',el, method);
			var g = domGeometry.getMarginBox(el);
			switch(method) {
			case 'height':
				return g.h;
			case 'width':
				return g.w;
			}
		},

		washMouseEvent: function(e) {
			// summary:
			//		don't ask, just trust...
			return e;
		},

		animate: function(el, params, options) {
			// summary:
			//		motion makes things pretty. Can be disabled
			// el: Object
			//		The object to animate.
			// params: Object
			//		list of properties and value to animate
			// options: Object
			//		animation options
			//console.log('Highcharts.Dojo.Adapter::animate',el, params, options);
			_Adapter.setAdapterNs(el);

			// default options
			options = options || {};

			if(!_Adapter.useAnim) {
				_Adapter.setAttr(el, params);

				if(options.complete) {
					options.complete();
				}

			} else {
				var ns = _Adapter.getAdapterNs(el),
					properties = params;
				if(params.d) {
					//path animation handle
					properties = {
						M: {
							start: params.d[1],
							end: params.d[2]
						},
						L: {
							start: params.d[4],
							end: params.d[5]
						}
					};

				}
				ns.anim = new baseFx.Animation({
					duration: (options.duration || 500),
					beforeBegin: lang.hitch(_Adapter, 'onAnimBeforeBegin', el, properties),
					onEnd: lang.hitch(_Adapter, 'onAnimEnd', el, options.complete),
					onAnimate: lang.hitch(_Adapter, 'onAnimate', el)
				});
				ns.anim.play();
			}
		},
		onAnimBeforeBegin: function(el, properties) {
			// summary:
			//		Call before animation starts and calculate the curve of the animation
			// el: Object
			//		The object to animate.
			// properties: Object
			//		list of properties and value to animate
			//console.log('Highcharts.Dojo.Adapter::onAnimBeforeBegin',el, properties);
			_Adapter.setAdapterNs(el);
			var ns = _Adapter.getAdapterNs(el),
				pm = {},
				p,
				prop;

			for(p in properties) {
				if(properties.hasOwnProperty(p)) {
					// Make shallow copy of properties into pm because we overwrite
					// some values below. In particular if start/end are functions
					// we don't want to overwrite them or the functions won't be
					// called if the animation is reused.

					prop = properties[p];
					if(lang.isFunction(prop)) {
						prop = prop();
					}
					prop = pm[p] = lang.mixin({}, (lang.isObject(prop) ? prop : {
						end: prop
					}));

					if(p === 'y' && pm.height) {
						prop.start = pm.height.end + prop.end;
					}

					if(lang.isFunction(prop.start)) {
						prop.start = prop.start();
					}
					if(lang.isFunction(prop.end)) {
						prop.end = prop.end();
					}
					prop.start = prop.start ? parseFloat(prop.start) : 0;
				}
			}
			ns.anim.curve = new PropLine(pm);
		},
		onAnimEnd: function(el, callback) {
			// summary:
			//		Call after animation ends
			// el: Object
			//		The animated object.
			// callback: Function
			//		What to do next ?
			//console.log('Highcharts.Dojo.Adapter::onAnimEnd',el, callback);
			_Adapter.setAdapterNs(el);
			var ns = _Adapter.getAdapterNs(el);
			if(ns.signals.onAnimateSignal) {
				ns.signals.onAnimateSignal.remove();
			}
			delete ns.signalsonAnimateSignal;

			if(callback) {
				callback();
			}
		},
		onAnimate: function(el, value) {
			// summary:
			//		Call during each animation steps
			// el: Object
			//		The animated object.
			// value: Object || int
			//		New value to set
			//console.log('Highcharts.Dojo.Adapter::onAnimate', arguments);

			_Adapter.setAdapterNs(el);
			_Adapter.getAdapterNs(el);
			_Adapter.setAttr(el, value);

		},

		stop: function(el) {
			// summary:
			//		Stop the current animation
			// el: Object
			//		The animated object.
			//console.log('Highcharts.Dojo.Adapter::stop',el);

			_Adapter.setAdapterNs(el);
			_Adapter.onAnimEnd(el);
			var ns = _Adapter.getAdapterNs(el);
			if(ns.anim && ns.anim.stop) {
				ns.anim.stop();
			}
			ns.anim = null;

		},

		getScript: function(scriptLocation, callback) {
			// summary:
			//		Downloads a script and executes a callback when done.
			// scriptLocation: String
			//		Script URL
			// callback: Function
			//		callback to execute
			//console.log('Highcharts.Dojo.Adapter::getScript', scriptLocation, callback);
			var script = document.createElement('script');
			_Adapter._scriptSignals = [on(script, 'load', lang.hitch(_Adapter, 'onScriptLoaded', callback)), on(script, 'readystatechange', lang.hitch(_Adapter, 'onScriptLoaded', callback))];
			script.type = 'text/javascript';
			script.src = scriptLocation;
			win.body().appendChild(script);
		},
		onScriptLoaded: function(callback, e) {
			// summary:
			//		Downloads a script and executes a callback when done.
			// callback: Function
			//		callback to execute
			// e: Object
			//		Browser event
			//console.log('Highcharts.Dojo.Adapter::onScriptLoaded',e);
			var i;
			e = baseEvent.fix(e);
			if(sniff('ie') && e.target.readyState !== 'loaded' && e.target.readyState !== 'complete') {
				return;
			}
			for(i = 0; i < _Adapter._scriptSignals.length; i++) {
				_Adapter._scriptSignals[i].remove();
			}
			callback(e);
		},
		inArray: function(value, arr) {
			// summary:
			//		wrapper to inArray function
			// arr: Array
			//		Array for iteration
			// value: mixed
			//		Value to search for
			//console.log('Highcharts.Dojo.Adapter::inArray',value, arr);
			return array.indexOf(arr, value);
		},
		each: function(arr, fn) {
			// summary:
			//		wrapper to each function
			// arr: Array
			//		Array for iteration
			// fn: Function
			//		Function to apply
			//console.log('Highcharts.Dojo.Adapter::each',arr, fn);
			return array.forEach(arr, fn);
		},
		map: function(arr, fn) {
			// summary:
			//		wrapper to map function
			// arr: Array
			//		Array for iteration
			// fn: Function
			//		Function to apply
			//console.log('Highcharts.Dojo.Adapter::map',arr, fn);
			return array.map(arr, fn);
		},
		grep: function(arr, fn) {
			// summary:
			//		wrapper to filter function
			// arr: Array
			//		Array for iteration
			// fn: Function
			//		Function to apply
			//console.log('Highcharts.Dojo.Adapter::grep',arr, fn);
			return array.filter(arr, fn);
		},
		merge: function() {
			// summary:
			//		Deep merge two objects and return a third, need to Objects as arguments
			//console.log('Highcharts.Dojo.Adapter::merge', arguments);
			function doCopy(copy, original) {
				var value, key;

				for(key in original) {
					if(original.hasOwnProperty(key)) {
						value = original[key];
						if(value && typeof value === 'object' && value.constructor !== Array && typeof value.nodeType !== 'number') {
							copy[key] = doCopy(copy[key] || {}, value);
							// copy
						} else {
							copy[key] = original[key];
						}
					}
				}
				return copy;
			}

			function merge() {
				var args = arguments, i, retVal = {};
				for(i = 0; i < args.length; i++) {
					retVal = doCopy(retVal, args[i]);
				}
				return retVal;
			}
			return merge.apply(this, arguments);
		},
		offset: function(el) {
			// summary:
			//		Get the offset of an element relative to the top left corner of the web page
			// el: Object
			//		Object to get position
			//console.log('Highcharts.Dojo.Adapter::offset', el);

			var offsets = {
					x: 0,
					y: 0
				};

			if(el) {
				_Adapter.setAdapterNs(el);

				if(sniff('ie') < 9) {
					try {
						// Only check the native call. It will fail in certain cases
						el.getBoundingClientRect();
					} catch(e) {
						//FIXME: This error occures sometimes when the element is not in the dom (yet/anymore), giving an unspecified error in IE
						//I'm not fond of adding try catch, but there is no real solution, IE just freaks out - JWvM 2013-11-11
						console.warn('Hightock dojo-adapter-exception::offset Host element found (element not in Dom)');
						return {
							left: 0,
							top: 0
						};
					}
				}
				offsets = domGeometry.position(el, true);
			} else {
				console.warn('Hightock dojo-adapter-exception::offset(el) => el is null');
			}

			return {
				left: offsets.x,
				top: offsets.y
			};
		},
		addEvent: function(el, event, orgFn) {
			// summary:
			//		el needs an event to be attached. el is not necessarily a dom element
			// el: Object
			//		Object to add event
			// event: String
			//		Event name
			// fn: Function
			//		Function to call when firing event
			//console.log('Highcharts.Dojo.Adapter::addEvent', el, event, fn);
			_Adapter.setAdapterNs(el);

			//same problem as described here :
			//http://highslide.com/forum/viewtopic.php?f=9&t=13652&p=63495&hilit=pagex#p63495
			orgFn._signalId = _Adapter._id++;
			var fn = ~event.toLowerCase().indexOf('mouse') ? _Adapter.normalizeMouseEvent(orgFn) : orgFn;

			if(el.tagName || el === document) {
				event = ~event.indexOf('on') ? event.slice(2) : event;
				_Adapter.getAdapterNs(el).signals[orgFn._signalId] = on(el, event, fn);
			} else {
				_Adapter.getAdapterNs(el).signals[orgFn._signalId] = aspect.after(el, 'on' + event, fn, true);
			}
		},
		normalizeMouseEvent: function(fn) {
			// summary:
			//		normalize the vent to get pageX and pageY working
			//		ignore call with undefined event (How is it possible? Probably because it's not on a domNode ?)
			// fn: Function
			//		Function to call when firing event
			//console.log('Highcharts.Dojo.Adapter::normalizeMouseEvent', fn);
			return function(e) {
				if(e === undefined) {
					return;
				}
				domGeometry.normalizeEvent(e);
				fn(e);
			};
		},

		removeEvent: function(el, event, fn) {
			// summary:
			//		remove an event from el
			// el: Object
			//		Object to remove event
			// event: String
			//		Event name
			//console.log('Highcharts.Dojo.Adapter::removeEvent', el, event);
			_Adapter.setAdapterNs(el);
			var ns = _Adapter.getAdapterNs(el),
				i;

			if(event && fn && fn._signalId) {
				ns.signals[fn._signalId] && ns.signals[fn._signalId].remove && ns.signals[fn._signalId].remove();
				delete ns.signals[fn._signalId];
			} else {
				for(i in ns.signals) {
					if (ns.signals.hasOwnProperty(i)) {
						ns.signals[i].remove();
						delete ns.signals[i];
					}
				}
			}
		},
		fireEvent: function(el, event, eventArguments, defaultFunction) {
			// summary:
			//		fire an event based on an event name (event) and an object (el).
			//		again, el may not be a dom element
			// el: Object
			//		Event emiter
			// event: String
			//		Event name
			// eventArguments: Object
			//		arguments added to the event
			// defaultFunction: Function
			//		Function to execute in addition of the event
			//console.log('Highcharts.Dojo.Adapter::fireEvent', el, event, eventArguments, defaultFunction);
			_Adapter.setAdapterNs(el);

			var eventArgs = {
					type: event,
					target: el,
					bubbles: true,
					cancelable: true
				};
			lang.mixin(eventArgs, eventArguments);
			event = on.emit(el, event, eventArgs);

			if(eventArgs.defaultPrevented) {
				defaultFunction = null;
			}

			if(defaultFunction) {
				defaultFunction(eventArgs);
			}
		},
		isDescendant: function(/*Node*/node, /*String*/match) {
			// summary:
			//		Returns if an ancestor matches the query
			//
			// node: domNode
			//		The root node at which to perform the query
			//
			// match: string queryParameter
			//		The dojo/query selector to match
			//
			// returns:
			//		Boolean

			if(!node.parentNode) {
				console.error('dom::isDescendant failed because the node has no parent (is it attached to the dom?');
				return false;
			}

			var nodes = query(node).closest(match); //JSLint ignore: use_context_with_query
			if(nodes.length > 0) { return true; }

			//check if node itself machtes the query
			nodes = query(match, node.parentNode);
			return nodes.some(function(item) {
				return item === node;
			});
		},
	};
	//provide the adapter
	kernel.global.HighchartsAdapter = _Adapter;
});
