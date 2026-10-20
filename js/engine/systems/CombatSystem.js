'use strict';

/**
 * 战斗系统 - 核心游戏逻辑
 * 支持同步/异步地图生成
 */
class CombatSystem {
    /**
     * @param {Object} gameState - GameState实例
     * @param {Object} mapGenerator - MapGenerator实例(同步版)
     * @param {Object} eventBus - EventBus实例
     * @param {Object} pools - 对象池
     * @param {Object} mapGeneratorWorker - MapGeneratorWorker实例(异步版，可选)
     */
    constructor(gameState, mapGenerator, eventBus, pools, mapGeneratorWorker = null) {
        this.state = gameState.runtime;
        this.constants = gameState.constants;
        this.mapGenerator = mapGenerator;
        this.mapGeneratorWorker = mapGeneratorWorker;
        this.useWorker = !!mapGeneratorWorker;
        this.eventBus = eventBus;
        this.pools = pools;
        this._spawnFloorPromise = null;
    }

    startRun(startFloor, storyDungeon, dungeonId, skirmish) {
        if (!window.G.created) return;

        this.state.storyDungeon = storyDungeon === true;
        this.state.skirmish = skirmish === true;
        window.G.flags.runs = (window.G.flags.runs || 0) + 1;

        this.state.dungeon = window.DUNGEONS.find(d => d.id === dungeonId) || window.DUNGEONS[0];
        this.state.dungeonId = this.state.dungeon.id;
        this.state.dungeonMods = Object.assign({
            playerSpeed: 1, monsterSpeed: 1, damageTaken: 1, regen: 0, visibility: 1, slip: 0
        }, this.state.dungeon.mods || {});
        this.state.bossElement = this.state.dungeon.bossElement || '#ff6b6b';
        this.state.ambient = this.state.dungeon.ambient || 'leaves';
        this.state.floorCount = this.state.dungeon.floorCount;
        this.state.floor = Math.max(1, Number(startFloor) || 1);
        this.state.time = 0;
        this.state.mapSeed = Math.floor(Math.random() * 2147483646) + 1;
        this.state.noDeathRun = true;

        this.state.bullets = [];
        this.state.traps = [];
        this.state.effects = [];
        this.state.texts = [];

        this.state.cards = { player: {}, monster: {}, run: {} };
        this.state.monsterMods = {
            hpMul: 1, atkMul: 1, spdMul: 1,
            cntAdd: 0, forceElite: false,
            shield: 0, regen: 0, thorns: 0,
            split: 0, explode: false,
            teleport: 0, summonCd: 0
        };

        window.G.combo = 0;
        window.G.pierce = 0;
        window.G.dodge = 0;
        window.G.shield = 0;
        window.G.split = 0;
        window.G.explode = 0;

        const { W, H } = this.constants;
        this.state.player = {
            x: W / 2, y: H / 2,
            r: 16,
            hp: this.state.skirmish ? Math.min(window.G.hp, window.G.maxHp) : window.G.maxHp,
            maxHp: window.G.maxHp,
            facing: -Math.PI / 2,
            atkCd: 0,
            swinging: 0,
            invuln: 0,
            hitSet: null,
            walkT: 0,
            vx: 0, vy: 0,
            dashCd: 0, dashTime: 0, dashVx: 0, dashVy: 0,
            shield: 0, shieldMax: 0, shieldCooldown: 0,
            anim: {
                fw: 64, fh: 64, cols: 8, frameTime: 0.1,
                dirMap: {
                    up: 'player_north',
                    down: 'player_south',
                    left: 'player_west',
                    upleft: 'player_northwest',
                    downleft: 'player_southwest'
                }
            },
            mods: {
                atk: 0, maxHp: 0, speed: 0, range: 0, crit: 0, lifesteal: 0,
                doubleHit: false, pierce: false, knockback: 0, stunChance: 0, stunDur: 0,
                elemFire: false, elemDmg: 0, elemIce: false, freezeChance: 0, freezeDur: 0,
                chain: 0, chainDmg: 0, dashStrike: false, dashCd: 0,
                shield: 0, shieldCd: 0, dodge: 0,
                regen: this.state.dungeon.mods && this.state.dungeon.mods.regen ? this.state.dungeon.mods.regen : 0,
                thorns: 0,
                combo: 0, split: 0, explode: 0, burnTime: 0,
                evoBlade: false, evoFlame: false, evoFrost: false, evoStorm: false,
                evoAegis: false, evoPhantom: false, evoSoul: false, evoRuin: false, evoBloom: false
            }
        };

        this.state.running = true;
        this.state.state = 'playing';
        // 异步生成首层
        this._spawnFloorAsync(this.state.floor);
        window.updateHUD();
    }

    /**
     * 异步生成楼层 (Worker版本)
     * @param {number} floor
     * @returns {Promise<void>}
     */
    _floorTheme(floor) {
        const dungeon = this.state.dungeon || {};
        const themes = dungeon.floorThemes || [];
        return themes[floor - 1] || themes[0] || dungeon.theme || null;
    }

    _trapType(floor) {
        const dungeon = this.state.dungeon || {};
        const sequence = dungeon.trapSequence || [];
        return sequence[floor - 1] || sequence[0] || null;
    }

    _arenaStyle() {
        return (this.state.dungeon && this.state.dungeon.arenaStyle) || 'ring';
    }

    async _spawnFloorAsync(floor) {
        this.state.state = 'loading'; // 显示加载状态
        window.updateHUD();

        const { W, H, PAD } = this.constants;
        const options = {
            theme: this._floorTheme(floor),
            trapType: this._trapType(floor),
            arenaStyle: this._arenaStyle()
        };

        try {
            if (this.useWorker && this.mapGeneratorWorker) {
                // 确保Worker已初始化
                await this.mapGeneratorWorker.init();
                const { scenery, landmarks, traps, arena } =
                    await this.mapGeneratorWorker.generateFullFloor(floor, this.state.mapSeed, this.state.time, options);

                this.state.scenery = scenery;
                this.state.landmarks = landmarks;
                this.state.traps = traps;
                this.state.arena = arena;
            } else {
                // 回退到同步版本
                this._spawnFloorSync(floor);
            }
        } catch (err) {
            console.error('Worker生成失败，回退同步:', err);
            this._spawnFloorSync(floor);
        }

        this._finishSpawnFloor();
    }

    /**
     * 同步生成楼层 (主线程版本)
     * @param {number} floor
     */
    _spawnFloorSync(floor) {
        const { W, H, PAD } = this.constants;
        const theme = this._floorTheme(floor);
        const trapType = this._trapType(floor);
        const arenaStyle = this._arenaStyle();

        this.state.scenery = this.mapGenerator.generateFloorScenery(floor, this.state.mapSeed, W, H, PAD, theme);
        this.state.landmarks = this.mapGenerator.generateFloorLandmarks(floor, this.state.mapSeed, W, H, PAD, theme);
        this.state.traps = this.mapGenerator.generateFloorTraps(floor, this.state.mapSeed, this.state.time, W, H, PAD, trapType);
        this.state.arena = this.mapGenerator.generateArenaLayout(floor, this.state.mapSeed, W, H, arenaStyle);
    }

