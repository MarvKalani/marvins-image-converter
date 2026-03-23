/**
 * config.js - Central configuration, icons, and DOM element references
 * Part of Marvin's Image Converter modular architecture
 */

// ============================================
// SVG ICONS
// ============================================
export const icons = {
    lightMode:
        '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-sunrise"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0" /><path d="M3 21l18 0" /><path d="M12 9v-6l3 3m-6 0l3 -3" /></svg>',
    darkMode:
        '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-sunset"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 17h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 0 1 8 0" /><path d="M3 21l18 0" /><path d="M12 3v6l3 -3m-6 0l3 3" /></svg>',
    rotateLeft:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-rotate-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 4.55a8 8 0 0 0 -6 14.9m0 -4.45v5h-5" /><path d="M18.37 7.16l0 .01" /><path d="M13 19.94l0 .01" /><path d="M16.84 18.37l0 .01" /><path d="M19.37 15.1l0 .01" /><path d="M19.94 11l0 .01" /></svg>',
    rotateRight:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-rotate-clockwise-2"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" /><path d="M5.63 7.16l0 .01" /><path d="M4.06 11l0 .01" /><path d="M4.63 15.1l0 .01" /><path d="M7.16 18.37l0 .01" /><path d="M11 19.94l0 .01" /></svg>',
    flipHorizontal:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-flip-vertical"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 3l0 18" /><path d="M16 7l0 10l5 0l-5 -10" /><path d="M8 7l0 10l-5 0l5 -10" /></svg>',
    flipVertical:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-flip-horizontal"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12l18 0" /><path d="M7 16l10 0l-10 5l0 -5" /><path d="M7 8l10 0l-10 -5l0 5" /></svg>',
    addFiles:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-photo-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" /><path d="M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>',
    reset:
        '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-rotate"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" /></svg>',
    refresh:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-refresh"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>',
    removeFile:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-photo-minus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 8h.01" /><path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v9" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l2 2" /><path d="M16 19h6" /></svg>',
    process:
        '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-file-type-zip"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" /><path d="M16 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" /><path d="M12 15v6" /><path d="M5 15h3l-3 6h3" /></svg>',
    save:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-download"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>',
};

// ============================================
// SUPPORTED FORMATS
// ============================================
export const FORMATS = {
    jpeg: { mimeType: 'image/jpeg', extension: 'jpg', supportsQuality: true },
    png: { mimeType: 'image/png', extension: 'png', supportsQuality: false },
    webp: { mimeType: 'image/webp', extension: 'webp', supportsQuality: true },
    svg: { mimeType: 'image/svg+xml', extension: 'svg', supportsQuality: false },
};

// ============================================
// DOM ELEMENT REFERENCES
// ============================================
// These are initialized after DOM is ready
export const DOM = {
    body: null,
    themeToggle: null,
    dashboard: null,
    workspace: null,
    fileListContainer: null,
    totalOriginalSizeSpan: null,
    totalEstimatedSizeSpan: null,
    percentSlider: null,
    formatSelect: null,
    qualitySlider: null,
    qualityGroup: null,
    dropZone: null,
    fileInput: null,
    processButton: null,
    modalOverlay: null,
    previewModal: null,
    modalTransformControls: null,
    modalCloseBtn: null,
    modalPrevBtn: null,
    modalNextBtn: null,
    zoomSlider: null,
    resetZoomBtn: null,
    originalPane: null,
    resultPane: null,
    workspaceTitle: null,
    modalTitle: null,
    modalOriginalImage: null,
    modalPreviewImage: null,
    modalOriginalInfoText: null,
    modalPreviewInfoText: null,
    progressOverlay: null,
    progressText: null,
    progressDetails: null,
    progressFill: null,
    progressFileList: null,
};

/**
 * Initialize DOM references - call after DOMContentLoaded
 */
export function initDOM() {
    DOM.body = document.body;
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.dashboard = document.getElementById('dashboard');
    DOM.workspace = document.getElementById('workspace');
    DOM.fileListContainer = document.getElementById('file-list-container');
    DOM.totalOriginalSizeSpan = document.getElementById('total-original-size');
    DOM.totalEstimatedSizeSpan = document.getElementById('total-estimated-size');
    DOM.percentSlider = document.getElementById('percent-slider');
    DOM.formatSelect = document.getElementById('format-select');
    DOM.qualitySlider = document.getElementById('quality-slider');
    DOM.qualityGroup = document.getElementById('quality-group');
    DOM.dropZone = document.getElementById('drop-zone');
    DOM.fileInput = document.getElementById('file-input');
    DOM.processButton = document.getElementById('process-button');
    DOM.modalOverlay = document.getElementById('modal-overlay');
    DOM.previewModal = document.getElementById('preview-modal');
    DOM.modalTransformControls = document.getElementById('modal-transform-controls');
    DOM.modalCloseBtn = document.getElementById('modal-close-btn');
    DOM.modalPrevBtn = document.getElementById('modal-prev-btn');
    DOM.modalNextBtn = document.getElementById('modal-next-btn');
    DOM.zoomSlider = document.getElementById('zoom-slider');
    DOM.resetZoomBtn = document.getElementById('reset-zoom-btn');
    DOM.originalPane = document.getElementById('original-pane');
    DOM.resultPane = document.getElementById('result-pane');
    DOM.workspaceTitle = document.getElementById('workspace-title');
    DOM.modalTitle = document.getElementById('modal-title');
    DOM.modalOriginalImage = document.getElementById('modal-original-image');
    DOM.modalPreviewImage = document.getElementById('modal-preview-image');
    DOM.modalOriginalInfoText = document.getElementById('modal-original-info-text');
    DOM.modalPreviewInfoText = document.getElementById('modal-preview-info-text');
    DOM.progressOverlay = document.getElementById('progress-overlay');
    DOM.progressText = document.getElementById('progress-text');
    DOM.progressDetails = document.getElementById('progress-details');
    DOM.progressFill = document.getElementById('progress-fill');
    DOM.progressFileList = document.getElementById('progress-file-list');
}
