/**
 * pwa.js - PWA features (service worker, share target, file handling)
 * Part of Marvin's Image Converter modular architecture
 */

import { handleFiles } from './file-queue-v2.js';

// ============================================
// SERVICE WORKER
// ============================================

let updateBannerShown = false;

/**
 * Show update available banner
 * @param {ServiceWorkerRegistration} registration
 */
function showUpdateBanner(registration) {
    if (updateBannerShown) return;
    updateBannerShown = true;

    // Create update banner if it doesn't exist
    let banner = document.getElementById('update-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'update-banner';
        banner.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #4CAF50, #2E7D32);
                color: white;
                padding: 12px 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 12px;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                max-width: 90%;
                animation: slideUp 0.3s ease-out;
            ">
                <span>🔄 Neue Version verfügbar!</span>
                <button id="update-btn" style="
                    background: white;
                    color: #2E7D32;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 13px;
                    transition: transform 0.1s;
                ">Jetzt aktualisieren</button>
                <button id="update-dismiss" style="
                    background: transparent;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 18px;
                    opacity: 0.8;
                ">&times;</button>
            </div>
            <style>
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
                #update-btn:hover { transform: scale(1.05); }
                #update-btn:active { transform: scale(0.95); }
            </style>
        `;
        document.body.appendChild(banner);

        // Update button click
        document.getElementById('update-btn').addEventListener('click', () => {
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            banner.remove();
        });

        // Dismiss button click
        document.getElementById('update-dismiss').addEventListener('click', () => {
            banner.remove();
            updateBannerShown = false;
        });
    }
}

/**
 * Register the service worker with update detection
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registration successful');

                    // Check for updates immediately
                    registration.update();

                    // Check for waiting service worker (update already downloaded)
                    if (registration.waiting) {
                        showUpdateBanner(registration);
                    }

                    // Listen for new service worker installing
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('🔄 New Service Worker found, installing...');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available
                                console.log('✅ New version ready!');
                                showUpdateBanner(registration);
                            }
                        });
                    });

                    // Reload page when new service worker takes over
                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (!refreshing) {
                            refreshing = true;
                            console.log('🔄 Reloading for new version...');
                            window.location.reload();
                        }
                    });
                })
                .catch((err) => {
                    console.log('ServiceWorker registration failed:', err);
                });
        });

        // Periodic update check (every 60 minutes)
        setInterval(() => {
            navigator.serviceWorker.ready.then((registration) => {
                registration.update();
                console.log('🔍 Checking for updates...');
            });
        }, 60 * 60 * 1000);
    }
}

// ============================================
// FILE HANDLING API
// ============================================

/**
 * Handle files from "Open With" or drag to app icon
 */
export function handleLaunchQueue() {
    if ('launchQueue' in window) {
        window.launchQueue.setConsumer(async (launchParams) => {
            if (!launchParams.files.length) {
                return;
            }

            const files = [];
            for (const handle of launchParams.files) {
                const file = await handle.getFile();
                files.push(file);
            }

            console.log('📦 PWA File Handling: Received files:', files.length);

            if (typeof handleFiles === 'function') {
                handleFiles(files);
            }
        });
    }
}

// ============================================
// SHARE TARGET API
// ============================================

/**
 * Handle files shared from Android/iOS "Share with..." or dropped on landing page
 */
export function handleShareTarget() {
    window.addEventListener('load', async () => {
        // Clean URL if share_target param present
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('share_target')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Always check IndexedDB for pending files (from landing page drop or share target)
        try {
            const db = await new Promise((resolve, reject) => {
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

            const transaction = db.transaction('shared_files', 'readonly');
            const store = transaction.objectStore('shared_files');

            const fileObjects = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

            if (fileObjects.length > 0) {
                const files = [];
                for (const obj of fileObjects) {
                    const blob = new Blob([obj.buffer], { type: obj.type });
                    const file = new File([blob], obj.name, { type: obj.type });
                    files.push(file);
                }

                // Clear the store after reading
                const clearTransaction = db.transaction('shared_files', 'readwrite');
                clearTransaction.objectStore('shared_files').clear();

                console.log('📦 Loaded files from IndexedDB:', files.length);

                if (typeof handleFiles === 'function') {
                    handleFiles(files);
                }
            }

            db.close();
        } catch (e) {
            // IndexedDB not available or empty - that's fine
            console.log('No pending files in IndexedDB');
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize all PWA features
 */
export function initPWA() {
    registerServiceWorker();
    handleLaunchQueue();
    handleShareTarget();
}
