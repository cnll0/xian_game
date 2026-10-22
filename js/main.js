'use strict';

function $(id) { return document.getElementById(id); }

// 兼容旧引擎的扁平 worldZone 与模块化引擎的 world.zone
function getWorldZone(state) {
    return state.worldZone || (state.world && state.world.zone) || 'overworld';
}

function hasMonsterImage(name) {
    const runtime = window.gameState && window.gameState.runtime;
    const images = runtime && runtime.assets && runtime.assets.images;
    if (images && images[name]) return true;
    return !!(window.Engine && window.Engine.getImages && window.Engine.getImages()[name]);
}
function showOverlay(id) {
    let el = $(id);
    el.classList.add('active');
    el.classList.remove('hidden');
    // 打开覆盖层时冻结游戏；只暂停 running，不篡改怪物/玩家的计时器
    if (window.Engine && window.Engine.getState) {
        let state = window.Engine.getState();
        if (state.running) {
            state._wasRunning = true;
            state.running = false;
        }
    }
}
function hideOverlay(id) {
    let el = $(id);
    el.classList.remove('active');
    el.classList.add('hidden');
    // 关闭覆盖层时恢复游戏；若还有其它覆盖层保持打开，则继续暂停
    if (window.Engine && window.Engine.getState) {
        let state = window.Engine.getState();
        if (state._wasRunning && !document.querySelector('.overlay.active')) {
            state.running = true;
            state._wasRunning = false;
        }
    }
}

function toast(msg, type) {
    let box = $('toastContainer');
    if (!box) return;
    let t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
}

