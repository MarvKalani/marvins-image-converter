/**
 * main.js - Application entry point
 * Part of Marvin's Image Converter modular architecture
 * 
 * This is the main entry point that initializes all modules
 * and sets up global event listeners.
 */

// ============================================
// IMPORTS
// ============================================

import { icons, DOM, initDOM } from './config.js';
import { debounce, detectSlowClient, detectFormatSupport, applyFormatSupport } from './utils.js';
import { initI18n, updateLanguage, getTranslation } from './i18n.js';
import { triggerMemoryCleanup, startMemoryCleanup, stopMemoryCleanup } from './memory.js';
import { initTheme, toggleTheme } from './theme.js';
import { initState, setAutoPreviewEnabled, setIsSlowClient, setBudgetMode, setBudgetTargetMB } from './state.js';
import * as state from './state.js';
import {
    handleFiles,
    renderFileQueue,
    debouncedUpdate,
    markAllFilesForRecalculation,
    resetWorkspace,
    updateTotalSizeEstimate
} from './file-queue-v2.js';
import {
    openPreviewModal,
    closePreviewModal,
    showPrevFile,
    showNextFile,
    resetZoom,
    updateZoomPercentage,
    applyZoomAndPan,
    savePreviewImage // Imported for single-file download
} from './modal.js';
import {
    handleTransformation,
    cancelCurrentTransformation
} from './transformations.js';
import { calculateAllRealSizes, calculateBudgetSettings } from './image-processing.js';
import { processAndDownload } from './zip.js';
import { initPWA } from './pwa.js';
import { initDonationBanner } from './donation.js';
import { initPromo, showAd } from './promo.js';
import { initWebMCP } from './webmcp.js';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Main setup function - called when DOM is ready
 */