    /**
     * 生成楼层完成后的通用逻辑
     */
    _finishSpawnFloor() {
        const floor = this.state.floor;
        const { W, H, PAD } = this.constants;
        const dungeon = this.state.dungeon || window.DUNGEONS[0];
        this.state.floorTheme = this._floorTheme(floor);
        this.state.ambient = dungeon.ambient || 'leaves';
        const pool = dungeon.floorPool[Math.min(floor, dungeon.floorPool.length) - 1] || ['wolf'];
        const isBossFloor = pool.some(id => window.MONSTERS[id] && window.MONSTERS[id].boss);

        this.state.floorNpc = null;
        if (!this.state.skirmish && !isBossFloor) {
            const event = (window.DUNGEON_NPC_EVENTS[dungeon.id] || []).find(item => item.floor === floor);
            const npc = event && window.NPCS.find(item => item.id === event.npcId);
            if (event && npc) {
                const { W, H } = this.constants;
                this.state.floorNpc = {
                    x: W / 2 + (Math.random() < 0.5 ? -1 : 1) * 170,
                    y: H * 0.39,
                    phase: Math.random() * Math.PI * 2,
                    used: false,
                    npc: Object.assign({}, npc, {
                        dungeonEncounter: true,
                        title: event.title,
                        greeting: event.line,
                        choices: event.choices
                    })
                };
            }
        }

        const baseCount = isBossFloor ? 1 :
            3 + Math.floor(this.state.floor * 0.7) + Math.min(4, this.state.monsterMods.cntAdd);

        for (let i = 0; i < baseCount; i++) {
            let tid = pool[Math.floor(Math.random() * pool.length)];
            if (this.state.monsterMods.forceElite && i === 0 && this.state.floor < this.state.floorCount) tid = 'elite';

            const base = window.MONSTERS[tid];
            const hpMul = dungeon.hpScale * (1 + (this.state.floor - 1) * 0.28) * this.state.monsterMods.hpMul;
            const atkMul = dungeon.atkScale * (1 + (this.state.floor - 1) * 0.15) * this.state.monsterMods.atkMul;
            const spdMul = this.state.monsterMods.spdMul;

            const m = {
                id: base.id, name: base.name, img: base.img, boss: !!base.boss,
                hp: Math.round(base.hp * hpMul),
                maxHp: Math.round(base.hp * hpMul),
                atk: Math.round(base.atk * atkMul),
                speed: Math.round(base.speed * spdMul * 100) / 100,
                r: base.r,
                facing: 0,
                atkCd: 0,
                stunCd: 0,
                controlEffect: null,
                type: base.id,
                draw: base.draw,
                tint: base.tint || '#a9aa83',
                elite: !!base.elite,
                ranged: !!base.ranged,
                keepDistance: !!base.keepDistance,
                shootRange: base.shootRange || 0,
                shootInterval: (base.shootCd || 2.4) * (0.8 + Math.random() * 0.4),
                shootCd: (base.shootCd || 2.4) * (0.8 + Math.random() * 0.4),
                healer: !!base.healer,
                splitOnDeath: !!base.splitOnDeath || (this.state.monsterMods.split || 0) > 0,
                projectileColor: base.projectileColor || '#ffb86b',
                shield: this.state.monsterMods.shield || 0,
                regen: this.state.monsterMods.regen || 0,
                thorns: this.state.monsterMods.thorns || 0,
                explode: !!this.state.monsterMods.explode,
                teleport: this.state.monsterMods.teleport || 0,
                teleportCd: this.state.monsterMods.teleport || 0,
                summonCd: this.state.monsterMods.summonCd || 0,
                summonTimer: this.state.monsterMods.summonCd || 0,
                bossCd: base.boss ? 2 : 0,
                x: 0, y: 0
            };

            const pos = this._arenaSpawnPosition(i, isBossFloor, m.r);
            m.x = pos.x; m.y = pos.y;
            this.state.monsters.push(m);
        }

        const chestCount = this.state.floor < this.state.floorCount ? (Math.random() < 0.7 ? 1 : 2) : 0;
        for (let i = 0; i < chestCount; i++) {
            this.state.chests.push(Object.assign(this._randomArenaPosition(PAD + 35, H - PAD - 35, 20), { opened: false }));
        }

        if (window.G.flags.maxFloor < this.state.floor) {
            window.G.flags.maxFloor = this.state.floor;
            window.checkAchievements();
        }

        window.toast('🏰 ' + dungeon.name + ' · 第' + this.state.floor + '/' + this.state.floorCount + '层 · ' + (window.FLOOR_NAMES[this.state.floor - 1] || '深处'), 'gold');
        window.updateHUD();

        if (this.state.floor > 1) window.showDualCardChoice();

        this.state.state = 'playing';
    }

    // 保留旧方法名兼容
    spawnFloor(floor) {
        if (this.useWorker && this.mapGeneratorWorker) {
            this._spawnFloorAsync(floor);
        } else {
            this._spawnFloorSync(floor);
            this._finishSpawnFloor();
        }
    }

    _arenaSpawnPosition(index, isBoss, radius) {
        const { W, H, PAD } = this.constants;
        if (isBoss) return { x: W / 2, y: H * 0.32 };
        const arena = this.state.arena || [];
        if (!arena.length) return this._randomArenaPosition(PAD + 60, H - PAD - 60, radius);
        const point = arena[index % arena.length];
        return {
            x: MathUtils.clamp(point.x + (Math.random() - 0.5) * 70, PAD + radius + 20, W - PAD - radius - 20),
            y: MathUtils.clamp(point.y + (Math.random() - 0.5) * 70, PAD + radius + 30, H - PAD - radius - 30)
        };
    }

    _applyMonsterModifier(key, value) {
        if (typeof value === 'boolean') this.state.monsterMods[key] = value;
        else if (key === 'hpMul' || key === 'atkMul' || key === 'spdMul') this.state.monsterMods[key] *= value;
        else this.state.monsterMods[key] = Math.max(0, (this.state.monsterMods[key] || 0) + value);
    }

    _randomArenaPosition(minX, maxY, padding) {
        const { W, H } = this.constants;
        return {
            x: minX + Math.random() * (W - 2 * minX),
            y: minX + Math.random() * (maxY - minX)
        };
    }

