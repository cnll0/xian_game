'use strict';

function getStoryNode(id) {
    return window.STORIES.find(s => s.id === id);
}

function getStoryDungeonId(storyId) {
    if (storyId === 's2') return 'qingyun';
    if (storyId === 's4' || storyId === 's6') return 'ember';
    if (storyId === 's8') return 'frost';
    if (storyId === 's10') return 'nether';
    return 'qingyun';
}

function learnPermanentTechnique(techniqueId, source) {
    let technique = window.TECHNIQUES.find(item => item.id === techniqueId);
    if (!technique) throw new Error('Unknown technique: ' + techniqueId);
    if (!Array.isArray(G.learnedTechniques)) G.learnedTechniques = [];
    if (G.learnedTechniques.includes(techniqueId)) return false;
    G.learnedTechniques.push(techniqueId);
    for (let key in technique.effects) {
        let value = technique.effects[key];
        if (key === 'atk') G.atk += value;
        else if (key === 'maxHp') { G.maxHp += value; G.hp = Math.min(G.maxHp, G.hp + value); }
        else if (key === 'speed') G.speed = +(G.speed + value).toFixed(2);
        else if (key === 'range') G.range += value;
        else if (key === 'crit') G.crit = Math.min(80, G.crit + value);
    }
    toast('📘 参悟功法：' + technique.name + (source ? ' · ' + source : ''), 'gold');
    updateHUD();
    saveGame(false);
    return true;
}

window.learnDungeonTechnique = function (dungeonId) {
    let dungeon = window.DUNGEONS.find(item => item.id === dungeonId);
    if (!dungeon) return;
    let next = dungeon.techniques.find(id => !(G.learnedTechniques || []).includes(id));
    if (next) learnPermanentTechnique(next, '秘境传承');
    else toast('📘 此处功法已尽数学会', 'good');
};

function getNpcRelation(npc) {
    if (!G.npcRelations) G.npcRelations = {};
    if (typeof G.npcRelations[npc.id] !== 'number') {
        G.npcRelations[npc.id] = npc.attitude === 'friendly' ? 24 : npc.attitude === 'hostile' ? -32 : 0;
    }
    return G.npcRelations[npc.id];
}

function npcRelationLabel(score) {
    if (score <= -25) return { label: '敌对', className: 'hostile' };
    if (score <= -8) return { label: '戒备', className: 'hostile' };
    if (score >= 40) return { label: '友好', className: 'friendly' };
    if (score >= 18) return { label: '熟络', className: 'friendly' };
    return { label: '中立', className: '' };
}

function showNpcDialog(npc, line, hideChoices) {
    Engine.pauseForNpcDialog();
    let score = getNpcRelation(npc);
    let relation = npcRelationLabel(score);
    let portrait = $('npcPortrait');
    portrait.setAttribute('aria-label', npc.name + '立绘');
    if (!Engine.drawNpcPortrait(npc.id, portrait)) {
        throw new Error('NPC portrait sprite is not ready: ' + npc.id);
    }
    $('npcFaction').textContent = npc.faction;
    $('npcName').textContent = npc.name;
    $('npcTitle').textContent = npc.title;
    $('npcDialogue').textContent = line || npc.greeting;
    let badge = $('npcRelation');
    badge.textContent = relation.label;
    badge.className = 'npc-relation' + (relation.className ? ' ' + relation.className : '');
    let options = $('npcOptions');
    options.replaceChildren();
    if (!hideChoices) npc.choices.forEach((choice, index) => {
        let button = document.createElement('button');
        button.type = 'button';
        button.className = 'option-btn';
        button.textContent = choice.text;
        button.addEventListener('click', () => chooseNpcOption(npc, choice, index));
        options.appendChild(button);
    });
    showOverlay('npcOverlay');
}

