/*

HETMULE

Ett litet js-bibliotek för single page applications utan ramverk och byggsteg.
Ladda filen med <script src="hetmule.js"></script> och använd allt via H.

- H.el, H.svg, H.mount, H.on   bygg dom och lyssna på händelser, utan innerHTML
- H.build, H.fill, H.get, H.set dom och text från data
- H.params, H.router            adressfältet och "sidor"
- H.request, H.poll, H.queue    hämta data, polla och räkna utan att låsa sidan
- H.debounce, H.fullscreen, H.download

Se README.md för exempel.

*/

window.H = (() => {

  'use strict';

  const SVG = 'http://www.w3.org/2000/svg';

  // Sätts som egenskaper, eftersom attributen bara anger startvärdet
  const PROPERTIES = ['value', 'checked', 'selected'];

  const isObject = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;


  // ── Dom ─────────────────────────────────────────────────────────────────────

  // Gör om barn till noder: listor plattas ut, null/undefined/false/true hoppas över, resten blir text
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

    // Barnen först, så att value på en select träffar rätt option
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

  // Byt ut {sökväg} mot värden ur data. Saknade värden lämnas kvar, så att felet syns.
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


  // ── Adressfältet ────────────────────────────────────────────────────────────

  // Listor blir upprepade nycklar, tomma värden hoppas över
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

      // Skriv om adressen utan att rita om, t.ex. när något i params har ändrats
      sync: () => history.replaceState(null, '', r.url(r.current))
    };

    async function show (page)
    {
      r.current = page;
      await render(page);
    }

    addEventListener('popstate', () => show(params()[param] || start));

    // Vanliga länkar till den här sidan, t.ex. <a href="?sida=om">, byter sida utan att ladda om
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


  // ── Nätverk och tid ─────────────────────────────────────────────────────────

  async function request (url, { method = 'GET', payload, as, bust, headers = {}, signal } = {})
  {
    let body = payload;
    if (isObject(payload) || Array.isArray(payload)) {
      body = JSON.stringify(payload);
      headers = { 'Content-Type': 'application/json', ...headers };
    }
    if (bust) url += (url.includes('?') ? '&' : '?') + 't=' + Date.now();

    const response = await fetch(url, { method, headers, body, signal, cache: bust ? 'no-store' : 'default' });
    if (!response.ok) throw Object.assign(new Error(method + ' ' + url + ' svarade ' + response.status), { response });

    // Formatet avgörs av as, annars av filändelsen och serverns Content-Type
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

  // Kör fn när man vill (check) eller med jämna mellanrum (start). onChange körs bara när svaret ändras.
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

      // Om en kontroll redan pågår startas ingen ny
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

  // Kör fn på varje post i portioner om några millisekunder, så att sidan går att använda under tiden
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


  // ── Övrigt ──────────────────────────────────────────────────────────────────

  return {

    // H.el('a', { href: '?sida=om', class: ['lank', aktiv && 'aktiv'], onclick: fn }, 'Text', annatElement)
    el: (tag, ...args) => create(null, tag, args),

    // Som H.el, i SVG-namnrymden
    svg: (tag, ...args) => create(SVG, tag, args),

    // Ersätt allt innehåll i target (element eller css-selektor)
    mount (target, ...children)
    {
      const node = find(target);
      node.replaceChildren(...nodes(children));
      return node;
    },

    // Lyssna på händelser för element som matchar selector, även sådana som skapas senare
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

    // Bygg dom från data, t.ex. ['ul', { class: 'lista' }, ['li', 'Hej {namn}']]
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

    // H.fullscreen() växlar, H.fullscreen(true/false) slår på/av
    async fullscreen (on = !document.fullscreenElement)
    {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    },

    // Ge användaren en fil att spara
    download (filename, content, type = 'text/plain;charset=utf-8')
    {
      const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
      create(null, 'a', [{ href: url, download: filename }]).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

})();
