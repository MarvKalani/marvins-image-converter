const CACHE_NAME = 'bildwandler-v2602240125';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './app.css',
  './manifest.json',
  './libs/jszip.min.js',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/memory.js',
  './js/state.js',
  './js/i18n.js',
  './js/translations.min.js',
  './js/file-queue-v2.js',
  './js/modal.js',
  './js/transformations.js',
  './js/image-processing.js',
  './js/zip.js',
  './js/pwa.js',
  './js/theme.js',
  './js/donation.js',
  './js/promo.js',
  './js/webmcp.js',
  './js/vtracer.js',
  './js/worker-pool.js',
  './js/encoding-worker.js',
  './icons/icon-192.webp',
  './icons/icon-512.webp',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/yt_logo_rgb_light.png',
  './icons/yt_logo_rgb_dark.png',
  './icons/kofi_logo.svg',
  './icons/de-pp-logo-100px.png',
  './icons/logo.svg',
  './libs/vtracer/loader.js',
  './libs/vtracer/vtracer.js',
  './libs/vtracer/vtracer_webapp_bg.wasm',
  './img/ad_list.webp',
  './img/ad_connector.webp',
  './img/ad_pdf.webp'
];

// Install Event - Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate strategy & Share Target Handler
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Share Target POST requests (PairDrop pattern)
  if (event.request.method === 'POST') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const files = formData.getAll('allfiles');

      console.log('📥 Share Target: Received', files.length, 'files');

      if (files && files.length > 0) {
        // Convert files to storable format
        const fileObjects = [];
        for (let i = 0; i < files.length; i++) {
          fileObjects.push({
            name: files[i].name,
            type: files[i].type,
            buffer: await files[i].arrayBuffer()
          });
        }

        // Store in IndexedDB (more reliable than Cache API on Android)
        const dbPromise = new Promise((resolve, reject) => {
          const request = indexedDB.open('bildwandler_share', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
          request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('shared_files')) {
              db.createObjectStore('shared_files', { keyPath: 'id', autoIncrement: true });
            }
          };
        });

        const db = await dbPromise;
        const transaction = db.transaction('shared_files', 'readwrite');
        const store = transaction.objectStore('shared_files');

        // Clear old files first
        store.clear();

        // Add new files
        for (const file of fileObjects) {
          store.add(file);
        }

        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = reject;
        });

        db.close();
        console.log('💾 Share Target: Files stored in IndexedDB');
      }

      // Instead of redirect, serve app.html directly to avoid redirect loops
      console.log('🔄 Share Target: Serving app.html directly');

      // Fetch app.html from cache or network
      const appResponse = await caches.match('./app.html') || await fetch('./app.html');

      // Clone and modify the response to include the share_target indicator
      const html = await appResponse.text();
      const modifiedHtml = html.replace(
        '</head>',
        '<script>window.__SHARE_TARGET_FILES__ = true;</script></head>'
      );

      return new Response(modifiedHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    })());
    return;
  }

  // Check if it's an HTML file, navigation request, or JS file
  const isHtmlOrJsRequest = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js');

  if (isHtmlOrJsRequest) {
    // Network-First strategy for HTML
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        // Fallback to cache if offline
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        // If it's a JS file and not in cache, we just fail (don't return HTML)
        if (url.pathname.endsWith('.js')) {
          return new Response('', { status: 404, statusText: 'Offline and not in cache' });
        }

        // Final fallback based on pathname if direct match fails
        if (url.pathname.includes('app')) {
          return caches.match('./app.html');
        }
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Stale-While-Revalidate strategy for all other assets
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Silent failure on background update
        });

        // Return cached response immediately, or wait for network
        return response || fetchPromise;
      });
    })
  );
});
