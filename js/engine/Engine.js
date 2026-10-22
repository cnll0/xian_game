'use strict';

class Engine {
    constructor() {
        if (Engine.instance) {
            return Engine.instance;
        }
        Engine.instance = this;

        this.canvas = null;
        this.ctx = null;
        this.raf = 0;
        this.lastTs = 0;

        this.gameState = window.gameState;
        this.eventBus = window.eventBus;

        this.assetLoader = new window.AssetLoader();
        this.inputManager = null;
        this.mapGenerator = new window.MapGenerator();
        this.worldSystem = null;
        this.combatSystem = null;
        this.cardSystem = null;
        this.npcManager = null;
        this.renderer = null;

        this.pools = {
            bullet: new window.ObjectPool(
                () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, color: '#fff', shouldRemove: false }),
                (b) => { b.x = b.y = b.vx = b.vy = 0; b.r = 0; b.dmg = 0; b.color = '#fff'; b.shouldRemove = false; },
                100
            ),
            effect: new window.ObjectPool(
                () => ({ type: '', x: 0, y: 0, color: '#fff', t: 0, life: 0, element: '' }),
                (e) => { e.type = ''; e.x = e.y = 0; e.color = '#fff'; e.t = 0; e.life = 0; e.element = ''; },
                50
            ),
            text: new window.ObjectPool(
                () => ({ x: 0, y: 0, text: '', color: '#fff', t: 0, life: 0, vy: 0 }),
                (t) => { t.x = t.y = 0; t.text = ''; t.color = '#fff'; t.t = 0; t.life = 0; t.vy = 0; },
                30
            )
        };
    }

    static getInstance() {
        if (!Engine.instance) {
            Engine.instance = new Engine();
        }
        return Engine.instance;
    }

    static init(canvasEl) {
        return Engine.getInstance()._init(canvasEl);
    }

    static fitCanvas() {
        return Engine.getInstance()._fitCanvas();
    }

    static getState() {
        return Engine.getInstance()._getState();
    }

    static isRunning() {
        return Engine.getInstance()._isRunning();
    }

    static startRun(startFloor, storyDungeon, dungeonId, skirmish) {
        return Engine.getInstance()._startRun(startFloor, storyDungeon, dungeonId, skirmish);
    }

    static startWorld(resetPosition) {
        return Engine.getInstance()._startWorld(resetPosition);
    }

    static startDungeonWorld(dungeonId) {
        return Engine.getInstance()._startDungeonWorld(dungeonId);
    }

    static returnToOverworld() {
        return Engine.getInstance()._returnToOverworld();
    }

    static interactStory() {
        return Engine.getInstance()._interactStory();
    }

    static getStoryTarget() {
        return Engine.getInstance()._getStoryTarget();
    }

    static nextFloor() {
        return Engine.getInstance()._nextFloor();
    }

    static finishRun(cleared) {
        return Engine.getInstance()._finishRun(cleared);
    }

    static stopRun() {
        return Engine.getInstance()._stopRun();
    }

    static pauseForNpcDialog() {
        return Engine.getInstance()._pauseForNpcDialog();
    }

    static resumeFromNpcDialog() {
        return Engine.getInstance()._resumeFromNpcDialog();
    }

    static resolveDungeonNpcEncounter(choice) {
        return Engine.getInstance()._resolveDungeonNpcEncounter(choice);
    }

    static drawNpcPortrait(npcId, canvas) {
        return Engine.getInstance()._drawNpcPortrait(npcId, canvas);
    }

    static getRunCardRank(cardId) {
        return Engine.getInstance()._getRunCardRank(cardId);
    }

    static applyRunCard(card, branchId) {
        return Engine.getInstance()._applyRunCard(card, branchId);
    }

    async _init(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        canvasEl.width = this.gameState.constants.W;
        canvasEl.height = this.gameState.constants.H;
        this.ctx.imageSmoothingEnabled = false;

        await this._loadAssets();

        this.inputManager = new window.InputManager(this.canvas);
        
        // 初始化 MapGeneratorWorker（失败时回退同步生成）
        this.mapGeneratorWorker = new window.MapGeneratorWorker();
        try {
            await this.mapGeneratorWorker.init();
            console.log('[Engine] MapGeneratorWorker 初始化成功');
        } catch (err) {
            console.warn('[Engine] MapGeneratorWorker 初始化失败，回退同步生成:', err);
            this.mapGeneratorWorker = null;
        }

        this.worldSystem = new window.WorldSystem(this.gameState, this.mapGenerator, this.eventBus);
        this.combatSystem = new window.CombatSystem(this.gameState, this.mapGenerator, this.eventBus, this.pools, this.mapGeneratorWorker);
        this.cardSystem = new window.CardSystem(this.gameState, this.eventBus);
        this.npcManager = new window.NPCManager(this.eventBus);
        this.renderer = new window.Renderer(this.canvas);

        this._setupRenderLayers();

        window.addEventListener('resize', () => this._fitCanvas());
        this._fitCanvas();

        // 不要覆盖 window.Engine 类，main.js/story.js 仍通过静态 API 调用
        Engine.instance = this;
        window.mapGeneratorWorker = this.mapGeneratorWorker;
    }

    async _loadAssets() {
        const list = {
            player: 'assets/player/player_south.png',
            player_north: 'assets/player/player_north.png',
            player_south: 'assets/player/player_south.png',
            player_west: 'assets/player/player_west.png',
            player_east: 'assets/player/player_east.png',
            npcSprites: 'assets/npc-sprites.svg',
            wolf: 'assets/wolf.webp',
            brute: 'assets/brute.webp',
            boss: 'assets/boss.webp',
            spider: 'assets/spider.webp',
            skeleton: 'assets/skeleton.webp',
            bat: 'assets/bat.webp',
            elite: 'assets/elite.webp',
            chest: 'assets/chest.webp',
            portal: 'assets/portal.webp',
            pill: 'assets/pill.webp',
            sword: 'assets/sword.webp',
            floor: 'assets/floor.webp'
        };
        for (let i = 0; i < 8; i++) {
            list['slash_' + i] = 'assets/attack/slash_' + i + '.png';
            list['claw_' + i] = 'assets/attack/claw_' + i + '.png';
        }

        await this.assetLoader.loadImages(list);
        this.gameState.runtime.assets.images = Object.fromEntries(this.assetLoader.loadedAssets);

        if (this.gameState.runtime.assets.images.floor && this.ctx) {
            try {
                this.gameState.runtime.assets.floorPattern = this.ctx.createPattern(
                    this.gameState.runtime.assets.images.floor, 'repeat');
            } catch (e) { }
        }
    }

    _setupRenderLayers() {
        // 静态类方法必须绑定 this，否则层函数里的 this._drawXxx 是 undefined
        this.renderer.addLayer('floor', (ctx, gs, input, camera) => window.FloorRenderer.render(ctx, gs), 0);
        this.renderer.addLayer('scenery', (ctx, gs, input, camera) => window.SceneryRenderer.render(ctx, gs), 10);
        this.renderer.addLayer('entities', (ctx, gs, input, camera) => window.EntityRenderer.render(ctx, gs), 20);
        this.renderer.addLayer('effects', (ctx, gs, input, camera) => window.EffectRenderer.render(ctx, gs), 30);
        this.renderer.addLayer('traps', (ctx, gs, input, camera) => window.TrapRenderer.render(ctx, gs), 40);
        this.renderer.addLayer('ui', (ctx, gs, input, camera) => window.UIRenderer.render(ctx, gs), 100);
    }

    _fitCanvas() {
        const wrap = this.canvas.parentElement;
        if (!wrap) return;
        const aw = wrap.clientWidth, ah = wrap.clientHeight;
        const scale = Math.min(aw / this.gameState.constants.W, ah / this.gameState.constants.H);
        this.canvas.style.width = Math.floor(this.gameState.constants.W * scale) + 'px';
        this.canvas.style.height = Math.floor(this.gameState.constants.H * scale) + 'px';
    }

    _getState() {
        return this.gameState.runtime;
    }

    _isRunning() {
        return this.gameState.runtime.running;
    }

    _startRun(startFloor, storyDungeon, dungeonId, skirmish) {
        if (this.worldSystem) this.worldSystem.hideQuestTracker();
        this.combatSystem.startRun(startFloor, storyDungeon, dungeonId, skirmish);
        this.start();
    }

    _startWorld(resetPosition) {
        this.worldSystem.startWorld(resetPosition);
        this.start();
    }

    _startDungeonWorld(dungeonId) {
        const started = this.worldSystem.startDungeonWorld(dungeonId);
        if (started) this.start();
        return started;
    }

    _returnToOverworld() {
        this.worldSystem.returnToOverworld();
        this.start();
    }

    _interactStory() {
        return this.worldSystem.tryInteract();
    }

    _getStoryTarget() {
        return this.worldSystem ? this.worldSystem.getStoryTarget() : null;
    }

    _nextFloor() {
        this.combatSystem.nextFloor();
    }

    _finishRun(cleared) {
        this.combatSystem.finishRun(cleared);
    }

    _stopRun() {
        this.combatSystem.stopRun();
    }

    _pauseForNpcDialog() {
        const state = this.gameState.runtime.state;
        if (state !== 'world' &&
            state !== 'playing' &&
            state !== 'clear' &&
            state !== 'dungeon_world') return;
        this.gameState.runtime.npcPausedState = state;
        this.gameState.runtime.state = 'dialog';
    }

    _resumeFromNpcDialog() {
        if (this.gameState.runtime.state !== 'dialog') return;
        this.gameState.runtime.state = this.gameState.runtime.npcPausedState || 'world';
        this.gameState.runtime.npcPausedState = null;
        if (this.gameState.runtime.floorNpc) this.gameState.runtime.floorNpc = null;
        if (this.gameState.runtime.pendingFloorClear !== null) {
            const floor = this.gameState.runtime.pendingFloorClear;
            this.gameState.runtime.pendingFloorClear = null;
            if (this.gameState.runtime.floorNpc) this.gameState.runtime.floorNpc = null;
            if (typeof window.onDungeonFloorClear === 'function') window.onDungeonFloorClear(floor);
        }
    }

    _resolveDungeonNpcEncounter(choice) {
        const encounter = this.gameState.runtime.floorNpc;
        const player = this.gameState.runtime.player;
        if (!encounter || !encounter.used || !player || !choice || !choice.effect) {
            throw new Error('No active dungeon NPC encounter to resolve');
        }
        let effect = choice.effect;
        let result;
        if (effect.type === 'heal' || effect.type === 'healCult') {
            let amount = Math.round(player.maxHp * effect.amount);
            let restored = Math.min(amount, player.maxHp - player.hp);
            player.hp += restored;
            result = '恢复 +' + restored;
            if (effect.type === 'healCult') {
                window.gainCultivation(effect.cult);
                result += '，修为+' + effect.cult;
            }
        } else if (effect.type === 'attack') {
            player.mods.atk += effect.amount;
            result = '攻击提升 +' + effect.amount;
            this.gameState.runtime.effects.push({ type: 'evolution', x: player.x, y: player.y, color: '#ffd76a', t: 0, life: 0.8 });
        } else if (effect.type === 'shield') {
            let amount = Math.round(player.maxHp * effect.amount);
            player.mods.shield = Math.max(1, player.mods.shield || 0);
            player.shieldMax = Math.max(player.shieldMax || 0, amount);
            player.shield = Math.min(player.maxHp, (player.shield || 0) + amount);
            result = '护盾 +' + amount;
            this.gameState.runtime.effects.push({ type: 'element', element: 'shield', x: player.x, y: player.y, t: 0, life: 0.65 });
        } else if (effect.type === 'cult') {
            window.gainCultivation(effect.amount);
            result = '修为+' + effect.amount;
        } else if (effect.type === 'speed') {
            player.mods.speed += effect.amount;
            result = '速度提升 +' + effect.amount;
        } else if (effect.type === 'bloodPrice') {
            let cost = Math.min(Math.max(0, player.hp - 1), Math.ceil(player.hp * effect.hp));
            player.hp -= cost;
            player.mods.atk += effect.attack;
            result = '消耗生命 ' + cost + '，攻击提升 +' + effect.attack;
        } else if (effect.type === 'riskCult') {
            window.gainCultivation(effect.amount);
            this.combatSystem._applyMonsterModifier('atkMul', 1.2);
            for (let monster of this.gameState.runtime.monsters) monster.atk = Math.ceil(monster.atk * 1.2);
            result = '修为+' + effect.amount + '，但妖魔攻击提升20%';
        } else {
            throw new Error('Unknown dungeon NPC effect: ' + effect.type);
        }
        if (typeof choice.favor === 'number') {
            if (!window.G.npcRelations) window.G.npcRelations = {};
            window.G.npcRelations[encounter.npc.id] = MathUtils.clamp(
                (window.G.npcRelations[encounter.npc.id] || 0) + choice.favor, -100, 100);
        }
        window.floatText(player.x, player.y - 40, result, '#ffe27a');
        window.toast(encounter.npc.name + '：' + result, 'gold');
        this.gameState.runtime.floorNpc = null;
        window.updateHUD();
        window.saveGame(false);
        return result;
    }

    _drawNpcPortrait(npcId, canvas) {
        if (!canvas || typeof canvas.getContext !== 'function') return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const npcPortraits = {
            ningxiao: { x: 0, y: 0 },
            linyue: { x: 96, y: 0 },
            shenli: { x: 192, y: 0 },
            guqinghan: { x: 288, y: 0 },
            mochen: { x: 384, y: 0 },
            jichang: { x: 480, y: 0 },
            hanxing: { x: 576, y: 0 }
        };

        const img = this.gameState.runtime.assets.images.npcSprites;
        const pos = npcPortraits[npcId];

        // 图片未加载完成或未知 NPC：绘制占位符并返回 true，避免中断对话流程
        if (!img || !img.complete || !img.naturalWidth || !pos) {
            this._drawNpcPortraitPlaceholder(ctx, canvas, img ? '?' : '加载中...');
            return true;
        }

        try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;
            const size = Math.min(canvas.width, canvas.height);
            const dx = (canvas.width - size) / 2;
            const dy = (canvas.height - size) / 2;
            ctx.drawImage(img, pos.x, pos.y, 96, 96, dx, dy, size, size);
            return true;
        } catch (err) {
            console.warn('NPC 立绘绘制失败:', err);
            this._drawNpcPortraitPlaceholder(ctx, canvas, '?');
            return true;
        }
    }

    _drawNpcPortraitPlaceholder(ctx, canvas, text) {
        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = (text === '?' ? '24px' : '12px') + ' "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    _getRunCardRank(cardId) {
        return Math.max(
            this.gameState.runtime.cards.player[cardId] || 0,
            this.gameState.runtime.cards.monster[cardId] || 0,
            this.gameState.runtime.cards.run[cardId] || 0
        );
    }

    _applyRunCard(card, branchId) {
        const lines = [];
        const rank = this._getRunCardRank(card.id);

        if (card.type === 'cursed') window.G.flags.cursedPicks = (window.G.flags.cursedPicks || 0) + 1;

        if (card.type !== 'cursed' || rank === 0) {
            for (const k in card.effects) {
                const v = card.effects[k];
                if (typeof v === 'boolean') window.G[k] = v;
                else if (k === 'atk') window.G.atk += v;
                else if (k === 'maxHp') { window.G.maxHp += v; window.G.hp = Math.min(window.G.maxHp, window.G.hp + v); }
                else if (k === 'speed') window.G.speed = +(window.G.speed + v).toFixed(2);
                else if (k === 'range') window.G.range += v;
                else if (k === 'crit') window.G.crit = Math.min(80, window.G.crit + v);
                lines.push(this._formatEffectLine(k, v));
            }
        }

        if (card.type !== 'cursed' && rank > 0) {
            const bonus = window.CARD_DUPLICATE_BONUSES[card.id] || {};
            for (const k in bonus) {
                if (k === 'dashCd' || k === 'shieldCd') {
                    window.G[k] = Math.max(1, (window.G[k] || 3) + bonus[k]);
                } else {
                    window.G[k] = (window.G[k] || 0) + bonus[k];
                }
                lines.push(this._formatEffectLine(k, bonus[k]));
            }
        }

        let curseGiftLine = '';
        let curseUpgradeLines = [];
        if (card.type === 'cursed' && rank === 0 && card.curseGift) curseGiftLine = this._applyCurseGift(card);
        if (card.type === 'cursed' && rank === 1) curseUpgradeLines = this._applyCurseDuplicateBonus(card);

        this.gameState.runtime.cards.run[card.id] = Math.min(3, rank + 1);

        let evolutionName = '';
        if (rank >= 2) {
            const branch = window.getCardEvolutions(card).find(b => b.id === card.selectedBranch);
            if (!branch) throw new Error('Missing card evolution: ' + card.id);
            evolutionName = branch.name;
            if (card.type === 'cursed') {
                curseUpgradeLines = this._applyCurseEvolution(branch);
            } else {
                for (const k in branch.effects) {
                    const v = branch.effects[k];
                    if (typeof v === 'boolean') window.G[k] = v;
                    else if (k === 'dashCd' || k === 'shieldCd') {
                        window.G[k] = Math.max(1, (window.G[k] || 3) + v);
                    } else window.G[k] = (window.G[k] || 0) + v;
                    lines.push(this._formatEffectLine(k, v));
                }
            }
            window.floatText(480, 270 - 45, '✦ 进化 · ' + branch.name, '#ffe27a');
            this.gameState.runtime.effects.push({ type: 'evolution', x: 480, y: 270, color: card.type === 'monster' ? '#ff687d' : '#ffd76a', t: 0, life: 0.8 });
        }

        if (card.type === 'cursed') {
            window.toast('💀 诅咒·' + window.CARD_CURSE_TIER_LABELS[card.curseTier] + '：' + card.name +
                (evolutionName ? ' 进化为「' + evolutionName + '」' : ' · ' + this._cardRankLabel(rank + 1)) +
                (curseGiftLine ? '；特殊机缘：' + curseGiftLine : '') +
                (curseUpgradeLines.length ? '；进阶效果：' + curseUpgradeLines.join('、') : ''), 'bad');
        } else if (evolutionName) {
            window.toast('✦ ' + card.name + ' 进化为「' + evolutionName + '」', 'gold');
        } else {
            window.toast('✨ ' + card.name + ' · ' + this._cardRankLabel(rank + 1), 'good');
        }

        window.updateHUD();
        window.saveGame(false);
        return lines;
    }

    _formatEffectLine(key, value) {
        const label = { atk: '攻击', maxHp: '最大生命', speed: '速度', range: '范围', crit: '暴击', lifesteal: '吸血', hp: '当前生命', cult: '修为' }[key] || key;
        return label + (value > 0 ? '+' : '') + value;
    }

    _cardRankLabel(rank) {
        return rank === 1 ? '初获' : rank === 2 ? '进阶 2/3' : '进化 3/3';
    }

    _applyCurseGift(card) {
        if (!card.curseGift) throw new Error('Missing unique curse gift: ' + card.id);
        for (const key in card.curseGift) {
            const value = card.curseGift[key];
            if (typeof value === 'boolean') window.G[key] = value;
            else window.G[key] = (window.G[key] || 0) + value;
        }
        if (card.curseGift.curseSoulHarvest) return '击杀回复生命上限的' + Math.round(card.curseGift.curseSoulHarvest * 100) + '%';
        if (card.curseGift.curseFrenzy) return '击杀后攻击提升' + Math.round(card.curseGift.curseFrenzy * 100) + '%，持续3.5秒';
        if (card.curseGift.curseLastStand) {
            const survival = 30 + Math.round((window.G.curseLastStandHp || 0) * 100);
            return '每层首次受到致命伤时以' + survival + '%生命存活';
        }
        throw new Error('Unknown unique curse gift: ' + card.id);
    }

    _applyCurseDuplicateBonus(card) {
        const lines = [];
        if (card.curseUpgrade) {
            for (const k in card.curseUpgrade) {
                const v = card.curseUpgrade[k];
                if (typeof v === 'boolean') window.G[k] = v;
                else window.G[k] = (window.G[k] || 0) + v;
                lines.push(this._formatEffectLine(k, v));
            }
        }
        return lines;
    }

    _applyCurseEvolution(branch) {
        const lines = [];
        if (branch.curseUpgrade) {
            for (const k in branch.curseUpgrade) {
                const v = branch.curseUpgrade[k];
                if (typeof v === 'boolean') window.G[k] = v;
                else window.G[k] = (window.G[k] || 0) + v;
                lines.push(this._formatEffectLine(k, v));
            }
        }
        return lines;
    }

    loop(ts) {
        this.raf = requestAnimationFrame(this.loop.bind(this));
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
        this.lastTs = ts;

        const input = {
            movement: this.inputManager.getMovementVector(),
            mouse: this.inputManager.mouse,
            attackPressed: this.inputManager.consumeAttack(),
            interactPressed: this.inputManager.consumeInteract()
        };
        window.gameInput = input;

        const state = this.gameState.runtime.state;

        if (this.gameState.runtime.running) {
            if (state === 'world') {
                this.worldSystem.update(dt, input);
            } else if (state === 'playing' || state === 'clear') {
                this.combatSystem.update(dt);
            } else if (state === 'dungeon_world') {
                this.combatSystem.update(dt, input);
            }
            this._hudTimer = (this._hudTimer || 0) + dt;
            if (this._hudTimer >= 0.1) {
                this._hudTimer = 0;
                window.updateHUD();
            }
        }

        if (input.interactPressed && this.gameState.runtime.running) {
            if (state === 'world') {
                this.worldSystem.tryInteract();
            } else if (state === 'dungeon_world') {
                this.combatSystem.tryInteractDungeonWorld();
            }
        }

        const worldScene = state === 'world' ||
            (state === 'dialog' && this.gameState.runtime.npcPausedState === 'world');
        const dungeonWorldScene = state === 'dungeon_world' ||
            (state === 'dialog' && this.gameState.runtime.npcPausedState === 'dungeon_world');
        const worldHint = document.getElementById('worldHint');
        if (worldHint) {
            worldHint.style.display = (worldScene || dungeonWorldScene) ? 'block' : 'none';
            // 大地图的提示由 WorldSystem._updateWorldHint 按当前交互目标动态更新；
            // 这里只负责秘境固定提示，避免每帧覆盖剧情指引。
            if (dungeonWorldScene) {
                const hint = this.combatSystem
                    ? this.combatSystem.getDungeonHint()
                    : 'WASD / 方向键移动 · 靠近出口进入下一层 · 靠近 NPC 按 E 交谈';
                if (worldHint.textContent !== hint) worldHint.textContent = hint;
            }
        }

        if (state === 'loading') {
            this._drawLoadingScreen();
        } else if (worldScene) {
            window.WorldRenderer.render(this.ctx, this.gameState);
            window.UIRenderer.render(this.ctx, this.gameState);
        } else if (dungeonWorldScene) {
            window.DungeonWorldRenderer.render(this.ctx, this.gameState);
            window.UIRenderer.render(this.ctx, this.gameState);
        } else {
            this.renderer.render(this.gameState, input);
        }
    }

    /**
     * 绘制加载画面
     * @private
     */
    _drawLoadingScreen() {
        const ctx = this.ctx;
        const { W, H } = this.gameState.constants;

        // 背景
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        // 呼吸脉冲
        const time = this.gameState.runtime.time || 0;
        const pulse = 0.5 + Math.sin(time * 3) * 0.5;

        ctx.save();
        ctx.translate(W / 2, H / 2);

        // 外圈
        ctx.strokeStyle = `rgba(78, 205, 196, ${0.3 + pulse * 0.4})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 60 + pulse * 20, 0, Math.PI * 2);
        ctx.stroke();

        // 旋转内环
        ctx.strokeStyle = `rgba(255, 215, 100, ${0.4 + pulse * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 40 - pulse * 10, time * 2, time * 2 + Math.PI * 1.5);
        ctx.stroke();

        // 标题
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('修仙传说2D', 0, -60);

        // 进度提示
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#aaa';
        const dots = '.'.repeat(Math.floor(time * 2) % 4);
        ctx.fillText('正在生成秘境' + dots, 0, 0);

        // 副标题
        ctx.font = '12px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('正在铺开地图，请稍候', 0, 60);

        ctx.restore();
    }

    start() {
        if (this.raf) return;
        this.lastTs = 0;
        this.raf = requestAnimationFrame(this.loop.bind(this));
    }

    stop() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = 0;
        }
    }
}

Engine.instance = null;

window.Engine = Engine;