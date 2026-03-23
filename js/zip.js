/**
 * zip.js - ZIP generation and batch processing
 * Part of Marvin's Image Converter modular architecture
 */

import { DOM } from './config.js';
import { getBaseName, getMimeType } from './utils.js';
import { getTranslation } from './i18n.js';
import { triggerMemoryCleanup, cleanupAfterBatch } from './memory.js';
import * as state from './state.js';
import { renderFileQueue, updateTotalSizeEstimate } from './file-queue-v2.js';
import { processSingleImage, calculateTargetDimensions } from './image-processing.js';
import { lockUI, unlockUI } from './transformations.js';
import { createWorkerPool, isOffscreenCanvasSupported } from './worker-pool.js';

// ============================================
// PROGRESS UI
// ============================================

/**
 * Initialize progress file list
 */
export function initProgressFileList() {
    const progressFileList = DOM.progressFileList || document.getElementById('progress-file-list');
    if (!progressFileList) return;

    progressFileList.innerHTML = '';

    state.fileQueue.forEach((fileObj) => {
        const item = document.createElement('div');
        item.className = 'progress-file-item';
        item.id = `progress-item-${fileObj.id}`;
        item.innerHTML = `
			<span class="progress-file-name">${fileObj.file.name}</span>
			<span class="progress-file-status" id="status-${fileObj.id}">${getTranslation('waiting') || 'Warten...'}</span>
		`;
        progressFileList.appendChild(item);
    });
}

/**
 * Update progress file item status
 * @param {string} id - File ID
 * @param {string} status - Status text
 * @param {boolean} completed - Whether processing completed
 * @param {boolean} error - Whether there was an error
 */
export function updateProgressFileItem(id, status, completed = false, error = false) {
    const statusElement = document.getElementById(`status-${id}`);
    const itemElement = document.getElementById(`progress-item-${id}`);

    if (statusElement) {
        statusElement.textContent = status;

        if (completed) {
            statusElement.style.color = '#4CAF50';
        } else if (error) {
            statusElement.style.color = '#f44336';
        } else {
            statusElement.style.color = '#FFA000';
        }
    }

    if (itemElement) {
        if (completed) {
            itemElement.classList.add('completed');
        } else if (error) {
            itemElement.classList.add('error');
        }
    }
}

// ============================================
// ZIP GENERATION
// ============================================

/**
 * Process all files and download as ZIP
 */
