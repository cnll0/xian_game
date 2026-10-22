'use strict';

/**
 * 大地图渲染器：从旧引擎 drawWorldMap 迁移而来。
 * 只负责绘制世界场景，状态全部来自 gameState.runtime.world。
 */
class WorldRenderer {
    static render(ctx, gameState) {
        const world = gameState.runtime.world;
        const images = gameState.runtime.assets.images;
        const W = 960;
        const H = 540;
        const WORLD_ZOOM = 1.35;
        const time = world.time || 0;
        const drawSprite = (key, x, y, size) => this._drawSprite(ctx, images, key, x, y, size, world);
        const drawNpcSprite = (npcId, x, y, height) => this._drawNpcSprite(ctx, images, npcId, x, y, height);
        let camera = world.camera;
        let p = world.player;
        let pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
        const storyId = window.G && window.G.story ? window.G.story.node : null;
        const storyLocation = storyId && window.STORY_LOCATIONS ? window.STORY_LOCATIONS[storyId] : null;

        ctx.fillStyle = '#26382a';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
        ctx.translate(-camera.x, -camera.y);
        let ground = ctx.createLinearGradient(0, 0, 1800, 2400);
        ground.addColorStop(0, '#47583d');
        ground.addColorStop(0.42, '#596545');
        ground.addColorStop(1, '#39483a');
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, 3600, 2400);
        if (world.zone !== 'overworld') {
            let dungeon = window.DUNGEONS.find(item => item.id === world.zone);
            if (dungeon) {
                ctx.globalAlpha = 0.16;
                ctx.fillStyle = dungeon.color;
                ctx.fillRect(0, 0, 3600, 2400);
                ctx.globalAlpha = 1;
            }
        }

        const paintRidge = (x, y, rx, ry, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(x, y, rx, ry, -0.35, 0, Math.PI * 2);
            ctx.fill();
        };
        paintRidge(2910, 450, 740, 470, 'rgba(53,62,72,0.62)');
        paintRidge(2520, 800, 430, 390, 'rgba(76,85,83,0.52)');
        paintRidge(1560, 180, 730, 310, 'rgba(71,83,72,0.44)');
        paintRidge(790, 360, 340, 520, 'rgba(76,86,70,0.4)');