function chooseNpcOption(npc, choice, index) {
    if (npc.dungeonEncounter) {
        let result = Engine.resolveDungeonNpcEncounter(choice);
        showNpcDialog(npc, choice.reply + '\n\n' + result, true);
        return;
    }
    if (!G.npcChoices) G.npcChoices = {};
    let chosen = G.npcChoices[npc.id] || [];
    let firstChoice = chosen.indexOf(index) < 0;
    if (firstChoice) {
        chosen.push(index);
        G.npcChoices[npc.id] = chosen;
        G.npcRelations[npc.id] = Math.max(-100, Math.min(100,
            getNpcRelation(npc) + (choice.favor || 0)));
    }
    let claims = G.npcRewardClaims || (G.npcRewardClaims = {});
    let claimId = npc.id + ':' + index;
    if (firstChoice && choice.technique && learnPermanentTechnique(choice.technique, npc.name + '传授')) {
        claims[claimId] = true;
    } else if (firstChoice && choice.reward && !claims[claimId]) {
        for (let key in choice.reward) {
            let amount = choice.reward[key];
            if (key === 'atk') G.atk += amount;
            else if (key === 'maxHp') { G.maxHp += amount; G.hp = Math.min(G.maxHp, G.hp + amount); }
            else if (key === 'speed') G.speed = +(G.speed + amount).toFixed(2);
            else if (key === 'range') G.range += amount;
            else if (key === 'crit') G.crit = Math.min(80, G.crit + amount);
        }
        claims[claimId] = true;
        updateHUD();
        toast('✨ ' + npc.name + ' 的指点让你有所精进', 'gold');
    }
    if (!firstChoice) {
        showNpcDialog(npc, '你们已经谈过这件事了。' + choice.reply);
    } else {
        showNpcDialog(npc, choice.reply);
    }
    saveGame(false);
}

window.onWorldNpcNearby = function (npc) {
    if (npc) showNpcDialog(npc);
};

window.onDungeonNpcNearby = function (npc) {
    if (npc) showNpcDialog(npc);
};

function closeNpcDialog() {
    hideOverlay('npcOverlay');
    Engine.resumeFromNpcDialog();
}

function showDungeonSelector() {
    let list = $('dungeonChoices');
    list.replaceChildren();
    for (let dungeon of window.DUNGEONS) {
        let unlocked = G.realm >= dungeon.realmMin;
        let requiredRealm = window.REALMS[dungeon.realmMin].name;
        let card = document.createElement('article');
        card.className = 'dungeon-choice' + (unlocked ? '' : ' locked');
        let title = document.createElement('h3');
        title.textContent = (unlocked ? '🌀 ' : '🔒 ') + dungeon.name;
        let rank = document.createElement('div');
        rank.className = 'dungeon-rank';
        rank.textContent = dungeon.subtitle + ' · ' + dungeon.floorCount + '层';
        let description = document.createElement('p');
        description.textContent = unlocked
            ? '游荡妖兽：' + Array.from(new Set(dungeon.floorPool.flat())).map(id => window.MONSTERS[id].name).join('、')
            : '需达到' + requiredRealm + '方可进入';
        let button = document.createElement('button');
        button.className = unlocked ? 'btn-primary' : 'btn-secondary';
        button.disabled = !unlocked;
        button.textContent = unlocked ? '进入野外秘境' : '境界未达';
        if (unlocked) button.addEventListener('click', () => {
            hideOverlay('dungeonSelectOverlay');
            Engine.startDungeonWorld(dungeon.id);
        });
        card.append(title, rank, description, button);
        list.appendChild(card);
    }
    showOverlay('dungeonSelectOverlay');
}

function showTechniques() {
    closeMenu();
    let list = $('techniquesList');
    list.replaceChildren();
    let learned = window.TECHNIQUES.filter(technique => (G.learnedTechniques || []).includes(technique.id));
    if (!learned.length) {
        let empty = document.createElement('div');
        empty.className = 'techniques-empty';
        empty.textContent = '尚未参悟功法。探索秘境、与修士交流，寻找传承。';
        list.appendChild(empty);
    }
    for (let technique of learned) {
        let entry = document.createElement('article');
        entry.className = 'technique-entry';
        let icon = document.createElement('div');
        icon.className = 'technique-icon';
        icon.textContent = '📜';
        let content = document.createElement('div');
        let title = document.createElement('h3');
        title.textContent = technique.name;
        let school = document.createElement('small');
        school.textContent = technique.school;
        let description = document.createElement('p');
        description.textContent = technique.desc;
        content.append(title, school, description);
        entry.append(icon, content);
        list.appendChild(entry);
    }
    showOverlay('techniquesOverlay');
}

