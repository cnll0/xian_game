'use strict';

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.layers = [];
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.constants = { W: 960, H: 540, WORLD_ZOOM: 1.35 };
    }

    addLayer(name, renderFn, order = 0, enabled = true) {
        this.layers.push({ name, renderFn, order, enabled });
        this.layers.sort((a, b) => a.order - b.order);
    }

    removeLayer(name) {
        this.layers = this.layers.filter(l => l.name !== name);
    }

    setLayerEnabled(name, enabled) {
        const layer = this.layers.find(l => l.name === name);
        if (layer) layer.enabled = enabled;
    }

    render(gameState, input) {
        const ctx = this.ctx;
        const { W, H } = this.constants;

        ctx.clearRect(0, 0, W, H);

        for (const layer of this.layers) {
            if (!layer.enabled) continue;
            try {
                layer.renderFn(ctx, gameState, input, this.camera);
            } catch (e) {
                console.error(`Render error in layer ${layer.name}:`, e);
            }
        }
    }
}

class FloorRenderer {
    static render(ctx, gameState) {
        const { floorPattern } = gameState.runtime.assets;
        if (floorPattern) {
            ctx.fillStyle = floorPattern;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    }
}

class SceneryRenderer {
    static render(ctx, gameState) {
        const { scenery, landmarks } = gameState.runtime;
        scenery.forEach(item => this._drawSceneryItem(ctx, item));
        landmarks.forEach(item => this._drawLandmark(ctx, item));
    }

    static _drawSceneryItem(ctx, item) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.turn);
        ctx.fillStyle = item.color;