export async function processAndDownload() {
    if (state.fileQueue.length === 0) return;

    const formatSelect = DOM.formatSelect || document.getElementById('format-select');
    const format = formatSelect?.value || 'webp';

    // Reset cancellation flag
    state.setZipProcessCancelled(false);

    // Show progress overlay
    const progressOverlay = DOM.progressOverlay || document.getElementById('progress-overlay');
    const progressFill = DOM.progressFill || document.getElementById('progress-fill');
    const progressText = DOM.progressText || document.getElementById('progress-text');
    const progressDetails = DOM.progressDetails || document.getElementById('progress-details');
    const processButton = DOM.processButton || document.getElementById('process-button');

    progressOverlay.style.display = 'flex';
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
    progressText.textContent = getTranslation('preparingFiles') || 'Bereite Dateien vor...';
    progressDetails.textContent = '';

    // Initialize progress file list
    initProgressFileList();

    // Show cancel button
    const cancelBtn = document.getElementById('cancel-zip-btn');
    if (cancelBtn) {
        cancelBtn.style.display = 'block';
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => {
            state.setZipProcessCancelled(true);
            cancelBtn.disabled = true;
            cancelBtn.textContent = getTranslation('cancelling') || 'Abbrechen...';
        };
    }

    // Lock UI
    lockUI();
    processButton.disabled = true;

    // Determine if we can use worker pool
    const useWorkers = format !== 'svg' && isOffscreenCanvasSupported();
    let pool = null;

    try {
        // Create ZIP
        const zip = new JSZip();
        let completed = 0;

        const qualitySlider = DOM.qualitySlider || document.getElementById('quality-slider');
        const quality = parseFloat(qualitySlider?.value || 85) / 100;
        const mimeType = getMimeType(format);

        if (useWorkers) {
            pool = createWorkerPool();
        }

        // Process a single file — either via worker or main-thread fallback
        const processFile = async (fileObj) => {
            if (state.zipProcessCancelled) {
                return { success: false, cancelled: true };
            }

            updateProgressFileItem(fileObj.id, getTranslation('processing') || 'Verarbeite...', false, false);

            try {
                let blob, targetWidth, targetHeight;

                if (useWorkers) {
                    // Worker path: send original blob, let worker decode + encode
                    const dims = calculateTargetDimensions(
                        fileObj.originalWidth,
                        fileObj.originalHeight,
                        fileObj.rotation || 0
                    );
                    targetWidth = dims.width;
                    targetHeight = dims.height;

                    const result = await pool.processImage(fileObj.file, {
                        sourceWidth: fileObj.originalWidth,
                        sourceHeight: fileObj.originalHeight,
                        targetWidth,
                        targetHeight,
                        rotation: fileObj.rotation || 0,
                        scaleX: fileObj.scaleX || 1,
                        scaleY: fileObj.scaleY || 1,
                        mimeType,
                        quality,
                    });
                    blob = result.blob;
                } else {
                    // Main-thread fallback (SVG or no OffscreenCanvas)
                    const result = await processSingleImage(fileObj);
                    blob = result.blob;
                    targetWidth = result.targetWidth;
                    targetHeight = result.targetHeight;
                }

                // Update file object with processed values
                fileObj.processedSize = blob.size;
                fileObj.realSize = blob.size;
                fileObj.realDims = { w: targetWidth, h: targetHeight };
                fileObj.hasRealCalculation = true;

                // Generate filename
                const baseName = getBaseName(fileObj.file.name);
                const fileName = `${baseName}_processed.${format}`;

                // Add to ZIP
                zip.file(fileName, blob);

                // Mark as completed
                updateProgressFileItem(fileObj.id, getTranslation('fileCompleted') || '✓ Fertig', true, false);

                // Update progress
                completed++;
                const progress = (completed / state.fileQueue.length) * 75;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `${completed} ${getTranslation('of')} ${state.fileQueue.length} ${getTranslation('filesProcessed')}`;

                return { success: true, fileName };

            } catch (error) {
                console.error(`Error processing ${fileObj.file.name}:`, error);
                updateProgressFileItem(fileObj.id, getTranslation('fileError') || '✗ Fehler', false, true);
                completed++;

                const progress = (completed / state.fileQueue.length) * 75;
                progressFill.style.width = `${progress}%`;

                return { success: false, fileName: fileObj.file.name, error };
            }
        };

        // Launch all jobs — the pool manages concurrency internally
        progressDetails.textContent = useWorkers
            ? `Worker-Pool (${pool.size} Threads)`
            : (getTranslation('processing') || 'Verarbeite...');

        const promises = state.fileQueue.map(fileObj => processFile(fileObj));
        await Promise.all(promises);

        // Update UI after all files processed
        updateTotalSizeEstimate();

        // Check if cancelled
        if (state.zipProcessCancelled) {
            progressDetails.textContent = getTranslation('cancelled') || 'Abgebrochen';
            progressFill.style.background = 'linear-gradient(90deg, #ff9800, #f57c00)';

            setTimeout(() => {
                progressOverlay.style.display = 'none';
                if (cancelBtn) {
                    cancelBtn.style.display = 'none';
                    cancelBtn.disabled = false;
                }
                unlockUI();
                processButton.disabled = false;
            }, 2000);

            return;
        }

        // Generate ZIP
        progressDetails.textContent = getTranslation('preparingDownload') || 'Erstelle ZIP...';
        progressFill.style.width = '85%';

        const content = await zip.generateAsync(
            {
                type: 'blob',
                compression: 'STORE',
            },
            (metadata) => {
                if (state.zipProcessCancelled) return;
                const zipProgress = 85 + metadata.percent * 0.1;
                progressFill.style.width = `${zipProgress}%`;
                progressDetails.textContent = `${getTranslation('preparingDownload')} ${Math.round(metadata.percent)}%`;
            }
        );

        // Final cancellation check
        if (state.zipProcessCancelled) {
            progressDetails.textContent = getTranslation('cancelled') || 'Abgebrochen';
            setTimeout(() => {
                progressOverlay.style.display = 'none';
            }, 2000);
            return;
        }

        // Download
        progressFill.style.width = '100%';
        progressDetails.textContent = getTranslation('downloadReady') || 'Download bereit!';

        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${getTranslation('exportFilename') || 'Marvins_Image_Converter_Export'}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        // Hide cancel button
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }

        // Update size estimates
        updateTotalSizeEstimate();
        renderFileQueue();

        // Hide progress after delay
        setTimeout(() => {
            progressOverlay.style.display = 'none';

            // Show post-process ad (with cache busting)
            import('./promo.js').then(module => {
                module.showAd('batch');
            }).catch(e => console.error('Failed to load promo:', e));
        }, 2000);

    } catch (error) {
        console.error('Error processing or zipping:', error);
        progressDetails.textContent = `Fehler: ${error.message}`;
        progressFill.style.background = 'linear-gradient(90deg, #f44336, #d32f2f)';

        setTimeout(() => {
            progressOverlay.style.display = 'none';
        }, 3000);

    } finally {
        // Terminate worker pool
        if (pool) {
            pool.terminate();
        }

        // Reset cancel button
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
            cancelBtn.disabled = false;
            cancelBtn.onclick = null;
        }

        unlockUI();
        processButton.disabled = false;
        cleanupAfterBatch();
    }
}
