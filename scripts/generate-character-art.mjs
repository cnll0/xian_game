#!/usr/bin/env node
/**
 * 生成与主角同画风的像素角色：
 *   assets/npc-sprites.png   14 帧 × 64×64（世界/秘境/人形敌手）
 *   assets/npc-portraits.png 14 帧 × 100×125（对话立绘）
 *
 * 运行: node scripts/generate-character-art.mjs
 * 顺序必须与 js/data.js 的 window.CHARACTER_ART 一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRAME_W = 64;
const FRAME_H = 64;
const PORTRAIT_W = 100;
const PORTRAIT_H = 125;

const C = (() => {
    const cache = new Map();
    return (hex) => {
        if (cache.has(hex)) return cache.get(hex);
        const s = hex.replace('#', '');
        const v = s.length === 6 ? s + 'ff' : s;
        const out = Uint8Array.from([
            parseInt(v.slice(0, 2), 16),
            parseInt(v.slice(2, 4), 16),
            parseInt(v.slice(4, 6), 16),
            parseInt(v.slice(6, 8), 16)
        ]);
        cache.set(hex, out);
        return out;
    };
})();

class Px {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.d = new Uint8Array(w * h * 4);
    }
    set(x, y, color) {
        x |= 0;
        y |= 0;
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const c = C(color);
        const i = (y * this.w + x) * 4;
        this.d[i] = c[0];
        this.d[i + 1] = c[1];
        this.d[i + 2] = c[2];
        this.d[i + 3] = c[3];
    }
    get(x, y) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
        const i = (y * this.w + x) * 4;
        return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
    }
    rect(x, y, w, h, color) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color);
        }
    }
    ellipse(cx, cy, rx, ry, color) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
            for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                const nx = (x - cx) / rx;
                const ny = (y - cy) / ry;
                if (nx * nx + ny * ny <= 1) this.set(x, y, color);
            }
        }
    }
    polygon(points, color) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of points) {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
            for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
                let inside = false;
                for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                    const xi = points[i][0], yi = points[i][1];
                    const xj = points[j][0], yj = points[j][1];
                    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
                }
                if (inside) this.set(x, y, color);
            }
        }
    }
    line(x0, y0, x1, y1, color, thickness = 1) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
            for (let oy = 0; oy < thickness; oy++) {
                for (let ox = 0; ox < thickness; ox++) this.set(x0 + ox, y0 + oy, color);
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    outline(color) {
        const src = this.d.slice();
        const alpha = (x, y) => {
            if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
            return src[(y * this.w + x) * 4 + 3];
        };
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (alpha(x, y) > 0) continue;
                if (alpha(x - 1, y) > 0 || alpha(x + 1, y) > 0 ||
                    alpha(x, y - 1) > 0 || alpha(x, y + 1) > 0) {
                    this.set(x, y, color);
                }
            }
        }
    }
    bbox() {
        let minX = this.w, minY = this.h, maxX = -1, maxY = -1;
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.get(x, y)[3] > 0) {
                    minX = Math.min(minX, x); minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                }
            }
        }
        return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
}

const OUTLINE = '#1c2233';

/* ============================== 基础绘制 ============================== */

function drawHairBack(p, c) {
    if (c.hairStyle === 'hood') {
        p.ellipse(32, 17, 16, 16, c.hair);
        p.rect(17, 20, 5, 18, c.hair);
        p.rect(42, 20, 5, 18, c.hair);
        return;
    }
    if (c.hairStyle === 'short') {
        p.ellipse(32, 15, 15, 12, c.hair);
        p.rect(19, 18, 3, 8, c.hair);
        p.rect(42, 18, 3, 8, c.hair);
        return;
    }
    // 长发 / 发髻 / 马尾共用后背长发
    p.polygon([[20, 9], [44, 9], [46, 40], [41, 45], [38, 25], [26, 25], [23, 45], [18, 40]], c.hair);
    p.rect(18, 18, 3, 25, c.hair);
    p.rect(43, 18, 3, 24, c.hair);
    p.rect(21, 12, 2, 18, c.hairHi);
    p.rect(44, 13, 2, 16, c.hairLo);
    if (c.hairStyle === 'bun') {
        p.ellipse(32, 4, 6, 5, c.hair);
        p.rect(28, 2, 8, 2, c.hairHi);
    }
    if (c.hairStyle === 'ponytail') {
        p.polygon([[41, 8], [50, 14], [53, 28], [47, 36], [45, 24], [43, 17]], c.hair);
        p.rect(47, 16, 2, 16, c.hairHi);
    }
}

