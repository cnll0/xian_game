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
        
        // ???MapGeneratorWorker (??????)
        this.mapGeneratorWorker = new window.MapGeneratorWorker();
        try {
            await this.mapGeneratorWorker.init();
            console.log('[Engine] MapGeneratorWorker ?????');
        } catch (err) {
            console.warn('[Engine] MapGeneratorWorker ????????????:', err);
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

        window.Engine = this;
    }

    async _loadAssets() {
        const list = {
            player: 'assets/player/player_south.png',
            player_north: 'assets/player/player_north.png',
            player_south: 'assets/player/player_south.png',
            player_west: 'assets/player/player_west.png',
            player_northwest: 'assets/player/player_northwest.png',
            player_southwest: 'assets/player/player_southwest.png',
            npcSprites: 'assets/npc-sprites.svg',
            wolf: 'assets/wolf.png',
            brute: 'assets/brute.png',
            boss: 'assets/boss.png',
            spider: 'assets/spider.png',
            skeleton: 'assets/skeleton.png',
            bat: 'assets/bat.png',
            elite: 'assets/elite.png',
            chest: 'assets/chest.png',
            portal: 'assets/portal.png',
            pill: 'assets/pill.png',
            sword: 'assets/sword.png',
            floor: 'assets/floor.jpg'
        };

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
        this.renderer.addLayer('floor', window.FloorRenderer.render, 0);
        this.renderer.addLayer('scenery', window.SceneryRenderer.render, 10);
        this.renderer.addLayer('entities', window.EntityRenderer.render, 20);
        this.renderer.addLayer('effects', window.EffectRenderer.render, 30);
        this.renderer.addLayer('traps', window.TrapRenderer.render, 40);
        this.renderer.addLayer('ui', window.UIRenderer.render, 100);
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
        this.combatSystem.startRun(startFloor, storyDungeon, dungeonId, skirmish);
    }

    _startWorld(resetPosition) {
        this.worldSystem.startWorld(resetPosition);
    }

    _startDungeonWorld(dungeonId) {
        return this.worldSystem.startDungeonWorld(dungeonId);
    }

    _returnToOverworld() {
        this.worldSystem.returnToOverworld();
    }

    _interactStory() {
        return this.worldSystem.tryInteract();
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
        if (this.gameState.runtime.state !== 'world' &&
            this.gameState.runtime.state !== 'playing' &&
            this.gameState.runtime.state !== 'clear') return;
        this.gameState.runtime.npcPausedState = this.gameState.runtime.state;
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
            window.onFloorClear(floor);
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
            result = '???? ' + restored;
            if (effect.type === 'healCult') {
                window.gainCultivation(effect.cult);
                result += '???+' + effect.cult;
            }
        } else if (effect.type === 'attack') {
            player.mods.atk += effect.amount;
            result = '??????+' + effect.amount;
            this.gameState.runtime.effects.push({ type: 'evolution', x: player.x, y: player.y, color: '#ffd76a', t: 0, life: 0.8 });
        } else if (effect.type === 'shield') {
            let amount = Math.round(player.maxHp * effect.amount);
            player.mods.shield = Math.max(1, player.mods.shield || 0);
            player.shieldMax = Math.max(player.shieldMax || 0, amount);
            player.shield = Math.min(player.maxHp, (player.shield || 0) + amount);
            result = '???? ' + amount;
            this.gameState.runtime.effects.push({ type: 'element', element: 'shield', x: player.x, y: player.y, t: 0, life: 0.65 });
        } else if (effect.type === 'cult') {
            window.gainCultivation(effect.amount);
            result = '??+' + effect.amount;
        } else if (effect.type === 'speed') {
            player.mods.speed += effect.amount;
            result = '??????+' + effect.amount;
        } else if (effect.type === 'bloodPrice') {
            let cost = Math.min(Math.max(0, player.hp - 1), Math.ceil(player.hp * effect.hp));
            player.hp -= cost;
            player.mods.atk += effect.attack;
            result = '???? ' + cost + '???????+' + effect.attack;
        } else if (effect.type === 'riskCult') {
            window.gainCultivation(effect.amount);
            this.combatSystem._applyMonsterModifier('atkMul', 1.2);
            for (let monster of this.gameState.runtime.monsters) monster.atk = Math.ceil(monster.atk * 1.2);
            result = '??+' + effect.amount + '???????20%????????';
        } else {
            throw new Error('Unknown dungeon NPC effect: ' + effect.type);
        }
        if (typeof choice.favor === 'number') {
            if (!window.G.npcRelations) window.G.npcRelations = {};
            window.G.npcRelations[encounter.npc.id] = MathUtils.clamp(
                (window.G.npcRelations[encounter.npc.id] || 0) + choice.favor, -100, 100);
        }
        window.floatText(player.x, player.y - 40, result, '#ffe27a');
        window.toast(encounter.npc.name + ' · ' + result, 'gold');
        this.gameState.runtime.floorNpc = null;
        window.updateHUD();
        window.saveGame(false);
        return result;
    }

    _drawNpcPortrait(npcId, canvas) {
        const ctx = canvas.getContext('2d');
        const img = this.gameState.runtime.assets.images.npcSprites;
        if (!img) return false;

        const npcPortraits = {
            ningxiao: { x: 0, y: 0 },
            linyue: { x: 96, y: 0 },
            shenli: { x: 192, y: 0 },
            guqinghan: { x: 288, y: 0 },
            mochen: { x: 384, y: 0 }
        };

        const pos = npcPortraits[npcId];
        if (!pos) return false;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, pos.x, pos.y, 96, 96, 0, 0, 96, 96);
        return true;
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
            window.floatText(window.G.player?.x || 480, window.G.player?.y || 270 - 45, '? ??·' + branch.name, '#ffe27a');
            this.gameState.runtime.effects.push({ type: 'evolution', x: 480, y: 270, color: card.type === 'monster' ? '#ff687d' : '#ffd76a', t: 0, life: 0.8 });
        }

        if (card.type === 'cursed') {
            window.toast('?? ??·' + window.CARD_CURSE_TIER_LABELS[card.curseTier] + '?' + card.name +
                (evolutionName ? ' ????' + evolutionName + '?' : ' · ' + this._cardRankLabel(rank + 1)) +
                (curseGiftLine ? '??????' + curseGiftLine : '') +
                (curseUpgradeLines.length ? '??????' + curseUpgradeLines.join('?') : ''), 'bad');
        } else if (evolutionName) {
            window.toast('? ' + card.name + ' ????' + evolutionName + '?', 'gold');
        } else {
            window.toast('? ' + card.name + ' · ' + this._cardRankLabel(rank + 1), 'good');
        }

        window.updateHUD();
        window.saveGame(false);
        return lines;
    }

    _formatEffectLine(key, value) {
        const label = { atk: '??', maxHp: '????', speed: '??', range: '????', crit: '???', lifesteal: '??', hp: '????', cult: '??' }[key] || key;
        return label + (value > 0 ? '+' : '') + value;
    }

    _cardRankLabel(rank) {
        return rank === 1 ? '??' : rank === 2 ? '?? 2/3' : '?? 3/3';
    }

    _applyCurseGift(card) {
        if (!card.curseGift) throw new Error('Missing unique curse gift: ' + card.id);
        for (const key in card.curseGift) {
            const value = card.curseGift[key];
            if (typeof value === 'boolean') window.G[key] = value;
            else window.G[key] = (window.G[key] || 0) + value;
        }
        if (card.curseGift.curseSoulHarvest) return '?????????' + Math.round(card.curseGift.curseSoulHarvest * 100) + '%';
        if (card.curseGift.curseFrenzy) return '???????' + Math.round(card.curseGift.curseFrenzy * 100) + '%???3.5?';
        if (card.curseGift.curseLastStand) {
            const survival = 30 + Math.round((window.G.curseLastStandHp || 0) * 100);
            return '???????????' + survival + '%????';
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
            attackPressed: this.inputManager.consumeAttack(),
            interactPressed: this.inputManager.consumeInteract()
        };
        window.gameInput = input;

        if (this.gameState.runtime.running) {
            if (this.gameState.runtime.state === 'world') {
                this.worldSystem.update(dt, input);
            } else {
                this.combatSystem.update(dt);
            }
        }

        this.renderer.render(this.gameState, input);
    }

    start() {
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