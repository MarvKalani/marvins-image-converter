/**
 * file-queue.js - File queue management and UI rendering
 * Part of Marvin's Image Converter modular architecture
 */

import { icons, DOM } from './config.js';
import { formatBytes, generateId, debounce } from './utils.js';
import { getTranslation } from './i18n.js';
import { triggerMemoryCleanup, revokeObjectURL } from './memory.js';
import * as state from './state.js';

// ============================================
// DEBOUNCED UPDATE
// ============================================

// Listen for language changes to re-render the queue
document.addEventListener('languageChanged', () => {
    renderFileQueue();
});

let debounceTimer = null;

/**
 * Debounced update for file estimates
 */
export const debouncedUpdate = debounce(() => {
    updateAllEstimates();
    renderFileQueue();
}, 300);

/**
 * Debounced selective update
 */
export const debouncedSelectiveUpdate = debounce(() => {
    updateChangedEstimates();
    renderFileQueue();
}, 200);

// ============================================
// FILE HANDLING
// ============================================

/**
 * Handle files dropped or selected
 * @param {FileList|File[]} files 
 */
export async function handleFiles(files) {
    if (files.length === 0) return;

    // Show workspace (will be called from main.js)
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.style.display = 'none';
    const workspace = document.getElementById('workspace');
    if (workspace) {
        workspace.style.display = window.innerWidth <= 800 ? 'flex' : 'grid';
    }

    let fileCountDisplay = document.getElementById('file-count-display');
    if (fileCountDisplay) {
        fileCountDisplay.textContent = `${files.length} ${getTranslation('filesCount')} ${getTranslation('filesLoading')}`;
    }

    const allFiles = Array.from(files);
    const isHeic = (f) => f.type === 'image/heic' || f.type === 'image/heif' || /\.heic$/i.test(f.name) || /\.heif$/i.test(f.name);
    const imageFiles = allFiles.filter((f) => f.type.startsWith('image/') || isHeic(f));
    const totalFiles = imageFiles.length;

    // Asynchronous loading of individual files
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        fileCountDisplay = document.getElementById('file-count-display');
        if (fileCountDisplay) {
            fileCountDisplay.textContent = `${getTranslation('filesLoading')} ${i + 1}/${totalFiles}...`;
        }

        try {
            const previewUrl = URL.createObjectURL(file);
            const img = new Image();
            img.src = previewUrl;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const fileObj = {
                id: generateId(),
                file,
                previewUrl,
                originalWidth: img.width,
                originalHeight: img.height,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                estimatedSize: null,
                estimatedDims: null,
                realSize: null,
                realDims: null,
                hasRealCalculation: false,
                needsRecalculation: true,
            };

            state.fileQueue.push(fileObj);
            state.changedFiles.add(fileObj.id);

            // UI update after each loaded file
            const totalOriginalBytes = state.fileQueue.reduce((sum, f) => sum + f.file.size, 0);
            if (DOM.totalOriginalSizeSpan) {
                DOM.totalOriginalSizeSpan.textContent = formatBytes(totalOriginalBytes);
            }
            renderFileQueue();
        } catch (error) {
            console.error(`Error loading ${file.name}:`, error);
            if (isHeic(file)) {
                const msg = getTranslation('heicNotSupported') || 'HEIC files are only supported in Safari. Please open this page in Safari or convert your iPhone settings: Settings → Camera → Formats → Most Compatible.';
                alert(msg);
                break;
            }
        }
    }

    fileCountDisplay = document.getElementById('file-count-display');
    if (fileCountDisplay) {
        fileCountDisplay.textContent = `${state.fileQueue.length} ${getTranslation('filesCount')}`;
    }

    debouncedUpdate();

    // Recalculate budget if budget mode is active
    if (state.budgetMode) {
        import('./main.js').then(({ applyBudgetSettings }) => applyBudgetSettings());
    }
}

// ============================================
// FILE QUEUE RENDERING
// ============================================

/**
 * Render the file queue in the UI
 */
export function renderFileQueue() {
    const container = DOM.fileListContainer;
    if (!container) return;

    container.innerHTML = '';

    if (state.fileQueue.length === 0) {
        renderEmptyState(container);
        return;
    }

    // Add hint text when there are files
    const hintDiv = document.createElement('div');
    hintDiv.style.cssText = 'font-size: 13px; color: var(--text-muted-color); margin: 10px 0; text-align: center; padding: 10px; background-color: var(--surface-color); border-radius: 5px; border: 1px solid var(--border-color);';
    hintDiv.setAttribute('data-translate', 'clickFilePreview');
    hintDiv.textContent = getTranslation('clickFilePreview');
    container.appendChild(hintDiv);

    state.fileQueue.forEach((f, index) => {
        const itemDiv = createFileItem(f, index);
        container.appendChild(itemDiv);
    });

    // Update file count display
    const fileCountDisplay = document.getElementById('file-count-display');
    if (fileCountDisplay) {
        fileCountDisplay.textContent = `${state.fileQueue.length} ${getTranslation('filesCount')}`;
    }
}