function drawBody(p, c) {
    // 腿与靴（露出袍摆下方）
    p.rect(27, 46, 4, 12, c.pants || c.robeLo);
    p.rect(33, 46, 4, 12, c.pants || c.robeLo);
    p.rect(26, 57, 6, 4, c.boot);
    p.rect(32, 57, 6, 4, c.boot);
    p.rect(26, 59, 6, 1, '#141a26');
    p.rect(32, 59, 6, 1, '#141a26');

    // 外袍：两片袍摆，中间留缝，收腰后再外扩
    p.polygon([[23, 27], [31, 27], [31, 51], [26, 52], [21, 48]], c.robe);
    p.polygon([[33, 27], [41, 27], [43, 48], [38, 52], [33, 51]], c.robe);
    p.polygon([[36, 28], [41, 27], [43, 48], [38, 52], [35, 51]], c.robeLo);
    p.polygon([[24, 28], [27, 28], [27, 49], [25, 50], [22, 48]], c.robeHi);
    p.rect(31, 28, 2, 23, c.trimLo || c.robeLo);
    p.rect(32, 28, 1, 23, c.robeHi);

    // 袖子
    p.polygon([[23, 28], [19, 31], [17, 42], [21, 44], [24, 37]], c.robe);
    p.polygon([[41, 28], [45, 31], [47, 42], [43, 44], [40, 37]], c.robe);
    p.rect(17, 41, 5, 3, c.robeLo);
    p.rect(42, 41, 5, 3, c.robeLo);
    p.rect(18, 43, 3, 3, c.skin);
    p.rect(44, 43, 3, 3, c.skin);
    p.rect(18, 45, 3, 1, c.skinShade);
    p.rect(44, 45, 3, 1, c.skinShade);

    // 脖子与头
    p.rect(30, 24, 4, 5, c.skinShade);
    p.rect(30, 24, 4, 2, c.skin);
    p.ellipse(32, 17, 10, 11, c.skin);
    p.rect(21, 17, 2, 3, c.skinShade);
    p.rect(41, 17, 2, 3, c.skinShade);
    p.rect(22, 24, 3, 2, c.skinShade);
    p.rect(39, 24, 3, 2, c.skinShade);

    // 交领与腰带
    p.line(29, 27, 32, 38, c.trim);
    p.line(35, 27, 32, 38, c.trim);
    p.line(28, 28, 31, 38, c.trimHi || c.robeHi);
    p.line(36, 28, 33, 38, c.trimLo || c.robeLo);
    p.rect(22, 39, 20, 3, c.trim);
    p.rect(22, 41, 20, 1, c.trimLo || c.robeLo);
    p.rect(30, 39, 4, 4, c.accent);
    p.rect(31, 43, 2, 7, c.accent);
    p.rect(32, 43, 1, 7, c.accentHi || c.accent);
    if (c.formal) {
        p.rect(24, 27, 16, 1, c.accent);
        p.rect(24, 30, 2, 7, c.trimHi || c.robeHi);
    }
}