    async nextFloor() {
        if (this.state.floor >= this.state.floorCount) {
            this.finishRun(true);
            return;
        }
        this.state.floor++;
        this.state.state = 'loading';
        window.updateHUD();

        try {
            if (this.useWorker && this.mapGeneratorWorker) {
                const { scenery, landmarks, traps, arena } =
                    await this.mapGeneratorWorker.generateFullFloor(this.state.floor, this.state.mapSeed, this.state.time, {
                        theme: this._floorTheme(this.state.floor),
                        trapType: this._trapType(this.state.floor),
                        arenaStyle: this._arenaStyle()
                    });

                this.state.scenery = scenery;
                this.state.landmarks = landmarks;
                this.state.traps = traps;
                this.state.arena = arena;
            } else {
                this._spawnFloorSync(this.state.floor);
            }
        } catch (err) {
            console.error('Worker生成下一层失败，回退同步:', err);
            this._spawnFloorSync(this.state.floor);
        }

        this._finishSpawnFloor();
        window.saveGame(false);
    }

    finishRun(cleared) {
        this.state.running = false;
        this.state.state = 'idle';

        if (cleared) {
            if (this.state.skirmish) {
                const reward = 15 + this.state.floor * 3;
                window.gainCultivation(reward);
                window.G.hp = this.state.player ? Math.max(1, this.state.player.hp) : window.G.hp;
                window.toast('⚔️ 击退妖兽，修为+' + reward, 'good');
                window.saveGame(false);
            } else {
                window.G.flags.clears = (window.G.flags.clears || 0) + 1;
                if (this.state.noDeathRun) window.G.flags.noDeathClear = (window.G.flags.noDeathClear || 0) + 1;
                window.gainCultivation(150 + this.state.floor * 15);
                window.toast('👑 秘境通关！奖励修为+' + (150 + this.state.floor * 15), 'gold');
                window.G.hp = this.state.player ? this.state.player.hp : window.G.maxHp;
                window.checkAchievements();
                if (typeof window.learnDungeonTechnique === 'function') {
                    window.learnDungeonTechnique(this.state.dungeonId);
                }
                window.saveGame(true);
                if (typeof window.onDungeonClear === 'function') {
                    window.onDungeonClear();
                }
            }
        }
    }

    stopRun() {
        this.state.running = false;
        this.state.state = 'idle';
        this.state.floorNpc = null;
        this.state.pendingFloorClear = null;
    }

    update(dt) {
        if (!this.state.running || this.state.state !== 'playing') return;

        this.state.time += dt;
        const p = this.state.player;

        p.atkCd = Math.max(0, p.atkCd - dt);
        p.swinging = Math.max(0, p.swinging - dt);
        p.invuln = Math.max(0, p.invuln - dt);
        p.slowTime = Math.max(0, (p.slowTime || 0) - dt);
        p.stunTime = Math.max(0, (p.stunTime || 0) - dt);
        p.attackSlowTime = Math.max(0, (p.attackSlowTime || 0) - dt);
        p.slideTime = Math.max(0, (p.slideTime || 0) - dt);
        p.burnTime = Math.max(0, (p.burnTime || 0) - dt);
        if (p.burnTime <= 0) p.hazardBurnDamage = 0;

        p.poisonTime = Math.max(0, (p.poisonTime || 0) - dt);
        if (p.poisonTime > 0) {
            p.poisonTick = Math.max(0, (p.poisonTick || 0) - dt);
            if (p.poisonTick <= 0) {
                p.poisonTick = 0.95;
                const dmg = Math.max(1, Math.ceil(p.maxHp * 0.018));
                this.hurtPlayer(dmg);
                window.floatText(p.x, p.y - 24, '瘴毒 -' + dmg, '#a8dc75');
                this.state.effects.push({ type: 'element', element: 'poison', x: p.x, y: p.y, t: 0, life: 0.35 });
            }
        }

        if (p.mods.regen > 0 && p.hp < p.maxHp) {
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * p.mods.regen * dt);
        }
        if (p.shieldCooldown > 0) {
            p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
            if (p.shieldCooldown === 0 && p.shieldMax > 0) {
                p.shield = p.shieldMax;
                this.state.effects.push({ type: 'element', element: 'shield', x: p.x, y: p.y, t: 0, life: 0.55 });
            }
        }

