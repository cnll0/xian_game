'use strict';

class NPCManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentNPC = null;
        this.currentOverlay = null;
    }

    showDialog(npc, line, hideChoices = false) {
        this.currentNPC = npc;
        this.eventBus.emit('pauseForDialog');

        const score = this.getRelation(npc);
        const relation = this.getRelationLabel(score);

        const portrait = document.getElementById('npcPortrait');
        portrait.setAttribute('aria-label', npc.name + '立绘');
        if (!window.Engine.drawNpcPortrait(npc.id, portrait)) {
            throw new Error('NPC portrait sprite is not ready: ' + npc.id);
        }

        document.getElementById('npcFaction').textContent = npc.faction;
        document.getElementById('npcName').textContent = npc.name;
        document.getElementById('npcTitle').textContent = npc.title;
        document.getElementById('npcDialogue').textContent = line || npc.greeting;

        const badge = document.getElementById('npcRelation');
        badge.textContent = relation.label;
        badge.className = 'npc-relation' + (relation.className ? ' ' + relation.className : '');

        const options = document.getElementById('npcOptions');
        options.replaceChildren();

        if (!hideChoices) {
            npc.choices.forEach((choice, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'option-btn';
                btn.textContent = choice.text;
                btn.addEventListener('click', () => this.chooseOption(npc, choice, index));
                options.appendChild(btn);
            });
        }

        this.currentOverlay = 'npcOverlay';
        window.showOverlay('npcOverlay');
    }

    chooseOption(npc, choice, index) {
        if (npc.dungeonEncounter) {
            const result = window.Engine.resolveDungeonNpcEncounter(choice);
            // 秘境NPC遭遇：显示结果后直接恢复游戏，不再弹二次对话框
            window.toast(npc.name + ' · ' + result, 'gold');
            window.Engine.resumeFromNpcDialog();
            return;
        }

        if (!window.G.npcChoices) window.G.npcChoices = {};
        const chosen = window.G.npcChoices[npc.id] || [];
        const firstChoice = !chosen.includes(index);

        if (firstChoice) {
            chosen.push(index);
            window.G.npcChoices[npc.id] = chosen;
            window.G.npcRelations[npc.id] = MathUtils.clamp(
                this.getRelation(npc) + (choice.favor || 0), -100, 100
            );
        }

        const claims = window.G.npcRewardClaims || (window.G.npcRewardClaims = {});
        const claimId = npc.id + ':' + index;

        if (firstChoice && choice.technique && window.learnPermanentTechnique(choice.technique, npc.name + '传授')) {
            claims[claimId] = true;
        } else if (firstChoice && choice.reward && !claims[claimId]) {
            for (const key in choice.reward) {
                const amount = choice.reward[key];
                if (key === 'atk') window.G.atk += amount;
                else if (key === 'maxHp') { window.G.maxHp += amount; window.G.hp = Math.min(window.G.maxHp, window.G.hp + amount); }
                else if (key === 'speed') window.G.speed = +(window.G.speed + amount).toFixed(2);
                else if (key === 'range') window.G.range += amount;
                else if (key === 'crit') window.G.crit = Math.min(80, window.G.crit + amount);
            }
            claims[claimId] = true;
            window.updateHUD();
            window.toast('✨ ' + npc.name + ' 的指点让你有所精进', 'gold');
        }

        if (!firstChoice) {
            this.showDialog(npc, '你们已经谈过这件事了。' + choice.reply);
        } else {
            this.showDialog(npc, choice.reply);
        }
        window.saveGame(false);
    }

    getRelation(npc) {
        if (!window.G.npcRelations) window.G.npcRelations = {};
        if (typeof window.G.npcRelations[npc.id] !== 'number') {
            window.G.npcRelations[npc.id] = npc.attitude === 'friendly' ? 24 :
                npc.attitude === 'hostile' ? -32 : 0;
        }
        return window.G.npcRelations[npc.id];
    }

    getRelationLabel(score) {
        if (score <= -25) return { label: '敌对', className: 'hostile' };
        if (score <= -8) return { label: '戒备', className: 'hostile' };
        if (score >= 40) return { label: '友好', className: 'friendly' };
        if (score >= 18) return { label: '熟络', className: 'friendly' };
        return { label: '中立', className: '' };
    }

    closeDialog() {
        window.hideOverlay('npcOverlay');
        this.eventBus.emit('resumeFromDialog');
        this.currentNPC = null;
        this.currentOverlay = null;
    }

    showDungeonSelector() {
        const list = document.getElementById('dungeonChoices');
        list.replaceChildren();

        for (const dungeon of window.DUNGEONS) {
            const unlocked = window.G.realm >= dungeon.realmMin;
            const requiredRealm = window.REALMS[dungeon.realmMin].name;

            const card = document.createElement('article');
            card.className = 'dungeon-choice' + (unlocked ? '' : ' locked');

            const title = document.createElement('h3');
            title.textContent = (unlocked ? '🌀 ' : '🔒 ') + dungeon.name;

            const rank = document.createElement('div');
            rank.className = 'dungeon-rank';
            rank.textContent = dungeon.subtitle + ' · ' + dungeon.floorCount + '层';

            const desc = document.createElement('p');
            desc.textContent = unlocked
                ? '游荡妖兽：' + Array.from(new Set(dungeon.floorPool.flat()))
                    .map(id => window.MONSTERS[id].name).join('、')
                : '需达到' + requiredRealm + '方可进入';

            const btn = document.createElement('button');
            btn.className = unlocked ? 'btn-primary' : 'btn-secondary';
            btn.disabled = !unlocked;
            btn.textContent = unlocked ? '进入野外秘境' : '境界未达';

            if (unlocked) {
                btn.addEventListener('click', () => {
                    window.hideOverlay('dungeonSelectOverlay');
                    window.Engine.startDungeonWorld(dungeon.id);
                });
            }

            card.append(title, rank, desc, btn);
            list.appendChild(card);
        }
        window.showOverlay('dungeonSelectOverlay');
    }

    showTechniques() {
        window.closeMenu();
        const list = document.getElementById('techniquesList');
        list.replaceChildren();

        const learned = window.TECHNIQUES.filter(t => (window.G.learnedTechniques || []).includes(t.id));

        if (!learned.length) {
            const empty = document.createElement('div');
            empty.className = 'techniques-empty';
            empty.textContent = '尚未参悟功法。探索秘境、与修士交流，寻找传承。';
            list.appendChild(empty);
        }

        for (const tech of learned) {
            const entry = document.createElement('article');
            entry.className = 'technique-entry';

            const icon = document.createElement('div');
            icon.className = 'technique-icon';
            icon.textContent = '📜';

            const content = document.createElement('div');
            const title = document.createElement('h3');
            title.textContent = tech.name;
            const school = document.createElement('small');
            school.textContent = tech.school;
            const desc = document.createElement('p');
            desc.textContent = tech.desc;

            content.append(title, school, desc);
            entry.append(icon, content);
            list.appendChild(entry);
        }
        window.showOverlay('techniquesOverlay');
    }
}

window.NPCManager = NPCManager;