function getDungeonFloorForChapter(storyId) {
    return 1;
}

function showStoryDialog(node) {
    if (!node) {
        hideOverlay('storyOverlay');
        return;
    }
    $('storyTag').textContent = node.tag;
    $('storyTitle').textContent = node.title;
    $('storyDesc').textContent = node.desc;
    let html = '';
    for (let i = 0; i < node.options.length; i++) {
        let opt = node.options[i];
        html += '<button class="option-btn" data-opt="' + i + '"><span>' + opt.text + '</span></button>';
    }
    let optContainer = $('storyOptions');
    optContainer.innerHTML = html;
    // 先移除旧监听（克隆替换）
    let newContainer = optContainer.cloneNode(true);
    optContainer.parentNode.replaceChild(newContainer, optContainer);
    newContainer.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chooseStoryOption(node, parseInt(btn.dataset.opt, 10));
        });
    });
    showOverlay('storyOverlay');
}

window.onWorldStoryNearby = function (node) {
    if (node) showStoryDialog(node);
};

function chooseStoryOption(node, idx) {
    let opt = node.options[idx];
    if (!opt) { console.error('无效选项索引:', idx); return; }
    if (G.story.done.indexOf(node.id) < 0) G.story.done.push(node.id);
    if (opt.effects) {
        for (let k in opt.effects) {
            let v = opt.effects[k];
            if (k === 'cult') G.cultivation += v;
            else if (k === 'maxHp') { G.maxHp += v; }
        }
        while (G.realm < window.REALMS.length - 1 && G.cultivation >= window.REALMS[G.realm + 1].cult) G.realm++;
        updateHUD();
    }
    if (opt.toast) toast(opt.toast, 'gold');
    checkAchievements();

    if (opt.ending) {
        hideOverlay('storyOverlay');
        showEnding();
        return;
    }
    if (opt.enterDungeon) {
        // 直接跳转到秘境探索，不通过storyOverlay
        // 直接开始游戏状态管理
        hideOverlay('storyOverlay');
        G.story.node = node.id;
        // 根据当前章节设置秘境层数
        let dungeonFloor = getDungeonFloorForChapter(node.id);
        Engine.startRun(dungeonFloor, true, getStoryDungeonId(node.id));
        saveGame(false);
        return;
    }
    if (opt.next) {
        G.story.node = opt.next;
        saveGame(false);
        let next = getStoryNode(opt.next);
        if (next) {
            hideOverlay('storyOverlay');
            toast('🗺️ 新的剧情地点：' + (window.STORY_LOCATIONS[next.id] || {}).name, 'gold');
        } else {
            console.error('找不到下一节点:', opt.next);
            hideOverlay('storyOverlay');
        }
        return;
    }
    // 兜底：如果没有 next/ending/enterDungeon，关闭对话框
    hideOverlay('storyOverlay');
}

function showEnding() {
    G.flags.storyClear = (G.flags.storyClear || 0) + 1;
    checkAchievements();
    saveGame(true);
    $('endEmoji').textContent = '🏆';
    $('endTitle').textContent = '第一章 · 灵气觉醒 —— 通关';
    let o = window.ORIGINS.find(x => x.id === G.origin);
    $('endDesc').textContent = '道号「' + (G.username || '无名') + '」，' + (o ? o.name : '散修') + '出身，如今已是青云仙门弟子。';
    let html = '';
    html += eStat('境界', window.REALMS[G.realm].name);
    html += eStat('修为', G.cultivation);
    html += eStat('攻击', G.atk);
    html += eStat('最大生命', G.maxHp);
    html += eStat('速度', G.speed);
    html += eStat('暴击', G.crit + '%');
    html += eStat('总击杀', G.flags.kills || 0);
    html += eStat('秘境通关', (G.flags.clears || 0) + '次');
    html += eStat('成就', G.achievements.length + '/' + window.ACHIEVEMENTS.length);
    $('endStats').innerHTML = html;
    showOverlay('endingOverlay');
}

