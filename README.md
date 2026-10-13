# Hetmule.js

Ett litet js-bibliotek för single page applications utan ramverk och byggsteg. En fil, inga beroenden.

```html
<script src="hetmule.js"></script>
<script src="app.js"></script>
```

Allt finns i det globala objektet `H`.

| Behov | Funktion |
|---|---|
| Bygga dom utan `innerHTML` | `H.el`, `H.svg`, `H.mount`, `H.on` |
| Dom och text från data (json/yaml) | `H.build`, `H.fill`, `H.get`, `H.set` |
| Adressfältet och sidor | `H.params`, `H.router` |
| Hämta data, polla och tunga beräkningar | `H.request`, `H.poll`, `H.queue` |
| Övrigt | `H.debounce`, `H.fullscreen`, `H.download` |

Testerna finns i `test/index.html`. Öppna sidan via en webbserver, t.ex. MAMP: http://localhost:8888/hetmule/test/ (nätverkstesterna hoppas över om sidan öppnas som fil).

---

## Dom

### `H.el(tagg, props?, ...barn)`

```js
const knapp = H.el('button', {
  class: ['knapp', aktiv && 'aktiv'],   // sträng eller lista, falska värden hoppas över
  style: { color: 'red', '--bredd': '3px' },
  'data-id': rad.id,                    // allt annat blir attribut, med samma namn som i html
  disabled: !rad.redigerbar,            // true = attributet sätts, false = det sätts inte
  onclick: () => spara(rad),            // funktioner på on… blir händelselyssnare
}, 'Spara ', H.el('small', rad.namn));
```

Barn kan vara element, strängar, tal eller listor. `null`, `undefined` och `false` hoppas över, så villkor och `map` fungerar direkt:

```js
H.el('ul', rader.map(r => H.el('li', r.namn)), tom && H.el('li', 'Inga träffar'))
```

Strängar blir alltid text, aldrig html. Data från användare eller server kan alltså inte smuggla in html. Därför går det också bra att bygga texten med en template-sträng:

```js
H.mount('#status', `Beräknar… ${klara} av ${totalt}`)
```

`value`, `checked` och `selected` sätts som egenskaper och efter barnen, så `H.el('select', { value: 'b' }, ...options)` fungerar.

### `H.svg(tagg, props?, ...barn)`

Som `H.el`, men i SVG-namnrymden. Ikoner byggs också så:

```js
H.svg('svg', { class: 'pil', viewBox: '0 0 256 256', fill: 'currentColor' },
  H.svg('path', { d: 'M228,192a4,4,0,0,1-4,4H80…' }))
```

Hetmule har medvetet ingen funktion för att göra om html-strängar till noder. Om en ikon har många delar kan den ligga som en egen fil: `H.el('img', { src: 'ikoner/pil.svg', alt: '' })`.

### `H.mount(mål, ...barn)`

Ersätter allt innehåll i `mål`, som kan vara ett element eller en css-selektor. Utan barn tömmer den elementet. För att lägga till något sist räcker det inbyggda `element.append(H.el(...))`.

### `H.on(rot, händelse, selektor, fn)`

Lyssnar på en förälder och reagerar på barn som matchar selektorn, även sådana som skapas efteråt. Det passar stora tabeller, där en lyssnare per cell blir många. Returnerar en funktion som tar bort lyssnaren.

```js
H.on('#tabell', 'click', 'td', (event, td) => filtrera(td.dataset.kolumn));
```

---

## Dom från data

### `H.fill(mall, data)` · `H.get(objekt, sökväg, reserv?)` · `H.set(objekt, sökväg, värde)`

```js
H.fill('{fnamn} {enamn}.', person)    // "Ada Lovelace."
H.fill('Hej {saknas}', {})            // "Hej {saknas}" – felet syns i stället för att bli tomt
H.get(modell, 'inloggad.namn', '–')   // reservvärde om något led saknas
H.set(modell, 'filter.parti', 'S')    // skapar objekt som saknas på vägen
```

### `H.build(spec, data?)`

Bygger dom från en struktur som kan ligga i json eller yaml: `[tagg, props?, ...barn]`. Strängar i texter och attribut fylls med `H.fill`. En lista som inte börjar med ett taggnamn är flera noder bredvid varandra.

```js
H.mount('#sida', H.build([
  ['h1', 'Hej {namn}'],
  ['p', ['a', { href: '{länk}' }, 'Läs mer']]
], { namn: 'Bo', länk: '?sida=om' }));
```

---

## Adressfältet och sidor

### `H.params(värden?, push?)`

```js
H.params()                             // läs: { sida: 'start', f: ['a', 'b'] } – upprepade nycklar blir listor
H.params({ sort: '-parti', f: ['a'] }) // skriv, utan att ladda om – tomma värden hoppas över
H.params({ sida: 'om' }, true)         // skriv och skapa en historiepunkt
```

### `H.router({ param, start, render, params? })`

```js
const router = H.router({
  param: 'sida',                              // get-parametern för sidans namn
  start: 'start',                             // sida om ingen anges
  params: () => ({ inloggad: modell.id }),    // övrigt som ska ligga i adressen
  render: async sida => {                     // rita sidan
    H.mount('#sida', await byggSida(sida));
  }
});

router.go('kontakt');           // ny historiepunkt, rita och scrolla upp
router.sync();                  // skriv om adressen när något i params har ändrats
H.el('a', { href: router.url('kontakt') }, 'Kontakt')
```

