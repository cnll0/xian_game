'use strict';

class WorldSystem {
    constructor(gameState, mapGenerator, eventBus) {
        this.gameState = gameState;
        this.runtime = gameState.runtime;
        this.state = gameState.runtime.world;
        this.constants = gameState.constants;
        this.mapGenerator = mapGenerator;
        this.eventBus = eventBus;
        this.storyLocations = window.STORY_LOCATIONS || {};
        this.npcs = window.NPCS || [];
        this.dungeons = window.DUNGEONS || [];
    }

    startWorld(resetPosition = false) {
        if (resetPosition) {
            this.state.player = null;
            this.state.zone = 'overworld';
        }
        this.state.interaction = null;
        this.state.nearbyStory = null;
        this.state.nearbyNpc = null;
        this.state.nearbyCreature = null;

        if (!this.state.player) {
            this.state.zone = window.G?.world?.zone || 'overworld';
            const start = this.storyLocations[window.G?.story?.node] || this.storyLocations.s0;
            const saved = window.G?.world || start;
            this.state.player = {
                x: MathUtils.clamp(Number(saved.x) || start.x, 32, 3568),
                y: MathUtils.clamp(Number(saved.y) || start.y, 32, 2368),
                facing: Math.PI / 4,
                walkT: 0,
                vx: 0,
                vy: 0,
                anim: { fw: 64, fh: 64, cols: 8, frameTime: 0.1 }
            };
            this._createWorldDecor();
        }

        this._updateCamera();
        this.state.storyPrompted = null;
        this.state.npcPrompted = null;
        this.runtime.dungeonId = this.state.zone;
        this.runtime.running = true;
        this.runtime.state = 'world';
        return true;
    }

    startDungeonWorld(dungeonId) {
        const dungeon = this.dungeons.find(d => d.id === dungeonId);
        if (!dungeon) throw new Error('Unknown dungeon: ' + dungeonId);
        if (window.G.realm < dungeon.realmMin) {
            window.toast('当前境界不足，无法进入' + dungeon.name, 'bad');
            return false;
        }

        this.state.zone = dungeon.id;
        this.state.dungeonId = dungeon.id;
        this.state.interaction = null;
        this.state.nearbyStory = null;
        this.state.nearbyNpc = null;
        this.state.nearbyCreature = null;
        this.state.player = {
            x: dungeon.position.x - 115,
            y: dungeon.position.y + 130,
            facing: -Math.PI / 2,
            walkT: 0,
            vx: 0,
            vy: 0,
            anim: { fw: 64, fh: 64, cols: 8, frameTime: 0.1 }
        };

        this._createWorldDecor();
        this._updateCamera();
        this.state.storyPrompted = null;
        this.state.npcPrompted = null;

        window.toast('🌫️ 踏入' + dungeon.name + '，留意附近游荡的妖兽', 'gold');
        window.saveGame(false);
        this.runtime.dungeonId = dungeon.id;
        this.runtime.running = true;
        this.runtime.state = 'world';
        return true;
    }

    returnToOverworld() {
        this.state.zone = 'overworld';
        this.state.dungeonId = 'qingyun';
        this.state.player = this.state.player || {
            x: 900, y: 1390, facing: 0, walkT: 0, vx: 0, vy: 0,
            anim: { fw: 64, fh: 64, cols: 8, frameTime: 0.1 }
        };
        this.state.player.x = 900;
        this.state.player.y = 1390;
        this._createWorldDecor();
        this._updateCamera();
        this.runtime.dungeonId = 'qingyun';
        this.runtime.running = true;
        this.runtime.state = 'world';
        window.saveGame(false);
    }

    _createWorldDecor() {
        this.state.decor = this.mapGenerator.generateWorldDecor();
        this.state.actors = this.mapGenerator.generateWorldActors(this.npcs, this.state.zone);
        const dungeon = this.dungeons.find(d => d.id === this.state.zone) || this.dungeons[0];
        this.state.creatures = this.mapGenerator.generateWorldCreatures(
            window.MONSTERS, dungeon, this.state.zone, dungeon.position || { x: 900, y: 1390 }
        );
    }

