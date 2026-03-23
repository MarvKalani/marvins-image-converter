/**
 * encoding-worker.js - OffscreenCanvas image encoding worker
 * Receives image blob + options, decodes, transforms, encodes, returns blob.
 */

self.onmessage = async ({ data }) => {
    const {
        id,
        imageBlob,
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        rotation,
        scaleX,
        scaleY,
        mimeType,
        quality,
    } = data;

    try {
        // 1. Decode image blob to ImageBitmap
        const bitmap = await createImageBitmap(imageBlob);

        // 2. Create OffscreenCanvas with target dimensions
        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');

        // 3. Calculate draw dimensions (inverse of rotation for source mapping)
        const isSideways = rotation === 90 || rotation === 270;
        const drawW = isSideways ? targetHeight : targetWidth;
        const drawH = isSideways ? targetWidth : targetHeight;

        // 4. Apply transformations and draw
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.save();
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scaleX, scaleY);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // 5. Release bitmap
        bitmap.close();

        // 6. Encode to target format
        const blob = await canvas.convertToBlob({ type: mimeType, quality });

        // 7. Send result back
        self.postMessage({ id, blob, width: targetWidth, height: targetHeight });

    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
};