/**
 * Render empty state placeholder
 * @param {HTMLElement} container 
 */
function renderEmptyState(container) {
    container.innerHTML = `
		<div style="
			display: flex; 
			flex-direction: column; 
			align-items: center; 
			justify-content: center; 
			height: 100%; 
			min-height: 200px;
			color: var(--text-muted-color); 
			text-align: center;
			padding: 20px;
			border: 2px dashed var(--border-color);
			border-radius: 10px;
			box-sizing: border-box;
			cursor: pointer;
			opacity: 0.7;
			transition: all 0.3s;
		" onclick="document.getElementById('file-input').click()"
		  onmouseover="this.style.opacity=1; this.style.borderColor='var(--primary-color)'" 
		  onmouseout="this.style.opacity=0.7; this.style.borderColor='var(--border-color)'">
			<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 20px; opacity: 0.5;">
				<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
				<path d="M15 8h.01" />
				<path d="M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5" />
				<path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4" />
				<path d="M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54" />
				<path d="M16 19h6" />
				<path d="M19 16v6" />
			</svg>
			<h3 data-translate="noFilesSelected" style="margin: 0 0 10px 0; color: var(--text-color); font-size: 1.1em;">${getTranslation('noFilesSelected') || 'Keine Dateien ausgewählt'}</h3>
			<p data-translate="dropZone" style="margin: 0; font-size: 0.9em;">${getTranslation('dropZone') || 'Dateien hier ablegen'}</p>
		</div>
	`;

    const fileCountDisplay = document.getElementById('file-count-display');
    if (fileCountDisplay) {
        fileCountDisplay.textContent = getTranslation('noFilesSelected') || 'Keine Dateien ausgewählt';
    }
    if (DOM.totalOriginalSizeSpan) {
        DOM.totalOriginalSizeSpan.textContent = '0 KB';
    }
    if (DOM.totalEstimatedSizeSpan) {
        DOM.totalEstimatedSizeSpan.textContent = '...';
    }

    // Reset state label
    const labelSpan = document.getElementById('total-estimated-label');
    const sizeWrapper = document.getElementById('size-estimate-wrapper');
    if (labelSpan) labelSpan.textContent = getTranslation('estimatedSize') || 'Geschätzt:';
    if (sizeWrapper) sizeWrapper.classList.remove('estimated', 'calculated', 'real');
}

/**
 * Create a file item element
 * @param {Object} f - File object
 * @param {number} index - Index in queue
 * @returns {HTMLElement}
 */
