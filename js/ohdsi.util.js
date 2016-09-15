/* ohdsi.util version 1.1.0
 *
 * Author: Chris Knoll (I think)
 *			AMD setup
 *			_pruneJSON
 *			dirtyFlag
 *
 * Author: Sigfried Gold
 *			getContainer
 *			d3AddIfNeeded
 *			D3Element
 *			shapePath
*				ResizableSvgContainer extends D3Element
*			  SvgLayout
*			  SvgElement
*			  ChartLabel extends SvgElement
*			  ChartLabelLeft extends ChartLabel
*			  ChartLabelBottom extends ChartLabel
*			  ChartAxis extends SvgElement
*			  ChartAxisY extends ChartAxis
*			  ChartAxisX extends ChartAxis
*			  ChartChart extends SvgElement
*			  ChartProps
*			  getState, setState, deleteState
*			  Field
*			  cachedAjax
*			  storagePut
*			  storageExists
*			  storageGet
*/
define(['jquery','knockout','lz-string', 'lodash-full'], function($,ko, LZString, _) {

	var DEBUG = true;
	
	var utilModule = { version: '1.0.0' };
	
	// private functions 	
	function _pruneJSON(key, value) {
		if (value === 0 || value) {
			return value;
		} else {
			return
		}
	}
	
	// END private functions
	
	// module functions
	function dirtyFlag(root, isInitiallyDirty) {
		var result = function () {},
			_initialState = ko.observable(ko.toJSON(root, _pruneJSON)),
			_isInitiallyDirty = ko.observable(isInitiallyDirty);

		result.isDirty = ko.pureComputed(function () {
			return _isInitiallyDirty() || _initialState() !== ko.toJSON(root, _pruneJSON);
		}).extend({
			rateLimit: 200
		});;

		result.reset = function () {
			_initialState(ko.toJSON(root, _pruneJSON));
			_isInitiallyDirty(false);
		};

		return result;
	}	

	/* getContainer
	 * call with css id (with or without #)
	 *				or dom node or d3 selection or jquery selection
	 *
	 * returns type requested ("dom", "d3", "jquery", "id")
	 */
	function getContainer(target, type = "dom") {
		if (target.selectAll) { // it's a d3 selection
			if (type === "d3") return target;
			return getContainer(target.node(), type); // call again with dom node
																						    // (first in selection, that is)
		}
		if (target.jquery) { // it's a jquery selection
			if (type === "jquery") return target;
			return getContainer(target[0], type); // call again with dom node
		}
		if (typeof target === "string") { // only works with ids for now, not other css selectors
			var id = target[0] === '#' ? target.slice(1) : target;
			var dom = document.getElementById(id);
			if (dom) return getContainer(dom, type); // call again with dom node
			throw new Error(`not a valid element id: ${target}`);
		}
		// target ought to be a dom node
		if (!target.tagName) {
			throw new Error(`invalid target`);
		}
		switch (type) {
			case "dom":
				return target;
			case "id":
				return target.getAttribute('id');
			case "d3":
				return d3.select(target);
			case "jquery":
				return $(target);
		}
		throw new Error(`invalid type: ${type}`);
	}
	/* d3AddIfNeeded
	 *	call with parent element (can be selector, dom, jquery or d3 item), 
	 *						data (scalar uses selection.datum(), array uses selection.data())
	 *						tag of element(s) to be appended to parent
	 *						array of class names 
	 *						callback to use on enter selection
	 *						callback to use for update
	 *						(could also add remove callback but don't have it yet)
	 *						and array of params to send to callbacks
	 * returns d3 selection with data appropriately attached
	 * warning: if your addCb appends further elements (or if you add more
	 *					using the returned selection, i think),
	 *					they will also have data appropriately attached, but that
	 *					data may end up stale for the updateCb if you call this again 
	 *					with new data unless you explicitly d3.select it
	 *					for example:
	 *					(is this really true? check before finishing example)
	 *
	 *					d3AddIfNeeded({parentElement: pdiv, 
	 *												 data: [1,2,3], // three items appended (if they
	 *												                // don't already exist) as children of pdiv
	 *												 tag: 'div',		// they are divs
	 *												 classes: [],
	 *												 addCb: function(el, params) {
	 *																	// each div will have an svg appended
	 *																	el.append('svg');
	 *															  },
	 *												 updateCb: function(el, params) {
	 *                                    // this will force new data to attach
	 *                                    // to previously appended svg
	 *                                    // if this d3AddIfNeeded is called
	 *                                    // a second time with new data
	 *																		el.select('svg');
	 *                                    // more selects may be necessary to propogate
	 *                                    // data to svg's children
	 *																	 },
	 *												 cbParams: []});
	 */
	function d3AddIfNeeded({parentElement, data, tag, classes=[], addCb=()=>{}, updateCb=()=>{}, 
												  cbParams} = {}) {
		var el = getContainer(parentElement, "d3");
		var selection = el.selectAll([tag].concat(classes).join('.'));
		if (Array.isArray(data)) {
			selection = selection.data(data);
		} else {
			selection = selection.data([data]);
			// might want this? : selection = selection.datum(data);
		}
		selection.exit().remove();
		selection.enter().append(tag)
				.each(function(d) {
					var newNode = d3.select(this);
					classes.forEach(cls => {
						newNode.classed(cls, true);
					});
				})
				.call(addCb, cbParams);
		selection = el.selectAll([tag].concat(classes).join('.'));
		selection.call(updateCb, cbParams);
		return selection;
	}
	/* D3Element
	 * this is an OO class to replace the d3AddIfNeeded function above
	 *
	 * making a new D3Element instance (el) will add <tag> elements to the
	 * parentElement using a D3 join to the data param. but if elements
	 * already exist, they elements will be appropriately joined to the
	 * data: extras will be removed (after running an exit callback if
	 * you specify one), entering items will be appended, and the update
	 * callback will be run on everything remaining after the join.
	 *
	 * you could also just say: el.data(newData); el.run(). that will
	 * also perform the appropriate join and run the callbacks.
	 *
	 * so you do not need to keep track of whether you've already created
	 * the elements. if you have and you still have a reference to the
	 * D3Element instance, el.data(d); el.run(); works. but calling the
	 * same code that created it originally and sending new data will
	 * work as well.
	 *
	 * if you also create child elements like:
	 *    var el = new D3Element(params);
	 *    el.addChild(params);
	 * then calling el.data(newData); el.run(); will not only update el,
	 * it will also rejoin and update its children with newData.
	 *
	 * var el = new D3Element({parentElement:p, 
	 *													data:arrOrObj, // data to be joined to selection
	 *																				 // if it's scalar, will be turned
	 *																				 // into single-item array
	 *													tag: 'div',		 // tag of element to be appended 
	 *																				 // if necessary to parent
	 *													classes: ['big','bright'], 
	 *																				 // to add to element
	 *																				 // should also insure that 
	 *																				 // parent.selectAll('tag.classes')
	 *																				 // only returns elements elements
	 *																				 // created here
	 *													enterCb: null, // only needed if you want to
	 *																				 // run extra code when el is
	 *																				 // first created
	 *												  exitCb: null,  // only needed if you want
	 *																				 // to run extra code (transition?)
	 *																				 // when el is removed
	 *												  cbParams: null,// will be passed to all callbacks
	 *																				 // along with d3 selection
	 *												  updateCb:			 // code to run on creation and
	 *																				 // after possible data changes
	 *																		function(selection, cbParams, updateOpts) {
	 *																			// updateOpts are set by calling
	 *																			// el.run(opts) or el.update(opts)
	 *																			// and they are sent to the updateCb not
	 *																			// just for the el in question, but to
	 *																			// all its children
	 *																			selection
	 *																				.attr('x', function(d) {
	 *																					return cbParams.scale(cbParams.xVal(d))
	 *																				})
	 *																		},
	 *													children: null,// k/v obj with child descriptors (need to document)
	 *																				 // should only allow children with explicite el.addChild
	 *													dataPropogationSelectors: null, // document when implemented
	 *												});
	 *
	 * el.run() returns the d3 selection after performing joins and running callbacks.
	 * you can also get the d3 selection with el.selectAll();
	 *
	 * there are many ways to add child elements (using the addChild method, using
	 * the d3 selection returned from run and selectAll methods, or in the add or
	 * update callbacks). I recommend:
	 *
	 *		add using el.addChild()
	 *		set attributes in the update callback
	 *		don't use the d3 selections at all
	 *		you probably don't need to do anything in the enterCb
	 *		(because that would probably mean creating some nested dom nodes
	 *		below the one you're adding, and then how would you access those?)
	 */
	function combineFuncs(funcs) {
		return (...args) => { return funcs.map(function(f) { return f.apply(this, args) }) }
	}
	class D3Element {
		constructor(props, transitionOpts) {
			this.parentElement = props.parentElement; // any form ok: d3, jq, dom, id
			this.el = getContainer(this.parentElement, "d3");
			this._data = Array.isArray(props.data) || typeof props.data === 'function'
										? props.data : [props.data];
			this.tag = props.tag;
			this.classes = props.classes || [];
			this.enterCb = props.enterCb || (()=>{});
			this.updateCb = props.updateCb || (()=>{});
			this.updateCbs = props.updateCbs || [this.updateCb]; // in case you want to run more than one callback on update
			this.updateCbsCombined = combineFuncs(this.updateCbs);
			this.exitCb = props.exitCb || (()=>{});
			this.cbParams = props.cbParams;
			this._children = {};
			this.dataPropogationSelectors = props.dataPropogationSelectors; // not implemented yet
			if (!props.stub)
				this.run(transitionOpts);
		}
		selectAll(data) {
		 var selection = this.el.selectAll([this.tag].concat(this.classes).join('.'));
		 if (data)
			 selection = selection.data(data);
		 //if (duration||delay) return selection.transition().delay(delay||0).duration(duration||0);
		 return selection;
		}
		as(type) {
			return getContainer(this.selectAll(), type);
		}
		data(data) {
			if (typeof data === "undefined")
				return this.selectAll().data();
			this._data = data;
			return this.selectAll(data);
		}
		run(opts={}, enter=true, exit=true, update=true) {
			// fix opts: split up data and transition
			var self = this;
			var data = opts.data || self._data;
			var selection = self.selectAll(data);

			var transitionOpts = _.omit(opts, ['data']); // delay, duration
			var {delay=0, duration=0} = transitionOpts;

			if (exit) {
				//if (selection.exit().size()) console.log(`exiting ${self.name}`);
				selection.exit()
						.transition()
						.delay(delay).duration(duration)
						.each(function(d) {
							_.each(self.children(), (c, name) => {
								self.child(name).exit(transitionOpts);
								// allow enter/update on children of exiting elements? probably no reason to
							});
						})
						.call(self.exitCb, self.cbParams, opts, self)
						.remove()
			}
			if (enter) {
				selection.enter()
						.append(self.tag)
							.each(function(d) { // add classes
								var newNode = d3.select(this);
								self.classes.forEach(cls => {
									newNode.classed(cls, true);
								});
							})
						.call(self.enterCb, self.cbParams, opts, self)
						.each(function(d) {
							// make children
							_.each(self.children(), (c, name) => {
								var child = self.makeChild(name, this, transitionOpts); // 'this' is the dom element we just appended
								child.enter();
								// allow exit/update on children of entering elements? probably no reason to
							});
						});
			}
			selection = self.selectAll(data);
			if (update) {
				selection
						.each(function(d) {
							_.each(self.children(), (c, name) => {
								self.child(name).run(transitionOpts, enter, exit, update);
								// data will be passed down to children don't override it with data from opts
							});
						})
						.call(self.updateCbsCombined, self.cbParams, opts, self)
			}
			return selection;
		}
		childDesc(name, desc) {
			if (desc)
				this._children[name] = {desc};
			else if (!this._children[name])
				throw new Error(`${name} child not created yet`);
			return this._children[name].desc;
		}
		child(name, el) {
			if (!this._children[name])
				throw new Error(`${name} child not created yet`);
			if (el)
				this._children[name].el = el;
			return this._children[name].el;
		}
		addChild(name, desc, transitionOpts) {
			this.childDesc(name, desc);
			return this.makeChild(name, this.selectAll(), transitionOpts);
		}
		// should we attempt to send selectAll options (for transition durations)
		// through addChild/makeChild? not doing this yet. but update calls will
		// send these options down the D3Element tree
		makeChild(name, parentElement, transitionOpts) {
			var desc = this.childDesc(name);
			var params = $.extend(
				{ parentElement,
					data: d=>[d],	// pass data down to child unless desc provides
											// its own data function
				}, desc);
			return this.child(name, new D3Element(params, transitionOpts));
			// it sort of doesn't matter because if you repeatedly create D3Elements
			// with the same parameters, d3 enter and exit selections will be empty
			// and update won't have a visible effect since data is the same,
			// but maybe if makeChild (or addChild) is called repeatedly with the
			// same exact parameters, we should avoid actually creating a new
			// D3Element instance
		}
		children() {
			return this._children;
		}
		implicitChild(selectorFunc) {
		}
		exit(opts) {
			return this.run(opts, false, true, false);
		}
		enter(opts) {
			return this.run(opts, true, false, false);
		}
		update(opts) {
			return this.run(opts, false, false, true);
		}
	}
	function shapePath(type, cx, cy, r) {
		// shape fits inside the radius
		var shapes = {
			circle: function(cx, cy, r) {
								// http://stackoverflow.com/questions/5737975/circle-drawing-with-svgs-arc-path
								return `
													M ${cx} ${cy}
													m -${r}, 0
													a ${r},${r} 0 1,0 ${r * 2},0
													a ${r},${r} 0 1,0 ${-r * 2},0
												`;
							},
			square: function(cx, cy, r) {
								var side = Math.sqrt(1/2) * r * 2;
								return `
													M ${cx} ${cy}
													m ${-side / 2} ${-side / 2}
													l ${side} 0
													l 0 ${side}
													l ${-side} 0
													z
												`;
							},
			triangle: function(cx, cy, r) {
								var side = r * Math.sqrt(3);
								var alt = r * 1.5;
								return `
													M ${cx} ${cy}
													m 0 ${-r}
													l ${side/2} ${alt}
													l ${-side} 0
													z
												`;
							},
		}
		if (type === "types")
			return _.keys(shapes);
		if (! (type in shapes)) throw new Error("unrecognized shape type");
		return shapes[type](cx, cy, r);
	}

	// svgSetup could probably be used for all jnj.charts; it works
	// (i believe) the way line chart and scatterplot were already working
	// (without the offscreen stuff, which I believe was not necessary).
	class ResizableSvgContainer extends D3Element {
		// call from chart obj like: 
		//	var divEl = svgSetup.call(this, data, target, w, h, ['zoom-scatter']);
		// target gets a new div, new div gets a new svg. div/svg will resize
		//	with consistent aspect ratio.
		// svgSetup can be called multiple times but will only create div/svg
		//	once. data will be attached to div and svg (for subsequent calls
		//	it may need to be propogated explicitly to svg children)
		// returns a D3Element
		// ( maybe shouldn't send data to this func, attach it later)
		constructor(target, data, w, h, divClasses=[], svgClasses=[], makeMany=false) {
			if (Array.isArray(data) && data.length > 1 && !makeMany) {
				data = [data];
			}
			function aspect() {
				return w / h;
			}
			super({
				parentElement: target,
				data, 
				tag:'div', 
				classes: divClasses, 
			})
			var divEl = this;
			var svgEl = divEl.addChild('svg', {
				tag: 'svg',
				classes: svgClasses,
				updateCb: function(selection, params, updateOpts, thisEl) {
					var targetWidth = divEl.divWidth();
					selection
						.attr('width', targetWidth)
						.attr('height', Math.round(targetWidth / aspect()))
						.attr('viewBox', '0 0 ' + w + ' ' + h);
				},
			});
			this.w = w;
			this.h = h;
			this.svgClasses = svgClasses;
			var resizeHandler = $(window).on("resize",
							() => svgEl.as('d3')
												.attr("width", this.divWidth())
												.attr("height", Math.round(this.divWidth() / aspect())));
			setTimeout(function () {
				$(window).trigger('resize');
			}, 0);
		}
		divWidth() {
			try {
				return this.as("jquery").width();
			} catch(e) {
				return this.w;
			}
		}
	}
	/*
	// svgSetup could probably be used for all jnj.charts; it works
	// (i believe) the way line chart and scatterplot were already working
	// (without the offscreen stuff, which I believe was not necessary).
	function svgSetup(target, data, w, h, divClasses=[], svgClasses=[]) {
			// call from chart obj like: 
			//	var divEl = svgSetup.call(this, data, target, w, h, ['zoom-scatter']);
			// target gets a new div, new div gets a new svg. div/svg will resize
			//	with consistent aspect ratio.
			// svgSetup can be called multiple times but will only create div/svg
			//	once. data will be attached to div and svg (for subsequent calls
			//	it may need to be propogated explicitly to svg children)
			// returns a D3Element
		// ( maybe shouldn't send data to this func, attach it later)
			this.container = this.container || getContainer(target, "dom");
			if (Array.isArray(data) && data.length > 1) {
				data = [data];
			}
			this.svgDivEl = new D3Element( {
							parentElement:this.container,
							data, tag:'div', classes: divClasses, 
			});
			var self = this;
			this.svgDivEl.addChild('svg',
										{
												tag: 'svg',
												classes: svgClasses,
												updateCb: function(selection, params, updateOpts) {
													try {
														var targetWidth = self.svgDivEl.as("jquery").width();
													} catch(e) {
														var targetWidth = w;
													}
													var aspect = w/h;
													console.log(targetWidth, aspect);
													selection
														//.attr('width', w)
														//.attr('height', h)
														.attr('width', targetWidth)
														.attr('height', Math.round(targetWidth / aspect))
														.attr('viewBox', '0 0 ' + w + ' ' + h);
												},
											});
			var resizeHandler = $(window).on("resize", {
					svgDivEl: this.svgDivEl,
					aspect: w / h
				},
				function (event) {
					// set svg to size of container div
					var targetWidth = event.data.svgDivEl.as("jquery").width();
					event.data.svgDivEl.child('svg').as("d3")
								.attr("width", targetWidth)
								.attr("height", Math.round(targetWidth / event.data.aspect));
				});

			setTimeout(function () {
				$(window).trigger('resize');
			}, 0);
			return this.svgDivEl;
	}
	*/


	/* SvgLayout class
	 * manages layout of subcomponents in zones of an svg
	 * initialize with layout like:
		 var layout = new SvgLayout(w, h,
					// zones:
					{
						top: { margin: { size: 5}, }, // top zone initialized with margin
																					// 5 pixels (or whatever units) high
						bottom: { margin: { size: 5}, },
						left: { margin: { size: 5}, },
						right: { margin: { size: 5}, },
					})
	 * add components to zones like one of these:
			
			// size is constant:
			layout.add('left','axisLabel', { size: 20 })

			// size returned by function:
			layout.add('left','axisLabel', { size: ()=>axisLabel.node().getBBox().width * 1.5 })

			// provide svg element to get size from (must specify 'width' or 'height' as dim)
			layout.add('left','axis', { obj: cp.y.axisG.node(), dim:'width' })

	 * retrieve dimensions of svg chart area (inside all zones):
			layout.svgWidth()
			layout.svgHeight()
	 * retrieve svg dimensions:
			layout.w()
			layout.h()
	 * retrieve total size of zone
			layout.zone('bottom')
	 * retrieve total size of one zone element
			layout.zone('left.margin')
	 * retrieve total size of more than one zone element
			layout.zone(['left.margin','left.axisLabel'])
	 * y position of bottom zone:
			layout.h() - layout.zone('bottom')
	 * 
	 * when adding zones, you can also include a position func that will
	 * do something based on the latest layout parameters
	 *
			var position = function(layout) {
				// positions element to x:left margin, y: middle of svg area
				axisLabel.attr("transform", 
					`translate(${layout.zone(["left.margin"])},
										 ${layout.zone(["top"]) + (h - layout.zone(["top","bottom"])) / 2})`);
			}
			layout.add('left','axisLabel', { size: 20 }, position: position)
	 *
	 * whenever you call layout.positionZones(), all registered position functions 
	 * will be called. the position funcs should position their subcomponent, but 
	 * shouldn't resize them (except they will, won't they? because, e.g.,
	 * the y axis needs to fit after the x axis grabs some of the vertical space.
	 * but as long as left and right regions don't change size horizontally and top
	 * and bottom don't change size vertically, only two rounds of positioning
	 * will be needed)
	 */
	class SvgLayout {
		constructor(w, h, zones) {
			this._w = w;
			this._h = h;
			['left','right','top','bottom'].forEach(
				zone => this[zone] = _.cloneDeep(zones[zone]));
			this.chart = {};
		}
		svgWidth() {
			return this._w - this.zone(['left','right']);
		}
		svgHeight() {
			return this._h - this.zone(['top','bottom']);
		}
		w() {
			return this._w;
		}
		h() {
			return this._h;
		}
		zone(zones) {
			zones = typeof zones === "string" ? [zones] : zones;
			var size = _.chain(zones)
									.map(zone=>{
										var zoneParts = zone.split(/\./);
										if (zoneParts.length === 1 && this[zoneParts]) {
											return _.values(this[zoneParts]);
										}
										if (zoneParts.length === 2 && this[zoneParts[0]][zoneParts[1]]) {
											return this[zoneParts[0]][zoneParts[1]];
										}
										throw new Error(`invalid zone: ${zone}`);
									})
									.flatten()
									.map(d=>{
												return d.obj ? d.obj.getBBox()[d.dim] : d3.functor(d.size)();
									})
									.sum()
									.value();
			//console.log(zones, size);
			return size;
		};
		add(zone, componentName, config) {
			return this[zone][componentName] = config;
		}
		positionZones() {
			return _.chain(this)
				.map(_.values)
				.compact()
				.flatten()
				.map('position')
				.compact()
				.each(position=>position(this))
				.value();
		}
	}
	/* SvgElement combines D3Element, SvgLayout, and ChartProps
	 * ChartProps is where configuration options for your chart
	 * are assembled. SvgElement is the place for code that
	 * generates common chart elements (axes, labels, etc.)
	 * So your chart code shouldn't have to worry about placement
	 * of these items (and readjusting placement of other items
	 * when the size of these changes). Chart code should just
	 * say what elements should be included and should (probably
	 * through chartProps) provide methods for generating their
	 * content.
	 *
	 * SvgElement will make a g as a child of the parent D3Element
	 * and then another element inside that (determined by the subclass).
	 *
	 * SvgElement is an abstract class. Subclasses should define
	 *	- zone: where they belong: top, bottom, left, right, center
	 *	- subzone: their (unique) name within their zone
	 *	- enterCb: to be passed to D3Element
	 *	- gEnterCb: enterCb for the g container
	 *	- updateContent: updateCb to be passed to D3Element
	 *	- updatePosition: updateCb to be passed to the g container
	 *	- sizedim: width or height. for determining this element's size
	 *	- size: optional func. by default size is sizedim of element's 
	 *			g's getBBox() 
	 *
	 * SvgElements are one per chart instance. Use them to make titles,
	 * axes, legends, etc. Not to make dots. The data they get is
	 * the chartProp
	 *
	 */
	class SvgElement {
		// assume it always gets a g and then something inside the g
		// the inside thing will be added in the subclass's _addContent
		// method which will include a line like this.gEl.addChild(...).
		// so making a new SvgElement means adding a child (g) and a
		// grandchild (whatever) to the parent D3Eelement
		constructor(d3El, layout, chartProp) {
			if (new.target === SvgElement) throw TypeError("new of abstract class SvgElement");
			this.parentEl = d3El;
			this.layout = layout;
			this.chartProp = chartProp;
			this.gEl = d3El.addChild(chartProp.name, 
											{ tag:'g', data:chartProp,
												classes: this.cssClasses(), // move to gEnterCb
																										// no, don't, will break D3Element
												enterCb: this.gEnterCb.bind(this),
												updateCb: this.updatePosition.bind(this),
												cbParams: {layout},
											});
			if (!this.emptyG()) {
				// if g is empty, don't use enterCb ot updateContent methods
				this.contentEl = this.gEl.addChild(chartProp.name, 
											{ tag: this.tagName(), 
												data:chartProp,
												classes: this.cssClasses(), // move to enterCb
												enterCb: this.enterCb.bind(this),
												updateCb: this.updateContent.bind(this),
												cbParams: {layout},
											});
			}

			layout.add(this.zone(), this.subzone(), 
								{ size:this.size.bind(this), 
									position:this.updatePosition.bind(this, this.gEl.as('d3'), {layout:this.layout}),
								});
		}
		enterCb() {}
		gEnterCb() {}
		updateContent() {}
		updatePosition() {}
		emptyG() {}
		size() {
			return this.gEl.as('dom').getBBox()[this.sizedim()];
		}
	}

	class ChartChart extends SvgElement {
		zone () { return 'chart'; }
		subzone () { return 'chart'; }
		cssClasses() { // classes needed on g element
			return [this.chartProp.cssClass];
		}
		gEnterCb(selection, params, opts) {
			selection.attr('clip-path','url(#clip)');
		}
		tagName() { return 'defs'; }
		enterCb(selection, params, opts) {
			selection.append("defs")
				.append("clipPath")
				.attr("id", "clip")
				.append("rect")
				.attr("width", this.layout.svgWidth())
				.attr("height", this.layout.svgHeight())
				.attr("x", 0)
				.attr("y", 0);
		}
		updatePosition(selection, params, opts) {
			selection
					.attr("transform", 
								`translate(${params.layout.zone(['left'])},${params.layout.zone(['top'])})`)
		}
	}
	class ChartLabel extends SvgElement {
		tagName() { return 'text'; }
	}
	class ChartLabelLeft extends ChartLabel {
		cssClasses() { // classes needed on g element
			return ['y-axislabel','axislabel'];
		}
		zone () { return 'left'; }
		subzone () { return 'axisLabel'; }
		sizedim() { return 'width'; }
		size() {
			return this.gEl.as('dom').getBBox().width * 1.5;
			// width is calculated as 1.5 * box height due to rotation anomolies 
			// that cause the y axis label to appear shifted.
		}
		updateContent(selection, params, opts) {
			selection
				.attr("transform", "rotate(-90)")
				.attr("y", 0)
				.attr("x", 0)
				.attr("dy", "1em")
				.style("text-anchor", "middle")
				.text(field => fieldAccessor(field, ['label','title','name'], 'Y Axis')())
		}
		updatePosition(selection, params, opts) {
			selection.attr('transform',
				`translate(${params.layout.zone(["left.margin"])},
										${params.layout.zone(["top"]) + (params.layout.h() - params.layout.zone(["top","bottom"])) / 2})`);
		}
	}
	class ChartLabelBottom extends ChartLabel {
		cssClasses() { // classes needed on g element
			return ['x-axislabel','axislabel'];
		}
		zone () { return 'bottom'; }
		subzone () { return 'axisLabel'; }
		sizedim() { return 'height'; }
		enterCb(selection, params, opts) {
			selection
				.style("text-anchor", "middle")
		}
		updateContent(selection, params, opts) {
			selection
				.text(field => fieldAccessor(field, ['label','title','name'], 'X Axis')())
		}
		updatePosition(selection, params, opts) {
			selection.attr('transform',
				`translate(${params.layout.w() / 2},${params.layout.h() - params.layout.zone(["bottom.margin"])})`);
		}
	}

	class ChartAxis extends SvgElement {
		//tagName() { return 'g'; }  // pretty bad. axes have an unneeded extra g
		emptyG() { return true; }
		gEnterCb(selection, params, opts) {
			this.axis = this.chartProp.axis || d3.svg.axis();
			// somewhat weird that scale belongs to chartProp and axis belongs to svgElement
		}
		updatePosition(selection, params, opts) {
			this.axis.scale(this.chartProp.scale)
								.tickFormat(this.chartProp.format)
								.ticks(this.chartProp.ticks)
								.orient(this.zone());
		}
	}
	class ChartAxisY extends ChartAxis {
		zone () { return 'left'; }
		subzone () { return 'axis'; }
		sizedim() { return 'width'; }
		cssClasses() { return ['y','axis']; } // classes needed on g element
		updatePosition(selection, params, opts) {
			this.chartProp.scale.range([params.layout.svgHeight(), 0]);
			super.updatePosition(selection, params, opts);
															// params.layout === this.layout (i think)
			selection
					.attr('transform',
								`translate(${params.layout.zone(['left'])},${params.layout.zone(['top'])})`)
			this.axis && selection.call(this.axis);
		}
	}
	class ChartAxisX extends ChartAxis {
		zone () { return 'bottom'; }
		subzone () { return 'axis'; }
		sizedim() { return 'height'; }
		updatePosition(selection, params, opts) {
			if (this.chartProp.tickFormat) { // check for custom tick formatter
				this.axis.tickFormat(this.chartProp.tickFormat); // otherwise uses chartProp.format above
			}
		}
		cssClasses() { // classes needed on g element
			return ['x','axis'];
		}
		updatePosition(selection, params, opts) {
			// if x scale is ordinal, then apply rangeRoundBands, else apply standard range
			if (typeof this.chartProp.scale.rangePoints === 'function') {
				this.chartProp.scale.rangePoints([0, params.layout.svgWidth()]);
			} else {
				this.chartProp.scale.range([0, params.layout.svgWidth()]);
			}
			super.updatePosition(selection, params, opts);
			selection
					.attr('transform', `translate(${params.layout.zone('left')},
																${params.layout.h() - params.layout.zone('bottom')})`);
			this.axis && selection.call(this.axis);
		}
	}
	/* ChartProps OBSOLETE, using _.merge now
	 * The chart class should have default options
	 * which can be overridden when instantiating the chart.
	 * All options are grouped into named chartProps, like:
	 * (For example defaults, see this.defaultOptions in module.zoomScatter.
	 *	For an example of explicit options, see function chartOptions() in sptest.js.)
	 *
				defaults = {
					x: {
								showAxis: true,
								showLabel: true,
								rangeFunc: layout => [0, layout.svgWidth()],
								format: module.util.formatSI(3),
								ticks: 10,
								needsLabel: true,
								needsValueFunc: true,
								needsScale: true,
					},...
				}
				explicit = {
					x: {
								value: d=>d.beforeMatchingStdDiff,
								label: "Before matching StdDiff",
								tooltipOrder: 1,
					},...
				}
	 *
	 * If a chart is expecting a label for some prop (like an axis
	 * label for the x axis or tooltip label for the x value), and
	 * no prop.label is specified, the prop name will be used (e.g., 'x').
	 * prop.label can be a function. If it's a string, it will be turned
	 * into a function returning that string. (So the chart needs to
	 * call it, not just print it.) Label generation will be done
	 * automatically if prop.needsLabel is true.
	 *
	 * If needsValueFunc is true for a prop, prop.value will be used.
	 * If prop.value hasn't been specified in default or explicit
	 * prop options, it will be be generated from the label. (Which is
	 * probably not what you want as it will give every data point's
	 * x value (for instance) as x's label.)
	 *
	 * If prop.value is a string or number, it will be transformed into
	 * an accessor function to extract a named property or indexed array
	 * value from a datum object or array.
	 *
	 * If prop.value is a function, it will be called with these arguments:
	 *		- datum (usually called 'd' in d3 callbacks)
	 *		- index of datum in selection data (i)
	 *		- index of data group (series) in parent selection (j)
	 *		- the whole ChartProps instance
	 *		- all of the data (not grouped into series)
	 *		- data for the series
	 *		- prop name (so you can get prop with chartProps[name])
	 *
	 * If prop.needsScale is true, prop.scale will be used (it will default
	 * to d3.scale.linear if not provided.) prop.domainFunc and prop.rangeFunc
	 * will be used to generate domain and range. If they are not provided
	 * they will be generated as functions returning prop.domain or prop.range 
	 * if those are provided. If neither prop.domainFunc nor prop.domain is
	 * provided, a domainFunc will be generated that returns the d3.extent
	 * of the prop.value function applied to all data items.
	 * If neither prop.rangeFunc nor prop.range is provided, an Error will be
	 * thrown.
	 *
	 * The domainFunc will be called with these arguments:
	 *		- the whole data array (not grouped into series)
	 *		- the array of series
	 *		- the whole ChartProps instance
	 *		- prop name
	 *
	 * The rangeFunc will be called with these arguments:
	 *		- the SvgLayout instance
	 *		- the chartProp
	 *		- the wholeChartProps instance
	 *		- prop name
	 * If rangeFunc returns nothing (or anything falsy), the range will not
	 * be set on prop.scale. This is important because for some scales you
	 * may want to do something other than set scale.range(). For instance:
	 *	prop.rangeFunc = function(layout, prop, props) {
	 *											prop.scale.rangePoints([0, layout.w()]);
	 *										}
	 * This function will not return a range to be passed to prop.scale.range
	 * but will call prop.scale.rangePoints() itself.
	 *
	 * Set all scale.domains by calling
	 *		cp.updateDomains(data, series)
	 *
	 * Set all scale.ranges by calling
	 *		cp.updateRanges(layout)
	 *
	 * Also, before drawing data points (and if data changes), you should call
	 *		cp.updateAccessors(data, series)
	 * This will assure that prop.value will be called with fresh data and series
	 * arguments.
	 *
	 * And:
	 *		cp.tooltipSetup(data, series)
	 * If prop.tooltipFunc is provided, it will be setup to receive the same
	 * arguments as prop.value. If not, a tooltipFunc will be generated that
	 * returns results from prop.label and prop.value. tooltipFunc is expected
	 * to return an object with a label property and a value property. 
	 * (What about formatting?)
	 * Tooltip content will only be generated for props where prop.tooltipOrder 
	 * is provided (it should be a non-zero number.)
	 */
	class ChartPropsJUNK {
		constructor(defaults, explicit) {
			//this.props = {};
			_.union(_.keys(defaults), _.keys(explicit)).forEach(name => {
								var prop = $.extend({}, defaults[name], explicit[name]);
								prop.name = name;
								prop.label = d3.functor(prop.label || name);
								if (prop.needsValueFunc) {
									prop.ac = new AccessorGenerator({
																	func: prop.value,
																	propName: (typeof prop.value === "string" || 
																						 isFinite(prop.value)) ? prop.value
																						 : name,
																	posParams: ['i', 'j', 'chartProps',
																							'data', 'series', 'chartPropName'],
																});
									prop.accessor = prop.ac.generate();
									/*
									if (typeof prop.value === "string" || isFinite(prop.value)) {
										prop.value = obj => obj[prop.value];
									} else if (!prop.value) {
										var label = prop.label || d3.functor(name);
										//prop.value = obj => (label in obj) ? obj[label] : label;
										prop.value = label;
									} else if (typeof prop.value === "function") {
									} else {
										throw new Error("can't figure out how to make value accessor");
									}
									prop._originalValueAccessor = prop.value;
									*/
									// add params to call below when data is known
								}
								if (prop.needsScale) { // if it needsScale, it must also needsValueFunc
									prop.scale = prop.scale || d3.scale.linear();
									// domainFunc should be called with args: data,series
									// domainFunc will receive args:
									//		data, series, props, propname
									prop.domainFunc = prop.domainFunc ||
																		prop.domain && d3.functor(prop.domain) ||
																		((data,series,props,name) => {
																			var localProp = props[name]; 
																			// can't remember why or if props[name] would
																			// be different from prop
																			localProp.ac.bindParam('chartProps', this);
																			localProp.ac.bindParam('data', data);
																			localProp.ac.bindParam('series', series);
																			localProp.ac.bindParam('chartPropName', name);
																			var accessor = localProp.ac.generate();
																			/*
																			return d3.extent(data.map(
																					_.partial(props[name]._originalValueAccessor, 
																							 _, _, _, // d, i, undefined,
																							this, data, series, name)))
																			*/
																			return d3.extent(data.map(accessor));
																		})
									//prop._origDomainFunc = prop.domainFunc;
									prop.rangeFunc = prop.rangeFunc ||
																		prop.range && d3.functor(prop.range) ||
																		function() {throw new Error(`no range for prop ${name}`)};
								}
								//this.props[name] = prop;
								this[name] = prop;
							});
			//this.d3dispatch = d3.dispatch.apply(null, _.union(defaults.dispatchEvents, explicit.additionalDispatchEvents));
		}
		updateDomains(data, series) {
			_.each(this, (prop, name) => {
											if (prop.needsScale) {
												prop.scale.domain(
													prop.domainFunc(data, series, this, name));
												// brushing may temporaryily change the scale domain
												// hold on to the domain as calculated from the data
												prop.domain = prop.scale.domain();
											}
										});
		}
		updateRanges(layout) {
			_.each(this, (prop, name) => {
											if (prop.needsScale) {
												var range = prop.rangeFunc(layout, this[name], this, name);
												if (range) {
													prop.scale.range(range)
													prop.range = range;
												}
											}
										});
		}
		updateAccessors(data, series) {
			_.each(this, (prop, name) => {
											if (prop.needsValueFunc) {
												/*
												prop.value = _.partial(prop._originalValueAccessor, 
																							 _, _, _, // d, i, j,
																							this, data, series, name);
												*/
												prop.ac.bindParam('chartProps', this);
												prop.ac.bindParam('data', data);
												prop.ac.bindParam('series', series);
												prop.ac.bindParam('chartPropName', name);
												prop.accessor = prop.ac.generate();
											}
										});
		}
		/*
		 * for value or tooltip functions that make use of aggregation over data or series
		 * there should be a way to perform the aggregation calculations only once
		 * rather than on every call to the value/tooltip func (actually, for tooltips
		 * it doesn't matter too much since only one point gets processed at a time)
		 */
		tooltipSetup(data, series) {
			this.tooltip = this.tooltip || { funcs: [] };
			this.tooltip.funcs = 
				_.chain(this)
					.filter('tooltipOrder')
					.sortBy('tooltipOrder')
					.map((prop) => {
						var func = prop.tooltipFunc ||
											 function(d,i,j) {
												 return {
													 value: prop.accessor(d,i,j),
													 name: prop.label(),
													 /*
													 value: _.partial(prop._originalValueAccessor, 
																	_, _, _, // d, i, j,
																	this, data, series, name)(d,i,j),
													 //name: prop.label(),
													 name: _.partial(prop.label, 
																	_, _, _, // d, i, j,
																	this, data, series, name)(d,i,j)
													*/
												 };
											 };
						return func;
					})
					.value();
			this.tooltip.builder = // not configurable but could be, but would be
														 // func that knows what to do with a bunch of funcs
				(d, i, j) => this.tooltip.funcs
													.map(func => func(d,i,j,this,data,series,name))
													.map(o => `${o.name}: ${o.value}<br/>`)
													.join('')
		}
	}


	/*
	 * fields are complex things that get used and accessed in different
	 * ways in different places. most simply a field might be 'age' in
	 * a recordset like:
	 *		[ {gender: 'F', age: 67, weight: 122, height: 65},
	 *			{gender: 'M', age: 12, weight: 84, height: 58} ]
	 *
	 * or a field could be derived, like, say:
	 *	bmi = d => convert(d.weight, 'lb', 'kg') / 
	 *							Math.pow(convert(d.height, 'in', 'm'), 2);
	 *
	 * but in addition to having a property name ('age') or accessor function
	 * (bmi) to extract a value from an object, fields may need names, labels
	 * for display in different contexts, functions for grouping and filtering
	 * values, and more.
	 *
	 * in a chart context, a field like 'age' might also be used as the chart
	 * attribute 'x'. in that case it will also need a way to compute domain:
	 *
	 *			d3.extent(dataset.map(d=>d.age))
	 *
	 * and range (which has nothing to do with age but is based on the pixel
	 * width of the chart).
	 *
	 * in a crossfilter context a field will be associated with a crossfilter
	 * dimension:   dim = cf.dimension(d=>d.age) 
	 * and possible filters: dim.filter([65, 90])
	 *
	 * in a faceted datatable context a field will need a grouping function, e.g.,
	 *
	 *			d => d <= 10 ? '0 - 10' :
	 *			     d <= 20 ? '11 - 20' : 'older than 20';
	 *
	 * and maybe a way of keeping track of or reporting which facet members are
	 * selected
	 *
	 * in a component that displays, say, a scatterplot and an associated datatable
	 * 'age' as a continuous value may serve as 'x' in the scatterplot and a column
	 * in the datatable, and as a grouped value may serve as a facet for the datatable.
	 * should the continuous age and the grouped age be considered the same field?
	 * i'm not sure. probably not.
	 *
	 * in a data-specific component (say a demographics browser) the age field may
	 * be referenced explicitly, but from the point of view of the scatterplot
	 * it will just be thought of as the 'x' field (while probably needing to know
	 * that it is called both 'x' and 'Age' for display in the legend or tooltips.
	 *
	 * what if the tooltip wants to report age as a percentile? it will need access
	 * not only to the age a specific datapoint, but also the ages of all the other
	 * datapoints.
	 *
	 * the purpose of the Field class is to allow fields to be configured in a
	 * simple, intuitive manner, while allowing code and components that use
	 * fields and datasets to get what they need without requiring redundant and
	 * idiosyncratic configuration. (e.g., datatable currently requires a 'caption'
	 * property for facet names and a 'title' property for column headings, while
	 * scatterplot's legend wants a 'label' property and all three of these should
	 * contain the same string for certain fields.)
	 *
	 *
	 * further thoughts:
	 *
	 * fields should have a single data accessor function?
	 *
	 * but domain and tooltip functions are also accessors, though they will
	 * depend on the main accessor function. same with grouping funcs.
	 *
	 * maybe: every field needs either a propName or accessor
	 *				accessor will be generated from propName if doesn't exist
	 *				every field needs a label, but can have labels for more than one
	 *				context
	 *
	 */
	class Field {
		constructor(name, opts = {}, allFields) {
			this.name = name;
			_.extend(this, opts);

			/*
			(this.requiredOptions || []).forEach(opt => {
				if (!_.has(this, opt))
					throw new Error(`expected ${opt} in ${this.name} Field options`);
			});
			*/
			var defaultAccessors = {
				value: {
					func: dataAccessor(this, ['value', 'propName', 'defaultValue']),
					posParams: ['d'],
				},
				label: {
					func: fieldAccessor(this, ['label']),
				},
			};
			this._accessors = _.merge(defaultAccessors, this._accessors);

			if (this.needsScale) {
				this.scale = this.scale || d3.scale.linear();
				this._accessors.domain = this._accessors.domain || {
					func: (data) => {
						return d3.extent(data.map(this.accessors.value));
					},
					//func: (data) => d3.extent(data.map(this.accessors.value)),
					posParams: ['data']
				};
				if (!this._accessors.range)
					throw new Error(`no range for prop ${name}`);
			}
			if (typeof this.tooltipOrder !== "undefined" || this.tooltip) {
				this._accessors.tooltip = this._accessors.tooltip || {
					func: (d) => {
						return {
							name: this.accessors.label(),
							value: this.accessors.value(d),
						};
					},
					posParams: ['d']
				};
			}
			this.possibleBindings = this.possibleBindings || allFields.availableDatapointBindings;

			_.each(this._accessors, (acc,name) => {
				if (_.difference(acc.posParams, this.possibleBindings).length ||
						_.difference(acc.namedParams, this.possibleBindings).length)
					throw new Error(`${this.name} accessor requested an unavailable binding`);
				acc.accGen = new AccessorGenerator(acc);
			});

			this.allFields = allFields;
		}
		get accessors() {
			return this.__accessors;
		}
		bindParams(params) {
			this.__accessors = {};
			_.each(this._accessors, (acc,name) => {
				acc.accGen.bindParams(params);
				acc.accessor = acc.accGen.generate();
				this.__accessors[name] = acc.accessor;
				//this[name] = acc.accessor;
			});
			if (this.needsScale) {
				this.scale.domain(this.accessors.domain());
				this.scale.range(this.accessors.range());
			}
		}
	}
	/*
	class ProxyField { // good idea but hard to implement
		constructor(name, opts = {}, proxyFor, allFields) {
			this.parentField = new Field(name, opts, allFields);
			this.baseField = proxyFor;
		}
	}
	*/

	/*
		* for value or tooltip functions that make use of aggregation over data or series
		* there should be a way to perform the aggregation calculations only once
		* rather than on every call to the value/tooltip func (actually, for tooltips
		* it doesn't matter too much since only one point gets processed at a time)
		*/
	function tooltipBuilderForFields(fields) {
		var accessors = _.chain(fields)
									.filter(field=>field.accessors.tooltip)
									.sortBy('tooltipOrder')
									.map((field) => field.accessors.tooltip)
									.value();
		return (d, i, j) => {
													return (accessors
																		.map(func => func(d,i,j))
																		.map(o => `${o.name}: ${o.value}<br/>`)
																		.join(''))
												};
	}
	function fishForProp(field, propNames, defaultVal) {
		propNames = Array.isArray(propNames) ? propNames : [propNames];
		// get first propName that appears in the field
		var propName = _.find(propNames, propName => _.has(field, propName)); 
		var propVal = field[propName];

		if (typeof propVal === "undefined")
			propVal = defaultVal || _.first(propNames);

		return propVal;
	}
	function fieldAccessor(field, propNames, defaultVal) {
		var propVal = fishForProp(field, propNames, defaultVal);
		if (typeof propVal === "function") {
			return propVal;
		}
		return () => propVal;
	}
	function dataAccessor(field, propNames, defaultFunc) {
		var propVal = fishForProp(field, propNames, defaultFunc);
		if (typeof propVal === "function") {
			return propVal;
		}
		if (typeof propVal === "string" || isFinite(propVal)) {
			return d => d[propVal];
		}
		throw new Error("can't find what you want");
	}

	/*	@class AccessorGenerator
   *	@param {string} [propName] key of property to extract
   *	@param {function} [func] to be called with record obj to return value
   *	@param {string} [thisArg] object to set as *this* for func
   *	@param {string[]} [posParams] list of positioned parameters of func
	 *																(except first param, which is assumed to be
	 *																 the record object)
   *	@param {string[]} [namedParams] list of named parameters of func
   *	@param {object} [bindValues] values to bind to parameters (this can also
	 *																	be done later)
	 */
	class AccessorGenerator {
		constructor({propName, func, posParams, namedParams, thisArg, bindValues} = {}) {
			if (typeof func === "function") {
				this.plainAccessor = func;
			} else if (typeof propName === "string") {
				this.plainAccessor = d => d[propName];
			} else {
				throw new Error("must specify func function or propName string");
			}
			this.posParams = posParams || [];
			this.namedParams = namedParams || [];
			this.boundParams = bindValues || {};
			this.thisArg = thisArg || null;
		}
		/* @method generate
		 */
		generate() {
			var pos = this.posParams.map(
				p => _.has(this.boundParams, p) ? this.boundParams[p] : _);
			var named = _.pick(this.boundParams, this.namedParams);
			return _.bind.apply(_, [this.plainAccessor, this.thisArg].concat(pos, named));
			// first arg of apply, _, is context for _.bind (https://lodash.com/docs#bind)
			// then bind gets passed: accessor func, thisArg, posParams, 
			// and (as final arg) namedParams
		}
		/* @method bindParam
		 * @param {string} paramName
		 * @param {string} paramValue
		 */
		bindParam(paramName, paramValue) {
			this.boundParams[paramName] = paramValue;
		}
		bindParams(params) {
			_.each(params, (val, name) => this.bindParam(name, val));
		}
	}

	
	// these functions associate state with a compressed stringified
	// object in the querystring
	function getState(path) {
		var state = _getState();
		if (typeof path === "undefined" || path === null || !path.length)
			return state;
		return _.get(state, path);
	}
	function deleteState(path) {
		var state = _getState();
		_.unset(state, path);
		_setState(state);
	}
	function setState(path, val) {
		if (typeof val === "undefined") {
			val = path;
			_setState(val);
			return;
		}
		var state = _getState();
		/*
		_.set(state, path, val);
		that didn't work because:
			_.set({}, 'foo.5', true)  => {"foo":[null,null,null,null,null,true]}
		but:
			_.setWith({}, 'foo.5', true, Object)  => {"foo":{"5":true}}
		*/
		_.setWith(state, path, val, Object);
		_setState(state);
	}
	function _setState(state) {
			var stateStr = JSON.stringify(state);
			var compressed = LZString.compressToBase64(stateStr);
			var hash = location.hash.startsWith('#') ? location.hash : '#';
			var h = hash.replace(/\?.*/, '');
			location.hash = h + '?' + compressed;
	}
	function _getState() {
		if (!location.hash.length)
			return {};

		var hashparts = location.hash.substr(1).split(/\?/);
		//var state = { hashpath: hashparts[0] }; // do we want this for anything?
		var state = { };
		if (hashparts.length > 1) {
			var compressedStateStr = hashparts[1];
			var stateStr = LZString.decompressFromBase64(compressedStateStr);
			var s = stateStr ? JSON.parse(stateStr) : {};
			_.extend(state, s);
		}
		return state;
	}
	class Filter {
		constructor(name, type, val) {
			this.name = name;
		}
	}
	class CrossfilterFilter {
		constructor(name, {dimension, accessor, filter, crossfilter} = {}) {
			this.name = name;
			this.dimension = dimension;
			this.accessor = accessor;
			this.filter = filter;
			this.crossfilter = crossfilter;
		}
	}
	//var ajaxCache = {}; // only save till reload
	//var ajaxCache = localStorage; // save indefinitely
	var ajaxCache = sessionStorage; // save for session
	function cachedAjax(opts) {
		var key = JSON.stringify(opts);
		if (!storageExists(key, ajaxCache)) {
			var ajax = $.ajax(opts);
			ajax.then(function(results) {
				storagePut(key, results, ajaxCache);
			});
			return ajax;
		} else {
			var results = storageGet(key, ajaxCache);
			var deferred = $.Deferred();
			if (opts.success) {
				opts.success(results);
			}
			deferred.resolve(results);
			return deferred;
		}
	}
	function storagePut(key, val, store = sessionStorage) {
		store[key] = LZString.compressToBase64(JSON.stringify(val));
	}
	function storageExists(key, store = sessionStorage) {
		return _.has(store, key);
	}
	function storageGet(key, store = sessionStorage) {
		return JSON.parse(LZString.decompressFromBase64(store[key]));
	}

	// END module functions
	
	utilModule.dirtyFlag = dirtyFlag;
	utilModule.d3AddIfNeeded = d3AddIfNeeded;
	utilModule.getContainer = getContainer;
	utilModule.D3Element = D3Element;
	utilModule.shapePath = shapePath;
	utilModule.ResizableSvgContainer = ResizableSvgContainer;
	utilModule.SvgLayout = SvgLayout;
	utilModule.SvgElement = SvgElement;
	utilModule.ChartChart = ChartChart;
	utilModule.ChartLabel = ChartLabel;
	utilModule.ChartLabelLeft = ChartLabelLeft;
	utilModule.ChartLabelBottom = ChartLabelBottom;
	utilModule.ChartAxis = ChartAxis;
	utilModule.ChartAxisY = ChartAxisY;
	utilModule.ChartAxisX = ChartAxisX;
	//utilModule.ChartProps = ChartProps;
	utilModule.AccessorGenerator = AccessorGenerator;
	utilModule.getState = getState;
	utilModule.setState = setState;
	utilModule.deleteState = deleteState;
	utilModule.Field = Field;
	utilModule.tooltipBuilderForFields = tooltipBuilderForFields;
	utilModule.cachedAjax = cachedAjax;
	utilModule.storagePut = storagePut;
	utilModule.storageExists = storageExists;
	utilModule.storageGet = storageGet;
	
	if (DEBUG) {
		window.util = utilModule;
	}
	return utilModule;
	
});
