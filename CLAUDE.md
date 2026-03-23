# Marvin's Image Converter (Bildwandler)

Browser-basierter Bildkonverter als PWA. Läuft komplett client-seitig ohne Server-Backend.

## Architektur

- **Vanilla JS** mit ES6-Modulen (kein Bundler, kein Framework)
- Einstiegspunkt: `app.html` lädt `js/main.js` als `type="module"`
- PWA mit Service Worker (`sw.js`) und Offline-Support
- Hosting: Cloudflare Pages

## Modul-Übersicht (`js/`)

| Modul | Zweck |
|---|---|
| `main.js` | Entry Point, Init & Event-Listener |
| `config.js` | DOM-Referenzen (`DOM`), Icons, Konstanten |
| `state.js` | Globaler App-State |
| `file-queue-v2.js` | Dateiliste, Drag & Drop, Rendering |
| `image-processing.js` | Canvas-basierte Bildverarbeitung |
| `transformations.js` | Format/Qualitäts-Transformationen |
| `modal.js` | Vorschau-Modal mit Zoom/A-B-Vergleich |
| `zip.js` | Batch-Download als ZIP |
| `i18n.js` / `translations.min.js` | Mehrsprachigkeit |
| `pwa.js` | Service Worker Registration, Share Target |
| `theme.js` | Dark/Light Theme |
| `memory.js` | Memory Cleanup für große Batches |
| `utils.js` | Hilfsfunktionen |
| `promo.js` | Eigenwerbung für andere Marvin-Projekte |
| `donation.js` | Spenden-Banner |
| `webmcp.js` | Web Model Context Protocol Integration |
| `vtracer.js` | SVG-Vektorisierung |
| `worker-pool.js` | OffscreenCanvas Worker-Pool für parallele Bildverarbeitung |
| `encoding-worker.js` | Web Worker für Canvas-Encoding (wird von worker-pool.js gestartet) |

## Wichtige Regeln

### Kein `?v=` in JS-Imports!
Cache-Busting gehört **ausschließlich** in die `<script>`-Tags in HTML-Dateien.
ES6-Module behandeln URLs mit unterschiedlichen Query-Parametern als **separate Module**, was zu doppelten Instanzen und uniitialisierten Singletons führt.

Richtig:
```html
<!-- app.html -->
<script type="module" src="js/main.js?v=123"></script>
```

Falsch:
```js
// Innerhalb von JS-Dateien NIEMALS:
import { foo } from './bar.js?v=123';
```

### Service Worker Cache-Liste pflegen
Wenn JS-Dateien umbenannt oder hinzugefügt werden, `ASSETS_TO_CACHE` in `sw.js` aktualisieren.

### DOM-Singleton in `config.js`
`config.js` exportiert ein `DOM`-Objekt, das via `initDOM()` in `main.js` befüllt wird. Alle Module importieren dasselbe `DOM`-Objekt. Funktioniert nur, wenn alle das gleiche Modul importieren (siehe Regel oben).

## Deploy-Workflow

```bash
node deploy-update-version.js    # Version + Cache-Busting in HTML setzen
node cloudflare-build.js         # Build nach dist/
git add . && git commit && git push  # Cloudflare Pages deployed automatisch
```

`deploy-update-version.js` aktualisiert:
- Version im Footer (`app.html`, `index.html`)
- `?v=`-Parameter in HTML `<script>`-Tags (nur HTML!)
- `CACHE_NAME` in `sw.js`

## Testen

- `npm run start` → lokaler Server auf Port 8080
- `npm test` → Playwright E2E-Tests
- Tests müssen **nicht** bei jedem Change ausgeführt werden — viele sind veraltet/flaky