function setup() {
    // Initialize DOM references
    initDOM();

    // Initialize state from localStorage
    initState();

    // Initialize theme
    initTheme();

    // Initialize translations
    initI18n();

    // Set process button icon
    const processIcon = document.getElementById('process-icon');
    if (processIcon) {
        processIcon.innerHTML = icons.process;
    }

    // Set add files button icon
    const addFilesIcon = document.getElementById('add-files-icon');
    if (addFilesIcon) {
        addFilesIcon.innerHTML = icons.addFiles;
    }

    // Set reset all button icon
    const resetAllIcon = document.getElementById('reset-all-icon');
    if (resetAllIcon) {
        resetAllIcon.innerHTML = icons.reset;
    }

    // Detect slow client for auto-preview default
    setTimeout(() => {
        const isSlowClient = detectSlowClient();
        setIsSlowClient(isSlowClient);
        if (isSlowClient && localStorage.getItem('autoPreviewEnabled') === null) {
            setAutoPreviewEnabled(false);
            console.log('Slow client detected - auto-preview disabled by default');
        }
    }, 100);

    // Initialize PWA features
    initPWA();

    // Initialize donation banner
    // Initialize donation banner
    initDonationBanner();

    // Initialize promo ads
    initPromo();

    // Initialize WebMCP tools for AI Agent interactions
    initWebMCP();

    // On mobile: collapse settings by default
    const settingsDetails = document.getElementById('settings-details');
    if (settingsDetails && window.innerWidth <= 800) {
        settingsDetails.removeAttribute('open');
    }

    // Detect format support and disable unsupported options
    const formatSupport = detectFormatSupport();
    const unsupportedHint = getTranslation('formatNotSupported') || 'not supported';
    applyFormatSupport(DOM.formatSelect, formatSupport, unsupportedHint);
    applyFormatSupport(document.getElementById('modal-format-select'), formatSupport, unsupportedHint);

    // Set up event listeners
    setupEventListeners();

    console.log('🚀 Marvin\'s Image Converter initialized');
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Slider event listeners
    DOM.percentSlider?.addEventListener('input', () => {
        const currentPercentValue = document.getElementById('percent-value');
        const modalPercentValue = document.getElementById('modal-percent-value');
        const modalPercentSlider = document.getElementById('modal-percent-slider');
        if (currentPercentValue) currentPercentValue.textContent = DOM.percentSlider.value;
        if (modalPercentValue) modalPercentValue.textContent = DOM.percentSlider.value;
        if (modalPercentSlider) modalPercentSlider.value = DOM.percentSlider.value;
        markAllFilesForRecalculation();
        debouncedUpdate();
    });

    DOM.formatSelect?.addEventListener('change', () => {
        DOM.qualityGroup.style.display = DOM.formatSelect.value === 'png' ? 'none' : 'block';
        const modalFormatSelect = document.getElementById('modal-format-select');
        if (modalFormatSelect) modalFormatSelect.value = DOM.formatSelect.value;
        markAllFilesForRecalculation();
        debouncedUpdate();
        if (state.budgetMode && state.fileQueue.length > 0) {
            applyBudgetSettings();
        }
    });

    DOM.qualitySlider?.addEventListener('input', () => {
        const currentQualityValue = document.getElementById('quality-value');
        const modalQualityValue = document.getElementById('modal-quality-value');
        const modalQualitySlider = document.getElementById('modal-quality-slider');
        if (currentQualityValue) currentQualityValue.textContent = DOM.qualitySlider.value;
        if (modalQualityValue) modalQualityValue.textContent = DOM.qualitySlider.value;
        if (modalQualitySlider) modalQualitySlider.value = DOM.qualitySlider.value;
        markAllFilesForRecalculation();
        debouncedUpdate();
    });

    // Drop zone event listeners
    DOM.dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOM.dropZone.classList.add('dragover');
    });

    DOM.dropZone?.addEventListener('dragleave', () => {
        DOM.dropZone.classList.remove('dragover');
    });

    DOM.dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        DOM.dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    DOM.dropZone?.addEventListener('click', () => {
        DOM.fileInput?.click();
    });

    DOM.fileInput?.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Process button
    DOM.processButton?.addEventListener('click', processAndDownload);

    // File management buttons
    const addFilesBtn = document.getElementById('add-files-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');

    if (addFilesBtn) {
        addFilesBtn.addEventListener('click', () => {
            DOM.fileInput?.click();
        });
    }

    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            if (confirm(getTranslation('confirmReset') || 'Alle Dateien entfernen?')) {
                // Redirect to landing page as requested
                window.location.href = './';
            }
        });
    }

    // Calculate All button
    const calculateAllBtn = document.getElementById('calculate-all-btn');
    if (calculateAllBtn) {
        calculateAllBtn.addEventListener('click', async () => {
            calculateAllBtn.disabled = true;
            calculateAllBtn.textContent = getTranslation('calculating') || 'Berechne...';

            await calculateAllRealSizes((current, total) => {
                calculateAllBtn.textContent = `${current}/${total}`;
            });

            calculateAllBtn.disabled = false;
            calculateAllBtn.textContent = getTranslation('calculateAll') || 'Alle berechnen';
            renderFileQueue();
            updateTotalSizeEstimate();

            // Recalibrate budget with real sizes
            if (state.budgetMode && state.fileQueue.length > 0) {
                applyBudgetSettings();
            }
        });
    }

    // Emergency reset button
    const emergencyResetBtn = document.getElementById('emergency-reset-btn');
    if (emergencyResetBtn) {
        emergencyResetBtn.addEventListener('click', () => {
            if (confirm('Aktuelle Transformation abbrechen?')) {
                cancelCurrentTransformation();
                alert('Transformation wurde abgebrochen!');
            }
        });

        // Show only when transformation is running
        setInterval(() => {
            if (emergencyResetBtn) {
                emergencyResetBtn.style.display = state.isTransforming ? 'block' : 'none';
            }
        }, 500);
    }

    // Modal event listeners
    DOM.modalCloseBtn?.addEventListener('click', closePreviewModal);
    DOM.modalOverlay?.addEventListener('click', closePreviewModal);
    DOM.modalPrevBtn?.addEventListener('click', showPrevFile);
    DOM.modalNextBtn?.addEventListener('click', showNextFile);

    // Theme toggle
    DOM.themeToggle?.addEventListener('click', toggleTheme);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.activePreviewIndex > -1) {
            // Don't switch images if user is typing in an input or moving a slider
            const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);

            if (e.key === 'Escape') closePreviewModal();
            if (!isInput) {
                if (e.key === 'ArrowLeft') showPrevFile();
                if (e.key === 'ArrowRight') showNextFile();
            }
        }
    });

    // Zoom controls
    DOM.zoomSlider?.addEventListener('input', (e) => {
        state.zoomState.scale = parseFloat(e.target.value);
        updateZoomPercentage();
        applyZoomAndPan();
    });

    DOM.resetZoomBtn?.addEventListener('click', () => {
        resetZoom();
        updateZoomPercentage();
    });

    // A/B Comparison zoom/pan
    const abComparisonContainer = document.getElementById('ab-comparison');
    if (abComparisonContainer) {
        setupZoomPanListeners(abComparisonContainer);
    }

    // Budget mode toggle
    const budgetToggle = document.getElementById('budget-mode-toggle');
    const budgetInputGroup = document.getElementById('budget-input-group');
    const budgetSlider = document.getElementById('budget-slider');
    const budgetValue = document.getElementById('budget-value');

    if (budgetToggle) {
        budgetToggle.addEventListener('change', () => {
            const enabled = budgetToggle.checked;
            setBudgetMode(enabled);
            if (budgetInputGroup) budgetInputGroup.style.display = enabled ? 'block' : 'none';

            // Disable/enable manual sliders
            if (DOM.qualitySlider) DOM.qualitySlider.disabled = enabled;
            if (DOM.percentSlider) DOM.percentSlider.disabled = enabled;
            if (DOM.qualitySlider) DOM.qualitySlider.closest('.form-group')?.classList.toggle('slider-disabled', enabled);
            if (DOM.percentSlider) DOM.percentSlider.closest('.form-group')?.classList.toggle('slider-disabled', enabled);

            if (enabled && state.fileQueue.length > 0) {
                applyBudgetSettings();
            }
        });
    }

    if (budgetSlider) {
        budgetSlider.addEventListener('input', () => {
            if (budgetValue) budgetValue.textContent = budgetSlider.value;
            setBudgetTargetMB(parseInt(budgetSlider.value, 10));
            if (state.budgetMode && state.fileQueue.length > 0) {
                applyBudgetSettings();
            }
        });
    }

    // File list click delegation
    DOM.fileListContainer?.addEventListener('click', (e) => {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;

        const index = parseInt(fileItem.dataset.index, 10);

        // Check if control button was clicked
        const controlBtn = e.target.closest('.control-btn');
        if (controlBtn) {
            e.stopPropagation();
            const action = controlBtn.dataset.action;

            if (action === 'download') {
                const prevIndex = state.activePreviewIndex;
                state.setActivePreviewIndex(index);
                savePreviewImage().then(() => {
                    state.setActivePreviewIndex(prevIndex);
                });
                return;
            }

            handleTransformation(index, action);
            return;
        }

        // Otherwise open preview modal
        const mainContent = e.target.closest('.file-item-main-content');
        if (mainContent) {
            openPreviewModal(index);
        }
    });
}

