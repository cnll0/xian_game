'use strict';

class CardSystem {
    constructor(gameState, eventBus) {
        this.state = gameState.runtime;
        this.eventBus = eventBus;
    }

    showDualCardChoice() {
        this._pendingPlayerCards = this._drawCards(window.PLAYER_CARDS || [], 3, 'player');
        this._pendingMonsterCards = this._drawCards(
            (window.MONSTER_CARDS || []).filter(c => c.type !== 'cursed'), 3, 'monster');
        this._pendingCurseCards = (window.MONSTER_CARDS || [])
            .filter(c => c.type === 'cursed')
            .map(c => Object.assign({}, c, {
                rank: this.state.cards.monster[c.id] || 0,
                selected: false,
                selectedBranch: null
            }));
        this.state.state = 'choosing';
        this._renderDualUI();
    }

    _drawCards(source, count, side) {
        const ranks = this.state.cards[side];
        const available = source.filter(c => (ranks[c.id] || 0) < 3);
        return window.drawCardsByTier(available, count, this.state.floor, c => ranks[c.id] || 0)
            .map(c => Object.assign({}, c, {
                rank: ranks[c.id] || 0,
                selected: false,
                selectedBranch: null
            }));
    }

    _renderDualUI() {
        const columns = [
            { side: 'player', id: 'playerCardChoices', title: '✨ 玩家强化', cards: this._pendingPlayerCards },
            { side: 'curse', id: 'curseCardChoices', title: '💀 诅咒机缘', cards: this._pendingCurseCards },
            { side: 'monster', id: 'monsterCardChoices', title: '👿 妖魔强化', cards: this._pendingMonsterCards }
        ];

        let html = '<h2>🎴 第' + this.state.floor + '层 · 玩家与妖魔选择数量需相同，诅咒可选</h2>';
        html += '<div class="dual-cards">';
        for (const column of columns) {
            html += '<div class="card-column"><h3>' + column.title + '</h3>';
            html += '<div class="card-choices" id="' + column.id + '">';
            for (const card of column.cards) html += this._cardHTML(card, column.side);
            html += '</div></div>';
        }
        html += '</div>';
        html += '<button class="btn-primary" id="confirmDualBtn" disabled>确认 (玩家 0 / 妖魔 0)</button>';

        const overlay = document.getElementById('dualCardOverlay');
        const content = overlay.querySelector('.overlay-content') || overlay.querySelector('.dual-card-box');
        content.innerHTML = html;

        for (const column of columns) {
            const container = document.getElementById(column.id);
            if (!container) continue;
            container.addEventListener('click', event => {
                const branch = event.target.closest('.evolution-choice');
                if (branch) {
                    event.stopPropagation();
                    const cardEl = branch.closest('.choice-card');
                    this._toggleCard(column.side, cardEl.dataset.id, branch.dataset.branch);
                    return;
                }
                const cardEl = event.target.closest('.choice-card');
                if (cardEl) this._toggleCard(column.side, cardEl.dataset.id);
            });
        }
        document.getElementById('confirmDualBtn').addEventListener('click', () => this._confirmDualChoice());
        this._updateConfirmBtn();
        window.showOverlay('dualCardOverlay');
    }