        switch (item.type) {
            case 'shrub':
                ctx.beginPath();
                ctx.ellipse(0, 0, item.size * 0.8, item.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = this._lighten(item.color, 20);
                ctx.beginPath();
                ctx.ellipse(0, -item.size * 0.2, item.size * 0.5, item.size * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'bamboo':
                ctx.fillRect(-item.size * 0.15, -item.size, item.size * 0.3, item.size * 2);
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect(-item.size * 0.2, -item.size + i * item.size * 0.6, item.size * 0.4, 4);
                }
                break;
            case 'flower':
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = i * Math.PI * 2 / 5;
                    ctx.ellipse(Math.cos(a) * item.size, Math.sin(a) * item.size, item.size * 0.4, item.size * 0.4, a, 0, Math.PI * 2);
                }
                ctx.fill();
                break;
            case 'stone':
                ctx.beginPath();
                ctx.moveTo(-item.size, item.size * 0.5);
                ctx.lineTo(0, -item.size);
                ctx.lineTo(item.size, item.size * 0.5);
                ctx.closePath();
                ctx.fill();
                break;
            case 'bone':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.ellipse(-item.size * 0.4, 0, item.size * 0.35, item.size * 0.8, -0.3, 0, Math.PI * 2);
                ctx.ellipse(item.size * 0.4, 0, item.size * 0.35, item.size * 0.8, 0.3, 0, Math.PI * 2);
                ctx.ellipse(0, 0, item.size * 0.4, item.size * 0.25, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'bonepile':
                for (let i = 0; i < 3; i++) {
                    ctx.save();
                    ctx.translate((i - 1) * item.size * 0.5, i * item.size * 0.3);
                    ctx.rotate((i - 1) * 0.5);
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, item.size * 0.4, item.size, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                break;
            case 'crystal':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(0, -item.size);
                ctx.lineTo(item.size * 0.6, 0);
                ctx.lineTo(0, item.size);
                ctx.lineTo(-item.size * 0.6, 0);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'ore':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.size, item.size * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'basalt':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.moveTo(-item.size, item.size * 0.3);
                ctx.lineTo(0, -item.size);
                ctx.lineTo(item.size, item.size * 0.3);
                ctx.lineTo(item.size * 0.5, item.size);
                ctx.lineTo(-item.size * 0.5, item.size);
                ctx.closePath();
                ctx.fill();
                break;
            case 'ember':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(0, 0, item.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'ice':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.moveTo(0, -item.size);
                ctx.lineTo(item.size * 0.7, -item.size * 0.3);
                ctx.lineTo(item.size * 0.5, item.size);
                ctx.lineTo(-item.size * 0.5, item.size);
                ctx.lineTo(-item.size * 0.7, -item.size * 0.3);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'icepool':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.size, item.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'pillar':
                ctx.fillStyle = item.color;
                ctx.fillRect(-item.size * 0.4, -item.size, item.size * 0.8, item.size * 2);
                ctx.fillStyle = this._lighten(item.color, 30);
                ctx.fillRect(-item.size * 0.3, -item.size, item.size * 0.2, item.size * 1.5);
                break;
            case 'rune':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 + item.phase;
                    ctx.lineTo(Math.cos(a) * item.size, Math.sin(a) * item.size);
                }
                ctx.closePath();
                ctx.fill();
                break;
            case 'brazier':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(0, 0, item.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffaa00';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(0, -item.size * 0.3, item.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'rubble':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.moveTo(-item.size, item.size * 0.2);
                ctx.lineTo(0, -item.size * 0.5);
                ctx.lineTo(item.size * 0.8, item.size * 0.4);
                ctx.lineTo(item.size * 0.3, item.size);
                ctx.lineTo(-item.size * 0.7, item.size * 0.6);
                ctx.closePath();
                ctx.fill();
                break;
        }
        ctx.restore();
    }

    static _drawLandmark(ctx, item) {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.turn);
        ctx.fillStyle = item.color;

        switch (item.type) {
            case 'grove':
                for (let i = 0; i < 5; i++) {
                    const a = i * Math.PI * 2 / 5;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(a) * item.w * 0.3, Math.sin(a) * item.h * 0.3, item.w * 0.25, item.h * 0.25, a, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'pool':
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'fallen-log':
                ctx.fillRect(-item.w * 0.5, -item.h * 0.2, item.w, item.h * 0.4);
                break;
            case 'broken-wall':
                ctx.fillRect(-item.w * 0.5, -item.h * 0.5, item.w, item.h);
                ctx.clearRect(-item.w * 0.3, -item.h * 0.3, item.w * 0.6, item.h * 0.6);
                break;
            case 'sunken-court':
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'obelisk':
                ctx.fillRect(-item.w * 0.2, -item.h, item.w * 0.4, item.h * 2);
                ctx.fillStyle = this._lighten(item.color, 30);
                ctx.fillRect(-item.w * 0.15, -item.h * 0.9, item.w * 0.1, item.h * 1.5);
                break;
            case 'bone-pit':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < 4; i++) {
                    const a = i * Math.PI / 2;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(a) * item.w * 0.3, Math.sin(a) * item.h * 0.3, 8, 15, a, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'rib-cage':
                ctx.fillStyle = item.color;
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * item.w * 0.5, Math.sin(a) * item.h * 0.5);
                    ctx.stroke();
                }
                break;
            case 'bone-pile':
                for (let i = 0; i < 4; i++) {
                    ctx.save();
                    ctx.translate((i - 1.5) * 15, i * 10);
                    ctx.rotate((i - 1.5) * 0.4);
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 12, 25, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                break;
            case 'crystal-vein':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.7;
                for (let i = 0; i < 3; i++) {
                    ctx.save();
                    ctx.translate((i - 1) * 20, 0);
                    ctx.beginPath();
                    ctx.moveTo(0, -item.h * 0.5);
                    ctx.lineTo(item.w * 0.3, 0);
                    ctx.lineTo(0, item.h * 0.5);
                    ctx.lineTo(-item.w * 0.3, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
                ctx.globalAlpha = 1;
                break;
            case 'ore-field':
                for (let i = 0; i < 4; i++) {
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.ellipse((i - 1.5) * 25, 0, 15 + i * 5, 10, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'collapsed-shaft':
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'bamboo-grove':
                for (let i = 0; i < 8; i++) {
                    ctx.fillStyle = item.color;
                    ctx.fillRect((i - 3.5) * 20, -item.h, 8, item.h * 2);
                }
                break;
            case 'stream':
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(-item.w * 0.5, 0);
                ctx.quadraticCurveTo(0, item.h * 0.3, item.w * 0.5, 0);
                ctx.stroke();
                break;
            case 'lava-rift':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(-item.w * 0.5, -item.h * 0.5, item.w, item.h);
                ctx.globalAlpha = 1;
                break;
            case 'basalt-island':
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'ember-crater':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break.
            case 'frozen-pond':
                ctx.fillStyle = item.color;
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            case 'ice-spines':
                ctx.fillStyle = item.color;
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * item.w * 0.5, Math.sin(a) * item.h * 0.5);
                    ctx.stroke();
                }
                break;
            case 'ritual-ring':
                ctx.strokeStyle = item.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.ellipse(0, 0, item.w * 0.5, item.h * 0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
                break.
        }
        ctx.restore();
    }

    static _lighten(color, amount) {
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + amount);
        const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
        const b = Math.min(255, (num & 0xFF) + amount);
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }
}

class EntityRenderer {
    static render(ctx, gameState) {
        const p = gameState.runtime.player;
        if (p) this._drawPlayer(ctx, p, gameState);

        gameState.runtime.monsters.forEach(m => this._drawMonster(ctx, m, gameState));
        gameState.runtime.bullets.forEach(b => this._drawBullet(ctx, b));
    }

    static _drawPlayer(ctx, p, gameState) {
        const img = gameState.runtime.assets.images[p.anim.dirMap.down] ||
            gameState.runtime.assets.images.player;
        if (!img) return;

        ctx.save();
        ctx.translate(p.x, p.y);

        const frame = Math.floor(p.walkT / p.anim.frameTime) % p.anim.cols;
        const fw = p.anim.fw, fh = p.anim.fh;

        if (p.swinging > 0) {
            ctx.rotate(p.facing + Math.PI / 2);
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = p.mods.elemFire ? '#ff6b35' : p.mods.elemIce ? '#4ecdc4' : '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(p.facing) * 60, Math.sin(p.facing) * 60);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (img.width > fw) {
            ctx.drawImage(img, frame * fw, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
        }

        if (p.shield > 0) {
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 + Math.sin(gameState.runtime.time * 10) * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, p.r + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        if (p.invuln > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(gameState.runtime.time * 20) * 0.5;
        }

        ctx.restore();
    }

    static _drawMonster(ctx, m, gameState) {
        const img = gameState.runtime.assets.images[m.img];
        if (!img) return;

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.facing);

        if (m.flash > 0) {
            ctx.globalAlpha = 0.5;
            m.flash -= 1/60;
        }

        if (m.img === 'boss' || m.img === 'qingyunBoss' || m.img === 'emberBoss' || m.img === 'frostBoss' || m.img === 'netherBoss') {
            ctx.drawImage(img, 0, 0, img.width, img.height, -m.r * 2, -m.r * 2, m.r * 4, m.r * 4);
        } else if (img.width > 64) {
            const frame = Math.floor(gameState.runtime.time * 4) % 4;
            ctx.drawImage(img, frame * 64, 0, 64, 64, -m.r, -m.r, m.r * 2, m.r * 2);
        } else {
            ctx.drawImage(img, -m.r, -m.r, m.r * 2, m.r * 2);
        }

        if (m.boss) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, m.r + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (m.hp < m.maxHp) {
            ctx.fillStyle = '#333';
            ctx.fillRect(-m.r, -m.r - 10, m.r * 2, 4);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-m.r, -m.r - 10, m.r * 2 * (m.hp / m.maxHp), 4);
        }

        ctx.restore();
    }

    static _drawBullet(ctx, b) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.fillStyle = b.color;
        if (b.vx !== undefined) {
            ctx.rotate(Math.atan2(b.vy, b.vx));
            ctx.fillRect(-b.r * 2, -b.r / 2, b.r * 4, b.r);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class EffectRenderer {
    static render(ctx, gameState) {
        gameState.runtime.effects.forEach(e => this._drawEffect(ctx, e, gameState));
        gameState.runtime.texts.forEach(t => this._drawText(ctx, t));
    }

    static _drawEffect(ctx, e, gameState) {
        const alpha = 1 - e.t / e.life;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(e.x, e.y);

        switch (e.type) {
            case 'boom':
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 3;
                for (let i = 0; i < 3; i++) {
                    const r = e.t / e.life * 40 * (i + 1) / 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;
            case 'element':
                this._drawElement(ctx, e);
                break;
            case 'evolution':
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 2;
                const r = e.t / e.life * 50;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4 + e.t * 5;
                    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.stroke();
                break;
        }
        ctx.restore();
    }

    static _drawElement(ctx, e) {
        const size = 1 - e.t / e.life * 0.5;
        switch (e.element) {
            case 'fire':
                ctx.fillStyle = '#ff6b35';
                ctx.beginPath();
                ctx.moveTo(0, -15 * size);
                ctx.lineTo(10 * size, 10 * size);
                ctx.lineTo(-10 * size, 10 * size);
                ctx.closePath();
                ctx.fill();
                break;
            case 'ice':
                ctx.fillStyle = '#4ecdc4';
                ctx.beginPath();
                ctx.moveTo(0, -12 * size);
                ctx.lineTo(8 * size, 8 * size);
                ctx.lineTo(-8 * size, 8 * size);
                ctx.closePath();
                ctx.fill();
                break;
            case 'poison':
                ctx.fillStyle = '#a8dc75';
                ctx.beginPath();
                ctx.arc(0, 0, 8 * size, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'heal':
                ctx.fillStyle = '#d58bff';
                ctx.fillRect(-6 * size, -6 * size, 12 * size, 12 * size);
                break;
            case 'shield':
                ctx.strokeStyle = '#4ecdc4';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 20 * size, 0, Math.PI * 2);
                ctx.stroke();
                break.
            case 'chain':
                ctx.strokeStyle = '#8cecff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(30 * size, 0);
                ctx.stroke();
                break;
        }
    }

    static _drawText(ctx, t) {
        ctx.save();
        ctx.globalAlpha = 1 - t.t / (t.life || 1);
        ctx.fillStyle = t.color;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
    }
}

class TrapRenderer {
    static render(ctx, gameState) {
        gameState.runtime.traps.forEach(trap => this._drawTrap(ctx, trap, gameState));
    }

    static _drawTrap(ctx, trap, gameState) {
        const cycle = Math.floor((gameState.runtime.time + trap.phase) / trap.period);
        const phaseTime = (gameState.runtime.time + trap.phase) % trap.period;
        const active = phaseTime >= trap.warning && phaseTime < trap.warning + trap.activeDuration;
        const warning = phaseTime < trap.warning && phaseTime > trap.warning - 0.5;

        if (!active && !warning) return;

        ctx.save();
        ctx.translate(trap.x, trap.y);
        ctx.rotate(trap.phase);

        ctx.strokeStyle = trap.color;
        ctx.lineWidth = active ? 3 : 2;
        ctx.globalAlpha = active ? 0.95 : 0.5;

        switch (trap.type) {
            case 'roots':
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3 + gameState.runtime.time * 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a) * trap.radius, Math.sin(a) * trap.radius);
                    ctx.stroke();
                }
                break;
            case 'blade':
                for (let i = 0; i < 2; i++) {
                    const a = i * Math.PI + gameState.runtime.time * 1.65;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
                    ctx.lineTo(Math.cos(a) * trap.radius, Math.sin(a) * trap.radius);
                    ctx.stroke();
                }
                break;
            case 'sinkhole':
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius * 0.4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius * 0.8, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'bone':
                for (let i = 0; i < 3; i++) {
                    const a = i * Math.PI * 2 / 3 + gameState.runtime.time * 0.72;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
                    ctx.lineTo(Math.cos(a) * trap.radius, Math.sin(a) * trap.radius);
                    ctx.stroke();
                }
                break;
            case 'crystal':
                ctx.beginPath();
                ctx.moveTo(0, -trap.radius);
                ctx.lineTo(trap.radius * 0.7, 0);
                ctx.lineTo(0, trap.radius);
                ctx.lineTo(-trap.radius * 0.7, 0);
                ctx.closePath();
                ctx.stroke();
                if (active) ctx.fill();
                break.
            case 'miasma':
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = trap.color;
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'fire':
                ctx.fillStyle = trap.color;
                ctx.globalAlpha = active ? 0.6 : 0.3;
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius, 0, Math.PI * 2);
                ctx.fill();
                break.
            case 'rune':
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    ctx.lineTo(Math.cos(a) * trap.radius, Math.sin(a) * trap.radius);
                }
                ctx.closePath();
                ctx.stroke();
                break.
            case 'ice':
                ctx.strokeStyle = trap.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, trap.radius, trap.radius * 0.6, 0, 0, Math.PI * 2);
                ctx.stroke();
                break.
            case 'altar':
                ctx.strokeStyle = trap.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, 12 + Math.sin(gameState.runtime.time * 3) * 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius * 0.45, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius * 0.75, 0, Math.PI * 2);
                ctx.stroke();
                if (active) ctx.fill();
                break.
        }

