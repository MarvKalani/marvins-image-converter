/**
 * modal.js - Preview modal controls and A/B comparison
 * Part of Marvin's Image Converter modular architecture
 */

import { icons, DOM } from './config.js';
import { formatBytes } from './utils.js';
import { getTranslation } from './i18n.js';
import { triggerMemoryCleanup } from './memory.js';
import * as state from './state.js';
import { renderFileQueue, debouncedUpdate } from './file-queue-v2.js';
import { processSingleImage } from './image-processing.js';
import { handleTransformation } from './transformations.js';

// ============================================
// MODAL STATE
// ============================================

let modalEventListenerAdded = false;
let lastModalTransformation = 0;
const MODAL_TRANSFORM_DEBOUNCE = 100;

// A/B comparison orientation: 'horizontal' (vertical divider) or 'vertical' (horizontal divider)
let abOrientation = 'horizontal';

// ============================================
// MODAL OPEN/CLOSE
// ============================================

/**
 * Open preview modal for a file
 * @param {number} index - File index in queue
 */
export function openPreviewModal(index) {
    if (index < 0 || index >= state.fileQueue.length) return;

    state.setActivePreviewIndex(index);

    const modalOverlay = DOM.modalOverlay || document.getElementById('modal-overlay');
    const previewModal = DOM.previewModal || document.getElementById('preview-modal');

    modalOverlay.style.display = 'block';
    previewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    resetZoom();
    renderFileQueue();
    updateModalContent(state.autoPreviewEnabled);

    setTimeout(() => {
        initModalPreviewControls();
        initABComparison();
        initSVGSettings();
        // Ensure format settings are synced
        syncModalFormatSettings();
    }, 50);
}

/**
 * Close the preview modal
 */
export function closePreviewModal() {
    state.setActivePreviewIndex(-1);

    const modalOverlay = DOM.modalOverlay || document.getElementById('modal-overlay');
    const previewModal = DOM.previewModal || document.getElementById('preview-modal');

    modalOverlay.style.display = 'none';
    previewModal.style.display = 'none';
    document.body.style.overflow = '';

    renderFileQueue();
    triggerMemoryCleanup();
}

/**
 * Show previous file in modal
 */
export function showPrevFile() {
    const newIndex = (state.activePreviewIndex - 1 + state.fileQueue.length) % state.fileQueue.length;
    state.setActivePreviewIndex(newIndex);
    renderFileQueue();
    updateModalContent(state.autoPreviewEnabled);
}

/**
 * Show next file in modal
 */
export function showNextFile() {
    const newIndex = (state.activePreviewIndex + 1) % state.fileQueue.length;
    state.setActivePreviewIndex(newIndex);
    renderFileQueue();
    updateModalContent(state.autoPreviewEnabled);
}

// ============================================
// MODAL CONTENT
// ============================================

/**
 * Update modal content
 * @param {boolean} generatePreview - Whether to generate preview
 */
