'use strict';

class MathUtils {
    static DEG_TO_RAD = Math.PI / 180;
    static RAD_TO_DEG = 180 / Math.PI;

    static sinTable = new Float32Array(360);
    static cosTable = new Float32Array(360);

    static {
        for (let i = 0; i < 360; i++) {
            const rad = i * MathUtils.DEG_TO_RAD;
            MathUtils.sinTable[i] = Math.sin(rad);
            MathUtils.cosTable[i] = Math.cos(rad);
        }
    }

    static clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    static fastSin(degrees) {
        const index = Math.floor(degrees) % 360;
        return MathUtils.sinTable[index >= 0 ? index : index + 360];
    }

    static fastCos(degrees) {
        const index = Math.floor(degrees) % 360;
        return MathUtils.cosTable[index >= 0 ? index : index + 360];
    }

    static fastAtan2(y, x) {
        return Math.atan2(y, x) * MathUtils.RAD_TO_DEG;
    }

    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.hypot(dx, dy);
    }

    static distanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }

    static angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    static normalizeAngle(angle) {
        while (angle <= -Math.PI) angle += 2 * Math.PI;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        return angle;
    }

    static angleDiff(a, b) {
        let diff = a - b;
        while (diff <= -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        return diff;
    }

    static random(min, max) {
        return min + Math.random() * (max - min);
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    static weightedRandom(weights) {
        const total = weights.reduce((sum, w) => sum + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    static resolvePosition(x, y, radius, bounds) {
        const minX = bounds.minX + radius;
        const maxX = bounds.maxX - radius;
        const minY = bounds.minY + radius;
        const maxY = bounds.maxY - radius;
        return {
            x: MathUtils.clamp(x, minX, maxX),
            y: MathUtils.clamp(y, minY, maxY)
        };
    }

    static rotatePoint(x, y, cx, cy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = x - cx;
        const dy = y - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }
}

class SeededRandom {
    constructor(seed = 1) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    nextInt(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    nextFloat(min, max) {
        return min + this.next() * (max - min);
    }

    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

window.MathUtils = MathUtils;
window.SeededRandom = SeededRandom;