/**
 * Set up zoom and pan listeners for A/B comparison
 * @param {HTMLElement} container 
 */
function setupZoomPanListeners(container) {
    // Mouse events
    container.addEventListener('mousedown', (e) => {
        if (state.zoomState.scale <= 1) return;
        if (e.target.id === 'ab-slider-handle') return;

        e.preventDefault();
        state.zoomState.isPanning = true;
        state.zoomState.startX = e.clientX - state.zoomState.panX;
        state.zoomState.startY = e.clientY - state.zoomState.panY;
        container.classList.add('panning-active');
    });

    container.addEventListener('mousemove', (e) => {
        if (!state.zoomState.isPanning) return;
        e.preventDefault();
        state.zoomState.panX = e.clientX - state.zoomState.startX;
        state.zoomState.panY = e.clientY - state.zoomState.startY;
        applyZoomAndPan();
    });

    const stopPan = () => {
        state.zoomState.isPanning = false;
        container.classList.remove('panning-active');
    };

    container.addEventListener('mouseup', stopPan);
    container.addEventListener('mouseleave', stopPan);

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? -0.2 : 0.2;
        const newScale = Math.max(1, Math.min(20, state.zoomState.scale + zoomDelta));
        state.zoomState.scale = newScale;

        const zoomSlider = DOM.zoomSlider || document.getElementById('zoom-slider');
        if (zoomSlider) zoomSlider.value = newScale;

        updateZoomPercentage();
        applyZoomAndPan();
    });

    // Touch events
    let initialPinchDistance = null;
    let initialScale = 1;

    const getDistance = (touches) => {
        return Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
        );
    };

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            if (state.zoomState.scale <= 1) return;
            if (e.target.id === 'ab-slider-handle') return;

            state.zoomState.isPanning = true;
            state.zoomState.startX = e.touches[0].clientX - state.zoomState.panX;
            state.zoomState.startY = e.touches[0].clientY - state.zoomState.panY;
        } else if (e.touches.length === 2) {
            e.preventDefault();
            initialPinchDistance = getDistance(e.touches);
            initialScale = state.zoomState.scale;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && state.zoomState.isPanning) {
            e.preventDefault();
            state.zoomState.panX = e.touches[0].clientX - state.zoomState.startX;
            state.zoomState.panY = e.touches[0].clientY - state.zoomState.startY;
            applyZoomAndPan();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches);
            const ratio = currentDistance / initialPinchDistance;
            let newScale = Math.max(1, Math.min(20, initialScale * ratio));

            state.zoomState.scale = newScale;
            const zoomSlider = DOM.zoomSlider || document.getElementById('zoom-slider');
            if (zoomSlider) zoomSlider.value = newScale;

            updateZoomPercentage();
            applyZoomAndPan();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialPinchDistance = null;
        }
        if (e.touches.length === 0) {
            state.zoomState.isPanning = false;
        }
    });
}