export async function updateModalContent(generatePreview = false) {
    if (state.activePreviewIndex < 0 || state.activePreviewIndex >= state.fileQueue.length) return;

    const fileObj = state.fileQueue[state.activePreviewIndex];

    // Update title
    const modalTitle = DOM.modalTitle || document.getElementById('modal-title');
    if (modalTitle) {
        modalTitle.textContent = fileObj.file.name;
    }

    // Update original image (only if source or transform changed to prevent flicker)
    const modalOriginalImage = DOM.modalOriginalImage || document.getElementById('modal-original-image');
    if (modalOriginalImage) {
        // Only update src if it changed
        if (modalOriginalImage.src !== fileObj.previewUrl) {
            modalOriginalImage.src = fileObj.previewUrl;
        }
        // Always update transform in case it changed, but compare first
        const newTransform = `rotate(${fileObj.rotation}deg) scale(${fileObj.scaleX}, ${fileObj.scaleY})`;
        if (modalOriginalImage.style.transform !== newTransform) {
            modalOriginalImage.style.transform = newTransform;
        }
    }

    // Update original info
    const modalOriginalInfoText = DOM.modalOriginalInfoText || document.getElementById('modal-original-info-text');
    if (modalOriginalInfoText) {
        const originalLabel = getTranslation('originalImage') || 'Original';
        modalOriginalInfoText.innerHTML = `<strong>${originalLabel}:</strong> ${fileObj.originalWidth}×${fileObj.originalHeight}px - ${formatBytes(fileObj.file.size)}`;
    }

    // Update preview image
    const modalPreviewImage = DOM.modalPreviewImage || document.getElementById('modal-preview-image');
    const modalPreviewInfoText = DOM.modalPreviewInfoText || document.getElementById('modal-preview-info-text');

    if (generatePreview) {
        // Show loading state
        if (modalPreviewInfoText) {
            modalPreviewInfoText.textContent = getTranslation('generating') || 'Generiere...';
        }

        try {
            // Create progress callback for SVG vectorizing
            const onProgress = (iterations) => {
                if (modalPreviewInfoText) {
                    modalPreviewInfoText.textContent = `Vectorizing... (${iterations} iterations)`;
                }
            };

            const result = await processSingleImage(fileObj, { onProgress });

            if (modalPreviewImage) {
                modalPreviewImage.src = result.dataUrl;
            }

            if (modalPreviewInfoText) {
                const realLabel = getTranslation('realSize') || 'Real';
                modalPreviewInfoText.innerHTML = `<strong>${realLabel}:</strong> ${result.targetWidth}×${result.targetHeight}px - ${formatBytes(result.size)}`;
            }

            // Re-apply zoom and pan after preview update
            applyZoomAndPan(fileObj);

        } catch (error) {
            console.error('Error generating preview:', error);
            if (modalPreviewInfoText) {
                modalPreviewInfoText.textContent = getTranslation('error') || 'Fehler';
            }
        }
    } else {
        // Show estimated values
        const dims = fileObj.realDims || fileObj.estimatedDims;
        const size = fileObj.realSize || fileObj.estimatedSize;

        if (modalPreviewInfoText) {
            if (dims && size) {
                const label = fileObj.hasRealCalculation
                    ? (getTranslation('calculatedSize') || 'Berechnet')
                    : (getTranslation('estimatedSize') || 'Geschätzt');
                modalPreviewInfoText.innerHTML = `<strong>${label}:</strong> ${dims.w}×${dims.h}px - ca. ${formatBytes(size)}`;
            } else {
                modalPreviewInfoText.textContent = getTranslation('clickGeneratePreview') || 'Klicke für Vorschau';
            }
        }

        // Re-apply zoom and pan even for non-preview updates
        applyZoomAndPan(fileObj);
    }

    // Update transform controls
    updateModalTransformControls();

    // Update format-specific settings visibility
    updateModalFormatSettings();
}

/**
 * Regenerate modal preview
 */
export async function regenerateModalPreview() {
    await updateModalContent(true);
}

// ============================================
// MODAL CONTROLS
// ============================================

/**
 * Update modal transform controls
 */
function updateModalTransformControls() {
    const modalTransformControls = DOM.modalTransformControls || document.getElementById('modal-transform-controls');
    if (!modalTransformControls) return;

    modalTransformControls.innerHTML = `
		<button class="modal-control-btn" data-modal-action="download" title="${getTranslation('saveImage') || 'Bild speichern'}" style="margin-right: auto; padding: 0 10px; border-radius: 8px;">${icons.save}</button>
		<button class="modal-control-btn" data-modal-action="rotate-left" title="${getTranslation('rotateLeft')}">${icons.rotateLeft}</button>
		<button class="modal-control-btn" data-modal-action="rotate-right" title="${getTranslation('rotateRight')}">${icons.rotateRight}</button>
		<button class="modal-control-btn" data-modal-action="flip-horizontal" title="${getTranslation('flipHorizontal')}">${icons.flipHorizontal}</button>
		<button class="modal-control-btn" data-modal-action="flip-vertical" title="${getTranslation('flipVertical')}">${icons.flipVertical}</button>
	`;

    addModalTransformEventListener();
}

/**
 * Add event listeners for modal transformation buttons
 */