function drawFace(p, c) {
    if (c.mask) {
        // 面具/蒙面：眼睛留出，下半张脸遮住
        p.rect(24, 21, 16, 5, c.maskColor || c.hair);
        p.rect(25, 22, 14, 1, c.accent);
        p.rect(25, 25, 14, 1, c.hairLo);
    }
    const eye = c.eye || '#2a2f3e';
    // 眼白
    p.rect(25, 16, 4, 4, '#fff8ee');
    p.rect(35, 16, 4, 4, '#fff8ee');
    // 瞳孔
    p.rect(26, 17, 3, 3, eye);
    p.rect(36, 17, 3, 3, eye);
    p.set(26, 17, '#ffffff');
    p.set(36, 17, '#ffffff');
    p.set(27, 19, c.eyeHi || eye);
    p.set(37, 19, c.eyeHi || eye);
    if (c.evil) {
        p.set(26, 17, c.accent);
        p.set(36, 17, c.accent);
        p.set(27, 18, c.accentHi || c.accent);
        p.set(37, 18, c.accentHi || c.accent);
    }
    // 眉毛
    p.rect(24, 13, 5, 1, c.hair);
    p.rect(35, 13, 5, 1, c.hair);
    // 鼻子与嘴
    p.set(32, 20, c.skinShade);
    p.set(32, 21, c.skinShade);
    if (!c.mask) p.rect(30, 23, 4, 1, c.lip || '#b05a5a');
    // 腮红
    if (c.blush) {
        p.rect(22, 21, 3, 1, '#e89a9a');
        p.rect(39, 21, 3, 1, '#e89a9a');
    }
    if (c.beard) {
        p.polygon([[24, 21], [40, 21], [37, 29], [27, 29]], c.hairHi);
        p.rect(29, 24, 6, 1, '#c8c2b5');
        p.rect(30, 27, 4, 1, '#b9b2a5');
    }
}

function drawHairFront(p, c) {
    if (c.hairStyle === 'hood') {
        // 兜帽前沿：只压住额头和两侧，不盖住眼睛
        p.polygon([[17, 14], [19, 5], [28, 2], [36, 2], [45, 5], [47, 14], [44, 10], [39, 6], [32, 5], [25, 6], [20, 10]], c.hair);
        p.rect(18, 12, 4, 18, c.hair);
        p.rect(42, 12, 4, 18, c.hair);
        p.rect(18, 13, 2, 15, c.hairHi);
        return;
    }
    // 刘海：锯齿状，保留眉眼
    p.polygon([[20, 12], [22, 5], [27, 8], [32, 4], [37, 8], [42, 5], [44, 12], [42, 17], [39, 13], [37, 17], [34, 12], [32, 16], [30, 12], [27, 17], [24, 13], [22, 18]], c.hair);
    p.rect(19, 12, 3, 16, c.hair);
    p.rect(42, 12, 3, 16, c.hair);
    p.rect(27, 6, 2, 5, c.hairHi);
    p.rect(36, 7, 2, 4, c.hairHi);
    p.rect(20, 13, 1, 10, c.hairHi);
    if (c.hairStyle === 'braid') {
        for (let i = 0; i < 6; i++) {
            p.rect(42, 28 + i * 4, 3, 3, i % 2 ? c.hairHi : c.hair);
            p.set(44, 29 + i * 4, c.accent);
        }
    }
    if (c.hairpin) {
        p.rect(37, 5, 6, 1, c.accent);
        p.set(42, 4, c.accentHi || c.accent);
    }
}

function drawHeadwear(p, c) {
    if (c.hat === 'straw') {
        const hatColor = c.hatColor || '#c9a76a';
        const hatDark = c.hatDark || '#8b6a3e';
        p.ellipse(32, 7, 18, 4, hatColor);
        p.polygon([[27, 1], [37, 1], [40, 8], [24, 8]], hatColor);
        p.rect(24, 7, 16, 2, hatDark);
        p.rect(31, 2, 2, 5, c.accent);
        p.rect(25, 8, 5, 1, hatDark);
        p.rect(34, 8, 5, 1, hatDark);
    }
    if (c.headband) {
        p.rect(20, 10, 24, 2, c.trim);
        p.rect(20, 10, 24, 1, c.accent);
        p.rect(31, 9, 2, 4, c.accent);
    }
    if (c.bandana) {
        p.rect(20, 10, 24, 3, c.accent);
        p.rect(20, 12, 24, 1, c.accentLo || c.accent);
        p.polygon([[42, 12], [50, 15], [46, 20], [42, 15]], c.accent);
    }
    if (c.fur) {
        p.rect(20, 26, 24, 3, c.furColor || '#e8f4f6');
        p.rect(21, 27, 4, 2, '#ffffff');
        p.rect(38, 27, 4, 2, '#ffffff');
        p.rect(20, 29, 24, 1, '#b9d5dc');
    }
    if (c.armor) {
        p.rect(20, 28, 5, 3, c.trim);
        p.rect(39, 28, 5, 3, c.trim);
        p.rect(21, 29, 3, 1, c.accent);
        p.rect(40, 29, 3, 1, c.accent);
    }
}

