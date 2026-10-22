'use strict';

/* ==================== 背包 / 灵石 / 宗门 ==================== */

function getItemDef(id) {
    return (window.ITEMS || []).find(item => item.id === id) || null;
}

function ensureInventory() {
    if (!G.inventory || typeof G.inventory !== 'object' || Array.isArray(G.inventory)) G.inventory = {};
    return G.inventory;
}

function ensureSect() {
    if (!G.sect || typeof G.sect !== 'object') {
        G.sect = { rank: 0, contribution: 0, lastSalary: '' };
    }
    if (typeof G.sect.rank !== 'number') G.sect.rank = 0;
    if (typeof G.sect.contribution !== 'number') G.sect.contribution = 0;
    if (typeof G.sect.lastSalary !== 'string') G.sect.lastSalary = '';
    return G.sect;
}

function countItem(id) {
    return ensureInventory()[id] || 0;
}

function addItem(id, qty = 1, options = {}) {
    const def = getItemDef(id);
    if (!def || qty <= 0) return false;
    const inventory = ensureInventory();
    inventory[id] = (inventory[id] || 0) + qty;
    if (options.toast) toast((def.emoji || '🎁') + ' 获得 ' + def.name + ' ×' + qty, 'good');
    return true;
}

function removeItem(id, qty = 1) {
    const inventory = ensureInventory();
    const have = inventory[id] || 0;
    if (have < qty) return false;
    if (have === qty) delete inventory[id];
    else inventory[id] = have - qty;
    return true;
}

function inventoryEntries() {
    const inventory = ensureInventory();
    return Object.keys(inventory)
        .map(id => ({ def: getItemDef(id), qty: inventory[id] }))
        .filter(entry => entry.def && entry.qty > 0)
        .sort((a, b) => {
            const order = { consumable: 0, material: 1, treasure: 2 };
            return (order[a.def.type] || 9) - (order[b.def.type] || 9) ||
                a.def.name.localeCompare(b.def.name, 'zh');
        });
}

function addSpiritStones(amount, options = {}) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    G.spiritStones = (G.spiritStones || 0) + Math.round(amount);
    if (options.toast) toast('💎 灵石 +' + Math.round(amount), 'good');
    return Math.round(amount);
}

function spendSpiritStones(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    if ((G.spiritStones || 0) < amount) return false;
    G.spiritStones -= amount;
    return true;
}

function getItemPrice(def, shopId) {
    if (!def || !def.price) return 0;
    const talentDiscount = (G.flags && G.flags.shopDiscount) || 0;
    if (shopId === 'sect') {
        const rank = ensureSect().rank;
        const rankDiscount = (window.SECT && SECT.ranks[rank] && SECT.ranks[rank].discount) || 0;
        const discount = Math.max(rankDiscount, talentDiscount);
        return Math.max(1, Math.round(def.price * (1 - discount)));
    }
    return Math.max(1, Math.round(def.price * (1 - talentDiscount)));
}

function getSectRank() {
    ensureSect();
    return (window.SECT && SECT.ranks[G.sect.rank]) || { name: '外门弟子', contribution: 0, realmMin: 0, salary: 0 };
}

function getNextSectRank() {
    ensureSect();
    return (window.SECT && SECT.ranks[G.sect.rank + 1]) || null;
}

function addSectContribution(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    ensureSect();
    G.sect.contribution += Math.round(amount);
    return Math.round(amount);
}

function canPromoteSect() {
    const next = getNextSectRank();
    if (!next) return false;
    ensureSect();
    return G.sect.contribution >= next.contribution && G.realm >= next.realmMin;
}

function promoteSect() {
    if (!canPromoteSect()) return false;
    ensureSect();
    G.sect.rank++;
    toast('🏯 宗门晋升：' + getSectRank().name, 'gold');
    updateHUD();
    saveGame(false);
    return true;
}

function getTodayKey() {
    const now = new Date();
    return now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
}

function canClaimSectSalary() {
    ensureSect();
    return G.sect.lastSalary !== getTodayKey();
}