function addModalTransformEventListener() {
    if (modalEventListenerAdded) return;
    modalEventListenerAdded = true;

    const modalTransformControls = DOM.modalTransformControls || document.getElementById('modal-transform-controls');
    if (!modalTransformControls) return;

    modalTransformControls.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button || state.activePreviewIndex === -1) return;

        e.stopPropagation();
        const action = button.dataset.modalAction;



        const actionMap = {
            'rotate-left': 'rotate-left',
            'rotate-right': 'rotate-right',
            'flip-horizontal': 'flip-horizontal',
            'flip-vertical': 'flip-vertical',
        };

        if (actionMap[action]) {
            const now = Date.now();

            // Rate limiting
            if (now - lastModalTransformation < MODAL_TRANSFORM_DEBOUNCE) {
                console.log('Modal transformation rate limited');
                return;
            }

            lastModalTransformation = now;

            // Visual feedback
            button.style.transform = 'scale(0.9)';
            button.disabled = true;
            setTimeout(() => {
                button.style.transform = '';
                button.disabled = false;
            }, 200);

            // Cleanup before transformation
            triggerMemoryCleanup();
            handleTransformation(state.activePreviewIndex, actionMap[action]);

            // Update modal content
            setTimeout(() => {
                const autoPreviewCheckbox = document.getElementById('modal-auto-preview-checkbox');
                const shouldAutoPreview = autoPreviewCheckbox ? autoPreviewCheckbox.checked : state.autoPreviewEnabled;
                updateModalContent(shouldAutoPreview);
            }, 150);
        }
    });
}

/**
 * Update format-specific settings visibility
 */
function updateModalFormatSettings() {
    const modalFormatSelect = document.getElementById('modal-format-select');
    const svgSettings = document.getElementById('svg-settings-panel');
    const qualitySettings = document.getElementById('modal-quality-group');

    if (!modalFormatSelect) return;

    const format = modalFormatSelect.value;

    if (svgSettings) {
        svgSettings.style.display = format === 'svg' ? 'block' : 'none';
    }

    if (qualitySettings) {
        qualitySettings.style.display = format === 'png' || format === 'svg' ? 'none' : 'block';
    }
}

/**
 * Sync modal format settings with main controls
 */
function syncModalFormatSettings() {
    const modalFormatSelect = document.getElementById('modal-format-select');
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');

    if (modalFormatSelect && formatSelect) {
        modalFormatSelect.value = formatSelect.value;
    }

    updateModalFormatSettings();
}

/**
 * Initialize modal preview controls
 */