        if (warning || active) {
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = active ? 0.95 : 0.8;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(15,8,20,0.9)';
            ctx.fillStyle = trap.color;
            ctx.strokeText(trap.name, trap.x, trap.y - trap.radius - 16);
            ctx.fillText(trap.name, trap.x, trap.y - trap.radius - 16);
            ctx.font = '10px sans-serif';
            ctx.strokeText(trap.hint, trap.x, trap.y - trap.radius - 3);
            ctx.fillText(trap.hint, trap.x, trap.y - trap.radius - 3);
        }

        ctx.restore();
    }
}

class UIRenderer {
    static render(ctx, gameState) {
        if (gameState.runtime.state === 'world') {
            this._drawMinimap(ctx, gameState);
        }
    }

    static _drawMinimap(ctx, gameState) {
        const { W, H } = gameState.constants;
        const mmW = 200, mmH = 133;
        const mmX = W - mmW - 10, mmY = 10;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(mmX, mmY, mmW, mmH);

        const scaleX = mmW / 3600;
        const scaleY = mmH / 2400;

        ctx.fillStyle = '#444';
        gameState.runtime.world.decor.forEach(d => {
            if (d.kind === 'tree') {
                ctx.fillStyle = '#2d5a27';
            } else {
                ctx.fillStyle = '#555';
            }
            ctx.fillRect(mmX + d.x * scaleX - 1, mmY + d.y * scaleY - 1, 2, 2);
        });

        gameState.runtime.world.actors.forEach(a => {
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(mmX + a.x * scaleX, mmY + a.y * scaleY, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        gameState.runtime.world.creatures.forEach(c => {
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(mmX + c.x * scaleX, mmY + c.y * scaleY, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        const p = gameState.runtime.world.player;
        if (p) {
            ctx.fillStyle = '#4ecdc4';
            ctx.beginPath();
            ctx.arc(mmX + p.x * scaleX, mmY + p.y * scaleY, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        const cam = gameState.runtime.world.camera;
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            mmX + cam.x * scaleX,
            mmY + cam.y * scaleY,
            (W / gameState.constants.WORLD_ZOOM) * scaleX,
            (H / gameState.constants.WORLD_ZOOM) * scaleY
        );

        ctx.restore();
    }
}

window.Renderer = Renderer;
window.FloorRenderer = FloorRenderer;
window.SceneryRenderer = SceneryRenderer;
window.EntityRenderer = EntityRenderer;
window.EffectRenderer = EffectRenderer;
window.TrapRenderer = TrapRenderer;
window.UIRenderer = UIRenderer;