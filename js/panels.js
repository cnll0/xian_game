'use strict';

/* ==================== 背包 / 宗门 / 商店 UI ==================== */

let _inventorySelected = null;
let _currentShop = 'sect';
let _shopTab = 'buy';

function itemIconHTML(def, extraClass = '') {
    if (!def) return '';
    const cls = 'item-icon ' + extraClass + (def.rarity ? ' rarity-' + def.rarity : '');
    return '<svg class="' + cls + '" viewBox="0 0 32 32" aria-hidden="true">' +
        '<use href="assets/item-icons.svg#' + def.icon + '" xlink:href="assets/item-icons.svg#' + def.icon + '"></use></svg>';
}

function itemTypeLabel(def) {
    return { consumable: '丹药 / 消耗品', material: '材料', treasure: '珍宝' }[def.type] || '物品';
}

function itemRarityLabel(def) {
    return { common: '凡品', uncommon: '玄品', rare: '地品', epic: '天品' }[def.rarity] || '';
}

function closePanelOverlays() {
    ['inventoryOverlay', 'sectOverlay', 'shopOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.classList.contains('active')) hideOverlay(id);
    });
}

function showInventory() {
    closeMenu();
    closePanelOverlays();
    if (!_inventorySelected || !countItem(_inventorySelected)) {
        const entries = inventoryEntries();
        _inventorySelected = entries.length ? entries[0].def.id : null;
    }
    renderInventory();
    showOverlay('inventoryOverlay');
}

function renderInventory() {
    const grid = $('inventoryGrid');
    const detail = $('inventoryDetail');
    const stoneEl = $('invStones');
    if (!grid || !detail) return;
    if (stoneEl) stoneEl.textContent = G.spiritStones || 0;

    const entries = inventoryEntries();
    if (!entries.length) {
        grid.innerHTML = '<div class="inventory-empty">行囊空空如也。<br><small>秘境宝箱、妖兽和宗门商店都会给这里添点东西。</small></div>';
        detail.innerHTML = '<div class="inventory-empty">还没有可以查看的物品。</div>';
        return;
    }
    if (!_inventorySelected || !countItem(_inventorySelected)) {
        _inventorySelected = entries[0].def.id;
    }

    grid.innerHTML = entries.map(entry => {
        const def = entry.def;
        return '<button type="button" class="inventory-slot ' + (def.rarity || 'common') + ' ' +
            (_inventorySelected === def.id ? 'selected' : '') + '" onclick="selectInventoryItem(\'' + def.id + '\')">' +
            itemIconHTML(def) +
            '<span class="slot-name">' + def.name + '</span>' +
            '<span class="slot-qty">×' + entry.qty + '</span>' +
            '</button>';
    }).join('');

    const entry = entries.find(item => item.def.id === _inventorySelected) || entries[0];
    const def = entry.def;
    const effect = describeItemEffect(def.use);
    const canUse = def.type === 'consumable' && def.use && entry.qty > 0;
    detail.innerHTML =
        '<div class="detail-art ' + (def.rarity || 'common') + '">' + itemIconHTML(def, 'large') + '</div>' +
        '<div class="detail-heading">' +
        '<span class="detail-kicker">' + itemRarityLabel(def) + ' · ' + itemTypeLabel(def) + '</span>' +
        '<h3>' + def.name + '</h3>' +
        '<span class="detail-owned">持有 ×' + entry.qty + '</span>' +
        '</div>' +
        '<p class="detail-desc">' + def.desc + '</p>' +
        (effect ? '<div class="detail-effect">' + effect + '</div>' : '') +
        '<div class="detail-actions">' +
        (canUse
            ? '<button type="button" class="btn-primary" onclick="useInventoryItem(\'' + def.id + '\')">使用</button>'
            : '<button type="button" class="btn-secondary" disabled>不可直接使用</button>') +
        '<button type="button" class="btn-secondary" onclick="showShop(\'sect\');switchShopTab(\'sell\')">去商店出售</button>' +
        '</div>' +
        '<p class="detail-tip">提示：丹药在秘境中也可以使用；材料和珍宝可以在宗门商店出售。</p>';
}

