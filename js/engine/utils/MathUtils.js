'use strict';

/**
 * ????? - ????????????????????
 * @typedef {Object} Bounds
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minY
 * @property {number} maxY
 */

/**
 * @typedef {Object} Vec2
 * @property {number} x
 * @property {number} y
 */

class MathUtils {
    /** @type {number} */
    static DEG_TO_RAD = Math.PI / 180;
    /** @type {number} */
    static RAD_TO_DEG = 180 / Math.PI;

    /** @type {Float32Array} */
    static sinTable = new Float32Array(360);
    /** @type {Float32Array} */
    static cosTable = new Float32Array(360);

    static {
        for (let i = 0; i < 360; i++) {
            const rad = i * MathUtils.DEG_TO_RAD;
            MathUtils.sinTable[i] = Math.sin(rad);
            MathUtils.cosTable[i] = Math.cos(rad);
        }
    }

    /**
     * ??????
     * @param {number} v
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    /**
     * ????
     * @param {number} a
     * @param {number} b
     * @param {number} t - [0,1]
     * @returns {number}
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * ???? (???)
     * @param {number} degrees - ??
     * @returns {number}
     */
    static fastSin(degrees) {
        const index = Math.floor(degrees) % 360;
        return MathUtils.sinTable[index >= 0 ? index : index + 360];
    }

    /**
     * ???? (???)
     * @param {number} degrees
     * @returns {number}
     */
    static fastCos(degrees) {
        const index = Math.floor(degrees) % 360;
        return MathUtils.cosTable[index >= 0 ? index : index + 360];
    }

    /**
     * ?? atan2 ????
     * @param {number} y
     * @param {number} x
     * @returns {number} ??
     */
    static fastAtan2(y, x) {
        return Math.atan2(y, x) * MathUtils.RAD_TO_DEG;
    }

    /**
     * ????
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {number}
     */
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.hypot(dx, dy);
    }

    /**
     * ?????? (?????)
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {number}
     */
    static distanceSq(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }

    /**
     * ????? (??)
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @returns {number} ?? [-PI, PI]
     */
    static angleBetween(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    /**
     * ?????? [-PI, PI]
     * @param {number} angle
     * @returns {number}
     */
    static normalizeAngle(angle) {
        while (angle <= -Math.PI) angle += 2 * Math.PI;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        return angle;
    }

    /**
     * ??? (????)
     * @param {number} a
     * @param {number} b
     * @returns {number} [-PI, PI]
     */
    static angleDiff(a, b) {
        let diff = a - b;
        while (diff <= -Math.PI) diff += 2 * Math.PI;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        return diff;
    }

    /**
     * ????? [min, max)
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static random(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * ???? [min, max]
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * ????????
     * @template T
     * @param {T[]} arr
     * @returns {T}
     */
    static randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * ????????
     * @param {number[]} weights
     * @returns {number} ??
     */
    static weightedRandom(weights) {
        const total = weights.reduce((sum, w) => sum + w, 0);
        let r = Math.random() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return weights.length - 1;
    }

    /**
     * ?????????
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {Bounds} bounds
     * @returns {Vec2}
     */
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

    /**
     * ??????
     * @param {number} x
     * @param {number} y
     * @param {number} cx
     * @param {number} cy
     * @param {number} angle - ??
     * @returns {Vec2}
     */
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

/**
 * ?????????? (LCG??)
 * ??seed????????????????????????
 */
class SeededRandom {
    /**
     * @param {number} seed - ??
     */
    constructor(seed = 1) {
        /** @type {number} */
        this.seed = seed;
    }

    /**
     * ????? [0,1) ???
     * @returns {number}
     */
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    /**
     * ????? [min, max]
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    nextInt(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }

    /**
     * ?????? [min, max)
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    nextFloat(min, max) {
        return min + this.next() * (max - min);
    }

    /**
     * ????????
     * @template T
     * @param {T[]} arr
     * @returns {T}
     */
    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    /**
     * Fisher-Yates??
     * @template T
     * @param {T[]} arr
     * @returns {T[]}
     */
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