function init() {
    $('gameShell').style.display = 'none';
    $('loginBtn').addEventListener('click', doLogin);
    $('guestBtn').addEventListener('click', guestLogin);
    $('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    $('loginName').addEventListener('keydown', e => { if (e.key === 'Enter') $('loginPass').focus(); });

    $('startGameBtn').addEventListener('click', () => {
        let oid = $('startGameBtn').dataset.oid;
        if (oid) newGame(oid);
    });

    $('saveBtn').addEventListener('click', () => saveGame(true));
    $('menuBtn').addEventListener('click', () => showOverlay('menuOverlay'));
    if ($('bagBtn')) $('bagBtn').addEventListener('click', () => showInventory());
    if ($('sectBtn')) $('sectBtn').addEventListener('click', () => showSect());
    if ($('muteBtn')) {
        $('muteBtn').textContent = window.audioManager && window.audioManager.muted ? '🔇' : '🔊';
        $('muteBtn').addEventListener('click', () => {
            const muted = window.audioManager ? window.audioManager.toggleMute() : false;
            $('muteBtn').textContent = muted ? '🔇' : '🔊';
        });
    }

    $('btnDungeon').addEventListener('click', () => {
        if (Engine.isRunning() && Engine.getState().state !== 'world') { toast('🏰 秘境探索中', 'bad'); return; }
        if (getWorldZone(Engine.getState()) !== 'overworld') Engine.returnToOverworld();
        else showDungeonSelector();
    });
    $('btnStory').addEventListener('click', () => {
        if (Engine.getState().state === 'world') {
            if (!Engine.interactStory()) {
                const target = Engine.getStoryTarget ? Engine.getStoryTarget() : null;
                toast(target
                    ? '🎯 剧情目标：' + target.name + ' · ' + target.direction + '方约' + Math.round(target.distance) + '米'
                    : '四处走走，靠近人物、遗迹或擂台时会遇到故事', 'gold');
            }
            return;
        }
        if (Engine.isRunning()) { toast('⚔️ 战斗中无法推进剧情', 'bad'); return; }
        let node = getStoryNode(G.story.node);
        if (!node) { showEnding(); return; }
        showStoryDialog(node);
    });
    $('btnHeal').addEventListener('click', () => {
        if (Engine.isRunning() && Engine.getState().state !== 'world') { toast('⚔️ 战斗中无法疗伤', 'bad'); return; }
        if (G.hp >= G.maxHp) { toast('❤️ 生命已满', 'bad'); return; }
        let heal = Math.min(30, G.maxHp - G.hp);
        G.hp += heal;
        updateHUD();
        toast('🌿 疗伤 +' + heal + 'HP', 'good');
        saveGame(false);
    });

    const initResult = Engine.init($('gameCanvas'));
    const initPromise = initResult && typeof initResult.then === 'function'
        ? initResult
        : Promise.resolve();
    window.engineReady = initPromise.catch(err => {
        console.error('引擎初始化失败:', err);
        if ($('loginHint')) {
            $('loginHint').textContent = '❌ 游戏资源加载失败，请刷新页面';
            $('loginHint').style.color = '#b22234';
        }
        throw err;
    });

    let lastUser = localStorage.getItem('xian2d_last_user');
    if (lastUser) {
        $('loginName').value = lastUser;
        $('loginHint').textContent = '上次登录：' + lastUser;
    }
    showOverlay('loginOverlay');
}

function showGameShell() {
    $('gameShell').style.display = 'flex';
    // 登录输入框可能还保持焦点，会让 WASD/E 被 isTyping 拦截
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    Engine.fitCanvas();
    updateHUD();
}

function newGame(originId) {
    let o = ORIGINS.find(x => x.id === originId);
    if (!o) return;
    G.origin = o.id;
    G.created = true;
    G.realm = 0;
    G.cultivation = 0;
    G.atk = 10 + (o.bonus.atk || 0);
    G.maxHp = 100 + (o.bonus.maxHp || 0);
    G.speed = 3.2 + (o.bonus.speed || 0);
    G.range = 46 + (o.bonus.range || 0);
    G.lifesteal = 0;
    G.crit = 5 + (o.bonus.crit || 0);
    G.hp = G.maxHp;
    G.flags = { kills: 0, runs: 0, clears: 0, maxFloor: 0, cursedPicks: 0, storyClear: 0, deaths: 0, noDeathClear: 0 };
    G.story = { node: 's0', done: [] };
    G.world = null;
    G.learnedTechniques = [];
    G.npcRelations = {};
    G.npcChoices = {};
    G.npcRewardClaims = {};
    G.achievements = [];
    G.inventory = {};
    G.spiritStones = 30;
    G.sect = { rank: 0, contribution: 0, lastSalary: '' };
    addItem('pill_hp', 1);
    if (o.startItem) {
        addItem(o.startItem, 1);
        toast('🎒 开局行囊：回春丹 ×1 · ' + (getItemDef(o.startItem)?.name || '道具') + ' ×1 · 灵石 ×30', 'gold');
    } else {
        toast('🎒 开局行囊：回春丹 ×1 · 灵石 ×30', 'gold');
    }
    hideOverlay('createOverlay');
    showGameShell();
    updateHUD();
    toast('🌟 出身选定：' + o.emoji + o.name, 'gold');
    saveGame(false);
    Engine.startWorld(true);
}

function updateHUD() {
    let nameEl = $('hudName');
    if (nameEl) nameEl.textContent = (G.username || '无名') + ' · ' + window.REALMS[G.realm].name;
    let state = Engine.getState();
    let inWorld = state.state === 'world' || (state.state === 'dialog' && state.npcPausedState === 'world');
    let inDungeon = !inWorld && Engine.isRunning();
    let hpBar = $('hudHpFill');
    let hpText = $('hudHpText');
    let curHp = inDungeon && state.player ? state.player.hp : G.hp;
    let maxHp = inDungeon && state.player ? state.player.maxHp : G.maxHp;
    if (hpBar) hpBar.style.width = Math.max(0, Math.min(100, curHp / maxHp * 100)) + '%';
    if (hpText) hpText.textContent = Math.max(0, Math.round(curHp)) + '/' + maxHp;
    let cultEl = $('hudCult');
    if (cultEl) cultEl.textContent = '🌀' + G.cultivation;
    let stoneEl = $('hudStones');
    if (stoneEl) stoneEl.textContent = '💎' + (G.spiritStones || 0);
    let statEl = $('hudStats');
    let runMods = inDungeon && state.player ? state.player.mods : null;
    if (statEl) statEl.textContent = '⚔️' + (G.atk + (runMods ? runMods.atk : 0)) +
        ' 💨' + +(G.speed + (runMods ? runMods.speed : 0)).toFixed(1) +
        ' 🎯' + Math.min(80, G.crit + (runMods ? runMods.crit : 0)) + '%';
    let floorEl = $('hudFloor');
    if (floorEl) {
        let dungeon = window.DUNGEONS.find(item => item.id === state.dungeonId);
        floorEl.textContent = inWorld
            ? (getWorldZone(state) === 'overworld' ? '🗺️ 青云山脉' : '🌫️ ' + (dungeon ? dungeon.name : '秘境'))
            : Engine.isRunning() ? ('🏰' + state.floor + '/' + (state.floorCount || window.DUNGEON_FLOORS)) : '🏰秘境';
    }
    renderAchievementBadge();
}

function renderAchievementBadge() {
    let el = $('hudAch');
    if (el) el.textContent = '🏆' + G.achievements.length + '/' + window.ACHIEVEMENTS.length;
}

function renderOrigins() {
    let html = '';
    for (let o of window.ORIGINS) {
        html += '<div class="origin-card" data-oid="' + o.id + '">' +
            '<span class="o-emoji">' + o.emoji + '</span>' +
            '<div class="o-name">' + o.name + '</div>' +
            '<div class="o-desc">' + o.desc + '</div>' +
            '</div>';
    }
    $('originGrid').innerHTML = html;
    $('startGameBtn').disabled = true;
    document.querySelectorAll('.origin-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.origin-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            $('startGameBtn').disabled = false;
            $('startGameBtn').dataset.oid = card.dataset.oid;
        });
    });
}

