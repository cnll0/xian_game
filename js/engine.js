'use strict';

const Engine = (function () {
    const W = 960, H = 540;
    const PAD = 24;
    let canvas, ctx;
    let raf = 0, lastTs = 0;
    let floorPattern = null;
    const images = {};

    const S = {
        running: false,
        state: 'idle',
        floor: 1,
        time: 0,
        player: null,
        monsters: [],
        bullets: [],
        effects: [],
        texts: [],
        chests: [],
        traps: [],
        scenery: [],
        landmarks: [],
        arena: [],
        mapSeed: 1,
        portal: null,
        keys: {},
        mouse: { x: W / 2, y: H / 2, down: false },
        joystick: { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
        noDeathRun: true,
        // 双向卡牌系统
        pendingPlayerCards: [],
        pendingMonsterCards: [],
        selectedPlayerCount: 0,
        cardRanks: { player: {}, monster: {}, run: {} },
        // 怪物强化状态（累积）
        monsterMods: { hpMul: 1, atkMul: 1, spdMul: 1, cntAdd: 0,
            forceElite: false, shield: 0, regen: 0, thorns: 0,
            split: 0, explode: false, teleport: 0, summonCd: 0 }
    };

    function loadAssets() {
        const list = {
            player: 'assets/player/player_south.png',
            player_north: 'assets/player/player_north.png',
            player_south: 'assets/player/player_south.png',
            player_west: 'assets/player/player_west.png',
            player_northwest: 'assets/player/player_northwest.png',
            player_southwest: 'assets/player/player_southwest.png',
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
        for (let k in list) {
            let img = new Image();
            img.onload = () => {
                images[k] = img;
                if (k === 'floor' && ctx) {
                    try { floorPattern = ctx.createPattern(img, 'repeat'); } catch (e) { }
                }
            };
            img.onerror = () => { images[k] = null; };
            img.src = list[k];
        }
    }

    function trapContains(trap, x, y, actorRadius) {
        let dx = x - trap.x, dy = y - trap.y;
        let distance = Math.hypot(dx, dy);
        if (trap.type === 'blade' || trap.type === 'bone') {
            let bladeCount = trap.type === 'blade' ? 2 : 3;
            let rotation = S.time * (trap.type === 'blade' ? 1.65 : 0.72) + trap.phase;
            let offset = Math.atan2(dy, dx) - rotation;
            let step = Math.PI / bladeCount;
            let nearest = Math.round(offset / step) * step;
            return distance < trap.radius + actorRadius && distance > 8 &&
                Math.abs(Math.sin(offset - nearest)) * distance < actorRadius + (trap.type === 'blade' ? 8 : 5);
        }
        if (trap.type === 'sinkhole') {
            return distance > trap.radius * 0.38 - actorRadius &&
                distance < trap.radius * 0.82 + actorRadius;
        }
        return distance < trap.radius + actorRadius;
    }

    function updateTraps(player, dt) {
        for (let trap of S.traps) {
            let cycle = Math.floor((S.time + trap.phase) / trap.period);
            let phaseTime = (S.time + trap.phase) % trap.period;
            let active = phaseTime >= trap.warning && phaseTime < trap.warning + trap.activeDuration;
            if (!active) continue;
            let playerDistance = Math.hypot(player.x - trap.x, player.y - trap.y);
            if (trap.type === 'sinkhole' && playerDistance < trap.radius * 1.5) {
                let pull = Math.min(1, (1 - playerDistance / (trap.radius * 1.5)) * 1.6);
                let pullDistance = 105 * pull * dt;
                let angle = Math.atan2(trap.y - player.y, trap.x - player.x);
                let pulled = constrainToArena(player.x + Math.cos(angle) * pullDistance,
                    player.y + Math.sin(angle) * pullDistance, player.r);
                player.x = pulled.x;
                player.y = pulled.y;
            }
            if (trap.type === 'crystal' && trap.projectileCycle !== cycle) {
                trap.projectileCycle = cycle;
                for (let i = 0; i < 6; i++) {
                    let angle = i * Math.PI / 3 + trap.phase;
                    S.bullets.push({
                        x: trap.x, y: trap.y,
                        vx: Math.cos(angle) * 165, vy: Math.sin(angle) * 165,
                        r: 6, dmg: Math.max(6, Math.ceil(player.maxHp * 0.06)),
                        color: '#8df2ed'
                    });
                }
                S.effects.push({ type: 'boom', x: trap.x, y: trap.y, color: '#8df2ed', t: 0, life: 0.55 });
            }
            if (trap.type === 'altar' && trap.healCycle !== cycle) {
                trap.healCycle = cycle;
                for (let monster of S.monsters) {
                    if (Math.hypot(monster.x - trap.x, monster.y - trap.y) < trap.radius + monster.r) {
                        let heal = Math.max(1, Math.ceil(monster.maxHp * 0.035));
                        monster.hp = Math.min(monster.maxHp, monster.hp + heal);
                        floatText(monster.x, monster.y - monster.r, '祭坛 +' + heal, '#d58bff');
                        S.effects.push({ type: 'element', element: 'heal', x: monster.x, y: monster.y, t: 0, life: 0.4 });
                    }
                }
            }
            if (S.time >= (trap.playerNextHit || 0) &&
                trapContains(trap, player.x, player.y, player.r) &&
                player.invuln <= 0) {
                trap.playerCycle = cycle;
                let damage = Math.max(trap.damage, Math.ceil(player.maxHp * trap.damageRatio)) +
                    Math.ceil(player.maxHp * (trap.drain || 0));
                hurtPlayer(damage);
                if (trap.slow) player.slowTime = Math.max(player.slowTime || 0, trap.slow);
                if (trap.burn) player.burnTime = Math.max(player.burnTime || 0, trap.burn);
                if (trap.stun) player.stunTime = Math.max(player.stunTime || 0, trap.stun);
                if (trap.shock) player.stunTime = Math.max(player.stunTime || 0, trap.shock * 0.7);
                if (trap.burnDamage) player.hazardBurnDamage = trap.burnDamage;
                if (trap.poison) {
                    player.poisonTime = Math.max(player.poisonTime || 0, trap.poison);
                    player.poisonTick = Math.max(player.poisonTick || 0, 0.95);
                }
                if (trap.attackSlow) player.attackSlowTime = Math.max(player.attackSlowTime || 0, trap.attackSlow);
                if (trap.slide) {
                    let moveLength = Math.hypot(player.vx || 0, player.vy || 0) || 1;
                    player.iceDriftX = (player.vx || Math.cos(trap.phase)) / moveLength;
                    player.iceDriftY = (player.vy || Math.sin(trap.phase)) / moveLength;
                    player.slideTime = trap.slide;
                }
                if (trap.knockback) {
                    let angle = Math.atan2(player.y - trap.y, player.x - trap.x);
                    let pushed = resolveArenaPosition(player.x + Math.cos(angle) * trap.knockback,
                        player.y + Math.sin(angle) * trap.knockback, player.r);
                    player.x = pushed.x;
                    player.y = pushed.y;
                }
                trap.playerNextHit = S.time + (trap.poison ? 1.05 : 1.4);
                floatText(player.x, player.y - 24, '⚠ ' + trap.name + ' -' + damage, trap.color);
                let element = trap.type === 'ice' ? 'ice' : trap.type === 'fire' ? 'fire' :
                    trap.type === 'roots' ? 'roots' :
                    trap.type === 'rune' ? 'seal' : trap.type === 'altar' ? 'heal' :
                    trap.type === 'sinkhole' ? 'void' : trap.type === 'crystal' ||
                    trap.type === 'blade' || trap.type === 'bone' ? 'crystal' : 'poison';
                S.effects.push({ type: 'element', element, x: player.x, y: player.y, t: 0, life: 0.65 });
            }
            for (let i = S.monsters.length - 1; i >= 0; i--) {
                let monster = S.monsters[i];
                if (!monster.trapCycles) monster.trapCycles = {};
                if (monster.trapCycles[trap.id] === cycle ||
                    !trapContains(trap, monster.x, monster.y, monster.r)) continue;
                monster.trapCycles[trap.id] = cycle;
                damageMonster(monster, Math.max(1, Math.round(monster.maxHp * 0.1)));
                monster.flash = 0.12;
                if (trap.burn) monster.burnTime = Math.max(monster.burnTime || 0, trap.burn);
                if (trap.slow) monster.slowTime = Math.max(monster.slowTime || 0, trap.slow * 0.55);
                if (trap.poison) {
                    monster.poisonTime = Math.max(monster.poisonTime || 0, trap.poison);
                    monster.poisonTick = Math.max(monster.poisonTick || 0, 0.95);
                }
                if (trap.attackSlow) monster.atkCd = Math.max(monster.atkCd || 0, 1.6);
                if (trap.stun) {
                    monster.stunCd = Math.max(monster.stunCd || 0, trap.stun);
                    monster.controlEffect = 'stun';
                }
                if (trap.shock) {
                    monster.stunCd = Math.max(monster.stunCd || 0, trap.shock * 0.7);
                    monster.controlEffect = 'stun';
                }
                if (trap.knockback) {
                    let angle = Math.atan2(monster.y - trap.y, monster.x - trap.x);
                    let pushed = resolveArenaPosition(monster.x + Math.cos(angle) * trap.knockback * 0.8,
                        monster.y + Math.sin(angle) * trap.knockback * 0.8, monster.r);
                    monster.x = pushed.x;
                    monster.y = pushed.y;
                }
                let element = trap.type === 'ice' ? 'ice' : trap.type === 'fire' ? 'fire' :
                    trap.type === 'roots' ? 'roots' :
                    trap.type === 'rune' ? 'seal' : trap.type === 'altar' ? 'heal' :
                    trap.type === 'sinkhole' ? 'void' : trap.type === 'crystal' ||
                    trap.type === 'blade' || trap.type === 'bone' ? 'crystal' : 'poison';
                S.effects.push({ type: 'element', element, x: monster.x, y: monster.y, t: 0, life: 0.35 });
                if (monster.hp <= 0) killMonster(monster);
            }
        }
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        canvas.width = W;
        canvas.height = H;
        ctx.imageSmoothingEnabled = false;
        loadAssets();
        bindInput();
        window.addEventListener('resize', fitCanvas);
        fitCanvas();
    }

    function fitCanvas() {
        let wrap = canvas.parentElement;
        if (!wrap) return;
        let aw = wrap.clientWidth, ah = wrap.clientHeight;
        let scale = Math.min(aw / W, ah / H);
        canvas.style.width = Math.floor(W * scale) + 'px';
        canvas.style.height = Math.floor(H * scale) + 'px';
    }

    function bindInput() {
        window.addEventListener('keydown', e => {
            S.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
            if ((e.code === 'KeyJ' || e.code === 'Space' || e.code === 'KeyZ') && S.running) tryAttack();
        });
        window.addEventListener('keyup', e => { S.keys[e.code] = false; });
        canvas.addEventListener('mousemove', e => {
            let r = canvas.getBoundingClientRect();
            S.mouse.x = (e.clientX - r.left) * (W / r.width);
            S.mouse.y = (e.clientY - r.top) * (H / r.height);
        });
        canvas.addEventListener('mousedown', e => {
            // 如果有覆盖层显示，不响应攻击
            if (document.querySelector('.overlay.active')) return;
            S.mouse.down = true;
            if (S.running) tryAttack(true);
        });
        window.addEventListener('mouseup', () => { S.mouse.down = false; });

        let joyBase = document.getElementById('joyBase');
        let joyKnob = document.getElementById('joyKnob');
        let joyZone = document.getElementById('joyZone');
        let atkBtn = document.getElementById('atkBtn');
        if (joyZone) {
            joyZone.addEventListener('touchstart', e => {
                let t = e.changedTouches[0];
                S.joystick.active = true;
                S.joystick.id = t.identifier;
                let zr = joyZone.getBoundingClientRect();
                S.joystick.ox = t.clientX;
                S.joystick.oy = t.clientY;
                if (joyBase) {
                    joyBase.style.left = (t.clientX - zr.left - 40) + 'px';
                    joyBase.style.top = (t.clientY - zr.top - 40) + 'px';
                    joyBase.style.display = 'block';
                    joyKnob.style.display = 'block';
                    joyKnob.style.left = '24px';
                    joyKnob.style.top = '24px';
                }
                e.preventDefault();
            }, { passive: false });
            joyZone.addEventListener('touchmove', e => {
                for (let t of e.changedTouches) {
                    if (t.identifier !== S.joystick.id) continue;
                    let dx = t.clientX - S.joystick.ox;
                    let dy = t.clientY - S.joystick.oy;
                    let len = Math.hypot(dx, dy) || 1;
                    let max = 40;
                    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
                    S.joystick.dx = dx / max;
                    S.joystick.dy = dy / max;
                    if (joyKnob) {
                        joyKnob.style.left = (24 + dx) + 'px';
                        joyKnob.style.top = (24 + dy) + 'px';
                    }
                }
                e.preventDefault();
            }, { passive: false });
            const joyEnd = e => {
                for (let t of e.changedTouches) {
                    if (t.identifier !== S.joystick.id) continue;
                    S.joystick.active = false;
                    S.joystick.dx = 0;
                    S.joystick.dy = 0;
                    S.joystick.id = null;
                    if (joyBase) { joyBase.style.display = 'none'; joyKnob.style.display = 'none'; }
                }
            };
            joyZone.addEventListener('touchend', joyEnd);
            joyZone.addEventListener('touchcancel', joyEnd);
        }
        if (atkBtn) {
            let fire = e => {
                e.preventDefault();
                if (document.querySelector('.overlay.active')) return;
                if (S.running) tryAttack();
            };
            atkBtn.addEventListener('touchstart', fire, { passive: false });
            atkBtn.addEventListener('mousedown', fire);
        }
    }

function startRun() {
        if (!G.created) return;
        G.flags.runs = (G.flags.runs || 0) + 1;
        S.floor = 1;
        S.time = 0;
        S.mapSeed = Math.floor(Math.random() * 2147483646) + 1;
        S.noDeathRun = true;
        S.bullets = [];
        S.traps = [];
        S.effects = [];
        S.texts = [];
        S.cardRanks = { player: {}, monster: {}, run: {} };
        S.monsterMods = { hpMul: 1, atkMul: 1, spdMul: 1, cntAdd: 0,
            forceElite: false, shield: 0, regen: 0, thorns: 0,
            split: 0, explode: false, teleport: 0, summonCd: 0 };
        // 游戏全局卡牌效果（由普通卡牌/剧情奖励获得）
        G.combo = 0; // 连击效果
        G.pierce = 0; // 穿透效果
        G.dodge = 0; // 闪避效果
        G.shield = 0; // 护盾效果
        G.split = 0; // 分裂效果
        G.explode = 0; // 自爆效果
        // 玩家实例化数据
        S.player = {
            x: W / 2, y: H / 2,
            r: 16,
            hp: G.maxHp,
            maxHp: G.maxHp,
            facing: -Math.PI / 2,
            atkCd: 0,
            swinging: 0,
            invuln: 0,
            hitSet: null,
            walkT: 0,
            vx: 0, vy: 0,
            dashCd: 0, dashTime: 0, dashVx: 0, dashVy: 0,
            shield: 0, shieldMax: 0, shieldCooldown: 0,
            // 五种基础朝向各有8帧；另外三个朝向通过水平翻转复用。
            anim: {
                fw: 64, fh: 64, cols: 8, frameTime: 0.1,
                // 方向到精灵键的映射
                dirMap: {
                    up: 'player_north',
                    down: 'player_south',
                    left: 'player_west',
                    upleft: 'player_northwest',
                    downleft: 'player_southwest'
                }
            },
            // 玩家强化状态
            mods: { atk: 0, maxHp: 0, speed: 0, range: 0, crit: 0, lifesteal: 0,
                doubleHit: false, pierce: false, knockback: 0, stunChance: 0, stunDur: 0,
                elemFire: false, elemDmg: 0, elemIce: false, freezeChance: 0, freezeDur: 0,
                chain: 0, chainDmg: 0, dashStrike: false, dashCd: 0,
                shield: 0, shieldCd: 0, dodge: 0, regen: 0, thorns: 0,
                combo: 0, split: 0, explode: 0, burnTime: 0,
                evoBlade: false, evoFlame: false, evoFrost: false, evoStorm: false,
                evoAegis: false, evoPhantom: false, evoSoul: false, evoRuin: false, evoBloom: false }
        };
        S.running = true;
        S.state = 'playing';
        spawnFloor(1);
        lastTs = 0;
        if (!raf) raf = requestAnimationFrame(loop);
        updateHUD();
    }

    function stopRun() {
        S.running = false;
        S.state = 'idle';
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function spawnFloor(floor) {
        S.floor = floor;
        S.arena = createArena(floor);
        S.scenery = createFloorScenery(floor);
        S.landmarks = createFloorLandmarks(floor);
        S.traps = createFloorTraps(floor);
        S.bullets = [];
        S.monsters = [];
        S.chests = [];
        S.portal = null;
        let p = S.player;
        p.curseLastStandUsed = false;
        let playerStart = resolveArenaPosition(W / 2, H - 70, p.r);
        p.x = playerStart.x; p.y = playerStart.y;
        p.invuln = 1;
        let pool = window.FLOOR_POOL[Math.min(floor, window.DUNGEON_FLOORS) - 1] || ['wolf'];
        let isBossFloor = pool.indexOf('boss') >= 0;
        let baseCount = isBossFloor ? 1 :
            3 + Math.floor(floor * 0.7) + Math.min(4, S.monsterMods.cntAdd);
        for (let i = 0; i < baseCount; i++) {
            let tid = pool[Math.floor(Math.random() * pool.length)];
            if (S.monsterMods.forceElite && i === 0 && floor < window.DUNGEON_FLOORS) tid = 'elite';
            let base = window.MONSTERS[tid];
            let hpMul = (1 + (floor - 1) * 0.28) * S.monsterMods.hpMul;
            let atkMul = (1 + (floor - 1) * 0.15) * S.monsterMods.atkMul;
            let spdMul = S.monsterMods.spdMul;
            let m = {
                id: base.id, name: base.name, img: base.img,
                hp: Math.round(base.hp * hpMul),
                maxHp: Math.round(base.hp * hpMul),
                atk: Math.round(base.atk * atkMul),
                speed: base.speed * spdMul,
                r: base.r, draw: base.draw,
                cult: Math.round(base.cult * (1 + (floor - 1) * 0.15)),
                ranged: !!base.ranged,
                keepDistance: !!base.keepDistance,
                projectileColor: base.projectileColor,
                projectileSpeed: base.projectileSpeed,
                poison: base.poison || 0,
                slow: base.slow || 0,
                healer: !!base.healer,
                blink: !!base.blink,
                charge: !!base.charge,
                splitOnDeath: !!base.splitOnDeath,
                tint: base.tint,
                shootCd: base.ranged ? base.shootCd + Math.random() : 0,
                ...randomArenaPosition(PAD + 24, H * 0.55, base.r),
                atkCd: 0, flash: 0, wob: Math.random() * 6,
                stunCd: 0, burnTime: 0, burnTick: 0,
                chargeCd: base.charge ? 2.2 + Math.random() * 1.2 : 0,
                chargeWindup: 0, chargeTime: 0, chargeAngle: 0,
                blinkCd: base.blink ? 3.5 + Math.random() * 2 : 0,
                supportCd: base.healer ? 2 + Math.random() * 2 : 0,
                shield: S.monsterMods.shield,
                regen: S.monsterMods.regen,
                thorns: S.monsterMods.thorns,
                split: S.monsterMods.split,
                explode: S.monsterMods.explode,
                teleport: S.monsterMods.teleport,
                summonCd: S.monsterMods.summonCd,
                lastSummon: 0
            };
            S.monsters.push(m);
        }
        let chestCount = floor < window.DUNGEON_FLOORS ? (Math.random() < 0.7 ? 1 : 2) : 0;
        for (let i = 0; i < chestCount; i++) {
            S.chests.push(Object.assign(randomArenaPosition(PAD + 35, H - PAD - 35, 20), { opened: false }));
        }
        if (G.flags.maxFloor < floor) { G.flags.maxFloor = floor; checkAchievements(); }
        toast('🏰 第' + floor + '层 · ' + (window.FLOOR_NAMES[floor - 1] || '深处'), 'gold');
        updateHUD();
        if (floor > 1) showDualCardChoice();
    }

    /* ==================== 双向卡牌系统 ==================== */
    function showDualCardChoice() {
        S.pendingPlayerCards = drawPlayerCards(3);
        S.pendingMonsterCards = drawMonsterCards(3);
        S.selectedPlayerCount = 0;
        S.state = 'choosing';
        renderDualCardUI();
    }

    function drawPlayerCards(n) {
        let available = window.PLAYER_CARDS.filter(c => (S.cardRanks.player[c.id] || 0) < 3);
        return window.drawCardsByTier(available, n, S.floor, c => S.cardRanks.player[c.id] || 0)
            .map(c => Object.assign({}, c, { selected: false, selectedBranch: null }));
    }

    function drawMonsterCards(n) {
        let available = window.MONSTER_CARDS.filter(c => (S.cardRanks.monster[c.id] || 0) < 3);
        return window.drawCardsByTier(available, n, S.floor, c => S.cardRanks.monster[c.id] || 0)
            .map(c => Object.assign({}, c, { selected: false, selectedBranch: null }));
    }

    function renderDualCardUI() {
        let html = '<h2>🎴 第' + S.floor + '层 · 重复卡牌可进阶，集齐三阶可选择进化分支</h2>';
        html += '<div class="dual-cards">';
        html += '<div class="card-column"><h3>✨ 玩家强化</h3><div class="card-choices" id="playerCardChoices">';
        for (let c of S.pendingPlayerCards) {
            let rank = S.cardRanks.player[c.id] || 0;
            let branches = window.getCardEvolutions(c);
            html += '<div class="choice-card player-card ' + c.rarity + ' ' + c.type + (c.curseTier ? ' curse-' + c.curseTier : '') + '" data-id="' + c.id + '">' +
                cardArt(c.id) +
                '<div class="card-name">' + c.name + '<span class="card-rank">' + cardRankLabel(rank) + '</span></div>' +
                '<div class="card-desc">' + c.desc + '</div>' +
                (rank >= 2 ? '<div class="evolution-choices"><span class="evolution-title">选择进化路线</span>' +
                    branches.map(b => '<button type="button" class="evolution-choice" data-branch="' + b.id + '"><strong>' + b.name + '</strong><span>' + b.desc + '</span></button>').join('') + '</div>' : '') +
                '<div class="rarity">' + window.getCardDrawTierLabel(c) + '</div></div>';
        }
        html += '</div></div>';
        html += '<div class="card-column"><h3>👿 妖魔强化（需选同数量）</h3><div class="card-choices" id="monsterCardChoices">';
        for (let c of S.pendingMonsterCards) {
            let rank = S.cardRanks.monster[c.id] || 0;
            let branches = window.getCardEvolutions(c);
            html += '<div class="choice-card monster-card ' + c.rarity + ' ' + c.type + (c.curseTier ? ' curse-' + c.curseTier : '') + '" data-id="' + c.id + '">' +
                cardArt(c.id) +
                '<div class="card-name">' + c.name + '<span class="card-rank">' + cardRankLabel(rank) + '</span></div>' +
                '<div class="card-desc">' + c.desc + '</div>' +
                (rank >= 2 ? '<div class="evolution-choices"><span class="evolution-title">选择进化路线</span>' +
                    branches.map(b => '<button type="button" class="evolution-choice" data-branch="' + b.id + '"><strong>' + b.name + '</strong><span>' + b.desc + '</span></button>').join('') + '</div>' : '') +
                '<div class="rarity">' + window.getCardDrawTierLabel(c) + '</div></div>';
        }
        html += '</div></div></div>';
        html += '<button class="btn-primary" id="confirmDualBtn" disabled>确认 (' + S.selectedPlayerCount + '/3)</button>';
        showOverlay('dualCardOverlay');
        let overlay = document.getElementById('dualCardOverlay');
        let content = overlay.querySelector('.overlay-content');
        content.innerHTML = html;
        // 事件委托：玩家卡
        document.getElementById('playerCardChoices').addEventListener('click', e => {
            let branch = e.target.closest('.evolution-choice');
            if (branch) {
                e.stopPropagation();
                togglePlayerCard(branch.closest('.choice-card').dataset.id, branch.dataset.branch);
                return;
            }
            let card = e.target.closest('.choice-card');
            if (card) togglePlayerCard(card.dataset.id);
        });
        // 事件委托：怪物卡
        document.getElementById('monsterCardChoices').addEventListener('click', e => {
            let branch = e.target.closest('.evolution-choice');
            if (branch) {
                e.stopPropagation();
                toggleMonsterCard(branch.closest('.choice-card').dataset.id, branch.dataset.branch);
                return;
            }
            let card = e.target.closest('.choice-card');
            if (card) toggleMonsterCard(card.dataset.id);
        });
        document.getElementById('confirmDualBtn').addEventListener('click', confirmDualChoice);
        updateConfirmBtn();
    }

    function cardRankLabel(rank) {
        if (rank === 0) return '初获';
        if (rank === 1) return '进阶 2/3';
        return '进化 3/3';
    }

    function togglePlayerCard(id, branchId) {
        let card = S.pendingPlayerCards.find(c => c.id === id);
        if (!card || (!card.selected && S.selectedPlayerCount >= 3)) return;
        if (branchId) {
            if (!card.selected) {
                if (S.selectedPlayerCount >= 3) return;
                card.selected = true;
                S.selectedPlayerCount++;
            }
            card.selectedBranch = branchId;
        } else if (!card.selected) {
            card.selected = true;
            S.selectedPlayerCount++;
        } else if (S.selectedPlayerCount > 0) {
            card.selected = false;
            card.selectedBranch = null;
            S.selectedPlayerCount--;
        }
        let el = document.querySelector('.player-card[data-id="' + id + '"]');
        if (el) {
            el.classList.toggle('selected', card.selected);
            el.querySelectorAll('.evolution-choice').forEach(button => {
                button.classList.toggle('active', button.dataset.branch === card.selectedBranch);
            });
        }
        updateConfirmBtn();
    }

    function toggleMonsterCard(id, branchId) {
        let card = S.pendingMonsterCards.find(c => c.id === id);
        if (!card) return;
        if (branchId) {
            if (!card.selected) card.selected = true;
            card.selectedBranch = branchId;
        } else {
            card.selected = !card.selected;
            if (!card.selected) card.selectedBranch = null;
        }
        let el = document.querySelector('.monster-card[data-id="' + id + '"]');
        if (el) {
            el.classList.toggle('selected', card.selected);
            el.querySelectorAll('.evolution-choice').forEach(button => {
                button.classList.toggle('active', button.dataset.branch === card.selectedBranch);
            });
        }
        updateConfirmBtn();
    }

    function applyPlayerModEffects(effects) {
        for (let key in effects) {
            let value = effects[key];
            if (typeof value === 'boolean') S.player.mods[key] = value;
            else if (key === 'hp') S.player.hp = Math.max(1, Math.min(S.player.maxHp, S.player.hp + value));
            else if (key === 'dashCd' || key === 'shieldCd') {
                S.player.mods[key] = Math.max(1, (S.player.mods[key] || 3) + value);
            } else {
                S.player.mods[key] = (S.player.mods[key] || 0) + value;
            }
        }
    }

    function applyCurseDuplicateBonus(card, side) {
        let bonus = window.CURSE_DUPLICATE_BONUSES[card.curseTier];
        if (!bonus) throw new Error('Missing curse duplicate bonus: ' + card.id);
        let lines = [];
        if (bonus.playerEffects) {
            if (side === 'player') applyPlayerModEffects(bonus.playerEffects);
            else lines.push(...applyCardEffects(bonus.playerEffects));
        }
        if (bonus.monsterEffects && side === 'monster') {
            for (let key in bonus.monsterEffects) applyMonsterModifier(key, bonus.monsterEffects[key]);
        } else if (bonus.monsterEffects && side === 'run') {
            lines.push(...applyRunMonsterEffects(bonus.monsterEffects, 1));
        }
        if (bonus.curseCost) {
            if (side === 'player') applyPlayerModEffects(bonus.curseCost);
            else lines.push('进阶代价：' + applyCardEffects(bonus.curseCost).join('、'));
        }
        let gift = {};
        if (card.curseGift.curseSoulHarvest) {
            gift.curseSoulHarvest = card.curseTier === 'minor' ? 0.01 : card.curseTier === 'major' ? 0.02 : 0.025;
        } else if (card.curseGift.curseFrenzy) {
            gift.curseFrenzy = card.curseTier === 'minor' ? 0.04 : card.curseTier === 'major' ? 0.06 : 0.08;
        } else if (card.curseGift.curseLastStand) {
            gift.curseLastStandHp = 0.05;
        } else {
            throw new Error('Unknown curse duplicate gift: ' + card.id);
        }
        applyCurseGift({ id: card.id, curseGift: gift });
        lines.push('机缘增强');
        return lines;
    }

    function applyCurseEvolution(branch, side) {
        let lines = [];
        if (branch.playerEffects) {
            if (side === 'player') applyPlayerModEffects(branch.playerEffects);
            else lines.push(...applyCardEffects(branch.playerEffects));
        }
        if (branch.monsterEffects && side === 'monster') {
            for (let key in branch.monsterEffects) applyMonsterModifier(key, branch.monsterEffects[key]);
        } else if (branch.monsterEffects && side === 'run') {
            lines.push(...applyRunMonsterEffects(branch.monsterEffects, 2));
        }
        if (branch.curseCost) {
            if (side === 'player') applyPlayerModEffects(branch.curseCost);
            else lines.push('进阶代价：' + applyCardEffects(branch.curseCost).join('、'));
        }
        if (branch.curseGift) {
            lines.push('进阶机缘：' + applyCurseGift({ id: branch.id, curseGift: branch.curseGift }));
        }
        return lines;
    }

    function updateConfirmBtn() {
        let btn = document.getElementById('confirmDualBtn');
        let mSel = S.pendingMonsterCards.filter(c => c.selected).length;
        let branchesReady = S.pendingPlayerCards.concat(S.pendingMonsterCards).every(c => {
            if (!c.selected) return true;
            let side = S.pendingPlayerCards.indexOf(c) >= 0 ? 'player' : 'monster';
            return (S.cardRanks[side][c.id] || 0) < 2 || !!c.selectedBranch;
        });
        if (S.selectedPlayerCount === mSel && branchesReady) {
            btn.disabled = false;
            btn.textContent = '确认 (' + S.selectedPlayerCount + '/3)';
        } else if (!branchesReady) {
            btn.disabled = true;
            btn.textContent = '请选择进化分支';
        } else {
            btn.disabled = true;
            btn.textContent = '玩家:' + S.selectedPlayerCount + ' 妖魔:' + mSel + ' (需相等)';
        }
    }

    function confirmDualChoice() {
        let pCards = S.pendingPlayerCards.filter(c => c.selected);
        let mCards = S.pendingMonsterCards.filter(c => c.selected);
        applyPlayerCards(pCards);
        applyMonsterCards(mCards);
        checkAchievements();
        hideOverlay('dualCardOverlay');
        S.state = 'playing';
        saveGame(false);
    }

    function applyPlayerCards(cards) {
        let previousShieldMax = S.player.shieldMax || 0;
        for (let c of cards) {
            let rank = S.cardRanks.player[c.id] || 0;
            if (c.type === 'cursed') G.flags.cursedPicks = (G.flags.cursedPicks || 0) + 1;
            if (c.type !== 'cursed' || rank === 0) {
                for (let k in c.effects) {
                    let v = c.effects[k];
                    if (typeof v === 'boolean') S.player.mods[k] = v;
                    else if (k === 'hp') S.player.hp = Math.max(1, Math.min(S.player.maxHp, S.player.hp + v));
                    else if (k === 'dashCd' || k === 'shieldCd') {
                        S.player.mods[k] = rank === 0 ? v : Math.max(1, (S.player.mods[k] || v) - 0.5);
                    }
                    else S.player.mods[k] = (S.player.mods[k] || 0) + v;
                }
            }
            if (c.type !== 'cursed' && rank > 0) {
                let bonus = window.CARD_DUPLICATE_BONUSES[c.id] || {};
                for (let k in bonus) {
                    if (k === 'dashCd' || k === 'shieldCd') {
                        S.player.mods[k] = Math.max(1, (S.player.mods[k] || 3) + bonus[k]);
                    } else {
                        S.player.mods[k] = (S.player.mods[k] || 0) + bonus[k];
                    }
                }
            }
            let curseGiftLine = '';
            let curseUpgradeLines = [];
            if (c.type === 'cursed' && rank === 0 && c.curseGift) curseGiftLine = applyCurseGift(c);
            if (c.type === 'cursed' && rank === 1) {
                curseUpgradeLines = applyCurseDuplicateBonus(c, 'player');
            }
            S.cardRanks.player[c.id] = Math.min(3, rank + 1);
            let evolutionName = '';
            if (rank >= 2) {
                let branch = window.getCardEvolutions(c).find(b => b.id === c.selectedBranch);
                if (!branch) throw new Error('Missing player card evolution: ' + c.id);
                evolutionName = branch.name;
                if (c.type === 'cursed') {
                    curseUpgradeLines = applyCurseEvolution(branch, 'player');
                } else {
                    for (let k in branch.effects) {
                        let v = branch.effects[k];
                        if (typeof v === 'boolean') S.player.mods[k] = v;
                        else if (k === 'dashCd' || k === 'shieldCd') {
                            S.player.mods[k] = Math.max(1, (S.player.mods[k] || 3) + v);
                        }
                        else S.player.mods[k] = (S.player.mods[k] || 0) + v;
                    }
                }
                floatText(S.player.x, S.player.y - 45, '✦ 进化·' + branch.name, '#ffe27a');
                S.effects.push({ type: 'evolution', x: S.player.x, y: S.player.y, color: '#ffd76a', t: 0, life: 0.8 });
            }
            if (c.type === 'cursed') {
                toast('💀 诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] + '：' + c.name +
                    (evolutionName ? ' 进化为「' + evolutionName + '」' : ' · ' + cardRankLabel(rank + 1)) +
                    (curseGiftLine ? '；特殊机缘：' + curseGiftLine : '') +
                    (curseUpgradeLines.length ? '；进阶效果：' + curseUpgradeLines.join('、') : ''), 'bad');
            } else if (evolutionName) {
                toast('✦ ' + c.name + ' 进化为「' + evolutionName + '」', 'gold');
            } else {
                toast('✨ ' + c.name + ' · ' + cardRankLabel(rank + 1), 'good');
            }
        }
        // 重算衍生属性
        if (S.player.mods.maxHp) {
            let oldMax = S.player.maxHp;
            S.player.maxHp = G.maxHp + S.player.mods.maxHp;
            S.player.hp = Math.min(S.player.maxHp, S.player.hp + (S.player.maxHp - oldMax));
        }
        S.player.shieldMax = S.player.maxHp * S.player.mods.shield;
        if (S.player.shieldMax > previousShieldMax) {
            S.player.shield = Math.min(S.player.shieldMax,
                (S.player.shield || 0) + S.player.shieldMax - previousShieldMax);
            if (previousShieldMax === 0) S.player.shieldCooldown = 0;
        }
        updateHUD();
    }

    function applyMonsterCards(cards) {
        for (let c of cards) {
            let rank = S.cardRanks.monster[c.id] || 0;
            if (c.type === 'cursed') G.flags.cursedPicks = (G.flags.cursedPicks || 0) + 1;
            if (c.type !== 'cursed' || rank === 0) {
                for (let k in c.effects) {
                    let v = c.effects[k];
                    if ((k === 'summonCd' || k === 'teleport') && rank > 0) {
                        S.monsterMods[k] = Math.max(1, (S.monsterMods[k] || v) - 1);
                    } else {
                        applyMonsterModifier(k, v);
                    }
                }
            }
            let curseRewardLines = [];
            if (c.type === 'cursed' && rank === 0) {
                curseRewardLines = applyMonsterCurseConsequences(c);
            } else if (c.type === 'cursed' && rank === 1) {
                curseRewardLines = applyCurseDuplicateBonus(c, 'monster');
            }
            if (c.type !== 'cursed' && rank > 0) {
                let bonus = window.CARD_DUPLICATE_BONUSES[c.id] || {};
                for (let k in bonus) applyMonsterModifier(k, bonus[k]);
            }
            S.cardRanks.monster[c.id] = Math.min(3, rank + 1);
            let evolutionName = '';
            if (rank >= 2) {
                let branch = window.getCardEvolutions(c).find(b => b.id === c.selectedBranch);
                if (!branch) throw new Error('Missing monster card evolution: ' + c.id);
                evolutionName = branch.name;
                if (c.type === 'cursed') {
                    curseRewardLines = applyCurseEvolution(branch, 'monster');
                } else {
                    for (let k in branch.effects) applyMonsterModifier(k, branch.effects[k]);
                }
            }
            if (c.type === 'cursed') {
                toast('💀 妖魔诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] + '：' + c.name +
                    (evolutionName ? ' 进化为「' + evolutionName + '」；' : ' · ' + cardRankLabel(rank + 1) + '；') +
                    curseRewardLines.join('；'), 'bad');
            } else if (evolutionName) {
                toast('👿 ' + c.name + ' 进化为「' + evolutionName + '」', 'bad');
            } else {
                toast('👿 妖魔 ' + c.name + ' · ' + cardRankLabel(rank + 1), 'bad');
            }
        }
        // 重算衍生属性
        updateHUD();
    }

    function applyMonsterModifier(key, value) {
        if (typeof value === 'boolean') {
            S.monsterMods[key] = value;
        } else if (key === 'hpMul' || key === 'atkMul' || key === 'spdMul') {
            S.monsterMods[key] *= value;
        } else {
            S.monsterMods[key] = Math.max(0, (S.monsterMods[key] || 0) + value);
        }
    }

    function applyMonsterCurseConsequences(card) {
        if (!card.curseCost || !card.curseGift) throw new Error('Incomplete monster curse tradeoff: ' + card.id);
        let costLines = applyCardEffects(card.curseCost);
        let giftLine = applyCurseGift(card);
        return ['玩家代价：' + costLines.join('、'), '特殊机缘：' + giftLine];
    }

    function applyCurseGift(card) {
        if (!card.curseGift) throw new Error('Missing unique curse gift: ' + card.id);
        for (let key in card.curseGift) {
            let value = card.curseGift[key];
            if (typeof value === 'boolean') S.player.mods[key] = value;
            else S.player.mods[key] = (S.player.mods[key] || 0) + value;
        }
        if (card.curseGift.curseSoulHarvest) return '击杀回复生命上限的' + Math.round(card.curseGift.curseSoulHarvest * 100) + '%';
        if (card.curseGift.curseFrenzy) return '击杀后攻击提升' + Math.round(card.curseGift.curseFrenzy * 100) + '%，持续3.5秒';
        if (card.curseGift.curseLastStand) {
            let survival = 30 + Math.round((S.player.mods.curseLastStandHp || 0) * 100);
            return '每层首次受到致命伤时以' + survival + '%生命存活';
        }
        throw new Error('Unknown unique curse gift: ' + card.id);
    }

    function loop(ts) {
        raf = requestAnimationFrame(loop);
        if (!lastTs) lastTs = ts;
        let dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        if (S.running) update(dt);
        draw();
    }

    function update(dt) {
        // 选择卡牌/对话/死亡等非游戏状态时暂停逻辑
        if (S.state !== 'playing') return;

        S.time += dt;
        let p = S.player;
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
                let poisonDamage = Math.max(1, Math.ceil(p.maxHp * 0.018));
                hurtPlayer(poisonDamage);
                floatText(p.x, p.y - 24, '瘴毒 -' + poisonDamage, '#a8dc75');
                S.effects.push({ type: 'element', element: 'poison', x: p.x, y: p.y, t: 0, life: 0.35 });
            }
        }
        p.curseFrenzyTime = Math.max(0, (p.curseFrenzyTime || 0) - dt);
        if (p.burnTime > 0) {
            if (!p.burnTick) p.burnTick = 0.45;
            p.burnTick = Math.max(0, p.burnTick - dt);
            if (p.burnTick <= 0) {
                p.burnTick = 0.45;
                let burnDamage = Math.max(1, Math.round((G.atk + (p.mods.atk || 0)) * 0.08));
                if (p.hazardBurnDamage) burnDamage = Math.max(burnDamage, Math.ceil(p.maxHp * p.hazardBurnDamage));
                hurtPlayer(burnDamage);
                S.effects.push({ type: 'element', element: 'fire', x: p.x, y: p.y, t: 0, life: 0.3 });
            }
        }
        if (p.shieldCooldown > 0) {
            p.shieldCooldown = Math.max(0, p.shieldCooldown - dt);
            if (p.shieldCooldown === 0 && p.shieldMax > 0) {
                p.shield = p.shieldMax;
                floatText(p.x, p.y - 30, '🛡️ 灵盾重聚', '#8cecff');
                S.effects.push({ type: 'element', element: 'shield', x: p.x, y: p.y, t: 0, life: 0.55 });
            }
        }

        let mx = 0, my = 0;
        if (S.keys['KeyW'] || S.keys['ArrowUp']) my -= 1;
        if (S.keys['KeyS'] || S.keys['ArrowDown']) my += 1;
        if (S.keys['KeyA'] || S.keys['ArrowLeft']) mx -= 1;
        if (S.keys['KeyD'] || S.keys['ArrowRight']) mx += 1;
        if (S.joystick.active) { mx += S.joystick.dx; my += S.joystick.dy; }
        if (p.stunTime > 0) { mx = 0; my = 0; }
        let len = Math.hypot(mx, my);
        if (len > 1) { mx /= len; my /= len; }
        if (p.slideTime > 0 && p.stunTime <= 0) {
            if (len > 0.05) {
                mx = mx * 0.35 + (p.iceDriftX || 0) * 0.65;
                my = my * 0.35 + (p.iceDriftY || 0) * 0.65;
            } else {
                mx = p.iceDriftX || 0;
                my = p.iceDriftY || 0;
            }
            len = Math.hypot(mx, my);
            if (len > 1) { mx /= len; my /= len; }
        }
        p.vx = mx; p.vy = my;
        if (len > 0.05) {
            let moveSpeed = Math.max(1.5, G.speed + p.mods.speed) * (p.slowTime > 0 ? 0.55 : 1);
            p.x += mx * moveSpeed * 60 * dt;
            p.y += my * moveSpeed * 60 * dt;
            p.facing = Math.atan2(my, mx);
            p.walkT += dt;
        }
        // 处理脱战回春
        if (p.mods.regen && !len) {
            if (!p.lastNoMove) p.lastNoMove = 0;
            p.lastNoMove += dt;
            if (p.lastNoMove >= 3) {
                let heal = Math.round(p.maxHp * p.mods.regen);
                p.hp = Math.min(p.maxHp, p.hp + heal);
                floatText(p.x, p.y, '🌿 回春 +' + heal + 'HP', '#66ff99');
                p.lastNoMove = 0;
            }
        }

        let boundedPlayer = resolveArenaPosition(p.x, p.y, p.r);
        p.x = boundedPlayer.x;
        p.y = boundedPlayer.y;

        // 检查卡牌效果 - 瞬影突刺
        if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
        if (p.dashTime > 0) {
            p.dashTime = Math.max(0, p.dashTime - dt);
            p.x += p.dashVx * dt;
            p.y += p.dashVy * dt;
            boundedPlayer = resolveArenaPosition(p.x, p.y, p.r);
            p.x = boundedPlayer.x;
            p.y = boundedPlayer.y;
            S.effects.push({ type: 'afterimage', x: p.x, y: p.y, t: 0, life: 0.25 });
        }
        if (p.mods.dashStrike && p.dashCd <= 0 && p.dashTime <= 0) {
            let dx = S.mouse.x - p.x, dy = S.mouse.y - p.y;
            let d = Math.hypot(dx, dy) || 1;
            let speed = p.mods.evoPhantom ? 620 : 500;
            p.dashVx = (dx / d) * speed;
            p.dashVy = (dy / d) * speed;
            p.dashTime = 0.15;
            p.dashCd = Math.max(1.5, p.mods.dashCd || 3);
            p.dashHitSet = new Set();
            S.effects.push({ type: 'dash', x: p.x, y: p.y, x2: p.x + p.dashVx * 0.15, y2: p.y + p.dashVy * 0.15, t: 0, life: 0.3 });
        }

        // 冲刺命中判定
        if (p.mods.dashStrike && p.dashTime > 0) {
            let hitRange = p.mods.dashRange || 60;
            for (let m of S.monsters) {
                let dx = m.x - p.x, dy = m.y - p.y;
                let d = Math.hypot(dx, dy);
                if (d < hitRange + m.r && !p.dashHitSet.has(m)) {
                    p.dashHitSet.add(m);
                    let chainDmg = Math.round((G.atk + p.mods.atk) * 0.5);
                    damageMonster(m, chainDmg);
                    floatText(m.x, m.y - m.r, '⚔️ ' + chainDmg, '#ffcc00');
                    S.effects.push({ type: 'hit', x: m.x, y: m.y, color: '#bba1ff', t: 0, life: 0.24 });
                    if (m.hp <= 0) killMonster(m);
                }
            }
        }

        if (S.mouse.down && p.atkCd <= 0) tryAttack(true);
        for (let i = S.monsters.length - 1; i >= 0; i--) {
            let m = S.monsters[i];
            m.atkCd = Math.max(0, m.atkCd - dt);
            m.shootCd = Math.max(0, m.shootCd - dt);
            m.flash = Math.max(0, m.flash - dt);
            m.slowTime = Math.max(0, (m.slowTime || 0) - dt);
            m.stunCd = Math.max(0, (m.stunCd || 0) - dt);
            if (m.stunCd <= 0) m.controlEffect = null;
            m.poisonTime = Math.max(0, (m.poisonTime || 0) - dt);
            if (m.poisonTime > 0) {
                m.poisonTick = Math.max(0, (m.poisonTick || 0) - dt);
                if (m.poisonTick <= 0) {
                    m.poisonTick = 0.95;
                    let poisonDamage = Math.max(1, Math.ceil(m.maxHp * 0.018));
                    damageMonster(m, poisonDamage);
                    floatText(m.x, m.y - m.r, '瘴毒 -' + poisonDamage, '#a8dc75');
                    S.effects.push({ type: 'element', element: 'poison', x: m.x, y: m.y, t: 0, life: 0.3 });
                    if (m.hp <= 0) { killMonster(m); continue; }
                }
            }
            m.burnTime = Math.max(0, (m.burnTime || 0) - dt);
            if (m.burnTime > 0) {
                m.burnTick = Math.max(0, (m.burnTick || 0) - dt);
                if (m.burnTick <= 0) {
                    m.burnTick = 0.45;
                    let burnDamage = Math.max(1, Math.round((G.atk + p.mods.atk) * (p.mods.burnDmg || 0.1)));
                    damageMonster(m, burnDamage);
                    floatText(m.x, m.y - m.r, '🔥 ' + burnDamage, '#ff8b36');
                    S.effects.push({ type: 'element', element: 'fire', x: m.x, y: m.y, t: 0, life: 0.3 });
                    if (m.hp <= 0) { killMonster(m); continue; }
                }
            }
            if (m.stunCd > 0) continue;
            if (m.healer) {
                m.supportCd = Math.max(0, m.supportCd - dt);
                if (m.supportCd <= 0) {
                    m.supportCd = 5.2;
                    let healed = 0;
                    for (let ally of S.monsters) {
                        if (ally === m || ally.hp >= ally.maxHp ||
                            Math.hypot(ally.x - m.x, ally.y - m.y) > 175) continue;
                        let amount = Math.max(4, Math.ceil(ally.maxHp * 0.11));
                        ally.hp = Math.min(ally.maxHp, ally.hp + amount);
                        floatText(ally.x, ally.y - ally.r, '回春 +' + amount, '#8effaa');
                        S.effects.push({ type: 'element', element: 'heal', x: ally.x, y: ally.y, t: 0, life: 0.45 });
                        healed++;
                    }
                    if (healed) {
                        floatText(m.x, m.y - m.r - 10, '巫祝疗愈', '#8effaa');
                        S.effects.push({ type: 'element', element: 'heal', x: m.x, y: m.y, t: 0, life: 0.55 });
                    }
                }
            }
            let dx = p.x - m.x, dy = p.y - m.y;
            let d = Math.hypot(dx, dy) || 1;
            if (m.blink) {
                m.blinkCd = Math.max(0, m.blinkCd - dt);
                if (m.blinkCd <= 0 && d > 115) {
                    let angle = Math.atan2(dy, dx);
                    let blinkPosition = resolveArenaPosition(
                        p.x - Math.cos(angle) * 54 + (Math.random() - 0.5) * 30,
                        p.y - Math.sin(angle) * 54 + (Math.random() - 0.5) * 30, m.r);
                    S.effects.push({ type: 'afterimage', x: m.x, y: m.y, t: 0, life: 0.35 });
                    m.x = blinkPosition.x;
                    m.y = blinkPosition.y;
                    m.blinkCd = 4.5 + Math.random() * 1.5;
                    S.effects.push({ type: 'element', element: 'void', x: m.x, y: m.y, t: 0, life: 0.5 });
                    floatText(m.x, m.y - m.r, '幽影闪现', '#c7a1ff');
                    dx = p.x - m.x;
                    dy = p.y - m.y;
                    d = Math.hypot(dx, dy) || 1;
                }
            }
            if (m.charge) {
                m.chargeCd = Math.max(0, m.chargeCd - dt);
                m.chargeTime = Math.max(0, m.chargeTime - dt);
                if (m.chargeWindup > 0) {
                    m.chargeWindup = Math.max(0, m.chargeWindup - dt);
                    m.chargeAngle = Math.atan2(dy, dx);
                    if (m.chargeWindup === 0) {
                        m.chargeTime = 0.5;
                        S.effects.push({ type: 'boom', x: m.x, y: m.y, color: '#ffbf76', t: 0, life: 0.4 });
                    }
                } else if (m.chargeCd <= 0 && m.chargeTime <= 0 && d < 230 && d > 70) {
                    m.chargeWindup = 0.72;
                    m.chargeAngle = Math.atan2(dy, dx);
                    m.chargeCd = 5.4;
                    floatText(m.x, m.y - m.r - 10, '蓄势冲锋！', '#ffbf76');
                } else if (m.chargeTime > 0) {
                    let chargeSpeed = m.speed * 4.2;
                    let chargePos = resolveArenaPosition(
                        m.x + Math.cos(m.chargeAngle) * chargeSpeed * 60 * dt,
                        m.y + Math.sin(m.chargeAngle) * chargeSpeed * 60 * dt, m.r);
                    m.x = chargePos.x;
                    m.y = chargePos.y;
                    S.effects.push({ type: 'afterimage', x: m.x, y: m.y, t: 0, life: 0.18 });
                }
                dx = p.x - m.x;
                dy = p.y - m.y;
                d = Math.hypot(dx, dy) || 1;
            }
            let sepX = 0, sepY = 0;
            for (let j = 0; j < S.monsters.length; j++) {
                if (j === i) continue;
                let o = S.monsters[j];
                let sx = m.x - o.x, sy = m.y - o.y;
                let sd = Math.hypot(sx, sy) || 1;
                let want = m.r + o.r + 6;
                if (sd < want) { sepX += sx / sd * (want - sd) * 0.5; sepY += sy / sd * (want - sd) * 0.5; }
            }
            let monsterSpeed = m.speed * (m.slowTime > 0 ? 0.55 : 1);
            if (m.healer && d < 205) monsterSpeed *= -0.85;
            else if (m.healer && d < 275) monsterSpeed = 0;
            if (m.keepDistance && d < m.shootRange * 0.5) monsterSpeed *= -0.7;
            else if (m.keepDistance && d < m.shootRange * 0.78) monsterSpeed = 0;
            if (m.chargeWindup > 0) monsterSpeed = 0;
            if (m.chargeTime <= 0 || !m.charge) {
                m.x += (dx / d * monsterSpeed + sepX) * 60 * dt;
                m.y += (dy / d * monsterSpeed + sepY) * 60 * dt;
            }
            let boundedMonster = resolveArenaPosition(m.x, m.y, m.r);
            m.x = boundedMonster.x;
            m.y = boundedMonster.y;
            dx = p.x - m.x;
            dy = p.y - m.y;
            d = Math.hypot(dx, dy) || 1;

            if (m.ranged && !m.healer && m.shootRange > 0) {
                let srange = window.MONSTERS[m.id].shootRange || 260;
                if (d < srange && m.shootCd <= 0) {
                    m.shootCd = (window.MONSTERS[m.id].shootCd || 2.2) * (0.8 + Math.random() * 0.4);
                    S.bullets.push({
                        x: m.x, y: m.y,
                        vx: dx / d * (m.projectileSpeed || 200), vy: dy / d * (m.projectileSpeed || 200),
                        r: m.poison || m.slow ? 6 : 5, dmg: Math.round(m.atk * 0.8),
                        color: m.projectileColor || '#c89ad6',
                        poison: m.poison || 0, slow: m.slow || 0
                    });
                }
            }

            if (m.id === 'boss' && m.shootCd <= 0) {
                m.shootCd = 2.4;
                let n = 10;
                let off = Math.random() * Math.PI * 2;
                for (let k = 0; k < n; k++) {
                    let a = off + k / n * Math.PI * 2;
                    S.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 6, dmg: 12 });
                }
                floatText(m.x, m.y - m.r - 10, '🔥 弹幕！', '#ff8844');
            }

            if (d < m.r + p.r && m.atkCd <= 0 && p.invuln <= 0) {
                m.atkCd = m.chargeTime > 0 ? 1.4 : 1.0;
                hurtPlayer(m.atk * (m.chargeTime > 0 ? 1.55 : 1), m);
                if (m.chargeTime > 0) m.chargeTime = 0;
            }
        }

        updateTraps(p, dt);

        for (let c of S.chests) {
            if (!c.opened && Math.hypot(c.x - p.x, c.y - p.y) < 32) {
                c.opened = true;
                openChest(c);
            }
        }

        for (let i = S.bullets.length - 1; i >= 0; i--) {
            let b = S.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.x < PAD || b.x > W - PAD || b.y < PAD || b.y > H - PAD) {
                S.bullets.splice(i, 1);
                continue;
            }
            if (p.invuln <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r) {
                S.bullets.splice(i, 1);
                hurtPlayer(b.dmg);
                if (b.poison) {
                    p.poisonTime = Math.max(p.poisonTime || 0, b.poison);
                    p.poisonTick = Math.max(p.poisonTick || 0, 0.95);
                }
                if (b.slow) p.slowTime = Math.max(p.slowTime || 0, b.slow);
            }
        }

        for (let i = S.effects.length - 1; i >= 0; i--) {
            let e = S.effects[i];
            e.t += dt;
            if (e.t >= e.life) S.effects.splice(i, 1);
        }
        for (let i = S.texts.length - 1; i >= 0; i--) {
            let t = S.texts[i];
            t.t += dt;
            t.y -= 30 * dt;
            if (t.t >= t.life) S.texts.splice(i, 1);
        }

        if (S.monsters.length === 0 && S.state === 'playing') {
            S.state = 'clear';
            S.portal = { x: W / 2, y: PAD + 70, t: 0 };
            onFloorClear(S.floor);
        }
        if (S.portal) S.portal.t += dt;
    }

    function openChest(c) {
        let roll = Math.random();
        S.effects.push({ type: 'boom', x: c.x, y: c.y, t: 0, life: 0.5 });
        if (roll < 0.3) {
            let heal = 40;
            S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
            floatText(c.x, c.y - 20, '💊 回春 +' + heal + 'HP', '#66ff99');
        } else if (roll < 0.5) {
            G.atk += 2;
            floatText(c.x, c.y - 20, '⚔️ 攻击+2', '#ffd700');
        } else if (roll < 0.7) {
            G.maxHp += 15;
            S.player.maxHp = G.maxHp;
            floatText(c.x, c.y - 20, '🛡️ 生命上限+15', '#7df9ff');
        } else if (roll < 0.85) {
            G.crit = Math.min(80, G.crit + 5);
            floatText(c.x, c.y - 20, '🎯 暴击+5%', '#ff88cc');
        } else {
            let cult = 30 + S.floor * 8;
            gainCultivation(cult);
            floatText(c.x, c.y - 20, '🌀 修为+' + cult, '#7fffd4');
        }
        updateHUD();
    }

    function tryAttack(aimMouse) {
        let p = S.player;
        if (!p || p.atkCd > 0 || p.stunTime > 0 || S.state !== 'playing') return;
        p.atkCd = 0.38;
        if (p.attackSlowTime > 0) p.atkCd = 0.72;
        p.swinging = 0.18;
        if (aimMouse) {
            p.facing = Math.atan2(S.mouse.y - p.y, S.mouse.x - p.x);
        }
        p.hitSet = {};
        let range = G.range + p.mods.range;
        let dmg = G.atk + p.mods.atk;
        if (p.curseFrenzyTime > 0) dmg = Math.round(dmg * (1 + (p.mods.curseFrenzy || 0)));
        if (p.mods.evoBlade) dmg = Math.round(dmg * 1.12);
        // 应用连击效果
        if (G.combo > 0) {
            dmg = Math.round(dmg * (1 + G.combo * 0.15));
        }
        let isCrit = Math.random() * 100 < Math.min(80, G.crit + p.mods.crit);
        if (isCrit) dmg = Math.round(dmg * 1.8);
        for (let m of S.monsters) {
            let dx = m.x - p.x, dy = m.y - p.y;
            let d = Math.hypot(dx, dy);
            if (d > range + m.r) continue;
            let ang = Math.atan2(dy, dx);
            let diff = Math.abs(angleDiff(ang, p.facing));
            if (diff > 1.1) continue;
            damageMonster(m, dmg);
            m.flash = 0.12;
            // 应用连击效果
            if (p.mods.doubleHit) {
                let secondDmg = Math.round(dmg * 0.7);
                damageMonster(m, secondDmg);
                floatText(m.x, m.y - m.r, '⚔️ 连击!', '#ffcc00');
                S.effects.push({ type: 'hit', x: m.x, y: m.y, color: '#ffd76a', t: 0, life: 0.36 });
                if (m.hp <= 0) killMonster(m);
            }
            // 应用穿透效果
            if (p.mods.pierce) {
                // 检查身后怪物
                for (let other of S.monsters) {
                    if (other === m) continue;
                    let behind = (p.x - m.x) * (other.y - m.y) - (p.y - m.y) * (other.x - m.x);
                    if (behind > 0 && Math.hypot(other.x - p.x, other.y - p.y) < G.range + p.mods.range) {
                        let pierceDmg = dmg;
                        damageMonster(other, pierceDmg);
                        floatText(other.x, other.y - other.r, '🏹 穿透!', '#ffff00');
                        S.effects.push({ type: 'hit', x: other.x, y: other.y, color: '#ffe779', t: 0, life: 0.3 });
                        if (other.hp <= 0) killMonster(other);
                    }
                }
            }
            if (p.mods.knockback) {
                let kb = p.mods.knockback;
                let dx = m.x - p.x, dy = m.y - p.y;
                let d = Math.hypot(dx, dy) || 1;
                let vx = (dx / d) * kb;
                let vy = (dy / d) * kb;
                let fromX = m.x, fromY = m.y;
                let position = resolveArenaPosition(m.x + vx, m.y + vy, m.r);
                m.x = position.x;
                m.y = position.y;
                S.effects.push({ type: 'knockback', x: fromX, y: fromY, x2: m.x, y2: m.y, t: 0, life: 0.22 });
            }
            if (p.mods.stunChance && Math.random() < p.mods.stunChance) {
                m.stunCd = Math.max(m.stunCd || 0, p.mods.stunDur || 0.5);
                m.controlEffect = 'stun';
                toast('💫 眩晕!', 'bad');
                S.effects.push({ type: 'element', element: 'stun', x: m.x, y: m.y, t: 0, life: 0.7 });
            }
            if (p.mods.elemFire) {
                let fireDmg = Math.max(1, Math.round(dmg * (p.mods.elemDmg || 0.2)));
                damageMonster(m, fireDmg);
                floatText(m.x, m.y - m.r, '🔥 ' + fireDmg, '#ff6600');
                if (p.mods.evoFlame) {
                    m.burnTime = Math.max(m.burnTime || 0, p.mods.burnTime || 1.8);
                    m.burnTick = 0;
                }
                S.effects.push({ type: 'element', element: 'fire', x: m.x, y: m.y, t: 0, life: 0.38 });
            }
            if ((p.mods.elemIce || p.mods.evoFrost) && Math.random() < (p.mods.freezeChance || 0.3)) {
                m.stunCd = Math.max(m.stunCd || 0, (p.mods.freezeDur || 0.8) + (p.mods.evoFrost ? 0.5 : 0));
                m.controlEffect = 'ice';
                toast('🧊 冰冻!', 'bad');
                S.effects.push({ type: 'element', element: 'ice', x: m.x, y: m.y, t: 0, life: 0.65 });
            }
            if (p.mods.chain && S.monsters.length > 1) {
                let allies = S.monsters.filter(mon => mon !== m);
                for (let i = 0; i < Math.min(p.mods.chain, allies.length); i++) {
                    let ally = allies.splice(Math.floor(Math.random() * allies.length), 1)[0];
                    let chainDmg = Math.round(dmg * (p.mods.chainDmg || 0.5));
                    damageMonster(ally, chainDmg);
                    floatText(ally.x, ally.y - ally.r, '🔗 ' + chainDmg, '#9966ff');
                    S.effects.push({ type: 'lightning', x: m.x, y: m.y, x2: ally.x, y2: ally.y, t: 0, life: 0.22 });
                    S.effects.push({ type: 'hit', x: ally.x, y: ally.y, color: '#c7a1ff', t: 0, life: 0.28 });
                    if (ally.hp <= 0) killMonster(ally);
                }
            }
            floatText(m.x, m.y - m.r, (isCrit ? '💥' : '') + dmg, isCrit ? '#ffd700' : '#ffffff');
            S.effects.push({ type: 'hit', x: m.x, y: m.y, color: isCrit ? '#ffd700' : '#a8edff', t: 0, life: 0.28 });
            if (p.mods.evoFlame) S.effects.push({ type: 'element', element: 'fire', x: m.x, y: m.y, t: 0, life: 0.48 });
            if (p.mods.evoFrost) S.effects.push({ type: 'element', element: 'ice', x: m.x, y: m.y, t: 0, life: 0.48 });
            if (p.mods.evoStorm) S.effects.push({ type: 'lightning', x: p.x, y: p.y, x2: m.x, y2: m.y, t: 0, life: 0.18 });
            if (p.mods.evoRuin && isCrit) S.effects.push({ type: 'evolution', x: m.x, y: m.y, color: '#ffbb55', t: 0, life: 0.45 });
            if (p.mods.evoBloom && p.hp < p.maxHp) {
                p.hp = Math.min(p.maxHp, p.hp + 1);
                S.effects.push({ type: 'element', element: 'heal', x: p.x, y: p.y, t: 0, life: 0.35 });
            }
            S.effects.push({ type: 'slash', x: p.x, y: p.y, a: p.facing, r: range, color: p.mods.evoBlade ? '#ffd86b' : p.mods.elemIce ? '#8beaff' : p.mods.elemFire ? '#ff8a4c' : '#7df9ff', t: 0, life: 0.18 });
            if (G.lifesteal + p.mods.lifesteal > 0) {
                let heal = Math.min(G.lifesteal + p.mods.lifesteal, p.maxHp - p.hp);
                if (heal > 0) { p.hp += heal; }
            }
            if (m.hp <= 0) killMonster(m);
        }
        S.effects.push({ type: 'slash', x: p.x, y: p.y, a: p.facing, r: range, t: 0, life: 0.18 });
    }

    function killMonster(m) {
        let idx = S.monsters.indexOf(m);
        if (idx < 0) return;
        S.monsters.splice(idx, 1);
        if (m.splitOnDeath && !m.splitChild) {
            for (let i = 0; i < 2; i++) {
                let angle = i * Math.PI + Math.random() * 0.35;
                let position = resolveArenaPosition(
                    m.x + Math.cos(angle) * (m.r + 8),
                    m.y + Math.sin(angle) * (m.r + 8), 10);
                let child = Object.assign({}, m, {
                    id: 'slimelet', name: '软泥幼体', img: 'bat',
                    x: position.x, y: position.y,
                    hp: Math.max(8, Math.round(m.maxHp * 0.2)),
                    maxHp: Math.max(8, Math.round(m.maxHp * 0.2)),
                    atk: Math.max(3, Math.round(m.atk * 0.45)),
                    speed: 2.5, r: 10, draw: 30, cult: 2,
                    splitOnDeath: false, splitChild: true,
                    healer: false, blink: false, charge: false,
                    ranged: false, tint: '#9be8bd',
                    shield: 0, regen: 0, burnTime: 0, poisonTime: 0,
                    stunCd: 0, flash: 0, wob: Math.random() * 6
                });
                S.monsters.push(child);
            }
            S.effects.push({ type: 'boom', x: m.x, y: m.y, color: '#66d8c0', t: 0, life: 0.48 });
            floatText(m.x, m.y - m.r, '软泥分裂！', '#9be8bd');
        }
        G.flags.kills = (G.flags.kills || 0) + 1;
        gainCultivation(m.cult);
        S.effects.push({ type: 'boom', x: m.x, y: m.y, t: 0, life: 0.4 });
        floatText(m.x, m.y, '+' + m.cult + '修为', '#7fffd4');
        if (S.player.mods.curseSoulHarvest > 0) {
            let heal = Math.max(1, Math.round(S.player.maxHp * S.player.mods.curseSoulHarvest));
            let actualHeal = Math.min(heal, S.player.maxHp - S.player.hp);
            if (actualHeal > 0) {
                S.player.hp += actualHeal;
                floatText(S.player.x, S.player.y - 28, '💀 吸魂 +' + actualHeal, '#d98cff');
                S.effects.push({ type: 'element', element: 'heal', x: S.player.x, y: S.player.y, t: 0, life: 0.4 });
            }
        }
        if (S.player.mods.curseFrenzy > 0) {
            S.player.curseFrenzyTime = Math.max(S.player.curseFrenzyTime || 0, 3.5);
            floatText(S.player.x, S.player.y - 36, '🩸 血怒', '#ff5574');
        }
        if (m.id !== 'boss' && Math.random() < 0.12) {
            let heal = 8;
            S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
            floatText(m.x, m.y + 16, ' +' + heal + 'HP', '#66ff99');
        }
        checkAchievements();
        updateHUD();
    }

    function damageMonster(m, amount) {
        let damage = Math.max(0, amount);
        let absorbed = Math.min(Math.max(0, m.shield || 0), damage);
        if (absorbed > 0) {
            m.shield -= absorbed;
            damage -= absorbed;
            floatText(m.x, m.y - m.r - 8, '🛡️ ' + absorbed, '#8cecff');
            S.effects.push({ type: 'element', element: 'shield', x: m.x, y: m.y, t: 0, life: 0.2 });
        }
        m.hp -= damage;
        return damage;
    }

    function hurtPlayer(dmg, attacker) {
        let p = S.player;
        if (p.invuln > 0) return;

        // 检查闪避效果
        if (p.mods.dodge && Math.random() < p.mods.dodge) {
            toast('✨ 闪避!', 'good');
            S.effects.push({ type: 'afterimage', x: p.x, y: p.y, t: 0, life: 0.35 });
            return;
        }

        // 检查护盾效果
        if (p.mods.shield > 0 && p.shieldMax > 0) {
            let shieldDamage = Math.min(p.shield, dmg);
            p.shield -= shieldDamage;
            dmg -= shieldDamage;
            if (shieldDamage > 0) {
                floatText(p.x, p.y - 24, '🛡️ ' + shieldDamage, '#7df9ff');
                S.effects.push({ type: 'element', element: 'shield', x: p.x, y: p.y, t: 0, life: 0.25 });
            }
            if (p.shield <= 0 && p.shieldCooldown <= 0) p.shieldCooldown = p.mods.shieldCd || 8;
        }

        // 检查反伤效果
        if (p.mods.thorns && dmg > 0 && attacker) {
            let thornDamage = Math.round(dmg * p.mods.thorns);
            damageMonster(attacker, thornDamage);
            floatText(attacker.x, attacker.y - attacker.r, '🌵 反伤 ' + thornDamage, '#ff9900');
            S.effects.push({ type: 'hit', x: attacker.x, y: attacker.y, color: '#89e5a0', t: 0, life: 0.28 });
            S.effects.push({ type: 'element', element: 'thorns', x: attacker.x, y: attacker.y, t: 0, life: 0.4 });
            if (attacker.hp <= 0) killMonster(attacker);
        }

        p.hp -= dmg;
        p.invuln = 0.8;
        S.noDeathRun = false;
        floatText(p.x, p.y - 24, '-' + dmg, '#ff5555');
        S.effects.push({ type: 'hurt', x: p.x, y: p.y, t: 0, life: 0.2 });
        updateHUD();
        if (p.hp <= 0 && p.mods.curseLastStand && !p.curseLastStandUsed) {
            p.curseLastStandUsed = true;
            p.hp = Math.max(1, Math.round(p.maxHp * (0.3 + (p.mods.curseLastStandHp || 0))));
            p.invuln = 1.5;
            floatText(p.x, p.y - 34, '☠️ 劫后余生', '#ff4e73');
            S.effects.push({ type: 'evolution', x: p.x, y: p.y, color: '#ff4e73', t: 0, life: 0.9 });
            updateHUD();
            return;
        }
        if (p.hp <= 0) {
            p.hp = 0;
            S.state = 'dead';
            G.flags.deaths = (G.flags.deaths || 0) + 1;
            G.hp = 1;
            onPlayerDeath();
        }
    }

    function gainCultivation(amt) {
        G.cultivation += amt;
        let upgraded = false;
        while (G.realm < window.REALMS.length - 1 && G.cultivation >= window.REALMS[G.realm + 1].cult) {
            G.realm++;
            upgraded = true;
        }
        if (upgraded) {
            G.maxHp += 10;
            G.atk += 2;
            if (S.player) {
                S.player.maxHp = G.maxHp;
                S.player.hp = Math.min(S.player.maxHp, S.player.hp + 30);
            }
            toast('🎉 突破！境界提升至 ' + window.REALMS[G.realm].name, 'gold');
            checkAchievements();
        }
    }

    function applyCardEffects(effects) {
        let lines = [];
        for (let k in effects) {
            let v = effects[k];
            if (k === 'atk') { G.atk = Math.max(1, G.atk + v); lines.push('攻击' + sign(v)); }
            else if (k === 'maxHp') {
                G.maxHp = Math.max(30, G.maxHp + v);
                if (S.player) { S.player.maxHp = G.maxHp; S.player.hp = Math.min(S.player.hp, G.maxHp); }
                lines.push('生命上限' + sign(v));
            }
            else if (k === 'speed') { G.speed = Math.max(1.5, +(G.speed + v).toFixed(2)); lines.push('速度' + sign(v)); }
            else if (k === 'range') { G.range = Math.max(28, G.range + v); lines.push('范围' + sign(v)); }
            else if (k === 'lifesteal') { G.lifesteal = Math.max(0, G.lifesteal + v); lines.push('吸血' + sign(v)); }
            else if (k === 'crit') { G.crit = clamp(G.crit + v, 0, 80); lines.push('暴击' + sign(v) + '%'); }
            else if (k === 'hp') {
                if (S.player) {
                    let heal = v > 0 ? v : 0;
                    S.player.hp = Math.max(1, Math.min(S.player.maxHp, S.player.hp + (v < 0 ? v : heal)));
                    if (S.player.hp <= 0) { S.player.hp = 1; }
                }
                lines.push('当前生命' + sign(v));
            }
            else if (k === 'cult') {
                gainCultivation(v);
                lines.push('修为' + sign(v));
            }
            else if (k === 'combo') {
                G.combo = (G.combo || 0) + v;
                lines.push('连击' + sign(v));
            }
            else if (k === 'pierce') {
                G.pierce = (G.pierce || 0) + v;
                lines.push('穿透' + sign(v));
            }
            else if (k === 'dodge') {
                G.dodge = (G.dodge || 0) + v;
                lines.push('闪避' + sign(v));
            }
            else if (k === 'shield') {
                if (S.player) {
                    S.player.shield = (S.player.shield || 0) + v;
                    S.player.shieldMax = (S.player.shieldMax || 0) + v;
                }
                lines.push('护盾' + sign(v));
            }
            else if (k === 'split') {
                G.split = (G.split || 0) + v;
                lines.push('分裂' + sign(v));
            }
            else if (k === 'explode') {
                G.explode = (G.explode || 0) + v;
                lines.push('自爆' + sign(v));
            }
        }
        G.hp = S.player ? S.player.hp : G.hp;
        updateHUD();
        return lines;
    }

    function getRunCardRank(cardId) {
        return S.cardRanks.run[cardId] || 0;
    }

    function applyRunCard(card, branchId) {
        let rank = getRunCardRank(card.id);
        if (rank >= 2 && !branchId) throw new Error('Run card evolution branch is required: ' + card.id);
        let branch = rank >= 2 ? window.getCardEvolutions(card).find(b => b.id === branchId) : null;
        if (rank >= 2 && !branch) throw new Error('Missing run card evolution: ' + card.id);
        let firstCurseAcquisition = card.type !== 'cursed' || rank === 0;
        let lines = firstCurseAcquisition ? applyCardEffects(card.effects) : [];
        if (firstCurseAcquisition && card.monsterEffects) lines = lines.concat(applyRunMonsterEffects(card.monsterEffects, rank));
        if (firstCurseAcquisition && card.curseGift) {
            let curseLines = card.curseCost ? applyMonsterCurseConsequences(card) : ['特殊机缘：' + applyCurseGift(card)];
            lines = lines.concat(curseLines);
        }
        if (card.type === 'cursed' && rank === 1) lines = lines.concat(applyCurseDuplicateBonus(card, 'run'));
        if (rank >= 2) {
            if (card.type === 'cursed') {
                lines = lines.concat(applyCurseEvolution(branch, 'run'));
            } else if (card.type === 'monster') {
                lines = lines.concat(applyRunMonsterEffects(branch.effects, rank));
            } else {
                lines = lines.concat(applyCardEffects(branch.effects));
            }
            if (S.player) {
                S.effects.push({ type: 'evolution', x: S.player.x, y: S.player.y, color: card.type === 'monster' ? '#ff687d' : '#ffd76a', t: 0, life: 0.8 });
                floatText(S.player.x, S.player.y - 45, '✦ 进化·' + branch.name, '#ffe27a');
            }
        }
        if (card.type === 'cursed') G.flags.cursedPicks = (G.flags.cursedPicks || 0) + 1;
        S.cardRanks.run[card.id] = Math.min(3, rank + 1);
        return lines;
    }

    function applyRunMonsterEffects(effects, rank) {
        let lines = [];
        const labels = {
            hpMul: '妖魔生命', atkMul: '妖魔攻击', spdMul: '妖魔速度',
            cntAdd: '妖魔数量', forceElite: '精英妖魔', shield: '妖魔护盾',
            regen: '妖魔回复', thorns: '妖魔反伤', split: '妖魔分裂',
            explode: '妖魔自爆', teleport: '妖魔瞬移', summonCd: '召唤间隔'
        };
        for (let key in effects) {
            let value = effects[key];
            if ((key === 'summonCd' || key === 'teleport') && rank > 0) {
                S.monsterMods[key] = Math.max(1, (S.monsterMods[key] || value) - 1);
            } else {
                applyMonsterModifier(key, value);
            }
            let change = key === 'hpMul' || key === 'atkMul' || key === 'spdMul' ?
                (value > 1 ? '+' : '') + Math.round((value - 1) * 100) + '%' :
                typeof value === 'boolean' ? (value ? '开启' : '关闭') : value;
            lines.push((labels[key] || key) + change);
        }
        return lines;
    }

    function nextFloor() {
        if (S.floor >= window.DUNGEON_FLOORS) {
            finishRun(true);
            return;
        }
        S.state = 'playing';
        spawnFloor(S.floor + 1);
        saveGame(false);
    }

    function finishRun(cleared) {
        S.running = false;
        S.state = 'idle';
        if (cleared) {
            G.flags.clears = (G.flags.clears || 0) + 1;
            if (S.noDeathRun) {
                G.flags.noDeathClear = (G.flags.noDeathClear || 0) + 1;
            }
            gainCultivation(150 + S.floor * 15);
            toast('👑 秘境通关！奖励修为+' + (150 + S.floor * 15), 'gold');
            G.hp = S.player ? S.player.hp : G.maxHp;
            checkAchievements();
            saveGame(true);
            onRunClear();
        }
    }

    function onFloorClear(floor) {
        if (typeof window.onDungeonFloorClear === 'function') {
            window.onDungeonFloorClear(floor);
        }
    }

    function onPlayerDeath() {
        toast('💀 你被击倒了……被秘境之力送回入口', 'bad');
        G.hp = 1;
        checkAchievements();
        saveGame(false);
        if (typeof window.onDungeonDeath === 'function') {
            window.onDungeonDeath();
        }
    }

    function onRunClear() {
        if (typeof window.onDungeonClear === 'function') {
            window.onDungeonClear();
        }
    }

    function createFloorScenery(floor) {
        let seed = (S.mapSeed + floor * 7919 + 104729) % 2147483647;
        const random = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
        let terrain = floor === 1 ? 'forest' :
            floor <= 3 ? 'ruins' :
            floor === 4 ? 'bones' :
            floor === 5 ? 'mine' :
            floor === 6 ? 'bamboo' :
            floor === 7 ? 'lava' :
            floor === 8 ? 'temple' :
            floor === 9 ? 'ice' : 'altar';
        let scenery = [];
        const add = (type, count, minSize, maxSize, color) => {
            for (let i = 0; i < count; i++) {
                let x = PAD + 18 + random() * (W - PAD * 2 - 36);
                let y = PAD + 18 + random() * (H - PAD * 2 - 36);
                if (x > W * 0.36 && x < W * 0.64 && y > H * 0.67) {
                    y = PAD + 25 + random() * (H * 0.43);
                }
                scenery.push({
                    type, x, y,
                    size: minSize + random() * (maxSize - minSize),
                    turn: random() * Math.PI * 2,
                    color: color[Math.floor(random() * color.length)],
                    phase: random() * Math.PI * 2
                });
            }
        };
        if (terrain === 'forest' || terrain === 'bamboo') {
            add(terrain === 'forest' ? 'shrub' : 'bamboo', 24, 12, 28, terrain === 'forest' ? ['#254e3a', '#396448', '#527044'] : ['#3f704b', '#5d8556', '#2f5e43']);
            add('flower', 34, 2, 5, ['#c7a76a', '#e3c97a', '#8dbf81']);
            add('stone', 22, 5, 13, ['#55534d', '#736c5c', '#494950']);
        } else if (terrain === 'bones') {
            add('bone', 17, 12, 24, ['#c2b99d', '#ddd1ad', '#a69a81']);
            add('bonepile', 11, 17, 29, ['#8d897a', '#a69b83']);
            add('stone', 15, 5, 14, ['#615b57', '#77716a']);
        } else if (terrain === 'mine') {
            add('crystal', 17, 13, 27, ['#62d6bd', '#7df9d0', '#a5e9d1']);
            add('ore', 18, 9, 20, ['#72574d', '#8b694d', '#a88957']);
            add('stone', 17, 5, 14, ['#52464b', '#73605c']);
        } else if (terrain === 'lava') {
            add('basalt', 22, 10, 24, ['#51413d', '#65504a', '#433c43']);
            add('ember', 32, 2, 5, ['#ff803d', '#ffd166', '#e44f35']);
            add('crystal', 9, 11, 22, ['#f27148', '#ffad54']);
        } else if (terrain === 'ice') {
            add('ice', 21, 12, 27, ['#83d9ee', '#c8f5f3', '#7faec9']);
            add('icepool', 12, 20, 40, ['#6db6d0', '#97dfeb']);
            add('stone', 14, 6, 16, ['#687c85', '#718c95']);
        } else if (terrain === 'temple' || terrain === 'altar') {
            add('pillar', terrain === 'altar' ? 12 : 10, 22, 40, ['#897455', '#a18c67', '#6e5b50']);
            add('rune', 20, 5, 12, ['#d2b56f', '#b69ce9', '#79d8c5']);
            add('brazier', terrain === 'altar' ? 8 : 5, 12, 19, ['#ff9c4d', '#ffd166']);
            add('stone', 18, 5, 14, ['#67584c', '#81705c']);
        } else {
            add('rubble', 25, 8, 22, ['#57504e', '#71645c', '#47464c']);
            add('rune', 24, 5, 13, ['#8c77d2', '#6ed9c6', '#b69ce9']);
            add('stone', 20, 5, 14, ['#4f4b51', '#6b6261']);
        }
        return scenery;
    }

    function createFloorLandmarks(floor) {
        let seed = (S.mapSeed + floor * 104729) % 2147483647;
        const random = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
        let terrain = floor === 1 ? 'forest' :
            floor <= 3 ? 'ruins' :
            floor === 4 ? 'bones' :
            floor === 5 ? 'mine' :
            floor === 6 ? 'bamboo' :
            floor === 7 ? 'lava' :
            floor === 8 ? 'temple' :
            floor === 9 ? 'ice' : 'altar';
        const options = {
            forest: ['grove', 'pool', 'fallen-log'],
            ruins: ['broken-wall', 'sunken-court', 'obelisk'],
            bones: ['bone-pit', 'rib-cage', 'bone-pile'],
            mine: ['crystal-vein', 'ore-field', 'collapsed-shaft'],
            bamboo: ['bamboo-grove', 'stream', 'fallen-log'],
            lava: ['lava-rift', 'basalt-island', 'ember-crater'],
            temple: ['sunken-court', 'obelisk', 'broken-wall'],
            ice: ['frozen-pond', 'ice-spines', 'stream'],
            altar: ['ritual-ring', 'obelisk', 'basalt-island']
        };
        const colors = {
            forest: ['#43654a', '#718255'], ruins: ['#706477', '#8f816f'],
            bones: ['#887c67', '#c1b28d'], mine: ['#398c7a', '#a77f50'],
            bamboo: ['#47704b', '#83a35b'], lava: ['#763e35', '#de6843'],
            temple: ['#85704d', '#baa36c'], ice: ['#5b9fb2', '#b5e2e6'],
            altar: ['#6a467b', '#bc79d5']
        };
        let landmarks = [];
        let kinds = options[terrain] || options.ruins;
        let count = 3 + Math.floor(random() * 2);
        for (let i = 0; i < count; i++) {
                let type = kinds[Math.floor(random() * kinds.length)];
                let w = 78 + random() * 95;
                let h = 48 + random() * 63;
                let clearance = Math.max(w, h) * 0.55 + 44;
                let x, y, tries = 0;
                const isAvailable = (candidateX, candidateY) =>
                    Math.hypot(candidateX - W / 2, candidateY - (H - 70)) >= clearance + 50 &&
                    Math.hypot(candidateX - W / 2, candidateY - (PAD + 70)) >= clearance + 30 &&
                    landmarks.every(item => Math.hypot(candidateX - item.x, candidateY - item.y) >=
                        Math.max(item.w, item.h) * 0.55 + clearance);
                do {
                    x = W * (0.17 + random() * 0.66);
                    y = H * (0.16 + random() * 0.65);
                    tries++;
                } while (tries < 40 && !isAvailable(x, y));
                if (!isAvailable(x, y)) {
                    let found = false;
                    for (let gridY = H * 0.16; gridY <= H * 0.81 && !found; gridY += 24) {
                        for (let gridX = W * 0.17; gridX <= W * 0.83; gridX += 24) {
                            if (!isAvailable(gridX, gridY)) continue;
                            x = gridX;
                            y = gridY;
                            found = true;
                            break;
                        }
                    }
                    if (!found) continue;
                }
            let solidTypes = ['grove', 'fallen-log', 'broken-wall', 'obelisk',
                'bone-pit', 'rib-cage', 'bone-pile', 'crystal-vein',
                'collapsed-shaft', 'bamboo-grove', 'basalt-island', 'ice-spines'];
                landmarks.push({
                    type,
                    solid: solidTypes.indexOf(type) >= 0,
                    x, y, w, h,
                    turn: random() * Math.PI * 2,
                    color: colors[terrain][Math.floor(random() * colors[terrain].length)],
                    phase: random() * Math.PI * 2
                });
        }
        return landmarks;
    }

    function createFloorTraps(floor) {
        const types = {
            1: 'roots', 2: 'blade', 3: 'sinkhole', 4: 'bone', 5: 'crystal',
            6: 'miasma', 7: 'fire', 8: 'rune', 9: 'ice', 10: 'altar'
            };
            const details = {
                roots: { name: '缠灵藤·束足', hint: '缠住后移动减慢', color: '#83d378', damage: 8, damageRatio: 0.08, slow: 1.4 },
                blade: { name: '回风双刃', hint: '旋刃沿直线扫击', color: '#d9b16b', damage: 12, damageRatio: 0.12, knockback: 28 },
                sinkhole: { name: '流沙陷环', hint: '外环伤人并吸向中心', color: '#c79a65', damage: 13, damageRatio: 0.12, slow: 0.7 },
                bone: { name: '白骨潮汐', hint: '六道骨刃旋扫', color: '#e2d1ae', damage: 13, damageRatio: 0.13, knockback: 20 },
                crystal: { name: '灵晶飞爆', hint: '晶刺从中心向外弹射', color: '#75e8d2', damage: 10, damageRatio: 0.1 },
                miasma: { name: '腐心瘴云', hint: '中毒后持续损失生命', color: '#91c46d', damage: 8, damageRatio: 0.07, poison: 3.2 },
                fire: { name: '地火喷口', hint: '离开火口以免持续灼烧', color: '#ff743e', damage: 14, damageRatio: 0.12, burn: 2.25, burnDamage: 0.025 },
                rune: { name: '镇魂禁攻阵', hint: '受击后攻击间隔延长', color: '#d4a0ff', damage: 11, damageRatio: 0.1, attackSlow: 3 },
                ice: { name: '寒潭滑裂', hint: '踏入后会惯性滑行', color: '#9defff', damage: 9, damageRatio: 0.09, slide: 1.4 },
                altar: { name: '蟒巢聚灵坛', hint: '范围内妖兽会周期回春', color: '#e692ff', damage: 15, damageRatio: 0.14 }
            };
            let type = types[floor] || 'rune';
            let trapCount = floor >= 10 ? 3 : floor >= 6 ? 4 : 3;
        let traps = [];
        let attempts = 0;
        while (traps.length < trapCount && attempts < 60) {
            attempts++;
            let trap = Object.assign({}, randomArenaPosition(PAD + 60, H - PAD - 60, 38), details[type], {
                id: floor + '-' + traps.length,
                type,
                radius: 44 + (floor >= 6 && floor < 10 ? 5 : 0),
                period: 3.8 + Math.random() * 0.8,
                warning: 1.2 + Math.random() * 0.3,
                activeDuration: 1.35 + Math.random() * 0.4,
                phase: 0,
                playerCycle: -1,
                playerNextHit: 0
            });
            trap.phase = (trap.period - (S.time % trap.period)) % trap.period;
            if (Math.hypot(trap.x - W / 2, trap.y - (H - 70)) < 125) continue;
            if (traps.some(other => Math.hypot(trap.x - other.x, trap.y - other.y) < 110)) continue;
            traps.push(trap);
        }
        return traps;
    }

    function createArena(floor) {
        const layouts = {
            1: [[.08,.03],[.92,.03],[.99,.20],[.87,.44],[.96,.78],[.77,.97],[.23,.97],[.04,.78],[.13,.44],[.01,.20]],
            2: [[.24,.03],[.76,.03],[.97,.22],[.97,.76],[.76,.97],[.24,.97],[.03,.76],[.03,.22]],
            3: [[.14,.03],[.86,.03],[.98,.30],[.88,.75],[.72,.97],[.28,.97],[.12,.75],[.02,.30]],
            4: [[.17,.03],[.83,.03],[.99,.38],[.82,.97],[.18,.97],[.01,.38]],
            5: [[.34,.03],[.66,.03],[.89,.15],[.82,.86],[.65,.97],[.35,.97],[.18,.86],[.11,.15]],
            6: [[.12,.03],[.88,.03],[.98,.18],[.90,.84],[.78,.97],[.22,.97],[.10,.84],[.02,.18]],
            7: [[.15,.03],[.85,.03],[.96,.16],[.86,.31],[.99,.46],[.87,.62],[.95,.83],[.76,.97],[.24,.97],[.05,.83],[.13,.62],[.01,.46],[.14,.31],[.04,.16]],
            8: [[.22,.03],[.78,.03],[.97,.22],[.97,.78],[.78,.97],[.22,.97],[.03,.78],[.03,.22]],
            9: [[.20,.03],[.80,.03],[.98,.25],[.87,.43],[.95,.76],[.72,.97],[.28,.97],[.05,.76],[.13,.43],[.02,.25]],
            10: [[.50,.02],[.84,.13],[.98,.45],[.84,.82],[.50,.97],[.16,.82],[.02,.45],[.16,.13]],
            11: [[.08,.06],[.34,.04],[.64,.02],[.90,.10],[.97,.32],[.86,.56],[.94,.80],[.74,.96],[.26,.97],[.06,.78],[.12,.52],[.02,.32]],
            12: [[.16,.04],[.46,.02],[.75,.10],[.96,.35],[.87,.74],[.69,.96],[.31,.97],[.13,.78],[.02,.38],[.10,.20]],
            13: [[.10,.22],[.26,.04],[.62,.02],[.86,.14],[.97,.42],[.90,.72],[.70,.96],[.30,.97],[.04,.76],[.08,.48],[.02,.24]],
            14: [[.12,.03],[.38,.04],[.58,.18],[.86,.10],[.98,.36],[.90,.60],[.96,.83],[.78,.95],[.22,.97],[.04,.82],[.10,.48],[.02,.20]]
        };
        let base = layouts[floor] || layouts[1];
        let seed = (S.mapSeed + floor * 31337) % 2147483647;
        const random = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
        return base.map((point, index) => {
            let amplitude = floor >= 7 ? 0.052 : 0.038;
            let waveX = (random() - 0.5) * amplitude;
            let waveY = (random() - 0.5) * amplitude * 0.85;
            if (index === 0 || index === base.length - 1) waveY *= 0.55;
            return [clamp(point[0] + waveX, 0.025, 0.975), clamp(point[1] + waveY, 0.025, 0.975)];
        });
    }

    function arenaVertices() {
        return S.arena.map(point => ({
            x: PAD + point[0] * (W - PAD * 2),
            y: PAD + point[1] * (H - PAD * 2)
        }));
    }

    function isInsideArena(x, y) {
        let vertices = arenaVertices();
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            let a = vertices[i], b = vertices[j];
            if ((a.y > y) !== (b.y > y) &&
                x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    function isBlockedByLandmark(x, y, radius) {
        for (let landmark of S.landmarks) {
            if (!landmark.solid) continue;
            let dx = x - landmark.x, dy = y - landmark.y;
            let cos = Math.cos(landmark.turn), sin = Math.sin(landmark.turn);
            let localX = dx * cos + dy * sin;
            let localY = -dx * sin + dy * cos;
            let rx = landmark.w * 0.43 + radius;
            let ry = landmark.h * 0.36 + radius;
            if ((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) < 1) return true;
        }
        return false;
    }

    function resolveArenaPosition(x, y, radius) {
        let position = constrainToArena(x, y, radius);
        for (let pass = 0; pass < 4; pass++) {
            let moved = false;
            for (let landmark of S.landmarks) {
                if (!landmark.solid) continue;
                let dx = position.x - landmark.x, dy = position.y - landmark.y;
                let cos = Math.cos(landmark.turn), sin = Math.sin(landmark.turn);
                let localX = dx * cos + dy * sin;
                let localY = -dx * sin + dy * cos;
                let rx = landmark.w * 0.43 + radius;
                let ry = landmark.h * 0.36 + radius;
                let distanceSq = (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry);
                if (distanceSq >= 1) continue;
                if (distanceSq < 0.0001) {
                    if (rx <= ry) localX = rx * 1.015;
                    else localY = ry * 1.015;
                } else {
                    let scale = 1.015 / Math.sqrt(distanceSq);
                    localX *= scale;
                    localY *= scale;
                }
                position = constrainToArena(
                    landmark.x + localX * cos - localY * sin,
                    landmark.y + localX * sin + localY * cos,
                    radius);
                moved = true;
            }
            if (!moved) break;
        }
        return position;
    }

    function constrainToArena(x, y, radius) {
        if (isInsideArena(x, y)) {
            let vertices = arenaVertices();
            let nearest = null;
            let minDistance = Infinity;
            for (let i = 0; i < vertices.length; i++) {
                let a = vertices[i], b = vertices[(i + 1) % vertices.length];
                let dx = b.x - a.x, dy = b.y - a.y;
                let lengthSq = dx * dx + dy * dy || 1;
                let t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSq, 0, 1);
                let qx = a.x + t * dx, qy = a.y + t * dy;
                let distance = Math.hypot(x - qx, y - qy);
                if (distance < minDistance) { minDistance = distance; nearest = { x: qx, y: qy }; }
            }
            if (minDistance >= radius + 2) return { x, y };
            let center = vertices.reduce((sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }), { x: 0, y: 0 });
            let dx = center.x - nearest.x, dy = center.y - nearest.y;
            let length = Math.hypot(dx, dy) || 1;
            return { x: nearest.x + dx / length * (radius + 3), y: nearest.y + dy / length * (radius + 3) };
        }
        let vertices = arenaVertices();
        let center = vertices.reduce((sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }), { x: 0, y: 0 });
        let nearest = null, minDistance = Infinity;
        for (let i = 0; i < vertices.length; i++) {
            let a = vertices[i], b = vertices[(i + 1) % vertices.length];
            let dx = b.x - a.x, dy = b.y - a.y;
            let lengthSq = dx * dx + dy * dy || 1;
            let t = clamp(((x - a.x) * dx + (y - a.y) * dy) / lengthSq, 0, 1);
            let qx = a.x + t * dx, qy = a.y + t * dy;
            let distance = Math.hypot(x - qx, y - qy);
            if (distance < minDistance) { minDistance = distance; nearest = { x: qx, y: qy }; }
        }
        let dx = center.x - nearest.x, dy = center.y - nearest.y;
        let length = Math.hypot(dx, dy) || 1;
        return { x: nearest.x + dx / length * (radius + 3), y: nearest.y + dy / length * (radius + 3) };
    }

    function randomArenaPosition(minY, maxY, radius) {
        let vertices = arenaVertices();
        let minX = Math.min(...vertices.map(point => point.x)) + radius;
        let maxX = Math.max(...vertices.map(point => point.x)) - radius;
        for (let i = 0; i < 100; i++) {
            let x = minX + Math.random() * (maxX - minX);
            let y = minY + Math.random() * (maxY - minY);
            if (!isInsideArena(x, y) || isBlockedByLandmark(x, y, radius)) continue;
            return constrainToArena(x, y, radius);
        }
        let center = vertices.reduce((sum, point) => ({ x: sum.x + point.x / vertices.length, y: sum.y + point.y / vertices.length }), { x: 0, y: 0 });
        for (let y = minY; y <= maxY; y += 24) {
            for (let x = minX; x <= maxX; x += 24) {
                if (isInsideArena(x, y) && !isBlockedByLandmark(x, y, radius)) return { x, y };
            }
        }
        return resolveArenaPosition(center.x, center.y, radius);
    }

    function drawFloorScene() {
        const themes = [
            { tint: 'rgba(49,100,61,0.30)', glow: '#83d378', trim: '#a8c278', ground: '#17231b' },
            { tint: 'rgba(57,62,108,0.32)', glow: '#9b83d9', trim: '#b3a2ce', ground: '#1a1928' },
            { tint: 'rgba(40,39,71,0.42)', glow: '#8767d8', trim: '#9b8fb8', ground: '#171321' },
            { tint: 'rgba(113,91,70,0.34)', glow: '#d0b07c', trim: '#c9a978', ground: '#241d1a' },
            { tint: 'rgba(38,100,88,0.34)', glow: '#78e4c1', trim: '#9bd8bd', ground: '#152321' },
            { tint: 'rgba(43,104,68,0.35)', glow: '#a3d874', trim: '#a5c68e', ground: '#17251c' },
            { tint: 'rgba(136,48,35,0.37)', glow: '#ff753e', trim: '#d8895c', ground: '#251513' },
            { tint: 'rgba(126,89,43,0.35)', glow: '#e3bc68', trim: '#d0b273', ground: '#211b13' },
            { tint: 'rgba(57,119,150,0.36)', glow: '#9defff', trim: '#aed3da', ground: '#142027' },
            { tint: 'rgba(83,50,129,0.40)', glow: '#dd93ff', trim: '#d8ad75', ground: '#1e1424' }
        ];
        let theme = themes[Math.max(0, Math.min(themes.length - 1, S.floor - 1))];
        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.beginPath();
        traceArenaPath();
        ctx.closePath();
        ctx.clip();
        if (floorPattern) {
            ctx.fillStyle = floorPattern;
            ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        }
        ctx.fillStyle = theme.tint;
        ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        ctx.fillStyle = 'rgba(7,4,12,0.38)';
        ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        let haze = ctx.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 520);
        haze.addColorStop(0, 'rgba(255,255,255,0.035)');
        haze.addColorStop(1, 'rgba(5,3,12,0.4)');
        ctx.fillStyle = haze;
        ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        let pool = ctx.createRadialGradient(W / 2, H * 0.53, 25, W / 2, H * 0.53, 310);
        pool.addColorStop(0, theme.glow + '1c');
        pool.addColorStop(1, theme.glow + '00');
        ctx.fillStyle = pool;
        ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        drawTerrainFeatures(S.floor, theme);
        drawLandmarks(theme);
        for (let d of S.scenery) drawSceneryObject(d, theme);
        drawAmbientMotes(theme);
        ctx.restore();

        ctx.strokeStyle = theme.trim;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 10;
        traceArenaPath();
        ctx.stroke();
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2;
        traceArenaPath(12);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }

    function traceArenaPath(inset) {
        let points = arenaVertices();
        ctx.beginPath();
        points.forEach((point, index) => {
            let x = point.x, y = point.y;
            if (inset) {
                let center = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
                let dx = center.x - x, dy = center.y - y, len = Math.hypot(dx, dy) || 1;
                x += dx / len * inset;
                y += dy / len * inset;
            }
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
    }
    function drawTerrainFeatures(floor, theme) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (floor === 1 || floor === 6) {
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = floor === 1 ? '#bea776' : '#c1d495';
            ctx.lineWidth = 43;
            ctx.beginPath();
            ctx.moveTo(W * 0.51, H - PAD);
            ctx.bezierCurveTo(W * 0.42, H * 0.77, W * 0.64, H * 0.66, W * 0.52, H * 0.5);
            ctx.bezierCurveTo(W * 0.38, H * 0.33, W * 0.62, H * 0.22, W * 0.48, PAD);
            ctx.stroke();
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = '#f2d7a0';
            ctx.lineWidth = 2;
            ctx.setLineDash([12, 16]);
            ctx.stroke();
        } else if (floor === 2 || floor === 3) {
            ctx.globalAlpha = 0.18;
            ctx.strokeStyle = '#c8b9de';
            ctx.lineWidth = 2;
            for (let i = -2; i <= 10; i++) {
                let x = i * 120;
                ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x + 95, H - PAD); ctx.stroke();
            }
            for (let y = PAD + 40; y < H - PAD; y += 64) {
                ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
            }
        } else if (floor === 4) {
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = '#e2ceaa';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                let x = PAD + i * 122;
                let y = PAD + ((i * 71) % 340);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 26, y + 23);
                ctx.lineTo(x + 18, y + 44);
                ctx.lineTo(x + 47, y + 69);
                ctx.stroke();
            }
        } else if (floor === 5) {
            ctx.globalAlpha = 0.22;
            ctx.strokeStyle = '#ba9a70';
            ctx.lineWidth = 3;
            for (let i = -1; i < 5; i++) {
                let offset = i * 42;
                ctx.beginPath();
                ctx.moveTo(PAD + 30 + offset, H - PAD);
                ctx.lineTo(W * 0.42 + offset, PAD);
                ctx.stroke();
            }
            ctx.strokeStyle = '#d0b17a';
            ctx.globalAlpha = 0.18;
            ctx.lineWidth = 2;
            for (let i = 0; i < 16; i++) {
                let t = i / 16;
                let x = PAD + 30 + (W * 0.42 - PAD - 30) * t;
                let y = H - PAD - (H - PAD * 2) * t;
                ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.stroke();
            }
        } else if (floor === 7) {
            ctx.globalAlpha = 0.32;
            ctx.strokeStyle = '#ef5836';
            ctx.shadowColor = '#ed5736';
            ctx.shadowBlur = 13;
            ctx.lineWidth = 4;
            const cracks = [
                [[PAD, 155], [180, 178], [230, 143], [310, 177]],
                [[660, PAD], [634, 105], [716, 149], [735, 214]],
                [[325, 385], [382, 357], [417, 399], [480, 374]],
                [[W - PAD, 310], [820, 337], [784, 308], [720, 348]],
                [[130, H - PAD], [166, 446], [228, 461], [270, 418]]
            ];
            for (let crack of cracks) {
                ctx.beginPath();
                ctx.moveTo(crack[0][0], crack[0][1]);
                for (let i = 1; i < crack.length; i++) ctx.lineTo(crack[i][0], crack[i][1]);
                ctx.stroke();
            }
        } else if (floor === 8 || floor === 10) {
            ctx.globalAlpha = floor === 10 ? 0.26 : 0.18;
            ctx.strokeStyle = floor === 10 ? '#d98bff' : '#d8bd79';
            ctx.lineWidth = 3;
            let cx = W / 2, cy = floor === 10 ? H * 0.45 : H * 0.5;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.ellipse(cx, cy, 62 + i * 42, 34 + i * 24, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 12; i++) {
                let angle = i * Math.PI / 6;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * 42, cy + Math.sin(angle) * 24);
                ctx.lineTo(cx + Math.cos(angle) * 205, cy + Math.sin(angle) * 122);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = theme.trim;
            ctx.lineWidth = 1;
            for (let y = PAD + 24; y < H - PAD; y += 52) {
                ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
            }
        } else if (floor === 9) {
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = '#9defff';
            ctx.lineWidth = 54;
            ctx.beginPath();
            ctx.moveTo(PAD, H * 0.38);
            ctx.bezierCurveTo(W * 0.28, H * 0.56, W * 0.67, H * 0.3, W - PAD, H * 0.52);
            ctx.stroke();
            ctx.globalAlpha = 0.22;
            ctx.strokeStyle = '#e1ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(PAD, H * 0.38);
            ctx.bezierCurveTo(W * 0.28, H * 0.56, W * 0.67, H * 0.3, W - PAD, H * 0.52);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawLandmarks(theme) {
        for (let d of S.landmarks) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.turn);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = 'rgba(5,8,12,0.48)';
            ctx.beginPath();
            ctx.ellipse(4, d.h * 0.16, d.w * 0.58, d.h * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.78;
            ctx.fillStyle = d.color;
            ctx.strokeStyle = theme.trim;
            ctx.lineWidth = 2;

            if (d.type === 'pool' || d.type === 'stream' || d.type === 'frozen-pond' ||
                d.type === 'lava-rift' || d.type === 'sunken-court' ||
                d.type === 'ritual-ring' || d.type === 'ember-crater') {
                ctx.beginPath();
                ctx.ellipse(0, 0, d.w * 0.58, d.h * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.68;
                ctx.strokeStyle = d.type === 'lava-rift' || d.type === 'ember-crater' ? '#ffb366' :
                    d.type === 'frozen-pond' || d.type === 'stream' ? '#d8fbff' : theme.trim;
                ctx.lineWidth = d.type === 'ritual-ring' ? 3 : 2;
                for (let i = 0; i < (d.type === 'ritual-ring' ? 3 : 2); i++) {
                    ctx.beginPath();
                    ctx.ellipse(0, 0, d.w * (0.3 + i * 0.14), d.h * (0.2 + i * 0.1),
                        Math.sin(d.phase + i) * 0.12, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else if (d.type === 'grove' || d.type === 'bamboo-grove') {
                for (let i = 0; i < 5; i++) {
                    let angle = i * 2.4 + d.phase;
                    let x = Math.cos(angle) * d.w * 0.32;
                    let y = Math.sin(angle) * d.h * 0.25;
                    ctx.fillStyle = i % 2 ? d.color : theme.glow;
                    ctx.beginPath();
                    ctx.ellipse(x, y, d.w * 0.19, d.h * 0.21, angle, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (d.type === 'fallen-log' || d.type === 'broken-wall' ||
                d.type === 'collapsed-shaft' || d.type === 'rib-cage') {
                ctx.lineWidth = Math.max(7, d.h * 0.16);
                ctx.strokeStyle = d.color;
                ctx.beginPath();
                ctx.moveTo(-d.w * 0.5, d.h * 0.22);
                ctx.quadraticCurveTo(0, -d.h * 0.38, d.w * 0.5, d.h * 0.2);
                ctx.stroke();
                ctx.lineWidth = 2;
                ctx.strokeStyle = theme.trim;
                for (let i = -2; i <= 2; i++) {
                    let x = i * d.w * 0.16;
                    ctx.beginPath();
                    ctx.moveTo(x, d.h * 0.1);
                    ctx.lineTo(x + Math.sin(d.phase + i) * 9, -d.h * 0.26);
                    ctx.stroke();
                }
            } else if (d.type === 'crystal-vein' || d.type === 'ice-spines') {
                for (let i = -2; i <= 2; i++) {
                    let x = i * d.w * 0.17;
                    let height = d.h * (0.34 + ((i + 2) % 3) * 0.14);
                    ctx.beginPath();
                    ctx.moveTo(x - 9, d.h * 0.28);
                    ctx.lineTo(x, -height);
                    ctx.lineTo(x + 10, d.h * 0.28);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (d.type === 'obelisk') {
                ctx.beginPath();
                ctx.moveTo(-d.w * 0.19, d.h * 0.36);
                ctx.lineTo(-d.w * 0.14, -d.h * 0.34);
                ctx.lineTo(0, -d.h * 0.52);
                ctx.lineTo(d.w * 0.14, -d.h * 0.34);
                ctx.lineTo(d.w * 0.19, d.h * 0.36);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, -d.h * 0.25);
                ctx.lineTo(0, d.h * 0.2);
                ctx.stroke();
            } else {
                for (let i = 0; i < 5; i++) {
                    let x = (i - 2) * d.w * 0.17;
                    let y = Math.sin(i * 2 + d.phase) * d.h * 0.13;
                    ctx.beginPath();
                    ctx.ellipse(x, y, d.w * (0.13 + (i % 2) * 0.04), d.h * 0.2,
                        (i - 2) * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }

    function drawSceneryObject(d, theme) {
        let s = d.size;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.turn);
        ctx.globalAlpha = 0.72;
        if (d.type === 'stone' || d.type === 'ore' || d.type === 'basalt' || d.type === 'rubble') {
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.moveTo(-s * 0.7, s * 0.25);
            ctx.lineTo(-s * 0.45, -s * 0.35);
            ctx.lineTo(s * 0.05, -s * 0.52);
            ctx.lineTo(s * 0.62, -s * 0.12);
            ctx.lineTo(s * 0.48, s * 0.38);
            ctx.lineTo(-s * 0.12, s * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(230,221,193,0.16)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (d.type === 'ore') {
                ctx.fillStyle = '#f4d189';
                ctx.globalAlpha = 0.55;
                ctx.fillRect(-s * 0.18, -s * 0.1, 3, 3);
                ctx.fillRect(s * 0.12, s * 0.05, 2, 2);
            } else if (d.type === 'basalt') {
                ctx.strokeStyle = 'rgba(255,105,51,0.5)';
                ctx.beginPath(); ctx.moveTo(-s * 0.25, 0); ctx.lineTo(0, -s * 0.15); ctx.lineTo(s * 0.22, s * 0.14); ctx.stroke();
            }
        } else if (d.type === 'shrub' || d.type === 'bamboo') {
            if (d.type === 'shrub') {
                ctx.fillStyle = '#101711';
                ctx.beginPath(); ctx.ellipse(2, s * 0.35, s * 0.78, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = d.color;
                ctx.beginPath();
                ctx.arc(-s * 0.35, 0, s * 0.42, 0, Math.PI * 2);
                ctx.arc(s * 0.12, -s * 0.18, s * 0.5, 0, Math.PI * 2);
                ctx.arc(s * 0.47, s * 0.05, s * 0.36, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(183,221,142,0.32)';
                ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.42, 3.6, 5.5); ctx.stroke();
            } else {
                ctx.fillStyle = d.color;
                ctx.fillRect(-s * 0.17, -s, s * 0.34, s * 2);
                ctx.strokeStyle = 'rgba(214,230,164,0.45)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-s * 0.17, -s * 0.3); ctx.lineTo(s * 0.17, -s * 0.3);
                ctx.moveTo(-s * 0.17, s * 0.45); ctx.lineTo(s * 0.17, s * 0.45);
                ctx.moveTo(0, -s * 0.55); ctx.lineTo(-s * 0.85, -s * 1.1);
                ctx.moveTo(0, -s * 0.45); ctx.lineTo(s * 0.8, -s * 1.05);
                ctx.stroke();
            }
        } else if (d.type === 'flower' || d.type === 'ember' || d.type === 'rune') {
            let pulse = d.type === 'ember' ? 0.6 + Math.sin(S.time * 4 + d.phase) * 0.25 : 0.8;
            ctx.globalAlpha = pulse;
            ctx.shadowColor = d.color;
            ctx.shadowBlur = d.type === 'flower' ? 3 : 10;
            ctx.fillStyle = d.color;
            if (d.type === 'rune') {
                ctx.strokeStyle = d.color;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.65, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.65, 0); ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(0, 0, d.type === 'ember' ? s : s * 0.65, 0, Math.PI * 2); ctx.fill();
                if (d.type === 'flower') {
                    ctx.fillStyle = '#e8d58c';
                    ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2); ctx.fill();
                }
            }
        } else if (d.type === 'crystal' || d.type === 'ice') {
            ctx.globalAlpha = 0.75;
            ctx.shadowColor = d.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.lineTo(s * 0.38, -s * 0.18);
            ctx.lineTo(s * 0.3, s * 0.72);
            ctx.lineTo(-s * 0.33, s * 0.72);
            ctx.lineTo(-s * 0.43, -s * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(246,255,255,0.62)';
            ctx.beginPath(); ctx.moveTo(0, -s * 0.82); ctx.lineTo(s * 0.05, s * 0.55); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(-s * 0.34, -s * 0.15); ctx.lineTo(s * 0.02, -s * 0.28); ctx.fill();
        } else if (d.type === 'icepool') {
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = d.color;
            ctx.beginPath(); ctx.ellipse(0, 0, s * 1.35, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(219,250,255,0.5)';
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (d.type === 'bone' || d.type === 'bonepile') {
            ctx.strokeStyle = d.color;
            ctx.lineWidth = Math.max(3, s * 0.17);
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (d.type === 'bone') {
                ctx.moveTo(-s * 0.65, -s * 0.45); ctx.lineTo(s * 0.65, s * 0.45);
                ctx.moveTo(-s * 0.65, s * 0.45); ctx.lineTo(-s * 0.48, s * 0.22);
                ctx.moveTo(-s * 0.65, s * 0.45); ctx.lineTo(-s * 0.42, s * 0.62);
                ctx.moveTo(s * 0.65, -s * 0.45); ctx.lineTo(s * 0.45, -s * 0.64);
                ctx.moveTo(s * 0.65, -s * 0.45); ctx.lineTo(s * 0.43, -s * 0.23);
            } else {
                ctx.moveTo(-s * 0.5, 0); ctx.lineTo(s * 0.5, 0);
                ctx.moveTo(-s * 0.3, -s * 0.3); ctx.lineTo(s * 0.25, s * 0.28);
                ctx.moveTo(-s * 0.25, s * 0.3); ctx.lineTo(s * 0.38, -s * 0.25);
            }
            ctx.stroke();
        } else if (d.type === 'pillar') {
            ctx.fillStyle = 'rgba(12,10,13,0.38)';
            ctx.beginPath(); ctx.ellipse(4, s * 0.62, s * 0.55, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = d.color;
            ctx.fillRect(-s * 0.32, -s * 0.43, s * 0.64, s);
            ctx.fillRect(-s * 0.5, -s * 0.57, s, s * 0.2);
            ctx.fillRect(-s * 0.44, s * 0.48, s * 0.88, s * 0.18);
            ctx.strokeStyle = 'rgba(239,213,158,0.35)';
            ctx.strokeRect(-s * 0.32, -s * 0.43, s * 0.64, s);
        } else if (d.type === 'brazier') {
            ctx.fillStyle = '#65523d';
            ctx.fillRect(-s * 0.45, 0, s * 0.9, s * 0.42);
            ctx.fillStyle = '#9f8051';
            ctx.fillRect(-s * 0.6, -s * 0.12, s * 1.2, s * 0.18);
            ctx.globalAlpha = 0.75 + Math.sin(S.time * 5 + d.phase) * 0.2;
            ctx.shadowColor = '#ff772e';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#ff9b45';
            ctx.beginPath(); ctx.moveTo(0, -s * 1.2); ctx.quadraticCurveTo(s * 0.75, -s * 0.45, 0, -s * 0.2); ctx.quadraticCurveTo(-s * 0.6, -s * 0.65, 0, -s * 1.2); ctx.fill();
            ctx.fillStyle = '#ffe49a';
            ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawAmbientMotes(theme) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
            let phase = i * 2.399 + S.floor * 0.73;
            let x = 70 + ((i * 137 + S.time * (7 + i % 4) * 8) % (W - 140));
            let y = 55 + ((i * 83 + Math.sin(S.time * 0.7 + phase) * 24) % (H - 110));
            let alpha = 0.16 + (Math.sin(S.time * 2 + phase) + 1) * 0.14;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = theme.glow;
            ctx.beginPath();
            ctx.arc(x, y, i % 4 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawFloorTraps() {
        for (let trap of S.traps) {
            let cycle = Math.floor((S.time + trap.phase) / trap.period);
            let phaseTime = (S.time + trap.phase) % trap.period;
            let active = phaseTime >= trap.warning && phaseTime < trap.warning + trap.activeDuration;
            let warning = phaseTime >= trap.warning - 1.2 && phaseTime < trap.warning;
            let pulse = 0.5 + Math.sin(S.time * (active ? 15 : warning ? 8 : 3) + trap.phase) * 0.12;
            let alpha = active ? 0.82 + pulse * 0.15 : warning ? 0.58 + pulse * 0.2 : 0.3;
            let rotation = S.time * (trap.type === 'blade' ? 1.65 : trap.type === 'bone' ? 0.72 : active ? 1.5 : 0.35) + trap.phase;

            ctx.save();
            ctx.translate(trap.x, trap.y);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = trap.color;
            ctx.shadowColor = trap.color;
            ctx.shadowBlur = active ? 22 : warning ? 14 : 5;
            if (trap.type === 'sinkhole') {
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius * 0.82, 0, Math.PI * 2);
                ctx.arc(0, 0, trap.radius * 0.38, 0, Math.PI * 2, true);
                ctx.fill();
            } else if (trap.type === 'blade' || trap.type === 'bone') {
                ctx.strokeStyle = trap.color;
                ctx.lineWidth = active ? 8 : 4;
                ctx.beginPath();
                let lineCount = trap.type === 'blade' ? 2 : 3;
                for (let i = 0; i < lineCount; i++) {
                    let angle = i * Math.PI / lineCount + rotation;
                    ctx.moveTo(Math.cos(angle) * (trap.radius + 5), Math.sin(angle) * (trap.radius + 5));
                    ctx.lineTo(-Math.cos(angle) * (trap.radius + 5), -Math.sin(angle) * (trap.radius + 5));
                }
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, trap.radius + 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = active ? 0.95 : warning ? 0.8 : 0.45;
            ctx.strokeStyle = trap.color;
            ctx.lineWidth = active ? 3 : 2;
            ctx.setLineDash(active ? [] : [5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, trap.radius + 8 + Math.sin(S.time * 4 + trap.phase) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.rotate(rotation);
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = '#fff2d0';
            ctx.fillStyle = trap.color;
            ctx.globalAlpha = active ? 1 : warning ? 0.88 : 0.65;
            ctx.beginPath();
            if (trap.type === 'blade' || trap.type === 'bone') {
                let lineCount = trap.type === 'blade' ? 2 : 3;
                for (let i = 0; i < lineCount; i++) {
                    let angle = i * Math.PI / lineCount;
                    ctx.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9);
                    ctx.lineTo(Math.cos(angle) * (trap.radius - 4), Math.sin(angle) * (trap.radius - 4));
                    ctx.moveTo(-Math.cos(angle) * 9, -Math.sin(angle) * 9);
                    ctx.lineTo(-Math.cos(angle) * (trap.radius - 4), -Math.sin(angle) * (trap.radius - 4));
                }
            } else if (trap.type === 'sinkhole') {
                ctx.arc(0, 0, trap.radius * 0.38, 0, Math.PI * 2);
                ctx.moveTo(trap.radius * 0.82, 0);
                ctx.arc(0, 0, trap.radius * 0.82, 0, Math.PI * 2);
                ctx.moveTo(-trap.radius * 0.38, 0);
                ctx.arc(0, 0, trap.radius * 0.38, 0, Math.PI * 2, true);
            } else if (trap.type === 'miasma') {
                for (let i = 0; i < 7; i++) {
                    let angle = i * Math.PI * 2 / 7;
                    let radius = trap.radius * (i % 2 === 0 ? 0.55 : 0.72);
                    ctx.moveTo(Math.cos(angle) * (radius + 8), Math.sin(angle) * (radius + 8));
                    ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 8 + (i % 3) * 2, 0, Math.PI * 2);
                }
            } else if (trap.type === 'roots') {
                for (let i = 0; i < 4; i++) {
                    let angle = i * Math.PI / 2;
                    ctx.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5);
                    ctx.quadraticCurveTo(Math.cos(angle + 0.5) * 17, Math.sin(angle + 0.5) * 17,
                        Math.cos(angle) * (trap.radius - 3), Math.sin(angle) * (trap.radius - 3));
                }
            } else if (trap.type === 'crystal') {
                for (let i = 0; i < 6; i++) {
                    let angle = i * Math.PI / 3;
                    ctx.moveTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
                    ctx.lineTo(Math.cos(angle) * (trap.radius - 5), Math.sin(angle) * (trap.radius - 5));
                }
            } else if (trap.type === 'ice') {
                for (let i = 0; i < 6; i++) {
                    let angle = i * Math.PI / 3;
                    let x = Math.cos(angle) * (trap.radius - 5), y = Math.sin(angle) * (trap.radius - 5);
                    ctx.moveTo(-x, -y);
                    ctx.lineTo(x, y);
                }
            } else if (trap.type === 'fire' || trap.type === 'ritual' || trap.type === 'rune') {
                for (let i = 0; i < 3; i++) {
                    let angle = i * Math.PI * 2 / 3;
                    let x = Math.cos(angle) * 17, y = Math.sin(angle) * 17;
                    ctx.moveTo(x, y - 10);
                    ctx.lineTo(x + 9, y + 7);
                    ctx.lineTo(x - 9, y + 7);
                    ctx.closePath();
                }
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
            } else if (trap.type === 'storm') {
                ctx.moveTo(4, -trap.radius + 4);
                ctx.lineTo(-11, 2);
                ctx.lineTo(-1, 2);
                ctx.lineTo(-5, trap.radius - 4);
                ctx.lineTo(12, -5);
                ctx.lineTo(3, -5);
                ctx.closePath();
            } else if (trap.type === 'void') {
                ctx.arc(0, 0, 6, 0, Math.PI * 1.5);
                ctx.arc(0, 0, 14, Math.PI * 1.5, Math.PI * 3.2);
                ctx.arc(0, 0, 22, Math.PI * 0.2, Math.PI * 1.7);
            } else if (trap.type === 'altar') {
                ctx.arc(0, 0, 12 + Math.sin(S.time * 3) * 2, 0, Math.PI * 2);
                ctx.moveTo(trap.radius * 0.45, 0);
                ctx.arc(0, 0, trap.radius * 0.45, 0, Math.PI * 2);
                ctx.moveTo(trap.radius * 0.75, 0);
                ctx.arc(0, 0, trap.radius * 0.75, 0, Math.PI * 2);
            }
            if (trap.type === 'crystal' || trap.type === 'fire' || trap.type === 'rune' || trap.type === 'altar') ctx.fill();
            ctx.stroke();
            ctx.restore();

            if (warning || active) {
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
                ctx.restore();
            }
        }
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        drawFloorScene();

        if (!S.player) return;
        let p = S.player;
        drawFloorTraps();

        if (S.portal) {
            let pulse = 1 + Math.sin(S.portal.t * 4) * 0.08;
            drawSprite('portal', S.portal.x, S.portal.y, 64 * pulse, false);
        }
        for (let c of S.chests) {
            if (c.opened) {
                ctx.globalAlpha = 0.35;
                drawSprite('chest', c.x, c.y, 36, false);
                ctx.globalAlpha = 1;
            } else {
                drawSprite('chest', c.x, c.y, 40, false);
            }
        }

        for (let b of S.bullets) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = b.color || '#ff6633';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.stroke();
        }

        for (let m of S.monsters) {
            if (m.chargeWindup > 0) {
                ctx.save();
                ctx.globalAlpha = 0.45 + Math.sin(S.time * 20) * 0.15;
                ctx.strokeStyle = '#ffbf76';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x + Math.cos(m.chargeAngle) * 205, m.y + Math.sin(m.chargeAngle) * 205);
                ctx.stroke();
                ctx.restore();
            }
            if (m.tint) {
                ctx.save();
                let pulse = 1 + Math.sin(S.time * 5 + m.wob) * 0.06;
                ctx.globalAlpha = m.healer ? 0.26 : 0.55;
                ctx.fillStyle = m.tint;
                ctx.beginPath();
                ctx.arc(m.x, m.y, (m.r + (m.healer ? 11 : 5)) * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = m.tint;
                ctx.lineWidth = m.chargeWindup > 0 || m.chargeTime > 0 ? 4 : 2;
                ctx.beginPath();
                ctx.arc(m.x, m.y, (m.r + 5) * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                let marker = m.healer ? '疗' : m.blink ? '影' : m.charge ? '冲' :
                    m.splitOnDeath ? '裂' : m.slow ? '霜' : m.poison ? '毒' : '';
                if (marker) {
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                    ctx.strokeText(marker + '·' + m.name, m.x, m.y - m.draw / 2 - 16);
                    ctx.fillText(marker + '·' + m.name, m.x, m.y - m.draw / 2 - 16);
                }
                ctx.restore();
            }
            drawSprite(m.img, m.x, m.y, m.draw, m.flash > 0);
            if (m.stunCd > 0 && m.controlEffect) {
                drawStatusGlyph(m.x, m.y - m.draw * 0.5 - 25, m.controlEffect, S.time, 0.72, 0.95);
            }
            if (m.burnTime > 0) {
                drawStatusGlyph(m.x, m.y - m.draw * 0.5 - (m.controlEffect ? 43 : 25), 'fire', S.time, 0.58, 0.9);
            }
            if (m.poisonTime > 0) {
                drawStatusGlyph(m.x, m.y - m.draw * 0.5 - (m.burnTime > 0 ? 59 : 25), 'poison', S.time, 0.58, 0.9);
            }
            if (m.shield > 0) {
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.r + 7 + Math.sin(S.time * 5 + m.wob) * 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(125,230,255,0.72)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.lineWidth = 1;
            }
            let bw = m.id === 'boss' ? 80 : 40;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(m.x - bw / 2, m.y - m.draw / 2 - 10, bw, 6);
            ctx.fillStyle = m.id === 'boss' ? '#ff4444' : '#cc3355';
            ctx.fillRect(m.x - bw / 2, m.y - m.draw / 2 - 10, bw * Math.max(0, m.hp / m.maxHp), 6);
        }

        let blink = p.invuln > 0 && Math.floor(S.time * 12) % 2 === 0;
        if (!blink) {
            let auraColor = p.curseFrenzyTime > 0 ? '#ff4e73' : p.mods.evoFlame ? '#ff8249' : p.mods.evoFrost ? '#8cecff' :
                p.mods.evoStorm ? '#c69aff' : p.mods.evoAegis ? '#ffe17b' :
                p.mods.evoBloom ? '#79e6a0' : p.mods.evoSoul ? '#ed6d99' :
                p.mods.evoPhantom ? '#b2a2ff' : p.mods.evoBlade ? '#ffd66e' : null;
            if (auraColor) {
                let pulse = 1 + Math.sin(S.time * 5) * 0.08;
                ctx.beginPath();
                ctx.arc(p.x, p.y, (p.mods.evoAegis ? 29 : 23) * pulse, 0, Math.PI * 2);
                ctx.strokeStyle = auraColor;
                ctx.globalAlpha = 0.45 + Math.sin(S.time * 4) * 0.12;
                ctx.lineWidth = p.curseFrenzyTime > 0 || p.mods.evoAegis ? 3 : 2;
                ctx.stroke();
                ctx.globalAlpha = 1;
                ctx.lineWidth = 1;
            }
            drawSprite('player', p.x, p.y, 52, false);
            if (p.stunTime > 0) drawStatusGlyph(p.x, p.y - 39, 'stun', S.time, 0.72, 0.95);
            if (p.burnTime > 0) drawStatusGlyph(p.x, p.y - (p.stunTime > 0 ? 58 : 39), 'fire', S.time, 0.58, 0.9);
            if (p.poisonTime > 0) drawStatusGlyph(p.x, p.y - (p.burnTime > 0 ? 75 : 39), 'poison', S.time, 0.58, 0.9);
            if (p.attackSlowTime > 0) drawStatusGlyph(p.x, p.y - 39, 'seal', S.time, 0.58, 0.9);
            let ex = p.x + Math.cos(p.facing) * 12;
            let ey = p.y + Math.sin(p.facing) * 12 - 4;
            ctx.beginPath();
            ctx.arc(ex, ey, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#7df9ff';
            ctx.fill();
        }

        for (let e of S.effects) {
            if (e.type === 'slash') {
                let prog = e.t / e.life;
                ctx.save();
                ctx.translate(e.x, e.y);
                ctx.rotate(e.a);
                ctx.beginPath();
                ctx.arc(0, 0, e.r * (0.7 + prog * 0.3), -1.1, 1.1);
                ctx.strokeStyle = e.color || 'rgba(125,249,255,' + (1 - prog) + ')';
                ctx.globalAlpha = 1 - prog;
                ctx.lineWidth = 8 * (1 - prog) + 2;
                ctx.stroke();
                ctx.restore();
                ctx.globalAlpha = 1;
                ctx.lineWidth = 1;
            } else if (e.type === 'boom') {
                let prog = e.t / e.life;
                ctx.beginPath();
                ctx.arc(e.x, e.y, 8 + prog * 26, 0, Math.PI * 2);
                ctx.strokeStyle = e.color || 'rgba(255,180,60,' + (1 - prog) + ')';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.lineWidth = 1;
            } else if (e.type === 'hit' || e.type === 'evolution') {
                let prog = e.t / e.life;
                let radius = (e.type === 'evolution' ? 12 : 5) + prog * (e.type === 'evolution' ? 40 : 23);
                ctx.save();
                ctx.globalAlpha = 1 - prog;
                ctx.strokeStyle = e.color || '#ffe078';
                ctx.lineWidth = e.type === 'evolution' ? 4 : 2;
                ctx.beginPath();
                ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 6; i++) {
                    let a = i * Math.PI / 3 + S.time * 2;
                    let inner = radius * 0.5, outer = radius + 6;
                    ctx.beginPath();
                    ctx.moveTo(e.x + Math.cos(a) * inner, e.y + Math.sin(a) * inner);
                    ctx.lineTo(e.x + Math.cos(a) * outer, e.y + Math.sin(a) * outer);
                    ctx.stroke();
                }
                ctx.restore();
            } else if (e.type === 'element') {
                let prog = e.t / e.life;
                let color = e.element === 'fire' ? '#ff743e' :
                    e.element === 'ice' ? '#8cecff' :
                    e.element === 'stun' ? '#ffe67b' :
                    e.element === 'poison' ? '#a8dc75' :
                    e.element === 'roots' ? '#83d378' :
                    e.element === 'seal' || e.element === 'void' ? '#d4a0ff' :
                    e.element === 'heal' ? '#8df2ad' :
                    e.element === 'crystal' ? '#8df2ed' : '#7fffc1';
                let radius = 8 + prog * (e.element === 'ice' ? 30 : 20);
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
                        let a = i * Math.PI * 0.4 + prog * 4;
                        ctx.beginPath();
                        ctx.arc(e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (e.element === 'roots') {
                    ctx.beginPath();
                    for (let i = 0; i < 4; i++) {
                        let a = i * Math.PI / 2 + prog;
                        ctx.moveTo(e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 3);
                        ctx.lineTo(e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius);
                    }
                    ctx.stroke();
                } else if (e.element === 'crystal') {
                    ctx.beginPath();
                    for (let i = 0; i < 4; i++) {
                        let a = i * Math.PI / 2 + prog * 0.6;
                        ctx.moveTo(e.x + Math.cos(a) * radius * 0.35, e.y + Math.sin(a) * radius * 0.35);
                        ctx.lineTo(e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius);
                    }
                    ctx.stroke();
                } else if (e.element === 'void') {
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, radius * 0.45, prog * 7, prog * 7 + Math.PI * 1.5);
                    ctx.stroke();
                } else if (e.element === 'stun' || e.element === 'ice' || e.element === 'heal' ||
                    e.element === 'thorns' || e.element === 'shield' || e.element === 'poison' || e.element === 'seal') {
                    drawStatusGlyph(e.x, e.y - 8, e.element, S.time + prog * 2, 0.7 + prog * 0.45, 1 - prog);
                }
                ctx.restore();
            } else if (e.type === 'lightning') {
                let prog = e.t / e.life;
                let dx = e.x2 - e.x, dy = e.y2 - e.y;
                ctx.save();
                ctx.globalAlpha = 1 - prog;
                ctx.strokeStyle = '#d9b2ff';
                ctx.shadowColor = '#a46dff';
                ctx.shadowBlur = 12;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                for (let i = 1; i < 5; i++) {
                    let t = i / 5;
                    let offset = (i % 2 ? 1 : -1) * Math.min(14, length * 0.08);
                    ctx.lineTo(e.x + dx * t - dy / length * offset, e.y + dy * t + dx / length * offset);
                }
                ctx.lineTo(e.x2, e.y2);
                ctx.stroke();
                ctx.restore();
            } else if (e.type === 'knockback') {
                let prog = e.t / e.life;
                let dx = e.x2 - e.x, dy = e.y2 - e.y;
                let length = Math.hypot(dx, dy) || 1;
                ctx.save();
                ctx.globalAlpha = 1 - prog;
                ctx.strokeStyle = '#ffe078';
                ctx.fillStyle = '#fff2bd';
                ctx.lineWidth = 3 * (1 - prog) + 1;
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x2, e.y2);
                ctx.stroke();
                let angle = Math.atan2(dy, dx);
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
            } else if (e.type === 'dash' || e.type === 'afterimage') {
                let prog = e.t / e.life;
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
            } else if (e.type === 'hurt') {
                ctx.fillStyle = 'rgba(255,0,0,' + (0.3 * (1 - e.t / e.life)) + ')';
                ctx.fillRect(0, 0, W, H);
            }
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 15px sans-serif';
        for (let t of S.texts) {
            let alpha = 1 - t.t / t.life;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fillStyle = '#000';
            ctx.fillText(t.msg, t.x + 1, t.y + 1);
            ctx.fillStyle = t.color;
            ctx.fillText(t.msg, t.x, t.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';

        if (S.state === 'clear' || S.state === 'dead') {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, W, H);
        }
    }

    function drawStatusGlyph(x, y, type, time, scale, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (type === 'stun') {
            ctx.strokeStyle = '#fff2a6';
            ctx.fillStyle = '#ffe16b';
            ctx.shadowColor = '#ffd43b';
            ctx.shadowBlur = 9;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(0, 2, 15, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            for (let i = 0; i < 3; i++) {
                let angle = time * 5 + i * Math.PI * 2 / 3;
                let sx = Math.cos(angle) * 14;
                let sy = Math.sin(angle) * 5 - 5;
                let size = i === 0 ? 6 : 4.5;
                ctx.beginPath();
                for (let point = 0; point < 10; point++) {
                    let radius = point % 2 === 0 ? size : size * 0.42;
                    let a = -Math.PI / 2 + point * Math.PI / 5;
                    let px = sx + Math.cos(a) * radius;
                    let py = sy + Math.sin(a) * radius;
                    if (point === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        } else if (type === 'ice') {
            ctx.strokeStyle = '#c7f8ff';
            ctx.shadowColor = '#55dfff';
            ctx.shadowBlur = 9;
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 6; i++) {
                let angle = i * Math.PI / 3 + time * 0.7;
                let x2 = Math.cos(angle) * 11;
                let y2 = Math.sin(angle) * 11;
                ctx.beginPath();
                ctx.moveTo(-x2, -y2);
                ctx.lineTo(x2, y2);
                ctx.moveTo(x2 * 0.55, y2 * 0.55);
                ctx.lineTo(x2 * 0.3 - y2 * 0.22, y2 * 0.3 + x2 * 0.22);
                ctx.moveTo(x2 * 0.55, y2 * 0.55);
                ctx.lineTo(x2 * 0.3 + y2 * 0.22, y2 * 0.3 - x2 * 0.22);
                ctx.stroke();
            }
        } else if (type === 'fire') {
            ctx.fillStyle = '#ff6338';
            ctx.strokeStyle = '#ffd074';
            ctx.shadowColor = '#ff542e';
            ctx.shadowBlur = 8;
            for (let i = 0; i < 3; i++) {
                let offset = (i - 1) * 9;
                let flicker = Math.sin(time * 11 + i * 2) * 2;
                ctx.beginPath();
                ctx.moveTo(offset - 4, 8);
                ctx.quadraticCurveTo(offset - 8, 0, offset - 1, -8 - flicker);
                ctx.quadraticCurveTo(offset + 1, -2, offset + 4, -5);
                ctx.quadraticCurveTo(offset + 9, 2, offset + 4, 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        } else if (type === 'poison') {
            ctx.strokeStyle = '#d6ff9b';
            ctx.fillStyle = '#8dc84e';
            ctx.shadowColor = '#91db54';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                let x = (i - 1) * 8;
                let bob = Math.sin(time * 5 + i * 2) * 2;
                ctx.beginPath();
                ctx.arc(x, 1 + bob, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(-10, 8);
            ctx.quadraticCurveTo(0, 3, 10, 8);
            ctx.stroke();
        } else if (type === 'seal') {
            ctx.strokeStyle = '#ecd5ff';
            ctx.fillStyle = 'rgba(191,133,255,0.28)';
            ctx.shadowColor = '#b976ff';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                let angle = i * Math.PI / 3 - Math.PI / 2;
                let x = Math.cos(angle) * 11;
                let y = Math.sin(angle) * 11;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);
            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);
            ctx.stroke();
        } else if (type === 'heal') {
            ctx.strokeStyle = '#b8ffd0';
            ctx.fillStyle = '#69e89a';
            ctx.shadowColor = '#48e889';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(8, 0);
            ctx.moveTo(0, -8);
            ctx.lineTo(0, 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.stroke();
        } else if (type === 'thorns') {
            ctx.strokeStyle = '#b7ffc2';
            ctx.fillStyle = '#55d979';
            ctx.shadowColor = '#4cff82';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                let angle = i * Math.PI / 6 + time;
                let radius = i % 2 === 0 ? 13 : 8;
                let px = Math.cos(angle) * radius;
                let py = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (type === 'shield') {
            ctx.strokeStyle = '#d0f8ff';
            ctx.fillStyle = 'rgba(73,205,255,0.35)';
            ctx.shadowColor = '#55dcff';
            ctx.shadowBlur = 9;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, -13);
            ctx.lineTo(11, -8);
            ctx.lineTo(9, 4);
            ctx.lineTo(0, 13);
            ctx.lineTo(-9, 4);
            ctx.lineTo(-11, -8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawSprite(key, x, y, size, flash) {
        let img = images[key];
        if (img) {
            if (flash) ctx.globalAlpha = 0.5;
            if (key === 'player') {
                let p = S.player;
                let moving = Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01;
                let bob = moving ? Math.sin(p.walkT * 10) * 2 : 0;
                ctx.save();
                ctx.translate(x, y + bob);

                // 根据朝向选择五种基础精灵，东侧朝向使用水平翻转。
                let ang = p.facing;
                let spriteKey, flipH = false;

                while (ang <= -Math.PI) ang += 2 * Math.PI;
                while (ang > Math.PI) ang -= 2 * Math.PI;

                if (ang >= -Math.PI / 8 && ang < Math.PI / 8) {
                    spriteKey = 'player_west';
                    flipH = true;
                } else if (ang >= Math.PI / 8 && ang < 3 * Math.PI / 8) {
                    spriteKey = 'player_southwest';
                    flipH = true;
                } else if (ang >= 3 * Math.PI / 8 && ang < 5 * Math.PI / 8) {
                    spriteKey = 'player_south';
                } else if (ang >= 5 * Math.PI / 8 && ang < 7 * Math.PI / 8) {
                    spriteKey = 'player_southwest';
                } else if (ang >= 7 * Math.PI / 8 || ang < -7 * Math.PI / 8) {
                    spriteKey = 'player_west';
                } else if (ang >= -7 * Math.PI / 8 && ang < -5 * Math.PI / 8) {
                    spriteKey = 'player_northwest';
                } else if (ang >= -5 * Math.PI / 8 && ang < -3 * Math.PI / 8) {
                    spriteKey = 'player_north';
                } else if (ang >= -3 * Math.PI / 8 && ang < -Math.PI / 8) {
                    spriteKey = 'player_northwest';
                    flipH = true;
                } else {
                    spriteKey = 'player_south';
                }

                let useImg = images[spriteKey] || img;
                let anim = p.anim;

                if (flipH) {
                    ctx.scale(-1, 1);
                }

                // 帧动画
                let frame = 0;
                if (moving) {
                    frame = Math.floor((p.walkT / anim.frameTime) % anim.cols);
                } else {
                    frame = 0;
                }

                let sx = frame * anim.fw;
                let sy = 0;

                ctx.drawImage(useImg, sx, sy, anim.fw, anim.fh, -size / 2, -size / 2 + bob, size, size);
                ctx.restore();
            } else {
                ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
            }
            ctx.globalAlpha = 1;
        } else {
            let color = key === 'player' ? '#7df9ff' : key === 'wolf' ? '#888899' : key === 'brute' ? '#cc4433' : '#ff3322';
            ctx.beginPath();
            ctx.arc(x, y, size / 2.4, 0, Math.PI * 2);
            ctx.fillStyle = flash ? '#ffffff' : color;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.stroke();
        }
    }

    function floatText(x, y, msg, color) {
        S.texts.push({ x: x, y: y, msg: msg, color: color, t: 0, life: 0.9 });
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function sign(v) { return (v > 0 ? '+' : '') + v; }
    function angleDiff(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    return {
        init: init,
        startRun: startRun,
        stopRun: stopRun,
        nextFloor: nextFloor,
        applyCardEffects: applyCardEffects,
        getRunCardRank: getRunCardRank,
        applyRunCard: applyRunCard,
        finishRun: finishRun,
        isRunning: () => S.running,
        getState: () => S,
        fitCanvas: fitCanvas
    };
})();
