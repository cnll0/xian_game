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
                break;
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
                break;
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
        this._drawChests(ctx, gameState);
        this._drawFloorNpc(ctx, gameState);
        this._drawPortal(ctx, gameState);

        const p = gameState.runtime.player;
        if (p) this._drawPlayer(ctx, p, gameState);

        gameState.runtime.monsters.forEach(m => this._drawMonster(ctx, m, gameState));
        gameState.runtime.bullets.forEach(b => this._drawBullet(ctx, b));
    }

    static _drawChests(ctx, gameState) {
        const img = gameState.runtime.assets.images.chest;
        if (!img) return;
        for (const chest of gameState.runtime.chests) {
            ctx.save();
            ctx.globalAlpha = chest.opened ? 0.35 : 1;
            const size = chest.opened ? 36 : 40;
            ctx.drawImage(img, chest.x - size / 2, chest.y - size / 2, size, size);
            ctx.restore();
        }
    }

    static _drawFloorNpc(ctx, gameState) {
        const npc = gameState.runtime.floorNpc;
        if (!npc) return;
        const images = gameState.runtime.assets.images;
        const bob = Math.sin(gameState.runtime.time * 2.8 + npc.phase) * 2;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.beginPath();
        ctx.ellipse(npc.x, npc.y + 25, 21, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        if (window.WorldRenderer) {
            window.WorldRenderer._drawNpcSprite(ctx, images, npc.npc.id, npc.x, npc.y + bob, 70);
        }
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(14,17,15,0.9)';
        ctx.fillStyle = '#fff0c2';
        ctx.strokeText(npc.npc.name, npc.x, npc.y - 44);
        ctx.fillText(npc.npc.name, npc.x, npc.y - 44);
        if (!npc.used) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#ffe7aa';
            ctx.fillText('靠近交谈  E', npc.x, npc.y - 30);
        }
        ctx.restore();
    }

    static _drawPortal(ctx, gameState) {
        const portal = gameState.runtime.portal;
        if (!portal) return;
        const img = gameState.runtime.assets.images.portal;
        if (!img) return;
        const pulse = 1 + Math.sin(portal.t * 4) * 0.08;
        ctx.drawImage(img, portal.x - 32 * pulse, portal.y - 32 * pulse, 64 * pulse, 64 * pulse);
    }

    static _drawPlayer(ctx, p, gameState) {
        const images = gameState.runtime.assets.images;
        const direction = window.WorldRenderer
            ? window.WorldRenderer._characterDirection(p.facing || 0).direction
            : 'south';
        const img = images['player_' + direction] || images.player_south || images.player;
        if (!img) return;

        ctx.save();
        ctx.translate(p.x, p.y);

        const frame = Math.floor(p.walkT / p.anim.frameTime) % p.anim.cols;
        const fw = p.anim.fw, fh = p.anim.fh;

        if (p.swinging > 0) {
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

        if (m.flash > 0) {
            ctx.globalAlpha = 0.5;
            m.flash -= 1/60;
        }

        // 怪物素材是单张方形立绘，不是四帧精灵表，直接整张缩放绘制
        const size = m.draw || m.r * 2;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);

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
        const prog = Math.min(1, e.t / e.life);
        const time = gameState.runtime.time || 0;

        if (e.type === 'slash') {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.a || 0);
            ctx.beginPath();
            ctx.arc(0, 0, (e.r || 46) * (0.7 + prog * 0.3), -1.1, 1.1);
            ctx.strokeStyle = e.color || '#7df9ff';
            ctx.globalAlpha = 1 - prog;
            ctx.lineWidth = 8 * (1 - prog) + 2;
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1;
            return;
        }

        if (e.type === 'boom') {
            ctx.beginPath();
            ctx.arc(e.x, e.y, 8 + prog * 26, 0, Math.PI * 2);
            ctx.strokeStyle = e.color || '#ffb43c';
            ctx.globalAlpha = 1 - prog;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }

        if (e.type === 'hit' || e.type === 'evolution') {
            const radius = (e.type === 'evolution' ? 12 : 5) + prog * (e.type === 'evolution' ? 40 : 23);
            ctx.save();
            ctx.globalAlpha = 1 - prog;
            ctx.strokeStyle = e.color || '#ffe078';
            ctx.lineWidth = e.type === 'evolution' ? 4 : 2;
            ctx.beginPath();
            ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + time * 2;
                ctx.beginPath();
                ctx.moveTo(e.x + Math.cos(a) * radius * 0.5, e.y + Math.sin(a) * radius * 0.5);
                ctx.lineTo(e.x + Math.cos(a) * (radius + 6), e.y + Math.sin(a) * (radius + 6));
                ctx.stroke();
            }
            ctx.restore();
            return;
        }

        if (e.type === 'lightning') {
            const dx = e.x2 - e.x, dy = e.y2 - e.y;
            const length = Math.hypot(dx, dy) || 1;
            ctx.save();
            ctx.globalAlpha = 1 - prog;
            ctx.strokeStyle = '#d9b2ff';
            ctx.shadowColor = '#a46dff';
            ctx.shadowBlur = 12;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            for (let i = 1; i < 5; i++) {
                const t = i / 5;
                const offset = (i % 2 ? 1 : -1) * Math.min(14, length * 0.08);
                ctx.lineTo(e.x + dx * t - dy / length * offset, e.y + dy * t + dx / length * offset);
            }
            ctx.lineTo(e.x2, e.y2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (e.type === 'knockback') {
            const dx = e.x2 - e.x, dy = e.y2 - e.y;
            const angle = Math.atan2(dy, dx);
            ctx.save();
            ctx.globalAlpha = 1 - prog;
            ctx.strokeStyle = '#ffe078';
            ctx.fillStyle = '#fff2bd';
            ctx.lineWidth = 3 * (1 - prog) + 1;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x2, e.y2);
            ctx.stroke();
            ctx.translate(e.x2, e.y2);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-11, -6);
            ctx.lineTo(-8, 0);
            ctx.lineTo(-11, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return;
        }

        if (e.type === 'dash' || e.type === 'afterimage') {
            ctx.save();
            ctx.globalAlpha = 1 - prog;
            ctx.strokeStyle = e.type === 'dash' ? '#d8b2ff' : '#a78aff';
            ctx.lineWidth = e.type === 'dash' ? 8 * (1 - prog) + 1 : 3;
            ctx.shadowColor = '#a46dff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            if (e.type === 'dash') {
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x2, e.y2);
            } else {
                ctx.ellipse(e.x, e.y, 13 + prog * 8, 23 + prog * 8, 0, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (e.type === 'hurt') {
            ctx.fillStyle = 'rgba(255,0,0,' + (0.3 * (1 - prog)) + ')';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            return;
        }

        if (e.type === 'element') {
            this._drawElement(ctx, e, gameState);
        }
    }

    static _drawElement(ctx, e, gameState) {
        const prog = Math.min(1, e.t / e.life);
        const color = e.element === 'fire' ? '#ff743e'
            : e.element === 'ice' ? '#8cecff'
                : e.element === 'stun' ? '#ffe67b'
                    : e.element === 'poison' ? '#a8dc75'
                        : e.element === 'roots' ? '#83d378'
                            : e.element === 'seal' || e.element === 'void' ? '#d4a0ff'
                                : e.element === 'heal' ? '#8df2ad'
                                    : e.element === 'crystal' ? '#8df2ed'
                                        : e.element === 'chain' ? '#c7a1ff' : '#7fffc1';
        const radius = 8 + prog * (e.element === 'ice' ? 30 : 20);
        ctx.save();
        ctx.globalAlpha = 1 - prog;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * (1 - prog) + 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (e.element === 'fire') {
            ctx.fillStyle = color;
            for (let i = 0; i < 5; i++) {
                const a = i * Math.PI * 0.4 + prog * 4;
                ctx.beginPath();
                ctx.arc(e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (e.element === 'roots' || e.element === 'crystal') {
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + prog;
                ctx.moveTo(e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 3);
                ctx.lineTo(e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius);
            }
            ctx.stroke();
        } else if (e.element === 'void') {
            ctx.beginPath();
            ctx.arc(e.x, e.y, radius * 0.45, prog * 7, prog * 7 + Math.PI * 1.5);
            ctx.stroke();
        } else if (e.element === 'chain') {
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(e.x + 30 * (1 - prog), e.y);
            ctx.stroke();
        } else {
            const glyph = e.element === 'stun' ? '✦'
                : e.element === 'ice' ? '❄'
                    : e.element === 'heal' ? '✚'
                        : e.element === 'shield' ? '◇'
                            : e.element === 'thorns' ? '✹'
                                : e.element === 'poison' ? '☠' : '✧';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = color;
            ctx.fillText(glyph, e.x, e.y - 8);
        }
        ctx.restore();
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
                break;
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
                break;
            case 'rune':
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    ctx.lineTo(Math.cos(a) * trap.radius, Math.sin(a) * trap.radius);
                }
                ctx.closePath();
                ctx.stroke();
                break;
            case 'ice':
                ctx.strokeStyle = trap.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, trap.radius, trap.radius * 0.6, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
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
                break;
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
        if (gameState.runtime.state === 'world' ||
            (gameState.runtime.state === 'dialog' && gameState.runtime.npcPausedState === 'world')) {
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

/**
 * 秘境大世界渲染器 - 支持迷雾/视野系统
 */
class DungeonWorldRenderer {
    static render(ctx, gameState) {
        const combat = gameState.runtime;
        const world = combat.dungeonWorld;
        const images = combat.assets.images;
        const W = 960;
        const H = 540;
        const time = combat.time || 0;

        if (!world || !combat.player) return;

        const p = combat.player;
        const visionRange = combat.playerVision || 280;

        // 计算相机位置（跟随玩家）
        const camX = MathUtils.clamp(p.x - W / 2, 0, world.width - W);
        const camY = MathUtils.clamp(p.y - H / 2, 0, world.height - H);

        // 背景
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.translate(-camX, -camY);

        // 绘制地形装饰（仅在视野内）
        if (world.decor) {
            for (const d of world.decor) {
                if (this._inVision(d.x, d.y, p.x, p.y, visionRange)) {
                    this._drawDecor(ctx, d, time);
                }
            }
        }

        // 绘制地标（仅在视野内或已探索）
        if (world.landmarks) {
            for (const lm of world.landmarks) {
                const inVision = this._inVision(lm.x, lm.y, p.x, p.y, visionRange);
                const explored = combat.explored && combat.explored.has(Math.floor(lm.x / 16) + ',' + Math.floor(lm.y / 16));
                if (inVision || explored) {
                    this._drawLandmark(ctx, lm, time, inVision ? 1 : 0.4);
                }
            }
        }

        // 绘制陷阱（仅在视野内）
        if (combat.traps) {
            for (const trap of combat.traps) {
                if (this._inVision(trap.x, trap.y, p.x, p.y, visionRange)) {
                    window.TrapRenderer._drawTrap(ctx, trap, time);
                }
            }
        }

        // 绘制宝箱
        if (combat.chests) {
            for (const chest of combat.chests) {
                if (!chest.opened && this._inVision(chest.x, chest.y, p.x, p.y, visionRange)) {
                    this._drawChest(ctx, chest, images, time);
                }
            }
        }

        // 绘制怪物（仅在玩家视野内）
        if (combat.monsters) {
            for (const m of combat.monsters) {
                if (m.hp <= 0) continue;
                if (m.inPlayerVision) {
                    window.EntityRenderer._drawMonster(ctx, m, images, time);
                }
            }
        }

        // 绘制玩家
        window.EntityRenderer._drawPlayer(ctx, p, images, time, true);

        // 绘制NPC
        if (combat.floorNpc && !combat.floorNpc.used) {
            const npc = combat.floorNpc;
            if (this._inVision(npc.x, npc.y, p.x, p.y, visionRange)) {
                this._drawNpc(ctx, npc, images, time, combat);
            }
        }

        // 绘制出口标记
        if (world.exit) {
            const inVision = this._inVision(world.exit.x, world.exit.y, p.x, p.y, visionRange);
            if (inVision) {
                this._drawExit(ctx, world.exit, time);
            }
        }

        ctx.restore();

        // 绘制迷雾遮罩（在相机变换外绘制，覆盖整个屏幕）
        this._drawFogOfWar(ctx, gameState, camX, camY, W, H);

        // 绘制小地图
        this._drawMiniMap(ctx, gameState, camX, camY, W, H);
    }

    static _inVision(x, y, px, py, range) {
        const dx = x - px;
        const dy = y - py;
        return dx * dx + dy * dy <= range * range;
    }

    static _drawDecor(ctx, d, time) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.turn || 0);
        ctx.fillStyle = d.color || '#555';

        if (d.kind === 'tree') {
            ctx.beginPath();
            ctx.ellipse(0, 0, d.size * 0.8, d.size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = this._lighten(d.color, 20);
            ctx.beginPath();
            ctx.ellipse(0, -d.size * 0.2, d.size * 0.5, d.size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(-d.size, d.size * 0.5);
            ctx.lineTo(0, -d.size);
            ctx.lineTo(d.size, d.size * 0.5);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    static _drawLandmark(ctx, lm, time, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(lm.x, lm.y);
        ctx.rotate(lm.turn || 0);
        ctx.fillStyle = lm.color || '#888';

        if (lm.type === 'ancient-tree' || lm.type === 'bamboo-grove') {
            ctx.fillRect(-lm.w * 0.15, -lm.h, lm.w * 0.3, lm.h * 2);
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(-lm.w * 0.2, -lm.h + i * lm.h * 0.6, lm.w * 0.4, 4);
            }
        } else if (lm.type === 'broken-wall' || lm.type === 'sunken-court') {
            ctx.fillRect(-lm.w / 2, -lm.h / 2, lm.w, lm.h);
        } else if (lm.type === 'obelisk' || lm.type === 'ritual-ring') {
            ctx.beginPath();
            ctx.ellipse(0, 0, lm.w / 2, lm.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-lm.w / 2, -lm.h / 2, lm.w, lm.h);
        }
        ctx.restore();
    }

    static _drawChest(ctx, chest, images, time) {
        ctx.save();
        ctx.translate(chest.x, chest.y);
        const bob = Math.sin(time * 3) * 3;
        const img = images.chest;
        if (img) {
            ctx.drawImage(img, -24, -24 + bob, 48, 48);
        } else {
            ctx.fillStyle = '#c9b037';
            ctx.fillRect(-20, -20 + bob, 40, 40);
        }
        ctx.restore();
    }

    static _drawNpc(ctx, floorNpc, images, time, combat) {
        const bob = Math.sin(time * 2 + floorNpc.phase) * 4;
        ctx.save();
        ctx.translate(floorNpc.x, floorNpc.y + bob);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 25, 22, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        const npcId = floorNpc.npc.portrait || floorNpc.npc.id;
        const img = images.npcSprites;
        if (img) {
            const portraits = {
                ningxiao: { x: 0, y: 0 }, linyue: { x: 96, y: 0 }, shenli: { x: 192, y: 0 },
                guqinghan: { x: 288, y: 0 }, mochen: { x: 384, y: 0 },
                jichang: { x: 480, y: 0 }, hanxing: { x: 576, y: 0 }
            };
            const pos = portraits[npcId] || portraits.ningxiao;
            ctx.drawImage(img, pos.x, pos.y, 96, 96, -36, -72, 72, 72);
        }

        // 显示交互提示（如果是最近的可交互NPC）
        if (combat && combat.nearbyDungeonNpc === floorNpc && !floorNpc.used) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(-50, -95, 100, 24);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('按 E 交谈', 0, -80);
        }

        ctx.restore();
    }

    static _drawExit(ctx, exit, time) {
        const pulse = 0.5 + Math.sin(time * 4) * 0.5;
        ctx.save();
        ctx.translate(exit.x, exit.y);
        // 传送门效果
        ctx.strokeStyle = `rgba(78, 205, 196, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            const r = 30 + i * 15 + pulse * 10;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        // 中心光柱
        ctx.fillStyle = `rgba(78, 205, 196, ${0.6 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(0, 0, 20 + pulse * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * 绘制迷雾遮罩 - 覆盖不在视野内的区域
     */
    static _drawFogOfWar(ctx, gameState, camX, camY, W, H) {
        const combat = gameState.runtime;
        const p = combat.player;
        const visionRange = combat.playerVision || 280;
        const explored = combat.explored || new Set();
        const gridSize = 16;

        // 创建离屏canvas用于绘制迷雾
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = W;
        fogCanvas.height = H;
        const fogCtx = fogCanvas.getContext('2d');

        // 基础迷雾层
        fogCtx.fillStyle = 'rgba(10, 10, 20, 0.85)';
        fogCtx.fillRect(0, 0, W, H);

        // 擦除视野范围内的迷雾
        const vx = p.x - camX;
        const vy = p.y - camY;

        // 创建径向渐变用于柔和边缘
        const gradient = fogCtx.createRadialGradient(vx, vy, 0, vx, vy, visionRange);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.7, 'rgba(10,10,20,0.3)');
        gradient.addColorStop(1, 'rgba(10,10,20,0.85)');

        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.fillStyle = gradient;
        fogCtx.fillRect(0, 0, W, H);

        // 恢复已探索但不在当前视野内的区域（半透明迷雾）
        fogCtx.globalCompositeOperation = 'source-over';
        fogCtx.fillStyle = 'rgba(10, 10, 20, 0.5)';

        for (const key of explored) {
            const [gx, gy] = key.split(',').map(Number);
            const wx = gx * gridSize - camX;
            const wy = gy * gridSize - camY;
            const dx = wx - vx;
            const dy = wy - vy;
            if (dx * dx + dy * dy > visionRange * visionRange) {
                // 在屏幕范围内才绘制
                if (wx > -gridSize && wx < W + gridSize && wy > -gridSize && wy < H + gridSize) {
                    fogCtx.fillRect(wx, wy, gridSize, gridSize);
                }
            }
        }

        ctx.drawImage(fogCanvas, 0, 0);
    }

    /**
     * 绘制小地图
     */
    static _drawMiniMap(ctx, gameState, camX, camY, W, H) {
        const combat = gameState.runtime;
        const world = combat.dungeonWorld;
        if (!world) return;

        const mmW = 180, mmH = 120;
        const mmX = W - mmW - 10, mmY = 10;
        const scaleX = mmW / world.width;
        const scaleY = mmH / world.height;
        const p = combat.player;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(mmX, mmY, mmW, mmH);

        // 地形
        ctx.fillStyle = '#333';
        if (world.decor) {
            world.decor.forEach(d => {
                ctx.fillRect(mmX + d.x * scaleX - 1, mmY + d.y * scaleY - 1, 2, 2);
            });
        }

        // 地标
        if (world.landmarks) {
            world.landmarks.forEach(lm => {
                ctx.fillStyle = lm.color || '#666';
                ctx.fillRect(mmX + lm.x * scaleX - 2, mmY + lm.y * scaleY - 2, 4, 4);
            });
        }

        // 怪物
        if (combat.monsters) {
            combat.monsters.forEach(m => {
                if (m.hp > 0) {
                    ctx.fillStyle = m.inPlayerVision ? '#ff6b6b' : '#663333';
                    ctx.beginPath();
                    ctx.arc(mmX + m.x * scaleX, mmY + m.y * scaleY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // NPC
        if (combat.floorNpc && !combat.floorNpc.used) {
            const npc = combat.floorNpc;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(mmX + npc.x * scaleX, mmY + npc.y * scaleY, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // 出口
        if (world.exit) {
            ctx.fillStyle = '#4ecdc4';
            ctx.beginPath();
            ctx.arc(mmX + world.exit.x * scaleX, mmY + world.exit.y * scaleY, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 玩家
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(mmX + p.x * scaleX, mmY + p.y * scaleY, 5, 0, Math.PI * 2);
        ctx.fill();

        // 视野范围圆
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mmX + p.x * scaleX, mmY + p.y * scaleY, (combat.playerVision || 280) * scaleX, 0, Math.PI * 2);
        ctx.stroke();

        // 相机视野矩形
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 1;
        ctx.strokeRect(mmX + camX * scaleX, mmY + camY * scaleY, W * scaleX, H * scaleY);

        ctx.restore();
    }

    static _lighten(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) + amount;
        let g = (num >> 8 & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        r = r > 255 ? 255 : r < 0 ? 0 : r;
        g = g > 255 ? 255 : g < 0 ? 0 : g;
        b = b > 255 ? 255 : b < 0 ? 0 : b;
        return (usePound ? '#' : '') + (b | g << 8 | r << 16).toString(16).padStart(6, '0');
    }
}

window.Renderer = Renderer;
window.FloorRenderer = FloorRenderer;
window.SceneryRenderer = SceneryRenderer;
window.EntityRenderer = EntityRenderer;
window.EffectRenderer = EffectRenderer;
window.TrapRenderer = TrapRenderer;
window.UIRenderer = UIRenderer;
window.DungeonWorldRenderer = DungeonWorldRenderer;