    _updateCamera() {
        if (!this.state.player) return;
        const { W, H, WORLD_ZOOM } = this.constants;
        const targetX = MathUtils.clamp(this.state.player.x - W / (2 * WORLD_ZOOM), 0, 3600 - W / WORLD_ZOOM);
        const targetY = MathUtils.clamp(this.state.player.y - H / (2 * WORLD_ZOOM), 0, 2400 - H / WORLD_ZOOM);
        this.state.camera.x = targetX;
        this.state.camera.y = targetY;
    }

    update(dt, input) {
        if (!this.state.player) return;
        this.state.time = (this.state.time || 0) + dt;
        this.state.player.vx = input.movement.x;
        this.state.player.vy = input.movement.y;

        if (input.movement.length > 0.05) {
            const speed = Math.max(1.5, window.G?.speed || 3.2) * 60;
            this.state.player.x = MathUtils.clamp(
                this.state.player.x + input.movement.x * speed * dt, 32, 3568
            );
            this.state.player.y = MathUtils.clamp(
                this.state.player.y + input.movement.y * speed * dt, 32, 2368
            );
            this.state.player.facing = Math.atan2(input.movement.y, input.movement.x);
            this.state.player.walkT += dt;
        }

        const { W, H, WORLD_ZOOM } = this.constants;
        const targetX = MathUtils.clamp(this.state.player.x - W / (2 * WORLD_ZOOM), 0, 3600 - W / WORLD_ZOOM);
        const targetY = MathUtils.clamp(this.state.player.y - H / (2 * WORLD_ZOOM), 0, 2400 - H / WORLD_ZOOM);
        const cameraEase = 1 - Math.exp(-dt * 8);
        this.state.camera.x += (targetX - this.state.camera.x) * cameraEase;
        this.state.camera.y += (targetY - this.state.camera.y) * cameraEase;

        window.G.world = {
            x: Math.round(this.state.player.x),
            y: Math.round(this.state.player.y),
            zone: this.state.zone
        };

        this._updateActors(dt);
        this._updateCreatures(dt);
        this._checkInteractions();
        this._autoSave(dt);
    }

    _updateActors(dt) {
        for (const actor of this.state.actors) {
            const prevX = actor.x, prevY = actor.y;
            actor.x = actor.npc.x + Math.cos(this.state.time * 0.38 + actor.phase) * actor.roam;
            actor.y = actor.npc.y + Math.sin(this.state.time * 0.31 + actor.phase) * actor.roam * 0.45;
            actor.vx = dt > 0 ? (actor.x - prevX) / dt : 0;
            actor.vy = dt > 0 ? (actor.y - prevY) / dt : 0;
            if (Math.hypot(actor.vx, actor.vy) > 0.1) {
                actor.facing = Math.atan2(actor.vy, actor.vx);
                actor.walkT += dt;
            }
        }
    }

    _updateCreatures(dt) {
        const p = this.state.player;
        for (const creature of this.state.creatures) {
            const dx = p.x - creature.x, dy = p.y - creature.y;
            const dist = Math.hypot(dx, dy) || 1;
            const driftX = Math.cos(this.state.time * 0.55 + creature.phase) * 22;
            const driftY = Math.sin(this.state.time * 0.48 + creature.phase) * 18;
            const chase = dist < 250 ? 12 : 0;
            creature.x = MathUtils.clamp(creature.homeX + driftX + (dist < 250 ? dx / dist * chase * dt : 0), 60, 3540);
            creature.y = MathUtils.clamp(creature.homeY + driftY + (dist < 250 ? dy / dist * chase * dt : 0), 60, 2340);
            creature.bob += dt;
        }
    }