    _cardHTML(card, side) {
        const rank = card.rank || 0;
        const branches = rank >= 2 ? window.getCardEvolutions(card) : [];
        const sideClass = side === 'player' ? 'player-card' : side === 'monster' ? 'monster-card' : 'curse-card';
        const curseClass = card.curseTier ? ' curse-' + card.curseTier : '';
        const selected = card.selected ? ' selected' : '';

        let effects = '';
        for (const k in card.effects || {}) {
            const v = card.effects[k];
            const label = {
                atk: '攻击', maxHp: '生命上限', speed: '速度', range: '范围', crit: '暴击',
                lifesteal: '吸血', hp: '当前生命', doubleHit: '连击', pierce: '穿透',
                knockback: '击退', stunChance: '眩晕', elemFire: '火属性', elemIce: '冰属性',
                chain: '连锁', dashStrike: '突刺', shield: '护盾', shieldCd: '护盾CD',
                dodge: '闪避', regen: '回复', thorns: '反伤', hpMul: '妖魔生命',
                atkMul: '妖魔攻击', spdMul: '妖魔速度', cntAdd: '妖魔数量',
                forceElite: '精英妖魔', split: '妖魔分裂', explode: '妖魔自爆',
                teleport: '妖魔瞬移', summonCd: '召唤间隔'
            }[k] || k;
            const value = typeof v === 'boolean' ? (v ? '开启' : '关闭')
                : (k === 'hpMul' || k === 'atkMul' || k === 'spdMul') ? '+' + Math.round((v - 1) * 100) + '%'
                    : (v > 0 ? '+' : '') + v;
            effects += '<div class="effect-line"><span class="stat">' + label + '</span><span class="val ' +
                (v > 0 || v === true ? 'positive' : 'negative') + '">' + value + '</span></div>';
        }

        return '<div class="choice-card ' + sideClass + ' ' + (card.rarity || 'common') + ' ' +
            (card.type || '') + curseClass + selected + '" data-side="' + side + '" data-id="' + card.id + '">' +
            window.cardArt(card.id) +
            '<div class="card-name">' + card.name + '<span class="card-rank">' + this._cardRankLabel(rank + 1) + '</span></div>' +
            '<div class="card-desc">' + card.desc + '</div>' +
            '<div class="card-effects">' + effects + '</div>' +
            (branches.length ? '<div class="evolution-choices"><span class="evolution-title">选择进化路线</span>' +
                branches.map(b => '<button type="button" class="evolution-choice" data-branch="' + b.id + '"><strong>' +
                    b.name + '</strong><span>' + b.desc + '</span></button>').join('') + '</div>' : '') +
            '<div class="rarity">' + window.getCardDrawTierLabel(card) + '</div></div>';
    }

    _toggleCard(side, cardId, branchId) {
        const cards = side === 'player' ? this._pendingPlayerCards
            : side === 'monster' ? this._pendingMonsterCards : this._pendingCurseCards;
        const card = cards.find(c => c.id === cardId);
        if (!card) return;
        if (branchId) {
            card.selected = true;
            card.selectedBranch = branchId;
        } else {
            card.selected = !card.selected;
            if (!card.selected) card.selectedBranch = null;
        }
        if (card.selected && cards.filter(c => c.selected).length > 3) {
            card.selected = false;
            card.selectedBranch = null;
            window.toast('每列最多选择 3 张', 'bad');
        }
        const el = document.querySelector('.choice-card[data-side="' + side + '"][data-id="' + cardId + '"]');
        if (el) {
            el.classList.toggle('selected', card.selected);
            el.querySelectorAll('.evolution-choice').forEach(button => {
                button.classList.toggle('active', button.dataset.branch === card.selectedBranch);
            });
        }
        this._updateConfirmBtn();
    }

    _updateConfirmBtn() {
        const button = document.getElementById('confirmDualBtn');
        if (!button) return;
        const pSel = this._pendingPlayerCards.filter(c => c.selected).length;
        const mSel = this._pendingMonsterCards.filter(c => c.selected).length;
        const branchReady = this._pendingPlayerCards.concat(this._pendingMonsterCards, this._pendingCurseCards)
            .every(c => !c.selected || (c.rank || 0) < 2 || !!c.selectedBranch);
        const ready = pSel === mSel && branchReady;
        button.disabled = !ready;
        button.textContent = branchReady
            ? '确认 (玩家 ' + pSel + ' / 妖魔 ' + mSel + ')'
            : '请选择进化分支';
    }

    _confirmDualChoice() {
        const apply = (cards, side) => {
            for (const card of cards.filter(c => c.selected)) {
                if (side === 'player') this._applyPlayerCard(card, card.selectedBranch);
                else this._applyMonsterCard(card, card.selectedBranch);
            }
        };
        apply(this._pendingPlayerCards, 'player');
        apply(this._pendingMonsterCards, 'monster');
        apply(this._pendingCurseCards, 'monster');
        if (window.audioManager) window.audioManager.card();
        this._pendingPlayerCards = [];
        this._pendingMonsterCards = [];
        this._pendingCurseCards = [];
        window.checkAchievements();
        window.saveGame(false);
        window.hideOverlay('dualCardOverlay');
        this.state.state = 'playing';
        window.updateHUD();
    }

