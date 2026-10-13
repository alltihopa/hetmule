# Hetmule.js

A small js library for single page applications, without frameworks or build steps. One file, no dependencies.

```html
<script src="hetmule.js"></script>
<script src="app.js"></script>
```

Everything lives in the global object `H`.

| Need | Function |
|---|---|
| Build dom without `innerHTML` | `H.el`, `H.svg`, `H.mount`, `H.on` |
| Dom and text from data (json/yaml) | `H.build`, `H.fill`, `H.get`, `H.set` |
| The address bar and pages | `H.params`, `H.router` |
| Fetch data, poll and heavy computations | `H.request`, `H.poll`, `H.queue` |
| Other | `H.debounce`, `H.fullscreen`, `H.download` |

The tests are in `test/index.html`. Open the page through a web server, e.g. MAMP: http://localhost:8888/hetmule/test/ (the network tests are skipped if the page is opened as a file).

---

## Dom

### `H.el(tag, props?, ...children)`

```js
const button = H.el('button', {
  class: ['button', active && 'active'],  // string or array, falsy values are skipped
  style: { color: 'red', '--width': '3px' },
  'data-id': row.id,                      // everything else becomes an attribute, named as in html
  disabled: !row.editable,                // true = the attribute is set, false = it is not
  onclick: () => save(row),               // functions on on… become event listeners
}, 'Save ', H.el('small', row.name));
```

Children can be elements, strings, numbers or arrays. `null`, `undefined` and `false` are skipped, so conditions and `map` work directly:

```js
H.el('ul', rows.map(r => H.el('li', r.name)), empty && H.el('li', 'No results'))
```

Strings always become text, never html. Data from users or servers can't sneak in html. That also makes it safe to build text with a template string:

```js
H.mount('#status', `Computing… ${done} of ${total}`)
```

`value`, `checked` and `selected` are set as properties and after the children, so `H.el('select', { value: 'b' }, ...options)` works.

### `H.svg(tag, props?, ...children)`

Like `H.el`, but in the SVG namespace. Icons are built this way too:

```js
H.svg('svg', { class: 'arrow', viewBox: '0 0 256 256', fill: 'currentColor' },
  H.svg('path', { d: 'M228,192a4,4,0,0,1-4,4H80…' }))
```

Hetmule deliberately has no function for turning html strings into nodes. An icon with many parts can live in its own file: `H.el('img', { src: 'icons/arrow.svg', alt: '' })`.

### `H.mount(target, ...children)`

Replaces all content of `target`, which can be an element or a css selector. Without children it empties the element.

### Inserting elsewhere

`H.el` returns an ordinary element, so the browser's own methods handle every other position:

```js
list.append(H.el('li', 'Last'));            // last inside list
list.prepend(H.el('li', 'First'));          // first inside list
row.before(H.el('tr', H.el('td', 'New')));  // right before row
row.after(H.el('tr', H.el('td', 'New')));   // right after row
old.replaceWith(H.el('p', 'Replacement'));  // instead of old
```

### `H.on(root, event, selector, fn)`

Listens on a parent and reacts to children matching the selector, including ones created later. Good for big tables, where one listener per cell adds up. Returns a function that removes the listener.

```js
H.on('#table', 'click', 'td', (event, td) => filter(td.dataset.column));
```

---

## Dom from data

### `H.fill(template, data)` · `H.get(object, path, fallback?)` · `H.set(object, path, value)`

```js
H.fill('{first} {last}.', person)       // "Ada Lovelace."
H.fill('Hello {missing}', {})           // "Hello {missing}" – the mistake shows instead of going blank
H.get(model, 'user.name', '–')          // fallback if any step is missing
H.set(model, 'filter.party', 'S')       // creates missing objects along the way
```

### `H.build(spec, data?)`

Builds dom from a structure that can live in json or yaml: `[tag, props?, ...children]`. Strings in text and attributes are filled with `H.fill`. An array that doesn't start with a tag name is several sibling nodes.

```js
H.mount('#page', H.build([
  ['h1', 'Hello {name}'],
  ['p', ['a', { href: '{link}' }, 'Read more']]
], { name: 'Bo', link: '?page=about' }));
```

---

## The address bar and pages

### `H.params(values?, push?)`

```js
H.params()                               // read: { page: 'start', f: ['a', 'b'] } – repeated keys become arrays
H.params({ sort: '-party', f: ['a'] })   // write, without reloading – empty values are skipped
H.params({ page: 'about' }, true)        // write and create a history entry
```

### `H.router({ param, start, render, params? })`

```js
const router = H.router({
  param: 'page',                            // the query parameter holding the page name
  start: 'start',                           // page to show when none is given
  params: () => ({ user: model.id }),       // anything else that should be in the address
  render: async page => {                   // draw the page
    H.mount('#page', await buildPage(page));
  }
});

router.go('contact');           // new history entry, render and scroll to top
router.sync();                  // rewrite the address when something in params has changed
H.el('a', { href: router.url('contact') }, 'Contact')
```