export function initModalPreviewControls() {
    const modalFormatSelect = document.getElementById('modal-format-select');
    const modalQualitySlider = document.getElementById('modal-quality-slider');
    const modalPercentSlider = document.getElementById('modal-percent-slider');
    const generatePreviewBtn = document.getElementById('generate-preview-btn');

    // Sync with main controls
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');
    const percentSlider = DOM.percentSlider || document.getElementById('percent-slider');

    if (modalFormatSelect && formatSelect) {
        modalFormatSelect.value = formatSelect.value;
        modalFormatSelect.onchange = () => {
            formatSelect.value = modalFormatSelect.value;
            updateModalFormatSettings();
            regenerateModalPreview();
        };
    }

    if (modalQualitySlider && qualitySlider) {
        modalQualitySlider.value = qualitySlider.value;
        modalQualitySlider.oninput = () => {
            const modalValEl = document.getElementById('modal-quality-value');
            const mainValEl = document.getElementById('quality-value');
            if (modalValEl) modalValEl.textContent = modalQualitySlider.value;
            if (mainValEl) mainValEl.textContent = modalQualitySlider.value;
            qualitySlider.value = modalQualitySlider.value;
        };
        modalQualitySlider.onchange = regenerateModalPreview;
    }

    if (modalPercentSlider && percentSlider) {
        modalPercentSlider.value = percentSlider.value;
        modalPercentSlider.oninput = () => {
            const modalValEl = document.getElementById('modal-percent-value');
            const mainValEl = document.getElementById('percent-value');
            if (modalValEl) modalValEl.textContent = modalPercentSlider.value;
            if (mainValEl) mainValEl.textContent = modalPercentSlider.value;
            percentSlider.value = modalPercentSlider.value;
        };
        modalPercentSlider.onchange = () => {
            state.fileQueue.forEach(f => {
                f.needsRecalculation = true;
                state.changedFiles.add(f.id);
            });
            regenerateModalPreview();
        };
    }

    if (generatePreviewBtn) {
        generatePreviewBtn.onclick = regenerateModalPreview;
    }

    // Save button handler
    const saveActionBtn = document.getElementById('save-action-btn');
    if (saveActionBtn) {
        saveActionBtn.onclick = savePreviewImage;
    }

    // Size mode toggle handler (percent vs pixels)
    const modalSizeMode = document.getElementById('modal-size-mode');
    const modalPercentRow = document.getElementById('modal-percent-row');
    const modalPixelRow = document.getElementById('modal-pixel-row');
    const modalPixelInput = document.getElementById('modal-pixel-input');

    if (modalSizeMode && modalPercentRow && modalPixelRow) {
        // Load saved preference
        const savedSizeMode = localStorage.getItem('marvins-image-converter-size-mode') || 'percent';
        modalSizeMode.value = savedSizeMode;
        modalPercentRow.style.display = savedSizeMode === 'percent' ? 'block' : 'none';
        modalPixelRow.style.display = savedSizeMode === 'pixels' ? 'block' : 'none';

        // Load saved pixel value
        const savedPixelValue = localStorage.getItem('marvins-image-converter-pixel-size') || '512';
        if (modalPixelInput) modalPixelInput.value = savedPixelValue;

        modalSizeMode.onchange = () => {
            const mode = modalSizeMode.value;
            modalPercentRow.style.display = mode === 'percent' ? 'block' : 'none';
            modalPixelRow.style.display = mode === 'pixels' ? 'block' : 'none';
            localStorage.setItem('marvins-image-converter-size-mode', mode);
            regenerateModalPreview();
        };
    }

    // Pixel input handler
    if (modalPixelInput) {
        modalPixelInput.onchange = () => {
            localStorage.setItem('marvins-image-converter-pixel-size', modalPixelInput.value);
            state.fileQueue.forEach(f => {
                f.needsRecalculation = true;
                state.changedFiles.add(f.id);
            });
            regenerateModalPreview();
        };
    }

    // Initialize precision buttons
    document.querySelectorAll('.precision-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const targetId = btn.dataset.target;
            const action = btn.dataset.action;
            const targetInput = document.getElementById(targetId);

            if (targetInput) {
                const step = parseFloat(targetInput.step) || 1;
                const min = parseFloat(targetInput.min);
                const max = parseFloat(targetInput.max);
                let val = parseFloat(targetInput.value);

                if (action === 'plus') {
                    val = Math.min(max, val + step);
                } else {
                    val = Math.max(min, val - step);
                }

                targetInput.value = val;
                // Dispatch events to trigger existing listeners
                targetInput.dispatchEvent(new Event('input'));
                targetInput.dispatchEvent(new Event('change'));
            }
        };
    });
}

/**
 * Save the current preview image to file
 */