function drawBackAccessory(p, c) {
    if (c.prop === 'basket') {
        p.ellipse(46, 34, 8, 6, c.accent);
        p.rect(39, 33, 14, 1, c.accentLo || c.accent);
        p.line(40, 29, 44, 34, c.trim);
        p.line(52, 29, 48, 34, c.trim);
        p.set(44, 32, c.trim);
        p.set(48, 32, c.trim);
    }
    if (c.cloak) {
        p.polygon([[18, 27], [46, 27], [48, 52], [40, 56], [24, 56], [16, 52]], c.cloak);
        p.rect(19, 30, 3, 20, c.cloakHi || c.cloak);
    }
}

function drawProp(p, c) {
    const pkey = c.prop;
    if (pkey === 'sword') {
        p.line(46, 45, 56, 18, '#dff8ff', 2);
        p.line(47, 45, 57, 18, '#8fdce8', 1);
        p.line(44, 48, 47, 43, c.accent, 2);
        p.set(45, 49, '#6a4a2e');
        p.set(46, 50, '#6a4a2e');
        p.line(45, 44, 49, 42, c.accentHi || c.accent, 1);
    } else if (pkey === 'katana') {
        p.line(45, 46, 57, 17, '#e6f2f5', 2);
        p.line(46, 46, 57, 18, '#aebfc7', 1);
        p.line(43, 49, 46, 44, c.accent, 2);
        p.set(44, 50, '#3a2c2c');
        p.set(45, 51, '#3a2c2c');
    } else if (pkey === 'dagger') {
        p.line(46, 44, 53, 30, '#e6f2f5', 2);
        p.line(44, 47, 47, 42, c.accent, 2);
        p.set(45, 48, '#2e2228');
        p.set(46, 49, '#2e2228');
    } else if (pkey === 'daggers') {
        p.line(46, 44, 53, 30, '#dfe9ee', 2);
        p.line(44, 47, 47, 42, c.accent, 2);
        p.line(17, 44, 12, 32, '#dfe9ee', 2);
        p.line(18, 46, 15, 42, c.accent, 2);
    } else if (pkey === 'spear') {
        p.rect(52, 8, 2, 52, '#8d6c45');
        p.rect(52, 8, 1, 52, '#b08a5d');
        p.polygon([[53, 2], [57, 10], [53, 14], [49, 10]], '#dfe9ee');
        p.rect(50, 10, 6, 1, c.accent);
    } else if (pkey === 'axe') {
        p.line(46, 48, 55, 18, '#8d6c45', 2);
        p.polygon([[53, 14], [61, 18], [61, 26], [53, 24]], '#b9c3c9');
        p.polygon([[53, 15], [58, 18], [58, 24], [53, 23]], '#8d9aa2');
        p.rect(51, 18, 2, 6, c.accent);
    } else if (pkey === 'lantern') {
        p.line(47, 42, 47, 38, c.accent);
        p.rect(43, 38, 9, 11, '#2e2338');
        p.rect(44, 39, 7, 9, c.accent);
        p.rect(45, 40, 5, 7, c.accentHi || c.accent);
        p.rect(44, 49, 7, 1, c.accent);
        p.set(42, 39, c.accentHi || c.accent);
        p.set(52, 39, c.accentHi || c.accent);
    } else if (pkey === 'icelamp') {
        p.line(47, 42, 47, 37, c.accent);
        p.rect(43, 37, 9, 12, '#dff7ff');
        p.rect(44, 38, 7, 10, c.accent);
        p.rect(46, 40, 3, 6, '#ffffff');
        p.rect(43, 49, 9, 1, '#b9e6ef');
    } else if (pkey === 'bottle') {
        p.polygon([[16, 40], [20, 40], [21, 48], [15, 48]], '#8fb3a0');
        p.rect(16, 38, 4, 3, '#c9a76a');
        p.rect(17, 39, 2, 1, c.accent);
        p.rect(16, 44, 4, 1, '#6f8f7f');
    } else if (pkey === 'token') {
        p.rect(45, 44, 6, 8, '#8fbfa5');
        p.rect(46, 45, 4, 6, '#b9dcc8');
        p.rect(47, 47, 2, 2, '#3f6b57');
    }
}

