'use strict';

function getStoryNode(id) {
    return window.STORIES.find(s => s.id === id);
}

function getOriginDef(id) {
    return (window.ORIGINS || []).find(item => item.id === (id || G.origin)) || null;
}

function getTalentDef(id) {
    return (window.TALENTS || []).find(item => item.id === (id || G.talent)) || null;
}

/**
 * 剧情选项的命格门槛：requiresOrigin / requiresTalent / requiresFlag。
 * 不满足条件的选项不渲染，但原始下标保持不变，chooseStoryOption 仍能取到正确项。
 */
function fateOptionAvailable(opt) {
    if (!opt) return false;
    if (opt.requiresOrigin && opt.requiresOrigin.indexOf(G.origin) < 0) return false;
    if (opt.requiresTalent && opt.requiresTalent.indexOf(G.talent) < 0) return false;
    if (opt.requiresFlag && !(G.flags && G.flags[opt.requiresFlag])) return false;
    if (opt.excludeOrigin && opt.excludeOrigin.indexOf(G.origin) >= 0) return false;
    if (opt.excludeTalent && opt.excludeTalent.indexOf(G.talent) >= 0) return false;
    return true;
}

window.getOriginDef = getOriginDef;
window.getTalentDef = getTalentDef;
window.fateOptionAvailable = fateOptionAvailable;

function getStoryDungeonId(storyId) {
    if (storyId === 's2') return 'qingyun';
    if (storyId === 's4' || storyId === 's6') return 'ember';
    if (storyId === 's10') return 'nether';
    return 'qingyun';
}