    _checkInteractions() {
        const p = this.state.player;
        const nearbyNpc = this.state.actors
            .map(a => ({ actor: a, distance: Math.hypot(p.x - a.x, p.y - a.y) }))
            .sort((a, b) => a.distance - b.distance)[0];

        const nearbyCreature = this.state.creatures
            .map(c => ({ creature: c, distance: Math.hypot(p.x - c.x, p.y - c.y) }))
            .sort((a, b) => a.distance - b.distance)[0];

        // 当前主线目标：追踪始终显示；交互时和 NPC/妖兽一起按距离竞争
        const storyNodeId = window.G && window.G.story && window.G.story.node;
        const location = storyNodeId && this.storyLocations[storyNodeId];
        const storyDistance = location ? Math.hypot(p.x - location.x, p.y - location.y) : Infinity;
        const storyNode = location && typeof window.getStoryNode === 'function'
            ? window.getStoryNode(storyNodeId)
            : null;

        this.state.storyLocation = location || null;
        this.state.storyDistance = storyDistance;

        // 玩家附近是否有“非当前节点”的剧情地点（例如还没触发 s0 就跑到了老槐树）
        let nearestLocation = null;
        let nearestLocationDistance = Infinity;
        for (const id in this.storyLocations) {
            const candidate = this.storyLocations[id];
            const distance = Math.hypot(p.x - candidate.x, p.y - candidate.y);
            if (distance < nearestLocationDistance) {
                nearestLocationDistance = distance;
                nearestLocation = { id, ...candidate, distance };
            }
        }
        this.state.storyMismatch = nearestLocation && nearestLocationDistance <= 140 &&
            nearestLocation.id !== storyNodeId ? nearestLocation : null;

        const candidates = [];
        if (storyNode && storyDistance <= 140) {
            candidates.push({ type: 'story', distance: storyDistance, node: storyNode });
        }
        if (nearbyNpc && nearbyNpc.distance <= 100) {
            candidates.push({ type: 'npc', distance: nearbyNpc.distance, npc: nearbyNpc.actor.npc });
        }
        if (nearbyCreature && nearbyCreature.distance <= 90) {
            candidates.push({ type: 'creature', distance: nearbyCreature.distance, creature: nearbyCreature.creature });
        }
        candidates.sort((a, b) => a.distance - b.distance);

        // 范围内只保留最近的一个交互目标：谁近就按 E 触发谁
        const primary = candidates[0] || null;
        this.state.interaction = primary;
        this.state.nearbyStory = primary && primary.type === 'story' ? primary.node : null;
        this.state.nearbyNpc = primary && primary.type === 'npc' ? primary.npc : null;
        this.state.nearbyCreature = primary && primary.type === 'creature' ? primary.creature : null;

        const interactBtn = document.getElementById('interactBtn');
        const dungeonBtn = document.getElementById('btnDungeon');

        if (dungeonBtn) {
            dungeonBtn.textContent = this.state.zone === 'overworld' ? '🏰 探索秘境' : '↩ 返回青云山';
        }

        if (interactBtn) {
            interactBtn.classList.toggle('visible', !!primary || !!this.state.storyMismatch);
            if (primary && primary.type === 'story') {
                interactBtn.innerHTML = '📜 触发剧情 <small>E</small>';
            } else if (primary && primary.type === 'npc') {
                interactBtn.innerHTML = '💬 与 ' + (primary.npc.name || '神秘人') + ' 交谈 <small>E</small>';
            } else if (primary && primary.type === 'creature') {
                interactBtn.innerHTML = '⚔️ 接近 ' + (primary.creature.name || '妖兽') + ' <small>E</small>';
            } else if (this.state.storyMismatch) {
                interactBtn.innerHTML = '📜 此处暂无剧情 <small>E</small>';
            } else {
                interactBtn.innerHTML = '📜 触发剧情 <small>E</small>';
            }
        }

        this._updateQuestTracker(storyNode, location, storyDistance);
        this._updateWorldHint(primary, storyNode, storyDistance);
    }

    _updateWorldHint(primary, storyNode, storyDistance) {
        const hint = document.getElementById('worldHint');
        if (!hint) return;
        let text;
        if (primary && primary.type === 'story') {
            text = '📜 按 E 触发剧情：' + (primary.node.title || '当前剧情');
        } else if (primary && primary.type === 'npc') {
            text = '💬 按 E 与 ' + (primary.npc.name || '神秘人') + ' 交谈';
        } else if (primary && primary.type === 'creature') {
            text = '⚔️ 按 E 接近 ' + (primary.creature.name || '妖兽');
        } else if (this.state.storyMismatch) {
            const currentId = window.G && window.G.story && window.G.story.node;
            const current = currentId && this.storyLocations[currentId];
            text = '📜 此处暂无剧情，当前目标在「' + (current ? current.name : '下一处') + '」';
        } else if (storyNode && storyDistance <= 320) {
            text = '🎯 跟随金色箭头前往：' + storyNode.title;
        } else {
            text = 'WASD / 方向键 / 摇杆移动 · 靠近剧情点、人物或妖兽按 E 交互';
        }
        if (hint.textContent !== text) hint.textContent = text;
    }