        const drawMountain = (x, y, size, shade) => {
            ctx.fillStyle = 'rgba(19,29,29,0.25)';
            ctx.beginPath();
            ctx.ellipse(x + 10, y + size * 0.42, size * 0.77, size * 0.24, -0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = shade;
            ctx.beginPath();
            ctx.moveTo(x - size * 0.76, y + size * 0.4);
            ctx.lineTo(x - size * 0.18, y - size * 0.52);
            ctx.lineTo(x + size * 0.1, y - size * 0.05);
            ctx.lineTo(x + size * 0.43, y - size * 0.68);
            ctx.lineTo(x + size * 0.82, y + size * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(27,41,42,0.25)';
            ctx.beginPath();
            ctx.moveTo(x + size * 0.1, y - size * 0.05);
            ctx.lineTo(x + size * 0.43, y - size * 0.68);
            ctx.lineTo(x + size * 0.82, y + size * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(224,224,204,0.66)';
            ctx.beginPath();
            ctx.moveTo(x + size * 0.31, y - size * 0.43);
            ctx.lineTo(x + size * 0.43, y - size * 0.68);
            ctx.lineTo(x + size * 0.59, y - size * 0.24);
            ctx.lineTo(x + size * 0.46, y - size * 0.31);
            ctx.lineTo(x + size * 0.4, y - size * 0.17);
            ctx.closePath();
            ctx.fill();
        };
        drawMountain(2980, 490, 260, '#606b68');
        drawMountain(2730, 590, 210, '#69736c');
        drawMountain(3200, 720, 230, '#545e60');
        drawMountain(2510, 850, 170, '#71776b');
        drawMountain(2080, 285, 150, '#72796a');
        drawMountain(820, 650, 165, '#697260');

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(1110, 2400);
        ctx.bezierCurveTo(1290, 2190, 720, 2060, 830, 1840);
        ctx.bezierCurveTo(915, 1670, 1480, 1710, 1430, 1460);
        ctx.bezierCurveTo(1385, 1260, 1080, 1230, 1310, 1040);
        ctx.bezierCurveTo(1520, 870, 2090, 1040, 2190, 810);
        ctx.bezierCurveTo(2290, 590, 2040, 455, 1890, 355);
        ctx.strokeStyle = 'rgba(34,42,32,0.3)';
        ctx.lineWidth = 49;
        ctx.stroke();
        ctx.strokeStyle = '#b29b70';
        ctx.lineWidth = 37;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(207,186,142,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 18]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(140, 1120);
        ctx.bezierCurveTo(410, 950, 650, 1090, 920, 900);
        ctx.bezierCurveTo(1160, 730, 1300, 810, 1560, 670);
        ctx.strokeStyle = 'rgba(34,42,32,0.25)';
        ctx.lineWidth = 31;
        ctx.stroke();
        ctx.strokeStyle = '#a99571';
        ctx.lineWidth = 22;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(2430, 2400);
        ctx.bezierCurveTo(2300, 2180, 2600, 2020, 2450, 1810);
        ctx.bezierCurveTo(2310, 1600, 2600, 1420, 2500, 1220);
        ctx.bezierCurveTo(2390, 1010, 2710, 900, 2650, 720);
        ctx.bezierCurveTo(2580, 520, 2810, 390, 2910, 215);
        ctx.lineTo(3020, 245);
        ctx.bezierCurveTo(2910, 460, 2730, 570, 2770, 760);
        ctx.bezierCurveTo(2820, 980, 2520, 1080, 2630, 1290);
        ctx.bezierCurveTo(2760, 1510, 2440, 1680, 2580, 1880);
        ctx.bezierCurveTo(2740, 2110, 2420, 2240, 2560, 2400);
        ctx.closePath();
        ctx.fillStyle = '#426c76';
        ctx.fill();
        ctx.strokeStyle = 'rgba(176,218,209,0.5)';
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.restore();

        for (let decor of world.decor) {
            if (decor.kind === 'tree') {
                ctx.fillStyle = 'rgba(20,30,22,0.28)';
                ctx.beginPath();
                ctx.ellipse(decor.x + 7, decor.y + 15, decor.size * 1.32, decor.size * 0.75, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#54432e';
                ctx.fillRect(decor.x - 3, decor.y + decor.size * 0.1, 6, decor.size * 1.12);
                ctx.fillStyle = decor.size > 18 ? '#334d35' : '#3d5d3b';
                ctx.beginPath();
                ctx.arc(decor.x, decor.y, decor.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(decor.x - decor.size * 0.54, decor.y + decor.size * 0.18, decor.size * 0.63, 0, Math.PI * 2);
                ctx.arc(decor.x + decor.size * 0.55, decor.y + decor.size * 0.13, decor.size * 0.66, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(151,174,105,0.23)';
                ctx.beginPath();
                ctx.arc(decor.x - decor.size * 0.27, decor.y - decor.size * 0.31, decor.size * 0.47, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#727366';
                ctx.beginPath();
                ctx.ellipse(decor.x, decor.y, decor.size * 1.1, decor.size * 0.65, -0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(213,207,179,0.2)';
                ctx.beginPath();
                ctx.ellipse(decor.x - 2, decor.y - 3, decor.size * 0.55, decor.size * 0.24, -0.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for (let i = 0; i < 3600; i++) {
            let gx = (i * 149 + (i % 7) * 37) % 3600;
            let gy = (i * 263 + (i % 11) * 19) % 2400;
            let wave = Math.sin(i * 12.31) * 2;
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(196,184,113,0.32)' : 'rgba(175,190,123,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + wave, gy - 4 - (i % 5));
            ctx.stroke();
        }

        for (let id of Object.keys(window.STORY_LOCATIONS)) {
            let loc = window.STORY_LOCATIONS[id];
            ctx.save();
            ctx.translate(loc.x, loc.y);
            ctx.globalAlpha = window.G.story && window.G.story.done && window.G.story.done.indexOf(id) >= 0 ? 0.82 : 1;
            if (loc.kind === 'village') {
                const house = (x, y, scale, roof) => {
                    ctx.fillStyle = 'rgba(22,28,21,0.3)';
                    ctx.fillRect(x - 22 * scale + 4, y + 12 * scale, 48 * scale, 10 * scale);
                    ctx.fillStyle = '#b99a6d';
                    ctx.fillRect(x - 22 * scale, y - 13 * scale, 44 * scale, 27 * scale);
                    ctx.fillStyle = '#764936';
                    ctx.beginPath();
                    ctx.moveTo(x - 27 * scale, y - 11 * scale);
                    ctx.lineTo(x, y - 34 * scale);
                    ctx.lineTo(x + 27 * scale, y - 11 * scale);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = roof;
                    ctx.fillRect(x - 5 * scale, y - 2 * scale, 10 * scale, 16 * scale);
                    ctx.fillStyle = '#e1c58e';
                    ctx.fillRect(x - 17 * scale, y - 5 * scale, 7 * scale, 7 * scale);
                };
                house(-45, 0, 0.9, '#4c6b50');
                house(35, -38, 0.75, '#87543e');
                house(73, 20, 0.65, '#586c4b');
                ctx.strokeStyle = '#c5aa75';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(-85, 48); ctx.quadraticCurveTo(-15, 28, 62, 56); ctx.stroke();
                ctx.fillStyle = '#d2b86e';
                ctx.beginPath(); ctx.arc(0, 48, 5, 0, Math.PI * 2); ctx.fill();
            } else if (loc.kind === 'tree') {
                ctx.fillStyle = 'rgba(32,31,22,0.28)';
                ctx.beginPath(); ctx.ellipse(0, 19, 54, 17, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#51402c';
                ctx.fillRect(-7, -29, 14, 57);
                ctx.fillRect(-29, -9, 9, 21);
                ctx.strokeStyle = '#796041'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-31, -39); ctx.moveTo(3, -19); ctx.lineTo(27, -45); ctx.stroke();
                for (let leaf of [[-25,-37,23],[-3,-49,30],[24,-37,25],[5,-25,28]]) {
                    ctx.fillStyle = leaf[2] > 27 ? '#405d3b' : '#4c6b43';
                    ctx.beginPath(); ctx.arc(leaf[0], leaf[1], leaf[2], 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'rgba(170,183,109,0.22)';
                    ctx.beginPath(); ctx.arc(leaf[0] - 7, leaf[1] - 7, leaf[2] * 0.4, 0, Math.PI * 2); ctx.fill();
                }
                ctx.fillStyle = '#806d57';
                ctx.beginPath(); ctx.ellipse(2, 31, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#c1aa7a';
                ctx.beginPath(); ctx.arc(2, 21, 4, 0, Math.PI * 2); ctx.fill();
            } else if (loc.kind === 'gate' || loc.kind === 'sect') {
                let scale = loc.kind === 'gate' ? 1.1 : 1.35;
                ctx.fillStyle = 'rgba(22,28,21,0.28)';
                ctx.beginPath(); ctx.ellipse(0, 24, 74 * scale, 22 * scale, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#887356';
                ctx.fillRect(-49 * scale, -17 * scale, 11 * scale, 55 * scale);
                ctx.fillRect(38 * scale, -17 * scale, 11 * scale, 55 * scale);
                ctx.fillStyle = '#9b4c39';
                ctx.fillRect(-57 * scale, -23 * scale, 114 * scale, 10 * scale);
                ctx.fillStyle = '#d0b77b';
                ctx.fillRect(-63 * scale, -31 * scale, 126 * scale, 8 * scale);
                ctx.fillStyle = '#614534';
                ctx.beginPath();
                ctx.moveTo(-68 * scale, -31 * scale); ctx.lineTo(0, -63 * scale); ctx.lineTo(68 * scale, -31 * scale);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#b8a77e';
                ctx.fillRect(-8 * scale, -5 * scale, 16 * scale, 43 * scale);
                ctx.fillStyle = '#e2cf9f'; ctx.font = 'bold 13px serif'; ctx.textAlign = 'center';
                ctx.fillText(loc.kind === 'gate' ? '青云' : '仙门', 0, -38 * scale);
                ctx.strokeStyle = '#918366'; ctx.lineWidth = 6;
                ctx.beginPath(); ctx.moveTo(-115, 51); ctx.lineTo(-53, 35); ctx.moveTo(55, 36); ctx.lineTo(116, 54); ctx.stroke();
            } else if (loc.kind === 'arena') {
                ctx.fillStyle = '#8e7957';
                ctx.beginPath(); ctx.ellipse(0, 9, 58, 35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#b29a6c';
                ctx.beginPath(); ctx.ellipse(0, 4, 45, 25, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#735d43'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.ellipse(0, 4, 33, 18, 0, 0, Math.PI * 2); ctx.stroke();
                for (let side of [-1, 1]) {
                    for (let row = 0; row < 3; row++) {
                        ctx.fillStyle = row % 2 ? '#899078' : '#a08a63';
                        ctx.fillRect(side * (49 + row * 14) - 8, -10 + row * 11, 16, 9);
                    }
                }
                ctx.fillStyle = '#c9a467';
                for (let flag of [-1, 1]) {
                    ctx.fillRect(flag * 74 - 2, -54, 4, 50);
                    ctx.beginPath(); ctx.moveTo(flag * 74, -53); ctx.lineTo(flag * 55, -42); ctx.lineTo(flag * 74, -33); ctx.fill();
                }
            } else if (loc.kind === 'portal') {
                ctx.fillStyle = '#605747';
                ctx.beginPath();
                ctx.moveTo(-55, 19); ctx.lineTo(-43, -22); ctx.lineTo(-25, -41);
                ctx.lineTo(-7, -23); ctx.lineTo(11, -52); ctx.lineTo(32, -29);
                ctx.lineTo(51, 19); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#85816b';
                ctx.beginPath(); ctx.moveTo(-43,-22); ctx.lineTo(-25,-41); ctx.lineTo(-7,-23); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(45,114,133,0.34)';
                ctx.beginPath(); ctx.ellipse(0, 6, 19, 34, 0, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#79ccd0'; ctx.shadowColor = '#5bd1df'; ctx.shadowBlur = 16 + pulse * 10;
                ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 6, 19, 34, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#829182'; ctx.fillRect(-62, 22, 124, 8);
            }

            // 非当前剧情点也标一个小卷轴，告诉玩家“这里以后有剧情”
            if (id !== storyId) {
                const done = window.G && window.G.story && window.G.story.done &&
                    window.G.story.done.indexOf(id) >= 0;
                ctx.globalAlpha = done ? 0.5 : 0.62;
                ctx.font = '16px "Microsoft YaHei", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = done ? '#9fbf8f' : '#e8d49a';
                ctx.fillText(done ? '✓' : '📜', 0, -82);
                if (p && Math.hypot(p.x - loc.x, p.y - loc.y) < 300) {
                    ctx.font = '11px "Microsoft YaHei", sans-serif';
                    ctx.fillText(done ? '已完成' : '剧情点', 0, -104);
                }
            }

            ctx.restore();
        }

        // 当前主线目标：金色光柱 + 感叹号，避免玩家在大地图上找不到剧情点
        if (storyLocation) {
            ctx.save();
            ctx.translate(storyLocation.x, storyLocation.y);
            const beacon = 0.55 + pulse * 0.45;
            const beam = ctx.createLinearGradient(0, -190, 0, 20);
            beam.addColorStop(0, 'rgba(255,215,100,0)');
            beam.addColorStop(0.62, 'rgba(255,215,100,' + (0.13 + beacon * 0.1) + ')');
            beam.addColorStop(1, 'rgba(255,215,100,0)');
            ctx.fillStyle = beam;
            ctx.fillRect(-13, -190, 26, 210);

            ctx.strokeStyle = 'rgba(255,215,100,' + (0.32 + beacon * 0.4) + ')';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 50, 68 + beacon * 10, 23 + beacon * 4, 0, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffd76a';
            ctx.strokeStyle = '#6d4512';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -116);
            ctx.lineTo(22, -92);
            ctx.lineTo(0, -68);
            ctx.lineTo(-22, -92);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#3d2817';
            ctx.font = 'bold 21px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, -91);

            ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(10,12,10,0.82)';
            ctx.fillStyle = '#ffe8a8';
            ctx.strokeText(storyLocation.name, 0, -134);
            ctx.fillText(storyLocation.name, 0, -134);
            ctx.restore();
        }

        for (let dungeon of window.DUNGEONS) {
            if (world.zone !== 'overworld' && world.zone !== dungeon.id) continue;
            let location = dungeon.position;
            ctx.save();
            ctx.translate(location.x, location.y);
            ctx.fillStyle = 'rgba(24,30,28,0.27)';
            ctx.beginPath(); ctx.ellipse(0, 24, 70, 20, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = world.zone === dungeon.id ? '#77766c' : '#625e52';
            ctx.beginPath();
            ctx.moveTo(-60, 20); ctx.lineTo(-47, -19); ctx.lineTo(-25, -43); ctx.lineTo(-8, -22);
            ctx.lineTo(12, -54); ctx.lineTo(36, -28); ctx.lineTo(58, 20); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(46,83,91,0.48)';
            ctx.beginPath(); ctx.ellipse(0, 2, 18, 30, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = dungeon.color;
            ctx.globalAlpha = world.zone === dungeon.id ? 0.88 : 0.44;
            ctx.shadowColor = dungeon.color;
            ctx.shadowBlur = world.zone === dungeon.id ? 16 + pulse * 8 : 8;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(0, 2, 18, 30, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            if (world.zone !== 'overworld' || Math.hypot(p.x - location.x, p.y - location.y) < 270) {
                ctx.fillStyle = '#d7cfb9';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(dungeon.name, 0, 51);
            }
            ctx.restore();
        }

        for (let creature of world.creatures) {
            let bob = Math.sin(creature.bob * 5) * 2;
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(creature.x, creature.y + 11, creature.r * 0.85, creature.r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = creature.tint;
            ctx.beginPath(); ctx.arc(creature.x, creature.y + bob, creature.r + 7, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            drawSprite(creature.img, creature.x, creature.y + bob, Math.min(48, creature.draw * 0.72), false);
            if (Math.hypot(p.x - creature.x, p.y - creature.y) < 175) {
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(14,17,15,0.8)';
                ctx.fillStyle = '#ead9b6';
                ctx.strokeText(creature.name, creature.x, creature.y - creature.r - 17);
                ctx.fillText(creature.name, creature.x, creature.y - creature.r - 17);
            }
        }

        for (let actor of world.actors) {
            let npc = actor.npc;
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.beginPath(); ctx.ellipse(actor.x, actor.y + 24, 23, 8, 0, 0, Math.PI * 2); ctx.fill();
            drawNpcSprite(npc.id, actor.x, actor.y + Math.sin(time * 3 + actor.phase) * 1.2, 72);
            if (Math.hypot(p.x - actor.x, p.y - actor.y) < 175) {
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(14,17,15,0.88)';
                ctx.fillStyle = '#efe3c7';
                ctx.strokeText(npc.name, actor.x, actor.y - 40);
                ctx.fillText(npc.name, actor.x, actor.y - 40);
            }
        }

        if (p) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.ellipse(p.x, p.y + 19, 27, 10, 0, 0, Math.PI * 2); ctx.fill();
            drawSprite('player', p.x, p.y, 76, false);
            ctx.fillStyle = '#8cf4ff';
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(p.facing) * 22, p.y + Math.sin(p.facing) * 22 - 13, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 剧情点在屏幕外时，在屏幕边缘显示方向箭头
        if (storyLocation && p) {
            const zoom = WORLD_ZOOM;
            const screenX = (storyLocation.x - camera.x) * zoom;
            const screenY = (storyLocation.y - camera.y) * zoom;
            const margin = 36;
            if (screenX < margin || screenX > W - margin || screenY < margin || screenY > H - margin) {
                const cx = MathUtils.clamp(screenX, margin, W - margin);
                const cy = MathUtils.clamp(screenY, margin, H - margin);
                const angle = Math.atan2(screenY - cy, screenX - cx);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle);
                ctx.fillStyle = 'rgba(255,215,100,0.92)';
                ctx.beginPath();
                ctx.moveTo(15, 0);
                ctx.lineTo(-10, 9);
                ctx.lineTo(-10, -9);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                ctx.fillStyle = '#ffe8a8';
                ctx.font = '11px "Microsoft YaHei", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('剧情 · ' + Math.round(Math.hypot(storyLocation.x - p.x, storyLocation.y - p.y)) + 'm', cx, cy + 24);
            }
        }

    }

    static _drawSprite(ctx, images, key, x, y, size, world) {
        const img = images[key];
        if (!img) {
            ctx.fillStyle = key === 'player' ? '#7df9ff' : '#888899';
            ctx.beginPath();
            ctx.arc(x, y, size / 2.4, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        if (key === 'player' && world.player) {
            this._drawCharacter(ctx, images, world.player, x, y, size);
            return;
        }
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    }

    static _drawCharacter(ctx, images, character, x, y, size) {
        const { direction, flipH } = this._characterDirection(character.facing || 0);
        const sprite = images['player_' + direction] || images.player_south || images.player;
        if (!sprite) return;
        const anim = character.anim || { fw: 64, fh: 64, cols: 8, frameTime: 0.1 };
        const moving = Math.abs(character.vx || 0) > 0.01 || Math.abs(character.vy || 0) > 0.01;
        const bob = moving ? Math.sin((character.walkT || 0) * 10) * 2 : 0;
        const frame = moving ? Math.floor(((character.walkT || 0) / anim.frameTime) % anim.cols) : 0;
        ctx.save();
        ctx.translate(x, y + bob);
        if (flipH) ctx.scale(-1, 1);
        ctx.drawImage(sprite, frame * anim.fw, 0, anim.fw, anim.fh,
            -size / 2, -size / 2 + bob, size, size);
        ctx.restore();
    }

    static _drawNpcSprite(ctx, images, npcId, x, y, height) {
        const sprites = images.npcSprites;
        const npcs = window.NPCS || [];
        const npc = npcs.find(item => item.id === npcId);
        const portraitIndex = {
            ningxiao: 0, linyue: 1, shenli: 2, guqinghan: 3,
            mochen: 4, jichang: 5, hanxing: 6
        };
        const portrait = (npc && npc.portrait) || npcId;
        let index = portraitIndex[portrait];
        if (index === undefined) index = npcs.findIndex(item => item.id === npcId);
        if (!sprites || index < 0) return false;
        const width = height * 0.8;
        ctx.drawImage(sprites, index * 128, 0, 128, 160,
            x - width / 2, y - height / 2, width, height);
        return true;
    }

    static _characterDirection(facing) {
        let ang = facing;
        while (ang <= -Math.PI) ang += 2 * Math.PI;
        while (ang > Math.PI) ang -= 2 * Math.PI;
        // 斜向不单独做图：上半区显示背面（上），下半区显示正面（下）
        if (ang >= -Math.PI / 8 && ang < Math.PI / 8) return { direction: 'east', flipH: false };
        if (ang >= Math.PI / 8 && ang < 7 * Math.PI / 8) return { direction: 'south', flipH: false };
        if (ang >= 7 * Math.PI / 8 || ang < -7 * Math.PI / 8) return { direction: 'west', flipH: false };
        return { direction: 'north', flipH: false };
    }
}

window.WorldRenderer = WorldRenderer;