function character(c) {
    const p = new Px(FRAME_W, FRAME_H);
    drawBackAccessory(p, c);
    drawHairBack(p, c);
    drawBody(p, c);
    drawFace(p, c);
    drawHairFront(p, c);
    drawHeadwear(p, c);
    drawProp(p, c);
    p.outline(OUTLINE);
    return p;
}

/* ============================== 角色配置 ============================== */

const CHARACTERS = [
    {
        key: 'ningxiao', skin: '#f5c9a6', skinShade: '#d89b78', lip: '#b05a5a',
        hair: '#3a2a22', hairHi: '#5a4033', hairLo: '#261a15',
        robe: '#d7e3bc', robeHi: '#eef4d9', robeLo: '#a3bb82', robeMid: '#c3d5a5',
        trim: '#6f8f5c', trimHi: '#98b37c', trimLo: '#516b43', accent: '#e0b968', accentHi: '#f2d58e',
        boot: '#3b3228', hairStyle: 'braid', prop: 'basket', blush: true, female: true
    },
    {
        key: 'linyue', skin: '#e8c19c', skinShade: '#c49372', lip: '#9a5a50',
        hair: '#332b25', hairHi: '#514239', hairLo: '#211a16',
        robe: '#8f7150', robeHi: '#c2a37c', robeLo: '#5d4832', robeMid: '#a58763',
        trim: '#d8bd86', trimHi: '#efd9aa', trimLo: '#9a7c4d', accent: '#7f9a6b', accentHi: '#a8bf91',
        boot: '#3b2e22', hairStyle: 'short', hat: 'straw', hatColor: '#c9a76a', hatDark: '#8b6a3e',
        prop: 'sword', cloak: '#5c4834', cloakHi: '#7a6045'
    },
    {
        key: 'shenli', skin: '#e9c3a1', skinShade: '#c99472', lip: '#8a4a44',
        hair: '#cfd3d8', hairHi: '#eef0f2', hairLo: '#9aa2aa',
        robe: '#3f5069', robeHi: '#71849e', robeLo: '#293446', robeMid: '#566a85',
        trim: '#d8bd78', trimHi: '#f0dc9f', trimLo: '#9f8648', accent: '#6fa792', accentHi: '#9cc9b5',
        boot: '#252b35', hairStyle: 'short', beard: true, formal: true, prop: 'token'
    },
    {
        key: 'guqinghan', skin: '#f5d8bf', skinShade: '#d7ab8e', lip: '#b05a66',
        hair: '#242b3a', hairHi: '#465472', hairLo: '#151a24',
        robe: '#cfe4ee', robeHi: '#f2fbff', robeLo: '#8fb6c8', robeMid: '#b4d4e1',
        trim: '#6d9fbd', trimHi: '#a7cee0', trimLo: '#4d7994', accent: '#bfe8f5', accentHi: '#e6fbff',
        boot: '#2b3a45', hairStyle: 'long', hairpin: true, prop: 'sword', female: true
    },
    {
        key: 'mochen', skin: '#e2bd9d', skinShade: '#bd8b6d', lip: '#8a4248',
        hair: '#1f1a20', hairHi: '#3b2c3a', hairLo: '#120e14',
        robe: '#3d2430', robeHi: '#6e3b4b', robeLo: '#26151d', robeMid: '#55303c',
        trim: '#b4576e', trimHi: '#d98296', trimLo: '#7c3448', accent: '#e0708d', accentHi: '#ff9eb0',
        boot: '#1d1318', hairStyle: 'hood', mask: true, maskColor: '#3a1f2a', prop: 'dagger'
    },
    {
        key: 'jichang', skin: '#dcc3bd', skinShade: '#b49795', lip: '#8f4d58',
        hair: '#2a2036', hairHi: '#493a5e', hairLo: '#191121',
        robe: '#3a2b52', robeHi: '#655087', robeLo: '#221833', robeMid: '#4e3a6d',
        trim: '#a98ad4', trimHi: '#cbb0ee', trimLo: '#7b5ca4', accent: '#c7a6ff', accentHi: '#e4d4ff',
        boot: '#1c1428', hairStyle: 'long', prop: 'lantern'
    },
    {
        key: 'hanxing', skin: '#f1d6c2', skinShade: '#cfaa93', lip: '#b05a66',
        hair: '#2c3a46', hairHi: '#4e6778', hairLo: '#1a242c',
        robe: '#bcdce8', robeHi: '#eaf9ff', robeLo: '#7fa5b8', robeMid: '#a3c8d8',
        trim: '#5c9cb8', trimHi: '#8fc8dd', trimLo: '#3f7189', accent: '#d6f5ff', accentHi: '#ffffff',
        boot: '#24343d', hairStyle: 'long', prop: 'icelamp', fur: true, female: true
    },
    {
        key: 'suwan', skin: '#f4d2b6', skinShade: '#d7a98c', lip: '#b05a5a',
        hair: '#35231f', hairHi: '#5c3d36', hairLo: '#211411',
        robe: '#d9a25f', robeHi: '#f3d3a2', robeLo: '#a06c36', robeMid: '#c48d4c',
        trim: '#8c3f3a', trimHi: '#b96458', trimLo: '#5f2724', accent: '#f0c46f', accentHi: '#ffe3a6',
        boot: '#3a2a20', hairStyle: 'bun', prop: 'bottle', female: true, blush: true
    },
    {
        key: 'zhaotieyi', skin: '#e4bc98', skinShade: '#c18f6d', lip: '#8f4d48',
        hair: '#2b2622', hairHi: '#4c4138', hairLo: '#1a1613',
        robe: '#6f6558', robeHi: '#9d907c', robeLo: '#463f36', robeMid: '#847867',
        trim: '#b98b4f', trimHi: '#d8ad6e', trimLo: '#87612f', accent: '#d9b76f', accentHi: '#f0d79e',
        boot: '#2c2722', hairStyle: 'ponytail', prop: 'sword', armor: true
    },
    {
        key: 'ashi', skin: '#e6bd9b', skinShade: '#c28f6e', lip: '#8f4d48',
        hair: '#252a2e', hairHi: '#414b52', hairLo: '#14181c',
        robe: '#5d7183', robeHi: '#8fa4b5', robeLo: '#3b4a57', robeMid: '#73889a',
        trim: '#b9c3c9', trimHi: '#dce4e8', trimLo: '#839199', accent: '#d9c58b', accentHi: '#f2e4b8',
        boot: '#232b31', hairStyle: 'short', headband: true, prop: 'spear'
    },
    {
        key: 'cultist', skin: '#d8b294', skinShade: '#b3866a', lip: '#8a3a44',
        hair: '#1b161b', hairHi: '#332733', hairLo: '#0e0a0e',
        robe: '#2a1a21', robeHi: '#552c3a', robeLo: '#170d12', robeMid: '#3d2029',
        trim: '#a83d54', trimHi: '#cf6079', trimLo: '#6e2132', accent: '#ff5876', accentHi: '#ff9db1',
        boot: '#140d10', hairStyle: 'hood', mask: true, maskColor: '#2a151c', prop: 'dagger', evil: true
    },
    {
        key: 'bandit', skin: '#dcae86', skinShade: '#b78360', lip: '#8a4a44',
        hair: '#2a211b', hairHi: '#493a2e', hairLo: '#18120f',
        robe: '#6a4c33', robeHi: '#9c7650', robeLo: '#43301f', robeMid: '#7d5c3e',
        trim: '#c19a5e', trimHi: '#ddbc84', trimLo: '#8c6a38', accent: '#8d3b34', accentHi: '#b85e52',
        boot: '#2b2017', hairStyle: 'short', bandana: true, prop: 'axe'
    },
    {
        key: 'ronin', skin: '#dfb895', skinShade: '#ba8b69', lip: '#8f4d48',
        hair: '#252226', hairHi: '#453f46', hairLo: '#131114',
        robe: '#59606e', robeHi: '#89909e', robeLo: '#383d48', robeMid: '#6c7382',
        trim: '#b7bfc9', trimHi: '#d8dee4', trimLo: '#818a95', accent: '#7f3f42', accentHi: '#a85f60',
        boot: '#24252b', hairStyle: 'short', hat: 'straw', hatColor: '#b9a066', hatDark: '#7d6538', prop: 'katana'
    },
    {
        key: 'assassin', skin: '#d3a98b', skinShade: '#ad8267', lip: '#8a3a44',
        hair: '#171419', hairHi: '#2f2833', hairLo: '#0c0a0d',
        robe: '#20262b', robeHi: '#3d4a51', robeLo: '#12161a', robeMid: '#2c353b',
        trim: '#8b3a4b', trimHi: '#b45f72', trimLo: '#5c2230', accent: '#e05a76', accentHi: '#ff92a8',
        boot: '#101417', hairStyle: 'hood', mask: true, maskColor: '#1c2226', prop: 'daggers', evil: true
    }
];

