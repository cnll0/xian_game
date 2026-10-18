'use strict';

class CardSystem {
    constructor(gameState, eventBus) {
        this.state = gameState.runtime;
        this.eventBus = eventBus;
    }

    showDualCardChoice() {
        const pCards = this._drawRunCards('player', 3);
        const mCards = this._drawRunCards('monster', 2);

        let html = '<div class="dual-choice-grid">';
        html += '<div class="dual-column"><h4>🎴 修士机缘</h4>';
        pCards.forEach(c => { html += this._cardHTML(c, 'player'); });
        html += '</div>';
        html += '<div class="dual-column"><h4>👿 妖祸契约</h4>';
        mCards.forEach(c => { html += this._cardHTML(c, 'monster'); });
        html += '</div></div>';

        document.getElementById('dualCardOverlay').querySelector('.dual-card-box').innerHTML = html;

        document.querySelectorAll('.dual-choice-card').forEach(card => {
            card.addEventListener('click', () => {
                const side = card.dataset.side;
                const cid = card.dataset.cid;
                this._pickDualCard(side, cid);
            });
        });

        window.showOverlay('dualCardOverlay');
    }

    _drawRunCards(side, count) {
        const available = side === 'player'
            ? window.CARDS.filter(c => this.state.cardRanks.player[c.id] < 3)
            : window.MONSTER_RUN_CARDS.filter(c => this.state.cardRanks.monster[c.id] < 3);

        return window.drawCardsByTier(available, count, this.state.floor, c =>
            side === 'player' ? this.state.cardRanks.player[c.id] : this.state.cardRanks.monster[c.id]
        ).map(c => Object.assign({}, c, {
            rank: side === 'player' ? this.state.cardRanks.player[c.id] : this.state.cardRanks.monster[c.id]
        }));
    }

    _cardHTML(card, side) {
        const rankLabel = card.rank === 0 ? '初获' : card.rank === 1 ? '进阶 2/3' : '进化 3/3';
        const branches = card.rank >= 2 ? window.getCardEvolutions(card) : [];
        const rarityClass = card.rarity || 'common';
        const typeClass = card.type || 'pure';
        const curseClass = card.curseTier ? ' curse-' + card.curseTier : '';

        let effLines = '';
        for (const k in card.effects) {
            const v = card.effects[k];
            const label = { atk: '攻击', maxHp: '生命上限', speed: '速度', range: '范围', lifesteal: '吸血', crit: '暴击', hp: '当前生命', cult: '修为' }[k] || k;
            effLines += '<div class="effect-line"><span class="stat">' + label + '</span><span class="val ' + (v > 0 ? 'positive' : 'negative') + '">' + (v > 0 ? '+' : '') + v + '</span></div>';
        }
        for (const k in card.monsterEffects || {}) {
            const v = card.monsterEffects[k];
            const label = { hpMul: '妖魔生命', atkMul: '妖魔攻击', spdMul: '妖魔速度', cntAdd: '妖魔数量', forceElite: '精英妖魔', shield: '妖魔护盾', regen: '妖魔回复', thorns: '妖魔反伤', split: '妖魔分裂', explode: '妖魔自爆', teleport: '妖魔瞬移', summonCd: '召唤间隔' }[k] || k;
            const value = (k === 'hpMul' || k === 'atkMul' || k === 'spdMul') ? '+' + Math.round((v - 1) * 100) + '%' : typeof v === 'boolean' ? (v ? '开启' : '关闭') : '+' + v;
            effLines += '<div class="effect-line enemy-effect"><span class="stat">' + label + '</span><span class="val negative">' + value + '</span></div>';
        }

        return '<div class="dual-choice-card ' + typeClass + ' ' + rarityClass + curseClass + '" data-side="' + side + '" data-cid="' + card.id + '">' +
            window.cardArt(card.id) +
            '<span class="rarity">' + window.getCardDrawTierLabel(card) + '</span>' +
            '<div class="card-name">' + card.name + '<span class="card-rank">' + rankLabel + '</span></div>' +
            '<div class="card-desc">' + card.desc + '</div>' +
            '<div class="card-effects">' + effLines + '</div>' +
            (branches.length ? '<div class="evolution-choices"><span class="evolution-title">选择进化路线</span>' + branches.map(b => '<button type="button" class="evolution-choice" data-branch="' + b.id + '"><strong>' + b.name + '</strong><span>' + b.desc + '</span></button>').join('') + '</div>' : '') +
            '</div>';
    }

    _pickDualCard(side, cardId, branchId) {
        const cards = side === 'player' ? this._pendingPlayerCards : this._pendingMonsterCards;
        const c = cards.find(x => x.id === cardId);
        if (!c) return;

        if (this.state.cardRanks[side][cardId] >= 2 && !branchId) {
            window.toast('请选择一条进化路线', 'gold');
            return;
        }

        let lines = side === 'player'
            ? this._applyPlayerCard(c, branchId)
            : this._applyMonsterCard(c, branchId);

        const branch = branchId && window.getCardEvolutions(c).find(b => b.id === branchId);
        const rankText = c.rank > 0 && !branchId ? ' · ' + (c.rank === 1 ? '进阶 2/3' : '进化 3/3') : '';
        const curseGrade = c.type === 'cursed' ? ' · 诅咒·' + window.CARD_CURSE_TIER_LABELS[c.curseTier] : '';

        window.toast((c.emoji || '👿') + ' ' + c.name + (branch ? ' → ' + branch.name : rankText + curseGrade) + '：' + lines.join('，'),
            c.type === 'cursed' || c.type === 'monster' ? 'bad' : c.type === 'mixed' || branch ? 'gold' : 'good');

        window.checkAchievements();
        window.saveGame(false);
        window.hideOverlay('dualCardOverlay');
        this.state.state = 'playing';
    }

    _pendingPlayerCards = [];
    _pendingMonsterCards = [];

    _applyPlayerCard(c, branchId) {
        let previousShieldMax = this.state.player.shieldMax || 0;
        const lines = [];
        const rank = this.state.cardRanks.player[c.id] || 0;

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

        this.state.cardRanks.player[c.id] = Math.min(3, rank + 1);

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
        const rank = this.state.cardRanks.monster[c.id] || 0;

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

        this.state.cardRanks.monster[c.id] = Math.min(3, rank + 1);

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

    _applyCurseDuplicateBonus(card, side) {
        const lines = [];
        if (card.curseUpgrade) {
            for (const k in card.curseUpgrade) {
                const v = card.curseUpgrade[k];
                if (side === 'player') {
                    if (typeof v === 'boolean') this.state.player.mods[k] = v;
                    else this.state.player.mods[k] = (this.state.player.mods[k] || 0) + v;
                } else {
                    this._applyMonsterModifier(k, v);
                }
                lines.push(this._formatEffectLine(k, v));
            }
        }
        return lines;
    }

    _applyCurseEvolution(branch, side) {
        const lines = [];
        if (branch.curseUpgrade) {
            for (const k in branch.curseUpgrade) {
                const v = branch.curseUpgrade[k];
                if (side === 'player') {
                    if (typeof v === 'boolean') this.state.player.mods[k] = v;
                    else this.state.player.mods[k] = (this.state.player.mods[k] || 0) + v;
                } else {
                    this._applyMonsterModifier(k, v);
                }
                lines.push(this._formatEffectLine(k, v));
            }
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