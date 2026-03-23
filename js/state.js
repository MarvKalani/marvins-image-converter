/**
 * state.js - Shared application state
 * Part of Marvin's Image Converter modular architecture
 * 
 * This module holds shared mutable state that needs to be accessed
 * across multiple modules.
 */

// ============================================
// FILE QUEUE STATE
// ============================================

/** @type {Array<Object>} Queue of file objects to process */
export let fileQueue = [];

/** @type {Set<string>} Set of file IDs that have been changed */
export let changedFiles = new Set();

/** @type {number} Index of currently active preview in modal (-1 = none) */
export let activePreviewIndex = -1;

// ============================================
// PROCESSING STATE
// ============================================

/** @type {boolean} Whether processing is currently active */
export let isProcessing = false;

/** @type {boolean} Whether a transformation is in progress */
export let isTransforming = false;

/** @type {boolean} Whether ZIP processing has been cancelled */
export let zipProcessCancelled = false;

/** @type {boolean} Whether calculate all has been cancelled */
export let calculateProcessCancelled = false;

/** @type {AbortController|null} Current transformation abort controller */
export let currentTransformationController = null;

// ============================================
// ZOOM STATE
// ============================================

export let zoomState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
};

// ============================================
// UI STATE
// ============================================

/** @type {boolean} Whether auto-preview is enabled */
export let autoPreviewEnabled = true;

/** @type {boolean} Whether client is detected as slow */
export let isSlowClient = false;

// ============================================
// BUDGET MODE STATE
// ============================================

/** @type {boolean} Whether budget mode is active */
export let budgetMode = false;

/** @type {number} Target budget in MB */
export let budgetTargetMB = 9;

// ============================================
// STATE SETTERS
// Needed because ES6 exports are read-only bindings
// ============================================

export function setFileQueue(newQueue) {
    fileQueue = newQueue;
}

export function setActivePreviewIndex(index) {
    activePreviewIndex = index;
}

export function setIsProcessing(value) {
    isProcessing = value;
}

export function setIsTransforming(value) {
    isTransforming = value;
}

export function setZipProcessCancelled(value) {
    zipProcessCancelled = value;
}

export function setCalculateProcessCancelled(value) {
    calculateProcessCancelled = value;
}

export function setCurrentTransformationController(controller) {
    currentTransformationController = controller;
}

export function setAutoPreviewEnabled(value) {
    autoPreviewEnabled = value;
    localStorage.setItem('autoPreviewEnabled', value.toString());
}

export function setIsSlowClient(value) {
    isSlowClient = value;
}

export function setBudgetMode(value) {
    budgetMode = value;
}

export function setBudgetTargetMB(value) {
    budgetTargetMB = value;
}

export function resetZoomState() {
    zoomState.scale = 1;
    zoomState.panX = 0;
    zoomState.panY = 0;
    zoomState.isPanning = false;
    zoomState.startX = 0;
    zoomState.startY = 0;
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize state from localStorage
 */
export function initState() {
    // Load auto-preview preference
    const storedAutoPreview = localStorage.getItem('autoPreviewEnabled');
    if (storedAutoPreview !== null) {
        autoPreviewEnabled = storedAutoPreview === 'true';
    }
}

/**
 * Clear all file-related state
 */
export function clearFileState() {
    fileQueue = [];
    changedFiles = new Set();
    activePreviewIndex = -1;
    isProcessing = false;
    zipProcessCancelled = false;
    calculateProcessCancelled = false;
}