/* ============================== 输出 ============================== */

function makePortrait(frame) {
    const scaled = new Px(FRAME_W * 3, FRAME_H * 3);
    for (let y = 0; y < scaled.h; y++) {
        for (let x = 0; x < scaled.w; x++) {
            scaled.set(x, y, rgbHex(frame.get(Math.floor(x / 3), Math.floor(y / 3))));
        }
    }
    const cropX = Math.floor((scaled.w - PORTRAIT_W) / 2);
    const out = new Px(PORTRAIT_W, PORTRAIT_H);
    for (let y = 0; y < PORTRAIT_H; y++) {
        for (let x = 0; x < PORTRAIT_W; x++) {
            out.set(x, y, rgbHex(scaled.get(cropX + x, y)));
        }
    }
    return out;
}

function rgbHex(rgba) {
    if (!rgba || rgba[3] === 0) return '#00000000';
    return '#' + rgba.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('') +
        (rgba[3] === 255 ? '' : rgba[3].toString(16).padStart(2, '0'));
}

// PNG encoder (RGBA, filter 0)
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    return table;
})();
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(px) {
    const w = px.w, h = px.h;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        Buffer.from(px.d.buffer, px.d.byteOffset + y * w * 4, w * 4)
            .copy(raw, y * (w * 4 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

const frames = CHARACTERS.map(character);
const sheet = new Px(FRAME_W * frames.length, FRAME_H);
frames.forEach((frame, i) => {
    for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
            const c = frame.get(x, y);
            if (c[3] > 0) sheet.set(i * FRAME_W + x, y, rgbHex(c));
        }
    }
});
const portraits = new Px(PORTRAIT_W * frames.length, PORTRAIT_H);
frames.forEach((frame, i) => {
    const portrait = makePortrait(frame);
    for (let y = 0; y < PORTRAIT_H; y++) {
        for (let x = 0; x < PORTRAIT_W; x++) {
            const c = portrait.get(x, y);
            if (c[3] > 0) portraits.set(i * PORTRAIT_W + x, y, rgbHex(c));
        }
    }
});

fs.writeFileSync(path.join(root, 'assets', 'npc-sprites.png'), encodePNG(sheet));
fs.writeFileSync(path.join(root, 'assets', 'npc-portraits.png'), encodePNG(portraits));
console.log('已生成 assets/npc-sprites.png 与 assets/npc-portraits.png (' + CHARACTERS.length + ' 帧)');
