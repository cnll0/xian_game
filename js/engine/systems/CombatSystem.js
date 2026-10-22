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
        // 地标碰撞体缓存：换层/换图时置空，由 _obstacles() 重建
        this._obstacleCache = null;
    }

    startRun(startFloor, storyDungeon, dungeonId, skirmish, duelNpc = null) {
        if (!window.G.created) return;

        this.state.storyDungeon = storyDungeon === true;
        this.state.skirmish = skirmish === true;
        this.state.duelNpc = duelNpc || null;
        this.state.duel = !!duelNpc;
        this.state.duelClearTimer = 0;
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
        // 使用新的秘境世界模式
        this._spawnDungeonWorldAsync(this.state.floor);
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
     * 异步生成大型秘境世界地图
     * @param {number} floor
     * @returns {Promise<void>}
     */
    async _spawnDungeonWorldAsync(floor) {
        this.state.state = 'loading';
        window.updateHUD();

        try {
            if (this.useWorker && this.mapGeneratorWorker) {
                await this.mapGeneratorWorker.init();
                const world = await this.mapGeneratorWorker.generateDungeonWorld(
                    this.state.dungeon, floor, this.state.mapSeed
                );
                if (!world || !world.entry) {
                    throw new Error('Worker 返回的秘境世界数据不完整');
                }

                this.state.dungeonWorld = world;
                this.state.dungeonWorldMode = true;
            } else {
                this._spawnDungeonWorldSync(floor);
            }
        } catch (err) {
            console.error('Worker生成秘境世界失败，回退同步:', err);
            this._spawnDungeonWorldSync(floor);
        }

        this._finishSpawnDungeonWorld();
    }

    /**
     * 同步生成大型秘境世界地图
     * @param {number} floor
     */
    _spawnDungeonWorldSync(floor) {
        const world = this.mapGenerator.generateDungeonWorld(this.state.dungeon, floor, this.state.mapSeed);
        this.state.dungeonWorld = world;
        this.state.dungeonWorldMode = true;
    }

    /**
     * 秘境世界生成完成后的逻辑
     */
    _finishSpawnDungeonWorld() {
        const floor = this.state.floor;
        const dungeon = this.state.dungeon || window.DUNGEONS[0];
        const world = this.state.dungeonWorld;

        // 地标碰撞体要在玩家、妖兽落位之前准备好
        this.state.landmarks = world.landmarks || [];
        this._resetObstacles();

        // 设置玩家初始位置在入口
        const { W, H } = this.constants;
        const entry = world.entry || { x: W / 2, y: H - 80 };
        this.state.player = {
            x: entry.x, y: entry.y,
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
                shield: 0, shieldCd: 0, dodge: 0, regen: 0, thorns: 0,
                combo: 0, split: 0, explode: 0, burnTime: 0,
                evoBlade: false, evoFlame: false, evoFrost: false, evoStorm: false,
                evoAegis: false, evoPhantom: false, evoSoul: false, evoRuin: false, evoBloom: false
            }
        };
        // 出生点若正好压在障碍物上，先推出来
        this._pushActor(this.state.player, 0, 0);

        // 设置视野系统
        this.state.playerVision = 280; // 玩家基础视野
        this.state.explored = new Set(); // 已探索区域

        // 怪物从生成的世界数据加载
        this.state.monsters = (world.creatures || []).map(c => ({
            ...c,
            facing: 0,
            atkCd: 0,
            stunCd: 0,
            controlEffect: null
        }));
        // 妖兽出生点可能正好压在断墙/树桩上：先全部推出障碍物
        for (const monster of this.state.monsters) this._pushActor(monster, 0, 0);
        this.state.floorMonsterTotal = this.state.monsters.length;
        this.state.floorKillTarget = this.state.monsters.length
            ? Math.ceil(this.state.monsters.length * 0.75)
            : 0;
        this.state.floorKills = 0;
        this.state.floorHasBoss = this.state.monsters.some(m => m.boss);
        this.state.floorBossKilled = false;
        this.state.floorExitUnlocked = this.state.monsters.length === 0;
        this.state.exitLockToastAt = 0;

        // 与 NPC 的一对一决斗：只留一名人形对手，不再刷妖兽
        if (this.state.duelNpc) {
            const npc = this.state.duelNpc;
            const stats = npc.combatStats || {};
            const realmScale = 1 + Math.max(0, window.G.realm) * 0.06;
            const enemy = {
                id: 'duel_' + npc.id,
                name: npc.name,
                img: 'npcSprites',
                art: npc.portrait || npc.id,
                human: true,
                npcId: npc.id,
                faction: npc.faction || '',
                boss: false,
                elite: true,
                hp: Math.max(48, Math.round((stats.hp || 140) * 0.5 * realmScale)),
                maxHp: Math.max(48, Math.round((stats.hp || 140) * 0.5 * realmScale)),
                atk: Math.max(8, Math.round((stats.atk || 18) * 0.5 * (1 + Math.max(0, window.G.realm) * 0.04))),
                speed: Math.min(3.6, stats.speed || 3),
                r: 18,
                draw: 86,
                tint: npc.color || '#c9a467',
                vision: 900,
                x: entry.x,
                y: Math.max(120, entry.y - 300),
                homeX: entry.x,
                homeY: Math.max(120, entry.y - 300),
                facing: Math.PI / 2,
                atkCd: 0,
                stunCd: 0,
                controlEffect: null,
                state: 'chase',
                target: null,
                lastSeenPlayer: null,
                shootRange: 0,
                ranged: false,
                inPlayerVision: true,
                canSeePlayer: true,
                phase: Math.random() * Math.PI * 2,
                bob: 0
            };
            this.state.monsters = [enemy];
            this._pushActor(enemy, 0, 0);
            this.state.floorMonsterTotal = 1;
            this.state.floorKillTarget = 1;
            this.state.floorHasBoss = false;
            this.state.floorBossKilled = false;
            this.state.floorExitUnlocked = false;
            this.state.floorKills = 0;
            world.npcs = [];
            window.toast('⚔️ ' + npc.name + ' 拔剑相对，点到为止。', 'gold');
        }

        // 陷阱
        this.state.traps = world.traps || [];

        // 地形装饰
        this.state.scenery = world.decor || [];
        this.state.landmarks = world.landmarks || [];

        // NPC
        // Worker 无法访问主线程的 DUNGEON_NPC_EVENTS/NPCS 数据，返回的 npcs 为空；
        // 在这里统一补全，避免走 Worker 时秘境里完全没有可交互 NPC。
        if (!this.state.skirmish && (!world.npcs || world.npcs.length === 0)) {
            world.npcs = this.mapGenerator.generateDungeonWorldNPCs(
                dungeon, floor, this.state.mapSeed, world.width, world.height
            ) || [];
        }

        this.state.floorNpc = null;
        if (world.npcs && world.npcs.length > 0) {
            const npcData = world.npcs[0];
            // 兼容两种数据形态：{ npc: {...} } 或只有 { npcId, title, line, choices }。
            const npcBase = npcData.npc || (npcData.npcId && (window.NPCS || [])
                .find(item => item.id === npcData.npcId));
            if (npcBase) {
                this.state.floorNpc = {
                    x: typeof npcData.x === 'number' ? npcData.x : W / 2 + 170,
                    y: typeof npcData.y === 'number' ? npcData.y : H * 0.39,
                    phase: typeof npcData.phase === 'number' ? npcData.phase : Math.random() * Math.PI * 2,
                    used: false,
                    npc: Object.assign({}, npcBase, {
                        dungeonEncounter: true,
                        title: npcData.title,
                        greeting: npcData.line,
                        choices: npcData.choices
                    })
                };
                // 秘境 NPC 不能卡进断墙里，否则玩家永远走不到 80px 内
                this._pushActor(this.state.floorNpc, 0, 0);
            }
        }

        // 宝箱（放在出口附近和随机位置）；决斗场不放宝箱
        this.state.chests = [];
        const chestCount = this.state.duel ? 0 : (this.state.floor < this.state.floorCount ? 2 : 0);
        for (let i = 0; i < chestCount; i++) {
            if (i === 0 && world.exit) {
                this.state.chests.push({ x: world.exit.x, y: world.exit.y + 40, opened: false });
            } else {
                this.state.chests.push({
                    x: 100 + Math.random() * (world.width - 200),
                    y: 100 + Math.random() * (world.height - 200),
                    opened: false
                });
            }
        }
        // 宝箱不能生在障碍物里，否则玩家凑不到拾取距离
        const chestObstacles = this._obstacles();
        if (chestObstacles.length && window.Collision) {
            for (const chest of this.state.chests) {
                const spot = window.Collision.resolve(chest.x, chest.y, 18, chestObstacles);
                chest.x = spot.x;
                chest.y = spot.y;
            }
        }

        if (window.G.flags.maxFloor < this.state.floor) {
            window.G.flags.maxFloor = this.state.floor;
            window.checkAchievements();
        }

        window.toast('🏰 ' + dungeon.name + ' · 第' + this.state.floor + '/' + this.state.floorCount + '层 · ' + (window.FLOOR_NAMES[this.state.floor - 1] || '深处'), 'gold');
        window.updateHUD();

        if (this.state.floor > 1) window.showDualCardChoice();

        this.state.state = 'dungeon_world';
    }

    /**
     * 生成楼层完成后的通用逻辑
     */
    _finishSpawnFloor() {
        const floor = this.state.floor;
        const { W, H, PAD } = this.constants;
        const dungeon = this.state.dungeon || window.DUNGEONS[0];
        // 旧竞技场地标同样挡路：换图后重建碰撞体
        this._resetObstacles();
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
                human: !!base.human, art: base.art || null, faction: base.faction || '',
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

        // 竞技场里的玩家/妖兽/宝箱同样不能卡在 solid 地标里
        if (this.state.player) this._pushActor(this.state.player, 0, 0);
        for (const monster of this.state.monsters) this._pushActor(monster, 0, 0);
        for (const chest of this.state.chests) {
            const spot = window.Collision
                ? window.Collision.resolve(chest.x, chest.y, 18, this._obstacles())
                : chest;
            chest.x = spot.x;
            chest.y = spot.y;
        }

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

        // 保留玩家当前状态（血量、修饰符等）
        const playerHp = this.state.player ? this.state.player.hp : window.G.maxHp;
        const playerMods = this.state.player ? this.state.player.mods : {};

        try {
            if (this.state.dungeonWorldMode) {
                // 秘境世界模式：生成新的大地图
                await this._spawnDungeonWorldAsync(this.state.floor);
            } else {
                // 兼容旧竞技场模式
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
                this._finishSpawnFloor();
            }
        } catch (err) {
            console.error('Worker生成下一层失败，回退同步:', err);
            if (this.state.dungeonWorldMode) {
                this._spawnDungeonWorldSync(this.state.floor);
                this._finishSpawnDungeonWorld();
            } else {
                this._spawnFloorSync(this.state.floor);
                this._finishSpawnFloor();
            }
        }

        // 恢复玩家血量（不恢复满血，保持挑战性）
        if (this.state.player) {
            this.state.player.hp = Math.min(playerHp, this.state.player.maxHp);
            // 保留之前的mods
            this.state.player.mods = { ...this.state.player.mods, ...playerMods };
        }

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
                window.toast((this.state.duel ? '⚔️ 切磋结束' : '⚔️ 击退妖兽') + '，修为+' + reward, 'good');
                window.saveGame(false);
            } else {
                window.G.flags.clears = (window.G.flags.clears || 0) + 1;
                if (this.state.noDeathRun) window.G.flags.noDeathClear = (window.G.flags.noDeathClear || 0) + 1;
                window.gainCultivation(150 + this.state.floor * 15);
                if (typeof window.addSectContribution === 'function') {
                    window.addSectContribution((window.SECT && window.SECT.contributionPerClear) || 20);
                }
                if (typeof window.addSpiritStones === 'function') {
                    window.addSpiritStones(40 + this.state.floor * 8);
                }
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

    update(dt, input = null) {
        if (!this.state.running) return;

        const isDungeonWorld = this.state.dungeonWorldMode === true;
        const isPlaying = this.state.state === 'playing' || this.state.state === 'dungeon_world' || this.state.state === 'clear';

        if (!isPlaying) return;

        this.state.time += dt;
        // 决斗胜利后自动收场，不必再走到出口
        if (this.state.duel && this.state.duelClearTimer > 0) {
            this.state.duelClearTimer -= dt;
            if (this.state.duelClearTimer <= 0) {
                this.state.duelClearTimer = 0;
                if (typeof window.onDungeonFloorClear === 'function') {
                    window.onDungeonFloorClear(this.state.floor);
                }
                return;
            }
        }
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

        // 视野/迷雾系统更新
        if (isDungeonWorld) {
            this._updateVisionSystem(dt);
        }

        this._updatePlayerMovement(dt);
        this._updatePlayerAttack(dt);

        if (isDungeonWorld) {
            this._updateMonstersDungeonWorld(dt);
        } else {
            this._updateMonsters(dt);
        }

        this._updateBullets(dt);
        this._updateTraps(dt);
        this._updateEffects(dt);
        this._updateChests(dt);
        this._updateFloorNpc();

        if (isDungeonWorld) {
            this._checkDungeonWorldExit();
        } else {
            this._checkWinCondition();
        }
    }

    _worldW() {
        // 只要存在秘境世界就用它的尺寸：碰撞边界必须和实际地图一致。
        const world = this.state.dungeonWorld;
        return world && world.width ? world.width : this.constants.W;
    }

    _worldH() {
        const world = this.state.dungeonWorld;
        return world && world.height ? world.height : this.constants.H;
    }

    _minX(radius) { return this.constants.PAD + radius; }
    _maxX(radius) { return this._worldW() - this.constants.PAD - radius; }
    _minY(radius) { return this.constants.PAD + radius; }
    _maxY(radius) { return this._worldH() - this.constants.PAD - radius; }

    /**
     * 当前地图的障碍物碰撞体（solid 地标）。
     * 只在换层时重建，别每帧 build。
     * @returns {Array}
     */
    _obstacles() {
        if (!this._obstacleCache) {
            this._obstacleCache = (window.Collision && this.state.landmarks)
                ? window.Collision.build(this.state.landmarks)
                : [];
        }
        return this._obstacleCache;
    }

    _resetObstacles() {
        this._obstacleCache = null;
    }

    /**
     * 会动实体的位移入口：边界 clamp + 障碍物阻挡。
     * 玩家用默认的滑动式（撞墙后仍能贴墙横移）；妖兽传 steer=true 会在正面被挡死时绕行。
     * 所有实体改坐标都必须走这里，不要直接 `m.x +=`。
     * @param {Object} actor
     * @param {number} dx
     * @param {number} dy
     * @param {boolean} [steer]
     */
    _moveActor(actor, dx, dy, steer = false) {
        const r = actor.r || 16;
        const limitX = MathUtils.clamp(actor.x + dx, this._minX(r), this._maxX(r));
        const limitY = MathUtils.clamp(actor.y + dy, this._minY(r), this._maxY(r));
        const obstacles = this._obstacles();
        if (!obstacles.length || !window.Collision) {
            actor.x = limitX;
            actor.y = limitY;
            return;
        }
        const moveFn = steer ? window.Collision.steer : window.Collision.move;
        const next = moveFn(actor.x, actor.y, limitX - actor.x, limitY - actor.y, r, obstacles);
        actor.x = MathUtils.clamp(next.x, this._minX(r), this._maxX(r));
        actor.y = MathUtils.clamp(next.y, this._minY(r), this._maxY(r));
    }

    /**
     * 强制位移：击退、拉拽、闪现、出生落点等。
     * 撞到障碍物时停在表面，不会穿进去。
     */
    _pushActor(actor, dx, dy) {
        const r = actor.r || 16;
        let x = MathUtils.clamp(actor.x + dx, this._minX(r), this._maxX(r));
        let y = MathUtils.clamp(actor.y + dy, this._minY(r), this._maxY(r));
        const obstacles = this._obstacles();
        if (obstacles.length && window.Collision) {
            const pushed = window.Collision.resolve(x, y, r, obstacles);
            x = pushed.x;
            y = pushed.y;
        }
        actor.x = MathUtils.clamp(x, this._minX(r), this._maxX(r));
        actor.y = MathUtils.clamp(y, this._minY(r), this._maxY(r));
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
            this._moveActor(p, p.iceDriftX * speed * dt, p.iceDriftY * speed * dt);
        } else if (mv.length > 0.05) {
            this._moveActor(p, mv.x * speed * dt, mv.y * speed * dt);
            p.facing = Math.atan2(mv.y, mv.x);
            p.walkT += dt;
        }

        if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
        if (p.dashTime > 0) {
            p.dashTime -= dt;
            this._moveActor(p, p.dashVx * dt, p.dashVy * dt);
            this.state.effects.push({ type: 'afterimage', x: p.x, y: p.y, t: 0, life: 0.25 });
        }
        if (p.mods.dashStrike && p.dashCd <= 0 && p.dashTime <= 0) {
            const target = this._mouseWorld();
            const dx = target.x - p.x;
            const dy = target.y - p.y;
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

    /**
     * 鼠标画布坐标 → 世界坐标。
     * InputManager.mouse 是 960×540 画布像素，秘境世界还要加上相机偏移。
     */
    _mouseWorld() {
        const p = this.state.player;
        const mouse = window.gameInput && window.gameInput.mouse;
        if (!p || !mouse) {
            const facing = p ? (p.facing || 0) : 0;
            return { x: p ? p.x + Math.cos(facing) * 100 : 0, y: p ? p.y + Math.sin(facing) * 100 : 0 };
        }
        const { W, H } = this.constants;
        let camX = 0;
        let camY = 0;
        const world = this.state.dungeonWorldMode && this.state.dungeonWorld;
        if (world) {
            camX = MathUtils.clamp(p.x - W / 2, 0, Math.max(0, world.width - W));
            camY = MathUtils.clamp(p.y - H / 2, 0, Math.max(0, world.height - H));
        }
        return { x: camX + mouse.x, y: camY + mouse.y };
    }

    /**
     * 玩家攻击朝向 = 鼠标方向；攻击距离 = 鼠标到玩家的距离（夹在攻击范围内）。
     * 攻击特效和命中判定都用这组 angle/reach —— 鼠标指到哪，刀光就扫到哪。
     */
    _aimAtMouse(maxRange) {
        const p = this.state.player;
        const target = this._mouseWorld();
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minReach = Math.min(p.r + 26, maxRange);
        if (dist < 12) {
            return { angle: p.facing || 0, reach: maxRange, dist, x: target.x, y: target.y };
        }
        return {
            angle: Math.atan2(dy, dx),
            reach: MathUtils.clamp(dist, minReach, maxRange),
            dist,
            x: target.x,
            y: target.y
        };
    }

    tryAttack(isAuto = false) {
        if (window.audioManager) window.audioManager.attack();
        const p = this.state.player;
        const atkSpeed = p.attackSlowTime > 0 ? 0.5 : 1;
        p.atkCd = (0.6 / atkSpeed) * (p.mods.dashStrike ? 0.8 : 1);
        p.swinging = 0.24;

        const style = window.AttackFx ? window.AttackFx.playerStyle(p.mods) : null;
        const maxRange = (window.G.range + (p.mods.range || 0)) * (p.mods.dashStrike ? 1.5 : 1);
        const aim = this._aimAtMouse(maxRange);
        // 角色朝向跟着鼠标；刀光由 AttackFx 独立绘制，不再画在角色身上
        p.facing = aim.angle;

        const dmg = window.G.atk + (p.mods.atk || 0);
        const isCrit = Math.random() * 100 < (window.G.crit + (p.mods.crit || 0));
        const finalDmg = isCrit ? Math.round(dmg * 1.8) : dmg;

        this._spawnSlash(p.x, p.y, aim.angle, aim.reach, finalDmg, isCrit, p.mods, style);

        if (p.mods.doubleHit) {
            const angle = aim.angle;
            const reach = aim.reach;
            setTimeout(() => this._spawnSlash(p.x, p.y, angle, reach,
                Math.round(finalDmg * 0.7), isCrit, p.mods, style), 80);
        }
    }

    _spawnSlash(x, y, angle, reach, dmg, isCrit, mods, style) {
        const fxStyle = style || (window.AttackFx ? window.AttackFx.playerStyle(mods) : null);
        const arcHalf = fxStyle ? fxStyle.arc : 1.1;
        const innerR = fxStyle ? Math.max(2, reach * fxStyle.inner) : 0;
        const shape = fxStyle ? fxStyle.shape : 'fan';
        const slash = {
            x, y, angle, range: reach, dmg, isCrit,
            // 判定几何和特效几何是同一份数据（见 AttackFx.inSector）
            arcHalf, innerR, fx: 'player', shape,
            width: fxStyle && fxStyle.width,
            lanes: fxStyle && fxStyle.lanes,
            laneGap: fxStyle && fxStyle.laneGap,
            laneSpread: fxStyle && fxStyle.laneSpread,
            laneHalf: fxStyle && fxStyle.laneHalf,
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
        if (window.AttackFx) {
            this.state.effects.push(window.AttackFx.makeEffect({
                fx: 'player', x, y, angle, reach, arcHalf, innerR, shape,
                width: slash.width,
                lanes: slash.lanes,
                laneGap: slash.laneGap,
                laneSpread: slash.laneSpread,
                laneHalf: slash.laneHalf,
                pal: fxStyle && fxStyle.pal,
                kind: fxStyle && fxStyle.kind,
                blades: fxStyle && fxStyle.blades,
                sweep: fxStyle && fxStyle.sweep,
                spark: fxStyle && fxStyle.spark,
                seeds: fxStyle && fxStyle.sparks,
                life: fxStyle && fxStyle.life
            }));
        } else {
            this.state.effects.push({ type: 'slash', x, y, a: angle, r: reach, color: '#7df9ff', t: 0, life: 0.24 });
        }
        this.state.bullets.push(slash);
    }

    /** 怪物的实际出手距离 = 它攻击特效的半径（由体型/形状决定，不再统一 r+p.r+10） */
    _monsterMeleeRange(monster, player) {
        const p = player || this.state.player;
        if (window.AttackFx && p) return window.AttackFx.reachForMonster(monster, p.r);
        return monster.r + (p ? p.r : 16) + 10;
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
                m.x = MathUtils.clamp(p.x + Math.cos(angle) * 160, this._minX(m.r), this._maxX(m.r));
                m.y = MathUtils.clamp(p.y + Math.sin(angle) * 160, this._minY(m.r), this._maxY(m.r));
                this._pushActor(m, 0, 0);
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

            const desired = m.ranged && m.keepDistance ? m.shootRange * 0.6 : this._monsterMeleeRange(m, p);
            const dungeonMonsterSpeed = (this.state.dungeonMods && this.state.dungeonMods.monsterSpeed) || 1;
            if (dist > desired) {
                const moveSpeed = m.speed * 60 * dungeonMonsterSpeed;
                this._moveActor(m, dx / dist * moveSpeed * dt, dy / dist * moveSpeed * dt, true);
                m.facing = Math.atan2(dy, dx);
            } else if (m.keepDistance && dist < desired * 0.55) {
                const moveSpeed = m.speed * 60 * dungeonMonsterSpeed;
                this._moveActor(m, -dx / dist * moveSpeed * dt, -dy / dist * moveSpeed * dt, true);
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
        const style = window.AttackFx ? window.AttackFx.styleFor(monster) : null;
        const color = (style && style.c2) || monster.projectileColor || '#ffb86b';
        this.state.bullets.push({
            x: monster.x,
            y: monster.y,
            vx: Math.cos(angle) * 170,
            vy: Math.sin(angle) * 170,
            r: 6,
            dmg: Math.max(1, Math.round(monster.atk * damageScale)),
            color,
            // 弹体也按实体区分：骷髅是骨箭、寒魄是冰棱、其余是妖气弹
            fx: window.AttackFx ? window.AttackFx.keyFor(monster) : null,
            proj: style ? style.proj : 'orb',
            pal: style ? [style.c1, style.c2, style.c3] : null,
            hostile: true,
            life: 3
        });
        this.state.effects.push({ type: 'boom', x: monster.x, y: monster.y, color, t: 0, life: 0.2 });
    }

    _bossBurst(monster) {
        const count = 8;
        const style = window.AttackFx ? window.AttackFx.styleFor(monster) : null;
        const color = (style && style.c2) || this.state.bossElement || '#ff6b6b';
        for (let i = 0; i < count; i++) {
            const angle = i * Math.PI * 2 / count + Math.random() * 0.2;
            this.state.bullets.push({
                x: monster.x,
                y: monster.y,
                vx: Math.cos(angle) * 125,
                vy: Math.sin(angle) * 125,
                r: 7,
                dmg: Math.max(1, Math.round(monster.atk * 0.65)),
                color,
                fx: window.AttackFx ? window.AttackFx.keyFor(monster) : null,
                proj: style ? style.proj : 'ember',
                pal: style ? [style.c1, style.c2, style.c3] : null,
                hostile: true,
                life: 3.5
            });
        }
    }

    _monsterAttack(monster, player) {
        if (window.audioManager) window.audioManager.hurt();
        const dmg = monster.atk;
        monster.facing = Math.atan2(player.y - monster.y, player.x - monster.x);
        // 每种怪一套独立攻击特效；攻击距离由体型 + 样式形状决定（AI 出手距离也用同一个）
        const style = window.AttackFx ? window.AttackFx.styleFor(monster) : null;
        const reach = window.AttackFx
            ? window.AttackFx.reachForMonster(monster, player.r)
            : monster.r + player.r + 12;
        const arcHalf = style ? style.arc : 1.1;
        const innerR = Math.max(4, reach * (style ? style.inner : 0.2));
        const effect = window.AttackFx
            ? window.AttackFx.makeEffect({
                fx: window.AttackFx.keyFor(monster),
                x: monster.x, y: monster.y, angle: monster.facing,
                reach, arcHalf, innerR,
                shape: style && style.shape,
                width: style && style.width,
                lanes: style && style.lanes,
                laneGap: style && style.laneGap,
                laneSpread: style && style.laneSpread,
                laneHalf: style && style.laneHalf,
                life: style && style.life,
                monster: true
            })
            : {
                type: 'slash', x: monster.x, y: monster.y, a: monster.facing,
                r: reach, arcHalf, innerR: innerR, color: '#ff6b6b', t: 0, life: 0.22
            };
        this.state.effects.push(effect);

        // 判定与特效同源：必须落在同一块形状里才会掉血
        const hit = !window.AttackFx || window.AttackFx.inSector(effect, player.x, player.y, player.r);
        if (!hit) return;

        this.hurtPlayer(dmg);
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
        let pool = dungeon && dungeon.floorPool
            ? dungeon.floorPool.flat().filter(id => window.MONSTERS[id] && !window.MONSTERS[id].human)
            : ['wolf'];
        if (!pool.length) pool = ['wolf'];
        const id = pool[Math.floor(Math.random() * pool.length)] || 'wolf';
        const base = window.MONSTERS[id];
        if (!base) return;
        const hpMul = (dungeon ? dungeon.hpScale : 1) * (1 + (this.state.floor - 1) * 0.2);
        const atkMul = (dungeon ? dungeon.atkScale : 1) * (1 + (this.state.floor - 1) * 0.12);
        const minion = {
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
        };
        // 召唤在妖仆与主人重叠的位置，先推出障碍物避免出生就卡在墙里
        this._pushActor(minion, 0, 0);
        this.state.monsters.push(minion);
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
                    b.x < this.constants.PAD || b.x > this._maxX(0) ||
                    b.y < this.constants.PAD || b.y > this._maxY(0)) {
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
        // 玩家挥剑的命中范围 = AttackFx 画出来的那块形状（扇形/突刺/环形…全部同源）。
        // 不要退回全圆，也不要另外写死 1.1rad：刀光扫到哪，伤害就落在哪。
        const shape = {
            x: bullet.x,
            y: bullet.y,
            a: bullet.angle !== undefined ? bullet.angle : 0,
            r: bullet.range,
            arcHalf: Number.isFinite(bullet.arcHalf) ? bullet.arcHalf : 1.1,
            innerR: Number.isFinite(bullet.innerR) ? bullet.innerR : 0,
            fx: bullet.fx,
            shape: bullet.shape,
            width: bullet.width,
            lanes: bullet.lanes,
            laneGap: bullet.laneGap,
            laneSpread: bullet.laneSpread,
            laneHalf: bullet.laneHalf
        };
        for (const m of this.state.monsters) {
            if (m.hp <= 0) continue;
            if (!this._strikeHits(shape, m.x, m.y, m.r)) continue;
            this.damageMonster(m, bullet);
        }
    }

    /** 扇形命中（无 AttackFx 时回退到同样的几何，避免两套判定漂移） */
    _strikeHits(shape, tx, ty, radius) {
        if (window.AttackFx) return window.AttackFx.inSector(shape, tx, ty, radius);
        const dx = tx - shape.x;
        const dy = ty - shape.y;
        const dist = Math.hypot(dx, dy);
        if (dist > shape.r + radius || dist < shape.innerR - radius) return false;
        const diff = Math.abs(MathUtils.angleDiff(Math.atan2(dy, dx), shape.a));
        return diff <= shape.arcHalf;
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
            // 击退走移动而不是瞬移：薄墙前会停在墙面，不会被推穿
            this._moveActor(monster, Math.cos(angle) * bullet.knockback, Math.sin(angle) * bullet.knockback);
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
                    this._moveActor(p, Math.cos(angle) * pullDist, Math.sin(angle) * pullDist);
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
                    this._moveActor(p, Math.cos(angle) * trap.knockback, Math.sin(angle) * trap.knockback);
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
                    this._moveActor(m, Math.cos(angle) * trap.knockback * 0.8, Math.sin(angle) * trap.knockback * 0.8);
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
        const stones = 8 + this.state.floor * 3;
        if (typeof window.addSpiritStones === 'function') {
            window.addSpiritStones(stones);
            window.floatText(chest.x, chest.y - 34, '💎 灵石+' + stones, '#8ef2e7');
        }
        if (typeof window.addItem === 'function' && Math.random() < 0.55) {
            const pool = ['herb_ling', 'ore_iron', 'meat_beast'];
            if (this.state.dungeonId === 'ember') pool.push('crystal_fire');
            if (this.state.dungeonId === 'frost') pool.push('crystal_ice');
            const itemId = pool[Math.floor(Math.random() * pool.length)];
            const def = window.getItemDef(itemId);
            if (def) {
                window.addItem(itemId, 1);
                window.floatText(chest.x, chest.y - 18, (def.emoji || '🎁') + ' ' + def.name, '#ffe27a');
            }
        }
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
        const interactBtn = document.getElementById('interactBtn');
        if (!floorNpc || floorNpc.used || !p) {
            // NPC 已被使用或已消失时清理交互引用，避免按 E 再次触发已结束的遭遇
            this.state.nearbyDungeonNpc = null;
            if (interactBtn) interactBtn.classList.remove('visible');
            return;
        }

        const dist = Math.hypot(p.x - floorNpc.x, p.y - floorNpc.y);
        if (dist < 80) {
            // 记录可交互的NPC，供tryInteractDungeonWorld使用
            this.state.nearbyDungeonNpc = floorNpc;
        } else {
            this.state.nearbyDungeonNpc = null;
        }

        if (interactBtn) {
            if (this.state.nearbyDungeonNpc) {
                interactBtn.innerHTML = '💬 与 ' + (floorNpc.npc.name || '神秘人') + ' 交谈 <small>E</small>';
                interactBtn.classList.add('visible');
            } else {
                interactBtn.classList.remove('visible');
            }
        }
    }

    /**
     * 秘境世界模式下的交互处理（按E键触发）
     */
    tryInteractDungeonWorld() {
        // 优先处理NPC交互
        const npc = this.state.nearbyDungeonNpc;
        if (!npc || npc.used || npc !== this.state.floorNpc || !npc.npc ||
            typeof window.onDungeonNpcNearby !== 'function') {
            return false;
        }
        npc.used = true;
        try {
            window.onDungeonNpcNearby(npc.npc);
        } catch (err) {
            // 对话失败时恢复可交互状态，避免 NPC 被永久消耗
            npc.used = false;
            console.error('秘境 NPC 对话失败:', err);
            return false;
        }
        return true;
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
                    this._moveActor(p, Math.cos(angle) * kb, Math.sin(angle) * kb);
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
        const talentReduce = (window.G.flags && window.G.flags.damageReduce) || 0;
        let actualDmg = Math.max(1, Math.round(damage * dungeonTaken * (1 - talentReduce)));

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
        if (monster.human) window.G.flags.humanKills = (window.G.flags.humanKills || 0) + 1;
        window.checkAchievements();
        if (this.state.dungeonWorldMode) {
            this.state.floorKills = (this.state.floorKills || 0) + 1;
            if (monster.boss) this.state.floorBossKilled = true;
            this._checkDungeonExitUnlock();
        }
        // 击杀奖励修为；人形敌手额外给更多战利品
        const cultReward = Math.max(1, Math.round((monster.cult || 5) * (1 + this.state.floor * 0.08)));
        if (typeof window.gainCultivation === 'function') window.gainCultivation(cultReward);
        else window.G.cultivation += cultReward;
        if (typeof window.floatText === 'function') {
            window.floatText(monster.x, monster.y - monster.r - 8,
                '🌀+' + cultReward + (monster.human ? ' 人形敌手' : ''), monster.human ? '#ffb3c0' : '#8ef2e7');
        }
        this._dropLoot(monster);

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

    _dropLoot(monster) {
        const isBoss = !!monster.boss;
        const luck = (window.G.flags && window.G.flags.luck) || 0;
        const stoneBase = isBoss ? 25 + this.state.floor * 5 : 1 + Math.floor(Math.random() * 3);
        const stones = Math.max(1, Math.round((stoneBase + (monster.human ? 3 : 0)) * (1 + luck)));
        if (typeof window.addSpiritStones === 'function') window.addSpiritStones(stones);
        if (isBoss && typeof window.addSectContribution === 'function') {
            window.addSectContribution((window.SECT && window.SECT.contributionPerBoss) || 25);
        }
        if (typeof window.addItem !== 'function') return;

        const pool = ['herb_ling', 'meat_beast', 'ore_iron'];
        if (this.state.dungeonId === 'ember' || this.state.dungeonId === 'qingyun') pool.push('crystal_fire');
        if (this.state.dungeonId === 'frost' || this.state.dungeonId === 'nether') pool.push('crystal_ice');
        if (isBoss) pool.push('jade_slip', 'sect_token');

        const dropChance = (isBoss ? 1 : 0.18) + (monster.human ? 0.16 : 0) + luck * 0.12;
        if (isBoss || Math.random() < dropChance) {
            const itemId = isBoss
                ? (Math.random() < 0.5 ? 'jade_slip' : 'sect_token')
                : pool[Math.floor(Math.random() * pool.length)];
            const def = window.getItemDef(itemId);
            if (def && window.addItem(itemId, 1)) {
                window.floatText(monster.x, monster.y - monster.r - 18,
                    (def.emoji || '🎁') + ' ' + def.name, '#ffe27a');
            }
        }
        if (isBoss) {
            window.floatText(monster.x, monster.y - monster.r - 34, '💎 灵石+' + stones, '#8ef2e7');
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

    // ============ 秘境世界模式专用方法 ============

    /**
     * 更新视野/迷雾系统
     * 玩家和怪物都有有限视野，未探索区域显示迷雾
     */
    _updateVisionSystem(dt) {
        const world = this.state.dungeonWorld;
        if (!world) return;

        const p = this.state.player;
        const visionRange = this.state.playerVision || 280;
        const visionSq = visionRange * visionRange;

        // 初始化探索集合
        if (!this.state.explored) this.state.explored = new Set();

        // 以网格为单位标记探索区域（每16像素一个格子）
        const gridSize = 16;
        const gx = Math.floor(p.x / gridSize);
        const gy = Math.floor(p.y / gridSize);
        const visionGrid = Math.ceil(visionRange / gridSize);

        for (let dx = -visionGrid; dx <= visionGrid; dx++) {
            for (let dy = -visionGrid; dy <= visionGrid; dy++) {
                const distSq = dx * dx + dy * dy;
                if (distSq <= visionGrid * visionGrid) {
                    const key = (gx + dx) + ',' + (gy + dy);
                    this.state.explored.add(key);
                }
            }
        }

        // 怪物视野：如果怪物在玩家视野内，玩家能看到怪物
        // 怪物也有自己的视野，用于追踪玩家
        for (const m of this.state.monsters) {
            if (m.hp <= 0) continue;
            const dx = m.x - p.x;
            const dy = m.y - p.y;
            const distSq = dx * dx + dy * dy;
            const monsterVision = m.vision || 200;
            m.inPlayerVision = distSq <= visionSq;
            m.canSeePlayer = distSq <= monsterVision * monsterVision;

            // 记录最后看到玩家的位置
            if (m.canSeePlayer) {
                m.lastSeenPlayer = { x: p.x, y: p.y, time: this.state.time };
            }
        }
    }

    /**
     * 秘境世界模式下的怪物AI更新
     * 怪物有限视野，只有看到玩家才会追击
     */
    _updateMonstersDungeonWorld(dt) {
        const p = this.state.player;
        const world = this.state.dungeonWorld;
        if (!world || !p) return;

        for (const m of this.state.monsters) {
            if (m.hp <= 0) continue;

            // 状态机：wander(游荡) -> chase(追击) -> attack(攻击) -> return(返回)
            const dx = p.x - m.x;
            const dy = p.y - m.y;
            const dist = Math.hypot(dx, dy) || 1;
            const monsterVision = m.vision || 200;
            // 出手距离 = 攻击特效半径（每种怪不同：爪击贴身、骨矛长刺、Boss 巨口……）
            const meleeRange = this._monsterMeleeRange(m, p);

            // 更新定时器
            if (m.atkCd > 0) m.atkCd -= dt;
            if (m.stunCd > 0) m.stunCd -= dt;
            if (m.shootTimer > 0) m.shootTimer -= dt;
            if (m.teleportCd > 0) m.teleportCd -= dt;
            if (m.summonTimer > 0) m.summonTimer -= dt;

            // 眩晕状态
            if (m.stunCd > 0) continue;

            // 根据状态执行行为
            switch (m.state) {
                case 'wander': {
                    // 在出生点附近随机游荡
                    if (!m.wanderTimer || m.wanderTimer <= 0) {
                        m.wanderTimer = 2 + Math.random() * 4;
                        const angle = Math.random() * Math.PI * 2;
                        const range = 80 + Math.random() * 120;
                        m.wanderTarget = {
                            x: MathUtils.clamp(m.homeX + Math.cos(angle) * range, 60, world.width - 60),
                            y: MathUtils.clamp(m.homeY + Math.sin(angle) * range, 60, world.height - 60)
                        };
                    }
                    m.wanderTimer -= dt;

                    const wdx = m.wanderTarget.x - m.x;
                    const wdy = m.wanderTarget.y - m.y;
                    const wdist = Math.hypot(wdx, wdy) || 1;
                    if (wdist > 10) {
                        this._moveActor(m, (wdx / wdist) * m.speed * 40 * dt, (wdy / wdist) * m.speed * 40 * dt, true);
                        m.facing = Math.atan2(wdy, wdx);
                    }

                    // 发现玩家 -> 切换追击
                    if (m.canSeePlayer) {
                        m.state = 'chase';
                        m.target = { x: p.x, y: p.y };
                    }
                    break;
                }

                case 'chase': {
                    // 追击玩家
                    if (dist > meleeRange) {
                        // 远距离：移动向玩家（被地标挡住时绕行）
                        this._moveActor(m, (dx / dist) * m.speed * 50 * dt, (dy / dist) * m.speed * 50 * dt, true);
                        m.facing = Math.atan2(dy, dx);
                    } else {
                        // 接近玩家：进入攻击状态
                        m.state = 'attack';
                        m.facing = Math.atan2(dy, dx);
                    }

                    // 失去视野 -> 尝试走向最后看到的位置
                    if (!m.canSeePlayer && m.lastSeenPlayer) {
                        const ldx = m.lastSeenPlayer.x - m.x;
                        const ldy = m.lastSeenPlayer.y - m.y;
                        const ldist = Math.hypot(ldx, ldy) || 1;
                        if (ldist > 20) {
                            this._moveActor(m, (ldx / ldist) * m.speed * 40 * dt, (ldy / ldist) * m.speed * 40 * dt, true);
                        } else {
                            // 到达最后位置仍未找到 -> 返回游荡
                            m.state = 'return';
                        }
                    }

                    // 远程攻击逻辑
                    if (m.ranged && m.shootTimer <= 0 && dist <= (m.shootRange || 250)) {
                        this._monsterShoot(m, p);
                        m.shootTimer = m.shootCd || 2.5;
                    }
                    break;
                }

                case 'attack': {
                    m.facing = Math.atan2(dy, dx);
                    // 近战攻击：在攻击距离内才出手；略微超出就继续贴脸，
                    // 不能像旧逻辑那样站在攻击距离外原地不动（玩家不动时永远打不到）。
                    if (dist <= meleeRange) {
                        if (m.atkCd <= 0) {
                            this._monsterAttack(m, p);
                            m.atkCd = 1.2 / (m.speed || 1);
                        }
                    } else {
                        this._moveActor(m, (dx / dist) * m.speed * 45 * dt, (dy / dist) * m.speed * 45 * dt, true);
                    }

                    // 如果玩家跑远了 -> 回到追击
                    if (dist > meleeRange + 30) {
                        m.state = 'chase';
                    }
                    break;
                }

                case 'return': {
                    // 返回出生点
                    const rdx = m.homeX - m.x;
                    const rdy = m.homeY - m.y;
                    const rdist = Math.hypot(rdx, rdy) || 1;
                    if (rdist > 20) {
                        this._moveActor(m, (rdx / rdist) * m.speed * 40 * dt, (rdy / rdist) * m.speed * 40 * dt, true);
                        m.facing = Math.atan2(rdy, rdx);
                    } else {
                        m.state = 'wander';
                        m.wanderTimer = 0;
                    }
                    break;
                }
            }

            // 特殊能力
            if (m.charge && m.state === 'chase' && dist > 200 && dist < 400 && m.atkCd <= 0) {
                // 冲锋攻击
                m.chargeVx = (dx / dist) * 300;
                m.chargeVy = (dy / dist) * 300;
                m.chargeTime = 0.5;
                m.atkCd = 2.0;
            }

            if (m.blink && m.state === 'chase' && dist > 150 && m.atkCd <= 0 && Math.random() < 0.01) {
                // 闪现到玩家身后
                const angle = Math.atan2(dy, dx) + Math.PI;
                m.x = MathUtils.clamp(p.x + Math.cos(angle) * 50, this._minX(m.r), this._maxX(m.r));
                m.y = MathUtils.clamp(p.y + Math.sin(angle) * 50, this._minY(m.r), this._maxY(m.r));
                // 闪现落点可能在墙里：推出来，别让怪物卡在障碍物中
                this._pushActor(m, 0, 0);
                m.atkCd = 3.0;
                this.state.effects.push({ type: 'blink', x: m.x, y: m.y, t: 0, life: 0.3 });
            }

            if (m.healer && m.shootTimer <= 0) {
                // 治疗周围怪物
                for (const other of this.state.monsters) {
                    if (other.hp > 0 && other !== m && other.hp < other.maxHp) {
                        const hdist = Math.hypot(other.x - m.x, other.y - m.y);
                        if (hdist < 200) {
                            other.hp = Math.min(other.maxHp, other.hp + other.maxHp * 0.15);
                            this.state.effects.push({ type: 'heal', x: other.x, y: other.y, t: 0, life: 0.5 });
                        }
                    }
                }
                m.shootTimer = m.shootCd || 4.0;
            }
        }
    }

    getDungeonHint() {
        if (this.state.duel) {
            if (this.state.floorExitUnlocked) return '⚔️ 对手已败，正在收场';
            const name = this.state.duelNpc ? this.state.duelNpc.name : '对手';
            return '⚔️ 一对一决斗：击败 ' + name + '（血量归零即胜，无需前往出口）';
        }
        if (this.state.floorExitUnlocked) {
            return '🏁 出口已开启：靠近出口进入下一层 · 靠近 NPC 按 E 交谈';
        }
        const need = Math.max(0, (this.state.floorKillTarget || 0) - (this.state.floorKills || 0));
        const parts = [];
        if (this.state.floorHasBoss && !this.state.floorBossKilled) parts.push('击败首领');
        if (need > 0) parts.push('还需击败 ' + need + ' 名敌手');
        return '🔒 出口封印：' + (parts.join(' · ') || '清剿剩余敌手') + ' · 靠近 NPC 按 E 交谈';
    }

    _checkDungeonExitUnlock() {
        if (!this.state.dungeonWorldMode || this.state.floorExitUnlocked) return;
        const target = this.state.floorKillTarget || 0;
        const enough = (this.state.floorKills || 0) >= target;
        const bossDone = !this.state.floorHasBoss || this.state.floorBossKilled;
        if (!enough || !bossDone) return;
        this.state.floorExitUnlocked = true;
        if (this.state.duel) {
            this.state.duelClearTimer = 1.1;
            window.toast('⚔️ 对手已败，收剑。', 'gold');
        } else {
            window.toast('🏁 妖气消散，秘境出口开启', 'gold');
        }
        if (this.state.dungeonWorld && this.state.dungeonWorld.exit) {
            this.state.effects.push({
                type: 'boom', x: this.state.dungeonWorld.exit.x, y: this.state.dungeonWorld.exit.y,
                color: '#7df9ff', t: 0, life: 0.8
            });
        }
    }

    /**
     * 检查是否到达秘境出口
     */
    _checkDungeonWorldExit() {
        const p = this.state.player;
        const world = this.state.dungeonWorld;
        if (!p || !world || !world.exit) return;

        const dx = p.x - world.exit.x;
        const dy = p.y - world.exit.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 60) {
            if (!this.state.floorExitUnlocked) {
                if (this.state.time - (this.state.exitLockToastAt || 0) > 2.5) {
                    const need = Math.max(0, (this.state.floorKillTarget || 0) - (this.state.floorKills || 0));
                    let message = '🔒 出口被妖气封印';
                    if (need > 0) message += '：还需击败 ' + need + ' 名敌手';
                    if (this.state.floorHasBoss && !this.state.floorBossKilled) {
                        message += (need > 0 ? ' · ' : '：') + '首领未伏诛';
                    }
                    window.toast(message, 'bad');
                    this.state.exitLockToastAt = this.state.time;
                }
                return;
            }
            // 到达出口，进入下一层；立即结算，避免把 pendingFloorClear 留给后续 NPC 对话误触发
            this.state.pendingFloorClear = null;
            if (typeof window.onDungeonFloorClear === 'function') {
                window.onDungeonFloorClear(this.state.floor);
            }
        }
    }
}

window.CombatSystem = CombatSystem;