function claimSectSalary() {
    if (!canClaimSectSalary()) return 0;
    ensureSect();
    const salary = getSectRank().salary || 0;
    G.sect.lastSalary = getTodayKey();
    addSpiritStones(salary);
    updateHUD();
    saveGame(false);
    return salary;
}

function describeItemEffect(effect) {
    if (!effect) return '';
    const parts = [];
    if (effect.hp) parts.push('恢复' + effect.hp + '生命');
    if (effect.cult) parts.push('修为+' + effect.cult);
    if (effect.atk) parts.push('永久攻击+' + effect.atk);
    if (effect.maxHp) parts.push('永久生命上限+' + effect.maxHp);
    if (effect.shield) parts.push('护盾+' + effect.shield);
    return parts.join('，');
}

function useItem(id) {
    const def = getItemDef(id);
    if (!def || def.type !== 'consumable' || !def.use) return false;
    if (countItem(id) <= 0) return false;

    const runtime = window.gameState && window.gameState.runtime;
    const inRun = runtime && runtime.player &&
        (runtime.state === 'playing' || runtime.state === 'dungeon_world' || runtime.state === 'clear');
    const target = inRun ? runtime.player : null;
    const parts = [];

    if (def.use.shield && !target) {
        toast('护身符需要在秘境中才能生效', 'bad');
        return false;
    }

    if (def.use.hp) {
        const healMul = 1 + ((G.flags && G.flags.healBonus) || 0);
        const healAmount = Math.max(1, Math.round(def.use.hp * healMul));
        if (target) {
            const before = target.hp;
            target.hp = Math.min(target.maxHp, target.hp + healAmount);
            parts.push('恢复' + Math.round(target.hp - before) + '生命');
        } else {
            const before = G.hp;
            G.hp = Math.min(G.maxHp, G.hp + healAmount);
            parts.push('恢复' + Math.round(G.hp - before) + '生命');
        }
    }
    if (def.use.cult) {
        window.gainCultivation(def.use.cult);
        parts.push('修为+' + def.use.cult);
    }
    if (def.use.atk) {
        G.atk += def.use.atk;
        parts.push('永久攻击+' + def.use.atk);
    }
    if (def.use.maxHp) {
        G.maxHp += def.use.maxHp;
        G.hp = Math.min(G.maxHp, G.hp + def.use.maxHp);
        if (target) {
            target.maxHp += def.use.maxHp;
            target.hp = Math.min(target.maxHp, target.hp + def.use.maxHp);
        }
        parts.push('永久生命上限+' + def.use.maxHp);
    }
    if (def.use.shield) {
        if (target) {
            target.shieldMax = Math.max(target.shieldMax || 0, def.use.shield);
            target.shield = Math.min(target.maxHp, (target.shield || 0) + def.use.shield);
            parts.push('护盾+' + def.use.shield);
        } else {
            parts.push('护盾需在秘境中使用');
        }
    }

    removeItem(id, 1);
    updateHUD();
    saveGame(false);
    const message = (def.emoji || '🎁') + ' ' + def.name + (parts.length ? ' · ' + parts.join('，') : '');
    toast(message, 'good');
    if (target && window.floatText) {
        window.floatText(target.x, target.y - 30, def.name, '#ffe27a');
    }
    return true;
}

window.getItemDef = getItemDef;
window.ensureInventory = ensureInventory;
window.ensureSect = ensureSect;
window.countItem = countItem;
window.addItem = addItem;
window.removeItem = removeItem;
window.inventoryEntries = inventoryEntries;
window.addSpiritStones = addSpiritStones;
window.spendSpiritStones = spendSpiritStones;
window.getItemPrice = getItemPrice;
window.getSectRank = getSectRank;
window.getNextSectRank = getNextSectRank;
window.addSectContribution = addSectContribution;
window.canPromoteSect = canPromoteSect;
window.promoteSect = promoteSect;
window.canClaimSectSalary = canClaimSectSalary;
window.claimSectSalary = claimSectSalary;
window.useItem = useItem;
window.describeItemEffect = describeItemEffect;
