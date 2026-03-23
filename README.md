# Marvin's Image Converter (Bildwandler)

A browser-based image converter that runs entirely client-side. No uploads, no servers, no tracking — your images never leave your device.

**Live:** [img2.download](https://img2.download/)

## Features

- **Format conversion** — JPEG, PNG, WebP, AVIF, SVG (raster-to-vector via VTracer)
- **HEIC input** — native HEIC support in Safari (with guidance for other browsers)
- **Batch processing** — drag & drop multiple files, download as ZIP
- **Quality & scale control** — adjust compression and resolution per batch
- **Budget mode** — set a total file size target (e.g. 9 MB for email attachments) and the app auto-adjusts quality/scale to fit
- **Live preview** — side-by-side A/B comparison with zoom (original vs. converted)
- **Image editing** — crop, rotate, flip before conversion
- **PWA** — installable, works offline, supports Share Target API
- **Multi-language** — German, English, French, Spanish, Arabic, Chinese, Japanese, Korean, Russian
- **Dark/Light theme**
- **OffscreenCanvas worker pool** — parallel batch encoding for faster processing

## WebMCP Integration

This app implements the experimental [Web Model Context Protocol](https://anthropic.com) via `navigator.modelContext`, exposing tools that browser-based AI agents can use:

| Tool | Description |
|---|---|
| `get_status` | Current queue state, format, quality settings |
| `add_images` | Trigger the file picker |
| `add_image_from_url` | Fetch an image from a URL and add it to the queue |
| `set_format` | Change output format (webp, jpeg, png, avif, svg) |
| `set_quality` | Set compression quality (10–95) |
| `set_scale` | Set output scale (10–100%) |
| `process_and_download` | Convert all images and download as ZIP |
| `download_single_image` | Convert and download a single image |
| `remove_image` | Remove an image from the queue |
| `clear_all` | Clear the entire queue |

See [js/webmcp.js](js/webmcp.js) for the full implementation.

## Tech Stack

- **Vanilla JavaScript** (ES6 modules, no framework, no bundler)
- **Canvas API** / **OffscreenCanvas** for image processing
- **Web Workers** for parallel encoding
- **Service Worker** for offline support and caching
- **VTracer (WASM)** for SVG vectorization
- **JSZip** for batch downloads
- Hosted on **Cloudflare Pages**

## Getting Started

```bash
# Clone
git clone https://github.com/MarvKalani/marvins-image-converter.git
cd marvins-image-converter

# Start local server
npm start
# → http://localhost:4200
```

No build step required for development — open `app.html` directly or use the local server.

## Project Structure

```
app.html            Main application page
app.css             Styles
sw.js               Service Worker (offline support)
js/
  main.js           Entry point, init & event listeners
  config.js         DOM references, icons, constants
  state.js          Global app state
  file-queue-v2.js  File list, drag & drop, rendering
  image-processing.js  Canvas-based image processing
  transformations.js   Format/quality transformations
  modal.js          Preview modal with zoom & A/B compare
  zip.js            Batch ZIP download
  worker-pool.js    OffscreenCanvas worker pool
  encoding-worker.js  Web Worker for canvas encoding
  i18n.js           Internationalization
  vtracer.js        SVG vectorization
  webmcp.js         Web Model Context Protocol integration
  pwa.js            Service Worker registration, Share Target
  theme.js          Dark/Light theme toggle
  memory.js         Memory cleanup for large batches
  utils.js          Helper functions
```

## License

CC BY-NC-SA 4.0 — see [LICENSE.md](LICENSE.md) for details.

Non-commercial use is free. For commercial licensing, contact [support@kalanis.de](mailto:support@kalanis.de).