Vanliga länkar till samma sida, som `<a href="?sida=kontakt">`, byter sida utan att laddas om. De går fortfarande att öppna i en ny flik. Bakåtknappen och omladdning fungerar.

---

## Data och tid

### `H.request(url, { method, payload, as, bust, headers, signal })`

```js
const data = await H.request('data/sida.yaml');      // formatet avgörs av svaret
const rad  = await H.request('api/rad', {
  method: 'POST',
  payload: { id: 3 },   // objekt och listor skickas som json, annat (FormData, text) som det är
  as: 'json',           // json | yaml | text | response – annars efter Content-Type och filändelse
  bust: true,           // hämta på nytt, inte från cachen
});
```

Utan `as` blir `.yaml`/`.yml` yaml (kräver `js-yaml`), json blir data och resten text. `HEAD` ger själva svaret. Svar som inte är ok (404, 500 och så vidare) kastar ett fel med `error.response`.

### `H.poll(fn, { every, onChange, onError })`

Kör `fn` när man vill (`check`) eller med jämna mellanrum (`start`). `onChange` körs vid första svaret och sedan bara när svaret ändras. Om en kontroll redan pågår startas ingen ny.

```js
const poller = H.poll(() => H.request(CONFIG.allt_json_url, { bust: true }), {
  every: 30000,
  onChange: (data, tidigare) => laddaOchBeräkna(data, tidigare !== undefined),
  onError: e => H.mount('#status', H.el('span', { class: 'fel' }, 'Kunde inte hämta data: ', e.message)),
});

await poller.check();   // manuell kontroll ("Kontrollera nu")
poller.start();         // auto-refresh på
poller.stop();          // auto-refresh av
```

### `H.queue(lista, fn, { onProgress, signal })`

Kör `fn(post, index)` på varje post i portioner om några millisekunder, så att sidan går att använda under tiden. Returnerar ett promise med resultaten.

```js
const resultat = await H.queue(val, körSimulator, {
  onProgress: (klara, totalt) => H.mount('#status', `Beräknar… ${klara} av ${totalt}`),
  signal: controller.signal,   // valfritt, för att avbryta
});
```

### Övrigt

```js
sokfalt.oninput = H.debounce(() => sok(sokfalt.value), 200);
H.fullscreen();                          // växla, eller H.fullscreen(true/false)
H.download('struktur.yaml', text);       // ge användaren en fil att spara
```

---

## Från våra projekt

Så här kan befintlig kod se ut med hetmule.

**mandatkollen: kolumnväljaren** (`byggKolumnToggle`, ca 30 rader)

```js
function byggKolumnToggle() {
  H.mount('#column-toggle', COLUMNS.map(col =>
    H.el('label',
      H.el('input', {
        type: 'checkbox',
        checked: !STATE.hiddenCols[col.key],
        onchange: e => växlaKolumn(col.key, e.target.checked),
      }),
      ' ' + col.label,
      harFilter(col) && H.el('span', {
        class: 'filter-ikon',
        title: 'Kolumnen har ett aktivt filter – döljs kolumnen tas filtret bort',
      }, STATE.soloFilters[col.key] !== undefined ? ' ◉' : ' ●')
    )
  ));
}
```

**mandatkollen: beräkningskön och auto-refresh** (`byggKö`, `körKö`, `kontrolleraAlltJson`, `hanteraPollTimer`)

```js
const poller = H.poll(() => H.request(CONFIG.allt_json_url, { bust: true }), {
  every: CONFIG.poll_interval_ms,
  onChange: async (data, tidigare) => {
    const rader = (await H.queue(byggKö(data), behandlaItem, {
      onProgress: (klara, totalt) => uppdateraStatus(klara, klara, totalt - klara),
    })).flat();
    if (tidigare) diffOchMerge(rader); else STATE.rows = rader;
    renderTabell();
  },
});

poller.check();
autorefresh.onchange = () => autorefresh.checked ? poller.start() : poller.stop();
btnRefresh.onclick = () => poller.check();
```

**promisi: navigering** (`navigera`, `_byggUrl`, `popstate`, klickdelegering för `data-nav-target`)

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

Länkarna blir vanliga `href: App.router.url(id)` i stället för `data-nav-target`.

**promisi: sökträffar.** I dag byggs de med `innerHTML` och data, vilket gör att html i en sida slår igenom:

```js
H.el('a', { href: App.router.url(r.id) },
  H.el('strong', r.titel), H.el('br'), H.el('small', r.snippet))
```

**hap/vallokal.** `länka_in(tag, förälder, text, attribut)` blir `förälder.append(H.el(tag, attribut, text))`. `ladda_jox`, `ladda_get_parametrar`, `sätt_upp_sida`/`till` och `uppdatera_url` ersätts av `H.request`, `H.params` och `H.router`, och `onclick: 'till("x")'` blir `href: router.url('x')`.

---

## Idéer framåt

Från den första planen för hetmule: uppgifter med status och nästa steg. Det mesta täcks nu av `H.poll` (hur ofta), `H.queue` (små portioner) och vanliga `setTimeout`. Frågorna är kvar att fundera på:

- How important?
- How heavy?
- Best-before-date?