function showSaveLoad() {
    closeMenu();
    showOverlay('saveLoadOverlay');
    renderLocalSaves();
}

function closeSaveLoad() {
    hideOverlay('saveLoadOverlay');
}

function renderLocalSaves() {
    let el = $('saveLocalContent');
    let html = '';
    let found = false;
    for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i);
        if (k && k.indexOf(SAVE_PREFIX) === 0) {
            try {
                let d = JSON.parse(localStorage.getItem(k));
                if (!d || !d.created) continue;
                found = true;
                let name = k.replace(SAVE_PREFIX, '') || '默认';
                let time = d.saveTs ? new Date(d.saveTs).toLocaleString() : '未知';
                let realmName = window.REALMS[d.realm] ? window.REALMS[d.realm].name : '炼气';
                html += '<div class="save-item"><div class="save-item info">' +
                    '<div class="save-name">' + (name === G.username ? '🟢 ' : '') + name + (name === G.username ? '（当前）' : '') + '</div>' +
                    '<div class="save-meta">' + realmName + ' · 攻' + (d.atk || 10) + ' · ' + time + '</div></div>' +
                    '<button class="btn-s" onclick="loadLocalByKey(\'' + k + '\')">读取</button></div>';
            } catch (e) { }
        }
    }
    if (!found) html = '<div style="text-align:center;color:#8a7360;padding:20px;">无本地存档</div>';
    el.innerHTML = html;
}

function loadLocalByKey(key) {
    try {
        let raw = localStorage.getItem(key);
        if (!raw) { toast('❌ 存档不存在', 'bad'); return; }
        let d = JSON.parse(raw);
        if (d.username) {
            G.username = d.username;
            localStorage.setItem('xian2d_last_user', d.username);
        }
        closeSaveLoad();
        applySaveData(raw);
    } catch (e) {
        toast('❌ 读档失败', 'bad');
    }
}