    _updateQuestTracker(storyNode, location, distance) {
        const tracker = document.getElementById('questTracker');
        if (!tracker) return;
        if (!location || !storyNode || this.runtime.state !== 'world') {
            tracker.classList.remove('visible', 'near');
            this._questTrackerKey = '';
            return;
        }
        const p = this.state.player;
        const dx = location.x - p.x;
        const dy = location.y - p.y;
        const direction = this._directionLabel(dx, dy);
        const near = distance <= 140;
        const key = storyNode.id + '|' + Math.round(distance / 10) + '|' + direction + '|' + near;
        if (key === this._questTrackerKey) return;
        this._questTrackerKey = key;

        const title = document.getElementById('questTitle');
        const locationEl = document.getElementById('questLocation');
        const distanceEl = document.getElementById('questDistance');
        const arrow = document.getElementById('questArrow');
        if (title) title.textContent = storyNode.title || location.name;
        if (locationEl) locationEl.textContent = location.name + ' · ' + direction;
        if (distanceEl) distanceEl.textContent = near ? '就在附近' : Math.round(distance) + ' 米';
        if (arrow) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
            arrow.style.transform = 'rotate(' + angle.toFixed(1) + 'deg)';
        }
        tracker.classList.toggle('near', near);
        tracker.classList.add('visible');
    }

    _directionLabel(dx, dy) {
        const dirs = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
        const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
        return dirs[Math.round(angle / (Math.PI / 4)) % 8];
    }

    hideQuestTracker() {
        const tracker = document.getElementById('questTracker');
        if (tracker) tracker.classList.remove('visible', 'near');
        this._questTrackerKey = '';
    }

    getStoryTarget() {
        const id = window.G && window.G.story && window.G.story.node;
        const location = id && this.storyLocations[id];
        const p = this.state.player;
        if (!location || !p) return null;
        const dx = location.x - p.x;
        const dy = location.y - p.y;
        const node = typeof window.getStoryNode === 'function' ? window.getStoryNode(id) : null;
        return {
            id,
            title: node ? node.title : location.name,
            name: location.name,
            x: location.x,
            y: location.y,
            distance: Math.hypot(dx, dy),
            direction: this._directionLabel(dx, dy)
        };
    }

    _autoSave(dt) {
        this.state.saveTimer += dt;
        if (this.state.saveTimer >= 5) {
            this.state.saveTimer = 0;
            window.saveGame(false);
        }
    }

    tryInteract() {
        const p = this.state.player;
        if (!p) return false;

        // 剧情优先：主线节点不应该被旁边的 NPC 或游荡妖兽挡住
        if (this.state.nearbyStory && window.onWorldStoryNearby) {
            window.onWorldStoryNearby(this.state.nearbyStory);
            return true;
        }

        // 然后是 NPC 交互
        if (this.state.nearbyNpc && window.onWorldNpcNearby) {
            window.onWorldNpcNearby(this.state.nearbyNpc);
            return true;
        }

        // 最后是妖兽遭遇战
        if (this.state.nearbyCreature) {
            window.toast('⚔️ 遭遇' + this.state.nearbyCreature.name + '！', 'bad');
            const dungeonId = this.state.zone === 'overworld' ? 'qingyun' : this.state.zone;
            window.Engine.startRun(1, false, dungeonId, true);
            return true;
        }

        // 站在非当前节点的剧情地点：按 E 给出明确指引，而不是毫无反应
        if (this.state.storyMismatch) {
            const currentId = window.G && window.G.story && window.G.story.node;
            const current = currentId && this.storyLocations[currentId];
            window.toast('此处是「' + this.state.storyMismatch.name + '」，当前剧情在「' +
                (current ? current.name : '下一处') + '」· 跟着金色箭头走', 'gold');
            return true;
        }

        return false;
    }
}

window.WorldSystem = WorldSystem;