if (typeof window !== 'undefined') {
    window.getStoryNode = getStoryNode;
    window.getStoryDungeonId = getStoryDungeonId;
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
        let base = npc.attitude === 'friendly' ? 24 : npc.attitude === 'hostile' ? -32 : 0;
        const notoriety = (G.flags && G.flags.notoriety) || 0;
        if (notoriety && /青云|守境/.test(npc.faction || '')) base -= notoriety;
        G.npcRelations[npc.id] = Math.max(-100, Math.min(100, base));
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

/** 命格会让 NPC 的第一印象不同：只影响一次，且写入存档。 */
function getFateNpcLine(npc) {
    const origin = getOriginDef();
    const talent = getTalentDef();
    const faction = (npc && npc.faction) || '';
    const righteous = /青云|守境/.test(faction);
    if (talent && talent.id === 'demonbone' && righteous) return '（你身上未散的煞气让对方按住了兵器。）';
    if (talent && talent.id === 'spiritroot') return '（对方察觉你周身灵气异常纯净，语气缓和了几分。）';
    if (talent && talent.id === 'lucky') return '（一阵风恰好吹散云雾，气氛松了下来。）';
    if (origin && origin.id === 'orphan') return '（你衣着寒酸却目光清正，对方不由得多看了你一眼。）';
    if (origin && origin.id === 'scholar') return '（你言辞有礼，对方的神色缓和了些。）';
    if (origin && origin.id === 'noble') return '（对方似乎认出了你袖口的旧族纹。）';
    if (origin && origin.id === 'merchant') return '（你袖口的算珠声让对方挑了挑眉。）';
    if (origin && origin.id === 'hunter') return '（对方嗅到你身上淡淡的松脂与兽血味，点了点头。）';
    return '';
}

function applyFateNpcImpression(npc) {
    if (!npc || !npc.id) return 0;
    if (!G.flags) G.flags = {};
    if (!G.npcRelations) G.npcRelations = {};
    const key = 'npcFate_' + npc.id;
    if (G.flags[key]) return 0;
    G.flags[key] = 1;
    const origin = getOriginDef();
    const talent = getTalentDef();
    const faction = npc.faction || '';
    let favor = 0;
    if (talent && talent.id === 'demonbone' && /青云|守境/.test(faction)) favor = -5;
    else if (origin && (origin.id === 'scholar' || origin.id === 'noble') && /青云/.test(faction)) favor = 2;
    else if (origin && origin.id === 'orphan' && npc.attitude === 'friendly') favor = 2;
    else if (origin && origin.id === 'merchant' && npc.id === 'linyue') favor = 2;
    if (favor) G.npcRelations[npc.id] = Math.max(-100, Math.min(100, getNpcRelation(npc) + favor));
    return favor;
}

function showNpcDialog(npc, line, hideChoices) {
    if (!npc) return;
    // 兜底：旧数据可能只有 npcId 或 name，补一个稳定 id 供关系/选项记录使用
    if (!npc.id) npc.id = npc.npcId || npc.name || 'unknown';
    Engine.pauseForNpcDialog();
    applyFateNpcImpression(npc);
    let score = getNpcRelation(npc);
    let relation = npcRelationLabel(score);
    let portrait = $('npcPortrait');
    if (!portrait) return;
    portrait.setAttribute('aria-label', (npc.name || '未知NPC') + '立绘');

    // 容错：立绘未加载/未知NPC时显示占位符，绝不中断对话
    const npcId = npc.portrait || npc.id || 'ningxiao';
    let drawn = false;
    try {
        drawn = !!Engine.drawNpcPortrait(npcId, portrait);
    } catch (err) {
        console.warn('NPC 立绘绘制失败:', err);
    }
    if (!drawn) {
        const ctx = portrait.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#2a2a3e';
            ctx.fillRect(0, 0, portrait.width, portrait.height);
            ctx.fillStyle = '#fff';
            ctx.font = '24px "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', portrait.width / 2, portrait.height / 2);
        }
    }
    $('npcFaction').textContent = npc.faction || '未知';
    $('npcName').textContent = npc.name || '未知';
    $('npcTitle').textContent = npc.title || '';
    const fateLine = getFateNpcLine(npc);
    const bodyLine = line || npc.greeting || '……';
    $('npcDialogue').textContent = (fateLine ? fateLine + '\n' : '') + bodyLine;
    let badge = $('npcRelation');
    badge.textContent = relation.label;
    badge.className = 'npc-relation' + (relation.className ? ' ' + relation.className : '');
    let options = $('npcOptions');
    options.replaceChildren();
    if (!hideChoices && npc.choices) npc.choices.forEach((choice, index) => {
        let button = document.createElement('button');
        button.type = 'button';
        button.className = 'option-btn';
        button.textContent = choice.text;
        button.addEventListener('click', () => chooseNpcOption(npc, choice, index));
        options.appendChild(button);
    });
    // 人形对手：任何有战斗数据的 NPC 都可以切磋/动手，不再只能打妖兽
    if (!hideChoices && !npc.dungeonEncounter && npc.combatStats && typeof Engine.startNpcDuel === 'function') {
        const hostile = score <= -8 || npc.attitude === 'hostile';
        let duelButton = document.createElement('button');
        duelButton.type = 'button';
        duelButton.className = 'option-btn duel-option';
        duelButton.textContent = hostile ? '⚔️ 拔剑相向，分个高下' : '⚔️ 请求切磋，点到为止';
        duelButton.addEventListener('click', () => {
            closeNpcDialog();
            Engine.startNpcDuel(npc.id);
        });
        options.appendChild(duelButton);
    }
    showOverlay('npcOverlay');
}