function showAchievements() {
        closeMenu();
        showOverlay('achOverlay');
        renderAchievements('all');
    }

    function renderAchievements(filter) {
        document.querySelectorAll('.ach-tab').forEach(b => b.classList.toggle('active', b.dataset.atab === filter));
        let grid = document.getElementById('achGrid');
        let unlocked = 0, total = ACHIEVEMENTS.length;
        let html = '';
        for (let a of ACHIEVEMENTS) {
            let isUnlocked = G.achievements.indexOf(a.id) >= 0;
            if (isUnlocked) unlocked++;
            if (filter === 'unlocked' && !isUnlocked) continue;
            if (filter === 'locked' && isUnlocked) continue;
            let progress = '';
            try {
                if (a.check && a.check.toString().includes('>=')) {
                    let match = a.check.toString().match(/>= (\d+)/);
                    if (match) {
                        let target = parseInt(match[1]);
                        let current = 0;
                        if (a.check.toString().includes('kills')) current = G.flags.kills || 0;
                        else if (a.check.toString().includes('maxFloor')) current = G.flags.maxFloor || 0;
                        else if (a.check.toString().includes('cursedPicks')) current = G.flags.cursedPicks || 0;
                        else if (a.check.toString().includes('realm')) current = G.realm || 0;
                        else if (a.check.toString().includes('storyClear')) current = G.flags.storyClear || 0;
                        else if (a.check.toString().includes('noDeathClear')) current = G.flags.noDeathClear || 0;
                        if (current < target) progress = '<div class="ach-progress">进度：' + current + '/' + target + '</div>';
                    }
                }
            } catch (e) { }
            html += '<div class="ach-card ' + (isUnlocked ? 'unlocked' : 'locked') + '">' +
                '<span class="ach-icon">' + a.emoji + '</span>' +
                '<div class="ach-info">' +
                '<div class="ach-name">' + a.name + '</div>' +
                '<div class="ach-desc">' + a.desc + '</div>' +
                progress +
                '</div>' +
                '<span class="ach-status">' + (isUnlocked ? '✅' : '🔒') + '</span>' +
                '</div>';
        }
        document.getElementById('achGrid').innerHTML = html;
        document.getElementById('achUnlocked').textContent = unlocked;
        document.getElementById('achTotal').textContent = total;
    }

