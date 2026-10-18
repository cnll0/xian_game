'use strict';

class AssetLoader {
    constructor() {
        this.loadedAssets = new Map();
        this.loadingPromises = new Map();
        this.failedAssets = new Set();
    }

    async loadImage(key, src) {
        if (this.loadedAssets.has(key)) {
            return this.loadedAssets.get(key);
        }

        if (this.loadingPromises.has(key)) {
            return this.loadingPromises.get(key);
        }

        if (this.failedAssets.has(key)) {
            return null;
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedAssets.set(key, img);
                this.loadingPromises.delete(key);
                resolve(img);
            };
            img.onerror = () => {
                this.failedAssets.add(key);
                this.loadingPromises.delete(key);
                this.loadedAssets.set(key, null);
                reject(new Error(`Failed to load image: ${src}`));
            };
            img.src = src;
        });

        this.loadingPromises.set(key, promise);
        return promise;
    }

    async loadImages(assetList) {
        const promises = Object.entries(assetList).map(([key, src]) =>
            this.loadImage(key, src).catch(e => {
                console.warn(`Asset load failed: ${key}`, e);
                return null;
            })
        );
        await Promise.all(promises);
        return this;
    }

    getImage(key) {
        return this.loadedAssets.get(key) || null;
    }

    hasImage(key) {
        return this.loadedAssets.has(key) && this.loadedAssets.get(key) !== null;
    }

    createPattern(key, repetition = 'repeat') {
        const img = this.getImage(key);
        if (!img) return null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return ctx.createPattern(img, repetition);
        } catch (e) {
            return null;
        }
    }

    clear() {
        this.loadedAssets.clear();
        this.loadingPromises.clear();
        this.failedAssets.clear();
    }
}

window.AssetLoader = AssetLoader;