        this._updatePlayerMovement(dt);
        this._updatePlayerAttack(dt);
        this._updateMonsters(dt);
        this._updateBullets(dt);
        this._updateTraps(dt);
        this._updateEffects(dt);
        this._updateChests(dt);
        this._updateFloorNpc();
        this._checkWinCondition();
    }

    _updatePlayerMovement(dt) {
        const p = this.state.player;
        const input = window.gameInput || { movement: { x: 0, y: 0, length: 0 } };
        const mv = input.movement;

        const slowed = (p.slowTime || 0) > 0 || (p.slideTime || 0) > 0;
        const dungeonSpeed = (this.state.dungeonMods && this.state.dungeonMods.playerSpeed) || 1;
        let speed = (slowed ? 0.45 : 1) * dungeonSpeed *
            Math.max(0.8, p.mods.speed ? window.G.speed + p.mods.speed : window.G.speed) * 60;

        if (p.slideTime > 0) {
            p.x = MathUtils.clamp(p.x + p.iceDriftX * speed * dt, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
            p.y = MathUtils.clamp(p.y + p.iceDriftY * speed * dt, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
        } else if (mv.length > 0.05) {
            p.x = MathUtils.clamp(p.x + mv.x * speed * dt, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
            p.y = MathUtils.clamp(p.y + mv.y * speed * dt, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
            p.facing = Math.atan2(mv.y, mv.x);
            p.walkT += dt;
        }

        if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
        if (p.dashTime > 0) {
            p.dashTime -= dt;
            p.x = MathUtils.clamp(p.x + p.dashVx * dt, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
            p.y = MathUtils.clamp(p.y + p.dashVy * dt, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
            this.state.effects.push({ type: 'afterimage', x: p.x, y: p.y, t: 0, life: 0.25 });
        }
        if (p.mods.dashStrike && p.dashCd <= 0 && p.dashTime <= 0) {
            const mouse = window.gameInput && window.gameInput.mouse;
            const dx = (mouse ? mouse.x : p.x + 1) - p.x;
            const dy = (mouse ? mouse.y : p.y) - p.y;
            const dist = Math.hypot(dx, dy) || 1;
            p.dashVx = (dx / dist) * 500;
            p.dashVy = (dy / dist) * 500;
            p.dashTime = 0.15;
            p.dashCd = Math.max(1.5, p.mods.dashCd || 3);
            p.dashHitSet = new Set();
            this.state.effects.push({ type: 'dash', x: p.x, y: p.y, x2: p.x + p.dashVx * 0.15, y2: p.y + p.dashVy * 0.15, t: 0, life: 0.3 });
        }
        if (p.mods.dashStrike && p.dashTime > 0) {
            for (const m of this.state.monsters) {
                if (m.hp <= 0 || p.dashHitSet.has(m)) continue;
                if (Math.hypot(m.x - p.x, m.y - p.y) < (p.mods.dashRange || 60) + m.r) {
                    p.dashHitSet.add(m);
                    const dmg = Math.round((window.G.atk + (p.mods.atk || 0)) * 0.5);
                    this.damageMonster(m, { dmg });
                    window.floatText(m.x, m.y - m.r, '⚔️ ' + dmg, '#ffcc00');
                }
            }
        }
    }

    _updatePlayerAttack(dt) {
        const p = this.state.player;
        if (p.attackSlowTime > 0) return;

        if (p.atkCd <= 0 && (window.gameInput?.consumeAttack?.() || window.gameInput?.attackPressed)) {
            this.tryAttack();
        }
    }

    tryAttack(isAuto = false) {
        if (window.audioManager) window.audioManager.attack();
        const p = this.state.player;
        const atkSpeed = p.attackSlowTime > 0 ? 0.5 : 1;
        p.atkCd = (0.6 / atkSpeed) * (p.mods.dashStrike ? 0.8 : 1);
        p.swinging = 0.18;
        p.facing = Math.atan2(window.gameInput.mouse.y - p.y, window.gameInput.mouse.x - p.x);

        const range = (window.G.range + (p.mods.range || 0)) * (p.mods.dashStrike ? 1.5 : 1);
        const dmg = window.G.atk + (p.mods.atk || 0);
        const isCrit = Math.random() * 100 < (window.G.crit + (p.mods.crit || 0));
        const finalDmg = isCrit ? Math.round(dmg * 1.8) : dmg;

        this._spawnSlash(p.x, p.y, p.facing, range, finalDmg, isCrit, p.mods);

        if (p.mods.doubleHit) {
            setTimeout(() => this._spawnSlash(p.x, p.y, p.facing, range, Math.round(finalDmg * 0.7), isCrit, p.mods), 80);
        }
    }

    _spawnSlash(x, y, angle, range, dmg, isCrit, mods) {
        const slash = {
            x, y, angle, range, dmg, isCrit,
            pierce: !!mods.pierce,
            chain: mods.chain || 0,
            chainDmg: mods.chainDmg || 0,
            elemFire: !!mods.elemFire,
            elemIce: !!mods.elemIce,
            freezeChance: mods.freezeChance || 0,
            freezeDur: mods.freezeDur || 0,
            lifesteal: mods.lifesteal || 0,
            knockback: mods.knockback || 0,
            stunChance: mods.stunChance || 0,
            stunDur: mods.stunDur || 0,
            thorns: mods.thorns || 0
        };
        const color = mods.evoBlade ? '#ffd86b'
            : mods.elemIce ? '#8beaff'
                : mods.elemFire ? '#ff8a4c' : '#7df9ff';
        this.state.effects.push({ type: 'slash', x, y, a: angle, r: range, color, t: 0, life: 0.18 });
        this.state.bullets.push(slash);
    }

    _updateMonsters(dt) {
        const p = this.state.player;
        for (let i = this.state.monsters.length - 1; i >= 0; i--) {
            const m = this.state.monsters[i];

            if (m.flash > 0) m.flash -= dt;
            if (m.burnTime > 0) {
                m.burnTime -= dt;
                m.burnTick = (m.burnTick || 0) - dt;
                if (m.burnTick <= 0) {
                    m.burnTick = 0.5;
                    m.hp -= Math.max(1, Math.round(m.maxHp * 0.02));
                    window.floatText(m.x, m.y - m.r, '灼烧', '#ff8d5c');
                }
            }
            if (m.poisonTime > 0) {
                m.poisonTime -= dt;
                m.poisonTick = (m.poisonTick || 0) - dt;
                if (m.poisonTick <= 0) {
                    m.poisonTick = 0.95;
                    m.hp -= Math.max(1, Math.round(m.maxHp * 0.018));
                    window.floatText(m.x, m.y - m.r, '中毒', '#a8dc75');
                }
            }
            if (m.regen > 0) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * m.regen * dt);

            if (m.stunCd > 0) {
                m.stunCd -= dt;
                if (m.hp <= 0) this.killMonster(m, i);
                continue;
            }

            m.atkCd = Math.max(0, m.atkCd - dt);
            m.shootCd = Math.max(0, (m.shootCd || 0) - dt);
            m.bossCd = Math.max(0, (m.bossCd || 0) - dt);
            m.healCd = Math.max(0, (m.healCd || 0) - dt);
            m.teleportCd = Math.max(0, (m.teleportCd || 0) - dt);
            m.summonTimer = Math.max(0, (m.summonTimer || 0) - dt);

            const dx = p.x - m.x, dy = p.y - m.y;
            const dist = Math.hypot(dx, dy) || 1;

            if (m.teleport > 0 && m.teleportCd <= 0 && dist > 110) {
                const angle = Math.random() * Math.PI * 2;
                m.x = MathUtils.clamp(p.x + Math.cos(angle) * 160, this.constants.PAD + m.r, this.constants.W - this.constants.PAD - m.r);
                m.y = MathUtils.clamp(p.y + Math.sin(angle) * 160, this.constants.PAD + m.r, this.constants.H - this.constants.PAD - m.r);
                m.teleportCd = Math.max(2, m.teleport);
                this.state.effects.push({ type: 'evolution', x: m.x, y: m.y, color: '#b388e8', t: 0, life: 0.5 });
            }

            if (m.summonCd > 0 && m.summonTimer <= 0) {
                m.summonTimer = m.summonCd;
                this._summonMinion(m);
            }

            if (m.healer && m.healCd <= 0) {
                m.healCd = 3.2;
                for (const ally of this.state.monsters) {
                    if (ally === m || ally.hp <= 0) continue;
                    if (Math.hypot(ally.x - m.x, ally.y - m.y) > 210) continue;
                    const heal = Math.max(1, Math.ceil(ally.maxHp * 0.08));
                    ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                    window.floatText(ally.x, ally.y - ally.r, '妖疗 +' + heal, '#77d68a');
                    this.state.effects.push({ type: 'element', element: 'heal', x: ally.x, y: ally.y, t: 0, life: 0.4 });
                }
            }

            if (m.ranged && m.shootRange > 0 && dist < m.shootRange && m.shootCd <= 0) {
                this._monsterShoot(m, p, 1);
                m.shootCd = m.shootInterval || 2.4;
            }

            if (m.boss && m.bossCd <= 0) {
                this._bossBurst(m);
                m.bossCd = 2.6;
            }

            const desired = m.ranged && m.keepDistance ? m.shootRange * 0.6 : m.r + p.r + 10;
            const dungeonMonsterSpeed = (this.state.dungeonMods && this.state.dungeonMods.monsterSpeed) || 1;
            if (dist > desired) {
                const moveSpeed = m.speed * 60 * dungeonMonsterSpeed;
                m.x += dx / dist * moveSpeed * dt;
                m.y += dy / dist * moveSpeed * dt;
                m.facing = Math.atan2(dy, dx);
            } else if (m.keepDistance && dist < desired * 0.55) {
                const moveSpeed = m.speed * 60 * dungeonMonsterSpeed;
                m.x -= dx / dist * moveSpeed * dt;
                m.y -= dy / dist * moveSpeed * dt;
                m.facing = Math.atan2(dy, dx);
            } else if (!m.keepDistance && m.atkCd <= 0) {
                m.atkCd = 1.2 / (m.speed || 1);
                this._monsterAttack(m, p);
            }

            if (m.hp <= 0) this.killMonster(m, i);
        }
    }

    _monsterShoot(monster, player, damageScale = 1) {
        const angle = Math.atan2(player.y - monster.y, player.x - monster.x);
        this.state.bullets.push({
            x: monster.x,
            y: monster.y,
            vx: Math.cos(angle) * 170,
            vy: Math.sin(angle) * 170,
            r: 6,
            dmg: Math.max(1, Math.round(monster.atk * damageScale)),
            color: monster.projectileColor || '#ffb86b',
            hostile: true,
            life: 3
        });
        this.state.effects.push({ type: 'boom', x: monster.x, y: monster.y, color: monster.projectileColor || '#ffb86b', t: 0, life: 0.2 });
    }

    _bossBurst(monster) {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = i * Math.PI * 2 / count + Math.random() * 0.2;
            this.state.bullets.push({
                x: monster.x,
                y: monster.y,
                vx: Math.cos(angle) * 125,
                vy: Math.sin(angle) * 125,
                r: 7,
                dmg: Math.max(1, Math.round(monster.atk * 0.65)),
                color: this.state.bossElement || '#ff6b6b',
                hostile: true,
                life: 3.5
            });
        }
    }

    _monsterAttack(monster, player) {
        if (window.audioManager) window.audioManager.hurt();
        const dmg = monster.atk;
        this.hurtPlayer(dmg);
        window.floatText(player.x, player.y - 24, '-' + dmg, '#ff6b6b');
        if (player.mods.thorns > 0) {
            const reflect = Math.max(1, Math.round(dmg * player.mods.thorns));
            this.damageMonster(monster, { dmg: reflect });
            window.floatText(monster.x, monster.y - monster.r, '反伤 -' + reflect, '#ffaa66');
            this.state.effects.push({ type: 'hit', x: monster.x, y: monster.y, color: '#89e5a0', t: 0, life: 0.28 });
            this.state.effects.push({ type: 'element', element: 'thorns', x: monster.x, y: monster.y, t: 0, life: 0.4 });
        }
    }

    _summonMinion(source) {
        const dungeon = this.state.dungeon || window.DUNGEONS[0];
        const pool = dungeon && dungeon.floorPool ? dungeon.floorPool.flat() : ['wolf'];
        const id = pool[Math.floor(Math.random() * pool.length)] || 'wolf';
        const base = window.MONSTERS[id];
        if (!base) return;
        const hpMul = (dungeon ? dungeon.hpScale : 1) * (1 + (this.state.floor - 1) * 0.2);
        const atkMul = (dungeon ? dungeon.atkScale : 1) * (1 + (this.state.floor - 1) * 0.12);
        this.state.monsters.push({
            id: base.id, name: base.name, img: base.img, boss: false, elite: false,
            hp: Math.max(1, Math.round(base.hp * hpMul * 0.6)),
            maxHp: Math.max(1, Math.round(base.hp * hpMul * 0.6)),
            atk: Math.max(1, Math.round(base.atk * atkMul * 0.7)),
            speed: base.speed, r: base.r, facing: 0, atkCd: 0.8, stunCd: 0,
            controlEffect: null, type: base.id, draw: base.draw,
            tint: base.tint || '#a9aa83', x: source.x, y: source.y,
            ranged: !!base.ranged, keepDistance: !!base.keepDistance,
            shootRange: base.shootRange || 0, shootCd: 1.5,
            projectileColor: base.projectileColor || '#ffb86b',
            shield: 0, regen: 0, thorns: 0, explode: false,
            splitOnDeath: false, splitChild: true, teleport: 0, summonCd: 0
        });
        this.state.effects.push({ type: 'evolution', x: source.x, y: source.y, color: '#d58bff', t: 0, life: 0.7 });
        window.floatText(source.x, source.y - source.r, '召唤妖仆', '#d58bff');
    }

    _updateBullets(dt) {
        const p = this.state.player;
        for (let i = this.state.bullets.length - 1; i >= 0; i--) {
            const b = this.state.bullets[i];
            if (b.shouldRemove) {
                this.state.bullets.splice(i, 1);
                continue;
            }
            if (b.hostile) {
                b.x += (b.vx || 0) * dt;
                b.y += (b.vy || 0) * dt;
                b.life = (b.life || 3) - dt;
                if (b.life <= 0 ||
                    b.x < this.constants.PAD || b.x > this.constants.W - this.constants.PAD ||
                    b.y < this.constants.PAD || b.y > this.constants.H - this.constants.PAD) {
                    this.state.bullets.splice(i, 1);
                    continue;
                }
                if (p && Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
                    this.hurtPlayer(b.dmg);
                    this.state.effects.push({ type: 'boom', x: b.x, y: b.y, color: b.color || '#ffb86b', t: 0, life: 0.35 });
                    this.state.bullets.splice(i, 1);
                }
                continue;
            }
            // 玩家近战斩击是瞬发的，生成后立即结算
            this._resolveBullet(b);
            this.state.bullets.splice(i, 1);
        }
    }

    _resolveBullet(bullet) {
        const rangeSq = bullet.range * bullet.range;
        for (const m of this.state.monsters) {
            if (m.hp <= 0) continue;
            const dx = m.x - bullet.x, dy = m.y - bullet.y;
            if (dx * dx + dy * dy <= rangeSq + m.r * m.r) {
                this.damageMonster(m, bullet);
            }
        }
    }

    damageMonster(monster, bullet) {
        // bullet.dmg 在 tryAttack 中已经计算过暴击，这里不再重复乘 1.8
        const dmg = bullet.dmg;
        let actualDmg = Math.max(1, dmg);
        if (monster.shield > 0) {
            const blocked = Math.min(monster.shield, actualDmg);
            monster.shield -= blocked;
            actualDmg -= blocked;
            this.state.effects.push({ type: 'element', element: 'shield', x: monster.x, y: monster.y, t: 0, life: 0.35 });
        }
        monster.hp -= actualDmg;
        monster.flash = 0.12;

        window.floatText(monster.x, monster.y - monster.r, bullet.isCrit ? '暴击 -' + actualDmg : '-' + actualDmg,
            bullet.isCrit ? '#ffd700' : '#ff6b6b');
        this.state.effects.push({
            type: 'hit', x: monster.x, y: monster.y,
            color: bullet.isCrit ? '#ffd700' : '#a8edff', t: 0, life: 0.3
        });

        if (monster.thorns > 0 && actualDmg > 0) {
            this.hurtPlayer(Math.max(1, Math.round(actualDmg * monster.thorns)));
        }

        if (bullet.elemFire) {
            monster.burnTime = Math.max(monster.burnTime || 0, 2.5);
            this.state.effects.push({ type: 'element', element: 'fire', x: monster.x, y: monster.y, t: 0, life: 0.5 });
        }
        if (bullet.elemIce && Math.random() * 100 < (bullet.freezeChance || 0)) {
            monster.stunCd = Math.max(monster.stunCd || 0, bullet.freezeDur || 1.5);
            monster.controlEffect = 'freeze';
            this.state.effects.push({ type: 'element', element: 'ice', x: monster.x, y: monster.y, t: 0, life: 0.5 });
        }
        if (bullet.knockback > 0) {
            const fromX = monster.x, fromY = monster.y;
            const angle = Math.atan2(monster.y - bullet.y, monster.x - bullet.x);
            monster.x = MathUtils.clamp(monster.x + Math.cos(angle) * bullet.knockback, this.constants.PAD + monster.r, this.constants.W - this.constants.PAD - monster.r);
            monster.y = MathUtils.clamp(monster.y + Math.sin(angle) * bullet.knockback, this.constants.PAD + monster.r, this.constants.H - this.constants.PAD - monster.r);
            this.state.effects.push({ type: 'knockback', x: fromX, y: fromY, x2: monster.x, y2: monster.y, t: 0, life: 0.22 });
        }
        if (bullet.stunChance && Math.random() * 100 < bullet.stunChance) {
            monster.stunCd = Math.max(monster.stunCd || 0, bullet.stunDur || 1);
            monster.controlEffect = 'stun';
            this.state.effects.push({ type: 'element', element: 'stun', x: monster.x, y: monster.y, t: 0, life: 0.7 });
        }

        if (bullet.lifesteal > 0) {
            const heal = Math.min(bullet.lifesteal, this.state.player.maxHp - this.state.player.hp);
            this.state.player.hp += heal;
            window.floatText(this.state.player.x, this.state.player.y - 24, '吸血 +' + heal, '#ff6b6b');
            this.state.effects.push({ type: 'element', element: 'heal', x: this.state.player.x, y: this.state.player.y, t: 0, life: 0.35 });
        }

        if (bullet.chain > 0) {
            this._chainLightning(monster, bullet);
        }

        if (monster.hp <= 0) this.killMonster(monster);
    }

    _chainLightning(source, bullet) {
        const targets = this.state.monsters
            .filter(m => m !== source && m.hp > 0)
            .sort((a, b) => Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y))
            .slice(0, bullet.chain);

        for (const t of targets) {
            const chainDmg = Math.round(bullet.dmg * (bullet.chainDmg || 0.5));
            t.hp -= chainDmg;
            window.floatText(t.x, t.y - t.r, '连锁 -' + chainDmg, '#8cecff');
            this.state.effects.push({ type: 'lightning', x: source.x, y: source.y, x2: t.x, y2: t.y, t: 0, life: 0.22 });
            this.state.effects.push({ type: 'hit', x: t.x, y: t.y, color: '#c7a1ff', t: 0, life: 0.28 });
            if (t.hp <= 0) this.killMonster(t);
        }
    }

    _updateTraps(dt) {
        const p = this.state.player;
        for (const trap of this.state.traps) {
            const cycle = Math.floor((this.state.time + trap.phase) / trap.period);
            const phaseTime = (this.state.time + trap.phase) % trap.period;
            const active = phaseTime >= trap.warning && phaseTime < trap.warning + trap.activeDuration;
            if (!active) continue;

            if (trap.type === 'sinkhole') {
                const pdist = Math.hypot(p.x - trap.x, p.y - trap.y);
                if (pdist < trap.radius * 1.5) {
                    const pull = Math.min(1, (1 - pdist / (trap.radius * 1.5)) * 1.6);
                    const pullDist = 105 * pull * dt;
                    const angle = Math.atan2(trap.y - p.y, trap.x - p.x);
                    p.x = MathUtils.clamp(p.x + Math.cos(angle) * pullDist, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
                    p.y = MathUtils.clamp(p.y + Math.sin(angle) * pullDist, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
                }
            }

            if (trap.type === 'crystal' && trap.projectileCycle !== cycle) {
                trap.projectileCycle = cycle;
                for (let i = 0; i < 6; i++) {
                    const angle = i * Math.PI / 3 + trap.phase;
                    this.state.bullets.push({
                        x: trap.x, y: trap.y,
                        vx: Math.cos(angle) * 165, vy: Math.sin(angle) * 165,
                        r: 6, dmg: Math.max(6, Math.ceil(p.maxHp * 0.06)),
                        color: '#8df2ed', hostile: true, life: 3
                    });
                }
                this.state.effects.push({ type: 'boom', x: trap.x, y: trap.y, color: '#8df2ed', t: 0, life: 0.55 });
            }

            if (trap.type === 'altar' && trap.healCycle !== cycle) {
                trap.healCycle = cycle;
                for (const m of this.state.monsters) {
                    if (Math.hypot(m.x - trap.x, m.y - trap.y) < trap.radius + m.r) {
                        const heal = Math.max(1, Math.ceil(m.maxHp * 0.035));
                        m.hp = Math.min(m.maxHp, m.hp + heal);
                        window.floatText(m.x, m.y - m.r, '祭坛 +' + heal, '#d58bff');
                        this.state.effects.push({ type: 'element', element: 'heal', x: m.x, y: m.y, t: 0, life: 0.4 });
                    }
                }
            }

            if (this.state.time >= (trap.playerNextHit || 0) && this._trapContains(trap, p.x, p.y, p.r) && p.invuln <= 0) {
                trap.playerCycle = cycle;
                let dmg = Math.max(trap.damage, Math.ceil(p.maxHp * trap.damageRatio)) + Math.ceil(p.maxHp * (trap.drain || 0));
                this.hurtPlayer(dmg);
                if (trap.slow) p.slowTime = Math.max(p.slowTime || 0, trap.slow);
                if (trap.burn) p.burnTime = Math.max(p.burnTime || 0, trap.burn);
                if (trap.stun) p.stunTime = Math.max(p.stunTime || 0, trap.stun);
                if (trap.shock) p.stunTime = Math.max(p.stunTime || 0, trap.shock * 0.7);
                if (trap.burnDamage) p.hazardBurnDamage = trap.burnDamage;
                if (trap.poison) { p.poisonTime = Math.max(p.poisonTime || 0, trap.poison); p.poisonTick = Math.max(p.poisonTick || 0, 0.95); }
                if (trap.attackSlow) p.attackSlowTime = Math.max(p.attackSlowTime || 0, trap.attackSlow);
                if (trap.slide) {
                    const mv = Math.hypot(p.vx || 0, p.vy || 0) || 1;
                    p.iceDriftX = (p.vx || Math.cos(trap.phase)) / mv;
                    p.iceDriftY = (p.vy || Math.sin(trap.phase)) / mv;
                    p.slideTime = trap.slide;
                }
                if (trap.knockback) {
                    const angle = Math.atan2(p.y - trap.y, p.x - trap.x);
                    p.x = MathUtils.clamp(p.x + Math.cos(angle) * trap.knockback, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
                    p.y = MathUtils.clamp(p.y + Math.sin(angle) * trap.knockback, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
                }
                trap.playerNextHit = this.state.time + (trap.poison ? 1.05 : 1.4);
                window.floatText(p.x, p.y - 24, '⚠ ' + trap.name + ' -' + dmg, trap.color);
                const element = trap.type === 'ice' ? 'ice' : trap.type === 'fire' ? 'fire' :
                    trap.type === 'roots' ? 'roots' : trap.type === 'rune' ? 'seal' :
                    trap.type === 'altar' ? 'heal' : trap.type === 'sinkhole' ? 'void' :
                    trap.type === 'crystal' || trap.type === 'blade' || trap.type === 'bone' ? 'crystal' : 'poison';
                this.state.effects.push({ type: 'element', element, x: p.x, y: p.y, t: 0, life: 0.65 });
            }

            for (let i = this.state.monsters.length - 1; i >= 0; i--) {
                const m = this.state.monsters[i];
                if (!m.trapCycles) m.trapCycles = {};
                if (m.trapCycles[trap.id] === cycle || !this._trapContains(trap, m.x, m.y, m.r)) continue;
                m.trapCycles[trap.id] = cycle;
                this.damageMonster(m, { dmg: Math.max(1, Math.round(m.maxHp * 0.1)) });
                m.flash = 0.12;
                if (trap.burn) m.burnTime = Math.max(m.burnTime || 0, trap.burn);
                if (trap.slow) m.slowTime = Math.max(m.slowTime || 0, trap.slow * 0.55);
                if (trap.poison) { m.poisonTime = Math.max(m.poisonTime || 0, trap.poison); m.poisonTick = Math.max(m.poisonTick || 0, 0.95); }
                if (trap.attackSlow) m.atkCd = Math.max(m.atkCd || 0, 1.6);
                if (trap.stun) { m.stunCd = Math.max(m.stunCd || 0, trap.stun); m.controlEffect = 'stun'; }
                if (trap.shock) { m.stunCd = Math.max(m.stunCd || 0, trap.shock * 0.7); m.controlEffect = 'stun'; }
                if (trap.knockback) {
                    const angle = Math.atan2(m.y - trap.y, m.x - trap.x);
                    m.x = MathUtils.clamp(m.x + Math.cos(angle) * trap.knockback * 0.8, this.constants.PAD + m.r, this.constants.W - this.constants.PAD - m.r);
                    m.y = MathUtils.clamp(m.y + Math.sin(angle) * trap.knockback * 0.8, this.constants.PAD + m.r, this.constants.H - this.constants.PAD - m.r);
                }
                const element = trap.type === 'ice' ? 'ice' : trap.type === 'fire' ? 'fire' :
                    trap.type === 'roots' ? 'roots' : trap.type === 'rune' ? 'seal' :
                    trap.type === 'altar' ? 'heal' : trap.type === 'sinkhole' ? 'void' :
                    trap.type === 'crystal' || trap.type === 'blade' || trap.type === 'bone' ? 'crystal' : 'poison';
                this.state.effects.push({ type: 'element', element, x: m.x, y: m.y, t: 0, life: 0.35 });
                if (m.hp <= 0) this.killMonster(m);
            }
        }
    }

    _trapContains(trap, x, y, actorRadius) {
        const dx = x - trap.x, dy = y - trap.y;
        const dist = Math.hypot(dx, dy);
        if (trap.type === 'blade' || trap.type === 'bone') {
            const count = trap.type === 'blade' ? 2 : 3;
            const rot = this.state.time * (trap.type === 'blade' ? 1.65 : 0.72) + trap.phase;
            const offset = Math.atan2(dy, dx) - rot;
            const step = Math.PI / count;
            const nearest = Math.round(offset / step) * step;
            return dist < trap.radius + actorRadius && dist > 8 &&
                Math.abs(Math.sin(offset - nearest)) * dist < actorRadius + (trap.type === 'blade' ? 8 : 5);
        }
        if (trap.type === 'sinkhole') {
            return dist > trap.radius * 0.38 - actorRadius && dist < trap.radius * 0.82 + actorRadius;
        }
        return dist < trap.radius + actorRadius;
    }

    _updateEffects(dt) {
        for (let i = this.state.effects.length - 1; i >= 0; i--) {
            const e = this.state.effects[i];
            e.t += dt;
            if (e.t >= e.life) this.state.effects.splice(i, 1);
        }
        for (let i = this.state.texts.length - 1; i >= 0; i--) {
            const t = this.state.texts[i];
            t.t += dt;
            t.y += (t.vy || -30) * dt;
            if (t.t >= (t.life || 1)) this.state.texts.splice(i, 1);
        }
    }

    _updateChests(dt) {
        const p = this.state.player;
        for (const c of this.state.chests) {
            if (!c.opened && Math.hypot(p.x - c.x, p.y - c.y) < p.r + 20) {
                c.opened = true;
                this._openChest(c);
            }
        }
    }

    _openChest(chest) {
        if (window.audioManager) window.audioManager.pickup();
        this.state.effects.push({ type: 'boom', x: chest.x, y: chest.y, color: '#ffd700', t: 0, life: 0.6 });
        const roll = Math.random();
        const p = this.state.player;
        if (roll < 0.3) {
            const heal = 40;
            p.hp = Math.min(p.maxHp, p.hp + heal);
            window.floatText(chest.x, chest.y - 20, '💊 回春 +' + heal + 'HP', '#66ff99');
        } else if (roll < 0.5) {
            window.G.atk += 2;
            window.floatText(chest.x, chest.y - 20, '⚔️ 攻击+2', '#ffd700');
        } else if (roll < 0.7) {
            window.G.maxHp += 15;
            p.maxHp = window.G.maxHp;
            p.hp = Math.min(p.maxHp, p.hp + 15);
            window.floatText(chest.x, chest.y - 20, '🛡️ 生命上限+15', '#7df9ff');
        } else if (roll < 0.85) {
            window.G.crit = Math.min(80, window.G.crit + 5);
            window.floatText(chest.x, chest.y - 20, '🎯 暴击+5%', '#ff88cc');
        } else {
            const cult = 30 + this.state.floor * 8;
            window.gainCultivation(cult);
            window.floatText(chest.x, chest.y - 20, '🌀 修为+' + cult, '#7fffd4');
        }
    }

    _updateFloorNpc() {
        const floorNpc = this.state.floorNpc;
        const p = this.state.player;
        if (!floorNpc || floorNpc.used || !p) return;
        if (Math.hypot(p.x - floorNpc.x, p.y - floorNpc.y) < 62 && typeof window.onDungeonNpcNearby === 'function') {
            floorNpc.used = true;
            window.onDungeonNpcNearby(floorNpc.npc);
        }
    }

    _checkCollisions() {
        const p = this.state.player;
        for (const m of this.state.monsters) {
            if (m.hp <= 0) continue;
            const dx = m.x - p.x, dy = m.y - p.y;
            if (dx * dx + dy * dy < (m.r + p.r) * (m.r + p.r)) {
                if (p.invuln <= 0 && !m.stunCd) {
                    this.hurtPlayer(m.atk);
                    const angle = Math.atan2(p.y - m.y, p.x - m.x);
                    const kb = 40;
                    p.x = MathUtils.clamp(p.x + Math.cos(angle) * kb, this.constants.PAD + p.r, this.constants.W - this.constants.PAD - p.r);
                    p.y = MathUtils.clamp(p.y + Math.sin(angle) * kb, this.constants.PAD + p.r, this.constants.H - this.constants.PAD - p.r);
                    p.invuln = 0.5;
                }
            }
        }
    }

    _checkWinCondition() {
        const alive = this.state.monsters.filter(m => m.hp > 0);
        if (alive.length === 0 && this.state.state === 'playing') {
            this.state.state = 'clear';
            if (typeof window.onDungeonFloorClear === 'function') {
                window.onDungeonFloorClear(this.state.floor);
            }
        }
    }

    hurtPlayer(damage) {
        const p = this.state.player;
        const dungeonTaken = (this.state.dungeonMods && this.state.dungeonMods.damageTaken) || 1;
        let actualDmg = Math.max(1, Math.round(damage * dungeonTaken));

        if (p.shield > 0) {
            const blocked = Math.min(p.shield, actualDmg);
            p.shield -= blocked;
            actualDmg -= blocked;
            if (p.shield <= 0) p.shieldCooldown = p.mods.shieldCd || 8;
            this.state.effects.push({ type: 'element', element: 'shield', x: p.x, y: p.y, t: 0, life: 0.4 });
        }

        if (p.mods.dodge && Math.random() * 100 < p.mods.dodge * 100) {
            window.floatText(p.x, p.y - 24, '闪避！', '#8cecff');
            return;
        }

        if (p.mods.curseLastStand && !p.curseLastStandUsed && actualDmg >= p.hp) {
            p.curseLastStandUsed = true;
            p.hp = Math.max(1, Math.round(p.maxHp * (p.mods.curseLastStandHp || 0.3)));
            window.toast('💀 绝境求生！', 'gold');
            this.state.effects.push({ type: 'evolution', x: p.x, y: p.y, color: '#ff687d', t: 0, life: 1 });
            return;
        }

        p.hp -= actualDmg;
        window.floatText(p.x, p.y - 24, '-' + actualDmg, '#ff6b6b');
        this.state.effects.push({ type: 'hurt', x: p.x, y: p.y, t: 0, life: 0.2 });

        if (p.hp <= 0) {
            this.state.state = 'clear';
            window.G.flags.deaths = (window.G.flags.deaths || 0) + 1;
            this.state.noDeathRun = false;
            window.G.hp = 1;
            window.toast('💀 你被击倒了……被秘境之力送回入口', 'bad');
            window.checkAchievements();
            window.saveGame(false);
            if (typeof window.onDungeonDeath === 'function') {
                window.onDungeonDeath();
            }
        }
    }

    killMonster(monster, index) {
        if (monster._dead) return;
        monster._dead = true;
        if (window.audioManager) window.audioManager.hit();
        window.G.flags.kills = (window.G.flags.kills || 0) + 1;
        window.checkAchievements();

        if (this.state.player.mods.curseSoulHarvest) {
            const heal = Math.max(1, Math.ceil(this.state.player.maxHp * this.state.player.mods.curseSoulHarvest));
            this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + heal);
            window.floatText(this.state.player.x, this.state.player.y - 24, '回血 +' + heal, '#8df2ed');
        }

        if (this.state.player.mods.curseFrenzy) {
            this.state.player.curseFrenzyTimer = 3.5;
            this.state.player.curseFrenzyAtk = this.state.player.mods.atk;
            this.state.player.mods.atk = Math.round(this.state.player.mods.atk * (1 + this.state.player.mods.curseFrenzy));
        }

        this.state.effects.push({ type: 'boom', x: monster.x, y: monster.y, color: monster.tint || '#ff6b6b', t: 0, life: 0.5 });

        if (index !== undefined && this.state.monsters[index] === monster) {
            this.state.monsters.splice(index, 1);
        } else {
            const idx = this.state.monsters.indexOf(monster);
            if (idx >= 0) this.state.monsters.splice(idx, 1);
        }

        if (monster.explode) {
            const p = this.state.player;
            if (p && Math.hypot(p.x - monster.x, p.y - monster.y) < 110) {
                this.hurtPlayer(monster.atk);
            }
            this.state.effects.push({ type: 'boom', x: monster.x, y: monster.y, color: '#ff743e', t: 0, life: 0.6 });
        }

        if (monster.splitOnDeath && !monster.splitChild) {
            for (let i = 0; i < 2; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.state.monsters.push(Object.assign({}, monster, {
                    x: monster.x + Math.cos(angle) * 22,
                    y: monster.y + Math.sin(angle) * 22,
                    hp: Math.max(1, Math.round(monster.maxHp / 3)),
                    maxHp: Math.max(1, Math.round(monster.maxHp / 3)),
                    r: Math.max(8, monster.r * 0.7),
                    splitChild: true,
                    splitOnDeath: false,
                    explode: false,
                    shield: 0,
                    _dead: false
                }));
            }
        }
    }

    gainCultivation(amount) {
        window.G.cultivation += amount;
        while (window.G.realm < window.REALMS.length - 1 &&
            window.G.cultivation >= window.REALMS[window.G.realm + 1].cult) {
            window.G.realm++;
            window.toast('🎉 境界突破：' + window.REALMS[window.G.realm].name, 'gold');
        }
        window.updateHUD();
    }
}

window.CombatSystem = CombatSystem;