function createFileItem(f, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'file-item';
    itemDiv.dataset.index = index;

    if (index === state.activePreviewIndex) {
        itemDiv.classList.add('active');
    }

    // Use real values if available, otherwise estimated values
    const isRealCalc = f.hasRealCalculation && f.realSize !== null;
    const currentSize = isRealCalc ? f.realSize : f.estimatedSize || 0;
    const originalSize = f.file.size;
    const sizeText = currentSize ? formatBytes(currentSize) : '...';

    // Calculate percentage change
    let percentageText = '';
    if (currentSize && originalSize) {
        const percentageChange = ((currentSize - originalSize) / originalSize) * 100;
        const sign = percentageChange >= 0 ? '+' : '';
        percentageText = ` (${sign}${percentageChange.toFixed(1)}%)`;
    }

    // Determine the state: real (processed), calculated, or estimated
    const hasProcessedValues = f.processedSize !== undefined && f.processedSize !== null;
    const isCalculated = isRealCalc && !hasProcessedValues;
    const isRealProcessed = hasProcessedValues;

    const dimsText = isRealCalc
        ? `${f.realDims.w}x${f.realDims.h}px`
        : f.estimatedDims
            ? `${f.estimatedDims.w}x${f.estimatedDims.h}px`
            : '...';

    // Determine label and color based on actual state
    let labelTextKey, labelTitleKey, colorStyle;
    if (isRealProcessed) {
        labelTextKey = 'realSize';
        labelTitleKey = 'realCalculation';
        colorStyle = '#4CAF50'; // Green for real processed values
    } else if (isCalculated) {
        labelTextKey = 'calculatedSize';
        labelTitleKey = 'realCalculation';
        colorStyle = '#FFA000'; // Yellow for calculated values
    } else {
        labelTextKey = 'estimatedSize';
        labelTitleKey = 'estimation';
        colorStyle = 'var(--text-muted-color)'; // Gray for estimated values
    }

    itemDiv.innerHTML = `
        <div class="file-item-main-content">
            <div class="file-item-thumbnail-wrapper">
                <img src="${f.previewUrl}" class="file-item-thumbnail" style="transform: rotate(${f.rotation}deg) scale(${f.scaleX}, ${f.scaleY});">
            </div>
            <div class="file-item-info">
                <p class="file-item-name">${f.file.name}</p>
                <p class="file-item-dims">${f.originalWidth}x${f.originalHeight}px 
                    <span class="file-item-estimate-arrow">→</span> 
                    <strong class="file-item-estimate" data-estimate-id-dims="${f.id}" style="color: ${colorStyle};" title="${getTranslation(labelTitleKey)}">${dimsText}</strong> 
                    (${getTranslation(labelTextKey)})
                </p>
                <p class="file-item-sizes">${formatBytes(f.file.size)} 
                    <span class="file-item-estimate-arrow">→</span> 
                    <strong class="file-item-estimate" data-estimate-id-size="${f.id}" style="color: ${colorStyle};" title="${getTranslation(labelTitleKey)}">${sizeText}</strong>${percentageText} 
                    (${getTranslation(labelTextKey)})
                </p>
            </div>
        </div>
        <div class="file-item-controls">
            <!-- Ensure download button SVG is safely interpolated without quotes breaking HTML -->
            <button class="control-btn download-btn" data-action="download" title="${getTranslation('saveImage') || 'Bild speichern'}">
                ${icons.save}
            </button>
            <button class="control-btn" data-action="rotate-left" title="${getTranslation('rotateLeft')}">${icons.rotateLeft}</button>
            <button class="control-btn" data-action="rotate-right" title="${getTranslation('rotateRight')}">${icons.rotateRight}</button>
            <button class="control-btn" data-action="flip-horizontal" title="${getTranslation('flipHorizontal')}">${icons.flipHorizontal}</button>
            <button class="control-btn" data-action="flip-vertical" title="${getTranslation('flipVertical')}">${icons.flipVertical}</button>
            <button class="control-btn" data-action="calculate-real" title="${getTranslation('calculateRealSize')}">📏</button>
            <button class="control-btn remove-btn" data-action="remove-file" title="${getTranslation('removeFile')}" style="color: #f44336;">${icons.removeFile}</button>
        </div>
    `;

    // Event delegation for clicks
    const fileItemMainContent = itemDiv.querySelector('.file-item-main-content');
    const fileItemControls = itemDiv.querySelector('.file-item-controls');

    // These will be connected in main.js
    itemDiv._onMainClick = () => index;
    itemDiv._onControlClick = (action) => ({ index, action });

    return itemDiv;
}

// ============================================
// FILE OPERATIONS
// ============================================

/**
 * Remove a file from the queue
 * @param {number} index 
 */
export function removeFile(index) {
    if (index < 0 || index >= state.fileQueue.length) return;

    const file = state.fileQueue[index];

    // Clean up URLs
    if (file.previewUrl) {
        revokeObjectURL(file.previewUrl);
    }
    if (file.processedUrl) {
        revokeObjectURL(file.processedUrl);
    }

    // Remove from queue
    state.fileQueue.splice(index, 1);
    state.changedFiles.delete(file.id);

    // Adjust active preview index
    if (state.activePreviewIndex >= state.fileQueue.length) {
        state.setActivePreviewIndex(state.fileQueue.length - 1);
    }

    // Update UI
    renderFileQueue();
    updateTotalSizeEstimate();
    triggerMemoryCleanup();

    // Recalculate budget if budget mode is active
    if (state.budgetMode && state.fileQueue.length > 0) {
        import('./main.js').then(({ applyBudgetSettings }) => applyBudgetSettings());
    }

    // If no files left, show dashboard
    if (state.fileQueue.length === 0) {
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('workspace').style.display = 'none';
    }
}

/**
 * Mark all files for recalculation
 */
export function markAllFilesForRecalculation() {
    state.fileQueue.forEach((f) => {
        f.needsRecalculation = true;
        f.hasRealCalculation = false;
        f.realSize = null;
        f.realDims = null;
        state.changedFiles.add(f.id);
    });
}

/**
 * Reset the workspace
 */