export async function savePreviewImage() {
    if (state.activePreviewIndex === -1) return;
    const fileObj = state.fileQueue[state.activePreviewIndex];
    if (!fileObj) return;

    const saveBtn = document.getElementById('save-action-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const format = formatSelect ? formatSelect.value : 'webp';

    if (saveBtn) {
        saveBtn.disabled = true;
        if (saveBtnText) saveBtnText.textContent = getTranslation('processing') || 'Verarbeite...';
    }

    try {
        // Handle SVG format
        if (format === 'svg' && fileObj.svgData) {
            const blob = new Blob([fileObj.svgData], { type: 'image/svg+xml' });
            const originalName = fileObj.file.name.replace(/\.[^/.]+$/, '');
            const newFilename = `${originalName}.svg`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = newFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Process image and save
            const result = await processSingleImage(fileObj);
            if (result && result.dataUrl) {
                const a = document.createElement('a');
                a.href = result.dataUrl;
                const originalName = fileObj.file.name.replace(/\.[^/.]+$/, '');
                a.download = `${originalName}.${result.extension || format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    } catch (error) {
        console.error('Error saving image:', error);
        alert(getTranslation('error') || 'Fehler beim Speichern');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            if (saveBtnText) saveBtnText.textContent = getTranslation('saveImage') || 'Bild speichern';

            // Show ad after save (with delay for user to see success)
            import('./promo.js').then(module => {
                module.showAd('save');
            });
        }
    }
}

// ============================================
// ZOOM & PAN
// ============================================

/**
 * Reset zoom state
 */
export function resetZoom() {
    state.zoomState.scale = 1;
    state.zoomState.panX = 0;
    state.zoomState.panY = 0;
    state.zoomState.isPanning = false;

    const zoomSlider = DOM.zoomSlider || document.getElementById('zoom-slider');
    if (zoomSlider) {
        zoomSlider.value = 1;
    }

    updateZoomPercentage();
    applyZoomAndPan();
}

/**
 * Update zoom percentage display
 */
export function updateZoomPercentage() {
    const zoomPercentage = document.getElementById('zoom-percentage');
    if (zoomPercentage) {
        zoomPercentage.textContent = `${Math.round(state.zoomState.scale * 100)}%`;
    }
}

/**
 * Apply zoom and pan to comparison images
 */
export function applyZoomAndPan(providedFileObj = null) {
    // Use the correct element IDs from app-modular.html
    const originalWrapper = document.getElementById('ab-original-wrapper');
    const previewWrapper = document.getElementById('ab-preview-wrapper');

    const transformValue = `scale(${state.zoomState.scale}) translate(${state.zoomState.panX / state.zoomState.scale}px, ${state.zoomState.panY / state.zoomState.scale}px)`;

    if (previewWrapper) {
        const img = previewWrapper.querySelector('img');
        if (img) {
            // Preview image is already transformed (pixel-wise), so only zoom/pan
            img.style.transform = transformValue;
        }
    }

    if (originalWrapper) {
        const img = originalWrapper.querySelector('img');
        if (img) {
            // Original image needs CSS transformation to match pixel transformation
            let extraTransform = '';

            // Use provided object or lookup in state
            const fileObj = providedFileObj || (state.activePreviewIndex >= 0 ? state.fileQueue[state.activePreviewIndex] : null);

            if (fileObj) {
                const rotation = fileObj.rotation || 0;
                const scaleX = fileObj.scaleX || 1;
                const scaleY = fileObj.scaleY || 1;

                // Only append if there is actual transformation
                if (rotation !== 0 || scaleX !== 1 || scaleY !== 1) {
                    extraTransform = ` rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
                }
            }

            // Apply zoom/pan first (outer), then rotation/flip (inner)
            img.style.transform = transformValue + extraTransform;
        }
    }
}

// ============================================
// A/B COMPARISON
// ============================================

/**
 * Initialize A/B comparison slider with orientation toggle
 */
