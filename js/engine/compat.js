'use strict';

function initCompatibilityLayer() {
    window.drawCardsByTier = function(available, count, floor, getRank) {
        const tiers = { common: 0.65, uncommon: 0.25, rare: 0.08, legendary: 0.02 };
        const weights = available.map(c => {
            const base = tiers[c.rarity || 'common'] || 0.65;
            const rankPenalty = Math.pow(0.35, getRank(c.id) || 0);
            return base * rankPenalty;
        });
        const total = weights.reduce((a, b) => a + b, 0);
        const picked = [];
        const availableCopy = [...available];
        const weightsCopy = [...weights];
        for (let i = 0; i < count && availableCopy.length > 0; i++) {
            const r = Math.random() * weightsCopy.reduce((a, b) => a + b, 0);
            let sum = 0;
            let idx = 0;
            for (let j = 0; j < weightsCopy.length; j++) {
                sum += weightsCopy[j];
                if (r <= sum) { idx = j; break; }
            }
            picked.push(availableCopy[idx]);
            availableCopy.splice(idx, 1);
            weightsCopy.splice(idx, 1);
        }
        return picked;
    };

    window.cardArt = function(cardId) {
        const emojiMap = {
            power1: '⚔️', hp1: '🛡️', speed1: '💨', range1: '🌀', spring: '⛲',
            leech1: '🩸', crit1: '🎯', qi1: '🌀',
            bloodrage: '😤', shadow: '👤', demonblade: '🗡️', wine: '🍶', beast: '🍖', mirror: '🪞',
            souldagger: '🔪'
        };
        return '<span class="card-art">' + (emojiMap[cardId] || '🃏') + '</span>';
    };

    window.getCardDrawTierLabel = function(card) {
        const tier = card.rarity || 'common';
        const labels = { common: '普通', uncommon: '精良', rare: '稀有', legendary: '传说' };
        return labels[tier] || tier;
    };

    window.getCardEvolutions = function(card) {
        const evolutions = {
            power1: [
                { id: 'power1_evo1', name: '破军', desc: '攻击+8，暴击+5%', effects: { atk: 8, crit: 5 } },
                { id: 'power1_evo2', name: '贪狼', desc: '攻击+5，速度+0.5，吸血+2', effects: { atk: 5, speed: 0.5, lifesteal: 2 } }
            ],
            hp1: [
                { id: 'hp1_evo1', name: '金钟罩', desc: '最大生命+60，护盾+5%', effects: { maxHp: 60, shield: 0.05 } },
                { id: 'hp1_evo2', name: '铁布衫', desc: '最大生命+40，减伤20%', effects: { maxHp: 40 } }
            ],
            speed1: [
                { id: 'speed1_evo1', name: '疾风步', desc: '速度+1.2，闪避+10%', effects: { speed: 1.2, dodge: 0.1 } },
                { id: 'speed1_evo2', name: '流光飞影', desc: '速度+0.8，连击+1', effects: { speed: 0.8, combo: 1 } }
            ]
        };
        return evolutions[card.id] || [];
    };

    window.floatText = function(x, y, text, color) {
        const state = window.gameState?.runtime;
        if (state) {
            state.texts.push({ x, y, text, color, t: 0, life: 1.2, vy: -30 });
        }
    };

    window.gainCultivation = function(amount) {
        window.G.cultivation += amount;
        while (window.G.realm < window.REALMS.length - 1 &&
            window.G.cultivation >= window.REALMS[window.G.realm + 1].cult) {
            window.G.realm++;
            window.toast('🎉 境界突破：' + window.REALMS[window.G.realm].name, 'gold');
        }
        window.updateHUD();
    };

    window.hurtPlayer = function(damage) {
        if (window.Engine && window.Engine.combatSystem) {
            window.Engine.combatSystem.hurtPlayer(damage);
        }
    };

    window.killMonster = function(monster, index) {
        if (window.Engine && window.Engine.combatSystem) {
            window.Engine.combatSystem.killMonster(monster, index);
        }
    };

    window.damageMonster = function(monster, bullet) {
        if (window.Engine && window.Engine.combatSystem) {
            window.Engine.combatSystem.damageMonster(monster, bullet);
        }
    };

    window.showDualCardChoice = function() {
        if (window.Engine && window.Engine.cardSystem) {
            window.Engine.cardSystem.showDualCardChoice();
        }
    };

    window.learnDungeonTechnique = function(dungeonId) {
        if (window.Engine && window.Engine.worldSystem) {
            const dungeon = window.DUNGEONS.find(d => d.id === dungeonId);
            if (dungeon) {
                const next = dungeon.techniques.find(id => !(window.G.learnedTechniques || []).includes(id));
                if (next) window.learnPermanentTechnique(next, '秘境传承');
                else window.toast('📘 此处功法已尽数学会', 'good');
            }
        }
    };

    window.onDungeonFloorClear = function(floor) {
        if (window.Engine && window.Engine.combatSystem) {
            window.Engine.combatSystem.combatSystem?.onFloorClear?.(floor);
        }
    };

    window.onDungeonDeath = function() {
        if (window.Engine) window.Engine.stopRun();
        window.hideOverlay('cardsOverlay');
        window.toast('💀 已返回大地图，可在当前地点再次挑战', 'bad');
        if (window.Engine) window.Engine.startWorld();
    };

    window.onDungeonClear = function() {
        window.G.hp = window.G.maxHp;
        window.saveGame(false);
    };

    window.onWorldNpcNearby = function(npc) {
        if (window.Engine && window.Engine.npcManager) {
            window.Engine.npcManager.showDialog(npc);
        }
    };

    window.onWorldStoryNearby = function(node) {
        if (window.showStoryDialog) window.showStoryDialog(node);
    };

    window.onDungeonNpcNearby = function(npc) {
        if (window.Engine && window.Engine.npcManager) {
            window.Engine.npcManager.showDialog(npc);
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompatibilityLayer);
} else {
    initCompatibilityLayer();
}