function eStat(label, val) {
    return '<div class="e-stat"><span>' + label + '</span><b>' + val + '</b></div>';
}

window.onDungeonFloorClear = function (floor) {
    let run = Engine.getState();
    if (run.skirmish) {
        Engine.finishRun(true);
        Engine.startWorld();
        toast('🌿 战斗结束，你回到了秘境探索中', 'good');
        return;
    }
    let floorCount = run.floorCount || window.DUNGEON_FLOORS;
    if (!Engine.getState().storyDungeon) {
        if (floor >= floorCount) {
            setTimeout(() => {
                Engine.finishRun(true);
                Engine.startWorld();
            }, 900);
        } else {
            Engine.nextFloor();
        }
        return;
    }
    let storyId = G.story.node;
    let nextStoryNode = null;

    if (storyId === 's2') {
        if (floor >= floorCount) {
            toast('👑 赤鳞蟒被斩杀！秘境通关！', 'gold');
            setTimeout(() => {
                Engine.finishRun(true);
                let node = getStoryNode('s3');
                if (G.story.node === 's2') {
                    G.story.node = 's3';
                    saveGame(false);
                }
                if (node) Engine.startWorld();
            }, 900);
        } else {
            // 其他层：通关后自动进入下一层（spawnFloor 会自动弹出双向卡牌）
            Engine.nextFloor();
        }
    } else if (storyId === 's4' || storyId === 's5' || storyId === 's6') {
        // 第二章的故事节点
        if (floor >= floorCount) {
            // 如果通关了秘境深层，可以进入下一个剧情节点（s7 - 构建基灵液）
            toast('👑 魔化核心被毁！秘境深层通关！', 'gold');
            setTimeout(() => {
                Engine.finishRun(true);
                let node = getStoryNode('s7');
                if (G.story.node === 's4' || G.story.node === 's5' || G.story.node === 's6') {
                    G.story.node = 's7';
                    saveGame(false);
                }
                if (node) Engine.startWorld();
            }, 900);
        } else {
            // 其他层：通关后自动进入下一层
            Engine.nextFloor();
        }
    } else if (storyId === 's8' || storyId === 's9' || storyId === 's10') {
        // 第三章的故事节点
        if (floor >= floorCount) {
            // 如果通关了问剑大会秘境，可以进入下一个剧情节点（s11 - 金丹问剑冠军）
            toast('👑 君莫邪被斩！秘境通关！', 'gold');
            setTimeout(() => {
                Engine.finishRun(true);
                let node = getStoryNode('s11');
                if (G.story.node === 's8' || G.story.node === 's9' || G.story.node === 's10') {
                    G.story.node = 's11';
                    saveGame(false);
                }
                if (node) Engine.startWorld();
            }, 900);
        } else {
            // 其他层：通关后自动进入下一层
            Engine.nextFloor();
        }
    } else {
        // 其他章节默认处理
        if (floor >= floorCount) {
            toast('👑 秘境通关！', 'gold');
            setTimeout(() => {
                Engine.finishRun(true);
                let node = getStoryNode('s3');
                if (G.story.node === storyId) {
                    G.story.node = 's3';
                    saveGame(false);
                }
                if (node) Engine.startWorld();
            }, 900);
        } else {
            Engine.nextFloor();
        }
    }
};

window.onDungeonDeath = function () {
    setTimeout(() => {
        Engine.stopRun();
        hideOverlay('cardsOverlay');
        toast('💀 已返回大地图，可在当前地点再次挑战', 'bad');
        Engine.startWorld();
    }, 800);
};

window.onDungeonClear = function () {
    G.hp = G.maxHp;
    saveGame(false);
};