    _applyPlayerCard(c, branchId) {
        let previousShieldMax = this.state.player.shieldMax || 0;
        const lines = [];
        const rank = this.state.cards.player[c.id] || 0;

        if (c.type === 'cursed') window.G.flags.cursedPicks = (window.G.flags.cursedPicks || 0) + 1;

        if (c.type !== 'cursed' || rank === 0) {
            for (const k in c.effects) {
                const v = c.effects[k];
                if (typeof v === 'boolean') this.state.player.mods[k] = v;
                else if (k === 'hp') this.state.player.hp = Math.max(1, Math.min(this.state.player.maxHp, this.state.player.hp + v));
                else if (k === 'dashCd' || k === 'shieldCd') {
                    this.state.player.mods[k] = rank === 0 ? v : Math.max(1, (this.state.player.mods[k] || v) - 0.5);
                } else this.state.player.mods[k] = (this.state.player.mods[k] || 0) + v;
                lines.push(this._formatEffectLine(k, v));
            }
        }

        if (c.type !== 'cursed' && rank > 0) {
            const bonus = window.CARD_DUPLICATE_BONUSES[c.id] || {};
            for (const k in bonus) {
                if (k === 'dashCd' || k === 'shieldCd') {
                    this.state.player.mods[k] = Math.max(1, (this.state.player.mods[k] || 3) + bonus[k]);
                } else {
                    this.state.player.mods[k] = (this.state.player.mods[k] || 0) + bonus[k];
                }
                lines.push(this._formatEffectLine(k, bonus[k]));
            }
        }

        let curseGiftLine = '';
        let curseUpgradeLines = [];
        if (c.type === 'cursed' && rank === 0 && c.curseGift) curseGiftLine = this._applyCurseGift(c);
        if (c.type === 'cursed' && rank === 1) curseUpgradeLines = this._applyCurseDuplicateBonus(c, 'player');

        this.state.cards.player[c.id] = Math.min(3, rank + 1);

        let evolutionName = '';
        if (rank >= 2) {
            const branch = window.getCardEvolutions(c).find(b => b.id === c.selectedBranch);
            if (!branch) throw new Error('Missing player card evolution: ' + c.id);
            evolutionName = branch.name;
            if (c.type === 'cursed') {
                curseUpgradeLines = this._applyCurseEvolution(branch, 'player');
            } else {
                for (const k in branch.effects) {
                    const v = branch.effects[k];
                    if (typeof v === 'boolean') this.state.player.mods[k] = v;
                    else if (k === 'dashCd' || k === 'shieldCd') {
                        this.state.player.mods[k] = Math.max(1, (this.state.player.mods[k] || 3) + v);
                    } else this.state.player.mods[k] = (this.state.player.mods[k] || 0) + v;
                    lines.push(this._formatEffectLine(k, v));
                }
            }
            window.floatText(this.state.player.x, this.state.player.y - 45, '✦ 进化·' + branch.name, '#ffe27a');
            this.state.effects.push({ type: 'evolution', x: this.state.player.x, y: this.state.player.y, color: '#ffd76a', t: 0, life: 0.8 });
        }

        if (c.type === 'cursed') {
            window.toast('💀 诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] + '：' + c.name +
                (evolutionName ? ' 进化为「' + evolutionName + '」' : ' · ' + this._cardRankLabel(rank + 1)) +
                (curseGiftLine ? '；特殊机缘：' + curseGiftLine : '') +
                (curseUpgradeLines.length ? '；进阶效果：' + curseUpgradeLines.join('、') : ''), 'bad');
        } else if (evolutionName) {
            window.toast('✦ ' + c.name + ' 进化为「' + evolutionName + '」', 'gold');
        } else {
            window.toast('✨ ' + c.name + ' · ' + this._cardRankLabel(rank + 1), 'good');
        }

        if (this.state.player.mods.maxHp) {
            const oldMax = this.state.player.maxHp;
            this.state.player.maxHp = window.G.maxHp + this.state.player.mods.maxHp;
            this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + (this.state.player.maxHp - oldMax));
        }
        this.state.player.shieldMax = this.state.player.maxHp * this.state.player.mods.shield;
        if (this.state.player.shieldMax > previousShieldMax) {
            this.state.player.shield = Math.min(this.state.player.shieldMax,
                (this.state.player.shield || 0) + this.state.player.shieldMax - previousShieldMax);
            if (previousShieldMax === 0) this.state.player.shieldCooldown = 0;
        }
        window.updateHUD();