function selectInventoryItem(id) {
    _inventorySelected = id;
    renderInventory();
}

function useInventoryItem(id) {
    if (!useItem(id)) {
        toast('这个物品现在不能使用', 'bad');
        return;
    }
    renderInventory();
}

function showSect() {
    closeMenu();
    closePanelOverlays();
    renderSect();
    showOverlay('sectOverlay');
}

function renderSect() {
    const box = $('sectContent');
    if (!box) return;
    ensureSect();
    const rank = getSectRank();
    const next = getNextSectRank();
    const contribution = G.sect.contribution || 0;
    const rankName = $('sectRankName');
    const contribEl = $('sectContribution');
    const stonesEl = $('sectStones');
    if (rankName) rankName.textContent = rank.name;
    if (contribEl) contribEl.textContent = contribution;
    if (stonesEl) stonesEl.textContent = G.spiritStones || 0;

    let progress = '';
    if (next) {
        const need = Math.max(1, next.contribution - rank.contribution);
        const got = Math.max(0, contribution - rank.contribution);
        const pct = Math.min(100, Math.round(got / need * 100));
        progress = '<div class="sect-progress"><div class="sect-progress-bar"><span style="width:' + pct + '%"></span></div>' +
            '<small>下一阶：' + next.name + ' · 贡献 ' + contribution + '/' + next.contribution +
            ' · 境界 ' + (window.REALMS[next.realmMin] ? window.REALMS[next.realmMin].name : '—') + '</small></div>';
    } else {
        progress = '<p class="sect-max">已至核心弟子，门中上下皆识得你的剑。</p>';
    }

    box.innerHTML =
        '<div class="sect-grid">' +
        '<article class="sect-card">' +
        '<span class="sect-card-kicker">门中身份</span>' +
        '<h3>' + rank.name + '</h3>' +
        '<p>贡献 ' + contribution + ' · 灵石 ' + (G.spiritStones || 0) + '</p>' +
        progress +
        '<button type="button" class="btn-primary" onclick="promoteSectAction()" ' +
        (canPromoteSect() ? '' : 'disabled') + '>申请晋升</button>' +
        '</article>' +
        '<article class="sect-card">' +
        '<span class="sect-card-kicker">宗门俸禄</span>' +
        '<h3>' + rank.salary + ' 灵石</h3>' +
        '<p>每日可领取一次。贡献越高，俸禄越厚。</p>' +
        '<button type="button" class="btn-secondary" onclick="claimSectSalaryAction()" ' +
        (canClaimSectSalary() ? '' : 'disabled') + '>' +
        (canClaimSectSalary() ? '领取今日俸禄' : '今日已领取') + '</button>' +
        '</article>' +
        '<article class="sect-card">' +
        '<span class="sect-card-kicker">执事堂</span>' +
        '<h3>宗门商店</h3>' +
        '<p>丹药、护身符与淬体丹。身份越高，价格越低。</p>' +
        '<button type="button" class="btn-secondary" onclick="openSectShop()">打开商店</button>' +
        '</article>' +
        '</div>' +
        '<div class="sect-note">' +
        '<strong>贡献来源：</strong>秘境每层 +8 · 击败首领 +25 · 通关 +20。' +
        '贡献与境界达到要求后可晋升，晋升会解锁更低的宗门商店折扣。' +
        '</div>';
}

function promoteSectAction() {
    if (!promoteSect()) {
        toast('贡献或境界不足，暂时无法晋升', 'bad');
        return;
    }
    renderSect();
}

function claimSectSalaryAction() {
    const salary = claimSectSalary();
    if (!salary) {
        toast('今日俸禄已经领过了', 'bad');
        return;
    }
    toast('🏯 领取宗门俸禄：灵石 +' + salary, 'gold');
    renderSect();
    updateHUD();
}

function openSectShop() {
    showShop('sect');
}

function showShop(vendorId) {
    closePanelOverlays();
    _currentShop = vendorId || 'sect';
    _shopTab = 'buy';
    renderShop();
    showOverlay('shopOverlay');
}