function showCardChoices() {
    let floor = Engine.getState().floor;
    let cards = drawRunCards(floor);
    let html = '';
    for (let c of cards) {
        let effLines = '';
        for (let k in c.effects) {
            let v = c.effects[k];
            let label = { atk: '攻击', maxHp: '生命上限', speed: '速度', range: '范围', lifesteal: '吸血', crit: '暴击', hp: '当前生命', cult: '修为' }[k] || k;
            effLines += '<div class="effect-line"><span class="stat">' + label + '</span>' +
                '<span class="val ' + (v > 0 ? 'positive' : 'negative') + '">' + (v > 0 ? '+' : '') + v + '</span></div>';
        }
        for (let k in c.monsterEffects || {}) {
            let v = c.monsterEffects[k];
            let label = { hpMul: '妖魔生命', atkMul: '妖魔攻击', spdMul: '妖魔速度', cntAdd: '妖魔数量',
                forceElite: '精英妖魔', shield: '妖魔护盾', regen: '妖魔回复', thorns: '妖魔反伤',
                split: '妖魔分裂', explode: '妖魔自爆', teleport: '妖魔瞬移', summonCd: '召唤间隔' }[k] || k;
            let value = k === 'hpMul' || k === 'atkMul' || k === 'spdMul' ?
                '+' + Math.round((v - 1) * 100) + '%' : typeof v === 'boolean' ? (v ? '开启' : '关闭') : '+' + v;
            effLines += '<div class="effect-line enemy-effect"><span class="stat">' + label + '</span><span class="val negative">' + value + '</span></div>';
        }
        let rankLabel = c.rank === 0 ? '初获' : c.rank === 1 ? '进阶 2/3' : '进化 3/3';
        let branches = c.rank >= 2 ? window.getCardEvolutions(c) : [];
        html += '<div class="choice-card ' + c.type + ' ' + c.rarity + (c.curseTier ? ' curse-' + c.curseTier : '') + '" onclick="pickRunCard(\'' + c.id + '\')">' +
            cardArt(c.id) +
            '<span class="rarity">' + window.getCardDrawTierLabel(c) + '</span>' +
            '<div class="card-name">' + c.name + '<span class="card-rank">' + rankLabel + '</span></div>' +
            '<div class="card-desc">' + c.desc + '</div>' +
            '<div class="card-effects">' + effLines + '</div>' +
            (branches.length ? '<div class="evolution-choices"><span class="evolution-title">选择进化路线</span>' +
                branches.map(b => '<button type="button" class="evolution-choice" onclick="event.stopPropagation();pickRunCard(\'' + c.id + '\',\'' + b.id + '\')"><strong>' + b.name + '</strong><span>' + b.desc + '</span></button>').join('') + '</div>' : '') +
            '</div>';
    }
    $('cardsTitle').textContent = '✨ 第' + floor + '层已清空 · 择一机缘';
    $('cardChoices').innerHTML = html;
    showOverlay('cardsOverlay');
}

let _runCards = [];

function drawRunCards(floor) {
    let available = CARDS.concat(window.MONSTER_RUN_CARDS).filter(c => Engine.getRunCardRank(c.id) < 3);
    let picked = window.drawCardsByTier(available, 3, floor, c => Engine.getRunCardRank(c.id))
        .map(c => Object.assign({}, c, { rank: Engine.getRunCardRank(c.id) }));
    _runCards = picked;
    return picked;
}

function pickRunCard(cardId, branchId) {
    let c = _runCards.find(x => x.id === cardId);
    if (!c) return;
    if (Engine.getRunCardRank(cardId) >= 2 && !branchId) {
        toast('请选择一条进化路线', 'gold');
        return;
    }
    let lines = Engine.applyRunCard(c, branchId) || [];
    let branch = branchId && window.getCardEvolutions(c).find(b => b.id === branchId);
    let rankText = c.rank > 0 && !branchId ? ' · ' + (c.rank === 1 ? '进阶 2/3' : '进化 3/3') : '';
    let curseGrade = c.type === 'cursed' ? ' · 诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] : '';
    toast((c.emoji || '👿') + ' ' + c.name + (branch ? ' → ' + branch.name : rankText + curseGrade) + '：' + lines.join('，'),
        c.type === 'cursed' || c.type === 'monster' ? 'bad' : c.type === 'mixed' || branch ? 'gold' : 'good');
    checkAchievements();
    saveGame(false);
    hideOverlay('cardsOverlay');
    Engine.nextFloor();
}
