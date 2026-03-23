/**
 * worker-pool.js - OffscreenCanvas Worker Pool Manager
 * Manages N workers for parallel image encoding.
 */

let poolInstance = null;
let jobIdCounter = 0;

/**
 * Check if OffscreenCanvas is supported
 * @returns {boolean}
 */
export function isOffscreenCanvasSupported() {
    try {
        return typeof OffscreenCanvas !== 'undefined'
            && typeof OffscreenCanvas.prototype.convertToBlob === 'function';
    } catch {
        return false;
    }
}

/**
 * Create or return existing worker pool
 * @param {number} [size] - Number of workers (default: hardwareConcurrency, max 6)
 * @returns {WorkerPool}
 */
export function createWorkerPool(size) {
    if (poolInstance) return poolInstance;

    const poolSize = Math.min(size || navigator.hardwareConcurrency || 4, 6);
    poolInstance = new WorkerPool(poolSize);
    return poolInstance;
}

/**
 * Get existing pool instance (or null)
 * @returns {WorkerPool|null}
 */
export function getWorkerPool() {
    return poolInstance;
}

class WorkerPool {
    constructor(size) {
        this.size = size;
        this.workers = [];
        this.queue = [];
        this.activeJobs = new Map(); // jobId → { resolve, reject, workerId }
        this.idleWorkers = [];
        this._terminated = false;

        // Resolve worker URL relative to this module
        const workerUrl = new URL('./encoding-worker.js', import.meta.url).href;

        for (let i = 0; i < size; i++) {
            const worker = new Worker(workerUrl);
            worker._id = i;
            worker.onmessage = (e) => this._onMessage(i, e);
            worker.onerror = (e) => this._onError(i, e);
            this.workers.push(worker);
            this.idleWorkers.push(i);
        }

        console.log(`[WorkerPool] Initialized with ${size} workers`);
    }

    /**
     * Process an image in the worker pool
     * @param {Blob} imageBlob - Original image file/blob
     * @param {Object} options - Processing options
     * @param {number} options.sourceWidth
     * @param {number} options.sourceHeight
     * @param {number} options.targetWidth
     * @param {number} options.targetHeight
     * @param {number} options.rotation
     * @param {number} options.scaleX
     * @param {number} options.scaleY
     * @param {string} options.mimeType
     * @param {number} options.quality
     * @returns {Promise<{blob: Blob, width: number, height: number}>}
     */
    processImage(imageBlob, options) {
        if (this._terminated) {
            return Promise.reject(new Error('Worker pool terminated'));
        }

        const id = ++jobIdCounter;

        return new Promise((resolve, reject) => {
            const job = { id, imageBlob, options, resolve, reject };

            if (this.idleWorkers.length > 0) {
                this._dispatch(job);
            } else {
                this.queue.push(job);
            }
        });
    }

    _dispatch(job) {
        const workerId = this.idleWorkers.shift();
        const worker = this.workers[workerId];

        this.activeJobs.set(job.id, {
            resolve: job.resolve,
            reject: job.reject,
            workerId,
        });

        worker.postMessage({
            id: job.id,
            imageBlob: job.imageBlob,
            sourceWidth: job.options.sourceWidth,
            sourceHeight: job.options.sourceHeight,
            targetWidth: job.options.targetWidth,
            targetHeight: job.options.targetHeight,
            rotation: job.options.rotation || 0,
            scaleX: job.options.scaleX || 1,
            scaleY: job.options.scaleY || 1,
            mimeType: job.options.mimeType,
            quality: job.options.quality,
        });
    }

    _onMessage(workerId, event) {
        const { id, blob, width, height, error } = event.data;
        const job = this.activeJobs.get(id);

        if (!job) return;
        this.activeJobs.delete(id);

        // Mark worker as idle
        this.idleWorkers.push(workerId);

        // Resolve or reject
        if (error) {
            job.reject(new Error(error));
        } else {
            job.resolve({ blob, width, height });
        }

        // Dispatch next queued job
        if (this.queue.length > 0 && this.idleWorkers.length > 0) {
            this._dispatch(this.queue.shift());
        }
    }

    _onError(workerId, event) {
        console.error(`[WorkerPool] Worker ${workerId} error:`, event);

        // Find and reject the active job for this worker
        for (const [jobId, job] of this.activeJobs) {
            if (job.workerId === workerId) {
                this.activeJobs.delete(jobId);
                job.reject(new Error(`Worker error: ${event.message}`));
                break;
            }
        }

        // Return worker to idle
        if (!this.idleWorkers.includes(workerId)) {
            this.idleWorkers.push(workerId);
        }

        // Dispatch next queued job
        if (this.queue.length > 0 && this.idleWorkers.length > 0) {
            this._dispatch(this.queue.shift());
        }
    }

    /**
     * Terminate all workers and clean up
     */
    terminate() {
        this._terminated = true;

        for (const worker of this.workers) {
            worker.terminate();
        }

        // Reject any pending jobs
        for (const job of this.queue) {
            job.reject(new Error('Worker pool terminated'));
        }
        for (const [, job] of this.activeJobs) {
            job.reject(new Error('Worker pool terminated'));
        }

        this.workers = [];
        this.queue = [];
        this.activeJobs.clear();
        this.idleWorkers = [];

        if (poolInstance === this) {
            poolInstance = null;
        }

        console.log('[WorkerPool] Terminated');
    }
}
