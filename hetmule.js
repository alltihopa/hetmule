/*

HETMULE

A small js library for single page applications, without frameworks or build steps.
Load it with <script src="hetmule.js"></script> and use everything through H.

- H.el, H.svg, H.mount, H.on   build dom and listen to events, without innerHTML
- H.build, H.fill, H.get, H.set dom and text from data
- H.params, H.router            the address bar and "pages"
- H.request, H.poll, H.queue    fetch data, poll and compute without freezing the page
- H.debounce, H.fullscreen, H.download

See README.md for examples.

*/

window.H = (() => {

  'use strict';

  const SVG = 'http://www.w3.org/2000/svg';

  // Set as properties, since the attributes only hold the initial value
  const PROPERTIES = ['value', 'checked', 'selected'];

  const isObject = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;


  // ── Dom ─────────────────────────────────────────────────────────────────────

  // Turn children into nodes: arrays are flattened, null/undefined/false/true are skipped, the rest becomes text
  function nodes (children)
  {
    return children.flat(Infinity)
      .filter(c => c !== null && c !== undefined && c !== false && c !== true)
      .map(c => c instanceof Node ? c : document.createTextNode(c));
  }

  function create (ns, tag, args)
  {
    const props = isObject(args[0]) ? args.shift() : {};
    const node = ns ? document.createElementNS(ns, tag) : document.createElement(tag);

    // Children first, so that value on a select picks the right option
    node.append(...nodes(args));

    for (const [key, value] of Object.entries(props)) {
      if (key === 'class') {
        const classes = [].concat(value).filter(Boolean).join(' ');
        if (classes) node.setAttribute('class', classes);
      } else if (key === 'style' && isObject(value)) {
        for (const [k, v] of Object.entries(value)) {
          if (v !== null && v !== undefined && v !== false) node.style.setProperty(k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), v);
        }
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (PROPERTIES.includes(key) && !ns) {
        node[key] = value;
      } else if (value !== false && value !== null && value !== undefined) {
        node.setAttribute(key, value === true ? '' : value);
      }
    }

    return node;
  }

  function find (target)
  {
    return typeof target === 'string' ? document.querySelector(target) : target;
  }


  // ── Data ────────────────────────────────────────────────────────────────────

  function get (obj, path, fallback)
  {
    const value = String(path).split('.').reduce((o, key) => (o === null || o === undefined ? undefined : o[key]), obj);
    return value === undefined ? fallback : value;
  }

  // Replace {path} with values from data. Missing values are left in place, so the mistake is visible.
  function fill (template, data)
  {
    return String(template).replace(/\{([^{}\s]+)\}/g, (match, path) => {
      const value = get(data, path);
      return value === undefined || value === null ? match : value;
    });
  }

  function build (spec, data, ns = null)
  {
    if (spec === null || spec === undefined || spec === false) return null;
    if (!Array.isArray(spec)) return data ? fill(spec, data) : String(spec);
    if (typeof spec[0] !== 'string') return spec.map(s => build(s, data, ns));

    const [tag, ...rest] = spec;
    const props = isObject(rest[0]) ? { ...rest.shift() } : {};
    if (data) for (const key in props) if (typeof props[key] === 'string') props[key] = fill(props[key], data);

    const childNs = tag === 'svg' ? SVG : tag === 'foreignObject' ? null : ns;
    return create(tag === 'svg' ? SVG : ns, tag, [props, ...rest.map(c => build(c, data, childNs))]);
  }


  // ── Address bar ─────────────────────────────────────────────────────────────

  // Arrays become repeated keys, empty values are skipped
  function query (values)
  {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      for (const v of [].concat(value)) {
        if (v !== null && v !== undefined && v !== false && v !== '') params.append(key, v === true ? 1 : v);
      }
    }
    const text = params.toString();
    return location.pathname + (text ? '?' + text : '');
  }

  function params (values, push = false)
  {
    if (values) {
      history[push ? 'pushState' : 'replaceState'](null, '', query(values));
      return values;
    }
    const result = {};
    for (const [key, value] of new URLSearchParams(location.search)) {
      result[key] = key in result ? [].concat(result[key], value) : value;
    }
    return result;
  }

  function router ({ param = 'page', start, render, params: extra = () => ({}) })
  {
    const r = {
      current: null,

      url: page => query({ [param]: page, ...extra(page) }),

      async go (page, replace = false)
      {
        history[replace ? 'replaceState' : 'pushState'](null, '', r.url(page));
        await show(page);
        if (!replace) scrollTo(0, 0);
      },

      // Rewrite the address without rendering, e.g. when something in params has changed
      sync: () => history.replaceState(null, '', r.url(r.current))
    };

    async function show (page)
    {
      r.current = page;
      await render(page);
    }

    addEventListener('popstate', () => show(params()[param] || start));

    // Plain links to this page, e.g. <a href="?page=about">, switch page without reloading
    document.addEventListener('click', event => {
      const a = event.target.closest('a[href]');
      if (!a || a.target || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.searchParams.has(param)) return;
      event.preventDefault();
      r.go(url.searchParams.get(param));
    });

    r.go(params()[param] || start, true);
    return r;
  }


  // ── Network and time ────────────────────────────────────────────────────────

  async function request (url, { method = 'GET', payload, as, bust, headers = {}, signal } = {})
  {
    let body = payload;
    if (isObject(payload) || Array.isArray(payload)) {
      body = JSON.stringify(payload);
      headers = { 'Content-Type': 'application/json', ...headers };
    }
    if (bust) url += (url.includes('?') ? '&' : '?') + 't=' + Date.now();

    const response = await fetch(url, { method, headers, body, signal, cache: bust ? 'no-store' : 'default' });
    if (!response.ok) throw Object.assign(new Error(method + ' ' + url + ' responded ' + response.status), { response });

    // The format is decided by as, otherwise by the file extension and the server's Content-Type
    const type = response.headers.get('Content-Type') || '';
    as = as || (method === 'HEAD' ? 'response'
      : /\.ya?ml(\?|$)/i.test(url) || type.includes('yaml') ? 'yaml'
      : type.includes('json') ? 'json'
      : 'text');

    if (as === 'response') return response;
    const text = await response.text();
    if (as === 'json') return text ? JSON.parse(text) : null;
    if (as === 'yaml') return jsyaml.load(text);
    return text;
  }

  // Run fn on demand (check) or at intervals (start). onChange only runs when the result changes.
  function poll (fn, { every = 30000, onChange, onError = console.error } = {})
  {
    let timer = null, inflight = null, last, lastKey;

    async function run ()
    {
      try {
        const value = await fn();
        const key = JSON.stringify(value);
        if (key === lastKey) return false;
        const previous = last;
        last = value;
        lastKey = key;
        if (onChange) await onChange(value, previous);
        return true;
      } catch (error) {
        onError(error);
        return false;
      }
    }

    const p = {
      get running () { return timer !== null; },

      // If a check is already running, no new one is started
      check: () => inflight || (inflight = run().finally(() => { inflight = null; })),

      start ()
      {
        timer = timer || setInterval(p.check, every);
        return p;
      },

      stop ()
      {
        clearInterval(timer);
        timer = null;
        return p;
      }
    };

    return p;
  }

  // Run fn on every item in slices of a few milliseconds, so the page stays usable meanwhile
  function queue (items, fn, { onProgress, signal } = {})
  {
    const list = Array.from(items);
    const results = [];

    return new Promise((resolve, reject) => {
      (function step () {
        if (signal && signal.aborted) return reject(signal.reason);
        const until = Date.now() + 12;
        try {
          while (results.length < list.length && Date.now() < until) {
            results.push(fn(list[results.length], results.length));
          }
        } catch (error) {
          return reject(error);
        }
        if (onProgress) onProgress(results.length, list.length);
        if (results.length < list.length) setTimeout(step);
        else resolve(results);
      })();
    });
  }

  function debounce (fn, ms = 200)
  {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }


  // ── Public API ──────────────────────────────────────────────────────────────

  return {

    // H.el('a', { href: '?page=about', class: ['link', active && 'active'], onclick: fn }, 'Text', otherElement)
    el: (tag, ...args) => create(null, tag, args),

    // Like H.el, in the SVG namespace
    svg: (tag, ...args) => create(SVG, tag, args),

    // Replace all content of target (element or css selector)
    mount (target, ...children)
    {
      const node = find(target);
      node.replaceChildren(...nodes(children));
      return node;
    },

    // Listen to events on elements matching selector, including ones created later
    on (root, type, selector, fn)
    {
      const node = find(root);
      const listener = event => {
        const match = event.target.closest(selector);
        if (match && node.contains(match)) fn(event, match);
      };
      node.addEventListener(type, listener);
      return () => node.removeEventListener(type, listener);
    },

    // Build dom from data, e.g. ['ul', { class: 'list' }, ['li', 'Hello {name}']]
    build: (spec, data) => build(spec, data),

    fill,
    get,

    set (obj, path, value)
    {
      const keys = String(path).split('.');
      const last = keys.pop();
      let o = obj;
      for (const key of keys) o = (o[key] !== null && typeof o[key] === 'object') ? o[key] : (o[key] = {});
      o[last] = value;
      return obj;
    },

    params,
    router,
    request,
    poll,
    queue,
    debounce,

    // H.fullscreen() toggles, H.fullscreen(true/false) turns it on/off
    async fullscreen (on = !document.fullscreenElement)
    {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    },

    // Give the user a file to save
    download (filename, content, type = 'text/plain;charset=utf-8')
    {
      const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
      create(null, 'a', [{ href: url, download: filename }]).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

})();