        return lines;
    }

    _applyMonsterCard(c, branchId) {
        const lines = [];
        const rank = this.state.cards.monster[c.id] || 0;

        if (c.type === 'cursed') window.G.flags.cursedPicks = (window.G.flags.cursedPicks || 0) + 1;

        if (c.type !== 'cursed' || rank === 0) {
            for (const k in c.effects) {
                const v = c.effects[k];
                if ((k === 'summonCd' || k === 'teleport') && rank > 0) {
                    this.state.monsterMods[k] = Math.max(1, (this.state.monsterMods[k] || v) - 1);
                } else {
                    this._applyMonsterModifier(k, v);
                }
                lines.push(this._formatMonsterEffectLine(k, v));
            }
        }

        let curseRewardLines = [];
        if (c.type === 'cursed' && rank === 0) {
            curseRewardLines = this._applyMonsterCurseConsequences(c);
        } else if (c.type === 'cursed' && rank === 1) {
            curseRewardLines = this._applyCurseDuplicateBonus(c, 'monster');
        }

        if (c.type !== 'cursed' && rank > 0) {
            const bonus = window.CARD_DUPLICATE_BONUSES[c.id] || {};
            for (const k in bonus) this._applyMonsterModifier(k, bonus[k]);
        }

        this.state.cards.monster[c.id] = Math.min(3, rank + 1);

        let evolutionName = '';
        if (rank >= 2) {
            const branch = window.getCardEvolutions(c).find(b => b.id === c.selectedBranch);
            if (!branch) throw new Error('Missing monster card evolution: ' + c.id);
            evolutionName = branch.name;
            if (c.type === 'cursed') {
                curseRewardLines = this._applyCurseEvolution(branch, 'monster');
            } else {
                for (const k in branch.effects) this._applyMonsterModifier(k, branch.effects[k]);
            }
        }

        if (c.type === 'cursed') {
            window.toast('💀 妖魔诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] + '：' + c.name +
                (evolutionName ? ' 进化为「' + evolutionName + '」；' : ' · ' + this._cardRankLabel(rank + 1) + '；') +
                curseRewardLines.join('；'), 'bad');
        } else if (evolutionName) {
            window.toast('👿 ' + c.name + ' 进化为「' + evolutionName + '」', 'bad');
        } else {
            window.toast('👿 妖魔 ' + c.name + ' · ' + this._cardRankLabel(rank + 1), 'bad');
        }

        window.updateHUD();
        return lines;
    }

    _applyMonsterModifier(key, value) {
        if (typeof value === 'boolean') this.state.monsterMods[key] = value;
        else if (key === 'hpMul' || key === 'atkMul' || key === 'spdMul') this.state.monsterMods[key] *= value;
        else this.state.monsterMods[key] = Math.max(0, (this.state.monsterMods[key] || 0) + value);
    }

    _applyMonsterCurseConsequences(card) {
        if (!card.curseCost || !card.curseGift) throw new Error('Incomplete monster curse tradeoff: ' + card.id);
        const costLines = this._applyCardEffects(card.curseCost);
        const giftLine = this._applyCurseGift(card);
        return ['玩家代价：' + costLines.join('、'), '特殊机缘：' + giftLine];
    }

    _applyCurseGift(card) {
        if (!card.curseGift) throw new Error('Missing unique curse gift: ' + card.id);
        for (const key in card.curseGift) {
            const value = card.curseGift[key];
            if (typeof value === 'boolean') this.state.player.mods[key] = value;
            else this.state.player.mods[key] = (this.state.player.mods[key] || 0) + value;
        }
        if (card.curseGift.curseSoulHarvest) return '击杀回复生命上限的' + Math.round(card.curseGift.curseSoulHarvest * 100) + '%';
        if (card.curseGift.curseFrenzy) return '击杀后攻击提升' + Math.round(card.curseGift.curseFrenzy * 100) + '%，持续3.5秒';
        if (card.curseGift.curseLastStand) {
            const survival = 30 + Math.round((this.state.player.mods.curseLastStandHp || 0) * 100);
            return '每层首次受到致命伤时以' + survival + '%生命存活';
        }
        throw new Error('Unknown unique curse gift: ' + card.id);
    }

    _applyPlayerModEffects(effects) {
        for (const k in effects) {
            const v = effects[k];
            if (typeof v === 'boolean') this.state.player.mods[k] = v;
            else if (k === 'hp') this.state.player.hp = Math.max(1, Math.min(this.state.player.maxHp, this.state.player.hp + v));
            else if (k === 'dashCd' || k === 'shieldCd') {
                this.state.player.mods[k] = Math.max(1, (this.state.player.mods[k] || 3) + v);
            } else {
                this.state.player.mods[k] = (this.state.player.mods[k] || 0) + v;
            }
        }
    }

    _applyCurseDuplicateBonus(card, side) {
        const bonus = window.CURSE_DUPLICATE_BONUSES[card.curseTier];
        if (!bonus) throw new Error('Missing curse duplicate bonus: ' + card.id);
        const lines = [];
        if (bonus.playerEffects) {
            if (side === 'player') this._applyPlayerModEffects(bonus.playerEffects);
            else lines.push(...this._applyCardEffects(bonus.playerEffects));
        }
        if (bonus.monsterEffects && side === 'monster') {
            for (const k in bonus.monsterEffects) this._applyMonsterModifier(k, bonus.monsterEffects[k]);
        }
        if (bonus.curseCost) {
            if (side === 'player') this._applyPlayerModEffects(bonus.curseCost);
            else lines.push('进阶代价：' + this._applyCardEffects(bonus.curseCost).join('、'));
        }

        const tier = card.curseTier;
        const gift = {};
        if (card.curseGift.curseSoulHarvest) {
            gift.curseSoulHarvest = tier === 'minor' ? 0.01 : tier === 'major' ? 0.02 : 0.025;
        } else if (card.curseGift.curseFrenzy) {
            gift.curseFrenzy = tier === 'minor' ? 0.04 : tier === 'major' ? 0.06 : 0.08;
        } else if (card.curseGift.curseLastStand) {
            gift.curseLastStandHp = 0.05;
        } else {
            throw new Error('Unknown curse duplicate gift: ' + card.id);
        }
        this._applyCurseGift({ id: card.id, curseGift: gift });
        lines.push('机缘增强');
        return lines;
    }

    _applyCurseEvolution(branch, side) {
        const lines = [];
        if (branch.playerEffects) {
            if (side === 'player') this._applyPlayerModEffects(branch.playerEffects);
            else lines.push(...this._applyCardEffects(branch.playerEffects));
        }
        if (branch.monsterEffects && side === 'monster') {
            for (const k in branch.monsterEffects) this._applyMonsterModifier(k, branch.monsterEffects[k]);
        }
        if (branch.curseCost) {
            if (side === 'player') this._applyPlayerModEffects(branch.curseCost);
            else lines.push('进阶代价：' + this._applyCardEffects(branch.curseCost).join('、'));
        }
        if (branch.curseGift) {
            lines.push('进阶机缘：' + this._applyCurseGift({ id: branch.id, curseGift: branch.curseGift }));
        }
        return lines;
    }

    _applyCardEffects(effects) {
        const lines = [];
        for (const k in effects) {
            const v = effects[k];
            if (typeof v === 'boolean') window.G[k] = v;
            else if (k === 'atk') window.G.atk += v;
            else if (k === 'maxHp') { window.G.maxHp += v; window.G.hp = Math.min(window.G.maxHp, window.G.hp + v); }
            else if (k === 'speed') window.G.speed = +(window.G.speed + v).toFixed(2);
            else if (k === 'range') window.G.range += v;
            else if (k === 'crit') window.G.crit = Math.min(80, window.G.crit + v);
            lines.push(this._formatEffectLine(k, v));
        }
        return lines;
    }

    _formatEffectLine(key, value) {
        const label = { atk: '攻击', maxHp: '最大生命', speed: '速度', range: '攻击范围', crit: '暴击率', lifesteal: '吸血', hp: '当前生命', cult: '修为' }[key] || key;
        return label + (value > 0 ? '+' : '') + value;
    }

    _formatMonsterEffectLine(key, value) {
        const labels = { hpMul: '妖魔生命', atkMul: '妖魔攻击', spdMul: '妖魔速度', cntAdd: '妖魔数量', forceElite: '精英妖魔', shield: '妖魔护盾', regen: '妖魔回复', thorns: '妖魔反伤', split: '妖魔分裂', explode: '妖魔自爆', teleport: '妖魔瞬移', summonCd: '召唤间隔' };
        const label = labels[key] || key;
        const change = (key === 'hpMul' || key === 'atkMul' || key === 'spdMul') ? (value > 1 ? '+' : '') + Math.round((value - 1) * 100) + '%' : typeof value === 'boolean' ? (value ? '开启' : '关闭') : '+' + value;
        return label + change;
    }

    _cardRankLabel(rank) {
        return rank === 1 ? '初获' : rank === 2 ? '进阶 2/3' : '进化 3/3';
    }
}

window.CardSystem = CardSystem;