function switchShopTab(tab) {
    _shopTab = tab === 'sell' ? 'sell' : 'buy';
    renderShop();
}

function renderShop() {
    const shop = window.SHOPS && window.SHOPS[_currentShop];
    if (!shop) return;
    const title = $('shopTitle');
    const keeper = $('shopKeeper');
    const stoneEl = $('shopStones');
    const content = $('shopContent');
    const tabs = $('shopTabs');
    if (title) title.textContent = shop.name;
    if (keeper) keeper.textContent = '掌柜：' + shop.keeper + ' · 灵石 ' + (G.spiritStones || 0);
    if (stoneEl) stoneEl.textContent = G.spiritStones || 0;
    if (tabs) {
        tabs.innerHTML =
            '<button type="button" class="' + (_shopTab === 'buy' ? 'active' : '') + '" onclick="switchShopTab(\'buy\')">买入</button>' +
            '<button type="button" class="' + (_shopTab === 'sell' ? 'active' : '') + '" onclick="switchShopTab(\'sell\')">卖出</button>';
    }
    if (!content) return;

    if (_shopTab === 'buy') {
        content.innerHTML = (shop.stock || []).map(id => {
            const def = getItemDef(id);
            if (!def) return '';
            const price = getItemPrice(def, _currentShop);
            const canBuy = (G.spiritStones || 0) >= price;
            return '<div class="shop-row">' +
                itemIconHTML(def) +
                '<div class="shop-info"><strong>' + def.name + '</strong><small>' + def.desc + '</small></div>' +
                '<div class="shop-owned">持有 ' + countItem(def.id) + '</div>' +
                '<button type="button" class="btn-s" onclick="buyShopItem(\'' + def.id + '\')" ' +
                (canBuy ? '' : 'disabled') + '>💎 ' + price + '</button>' +
                '</div>';
        }).join('') || '<div class="inventory-empty">今日无货。</div>';
    } else {
        const entries = inventoryEntries().filter(entry => entry.def.sell > 0);
        content.innerHTML = entries.map(entry => {
            const def = entry.def;
            return '<div class="shop-row">' +
                itemIconHTML(def) +
                '<div class="shop-info"><strong>' + def.name + '</strong><small>' + def.desc + '</small></div>' +
                '<div class="shop-owned">持有 ' + entry.qty + '</div>' +
                '<button type="button" class="btn-s" onclick="sellShopItem(\'' + def.id + '\')">卖出 💎 ' + def.sell + '</button>' +
                '</div>';
        }).join('') || '<div class="inventory-empty">没有可以出售的物品。</div>';
    }
}

function buyShopItem(id) {
    const shop = window.SHOPS && window.SHOPS[_currentShop];
    const def = getItemDef(id);
    if (!shop || !def || !(shop.stock || []).includes(id)) return;
    const price = getItemPrice(def, _currentShop);
    if (!spendSpiritStones(price)) {
        toast('灵石不足', 'bad');
        return;
    }
    addItem(id, 1);
    toast('💎 买入 ' + def.name + ' ×1', 'good');
    saveGame(false);
    renderShop();
    updateHUD();
}

function sellShopItem(id) {
    const def = getItemDef(id);
    if (!def || !def.sell || countItem(id) <= 0) return;
    if (!removeItem(id, 1)) return;
    addSpiritStones(def.sell);
    toast('💎 卖出 ' + def.name + ' +' + def.sell + ' 灵石', 'good');
    saveGame(false);
    renderShop();
    updateHUD();
}

window.showInventory = showInventory;
window.renderInventory = renderInventory;
window.selectInventoryItem = selectInventoryItem;
window.useInventoryItem = useInventoryItem;
window.showSect = showSect;
window.renderSect = renderSect;
window.promoteSectAction = promoteSectAction;
window.claimSectSalaryAction = claimSectSalaryAction;
window.openSectShop = openSectShop;
window.showShop = showShop;
window.switchShopTab = switchShopTab;
window.buyShopItem = buyShopItem;
window.sellShopItem = sellShopItem;
window.itemIconHTML = itemIconHTML;