// ============================================
// BUDGET MODE
// ============================================

/** @type {number} Cached calibration factor from last real size calculation */
let lastCalibrationFactor = 1.0;

/**
 * Compute calibration factor from real vs estimated sizes.
 * Compares real sizes against what the estimator would predict for the SAME dimensions.
 * @returns {number} calibration factor (< 1 when estimates are too high, typical)
 */
function computeCalibrationFactor() {
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');
    const format = formatSelect?.value || 'webp';
    const quality = parseFloat(qualitySlider?.value || 85) / 100;

    let totalReal = 0;
    let totalEstimated = 0;

    for (const f of state.fileQueue) {
        if (f.hasRealCalculation && f.realSize && f.realDims) {
            totalReal += f.realSize;
            // Re-estimate at the same dimensions the real calc used
            import('./image-processing.js').then(() => {}); // ensure loaded
            totalEstimated += estimateProcessedSizeSync(f, f.realDims.w, f.realDims.h, format, quality);
        }
    }

    if (totalEstimated === 0) return 1.0;
    const factor = totalReal / totalEstimated;
    lastCalibrationFactor = factor;
    return factor;
}

/**
 * Synchronous wrapper to call estimateProcessedSize from already-imported module.
 */
function estimateProcessedSizeSync(fileObj, w, h, format, quality) {
    // estimateProcessedSize is already imported via calculateBudgetSettings
    // We replicate the formula here to avoid async import issues
    const pixelCount = w * h;
    const compressionFactors = {
        jpeg: 0.15 + (1 - quality) * 0.25,
        webp: 0.10 + (1 - quality) * 0.20,
        png: 0.5,
        svg: 0.3,
    };
    const factor = compressionFactors[format] || 0.2;
    let estimatedSize = pixelCount * factor;
    if (format !== 'png' && format !== 'svg') {
        estimatedSize *= (0.3 + quality * 0.7);
    }
    return Math.max(1000, Math.round(estimatedSize));
}

/**
 * Apply budget settings: calculate optimal quality/scale and update UI.
 * When called after real calculation, uses calibration to maximize budget usage.
 */
export function applyBudgetSettings() {
    // Use cached calibration if real sizes exist, otherwise 1.0
    const hasAnyRealSizes = state.fileQueue.some(f => f.hasRealCalculation && f.realSize);
    const factor = hasAnyRealSizes ? computeCalibrationFactor() : 1.0;

    const result = calculateBudgetSettings(state.budgetTargetMB, state.fileQueue, factor);
    const budgetStatus = document.getElementById('budget-status');

    // Update sliders visually
    if (DOM.qualitySlider) {
        DOM.qualitySlider.value = result.quality;
        const qualityValue = document.getElementById('quality-value');
        if (qualityValue) qualityValue.textContent = result.quality;
    }
    if (DOM.percentSlider) {
        DOM.percentSlider.value = result.scale;
        const percentValue = document.getElementById('percent-value');
        if (percentValue) percentValue.textContent = result.scale;
    }

    // Update budget status
    if (budgetStatus) {
        const sizeMB = (result.totalEstimated / (1024 * 1024)).toFixed(1);
        const calibrated = factor < 0.99 ? ' (kalibriert)' : '';
        if (result.achievable) {
            budgetStatus.className = 'budget-status budget-fits';
            budgetStatus.textContent = `✓ ~${sizeMB} MB${calibrated} — ${getTranslation('budgetFits') || 'Passt ins Budget'}`;
        } else {
            budgetStatus.className = 'budget-status budget-over';
            budgetStatus.textContent = `⚠ ~${sizeMB} MB — ${getTranslation('budgetOver') || 'Über Budget'}`;
        }
    }

    // Mark estimates as needing update (but preserve real sizes!)
    state.fileQueue.forEach(f => {
        f.needsRecalculation = true;
        f.estimatedSize = null;
        f.estimatedDims = null;
        state.changedFiles.add(f.id);
    });
    debouncedUpdate();
}

// ============================================
// DASHBOARD/WORKSPACE NAVIGATION
// ============================================

/**
 * Show dashboard view
 */
export function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('workspace').style.display = 'none';
    resetWorkspace();
    stopMemoryCleanup();
}

/**
 * Show workspace view
 */
export function showWorkspace() {
    document.getElementById('dashboard').style.display = 'none';
    const workspace = document.getElementById('workspace');
    workspace.style.display = window.innerWidth <= 800 ? 'flex' : 'grid';
    startMemoryCleanup();
}

// ============================================
// START APPLICATION
// ============================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
} else {
    setup();
}

// Export for global access if needed
window.handleFiles = handleFiles;
window.openPreviewModal = openPreviewModal;
