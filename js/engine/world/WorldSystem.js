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

        // 记录最近的可交互对象，供 tryInteract 使用
        this.state.nearbyNpc = nearbyNpc && nearbyNpc.distance < 100 ? nearbyNpc.actor.npc : null;
        this.state.nearbyCreature = !this.state.nearbyNpc && nearbyCreature && nearbyCreature.distance < 90 ? nearbyCreature.creature : null;

        const storyNode = window.G && window.G.story && window.G.story.node;
        const location = storyNode && this.storyLocations[storyNode];
        this.state.nearbyStory = location && Math.hypot(p.x - location.x, p.y - location.y) <= 92 && !this.state.nearbyNpc && !this.state.nearbyCreature ? window.getStoryNode(storyNode) : null;

        const interactBtn = document.getElementById('interactBtn');
        const dungeonBtn = document.getElementById('btnDungeon');

        if (dungeonBtn) {
            dungeonBtn.textContent = this.state.zone === 'overworld' ? '🏰 探索秘境' : '↩ 返回青云山';
        }

        if (interactBtn) {
            const hasInteraction = !!this.state.nearbyNpc || !!this.state.nearbyCreature || !!this.state.nearbyStory;
            interactBtn.classList.toggle('visible', hasInteraction);
            if (this.state.nearbyNpc) {
                interactBtn.innerHTML = '💬 与 ' + this.state.nearbyNpc.name + ' 交谈 <small>E</small>';
            } else if (this.state.nearbyCreature) {
                interactBtn.innerHTML = '⚔️ 接近 ' + this.state.nearbyCreature.name + ' <small>E</small>';
            } else if (this.state.nearbyStory) {
                interactBtn.innerHTML = '📜 触发剧情 <small>E</small>';
            } else {
                interactBtn.innerHTML = '📜 触发剧情 <small>E</small>';
            }
        }
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

        // 优先处理NPC交互
        if (this.state.nearbyNpc && window.onWorldNpcNearby) {
            window.onWorldNpcNearby(this.state.nearbyNpc);
            return true;
        }

        // 然后是怪物遭遇战
        if (this.state.nearbyCreature) {
            window.toast('⚔️ 遭遇' + this.state.nearbyCreature.name + '！', 'bad');
            const dungeonId = this.state.zone === 'overworld' ? 'qingyun' : this.state.zone;
            window.Engine.startRun(1, false, dungeonId, true);
            return true;
        }

        // 最后是剧情触发
        if (this.state.nearbyStory && window.onWorldStoryNearby) {
            window.onWorldStoryNearby(this.state.nearbyStory);
            return true;
        }

        return false;
    }
}

window.WorldSystem = WorldSystem;