export function resetWorkspace() {
    // Clean up all blob URLs before clearing
    state.fileQueue.forEach((f) => {
        if (f.previewUrl) revokeObjectURL(f.previewUrl);
        if (f.processedUrl) revokeObjectURL(f.processedUrl);
    });

    state.clearFileState();

    if (DOM.fileListContainer) DOM.fileListContainer.innerHTML = '';
    if (DOM.percentSlider) DOM.percentSlider.value = 100;

    const currentPercentValue = document.getElementById('percent-value');
    if (currentPercentValue) currentPercentValue.textContent = '100';

    if (DOM.formatSelect) DOM.formatSelect.value = 'webp';
    if (DOM.qualitySlider) DOM.qualitySlider.value = 85;

    const currentQualityValue = document.getElementById('quality-value');
    if (currentQualityValue) currentQualityValue.textContent = '85';

    if (DOM.qualityGroup) DOM.qualityGroup.style.display = 'block';
    if (DOM.totalOriginalSizeSpan) DOM.totalOriginalSizeSpan.textContent = '0 KB';
    if (DOM.totalEstimatedSizeSpan) DOM.totalEstimatedSizeSpan.textContent = '...';

    triggerMemoryCleanup();
}

// ============================================
// SIZE ESTIMATION
// ============================================

/**
 * Update all file estimates
 */
export function updateAllEstimates() {
    // Import dynamically to avoid circular dependency
    import('./image-processing.js').then(({ estimateFileSize }) => {
        state.fileQueue.forEach((f) => {
            if (f.needsRecalculation) {
                const estimate = estimateFileSize(f);
                f.estimatedSize = estimate.size;
                f.estimatedDims = { w: estimate.width, h: estimate.height };
                f.needsRecalculation = false;
            }
        });
        updateTotalSizeEstimate();
    });
}

/**
 * Update only changed file estimates
 */
export function updateChangedEstimates() {
    import('./image-processing.js').then(({ estimateFileSize }) => {
        state.changedFiles.forEach((id) => {
            const f = state.fileQueue.find((file) => file.id === id);
            if (f && f.needsRecalculation) {
                const estimate = estimateFileSize(f);
                f.estimatedSize = estimate.size;
                f.estimatedDims = { w: estimate.width, h: estimate.height };
                f.needsRecalculation = false;
            }
        });
        state.changedFiles.clear();
        updateTotalSizeEstimate();
    });
}

/**
 * Update total size estimate display
 */
export function updateTotalSizeEstimate() {
    let totalSize = 0;
    let allReal = true;
    let anyReal = false;

    state.fileQueue.forEach((f) => {
        if (f.hasRealCalculation && f.realSize !== null) {
            totalSize += f.realSize;
            anyReal = true;
        } else if (f.estimatedSize) {
            totalSize += f.estimatedSize;
            allReal = false;
        } else {
            allReal = false;
        }
    });

    if (DOM.totalEstimatedSizeSpan) {
        DOM.totalEstimatedSizeSpan.textContent = formatBytes(totalSize);
    }

    // Update label based on state
    const labelSpan = document.getElementById('total-estimated-label');
    const sizeWrapper = document.getElementById('size-estimate-wrapper');

    if (labelSpan) {
        if (allReal && state.fileQueue.length > 0) {
            labelSpan.textContent = getTranslation('realSize') || 'Real:';
        } else if (anyReal) {
            labelSpan.textContent = getTranslation('calculatedSize') || 'Berechnet:';
        } else {
            labelSpan.textContent = getTranslation('estimatedSize') || 'Geschätzt:';
        }
    }

    if (sizeWrapper) {
        sizeWrapper.classList.remove('estimated', 'calculated', 'real');
        if (allReal && state.fileQueue.length > 0) {
            sizeWrapper.classList.add('real');
        } else if (anyReal) {
            sizeWrapper.classList.add('calculated');
        } else {
            sizeWrapper.classList.add('estimated');
        }
    }

    // Update budget status indicator if budget mode is active
    if (state.budgetMode) {
        const budgetStatus = document.getElementById('budget-status');
        if (budgetStatus && totalSize > 0) {
            const budgetBytes = state.budgetTargetMB * 1024 * 1024;
            const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
            if (totalSize <= budgetBytes) {
                budgetStatus.className = 'budget-status budget-fits';
                budgetStatus.textContent = `✓ ~${sizeMB} MB`;
            } else {
                budgetStatus.className = 'budget-status budget-over';
                budgetStatus.textContent = `⚠ ~${sizeMB} MB`;
            }
        }
    }
}
