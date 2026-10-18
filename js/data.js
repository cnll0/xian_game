'use strict';

const G = {
    username: null,
    guest: false,
    created: false,
    origin: null,
    realm: 0,
    cultivation: 0,
    atk: 10,
    maxHp: 100,
    speed: 3.2,
    range: 46,
    lifesteal: 0,
    crit: 5,
    hp: 100,
    flags: {},
    story: { node: 's0', done: [] },
    achievements: []
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function checkAchievements() {
    let ctx = { flags: G.flags, realm: G.realm };
    for (let a of window.ACHIEVEMENTS) {
        if (G.achievements.indexOf(a.id) >= 0) continue;
        try {
            if (a.check(ctx)) {
                G.achievements.push(a.id);
                toast('🏆 成就达成：' + a.emoji + ' ' + a.name, 'gold');
            }
        } catch (e) { }
    }
}

const REALMS = [
    { name: '炼气一重', cult: 0 }, { name: '炼气二重', cult: 60 }, { name: '炼气三重', cult: 140 },
    { name: '炼气四重', cult: 260 }, { name: '炼气五重', cult: 420 }, { name: '炼气六重', cult: 620 },
    { name: '炼气七重', cult: 860 }, { name: '炼气八重', cult: 1150 }, { name: '炼气九重', cult: 1500 },
    { name: '筑基初期', cult: 1950 }, { name: '筑基中期', cult: 2500 }, { name: '筑基后期', cult: 3200 },
    { name: '金丹初期', cult: 4100 }, { name: '金丹中期', cult: 5200 }, { name: '金丹后期', cult: 6600 },
    { name: '元婴真人', cult: 8500 }, { name: '化神真君', cult: 11000 }, { name: '渡劫天尊', cult: 15000 },
    { name: '大乘道主', cult: 21000 }
];

const ORIGINS = [
    {
        id: 'poor', emoji: '🌾', name: '寒门子弟', avatarSeed: 'hanmen',
        desc: '出身贫寒，意志坚韧。攻击+2，生命+10。',
        bonus: { atk: 2, maxHp: 10, speed: 0 }
    },
    {
        id: 'merchant', emoji: '🪙', name: '商贾之后', avatarSeed: 'shanggu',
        desc: '身家丰厚，开局自带回春丹。攻击+1，暴击+5。',
        bonus: { atk: 1, maxHp: 0, speed: 0, crit: 5 },
        startItem: 'pill_hp'
    },
    {
        id: 'noble', emoji: '🏛️', name: '没落世家', avatarSeed: 'shijia',
        desc: '祖传剑法小成。攻击+4，范围+8。',
        bonus: { atk: 4, maxHp: 0, speed: 0, range: 8 }
    },
    {
        id: 'hunter', emoji: '🏹', name: '山村猎户', avatarSeed: 'liehu',
        desc: '身手矫健。速度+0.6，生命+20。',
        bonus: { atk: 0, maxHp: 20, speed: 0.6 }
    }
];

function originAvatar(o) {
    return 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + encodeURIComponent(o.avatarSeed) + '&backgroundColor=f7efe2';
}

const CARD_TYPE_LABELS = { pure: '✨ 纯增益', mixed: '⚖️ 利弊共存', cursed: '💀 诅咒', monster: '👿 妖祸契约' };
const CURSE_TIERS = {
    minor: { label: '小劫', unlockFloor: 2, weight: 2.4 },
    major: { label: '凶煞', unlockFloor: 4, weight: 0.85 },
    calamity: { label: '天厄', unlockFloor: 7, weight: 0.3 }
};
const CARD_CURSE_TIER_LABELS = Object.fromEntries(Object.entries(CURSE_TIERS).map(([id, tier]) => [id, tier.label]));

const CARDS = [
    { id: 'power1', type: 'pure', emoji: '⚔️', name: '力量符', desc: '攻击力提升3点。', effects: { atk: 3 } },
    { id: 'hp1', type: 'pure', emoji: '🛡️', name: '龟甲符', desc: '最大生命提升25点。', effects: { maxHp: 25 } },
    { id: 'speed1', type: 'pure', rarity: 'uncommon', emoji: '💨', name: '疾风符', desc: '移动速度提升0.5。', effects: { speed: 0.5 } },
    { id: 'range1', type: 'pure', emoji: '🌀', name: '剑罡', desc: '攻击范围+10，攻击+1。', effects: { range: 10, atk: 1 } },
    { id: 'spring', type: 'pure', emoji: '⛲', name: '灵泉沐浴', desc: '回复50生命，最大生命+10。', effects: { hp: 50, maxHp: 10 } },
    { id: 'leech1', type: 'pure', rarity: 'uncommon', emoji: '🩸', name: '噬血牙', desc: '攻击附带2点吸血。', effects: { lifesteal: 2 } },
    { id: 'crit1', type: 'pure', rarity: 'uncommon', emoji: '🎯', name: '会心诀', desc: '暴击率+8%。', effects: { crit: 8 } },
    { id: 'qi1', type: 'pure', rarity: 'uncommon', emoji: '🌀', name: '灵气漩涡', desc: '修为+60，攻击+1。', effects: { cult: 60, atk: 1 } },

    { id: 'bloodrage', type: 'mixed', emoji: '😤', name: '血怒', desc: '攻击+8，但最大生命-15。', effects: { atk: 8, maxHp: -15 } },
    { id: 'shadow', type: 'mixed', emoji: '👤', name: '魔影步', desc: '速度+1.2，但最大生命-8。', effects: { speed: 1.2, maxHp: -8 } },
    { id: 'demonblade', type: 'mixed', emoji: '🗡️', name: '魔剑', desc: '攻击+6、暴击+10，但最大生命-12。', effects: { atk: 6, crit: 10, maxHp: -12 } },
    { id: 'wine', type: 'mixed', emoji: '🍶', name: '陈年灵酒', desc: '攻击+4、速度+0.4，但范围-6。', effects: { atk: 4, speed: 0.4, range: -6 } },
    { id: 'beast', type: 'mixed', emoji: '🍖', name: '妖兽精肉', desc: '最大生命+30，但速度-0.3。', effects: { maxHp: 30, speed: -0.3 } },
    { id: 'mirror', type: 'mixed', emoji: '🪞', name: '照心古镜', desc: '暴击+15、攻击+3，但最大生命-10。', effects: { crit: 15, atk: 3, maxHp: -10 } },

    { id: 'souldagger', type: 'cursed', curseTier: 'minor', curseGift: { curseSoulHarvest: 0.04 }, emoji: '🔪', name: '诅咒匕首', desc: '攻击+15，但最大生命-30、速度-0.4；击杀回复生命上限的4%。', effects: { atk: 15, maxHp: -30, speed: -0.4 } },
    { id: 'soulbanner', type: 'cursed', curseTier: 'major', curseGift: { curseFrenzy: 0.2 }, emoji: '🎏', name: '万魂幡', desc: '攻击+20，当前生命-30；击杀后攻击提升20%，持续3.5秒。', effects: { atk: 20, hp: -30 } },
    { id: 'gu', type: 'cursed', curseTier: 'major', curseGift: { curseSoulHarvest: 0.06 }, emoji: '🦂', name: '噬心蛊', desc: '攻击+12、吸血+4，但最大生命-25；击杀回复生命上限的6%。', effects: { atk: 12, lifesteal: 4, maxHp: -25 } },
    { id: 'miasma', type: 'cursed', curseTier: 'minor', curseGift: { curseFrenzy: 0.15 }, emoji: '☠️', name: '魔气侵蚀', desc: '攻击+10、暴击+20，但速度-0.6、最大生命-15；击杀后攻击提升15%，持续3.5秒。', effects: { atk: 10, crit: 20, speed: -0.6, maxHp: -15 } },
    { id: 'dragonheart', type: 'mixed', rarity: 'epic', emoji: '🐉', name: '烛龙心核', desc: '攻击+18、暴击+18%、吸血+4，但最大生命-25。', effects: { atk: 18, crit: 18, lifesteal: 4, maxHp: -25 } },
    { id: 'spiritcore', type: 'pure', rarity: 'epic', emoji: '💠', name: '太初灵核', desc: '最大生命+70、回复70生命，并获得40点护盾。', effects: { maxHp: 70, hp: 70, shield: 40 } },
    { id: 'heavenbreak', type: 'cursed', curseTier: 'calamity', curseGift: { curseLastStand: true }, emoji: '🌑', name: '逆天血契', desc: '攻击+32、暴击+28%，但最大生命-45、速度-0.6；每层首次受到致命伤时，以30%生命劫后余生。', effects: { atk: 32, crit: 28, maxHp: -45, speed: -0.6 } },
    { id: 'lifebind', type: 'cursed', curseTier: 'calamity', curseGift: { curseSoulHarvest: 0.1 }, emoji: '🩸', name: '血海缚命', desc: '攻击+24、吸血+8，但立即失去45生命且最大生命-25；击杀回复生命上限的10%。', effects: { atk: 24, lifesteal: 8, hp: -45, maxHp: -25 } }
];

const MONSTERS = {
    wolf: { id: 'wolf', name: '灰风狼', img: 'wolf', hp: 30, atk: 8, speed: 2.1, r: 16, draw: 48, cult: 6 },
    bat: { id: 'bat', name: '血翼蝠', img: 'bat', hp: 18, atk: 6, speed: 3.0, r: 12, draw: 36, cult: 5 },
    spider: { id: 'spider', name: '毒玉蛛', img: 'spider', hp: 45, atk: 11, speed: 1.6, r: 18, draw: 52, cult: 9, ranged: true, keepDistance: true, shootRange: 210, shootCd: 3.2, projectileColor: '#a8dc75', poison: 2.2 },
    skeleton: { id: 'skeleton', name: '骷髅弓手', img: 'skeleton', hp: 35, atk: 10, speed: 1.2, r: 16, draw: 48, cult: 10, ranged: true, shootRange: 260, shootCd: 2.2 },
    brute: { id: 'brute', name: '赤甲魈', img: 'brute', hp: 85, atk: 15, speed: 1.15, r: 22, draw: 60, cult: 14 },
    charger: { id: 'charger', name: '裂岩犀', img: 'brute', hp: 92, atk: 17, speed: 1.05, r: 23, draw: 64, cult: 18, charge: true, tint: '#e88a50' },
    shaman: { id: 'shaman', name: '枯木巫祝', img: 'skeleton', hp: 58, atk: 8, speed: 0.85, r: 17, draw: 52, cult: 18, ranged: true, shootRange: 0, shootCd: 4.2, healer: true, tint: '#77d68a' },
    wraith: { id: 'wraith', name: '幽冥游魂', img: 'bat', hp: 48, atk: 13, speed: 1.75, r: 15, draw: 48, cult: 17, blink: true, tint: '#b694ed' },
    slime: { id: 'slime', name: '吞灵软泥', img: 'spider', hp: 72, atk: 10, speed: 0.9, r: 21, draw: 58, cult: 16, splitOnDeath: true, tint: '#66d8c0' },
    slimelet: { id: 'slimelet', name: '软泥幼体', img: 'bat', hp: 18, atk: 5, speed: 2.5, r: 10, draw: 30, cult: 2, tint: '#9be8bd' },
    frostwitch: { id: 'frostwitch', name: '寒魄妖姬', img: 'skeleton', hp: 62, atk: 12, speed: 1.0, r: 17, draw: 54, cult: 20, ranged: true, keepDistance: true, shootRange: 280, shootCd: 2.8, projectileColor: '#8cecff', slow: 1.4, tint: '#8cecff' },
    elite: { id: 'elite', name: '魔将·血煞', img: 'elite', hp: 220, atk: 22, speed: 1.7, r: 26, draw: 72, cult: 45, elite: true },
    boss: { id: 'boss', name: '赤鳞蟒', img: 'boss', hp: 650, atk: 20, speed: 1.35, r: 42, draw: 120, cult: 120 }
};

const FLOOR_POOL = [
    ['wolf', 'bat'],
    ['wolf', 'bat', 'spider'],
    ['wolf', 'spider', 'charger'],
    ['skeleton', 'brute', 'wraith'],
    ['spider', 'skeleton', 'brute', 'slime'],
    ['frostwitch', 'shaman', 'wraith', 'slime'],
    ['brute', 'charger', 'elite'],
    ['wraith', 'frostwitch', 'shaman', 'spider'],
    ['elite', 'charger', 'shaman', 'wraith'],
    ['boss']
];

const DUNGEON_FLOORS = 10;

const FLOOR_NAMES = [
    '秘境入口', '碎石甬道', '幽暗回廊', '白骨浅滩', '灵矿岔路',
    '雾隐竹林', '地火裂隙', '古庙残殿', '寒潭深窟', '蟒巢祭坛'
];

const ITEMS = [
    { id: 'pill_hp', emoji: '💊', name: '回春丹', desc: '恢复50点生命（局内立即生效）', use: { hp: 50 } }
];

/* ==================== 玩家强化卡池 ==================== */
const PLAYER_CARDS = [
    // 基础属性类
    { id: 'atk_up', name: '力量符', desc: '攻击+5', type: 'stat', effects: { atk: 5 } },
    { id: 'hp_up', name: '龟甲符', desc: '最大生命+30', type: 'stat', effects: { maxHp: 30 } },
    { id: 'spd_up', name: '疾风符', desc: '速度+0.6', type: 'stat', effects: { speed: 0.6 } },
    { id: 'rng_up', name: '剑罡', desc: '攻击范围+15', type: 'stat', effects: { range: 15 } },
    { id: 'crit_up', name: '会心诀', desc: '暴击率+10%', type: 'stat', effects: { crit: 10 } },
    { id: 'ls_up', name: '吸血牙', desc: '吸血+3', type: 'stat', effects: { lifesteal: 3 } },

    // 攻击手段类
    { id: 'double_hit', name: '连击术', desc: '普通攻击变为两连击，第二击伤害70%', type: 'mechanic', effects: { doubleHit: true } },
    { id: 'pierce', name: '穿透剑气', desc: '攻击穿透敌人，可击中身后单位', type: 'mechanic', effects: { pierce: true } },
    { id: 'knockback', name: '击退斩', desc: '攻击击退敌人50像素', type: 'mechanic', effects: { knockback: 50 } },
    { id: 'stun_chance', name: '眩晕打击', desc: '15%几率眩晕敌人0.5秒', type: 'mechanic', effects: { stunChance: 0.15, stunDur: 0.5 } },
    { id: 'fire_sword', name: '火灵剑', desc: '攻击附带火属性，额外造成20%灼烧伤害', type: 'mechanic', effects: { elemFire: true, elemDmg: 0.2 } },
    { id: 'ice_sword', name: '冰魄剑', desc: '攻击附带冰属性，30%几率冻结0.8秒', type: 'mechanic', effects: { elemIce: true, freezeChance: 0.3, freezeDur: 0.8 } },
    { id: 'lightning', name: '雷光链', desc: '击中后弹射到周围2个敌人，伤害递减50%', type: 'mechanic', effects: { chain: 2, chainDmg: 0.5 } },
    { id: 'dash_strike', name: '瞬影突刺', desc: '冲刺向鼠标方向，沿途造成伤害，CD 3秒', type: 'mechanic', effects: { dashStrike: true, dashCd: 3 } },

    // 防御/功能类
    { id: 'shield', name: '护体罡气', desc: '获得护盾，吸收伤害等于20%最大生命，8秒CD', type: 'defense', effects: { shield: 0.2, shieldCd: 8 } },
    { id: 'dodge', name: '闪避身法', desc: '10%几率完全闪避攻击', type: 'defense', effects: { dodge: 0.1 } },
    { id: 'regen', name: '吐纳回春', desc: '脱战3秒后每秒回复2%最大生命', type: 'defense', effects: { regen: 0.02 } },
    { id: 'counter', name: '反伤刺甲', desc: '受击反弹30%伤害', type: 'defense', effects: { thorns: 0.3 } },
];

/* ==================== 怪物强化卡池 ==================== */
const MONSTER_CARDS = [
    { id: 'm_hp', name: '妖力暴涨', desc: '所有怪物最大生命+40%', type: 'stat', effects: { hpMul: 1.4 } },
    { id: 'm_atk', name: '杀意凛然', desc: '所有怪物攻击力+30%', type: 'stat', effects: { atkMul: 1.3 } },
    { id: 'm_spd', name: '疾风妖影', desc: '所有怪物移动速度+40%', type: 'stat', effects: { spdMul: 1.4 } },
    { id: 'm_cnt', name: '妖群涌动', desc: '普通波次怪物数量+2（最多+4，不增加首领数量）', type: 'stat', effects: { cntAdd: 2 } },
    { id: 'm_elite', name: '精英降临', desc: '每波必刷1只精英怪', type: 'mechanic', effects: { forceElite: true } },
    { id: 'm_shield', name: '魔气护体', desc: '怪物获得护盾，吸收50点伤害', type: 'defense', effects: { shield: 50 } },
    { id: 'm_regen', name: '妖力回春', desc: '怪物脱战5秒后每秒回复3%生命', type: 'defense', effects: { regen: 0.03 } },
    { id: 'm_thorns', name: '反噬之刺', desc: '怪物反弹20%受到伤害', type: 'defense', effects: { thorns: 0.2 } },
    { id: 'm_split', name: '分裂妖体', desc: '怪物死亡分裂成2只幼体，生命1/3', type: 'mechanic', effects: { split: 2 } },
    { id: 'm_explode', name: '亡魂自爆', desc: '怪物死亡爆炸，半径100像素造成攻击力伤害', type: 'mechanic', effects: { explode: true } },
    { id: 'm_teleport', name: '瞬移妖术', desc: '精英怪获得闪现，每5秒传送到玩家身后', type: 'mechanic', effects: { teleport: 5 } },
    { id: 'm_summon', name: '招妖幡', desc: '每10秒召唤1只普通怪', type: 'mechanic', effects: { summonCd: 10 } },
    { id: 'm_curse_minor', name: '蚀骨妖契', desc: '风险：妖魔生命+12%、攻击+8%；代价：生命上限-18、当前生命-12。特殊机缘：击杀妖魔回复生命上限的4%。', type: 'cursed', curseTier: 'minor', effects: { hpMul: 1.12, atkMul: 1.08 }, curseCost: { maxHp: -18, hp: -12 }, curseGift: { curseSoulHarvest: 0.04 } },
    { id: 'm_curse_major', name: '百鬼夜行', desc: '风险：妖魔生命+25%、攻击+16%、数量+1；代价：生命上限-32、当前生命-24、速度-0.25。特殊机缘：击杀后攻击提升25%，持续3.5秒。', type: 'cursed', curseTier: 'major', effects: { hpMul: 1.25, atkMul: 1.16, cntAdd: 1 }, curseCost: { maxHp: -32, hp: -24, speed: -0.25 }, curseGift: { curseFrenzy: 0.25 } },
    { id: 'm_curse_calamity', name: '万劫妖潮', desc: '风险：妖魔生命+45%、攻击+28%、普通波次必有精英；代价：生命上限-55、当前生命-35、速度-0.45、攻击-5。特殊机缘：每层首次受到致命伤时，以30%生命劫后余生。', type: 'cursed', curseTier: 'calamity', effects: { hpMul: 1.45, atkMul: 1.28, forceElite: true }, curseCost: { maxHp: -55, hp: -35, speed: -0.45, atk: -5 }, curseGift: { curseLastStand: true } },
];

/* ==================== 卡牌稀有度权重 ==================== */
const CARD_RARITY = {
    common: { weight: 60, color: '#b7b7b7', label: '凡品' },
    uncommon: { weight: 30, color: '#70d9c8', label: '玄品' },
    rare: { weight: 10, color: '#78aaff', label: '地品' },
    epic: { weight: 4, color: '#cf83ff', label: '天品' }
};
const CARD_RARITY_LABELS = Object.fromEntries(Object.entries(CARD_RARITY).map(([id, tier]) => [id, tier.label]));

function getCardTierWeight(rarity, floor) {
    let depth = clamp(floor, 1, DUNGEON_FLOORS);
    if (rarity === 'common') return 80 - (depth - 1) * 4;
    if (rarity === 'uncommon') return 18 + (depth - 1) * 1.2;
    if (rarity === 'rare') return depth < 3 ? 0 : 4 + (depth - 3) * 0.75;
    if (rarity === 'epic') return depth < 5 ? 0 : 1.5 + (depth - 5) * 0.25;
    return 0;
}

function getCardDrawTier(card) {
    return card.type === 'cursed' ? 'curse:' + card.curseTier : card.rarity;
}

function getCardDrawTierWeight(tier, floor) {
    if (tier.indexOf('curse:') === 0) {
        let curse = CURSE_TIERS[tier.slice(6)];
        if (!curse || floor < curse.unlockFloor) return 0;
        return curse.weight + Math.max(0, floor - curse.unlockFloor) * 0.12;
    }
    return getCardTierWeight(tier, floor);
}

function getCardDrawTierLabel(card) {
    if (card.type === 'cursed') {
        let tier = CURSE_TIERS[card.curseTier];
        if (!tier) throw new Error('Missing curse tier for card: ' + card.id);
        return '诅咒·' + tier.label;
    }
    return CARD_RARITY_LABELS[card.rarity];
}

function drawCardsByTier(cards, count, floor, getRank) {
    let available = cards.filter(card => getCardDrawTierWeight(getCardDrawTier(card), floor) > 0);
    let picked = [];
    while (picked.length < count && available.length) {
        let tiers = [...new Set(available.map(getCardDrawTier))];
        let totalTierWeight = tiers.reduce((sum, tier) => sum + getCardDrawTierWeight(tier, floor), 0);
        let roll = Math.random() * totalTierWeight;
        let rarity = tiers.find(tier => (roll -= getCardDrawTierWeight(tier, floor)) < 0) || tiers[tiers.length - 1];
        let tierCards = available.filter(card => getCardDrawTier(card) === rarity);
        let cardWeights = tierCards.map(card => {
            let rank = getRank(card);
            return rank >= 2 ? 2 : rank === 1 ? 1.5 : 1;
        });
        let tierRoll = Math.random() * cardWeights.reduce((sum, weight) => sum + weight, 0);
        let index = cardWeights.findIndex(weight => (tierRoll -= weight) < 0);
        let selected = tierCards[index < 0 ? tierCards.length - 1 : index];
        picked.push(selected);
        available = available.filter(card => card.id !== selected.id);
    }
    return picked;
}

const CARD_ART = {
    power1: 'sword', hp1: 'shield', speed1: 'wind', range1: 'aura',
    spring: 'spring', leech1: 'fang', crit1: 'target', qi1: 'qi',
    bloodrage: 'flame', shadow: 'shadow', demonblade: 'twinblades', wine: 'wine',
    beast: 'claw', mirror: 'mirror', souldagger: 'dagger', soulbanner: 'banner',
    gu: 'scorpion', miasma: 'skull', dragonheart: 'twinblades', spiritcore: 'qi',
    heavenbreak: 'skull', lifebind: 'dagger',
    atk_up: 'sword', hp_up: 'shield', spd_up: 'wind', rng_up: 'aura',
    crit_up: 'target', ls_up: 'fang', double_hit: 'twinblades', pierce: 'pierce',
    knockback: 'impact', stun_chance: 'stun', fire_sword: 'flame', ice_sword: 'ice',
    lightning: 'lightning', dash_strike: 'dash', shield: 'armor', dodge: 'dodge',
    regen: 'leaf', counter: 'thorns',
    m_hp: 'heart', m_atk: 'fang', m_spd: 'wind', m_cnt: 'swarm',
    m_elite: 'horn', m_shield: 'shield', m_regen: 'leaf', m_thorns: 'thorns',
    m_split: 'split', m_explode: 'blast', m_teleport: 'portal', m_summon: 'banner',
    m_curse_minor: 'skull', m_curse_major: 'split', m_curse_calamity: 'blast'
};

const CARD_EVOLUTIONS = {
    power1: [
        { id: 'swordintent', name: '剑意通明', desc: '攻击与暴击提升，剑锋迸发金芒。', effects: { atk: 6, crit: 4 } },
        { id: 'swordwave', name: '破空剑潮', desc: '攻击强化并扩大剑罡范围。', effects: { atk: 4, range: 12 } }
    ],
    hp1: [
        { id: 'tortoisewall', name: '玄龟灵甲', desc: '生命上限大幅提升，并回复部分生命。', effects: { maxHp: 40, hp: 20 } },
        { id: 'lifespring', name: '生生不息', desc: '生命上限与灵泉恢复进一步提升。', effects: { maxHp: 25, hp: 35 } }
    ],
    speed1: [
        { id: 'windgod', name: '风神步', desc: '身法更快，暴击也随风势提升。', effects: { speed: 0.45, crit: 4 } },
        { id: 'windblade', name: '风刃步', desc: '疾行同时提升攻击范围与暴击。', effects: { speed: 0.3, range: 8, crit: 4 } }
    ],
    range1: [
        { id: 'sworddomain', name: '剑域初成', desc: '剑罡范围与攻击一同提升。', effects: { range: 15, atk: 3 } },
        { id: 'piercingdomain', name: '贯日剑域', desc: '扩大攻击范围并提高穿透威力。', effects: { range: 10, atk: 5 } }
    ],
    spring: [
        { id: 'spiritlake', name: '灵湖洗髓', desc: '回复大量生命，并提高生命上限。', effects: { hp: 70, maxHp: 20 } },
        { id: 'everflowing', name: '泉涌不息', desc: '大幅回复生命，攻击也得到滋养。', effects: { hp: 50, maxHp: 10, atk: 3 } }
    ],
    leech1: [
        { id: 'soulfeast', name: '噬魂诀', desc: '吸血与攻击同步增强。', effects: { lifesteal: 3, atk: 3 } },
        { id: 'bloodtide', name: '血潮诀', desc: '吸血强化，并提高暴击率。', effects: { lifesteal: 2, crit: 8 } }
    ],
    crit1: [
        { id: 'deadlyfocus', name: '洞幽明心', desc: '暴击与攻击进一步提升。', effects: { crit: 12, atk: 3 } },
        { id: 'bloodmoon', name: '血月追猎', desc: '暴击时更易夺取生命。', effects: { crit: 8, lifesteal: 2 } }
    ],
    qi1: [
        { id: 'qiheart', name: '灵海归元', desc: '修为大增，攻击与生命上限提升。', effects: { cult: 100, atk: 3, maxHp: 10 } },
        { id: 'qisurge', name: '紫府潮生', desc: '修为涌动，暴击与攻击提升。', effects: { cult: 70, atk: 4, crit: 5 } }
    ],
    bloodrage: [
        { id: 'warspirit', name: '战神血脉', desc: '攻击大幅提升，生命代价减轻。', effects: { atk: 9, maxHp: -8 } },
        { id: 'bloodhowl', name: '狂血啸', desc: '攻击与暴击同时提升。', effects: { atk: 6, crit: 8, maxHp: -5 } }
    ],
    shadow: [
        { id: 'ghoststep', name: '鬼影迷踪', desc: '速度与暴击提升，身形愈发难测。', effects: { speed: 0.65, crit: 4 } },
        { id: 'nightblade', name: '夜行杀意', desc: '迅捷身法带来更高攻击与暴击。', effects: { speed: 0.4, atk: 4, crit: 5 } }
    ],
    demonblade: [
        { id: 'demonking', name: '天魔斩', desc: '攻击与暴击大幅提升。', effects: { atk: 9, crit: 8 } },
        { id: 'soulreaper', name: '噬魂魔刃', desc: '魔刃吸血，攻击范围也得到强化。', effects: { atk: 6, lifesteal: 3, range: 6 } }
    ],
    wine: [
        { id: 'drunkenmaster', name: '醉仙步', desc: '速度与攻击提升，范围惩罚消失。', effects: { atk: 6, speed: 0.6, range: 6 } },
        { id: 'flamewine', name: '焚心酒', desc: '攻击暴涨，暴击随酒意而来。', effects: { atk: 8, crit: 7 } }
    ],
    beast: [
        { id: 'beastking', name: '妖王血肉', desc: '生命上限大幅提升，减速影响消退。', effects: { maxHp: 45, speed: 0.2 } },
        { id: 'beastheart', name: '蛮血战躯', desc: '获得额外生命，并提升攻击。', effects: { maxHp: 30, atk: 5 } }
    ],
    mirror: [
        { id: 'truthmirror', name: '照世灵镜', desc: '暴击、攻击与生命上限全面提升。', effects: { crit: 12, atk: 5, maxHp: 10 } },
        { id: 'mirrorimage', name: '镜影杀阵', desc: '暴击与速度提升，行动如镜影。', effects: { crit: 10, speed: 0.35, atk: 3 } }
    ],
    souldagger: [
        { id: 'souldevourer', name: '噬魂凶刃', desc: '攻击再增，吸血弥补生命代价。', effects: { atk: 10, lifesteal: 3, maxHp: -8 } },
        { id: 'soulpiercer', name: '裂魂刺', desc: '极大提升攻击与暴击。', effects: { atk: 12, crit: 8, maxHp: -5 } }
    ],
    soulbanner: [
        { id: 'thousandspirits', name: '万魂归一', desc: '攻击提升并夺取敌方生命。', effects: { atk: 12, lifesteal: 2, hp: -10 } },
        { id: 'ghostarmy', name: '百鬼夜行', desc: '攻击与暴击强化，祭献减少。', effects: { atk: 10, crit: 8, hp: -10 } }
    ],
    gu: [
        { id: 'heartdevourer', name: '噬心母蛊', desc: '攻击与吸血强化，诅咒反噬减轻。', effects: { atk: 8, lifesteal: 3, maxHp: -8 } },
        { id: 'venombloom', name: '万毒蛊心', desc: '暴击与攻击提升，蛊毒更加凶猛。', effects: { atk: 10, crit: 8, maxHp: -5 } }
    ],
    miasma: [
        { id: 'demonheart', name: '天魔蚀心', desc: '攻击与暴击极大提升，速度惩罚减轻。', effects: { atk: 8, crit: 12, speed: 0.2, maxHp: -8 } },
        { id: 'voidmiasma', name: '九幽魔瘴', desc: '攻击大增，生命代价有所缓和。', effects: { atk: 12, crit: 8, maxHp: -5 } }
    ],
    atk_up: [
        { id: 'swordstorm', name: '剑气纵横', desc: '攻击强化，剑气穿透并斩中额外敌人。', effects: { atk: 4, pierce: true, evoBlade: true } },
        { id: 'executioner', name: '破军斩', desc: '暴击与攻击大幅提升，命中迸发金色剑芒。', effects: { atk: 6, crit: 8, evoRuin: true } }
    ],
    hp_up: [
        { id: 'jadeaegis', name: '碧玉灵铠', desc: '提升生命上限，受击时灵盾护身。', effects: { maxHp: 25, shield: 0.2, evoAegis: true } },
        { id: 'vitality', name: '生生不息', desc: '大幅提升生命上限与脱战恢复。', effects: { maxHp: 20, regen: 0.02, evoBloom: true } }
    ],
    spd_up: [
        { id: 'windwalker', name: '御风无痕', desc: '速度与闪避提升，踏风留下残影。', effects: { speed: 0.35, dodge: 0.05, evoPhantom: true } },
        { id: 'thunderstep', name: '雷影步', desc: '迅捷身法获得雷霆突进。', effects: { speed: 0.25, dashStrike: true, dashCd: 4, evoStorm: true } }
    ],
    rng_up: [
        { id: 'sworddomain', name: '剑域', desc: '扩大剑围，挥剑激起环形剑气。', effects: { range: 14, atk: 3, evoBlade: true } },
        { id: 'longshot', name: '贯日剑芒', desc: '攻击穿透并弹射至邻近敌人。', effects: { range: 10, pierce: true, chain: 1, chainDmg: 0.45, evoStorm: true } }
    ],
    crit_up: [
        { id: 'deadlyfocus', name: '洞幽明心', desc: '暴击提升，暴击时迸发灵光。', effects: { crit: 12, atk: 3, evoRuin: true } },
        { id: 'bloodmoon', name: '血月追猎', desc: '暴击与吸血提升，杀意化作血色光环。', effects: { crit: 8, lifesteal: 3, evoSoul: true } }
    ],
    ls_up: [
        { id: 'soulfeast', name: '噬魂', desc: '吸血与攻击提升，击杀后汲取生命。', effects: { lifesteal: 3, atk: 3, evoSoul: true } },
        { id: 'redtide', name: '血潮', desc: '吸血强化并获得血色剑气。', effects: { lifesteal: 2, range: 8, elemFire: true, elemDmg: 0.15, evoFlame: true } }
    ],
    double_hit: [
        { id: 'thundercombo', name: '雷霆三连', desc: '连击升级为疾电三连斩。', effects: { atk: 4, chain: 1, chainDmg: 0.4, evoStorm: true } },
        { id: 'bladestorm', name: '乱刃风暴', desc: '连击范围扩大，每次挥剑留下残影。', effects: { range: 10, atk: 3, evoBlade: true } }
    ],
    pierce: [
        { id: 'swordwave', name: '裂空剑波', desc: '穿透剑气伤害与范围大幅提升。', effects: { atk: 5, range: 12, evoBlade: true } },
        { id: 'chainpiercer', name: '追魂贯日', desc: '穿透后追击邻近敌人，雷弧清晰显现。', effects: { chain: 2, chainDmg: 0.5, evoStorm: true } }
    ],
    knockback: [
        { id: 'quake', name: '崩山击', desc: '击退强化为冲击波，震荡周围敌人。', effects: { knockback: 30, atk: 5, evoRuin: true } },
        { id: 'windpush', name: '风卷残云', desc: '击退距离和攻击范围提升。', effects: { knockback: 35, range: 10, evoPhantom: true } }
    ],
    stun_chance: [
        { id: 'stormprison', name: '雷狱', desc: '眩晕时迸发雷光，电弧追击敌人。', effects: { stunChance: 0.12, chain: 1, chainDmg: 0.4, evoStorm: true } },
        { id: 'frostbind', name: '霜封万里', desc: '冻结时间延长，寒气扩散成霜环。', effects: { stunChance: 0.1, freezeChance: 0.25, evoFrost: true } }
    ],
    fire_sword: [
        { id: 'inferno', name: '焚天', desc: '灼烧持续更久，命中引爆炽热火环。', effects: { elemDmg: 0.25, burnTime: 2.5, burnDmg: 0.16, evoFlame: true } },
        { id: 'phoenix', name: '涅槃炎心', desc: '烈焰同时疗愈自身，火光环绕剑锋。', effects: { elemDmg: 0.15, burnTime: 1.8, burnDmg: 0.1, lifesteal: 2, evoBloom: true, evoFlame: true } }
    ],
    ice_sword: [
        { id: 'glacier', name: '万载冰川', desc: '冻结范围扩大，命中扩散寒冰冲击。', effects: { freezeChance: 0.2, freezeDur: 0.7, evoFrost: true } },
        { id: 'shatter', name: '碎冰诀', desc: '冰冻目标受到额外伤害并碎冰飞溅。', effects: { atk: 5, freezeChance: 0.15, evoRuin: true, evoFrost: true } }
    ],
    lightning: [
        { id: 'thunderlord', name: '九霄雷主', desc: '雷链额外弹射，电光在敌群间跃动。', effects: { chain: 2, chainDmg: 0.15, evoStorm: true } },
        { id: 'thunderblade', name: '奔雷剑', desc: '雷链与攻速强化，挥剑化作闪电。', effects: { atk: 4, speed: 0.2, chain: 1, evoBlade: true, evoStorm: true } }
    ],
    dash_strike: [
        { id: 'afterimage', name: '幻影连闪', desc: '突刺更频繁，留下追击残影。', effects: { dashCd: -0.8, speed: 0.2, evoPhantom: true } },
        { id: 'thundercharge', name: '雷霆贯穿', desc: '突刺获得雷击与穿透效果。', effects: { dashCd: -0.5, pierce: true, chain: 1, evoStorm: true } }
    ],
    shield: [
        { id: 'immortalguard', name: '不灭金身', desc: '护盾更厚，受击时金光震退敌人。', effects: { shield: 0.25, knockback: 20, evoAegis: true } },
        { id: 'wardinglight', name: '护世灵光', desc: '护盾与恢复强化，灵光持续护体。', effects: { shield: 0.15, regen: 0.015, evoBloom: true } }
    ],
    dodge: [
        { id: 'mirage', name: '镜花幻步', desc: '闪避强化，闪避时留下幻影。', effects: { dodge: 0.08, speed: 0.2, evoPhantom: true } },
        { id: 'counterstep', name: '踏影反击', desc: '身法反击强化，反伤光环显现。', effects: { dodge: 0.05, thorns: 0.15, evoAegis: true } }
    ],
    regen: [
        { id: 'evergreen', name: '长青不老', desc: '恢复速度提升，生命流转化作翠色光环。', effects: { regen: 0.02, maxHp: 15, evoBloom: true } },
        { id: 'springheart', name: '灵泉心法', desc: '恢复时获得护盾，生命上限提升。', effects: { regen: 0.01, shield: 0.15, maxHp: 10, evoAegis: true } }
    ],
    counter: [
        { id: 'thornfield', name: '荆棘结界', desc: '反伤提升，近身敌人受到荆棘冲击。', effects: { thorns: 0.2, evoAegis: true } },
        { id: 'reversal', name: '借力打力', desc: '反伤同时吸血，反击迸发血色灵光。', effects: { thorns: 0.1, lifesteal: 2, evoSoul: true } }
    ],
    m_hp: [
        { id: 'ironhide', name: '妖躯铁壁', desc: '妖魔生命与护盾进一步提升。', effects: { hpMul: 1.15, shield: 20 } },
        { id: 'bloodhide', name: '血脉暴君', desc: '妖魔血量越厚，攻击也越凶猛。', effects: { hpMul: 1.1, atkMul: 1.1 } }
    ],
    m_atk: [
        { id: 'bloodlust', name: '嗜血狂潮', desc: '妖魔攻击更强，速度同步提升。', effects: { atkMul: 1.15, spdMul: 1.1 } },
        { id: 'execution', name: '夺命杀阵', desc: '精英妖魔强化，攻击附带压迫感。', effects: { atkMul: 1.2, forceElite: true } }
    ],
    m_spd: [
        { id: 'stormpack', name: '疾风妖群', desc: '妖群更快且数量增加。', effects: { spdMul: 1.15, cntAdd: 1 } },
        { id: 'predators', name: '猎命妖影', desc: '迅捷妖魔获得更高攻击。', effects: { spdMul: 1.1, atkMul: 1.1 } }
    ],
    m_cnt: [
        { id: 'endlesshorde', name: '无尽妖潮', desc: '每波再增加妖魔，妖群更加迅猛。', effects: { cntAdd: 2, spdMul: 1.08 } },
        { id: 'elitehorde', name: '精锐妖潮', desc: '妖魔数量增加并必有精英领队。', effects: { cntAdd: 1, forceElite: true } }
    ],
    m_elite: [
        { id: 'eliteking', name: '百妖之王', desc: '精英更强，并为所有妖魔披甲。', effects: { hpMul: 1.1, atkMul: 1.1, shield: 15 } },
        { id: 'elitehunt', name: '猎杀军团', desc: '精英妖魔更迅捷，妖群也会扩张。', effects: { spdMul: 1.12, cntAdd: 1 } }
    ],
    m_shield: [
        { id: 'barrierwall', name: '魔障天幕', desc: '妖魔护盾显著增强并回复生命。', effects: { shield: 25, regen: 0.01 } },
        { id: 'reflectivehide', name: '镜甲妖躯', desc: '妖魔护盾强化，受击反弹伤害。', effects: { shield: 20, thorns: 0.1 } }
    ],
    m_regen: [
        { id: 'trollblood', name: '不死妖躯', desc: '妖魔恢复大幅增强，并提高生命。', effects: { regen: 0.02, hpMul: 1.1 } },
        { id: 'vitalhorde', name: '生息妖潮', desc: '妖魔恢复并召来更多同伴。', effects: { regen: 0.015, cntAdd: 1 } }
    ],
    m_thorns: [
        { id: 'bramblehide', name: '荆棘魔铠', desc: '反伤强化，妖魔获得额外护盾。', effects: { thorns: 0.15, shield: 15 } },
        { id: 'bloodthorn', name: '血棘领域', desc: '反伤与攻击同时提升。', effects: { thorns: 0.1, atkMul: 1.12 } }
    ],
    m_split: [
        { id: 'swarmheart', name: '千影万身', desc: '分裂妖魔更强，妖群数量增加。', effects: { split: 1, cntAdd: 1, hpMul: 1.08 } },
        { id: 'unstablecore', name: '裂魂妖核', desc: '分裂后爆炸，妖魔攻击提升。', effects: { explode: true, atkMul: 1.12 } }
    ],
    m_explode: [
        { id: 'soulbomb', name: '万魂俱灭', desc: '自爆妖魔获得分裂能力。', effects: { explode: true, split: 1 } },
        { id: 'infernalblast', name: '业火爆裂', desc: '自爆妖魔生命与攻击提升。', effects: { explode: true, hpMul: 1.1, atkMul: 1.1 } }
    ],
    m_teleport: [
        { id: 'voidstalkers', name: '虚空猎手', desc: '瞬移更频繁，妖魔移动更快。', effects: { teleport: -1, spdMul: 1.1 } },
        { id: 'ambushking', name: '背袭之王', desc: '瞬移精英更强，妖群增加。', effects: { teleport: -1, atkMul: 1.1, cntAdd: 1 } }
    ],
    m_summon: [
        { id: 'endlesssummon', name: '万妖来朝', desc: '召唤更频繁，妖群持续增多。', effects: { summonCd: -2, cntAdd: 1 } },
        { id: 'summonlord', name: '妖王号令', desc: '召唤精英妖魔，队伍攻击提升。', effects: { summonCd: -1, forceElite: true, atkMul: 1.08 } }
    ],
    dragonheart: [
        { id: 'dragonfrenzy', name: '烛龙焚世', desc: '攻击与吸血暴涨，最大生命代价加深。', effects: { atk: 24, lifesteal: 5, maxHp: -15 } },
        { id: 'dragoninsight', name: '烛照九幽', desc: '暴击威力再升，身法略有折损。', effects: { crit: 22, atk: 12, speed: -0.2 } }
    ],
    spiritcore: [
        { id: 'primalbastion', name: '太初玄垣', desc: '大幅增加生命与护盾。', effects: { maxHp: 90, hp: 50, shield: 70 } },
        { id: 'spiritdeluge', name: '灵海倾天', desc: '生命、攻击与护盾全面提升。', effects: { maxHp: 45, hp: 80, shield: 35, atk: 8 } }
    ],
    heavenbreak: [
        { id: 'skyreaver', name: '裂天魔锋', desc: '攻击与暴击再度暴涨，失去更多生命。', effects: { atk: 35, crit: 20, maxHp: -25, hp: -20 } },
        { id: 'bloodsovereign', name: '血契主宰', desc: '以生命换取攻击与吸血，速度惩罚加深。', effects: { atk: 26, lifesteal: 8, maxHp: -15, speed: -0.2 } }
    ],
    lifebind: [
        { id: 'crimsonvow', name: '赤海誓约', desc: '吸血和攻击达到极高水平，最大生命继续降低。', effects: { atk: 30, lifesteal: 10, maxHp: -20 } },
        { id: 'lastoffering', name: '燃命献祭', desc: '牺牲当前生命换取巨额攻击与暴击。', effects: { atk: 38, crit: 20, hp: -30, maxHp: -10 } }
    ]
};

const CURSE_EVOLUTIONS = {
    minor: [
        { id: 'soul_harvest', name: '噬魂续命', desc: '攻击、吸血提升并额外折寿；妖魔契约还会强化妖魔，击杀回复提高。',
            playerEffects: { atk: 5, lifesteal: 2 }, monsterEffects: { hpMul: 1.08, atkMul: 1.04 },
            curseCost: { maxHp: -8, hp: -6 }, curseGift: { curseSoulHarvest: 0.02 } },
        { id: 'blood_frenzy', name: '血煞狂契', desc: '攻击、暴击提升并牺牲生命与身法；妖魔契约还会强化妖魔攻速与血怒。',
            playerEffects: { atk: 7, crit: 5 }, monsterEffects: { atkMul: 1.08, spdMul: 1.04 },
            curseCost: { maxHp: -8, hp: -6, speed: -0.08 }, curseGift: { curseFrenzy: 0.08 } }
    ],
    major: [
        { id: 'soul_sovereign', name: '万魂归命', desc: '攻击、吸血大幅提升并额外折寿；妖魔契约还会强化妖魔，吸魂回复提高。',
            playerEffects: { atk: 10, lifesteal: 3 }, monsterEffects: { hpMul: 1.12, atkMul: 1.06 },
            curseCost: { maxHp: -14, hp: -10 }, curseGift: { curseSoulHarvest: 0.04 } },
        { id: 'bloodsovereign', name: '血狱主宰', desc: '攻击、暴击大幅提升并牺牲寿元；妖魔契约还会强化妖魔，血怒提高。',
            playerEffects: { atk: 12, crit: 8 }, monsterEffects: { atkMul: 1.12, spdMul: 1.06 },
            curseCost: { maxHp: -14, hp: -10, speed: -0.12 }, curseGift: { curseFrenzy: 0.12 } }
    ],
    calamity: [
        { id: 'laststand_evolved', name: '九死不灭', desc: '额外牺牲生命，濒死保命恢复提高至40%；妖魔契约还会强化妖魔。',
            playerEffects: { atk: 14, crit: 8 }, monsterEffects: { hpMul: 1.12, atkMul: 1.08 },
            curseCost: { maxHp: -18, hp: -12, atk: -2 }, curseGift: { curseLastStand: true, curseLastStandHp: 0.1 } },
        { id: 'calamity_reaper', name: '万劫噬命', desc: '攻击、吸血大幅提升并额外折寿；妖魔契约还会强化妖魔生命与攻击。',
            playerEffects: { atk: 18, lifesteal: 5 }, monsterEffects: { hpMul: 1.1, atkMul: 1.1 },
            curseCost: { maxHp: -22, hp: -15, speed: -0.12 }, curseGift: { curseSoulHarvest: 0.05 } }
    ]
};

const CURSE_DUPLICATE_BONUSES = {
    minor: { playerEffects: { atk: 4 }, monsterEffects: { hpMul: 1.06, atkMul: 1.03 }, curseCost: { maxHp: -4, hp: -3 } },
    major: { playerEffects: { atk: 6, lifesteal: 1 }, monsterEffects: { hpMul: 1.08, atkMul: 1.05 }, curseCost: { maxHp: -7, hp: -5 } },
    calamity: { playerEffects: { atk: 8, lifesteal: 2 }, monsterEffects: { hpMul: 1.1, atkMul: 1.08 }, curseCost: { maxHp: -10, hp: -8, speed: -0.05 } }
};

function getCardEvolutions(card) {
    if (card.type === 'cursed') return CURSE_EVOLUTIONS[card.curseTier] || [];
    return CARD_EVOLUTIONS[card.id] || [];
}

const CARD_DUPLICATE_BONUSES = {
    double_hit: { atk: 2 },
    pierce: { atk: 2, range: 4 },
    fire_sword: { elemDmg: 0.08, burnDmg: 0.03 },
    ice_sword: { freezeChance: 0.07, freezeDur: 0.12 },
    dash_strike: { dashCd: -0.35, dashRange: 8 },
    m_elite: { hpMul: 1.08, atkMul: 1.05 },
    m_explode: { hpMul: 1.05, atkMul: 1.08 },
    m_teleport: { hpMul: 1.05 },
    m_summon: { hpMul: 1.05 }
};

function cardArt(id) {
    const icon = CARD_ART[id];
    if (!icon) throw new Error('Missing card artwork for: ' + id);
    return '<div class="card-art-frame"><svg class="card-art" viewBox="0 0 64 64" aria-hidden="true">' +
        '<use href="assets/card-icons.svg#' + icon + '" xlink:href="assets/card-icons.svg#' + icon + '"></use>' +
        '</svg></div>';
}

const PLAYER_CARD_RARITIES = {
    atk_up: 'common', hp_up: 'common', spd_up: 'common', rng_up: 'common',
    crit_up: 'uncommon', ls_up: 'uncommon', pierce: 'uncommon', knockback: 'uncommon',
    stun_chance: 'uncommon', regen: 'uncommon',
    double_hit: 'rare', fire_sword: 'rare', ice_sword: 'rare', lightning: 'rare',
    dash_strike: 'rare', shield: 'rare', dodge: 'rare', counter: 'epic'
};
const MONSTER_CARD_RARITIES = {
    m_hp: 'common', m_regen: 'common', m_spd: 'uncommon', m_shield: 'uncommon',
    m_atk: 'rare', m_cnt: 'rare', m_thorns: 'rare', m_explode: 'rare',
    m_elite: 'epic', m_split: 'epic', m_teleport: 'epic', m_summon: 'epic'
};
PLAYER_CARDS.forEach(c => { c.rarity = PLAYER_CARD_RARITIES[c.id]; });
MONSTER_CARDS.forEach(c => { c.rarity = MONSTER_CARD_RARITIES[c.id]; });
CARDS.forEach(c => {
    if (c.type === 'cursed') c.rarity = 'common';
    else if (!c.rarity) c.rarity = c.type === 'mixed' ? 'rare' : 'common';
});
PLAYER_CARDS.push(
    { id: 'p_curse_minor', name: '血脉燃契', desc: '攻击+10、暴击+8%，最大生命-18；击杀回复生命上限的4%。', type: 'cursed', curseTier: 'minor', curseGift: { curseSoulHarvest: 0.04 }, rarity: 'common', effects: { atk: 10, crit: 8, maxHp: -18 } },
    { id: 'p_curse_major', name: '蚀寿剑印', desc: '攻击+20、吸血+4，最大生命-35、速度-0.25；击杀后攻击提升25%，持续3.5秒。', type: 'cursed', curseTier: 'major', curseGift: { curseFrenzy: 0.25 }, rarity: 'common', effects: { atk: 20, lifesteal: 4, maxHp: -35, speed: -0.25 } },
    { id: 'p_curse_calamity', name: '九幽血誓', desc: '攻击+34、暴击+20%、吸血+6，最大生命-60、当前生命-30；每层首次受到致命伤时，以30%生命劫后余生。', type: 'cursed', curseTier: 'calamity', curseGift: { curseLastStand: true }, rarity: 'common', effects: { atk: 34, crit: 20, lifesteal: 6, maxHp: -60, hp: -30 } }
);
MONSTER_CARDS.forEach(c => {
    if (c.type === 'cursed') c.rarity = 'common';
});
PLAYER_CARDS.forEach(c => {
    if (c.type === 'cursed') CARD_ART[c.id] = c.curseTier === 'calamity' ? 'skull' : c.curseTier === 'major' ? 'dagger' : 'fang';
});
const MONSTER_RUN_REWARDS = {
    m_hp: { desc: '妖魔生命+40%；你获得攻击+14、生命上限+30。', effects: { atk: 14, maxHp: 30 } },
    m_atk: { desc: '妖魔攻击+30%；你获得攻击+22、暴击+8%。', effects: { atk: 22, crit: 8 } },
    m_spd: { desc: '妖魔速度+40%；你获得速度+0.8、暴击+10%。', effects: { speed: 0.8, crit: 10 } },
    m_cnt: { desc: '普通波次妖魔+2；你获得攻击+12、生命上限+60。', effects: { atk: 12, maxHp: 60 } },
    m_elite: { desc: '每波必有精英妖魔；你获得攻击+28、生命上限+35。', effects: { atk: 28, maxHp: 35 } },
    m_shield: { desc: '妖魔获得50点护盾；你获得攻击+14、吸血+3。', effects: { atk: 14, lifesteal: 3 } },
    m_regen: { desc: '妖魔脱战后持续回复生命；你立即回复60生命、攻击+10。', effects: { hp: 60, atk: 10 } },
    m_thorns: { desc: '妖魔反弹20%伤害；你获得攻击+18、吸血+4。', effects: { atk: 18, lifesteal: 4 } },
    m_split: { desc: '妖魔死亡分裂；你获得攻击+30、生命上限+45。', effects: { atk: 30, maxHp: 45 } },
    m_explode: { desc: '妖魔死亡自爆；你获得攻击+26、暴击+12%。', effects: { atk: 26, crit: 12 } },
    m_teleport: { desc: '精英妖魔获得瞬移；你获得速度+1、闪避+8%。', effects: { speed: 1, dodge: 0.08 } },
    m_summon: { desc: '妖魔会召唤援军；你获得攻击+34、生命上限+40。', effects: { atk: 34, maxHp: 40 } },
    m_curse_minor: { desc: '风险：妖魔生命+12%、攻击+8%；代价：生命上限-18、当前生命-12。特殊机缘：击杀妖魔回复生命上限的4%。', effects: {} },
    m_curse_major: { desc: '风险：妖魔生命+25%、攻击+16%、数量+1；代价：生命上限-32、当前生命-24、速度-0.25。特殊机缘：击杀后攻击提升25%，持续3.5秒。', effects: {} },
    m_curse_calamity: { desc: '风险：妖魔生命+45%、攻击+28%、普通波次必有精英；代价：生命上限-55、当前生命-35、速度-0.45、攻击-5。特殊机缘：每层首次受到致命伤时，以30%生命劫后余生。', effects: {} }
};
const MONSTER_RUN_CARDS = MONSTER_CARDS.map(c => Object.assign({}, c, {
    type: c.type === 'cursed' ? 'cursed' : 'monster',
    emoji: '👿',
    desc: MONSTER_RUN_REWARDS[c.id].desc,
    effects: MONSTER_RUN_REWARDS[c.id].effects,
    monsterEffects: c.effects
}));

const STORY = [
    /* ============ 第一章：灵气觉醒 ============ */
    {
        id: 's0', tag: '📖 第一章 · 灵气觉醒', title: '山雨欲来',
        desc: '大衍历三百二十年，青云山下的小村庄。\n夜里，你总梦见同一片星空——星子一颗接一颗亮起。\n这天傍晚，天边泛起异样紫光，村中犬吠此起彼伏。\n沉寂三百年的灵气，正在复苏。',
        options: [
            { text: '出门查看紫光', next: 's1', effects: { cult: 10 }, toast: '你推门走向村口' },
            { text: '闭门静坐吐纳', next: 's1', effects: { maxHp: 5 }, toast: '你在屋中静坐吐纳' }
        ]
    },
    {
        id: 's1', tag: '🎭 奇遇', title: '老槐树下的老人',
        desc: '村口老槐树下坐着一个衣衫褴褛的老人。\n「小娃娃，紫光现世，灵气将复，你怕不怕？」\n他从怀里摸出一卷泛黄绢布——正是《吐纳诀》。\n老人又递来一枚古朴玉符：「持此符可入青云山秘境试炼。」',
        options: [
            { text: '恭敬接过，郑重拜谢', next: 's2', effects: { cult: 25, maxHp: 10 }, toast: '获得《吐纳诀》与秘境玉符' }
        ]
    },
    {
        id: 's2', tag: '🌟 转折', title: '灵根觉醒·秘境试炼',
        desc: '当夜，丹田一热，一缕灵气自行运转周天——灵根觉醒了！\n手中玉符灼灼发光，将你传送到青云山门后的秘境。\n长老的声音在虚空回荡：\n「斩尽十层妖兽者，方可入门。小心那些机缘——福祸相依。」',
        options: [
            { text: '⚔️ 拔剑进入秘境（WASD移动，J/空格攻击）', enterDungeon: true, effects: {}, toast: '🏰 秘境试炼开始！' }
        ]
    },
    {
        id: 's3', tag: '📖 第一章 · 完', title: '青云入门',
        desc: '你带着满身煞气与机缘走出秘境，长老眼中满是赞许。\n「十层俱过，心性可嘉。从今日起，你便是青云外门弟子。」\n山风拂过，钟声再响——\n你的修仙之路，正式开始了。\n\n—— 第一章「灵气觉醒」· 完 ——',
        options: [
            { text: '🏆 查看本章结算', next: 'c1_end', effects: {}, toast: '第一章通关！' }
        ]
    },
    {
        id: 'c1_end', tag: '🏆 结算', title: '第一章结算',
        desc: '境界提升，新功法初成。\n青云门内，诸峰林立，灵气浓郁。\n你的修仙之路才刚刚起步。',
        options: [
            { text: '📜 继续修行（进入第二章）', next: 's4', effects: { cult: 50 }, toast: '踏入第二章·筑基之路' }
        ]
    },

    /* ============ 第二章：筑基之路 ============ */
    {
        id: 's4', tag: '📖 第二章 · 筑基之路', title: '外门日常',
        desc: '成为外门弟子半月，你在灵田除草、练剑、吐纳。\n一日，执事长老传话：「外门大比将近，前三入内门，赐筑基丹。」\n你的修为尚浅，唯有冒险秘境深处，寻那传说中的「筑基灵液」。',
        options: [
            { text: '🏰 再闯秘境深层（解锁11-20层）', enterDungeon: true, effects: { cult: 30 }, toast: '踏入秘境深层' },
            { text: '📚 先研习《青云剑典》（获得穿透剑气）', next: 's5', effects: { cult: 20 }, toast: '习得穿透剑气' }
        ]
    },
    {
        id: 's5', tag: '⚔️ 切磋', title: '师兄挑战',
        desc: '练武场上，内门师兄拦路：「外门弟子也想要筑基丹？先接我三招！」\n他手中灵剑嗡鸣，杀意毕露。围观弟子窃窃私语。',
        options: [
            { text: '⚔️ 应战（获得连击术）', next: 's6', effects: { cult: 40 }, toast: '战胜师兄，习得连击术' },
            { text: '🤝 认输示弱（获得闪避身法）', next: 's6', effects: { maxHp: 15 }, toast: '保全实力，习得闪避身法' }
        ]
    },
    {
        id: 's6', tag: '🗺️ 探秘', title: '秘境异变',
        desc: '秘境深处突然涌出浓重魔气，原本的妖兽变得狂暴异常。\n长老传音：「秘境核心有魔族遗留的「吞灵阵」，需破阵方能取灵液。」\n你深入核心，遭遇魔化妖兽围攻。',
        options: [
            { text: '🏰 破阵取液（挑战深层Boss）', enterDungeon: true, effects: {}, toast: '挑战魔化核心' }
        ]
    },
    {
        id: 's7', tag: '💎 收获', title: '筑基灵液',
        desc: '魔化核心被斩，阵眼碎裂，一滴金色灵液飞入你丹田。\n体内灵力轰鸣，经脉拓宽，气海凝实——筑基成！\n长老现身：「筑基大成，赐你内门身份，传《青云护身诀》。」',
        options: [
            { text: '🏆 查看本章结算', next: 'c2_end', effects: { cult: 200, maxHp: 50, atk: 10 }, toast: '筑基成！进入第三章' }
        ]
    },
    {
        id: 'c2_end', tag: '🏆 结算', title: '第二章结算',
        desc: '筑基大成，正式成为内门弟子。\n获得《青云护身诀》（护盾机制解锁）。\n秘境深层已开放，更多机缘与危险并存。',
        options: [
            { text: '📜 继续精进（进入第三章）', next: 's8', effects: { cult: 100 }, toast: '踏入第三章·金丹问道' }
        ]
    },

    /* ============ 第三章：金丹问道 ============ */
    {
        id: 's8', tag: '📖 第三章 · 金丹问道', title: '内门风云',
        desc: '内门弟子三百，争锋相对。\n掌门宣布：「三年一度「问剑大会」开启，冠军赐「金丹碎片」，集齐九枚可结金丹。」\n你虽新晋内门，却因秘境之名声鹊起，成为众矢之的。',
        options: [
            { text: '⚔️ 报名问剑大会（PVP模式解锁）', next: 's9', effects: { cult: 50 }, toast: '报名问剑大会' },
            { text: '🏰 闭关秘境磨砺（解锁无尽模式）', enterDungeon: true, effects: { cult: 80 }, toast: '进入无尽秘境' }
        ]
    },
    {
        id: 's9', tag: '⚔️ 初战', title: '首轮对决',
        desc: '擂台之上，对手是内门排名前十的「寒冰剑」苏清雪。\n「师弟手下留情。」她微笑，手中冰剑已出鞘。\n寒气弥漫，剑未至，意先到。',
        options: [
            { text: '⚔️ 硬接（获得反伤刺甲）', next: 's10', effects: { cult: 60 }, toast: '硬抗冰剑，领悟反伤' },
            { text: '💨 以快打快（获得瞬影突刺）', next: 's10', effects: { cult: 60 }, toast: '闪现破冰，领悟瞬影' }
        ]
    },
    {
        id: 's10', tag: '🏆 问剑', title: '问道金丹',
        desc: '连胜数轮，你站在了决赛擂台。\n对手是内门第一「焚天剑」君莫邪，周身燃烧着金色火焰。\n「这一战，胜者问鼎金丹。」掌门朗声道。\n金乌烈火 vs 你的道——生死一线。',
        options: [
            { text: '🔥 决战（最终Boss战）', enterDungeon: true, effects: {}, toast: '决战君莫邪' }
        ]
    },
    {
        id: 's11', tag: '👑 加冕', title: '金丹成·问剑冠军',
        desc: '烈火熄灭，君莫邪剑尖停在你喉前一寸。\n「你赢了。」他收剑，目光复杂。\n掌门抛来九枚金丹碎片，汇聚成一颗圆满金丹，飞入你丹田。\n丹田金光爆发，神识拓展百里——金丹成！\n「问剑冠军，赐号「剑心」，传位核心弟子。」\n\n—— 第三章「金丹问道」· 完 ——\n（无尽秘境与问剑大会常驻开放，继续追求大道）',
        options: [
            { text: '🏆 查看最终结算', ending: true, effects: { cult: 500, maxHp: 100, atk: 30, crit: 15 }, toast: '金丹成！大道无尽' }
        ]
    }
];
const ACHIEVEMENTS = [
    { id: 'first_kill', emoji: '🗡️', name: '初次斩妖', desc: '击杀第一只妖兽', check: s => s.flags.kills >= 1 },
    { id: 'kill50', emoji: '⚔️', name: '斩妖五十', desc: '累计击杀50只妖兽', check: s => s.flags.kills >= 50 },
    { id: 'floor5', emoji: '🏰', name: '深入秘境', desc: '抵达秘境第5层', check: s => s.flags.maxFloor >= 5 },
    { id: 'dungeon_clear', emoji: '👑', name: '秘境之主', desc: '通关10层秘境', check: s => s.flags.clears >= 1 },
    { id: 'realm_qi9', emoji: '💨', name: '炼气大成', desc: '修为达到炼气九重', check: s => s.realm >= 8 },
    { id: 'realm_zhuji', emoji: '🏔️', name: '筑基有成', desc: '修为达到筑基期', check: s => s.realm >= 9 },
    { id: 'card_cursed3', emoji: '☠️', name: '逆天而行', desc: '累计选择3张诅咒卡', check: s => s.flags.cursedPicks >= 3 },
    { id: 'story_clear', emoji: '📖', name: '觉醒之章', desc: '通关第一章剧情', check: s => s.flags.storyClear >= 1 },
    { id: 'nodeath_clear', emoji: '🌟', name: '无瑕通关', desc: '不死亡通关一次秘境', check: s => s.flags.noDeathClear >= 1 }
];

window.STORIES = STORY;
window.PLAYER_CARDS = PLAYER_CARDS;
window.MONSTER_CARDS = MONSTER_CARDS;
window.MONSTER_RUN_CARDS = MONSTER_RUN_CARDS;
window.REALMS = REALMS;
window.ORIGINS = ORIGINS;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.FLOOR_NAMES = FLOOR_NAMES;
window.DUNGEON_FLOORS = DUNGEON_FLOORS;
window.ITEMS = ITEMS;
window.CARD_TYPE_LABELS = CARD_TYPE_LABELS;
window.MONSTERS = MONSTERS;
window.FLOOR_POOL = FLOOR_POOL;
window.CARD_RARITY = CARD_RARITY;
window.CARD_RARITY_LABELS = CARD_RARITY_LABELS;
window.CURSE_TIERS = CURSE_TIERS;
window.CARD_CURSE_TIER_LABELS = CARD_CURSE_TIER_LABELS;
window.getCardTierWeight = getCardTierWeight;
window.getCardDrawTierLabel = getCardDrawTierLabel;
window.drawCardsByTier = drawCardsByTier;
window.CARDS = CARDS;
window.CARD_ART = CARD_ART;
window.CARD_EVOLUTIONS = CARD_EVOLUTIONS;
window.CURSE_EVOLUTIONS = CURSE_EVOLUTIONS;
window.CURSE_DUPLICATE_BONUSES = CURSE_DUPLICATE_BONUSES;
window.getCardEvolutions = getCardEvolutions;
window.CARD_DUPLICATE_BONUSES = CARD_DUPLICATE_BONUSES;
window.cardArt = cardArt;
