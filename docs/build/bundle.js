
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.30.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.30.0 */

    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i];
    	return child_ctx;
    }

    // (138:1) {#if state.kind === 'Started'}
    function create_if_block(ctx) {
    	let table;
    	let tr;
    	let th0;
    	let t1;
    	let th1;
    	let t3;
    	let th2;
    	let t5;
    	let th3;
    	let t7;
    	let each_value = /*state*/ ctx[1].value;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "IPA";
    			t1 = space();
    			th1 = element("th");
    			th1.textContent = "Word";
    			t3 = space();
    			th2 = element("th");
    			th2.textContent = "Breakdown";
    			t5 = space();
    			th3 = element("th");
    			th3.textContent = "Definition";
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(th0, file, 140, 4, 4168);
    			add_location(th1, file, 141, 4, 4185);
    			add_location(th2, file, 142, 4, 4203);
    			add_location(th3, file, 143, 4, 4226);
    			add_location(tr, file, 139, 3, 4159);
    			attr_dev(table, "class", "svelte-14o2egm");
    			add_location(table, file, 138, 2, 4148);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t1);
    			append_dev(tr, th1);
    			append_dev(tr, t3);
    			append_dev(tr, th2);
    			append_dev(tr, t5);
    			append_dev(tr, th3);
    			append_dev(table, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(table, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*breakdown, state*/ 2) {
    				each_value = /*state*/ ctx[1].value;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(table, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(138:1) {#if state.kind === 'Started'}",
    		ctx
    	});

    	return block;
    }

    // (153:38) 
    function create_if_block_2(ctx) {
    	let td0;
    	let t0_value = /*either*/ ctx[7].value.ipa + "";
    	let t0;
    	let t1;
    	let td1;
    	let a;
    	let t2_value = /*either*/ ctx[7].value.word + "";
    	let t2;
    	let a_href_value;
    	let t3;
    	let td2;
    	let t4_value = breakdown(/*either*/ ctx[7].value.word) + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = /*either*/ ctx[7].value.definitions[0] + "";
    	let t6;

    	const block = {
    		c: function create() {
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			a = element("a");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();
    			td3 = element("td");
    			t6 = text(t6_value);
    			attr_dev(td0, "class", "ipa svelte-14o2egm");
    			add_location(td0, file, 153, 5, 4515);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", a_href_value = "https://en.wiktionary.org/wiki/" + /*either*/ ctx[7].value.word);
    			add_location(a, file, 154, 22, 4577);
    			attr_dev(td1, "class", "word svelte-14o2egm");
    			add_location(td1, file, 154, 5, 4560);
    			attr_dev(td2, "class", "breakdown svelte-14o2egm");
    			add_location(td2, file, 155, 5, 4688);
    			add_location(td3, file, 156, 5, 4751);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td0, anchor);
    			append_dev(td0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, td1, anchor);
    			append_dev(td1, a);
    			append_dev(a, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, td2, anchor);
    			append_dev(td2, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, td3, anchor);
    			append_dev(td3, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*state*/ 2 && t0_value !== (t0_value = /*either*/ ctx[7].value.ipa + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*state*/ 2 && t2_value !== (t2_value = /*either*/ ctx[7].value.word + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*state*/ 2 && a_href_value !== (a_href_value = "https://en.wiktionary.org/wiki/" + /*either*/ ctx[7].value.word)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*state*/ 2 && t4_value !== (t4_value = breakdown(/*either*/ ctx[7].value.word) + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*state*/ 2 && t6_value !== (t6_value = /*either*/ ctx[7].value.definitions[0] + "")) set_data_dev(t6, t6_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(td1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(td2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(td3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(153:38) ",
    		ctx
    	});

    	return block;
    }

    // (148:4) {#if either.kind === 'Left'}
    function create_if_block_1(ctx) {
    	let td0;
    	let t0;
    	let td1;
    	let t1_value = /*either*/ ctx[7].value + "";
    	let t1;
    	let t2;
    	let td2;
    	let t3_value = breakdown(/*either*/ ctx[7].value) + "";
    	let t3;
    	let t4;
    	let td3;

    	const block = {
    		c: function create() {
    			td0 = element("td");
    			t0 = space();
    			td1 = element("td");
    			t1 = text(t1_value);
    			t2 = space();
    			td2 = element("td");
    			t3 = text(t3_value);
    			t4 = space();
    			td3 = element("td");
    			attr_dev(td0, "class", "ipa svelte-14o2egm");
    			add_location(td0, file, 148, 5, 4334);
    			attr_dev(td1, "class", "word svelte-14o2egm");
    			add_location(td1, file, 149, 5, 4361);
    			attr_dev(td2, "class", "breakdown svelte-14o2egm");
    			add_location(td2, file, 150, 5, 4403);
    			add_location(td3, file, 151, 5, 4461);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, td1, anchor);
    			append_dev(td1, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, td2, anchor);
    			append_dev(td2, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, td3, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*state*/ 2 && t1_value !== (t1_value = /*either*/ ctx[7].value + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*state*/ 2 && t3_value !== (t3_value = breakdown(/*either*/ ctx[7].value) + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(td1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(td2);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(td3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(148:4) {#if either.kind === 'Left'}",
    		ctx
    	});

    	return block;
    }

    // (146:3) {#each state.value as either}
    function create_each_block(ctx) {
    	let tr;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*either*/ ctx[7].kind === "Left") return create_if_block_1;
    		if (/*either*/ ctx[7].kind === "Right") return create_if_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			if (if_block) if_block.c();
    			t = space();
    			add_location(tr, file, 146, 3, 4291);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			if (if_block) if_block.m(tr, null);
    			append_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(tr, t);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(146:3) {#each state.value as either}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let textarea;
    	let t0;
    	let button;
    	let t1;
    	let button_disabled_value;
    	let t2;
    	let mounted;
    	let dispose;
    	let if_block = /*state*/ ctx[1].kind === "Started" && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			textarea = element("textarea");
    			t0 = space();
    			button = element("button");
    			t1 = text("Lookup");
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(textarea, "placeholder", "Paste a Khmer sentence here");
    			attr_dev(textarea, "class", "svelte-14o2egm");
    			add_location(textarea, file, 133, 1, 3941);
    			button.disabled = button_disabled_value = /*input*/ ctx[0].length === 0;
    			attr_dev(button, "class", "svelte-14o2egm");
    			add_location(button, file, 135, 1, 4026);
    			attr_dev(div0, "class", "container svelte-14o2egm");
    			add_location(div0, file, 132, 0, 3916);
    			attr_dev(div1, "class", "outer svelte-14o2egm");
    			add_location(div1, file, 131, 0, 3896);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, textarea);
    			set_input_value(textarea, /*input*/ ctx[0]);
    			append_dev(div0, t0);
    			append_dev(div0, button);
    			append_dev(button, t1);
    			append_dev(div0, t2);
    			if (if_block) if_block.m(div0, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[3]),
    					listen_dev(button, "click", /*click_handler*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*input*/ 1) {
    				set_input_value(textarea, /*input*/ ctx[0]);
    			}

    			if (dirty & /*input*/ 1 && button_disabled_value !== (button_disabled_value = /*input*/ ctx[0].length === 0)) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (/*state*/ ctx[1].kind === "Started") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function range(start, stop) {
    	let result = [];

    	for (let i = 0; i < stop - start; i++) {
    		result[i] = start + i;
    	}

    	return result;
    }

    function parse(word, rawWikiHtml) {
    	const dummy = document.createElement("div");
    	dummy.innerHTML = rawWikiHtml;
    	const maybeIPA = find(Array.from(dummy.querySelectorAll("span[class=\"IPA\"][lang=\"km\"]")).map(x => x.textContent), x => x.startsWith("/") && x.endsWith("/"));

    	if (maybeIPA.kind === "Nothing") {
    		return { kind: "Nothing" };
    	}

    	return {
    		kind: "Just",
    		value: {
    			word,
    			ipa: maybeIPA.value,
    			definitions: Array.from(dummy.querySelectorAll("ol > li")).map(x => x.textContent)
    		}
    	};
    }

    function apiLink(page) {
    	let target = new URL("https://en.wiktionary.org/w/api.php");

    	target.search = new URLSearchParams({
    			action: "parse",
    			format: "json",
    			origin: "*",
    			page
    		}).toString();

    	return target.toString();
    }

    function head(list) {
    	if (list.length === 0) {
    		return { kind: "Nothing" };
    	}

    	return { kind: "Just", value: list[0] };
    }

    function justs(list) {
    	let result = [];

    	for (let i = 0; i < list.length; i++) {
    		const maybe = list[i];

    		if (maybe.kind === "Just") {
    			result.push(maybe.value);
    		}
    	}

    	return result;
    }

    function left(value) {
    	return { kind: "Left", value };
    }

    function right(value) {
    	return { kind: "Right", value };
    }

    // Find the largest substrings of that produce a result B. Arrange in order with the substrings that return A
    function greedyChunking(str, f) {
    	if (str.length === 0) {
    		return Promise.resolve([]);
    	}

    	return firstMatchingString(str, f).then(maybe => {
    		if (maybe.kind === "Nothing") {
    			return [left(str)];
    		}

    		const [first, middle, last] = maybe.value;
    		return Promise.all([greedyChunking(first, f), greedyChunking(last, f)]).then(([newFirst, newLast]) => [...newFirst, right(middle), ...newLast]);
    	});
    }

    function firstMatchingString(str, f) {
    	const highToLow = range(2, str.length + 1).reverse();
    	const substrings = highToLow.flatMap(n => myLengthNSubstrings(str, n));

    	const promises = substrings.map(([first, middle, last]) => f(middle).then(maybe => {
    		if (maybe.kind === "Just") {
    			return {
    				kind: "Just",
    				value: [first, maybe.value, last]
    			};
    		} else {
    			return { kind: "Nothing" };
    		}
    	}));

    	return maybeFirstJust(promises);
    }

    function maybeFirstJust(array) {
    	return Promise.all(array).then(xs => head(justs(xs)));
    }

    function myLengthNSubstrings(str, n) {
    	const numberOfSubstrings = str.length - n + 1;
    	let result = new Array(numberOfSubstrings);

    	for (let i = 0; i < numberOfSubstrings; i++) {
    		result[i] = [
    			str.substring(0, i),
    			str.substring(i, i + n),
    			str.substring(i + n, str.length)
    		];
    	}

    	return result;
    }

    function find(list, predicate) {
    	for (let x of list) {
    		if (predicate(x)) {
    			return { kind: "Just", value: x };
    		}
    	}

    	return { kind: "Nothing" };
    }

    function breakdown(str) {
    	return range(0, str.length).map(i => str.charAt(i)).join(" + ");
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let input = "";
    	let cache = new Map();

    	function getKhmerWord(word) {
    		if (!cache.has(word)) {
    			cache.set(word, fetch(apiLink(word)).then(x => x.json()).then(x => {
    				if (!x.parse) return { kind: "Nothing" };
    				return parse(word, x.parse.text["*"]);
    			}));
    		}

    		return cache.get(word);
    	}

    	function findWords(khmerSentence) {
    		greedyChunking(khmerSentence, getKhmerWord).then(result => {
    			$$invalidate(1, state = { kind: "Started", value: result });
    		});
    	}

    	let state = { kind: "Not Started" };
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		input = this.value;
    		$$invalidate(0, input);
    	}

    	const click_handler = _ => findWords(input);

    	$$self.$capture_state = () => ({
    		input,
    		range,
    		parse,
    		apiLink,
    		cache,
    		getKhmerWord,
    		head,
    		justs,
    		left,
    		right,
    		greedyChunking,
    		firstMatchingString,
    		maybeFirstJust,
    		myLengthNSubstrings,
    		findWords,
    		state,
    		find,
    		breakdown
    	});

    	$$self.$inject_state = $$props => {
    		if ("input" in $$props) $$invalidate(0, input = $$props.input);
    		if ("cache" in $$props) cache = $$props.cache;
    		if ("state" in $$props) $$invalidate(1, state = $$props.state);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [input, state, findWords, textarea_input_handler, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