export function initABComparison() {
    const handle = document.getElementById('ab-slider-handle');
    const container = document.getElementById('ab-comparison');
    const previewWrapper = document.getElementById('ab-preview-wrapper');
    const originalWrapper = document.getElementById('ab-original-wrapper');
    const labelPreview = document.getElementById('ab-label-preview');
    const labelOriginal = document.getElementById('ab-label-original');
    const toggleBtn = document.getElementById('ab-split-toggle-btn');

    if (!handle || !container || !previewWrapper) {
        console.log('[modal] A/B comparison elements not found');
        return;
    }

    let isDragging = false;
    let sliderPosition = 50;

    const updateSliderPosition = (percent) => {
        percent = Math.max(0, Math.min(100, percent));
        sliderPosition = percent;

        if (abOrientation === 'horizontal') {
            // Horizontal mode (Vertical Divider) - Handle moves Left/Right
            handle.style.left = `${percent}%`;
            handle.style.top = '0';
            handle.style.bottom = '0';
            handle.style.width = '2px';
            handle.style.height = '100%';

            // Clip preview wrapper from right side
            previewWrapper.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;

            // Update labels
            if (labelPreview) {
                labelPreview.style.opacity = percent > 10 ? '1' : '0';
                labelPreview.style.top = '10px';
                labelPreview.style.left = '10px';
                labelPreview.style.bottom = 'auto';
                labelPreview.style.right = 'auto';
            }
            if (labelOriginal) {
                labelOriginal.style.opacity = percent < 90 ? '1' : '0';
                labelOriginal.style.top = '10px';
                labelOriginal.style.right = '10px';
                labelOriginal.style.bottom = 'auto';
                labelOriginal.style.left = 'auto';
            }
        } else {
            // Vertical mode (Horizontal Divider) - Handle moves Top/Bottom
            handle.style.top = `${percent}%`;
            handle.style.left = '0';
            handle.style.right = '0';
            handle.style.height = '2px';
            handle.style.width = '100%';

            // Clip preview wrapper from bottom
            previewWrapper.style.clipPath = `inset(0 0 ${100 - percent}% 0)`;

            // Update labels
            if (labelPreview) {
                labelPreview.style.opacity = percent > 10 ? '1' : '0';
                labelPreview.style.top = '10px';
                labelPreview.style.left = '10px';
                labelPreview.style.bottom = 'auto';
                labelPreview.style.right = 'auto';
            }
            if (labelOriginal) {
                labelOriginal.style.opacity = percent < 90 ? '1' : '0';
                labelOriginal.style.bottom = '10px';
                labelOriginal.style.right = '10px';
                labelOriginal.style.top = 'auto';
                labelOriginal.style.left = 'auto';
            }
        }
    };

    const getPositionFromEvent = (e) => {
        const rect = container.getBoundingClientRect();
        if (abOrientation === 'horizontal') {
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            return ((x - rect.left) / rect.width) * 100;
        } else {
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            return ((y - rect.top) / rect.height) * 100;
        }
    };

    // Mouse events
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
        document.body.style.cursor = abOrientation === 'horizontal' ? 'ew-resize' : 'ns-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateSliderPosition(getPositionFromEvent(e));
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = '';
    });

    // Touch events
    handle.addEventListener('touchstart', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            updateSliderPosition(getPositionFromEvent(e));
        }
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Click anywhere in container to move slider
    container.addEventListener('click', (e) => {
        if (e.target === handle) return;
        updateSliderPosition(getPositionFromEvent(e));
    });

    // Toggle orientation button
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            abOrientation = abOrientation === 'horizontal' ? 'vertical' : 'horizontal';

            if (abOrientation === 'vertical') {
                container.classList.add('ab-container-vertical');
                toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4h16v16H4z" /><path d="M12 4v16" /></svg>`;
            } else {
                container.classList.remove('ab-container-vertical');
                toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4v16h16V4z" /><path d="M4 12h16" /></svg>`;
            }

            // Reset position on toggle
            updateSliderPosition(50);
        };
    }

    // Initialize position
    updateSliderPosition(50);
}

/**
 * Initialize SVG settings event listeners
 */
export function initSVGSettings() {
    const svgSliders = [
        { id: 'svg-filter-speckle', valueId: 'svg-filter-value' },
        { id: 'svg-color-precision', valueId: 'svg-color-precision-value' },
        { id: 'svg-layer-difference', valueId: 'svg-layer-difference-value' },
        { id: 'svg-corner-threshold', valueId: 'svg-corner-value' },
        { id: 'svg-path-precision', valueId: 'svg-precision-value' },
        { id: 'svg-splice-threshold', valueId: 'svg-splice-threshold-value' },
        { id: 'svg-length-threshold', valueId: 'svg-length-threshold-value' },
        { id: 'svg-max-iterations', valueId: 'svg-max-iterations-value' },
    ];

    svgSliders.forEach(({ id, valueId }) => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(valueId);

        if (slider && valueDisplay) {
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value;
            });
            slider.addEventListener('change', () => {
                regenerateModalPreview();
            });
        }
    });

    // SVG hierarchical select
    const svgHierarchical = document.getElementById('svg-hierarchical');
    if (svgHierarchical) {
        svgHierarchical.addEventListener('change', () => {
            regenerateModalPreview();
        });
    }
}

// ============================================
// EVENT LISTENER FOR CUSTOM EVENTS
// ============================================

// Listen for update events from transformations module
document.addEventListener('updateModalContent', (e) => {
    updateModalContent(e.detail?.generatePreview || false);
});

// Listen for language changes to update modal content
document.addEventListener('languageChanged', () => {
    if (state.activePreviewIndex !== -1) {
        updateModalContent(false);
        updateModalTransformControls();
    }
});