function showCodex() {
        closeMenu();
        showOverlay('codexOverlay');
        renderCodexTab('monster');
    }

    function renderCodexTab(tab) {
        document.querySelectorAll('.codex-tab').forEach(b => b.classList.toggle('active', b.dataset.ctab === tab));
        document.querySelectorAll('.codex-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'codex-' + tab));
        if (tab === 'monster') renderMonsterCodex();
        else if (tab === 'player') renderPlayerCodex();
        else if (tab === 'card') renderCardCodex();
        else if (tab === 'item') renderItemCodex();
    }

    function renderMonsterCodex() {
        let html = '<div class="codex-grid">';
        for (let k in MONSTERS) {
            let m = MONSTERS[k];
            let weak = m.ranged ? '远程/近战贴身' : '无明显弱点';
            let drop = '修为 ' + m.cult + ' | 几率掉落强化卡';
            html += '<div class="codex-card monster" data-id="' + k + '">' +
                '<div class="codex-card-header"><span class="codex-icon">' + (hasMonsterImage(m.img) ? '' : '❓') + '</span><span class="codex-name">' + m.name + '</span></div>' +
                '<div class="codex-stats">' +
                '<span>❤️ ' + m.hp + '</span><span>⚔️ ' + m.atk + '</span><span>💨 ' + m.speed + '</span><span>💰 ' + m.cult + '</span>' +
                '</div>' +
                '<div class="codex-weak"><strong>弱点：</strong>' + weak + '</div>' +
                '<div class="codex-drop"><strong>掉落：</strong>' + drop + '</div>' +
                '</div>';
        }
        html += '</div>';
        document.getElementById('codex-monster').innerHTML = html;
    }

    function renderPlayerCodex() {
        let html = '<div class="codex-grid">';
        let mods = ['atk','maxHp','speed','range','crit','lifesteal','doubleHit','pierce','knockback','stunChance','elemFire','elemIce','chain','dashStrike','shield','dodge','regen','thorns'];
        let player = Engine.getState().player;
        if (!player && window.gameState) player = window.gameState.runtime.player;
        let playerMods = player && player.mods ? player.mods : {};
        for (let k of mods) {
            let v = playerMods[k];
            if (!v && v !== true) continue;
            let name = {atk:'攻击',maxHp:'最大生命',speed:'速度',range:'攻击范围',crit:'暴击率',lifesteal:'吸血',
                doubleHit:'连击',pierce:'穿透',knockback:'击退',stunChance:'眩晕',elemFire:'火属性',elemIce:'冰属性',chain:'连锁',dashStrike:'突刺',shield:'护盾',dodge:'闪避',regen:'回血',thorns:'反伤'}[k];
            let val = typeof v === 'boolean' ? '已解锁' : '+' + v;
            html += '<div class="codex-card player"><div class="codex-name">🔹 ' + name + '</div><div class="codex-value">' + val + '</div></div>';
        }
        if (html === '<div class="codex-grid">') html = '<div class="codex-grid"><div class="codex-empty">暂无强化</div></div>';
        else html += '</div>';
        document.getElementById('codex-player').innerHTML = html;
    }

    function renderCardCodex() {
        let html = '<div class="codex-tabs-sub"><button class="codex-subtab active" data-stab="player">玩家卡</button><button class="codex-subtab" data-stab="monster">妖魔卡</button></div>';
        html += '<div class="codex-panel-sub" id="card-player"><div class="codex-grid">';
        for (let c of PLAYER_CARDS) {
            html += '<div class="codex-card card ' + c.rarity + ' ' + c.type + (c.curseTier ? ' curse-' + c.curseTier : '') + '">' + cardArt(c.id) + '<div class="codex-card-header"><span class="codex-name">' + c.name + '</span><span class="rarity-badge ' + c.rarity + '">' + getCardDrawTierLabel(c) + '</span></div><div class="codex-desc">' + c.desc + '</div><div class="codex-type">类型：' + (CARD_TYPE_LABELS[c.type] || c.type) + '</div></div>';
        }
        html += '</div></div><div class="codex-panel-sub hidden" id="card-monster"><div class="codex-grid">';
        for (let c of MONSTER_CARDS) {
            html += '<div class="codex-card card ' + c.rarity + ' ' + c.type + (c.curseTier ? ' curse-' + c.curseTier : '') + '">' + cardArt(c.id) + '<div class="codex-card-header"><span class="codex-name">' + c.name + '</span><span class="rarity-badge ' + c.rarity + '">' + getCardDrawTierLabel(c) + '</span></div><div class="codex-desc">' + c.desc + '</div><div class="codex-type">类型：' + (CARD_TYPE_LABELS[c.type] || c.type) + '</div></div>';
        }
        html += '</div></div>';
        document.getElementById('codex-card').innerHTML = html;
        document.querySelectorAll('.codex-subtab').forEach(b => b.addEventListener('click', () => {
            document.querySelectorAll('.codex-subtab').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            document.querySelectorAll('.codex-panel-sub').forEach(p => p.classList.add('hidden'));
            document.getElementById('card-' + b.dataset.stab).classList.remove('hidden');
        }));
    }

    function renderItemCodex() {
        let html = '<div class="codex-grid">';
        for (let it of ITEMS) {
            let meta = (itemTypeLabel(it) || '物品') + (it.sell ? ' · 售价 ' + it.sell + ' 灵石' : '');
            html += '<div class="codex-card item"><div class="codex-card-header">' +
                itemIconHTML(it) + '<span class="codex-name">' + it.name + '</span></div>' +
                '<div class="codex-desc">' + it.desc + '</div>' +
                '<div class="codex-type">' + meta + '</div></div>';
        }
        html += '</div>';
        document.getElementById('codex-item').innerHTML = html;
    }

function confirmReset() {
    closeMenu();
    if (confirm('⚠️ 确认删除本机进度并重新开始？')) {
        try { localStorage.removeItem(getSaveKey()); } catch (e) { }
        location.reload();
    }
}

function closeMenu() {
    hideOverlay('menuOverlay');
}

document.addEventListener('DOMContentLoaded', init);