function chooseNpcOption(npc, choice, index) {
    if (npc.dungeonEncounter) {
        let result = Engine.resolveDungeonNpcEncounter(choice);
        showNpcDialog(npc, choice.reply + '\n\n' + result, true);
        return;
    }
    if (choice.shop && typeof showShop === 'function') {
        closeNpcDialog();
        showShop(choice.shop);
        return;
    }
    if (choice.sect && typeof showSect === 'function') {
        closeNpcDialog();
        showSect();
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
            ? '盘踞敌手：' + Array.from(new Set(dungeon.floorPool.flat())).map(id => window.MONSTERS[id].name).join('、')
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
        if (!fateOptionAvailable(opt)) continue;
        const fateClass = opt.requiresOrigin || opt.requiresTalent || opt.requiresFlag ? ' fate-option' : '';
        html += '<button class="option-btn' + fateClass + '" data-opt="' + i + '"><span>' + opt.text + '</span></button>';
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

const STORY_EFFECT_LABELS = {
    cult: '修为', maxHp: '生命上限', atk: '攻击', speed: '速度',
    range: '攻击范围', crit: '暴击', lifesteal: '吸血', hp: '当前生命',
    stones: '灵石'
};

function applyStoryEffects(effects) {
    const lines = [];
    if (!effects) return lines;
    for (const key in effects) {
        const value = effects[key];
        if (!value) continue;
        if (key === 'cult') G.cultivation += value;
        else if (key === 'maxHp') {
            G.maxHp += value;
            G.hp = Math.max(1, Math.min(G.maxHp, G.hp + Math.max(0, value)));
        } else if (key === 'atk') G.atk += value;
        else if (key === 'speed') G.speed = +(G.speed + value).toFixed(2);
        else if (key === 'range') G.range += value;
        else if (key === 'crit') G.crit = Math.max(0, Math.min(80, G.crit + value));
        else if (key === 'lifesteal') G.lifesteal = (G.lifesteal || 0) + value;
        else if (key === 'hp') G.hp = Math.max(1, Math.min(G.maxHp, G.hp + value));
        else if (key === 'stones') {
            if (typeof addSpiritStones === 'function') addSpiritStones(value);
            else G.spiritStones = (G.spiritStones || 0) + value;
        } else continue;
        const label = STORY_EFFECT_LABELS[key] || key;
        lines.push(label + (value > 0 ? '+' : '') + value);
    }
    while (G.realm < window.REALMS.length - 1 && G.cultivation >= window.REALMS[G.realm + 1].cult) G.realm++;
    G.hp = Math.max(1, Math.min(G.maxHp, G.hp));
    updateHUD();
    return lines;
}

function chooseStoryOption(node, idx) {
    let opt = node.options[idx];
    if (!opt) { console.error('无效选项索引:', idx); return; }
    if (G.story.done.indexOf(node.id) < 0) G.story.done.push(node.id);
    const gained = applyStoryEffects(opt.effects);
    if (opt.flags) Object.assign(G.flags, opt.flags);
    if (opt.toast) {
        toast(opt.toast + (gained.length ? ' · ' + gained.join('，') : ''), 'gold');
    } else if (gained.length) {
        toast('✨ ' + gained.join('，'), 'gold');
    }
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
    let talent = getTalentDef();
    $('endDesc').textContent = '道号「' + (G.username || '无名') + '」，' +
        (o ? o.name : '散修') + '出身，' + (talent ? talent.name : '凡骨') + '之资，如今已是青云仙门弟子。';
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
    if (typeof addSectContribution === 'function') {
        addSectContribution((window.SECT && window.SECT.contributionPerFloor) || 8);
    }
    let run = Engine.getState();
    // 与 NPC 的切磋/生死斗：一场一对一的人形战斗，胜利后回大地图
    if (run.duel && run.duelNpc) {
        const npc = run.duelNpc;
        if (!G.npcRelations) G.npcRelations = {};
        G.npcRelations[npc.id] = Math.max(-100, Math.min(100, getNpcRelation(npc) - 4));
        G.flags.duels = (G.flags.duels || 0) + 1;
        const reward = 20 + G.realm * 4;
        if (typeof gainCultivation === 'function') gainCultivation(reward);
        addSpiritStones(12 + G.realm * 2);
        if (npc.id === 'mochen' || npc.id === 'jichang') {
            addItem('jade_slip', 1);
        } else {
            addSectContribution(10);
        }
        Engine.finishRun(true);
        run.duel = false;
        run.duelNpc = null;
        toast('⚔️ 你胜了 ' + npc.name + ' · 修为+' + reward + ' · 灵石+' + (12 + G.realm * 2), 'gold');
        saveGame(false);
        Engine.startWorld();
        return;
    }
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
            toast('🔥 熔岩地龙被斩！赤炎洞窟通关！', 'gold');
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
            toast('💀 幽墟镇墓兽倒下！古墟通关！', 'gold');
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
    const run = Engine.getState();
    if (run.duel && run.duelNpc) {
        const npc = run.duelNpc;
        if (!G.npcRelations) G.npcRelations = {};
        G.npcRelations[npc.id] = Math.max(-100, Math.min(100, getNpcRelation(npc) - 8));
        G.flags.duelLosses = (G.flags.duelLosses || 0) + 1;
        run.duel = false;
        run.duelNpc = null;
    }
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