Plain links to the same page, like `<a href="?page=contact">`, switch pages without reloading. They can still be opened in a new tab. The back button and reloading work.

---

## Data and time

### `H.request(url, { method, payload, as, bust, headers, signal })`

```js
const data = await H.request('data/page.yaml');      // the format is decided by the response
const row  = await H.request('api/row', {
  method: 'POST',
  payload: { id: 3 },   // objects and arrays are sent as json, anything else (FormData, text) as is
  as: 'json',           // json | yaml | text | response – otherwise by Content-Type and file extension
  bust: true,           // fetch again, not from the cache
});
```

Without `as`, `.yaml`/`.yml` becomes yaml (requires `js-yaml`), json becomes data and the rest text. `HEAD` returns the response itself. Responses that aren't ok (404, 500 and so on) throw an error with `error.response`.

### `H.poll(fn, { every, onChange, onError })`

Runs `fn` on demand (`check`) or at intervals (`start`). `onChange` runs on the first result and then only when the result changes. If a check is already running, no new one is started.

```js
const poller = H.poll(() => H.request(CONFIG.allt_json_url, { bust: true }), {
  every: 30000,
  onChange: (data, previous) => loadAndCompute(data, previous !== undefined),
  onError: e => H.mount('#status', H.el('span', { class: 'error' }, 'Could not fetch data: ', e.message)),
});

await poller.check();   // manual check ("Check now")
poller.start();         // auto-refresh on
poller.stop();          // auto-refresh off
```

### `H.queue(list, fn, { onProgress, signal })`

Runs `fn(item, index)` on every item in slices of a few milliseconds, so the page stays usable meanwhile. Returns a promise with the results.

```js
const results = await H.queue(elections, runSimulator, {
  onProgress: (done, total) => H.mount('#status', `Computing… ${done} of ${total}`),
  signal: controller.signal,   // optional, to cancel
});
```

### Other

```js
search.oninput = H.debounce(() => find(search.value), 200);
H.fullscreen();                            // toggle, or H.fullscreen(true/false)
H.download('structure.yaml', text);        // give the user a file to save
```

---

## From our projects

This is how existing code can look with hetmule. Function names are kept from each project.

**mandatkollen: the column picker** (`byggKolumnToggle`, about 30 lines)

```js
function byggKolumnToggle() {
  H.mount('#column-toggle', COLUMNS.map(col =>
    H.el('label',
      H.el('input', {
        type: 'checkbox',
        checked: !STATE.hiddenCols[col.key],
        onchange: e => toggleColumn(col.key, e.target.checked),
      }),
      ' ' + col.label,
      hasFilter(col) && H.el('span', {
        class: 'filter-icon',
        title: 'The column has an active filter – hiding the column removes the filter',
      }, STATE.soloFilters[col.key] !== undefined ? ' ◉' : ' ●')
    )
  ));
}
```

**mandatkollen: the computation queue and auto-refresh** (`byggKö`, `körKö`, `kontrolleraAlltJson`, `hanteraPollTimer`)

```js
const poller = H.poll(() => H.request(CONFIG.allt_json_url, { bust: true }), {
  every: CONFIG.poll_interval_ms,
  onChange: async (data, previous) => {
    const rows = (await H.queue(byggKö(data), behandlaItem, {
      onProgress: (done, total) => uppdateraStatus(done, done, total - done),
    })).flat();
    if (previous) diffOchMerge(rows); else STATE.rows = rows;
    renderTabell();
  },
});

poller.check();
autorefresh.onchange = () => autorefresh.checked ? poller.start() : poller.stop();
btnRefresh.onclick = () => poller.check();
```

**promisi: navigation** (`navigera`, `_byggUrl`, `popstate`, click delegation for `data-nav-target`)

```js
App.router = H.router({
  param: 'sida',
  start: 'start',
  params: () => App._urlParametrar(),
  render: async sida => {
    App.sidor[sida] ??= await H.request(`data/sidor/${sida}.yaml`);
    App.modell.sida = sida;
    App._stangMeny();
    App.rendera();
  },
});
```

Links become plain `href: App.router.url(id)` instead of `data-nav-target`.

**promisi: search results.** Today they are built with `innerHTML` and data, so html in a page leaks through:

```js
H.el('a', { href: App.router.url(r.id) },
  H.el('strong', r.titel), H.el('br'), H.el('small', r.snippet))
```

**hap/vallokal.** `länka_in(tag, parent, text, attributes)` becomes `parent.append(H.el(tag, attributes, text))`, and `länka_in(..., före)` becomes `före.before(H.el(...))`. `ladda_jox`, `ladda_get_parametrar`, `sätt_upp_sida`/`till` and `uppdatera_url` are replaced by `H.request`, `H.params` and `H.router`, and `onclick: 'till("x")'` becomes `href: router.url('x')`.

---

## Ideas ahead

From the first plan for hetmule: tasks with a status and a next step. Most of it is now covered by `H.poll` (how often), `H.queue` (small pieces) and plain `setTimeout`. The questions remain to think about:

- How important?
- How heavy?
- Best-before-date?
