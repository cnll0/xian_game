'use strict';

const G = {
    username: null,
    guest: false,
    created: false,
    origin: null,
    talent: null,
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
    achievements: [],
    inventory: {},
    spiritStones: 0,
    sect: { rank: 0, contribution: 0, lastSalary: '' }
};
// 模块化引擎通过 window.G 访问全局进度；旧引擎仍使用顶层 const G
window.G = G;

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
    },
    {
        id: 'orphan', emoji: '🍂', name: '孤苦孤儿', avatarSeed: 'guer',
        desc: '无依无靠，却比常人更懂得活下去。生命+5，速度+0.3，暴击+3。',
        bonus: { atk: 0, maxHp: 5, speed: 0.3, crit: 3 }
    },
    {
        id: 'scholar', emoji: '📜', name: '书香门第', avatarSeed: 'shuxiang',
        desc: '自幼读遍典籍，识文断字。初始修为+20，攻击范围+4。',
        bonus: { atk: 0, maxHp: 0, speed: 0, range: 4, cult: 20 }
    }
];

/**
 * 天赋由天机随机推演，不可自选。
 * bonus 里除基础属性外，cultGain / damageReduce / luck / healBonus /
 * shopDiscount / notoriety / stones 会在运行时真正生效。
 */
const TALENTS = [
    {
        id: 'swordbone', emoji: '🗡️', name: '剑骨天成', rarity: 'rare', weight: 14,
        desc: '剑道悟性极高。攻击+2，暴击+8%。',
        bonus: { atk: 2, crit: 8 }, storyTag: '剑骨'
    },
    {
        id: 'spiritroot', emoji: '🌿', name: '先天灵根', rarity: 'epic', weight: 5,
        desc: '经脉天生通透。修为获取+20%，初始修为+30。',
        bonus: { cultGain: 0.2, cult: 30 }, storyTag: '灵根'
    },
    {
        id: 'ironbody', emoji: '🛡️', name: '铜皮铁骨', rarity: 'common', weight: 26,
        desc: '筋骨如铁。生命上限+25，受到伤害-5%。',
        bonus: { maxHp: 25, damageReduce: 0.05 }, storyTag: '铁骨'
    },
    {
        id: 'windstep', emoji: '💨', name: '踏风之资', rarity: 'uncommon', weight: 20,
        desc: '身轻如燕。移动速度+0.7。',
        bonus: { speed: 0.7 }, storyTag: '风步'
    },
    {
        id: 'lucky', emoji: '🍀', name: '福缘深厚', rarity: 'uncommon', weight: 18,
        desc: '机缘偏爱。灵石收益+30%，稀有掉落概率提高。',
        bonus: { luck: 0.3 }, storyTag: '福缘'
    },
    {
        id: 'alchemy', emoji: '⚗️', name: '药骨天成', rarity: 'uncommon', weight: 16,
        desc: '丹药入口即化。丹药回复+30%，开局多一枚回春丹。',
        bonus: { healBonus: 0.3 }, startItem: 'pill_hp', storyTag: '药骨'
    },
    {
        id: 'demonbone', emoji: '🩸', name: '煞骨', rarity: 'rare', weight: 10,
        desc: '天生煞气缠身。攻击+5、吸血+2，但正道修士初始好感-10。',
        bonus: { atk: 5, lifesteal: 2, notoriety: 10 }, storyTag: '煞骨'
    },
    {
        id: 'mercantile', emoji: '💰', name: '商才', rarity: 'common', weight: 22,
        desc: '天生的生意人。开局灵石+40，商店买入九折。',
        bonus: { stones: 40, shopDiscount: 0.1 }, storyTag: '商才'
    },
    {
        id: 'mortal', emoji: '🪨', name: '凡骨', rarity: 'common', weight: 0,
        desc: '旧存档补全的凡骨之资，无额外天赋。',
        bonus: {}, storyTag: '凡骨'
    }
];

const TALENT_RARITY_WEIGHTS = { common: 1, uncommon: 1.35, rare: 0.8, epic: 0.35 };

function originAvatar(o) {
    return 'https://api.dicebear.com/9.x/adventurer/svg?seed=' + encodeURIComponent(o.avatarSeed) + '&backgroundColor=f7efe2';
}

/**
 * 随机命格：出身均匀抽取，天赋按 rarity/weight 加权。
 * 返回 { origin, talent }，供进入游戏与测试共用。
 */
function rollFate(random = Math.random) {
    const origins = window.ORIGINS || ORIGINS;
    const talents = (window.TALENTS || TALENTS).filter(item => item.id !== 'mortal');
    const origin = origins[Math.floor(random() * origins.length)] || origins[0];
    const weighted = [];
    for (const talent of talents) {
        const weight = Math.max(0.01, (talent.weight || 10) * (TALENT_RARITY_WEIGHTS[talent.rarity] || 1));
        const slots = Math.max(1, Math.round(weight));
        for (let i = 0; i < slots; i++) weighted.push(talent);
    }
    const talent = weighted[Math.floor(random() * weighted.length)] || talents[0];
    return { origin, talent };
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
    wolf: { id: 'wolf', name: '灰风狼', img: 'wolf', hp: 30, atk: 8, speed: 2.1, r: 16, draw: 48, cult: 6, vision: 180 },
    bat: { id: 'bat', name: '血翼蝠', img: 'bat', hp: 18, atk: 6, speed: 3.0, r: 12, draw: 36, cult: 5, vision: 200 },
    spider: { id: 'spider', name: '毒玉蛛', img: 'spider', hp: 45, atk: 11, speed: 1.6, r: 18, draw: 52, cult: 9, ranged: true, keepDistance: true, shootRange: 210, shootCd: 3.2, projectileColor: '#a8dc75', poison: 2.2, vision: 220 },
    skeleton: { id: 'skeleton', name: '骷髅弓手', img: 'skeleton', hp: 35, atk: 10, speed: 1.2, r: 16, draw: 48, cult: 10, ranged: true, shootRange: 260, shootCd: 2.2, vision: 240 },
    brute: { id: 'brute', name: '赤甲魈', img: 'brute', hp: 85, atk: 15, speed: 1.15, r: 22, draw: 60, cult: 14, vision: 160 },
    charger: { id: 'charger', name: '裂岩犀', img: 'brute', hp: 92, atk: 17, speed: 1.05, r: 23, draw: 64, cult: 18, charge: true, tint: '#e88a50', vision: 150 },
    shaman: { id: 'shaman', name: '枯木巫祝', img: 'skeleton', hp: 58, atk: 8, speed: 0.85, r: 17, draw: 52, cult: 18, ranged: true, shootRange: 0, shootCd: 4.2, healer: true, tint: '#77d68a', vision: 200 },
    wraith: { id: 'wraith', name: '幽冥游魂', img: 'bat', hp: 48, atk: 13, speed: 1.75, r: 15, draw: 48, cult: 17, blink: true, tint: '#b694ed', vision: 180 },
    slime: { id: 'slime', name: '吞灵软泥', img: 'spider', hp: 72, atk: 10, speed: 0.9, r: 21, draw: 58, cult: 16, splitOnDeath: true, tint: '#66d8c0', vision: 140 },
    slimelet: { id: 'slimelet', name: '软泥幼体', img: 'bat', hp: 18, atk: 5, speed: 2.5, r: 10, draw: 30, cult: 2, tint: '#9be8bd', vision: 120 },
    frostwitch: { id: 'frostwitch', name: '寒魄妖姬', img: 'skeleton', hp: 62, atk: 12, speed: 1.0, r: 17, draw: 54, cult: 20, ranged: true, keepDistance: true, shootRange: 280, shootCd: 2.8, projectileColor: '#8cecff', slow: 1.4, tint: '#8cecff', vision: 230 },
    elite: { id: 'elite', name: '魔将·血煞', img: 'elite', hp: 220, atk: 22, speed: 1.7, r: 26, draw: 72, cult: 45, elite: true, vision: 250 },
    boss: { id: 'boss', name: '赤鳞蟒', img: 'boss', hp: 650, atk: 20, speed: 1.35, r: 42, draw: 120, cult: 120, boss: true, vision: 300 },
    qingyunBoss: { id: 'qingyunBoss', name: '赤鳞蟒', img: 'boss', hp: 310, atk: 12, speed: 1.05, r: 38, draw: 108, cult: 60, boss: true, vision: 280 },
    emberBoss: { id: 'emberBoss', name: '熔岩地龙', img: 'boss', hp: 720, atk: 18, speed: 1.15, r: 40, draw: 116, cult: 100, boss: true, tint: '#ed8549', vision: 300 },
    frostBoss: { id: 'frostBoss', name: '寒潭蛟王', img: 'boss', hp: 1050, atk: 24, speed: 1.25, r: 42, draw: 120, cult: 150, boss: true, tint: '#81dcf3', vision: 320 },
    netherBoss: { id: 'netherBoss', name: '幽墟镇墓兽', img: 'boss', hp: 1450, atk: 29, speed: 1.4, r: 44, draw: 126, cult: 210, boss: true, tint: '#b388e8', vision: 350 },

    /* ===== 人形敌手：秘境里不再只有妖兽，也有拦路的散修、山匪与魔道 ===== */
    bandit: { id: 'bandit', name: '拦路山匪', img: 'npcSprites', art: 'bandit', human: true, faction: '山匪', hp: 52, atk: 9, speed: 2.4, r: 16, draw: 64, cult: 14, vision: 210, tint: '#c79a65' },
    cultist: { id: 'cultist', name: '魔道散修', img: 'npcSprites', art: 'cultist', human: true, faction: '魔道', hp: 64, atk: 12, speed: 2.6, r: 16, draw: 66, cult: 20, vision: 240, tint: '#c96a72' },
    ronin: { id: 'ronin', name: '浪人剑客', img: 'npcSprites', art: 'ronin', human: true, faction: '散修', hp: 78, atk: 14, speed: 2.9, r: 17, draw: 68, cult: 24, vision: 260, tint: '#9fb2c9' },
    fire_cultist: { id: 'fire_cultist', name: '赤炎邪修', img: 'npcSprites', art: 'cultist', human: true, faction: '魔道', hp: 70, atk: 14, speed: 2.5, r: 16, draw: 66, cult: 24, vision: 250, tint: '#e88a50' },
    demon_spy: { id: 'demon_spy', name: '魔道探子', img: 'npcSprites', art: 'assassin', human: true, faction: '魔道', hp: 72, atk: 15, speed: 3.1, r: 16, draw: 64, cult: 28, vision: 280, tint: '#b46a8a' },
    shadow_assassin: { id: 'shadow_assassin', name: '影杀', img: 'npcSprites', art: 'assassin', human: true, faction: '幽冥宗', hp: 82, atk: 17, speed: 3.4, r: 15, draw: 62, cult: 32, vision: 300, blink: true, tint: '#8f6fd0' },
    ice_sword: { id: 'ice_sword', name: '寒潭剑仆', img: 'npcSprites', art: 'guqinghan', human: true, faction: '守境一脉', hp: 86, atk: 16, speed: 2.8, r: 16, draw: 66, cult: 30, vision: 270, tint: '#8ecfe6' },
    frost_guardian: { id: 'frost_guardian', name: '守境人', img: 'npcSprites', art: 'hanxing', human: true, faction: '守境一脉', hp: 100, atk: 15, speed: 2.3, r: 18, draw: 70, cult: 34, vision: 260, tint: '#9fe7f2' },
    sword_master: { id: 'sword_master', name: '剑术教习', img: 'npcSprites', art: 'zhaotieyi', human: true, faction: '青云门', hp: 96, atk: 17, speed: 2.7, r: 17, draw: 68, cult: 30, vision: 280, tint: '#d6c08a' },
    guardian: { id: 'guardian', name: '青云护院', img: 'npcSprites', art: 'ashi', human: true, faction: '青云门', hp: 110, atk: 13, speed: 2.1, r: 18, draw: 70, cult: 24, vision: 240, tint: '#a8b6c4' },
    soul_reaper: { id: 'soul_reaper', name: '引魂人', img: 'npcSprites', art: 'jichang', human: true, faction: '幽冥宗', hp: 104, atk: 19, speed: 2.6, r: 17, draw: 68, cult: 40, vision: 290, tint: '#b99de6' }
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
const DUNGEONS = [
    {
        id: 'qingyun', name: '青云外围', subtitle: '炼气境试炼', realmMin: 0, floorCount: 10,
        hpScale: 0.52, atkScale: 0.58, color: '#6f9a63', entry: { x: 900, y: 1390 },
        gimmick: '林间试炼：地形平缓，适合熟悉战斗节奏。',
        floorThemes: ['forest', 'ruins', 'bamboo', 'ruins', 'bones', 'bamboo', 'temple', 'forest', 'ruins', 'altar'],
        trapSequence: ['roots', 'blade', 'sinkhole', 'bone', 'crystal', 'miasma', 'fire', 'rune', 'ice', 'altar'],
        ambient: 'leaves',
        arenaStyle: 'ring',
        bossElement: '#7df9ff',
        colorTint: 'rgba(70, 115, 78, 0.10)',
        mods: { playerSpeed: 1, monsterSpeed: 1, damageTaken: 1, regen: 0.0015, visibility: 1 },
        floorPool: [
            ['wolf', 'bat'], ['wolf', 'bat'], ['wolf', 'spider', 'bandit'], ['bat', 'spider', 'cultist'],
            ['wolf', 'spider', 'slimelet'], ['bat', 'spider', 'slimelet', 'bandit'],
            ['wolf', 'bat', 'spider', 'ronin'], ['spider', 'slimelet'], ['wolf', 'bat', 'spider', 'cultist'], ['qingyunBoss']
        ],
        techniques: ['qingyun_sword', 'breath_cycle', 'wind_step'], position: { x: 900, y: 1390 }
    },
    {
        id: 'ember', name: '赤炎洞窟', subtitle: '炼气五重开放', realmMin: 4, floorCount: 5,
        hpScale: 0.9, atkScale: 0.9, color: '#ce7045', entry: { x: 2730, y: 1210 },
        gimmick: '地火灼烧：火穴与熔岩陷坑更密集，移动速度略快，受到的伤害提高。',
        floorThemes: ['lava', 'mine', 'lava', 'temple', 'lava'],
        trapSequence: ['fire', 'crystal', 'blade', 'fire', 'altar'],
        ambient: 'embers',
        arenaStyle: 'cavern',
        bossElement: '#ff743e',
        colorTint: 'rgba(170, 70, 30, 0.20)',
        mods: { playerSpeed: 1.06, monsterSpeed: 1.02, damageTaken: 1.12, regen: 0, visibility: 1 },
        floorPool: [['wolf', 'bat', 'bandit'], ['spider', 'brute', 'fire_cultist'], ['charger', 'brute', 'demon_spy'], ['elite', 'charger', 'fire_cultist'], ['emberBoss']],
        techniques: ['ember_blade', 'stone_skin'], position: { x: 2730, y: 1210 }
    },
    {
        id: 'frost', name: '寒潭秘境', subtitle: '筑基境开放', realmMin: 9, floorCount: 5,
        hpScale: 1.12, atkScale: 1.08, color: '#72bdcf', entry: { x: 3020, y: 930 },
        gimmick: '寒潭滑裂：冰面会拖慢并让角色滑行，冰刺与寒晶陷阱更常见。',
        floorThemes: ['ice', 'ice', 'temple', 'ice', 'altar'],
        trapSequence: ['ice', 'sinkhole', 'crystal', 'ice', 'altar'],
        ambient: 'snow',
        arenaStyle: 'cross',
        bossElement: '#8cecff',
        colorTint: 'rgba(75, 150, 190, 0.18)',
        mods: { playerSpeed: 0.94, monsterSpeed: 0.96, damageTaken: 1, regen: 0, visibility: 1, slip: 0.32 },
        floorPool: [['bat', 'spider'], ['wraith', 'skeleton', 'ice_sword'], ['frostwitch', 'wraith', 'ice_sword'], ['shaman', 'frostwitch', 'frost_guardian'], ['frostBoss']],
        techniques: ['frost_breath', 'flowing_sword'], position: { x: 3020, y: 930 }
    },
    {
        id: 'nether', name: '幽冥古墟', subtitle: '金丹境开放', realmMin: 12, floorCount: 5,
        hpScale: 1.45, atkScale: 1.38, color: '#a07bd0', entry: { x: 3260, y: 470 },
        gimmick: '幽冥侵蚀：视野受限，瘴气与镇魂阵更密集，妖魔移动更快。',
        floorThemes: ['bones', 'ruins', 'temple', 'altar', 'bones'],
        trapSequence: ['miasma', 'rune', 'bone', 'miasma', 'altar'],
        ambient: 'wisps',
        arenaStyle: 'corridor',
        bossElement: '#b388e8',
        colorTint: 'rgba(95, 65, 130, 0.28)',
        mods: { playerSpeed: 1, monsterSpeed: 1.07, damageTaken: 1.05, regen: 0, visibility: 0.72 },
        floorPool: [['wraith', 'spider', 'shadow_assassin'], ['shaman', 'slime', 'shadow_assassin'], ['elite', 'frostwitch', 'soul_reaper'], ['elite', 'charger', 'soul_reaper'], ['netherBoss']],
        techniques: ['soul_guard', 'void_step'], position: { x: 3260, y: 470 }
    }
];

const TECHNIQUES = [
    { id: 'qingyun_sword', name: '青云剑诀', school: '剑修', dungeon: 'qingyun', desc: '将基础剑意融入招式，永久攻击+3。', effects: { atk: 3 } },
    { id: 'breath_cycle', name: '小周天吐纳', school: '心法', dungeon: 'qingyun', desc: '灵气周天运转，永久最大生命+20。', effects: { maxHp: 20 } },
    { id: 'wind_step', name: '踏风步', school: '身法', dungeon: 'qingyun', desc: '身轻如燕，永久移动速度+0.25。', effects: { speed: 0.25 } },
    { id: 'ember_blade', name: '赤炎刀意', school: '火系', dungeon: 'ember', desc: '刀锋淬入地火，永久攻击+7、暴击+2%。', effects: { atk: 7, crit: 2 } },
    { id: 'stone_skin', name: '磐石护体', school: '护体', dungeon: 'ember', desc: '以灵力淬炼筋骨，永久最大生命+45。', effects: { maxHp: 45 } },
    { id: 'frost_breath', name: '寒潭冰息', school: '冰系', dungeon: 'frost', desc: '寒气凝于剑气，永久攻击+10、暴击+4%。', effects: { atk: 10, crit: 4 } },
    { id: 'flowing_sword', name: '流水剑经', school: '剑修', dungeon: 'frost', desc: '剑势连绵不绝，永久攻击范围+12、速度+0.2。', effects: { range: 12, speed: 0.2 } },
    { id: 'soul_guard', name: '镇魂诀', school: '神魂', dungeon: 'nether', desc: '神识稳固如山，永久最大生命+70、暴击+5%。', effects: { maxHp: 70, crit: 5 } },
    { id: 'void_step', name: '幽冥遁法', school: '身法', dungeon: 'nether', desc: '借幽冥之气穿行，永久攻击+14、速度+0.35。', effects: { atk: 14, speed: 0.35 } }
];

const NPCS = [
    { id: 'ningxiao', name: '宁小雨', title: '迷路的外门弟子', portrait: 'ningxiao', x: 470, y: 1730, faction: '青云门', attitude: 'friendly', color: '#72b89d', zone: 'overworld',
        greeting: '呼……终于见到同门了。我在采药时走散，附近好像有妖兽。',
        choices: [
            { text: '送她一枚回春丹', reply: '多谢道友！这本吐纳心得送你，愿能助你修行。', favor: 18, technique: 'breath_cycle', reward: { maxHp: 8 } },
            { text: '问问附近的路', reply: '沿溪水向北有处古洞，最近常有赤光从里面冒出来。', favor: 5 },
            { text: '告辞，继续赶路', reply: '路上小心，别一个人深入秘境。', favor: 0 }
        ],
        // 关系系统扩展
        relation: { base: 20, thresholds: { ally: 40, friendly: 15, neutral: -10, hostile: -25 } },
        dungeonBehavior: { qingyun: { allyBuff: { heal: 0.3 }, hostile: { becomeEnemy: true, monsterId: 'cultist' } } },
        combatStats: { hp: 120, atk: 18, speed: 3.0, skills: ['heal', 'buff'] }
    },
    { id: 'linyue', name: '林越', title: '游历散修', portrait: 'linyue', x: 160, y: 1910, faction: '散修', attitude: 'neutral', color: '#859fbd', zone: 'overworld',
        greeting: '在下林越，四方游历的散修。修行路上，多一个朋友总好过多一个仇家。',
        choices: [
            { text: '看看你的行囊货物', reply: '都是些走南闯北攒下的东西，挑挑看。', favor: 3, shop: 'linyue' },
            { text: '以灵石换取剑诀心得（攻击+2）', reply: '这招青云剑式是我观碑所得，就当结个善缘。', favor: 12, reward: { atk: 2 } },
            { text: '谈谈各处秘境', reply: '赤炎洞克制寒性功法，寒潭深处则常有幽魂出没。', favor: 4 },
            { text: '质疑他的话', reply: '道不同，不必强求。', favor: -12 }
        ],
        relation: { base: 0, thresholds: { ally: 35, friendly: 10, neutral: -15, hostile: -30 } },
        dungeonBehavior: { qingyun: { allyBuff: { atk: 5 }, hostile: { becomeEnemy: true, monsterId: 'ronin' } }, ember: { allyBuff: { cult: 30 }, hostile: { becomeEnemy: true, monsterId: 'fire_cultist' } } },
        combatStats: { hp: 150, atk: 22, speed: 3.5, skills: ['dash', 'counter'] }
    },
    { id: 'shenli', name: '沈砺', title: '青云门执事', portrait: 'shenli', x: 1010, y: 1280, faction: '青云门', attitude: 'neutral', color: '#c0a064', zone: 'overworld',
        greeting: '外门执事沈砺。秘境按境界分了几处，莫要为了机缘越阶送命。',
        choices: [
            { text: '前往宗门大殿', reply: '随我来。外门弟子该知道门中规矩。', favor: 5, sect: true },
            { text: '看看执事堂的货物', reply: '丹药、护身符，都是行走秘境的硬通货。', favor: 4, shop: 'sect' },
            { text: '请教试炼规矩', reply: '青云外围适合炼气弟子。赤炎洞、寒潭与古墟，须有相应修为再入。', favor: 8 },
            { text: '请求指点剑法（攻击+3）', reply: '看好了，出剑不可只凭蛮力。', favor: 15, reward: { atk: 3 } },
            { text: '抱怨门规繁琐', reply: '不守规矩，便不必再叫我执事。', favor: -20 }
        ],
        relation: { base: 5, thresholds: { ally: 50, friendly: 20, neutral: 0, hostile: -20 } },
        dungeonBehavior: { qingyun: { allyBuff: { shield: 0.25 }, hostile: { becomeEnemy: true, monsterId: 'guardian' } } },
        combatStats: { hp: 200, atk: 25, speed: 2.5, skills: ['shield', 'parry'] }
    },
    { id: 'guqinghan', name: '顾清寒', title: '内门剑修', portrait: 'guqinghan', x: 1730, y: 790, faction: '青云门', attitude: 'friendly', color: '#84c7dc', zone: 'overworld',
        greeting: '你就是最近那位新入门的弟子？剑意不错，不过还缺些沉淀。',
        choices: [
            { text: '请她指点身法（速度+0.15）', reply: '脚下别急着追风，先学会听风。', favor: 16, reward: { speed: 0.15 } },
            { text: '谈谈问剑大会', reply: '胜负之外，更重要的是看清自己的剑。', favor: 7 },
            { text: '向她发起挑衅', reply: '若你真想较量，擂台上见。', favor: -24 }
        ],
        relation: { base: 25, thresholds: { ally: 45, friendly: 15, neutral: -5, hostile: -20 } },
        dungeonBehavior: { qingyun: { allyBuff: { speed: 0.3 }, hostile: { becomeEnemy: true, monsterId: 'sword_master' } }, frost: { allyBuff: { crit: 5 }, hostile: { becomeEnemy: true, monsterId: 'ice_sword' } } },
        combatStats: { hp: 180, atk: 30, speed: 4.0, skills: ['ice_blade', 'dash'] }
    },
    { id: 'mochen', name: '墨痕', title: '魔道探子', portrait: 'mochen', x: 2360, y: 770, faction: '不明', attitude: 'hostile', color: '#bd6a72', zone: 'ember',
        greeting: '青云门的人？呵，这处秘境可不是你们的后院。',
        choices: [
            { text: '拔剑逼问来意', reply: '今日先放你一马。下次碰面，可就没这么客气了。', favor: -30 },
            { text: '提出暂时合作', reply: '合作？各取所需罢了。别挡我的路。', favor: 10 },
            { text: '保持距离', reply: '算你识相。', favor: 0 }
        ],
        relation: { base: -20, thresholds: { ally: 20, friendly: 0, neutral: -15, hostile: -35 } },
        dungeonBehavior: { ember: { allyBuff: { bloodPrice: { hp: 0.1, atk: 15 } }, hostile: { becomeEnemy: true, monsterId: 'demon_spy' } }, nether: { allyBuff: { speed: 0.5 }, hostile: { becomeEnemy: true, monsterId: 'shadow_assassin' } } },
        combatStats: { hp: 160, atk: 28, speed: 3.8, skills: ['blink', 'poison'] }
    },
    { id: 'jichang', name: '姬无常', title: '幽冥古墟访客', portrait: 'jichang', x: 3170, y: 580, faction: '幽冥宗', attitude: 'hostile', color: '#a88bd0', zone: 'nether',
        greeting: '生人也敢入古墟？这里埋着的，可不止是尸骨。',
        choices: [
            { text: '询问镇魂诀的来历', reply: '你倒识货。若能从古墟活着出来，再谈传承。', favor: 8 },
            { text: '强行索要传承', reply: '狂妄之徒，休想染指幽冥遗物。', favor: -35 },
            { text: '礼貌行礼后离开', reply: '至少你还懂些礼数。', favor: 4 }
        ],
        relation: { base: -15, thresholds: { ally: 25, friendly: 5, neutral: -10, hostile: -30 } },
        dungeonBehavior: { nether: { allyBuff: { riskCult: 50 }, hostile: { becomeEnemy: true, monsterId: 'soul_reaper' } } },
        combatStats: { hp: 220, atk: 26, speed: 3.2, skills: ['soul_drain', 'summon'] }
    },
    { id: 'hanxing', name: '秦寒星', title: '寒潭守境人', portrait: 'hanxing', x: 3010, y: 1030, faction: '守境一脉', color: '#78b9d0', zone: 'frost',
        greeting: '潭底寒气会封住经脉。若无冰系根基，切莫贪图深处的灵物。',
        choices: [
            { text: '请教寒潭行走之法（暴击+1%）', reply: '记住，寒意最盛时反而是灵力最稳的时候。', favor: 12, reward: { crit: 1 } },
            { text: '询问古墟传闻', reply: '幽冥宗的人在北面的废墟出没，最好不要招惹。', favor: 5 },
            { text: '表示不信', reply: '等你在潭中冻僵，自然会信。', favor: -10 }
        ],
        relation: { base: 10, thresholds: { ally: 40, friendly: 15, neutral: -5, hostile: -25 } },
        dungeonBehavior: { frost: { allyBuff: { shield: 0.3, heal: 0.2 }, hostile: { becomeEnemy: true, monsterId: 'frost_guardian' } } },
        combatStats: { hp: 250, atk: 24, speed: 2.8, skills: ['ice_wall', 'frost_nova'] }
    },
    { id: 'suwan', name: '苏晚', title: '丹房执事', portrait: 'suwan', x: 1120, y: 1110, faction: '青云门', attitude: 'friendly', color: '#84c7dc', zone: 'overworld',
        greeting: '丹房苏晚。秘境里带回来的灵草、火晶，都可以拿到执事堂换灵石。',
        choices: [
            { text: '看看丹房寄卖的丹药', reply: '都是新炼的，别省着用。', favor: 6, shop: 'sect' },
            { text: '请教炼丹之道', reply: '火候到了，药性自然相合。急着成丹，只会炸炉。', favor: 8 },
            { text: '帮忙整理药架', reply: '多谢。下次给你留一枚大还丹。', favor: 12, reward: { maxHp: 6 } }
        ],
        relation: { base: 20, thresholds: { ally: 40, friendly: 15, neutral: -5, hostile: -25 } },
        combatStats: { hp: 120, atk: 14, speed: 3.0, skills: ['heal'] }
    },
    { id: 'zhaotieyi', name: '赵铁衣', title: '演武师兄', portrait: 'zhaotieyi', x: 1320, y: 1210, faction: '青云门', attitude: 'neutral', color: '#c9a467', zone: 'overworld',
        greeting: '演武场赵铁衣。想在内门站稳脚跟，先把剑握稳。',
        choices: [
            { text: '请师兄喂招（攻击+2）', reply: '再来。剑不是挥给别人看的。', favor: 10, reward: { atk: 2 } },
            { text: '打听问剑大会', reply: '今年的签排得蹊跷。你若真上场，多留个心眼。', favor: 5 },
            { text: '与他切磋身法（速度+0.1）', reply: '脚下生根，才谈得上快。', favor: 12, reward: { speed: 0.1 } }
        ],
        relation: { base: 5, thresholds: { ally: 35, friendly: 12, neutral: -10, hostile: -30 } },
        combatStats: { hp: 180, atk: 24, speed: 3.4, skills: ['dash', 'parry'] }
    },
    { id: 'ashi', name: '阿石', title: '山门守弟子', portrait: 'ashi', x: 1060, y: 1250, faction: '青云门', attitude: 'friendly', color: '#c0a064', zone: 'overworld',
        greeting: '山门重地，莫要乱闯。要办事就去执事堂找沈执事。',
        choices: [
            { text: '请他带路去宗门大殿', reply: '沿着石阶上去，执事堂就在主峰。', favor: 4, sect: true },
            { text: '问问门中近况', reply: '最近秘境不太平，夜里总能听见山腹里有动静。', favor: 3 },
            { text: '塞给他几块灵石', reply: '这……我就当没看见。', favor: 8 }
        ],
        relation: { base: 15, thresholds: { ally: 30, friendly: 10, neutral: -10, hostile: -25 } },
        combatStats: { hp: 140, atk: 16, speed: 2.8, skills: ['shield'] }
    }
];

const DUNGEON_NPC_EVENTS = {
    qingyun: [
        { floor: 2, npcId: 'ningxiao', title: '药篓边的相逢', line: '一名外门弟子正蹲在石缝边整理药草。她听见妖兽声，攥紧了药篓。', choices: [
            { text: '分一份灵药疗伤', reply: '她把药粉敷在你的伤口上，草木清香压下了痛意。', effect: { type: 'heal', amount: 0.22 } },
            { text: '交换一页吐纳心得', reply: '她将手抄的吐纳口诀塞给你，灵气顿时运转得更顺畅。', effect: { type: 'attack', amount: 4 } }
        ] },
        { floor: 5, npcId: 'linyue', title: '石壁下的散修', line: '林越靠着刻满旧剑痕的石壁，正用树枝比划某种剑路。', choices: [
            { text: '请他指点剑路', reply: '林越点出你招式中的破绽，你对出剑时机有了新的领悟。', effect: { type: 'attack', amount: 6 } },
            { text: '交换灵石与情报', reply: '他讲了几处安全落脚点，顺手分给你一袋灵石。', effect: { type: 'cult', amount: 42 } }
        ] },
        { floor: 8, npcId: 'guqinghan', title: '寒剑留痕', line: '顾清寒守在一道裂开的石门前，剑锋凝着薄霜。她示意你先听洞中的动静。', choices: [
            { text: '随她静听灵脉', reply: '你借灵脉回响调匀气息，护体灵光凝实了几分。', effect: { type: 'shield', amount: 0.2 } },
            { text: '请她陪练一招', reply: '数招交错后，你抓住了她留下的一线破绽。', effect: { type: 'attack', amount: 9 } }
        ] }
    ],
    ember: [
        { floor: 2, npcId: 'linyue', title: '熔岩边的行脚商', line: '林越把湿透的披风搭在石柱上，正等岩浆冷却后捡取火晶。', choices: [
            { text: '用清水换取回春散', reply: '他递来一包清凉药散，灼痛的伤口终于缓和。', effect: { type: 'heal', amount: 0.2 } },
            { text: '买下火晶碎片', reply: '火晶在掌心炸开一缕热流，你把这股力量引入剑招。', effect: { type: 'attack', amount: 7 } }
        ] },
        { floor: 4, npcId: 'mochen', title: '阵眼前的魔道探子', line: '墨痕被困在崩裂的火阵里。他盯着你，提出各取所需的交易。', choices: [
            { text: '接受火符，承受灼伤', reply: '火符化入剑锋，灼伤也逼得你将气血压榨到极限。', effect: { type: 'bloodPrice', hp: 0.12, attack: 12 } },
            { text: '拆阵救人，索取报酬', reply: '阵法散去，墨痕丢下一枚灵石，转身消失在烟尘中。', effect: { type: 'cult', amount: 75 } }
        ] }
    ],
    frost: [
        { floor: 2, npcId: 'guqinghan', title: '冰桥上的同门', line: '顾清寒在冰桥另一侧清理裂冰。她提醒你，脚下的寒雾会吞掉灵力。', choices: [
            { text: '请她稳住冰桥', reply: '剑气钉住冰层，你趁机积起一层寒光护盾。', effect: { type: 'shield', amount: 0.22 } },
            { text: '借寒雾淬炼剑锋', reply: '寒气刺骨，却也让剑意变得更加锐利。', effect: { type: 'attack', amount: 8 } }
        ] },
        { floor: 4, npcId: 'hanxing', title: '寒潭守境人的灯火', line: '秦寒星守着一盏快要熄灭的冰灯，灯下躺着几株尚未冻坏的灵草。', choices: [
            { text: '以灵力护住冰灯', reply: '灯火回暖，守境人将灵草捣碎敷在你身上。', effect: { type: 'heal', amount: 0.25 } },
            { text: '借冰灯参悟寒息', reply: '冰灯映出经脉中的灵气流向，你的护体灵力更稳了。', effect: { type: 'shield', amount: 0.3 } }
        ] }
    ],
    nether: [
        { floor: 2, npcId: 'mochen', title: '残碑下的黑市', line: '墨痕在残碑后摆了几枚来路不明的符箓，周围的影子却比烛火慢了一拍。', choices: [
            { text: '买一枚影遁符', reply: '符箓燃尽，你从阴影里借来一丝迅捷身法。', effect: { type: 'speed', amount: 0.45 } },
            { text: '以灵力换取邪门秘闻', reply: '秘闻令你修为有所增长，但也惊动了古墟深处的东西。', effect: { type: 'riskCult', amount: 95 } }
        ] },
        { floor: 4, npcId: 'jichang', title: '古墟里的引魂人', line: '姬无常站在一地碎裂的魂灯之间，问你敢不敢借一缕幽冥之火。', choices: [
            { text: '借火淬炼神魂', reply: '幽火附上剑锋，魂灯里的怨气也随之翻涌。', effect: { type: 'bloodPrice', hp: 0.16, attack: 16 } },
            { text: '熄灭魂灯，安抚亡魂', reply: '怨气散去，古墟深处逸出一缕纯净灵气。', effect: { type: 'healCult', amount: 0.18, cult: 90 } }
        ] }
    ]
};

const FLOOR_NAMES = [
    '秘境入口', '碎石甬道', '幽暗回廊', '白骨浅滩', '灵矿岔路',
    '雾隐竹林', '地火裂隙', '古庙残殿', '寒潭深窟', '蟒巢祭坛'
];

const ITEMS = [
    { id: 'pill_hp', emoji: '💊', name: '回春丹', type: 'consumable', rarity: 'common', icon: 'pill-red', price: 20, sell: 8, desc: '恢复 50 点生命。秘境中也可使用。', use: { hp: 50 } },
    { id: 'pill_hp_major', emoji: '🧪', name: '大还丹', type: 'consumable', rarity: 'uncommon', icon: 'pill-gold', price: 65, sell: 26, desc: '恢复 120 点生命。', use: { hp: 120 } },
    { id: 'pill_qi', emoji: '🌀', name: '聚气散', type: 'consumable', rarity: 'common', icon: 'pill-blue', price: 35, sell: 14, desc: '获得 40 点修为。', use: { cult: 40 } },
    { id: 'pill_attack', emoji: '⚔️', name: '淬体丹', type: 'consumable', rarity: 'uncommon', icon: 'pill-red', price: 90, sell: 36, desc: '永久攻击 +2。', use: { atk: 2 } },
    { id: 'pill_life', emoji: '🛡️', name: '养元丹', type: 'consumable', rarity: 'uncommon', icon: 'pill-gold', price: 100, sell: 40, desc: '永久生命上限 +15。', use: { maxHp: 15 } },
    { id: 'talisman_shield', emoji: '🧿', name: '护身符', type: 'consumable', rarity: 'uncommon', icon: 'talisman', price: 40, sell: 16, desc: '获得 40 点护盾；秘境中立即生效。', use: { shield: 40 } },
    { id: 'herb_ling', emoji: '🌿', name: '灵草', type: 'material', rarity: 'common', icon: 'herb', price: 0, sell: 6, desc: '带着清苦药香的灵草，可用于炼丹或出售。' },
    { id: 'ore_iron', emoji: '🪨', name: '玄铁', type: 'material', rarity: 'common', icon: 'ore', price: 0, sell: 8, desc: '沉重的玄铁矿石，炼器材料。' },
    { id: 'crystal_fire', emoji: '🔥', name: '火晶', type: 'material', rarity: 'uncommon', icon: 'crystal-fire', price: 0, sell: 12, desc: '赤炎洞窟凝结的火属性晶石。' },
    { id: 'crystal_ice', emoji: '❄️', name: '寒晶', type: 'material', rarity: 'uncommon', icon: 'crystal-ice', price: 0, sell: 12, desc: '寒潭深处凝结的冰属性晶石。' },
    { id: 'meat_beast', emoji: '🍖', name: '妖兽精肉', type: 'material', rarity: 'common', icon: 'meat', price: 0, sell: 5, desc: '妖兽身上最紧实的一块肉，可出售。' },
    { id: 'jade_slip', emoji: '📜', name: '青云玉简', type: 'treasure', rarity: 'rare', icon: 'scroll', price: 80, sell: 32, desc: '记载着青云旧事的玉简，收藏家会出价。' },
    { id: 'sect_token', emoji: '🪪', name: '宗门令', type: 'treasure', rarity: 'rare', icon: 'token', price: 0, sell: 50, desc: '青云门弟子的信物，可兑换贡献或出售。' }
];

const SECT = {
    id: 'qingyun',
    name: '青云门',
    motto: '剑气长存，道心不折',
    ranks: [
        { name: '外门弟子', contribution: 0, realmMin: 0, salary: 20, discount: 0 },
        { name: '内门弟子', contribution: 120, realmMin: 4, salary: 50, discount: 0.05 },
        { name: '核心弟子', contribution: 400, realmMin: 9, salary: 120, discount: 0.1 }
    ],
    contributionPerFloor: 8,
    contributionPerBoss: 25,
    contributionPerClear: 20
};

const SHOPS = {
    sect: {
        id: 'sect', name: '青云门·执事堂', keeper: '沈砺',
        stock: ['pill_hp', 'pill_qi', 'talisman_shield', 'pill_hp_major', 'pill_attack', 'pill_life']
    },
    linyue: {
        id: 'linyue', name: '林越的行囊', keeper: '林越',
        stock: ['pill_hp', 'herb_ling', 'crystal_fire', 'crystal_ice', 'jade_slip']
    }
};

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
        desc: '大衍历三百二十年，青云山下的村庄。\n暮色压着屋脊，你却在梦里看见一片不该存在的星空——星子一颗接一颗亮起，照见一条没有尽头的山路。\n醒来时，天边正泛起紫光，村中犬吠此起彼伏。\n隔壁传来邻家小妹压不住的咳嗽声。你握紧门框，忽然明白：沉寂三百年的灵气，正在复苏。',
        options: [
            { text: '推门而出，追着紫光去村口', next: 's1', effects: { cult: 12 }, toast: '你踏进夜色，紫光在前方引路' },
            { text: '先替邻家小妹诊脉，再出门', next: 's1', effects: { maxHp: 12, cult: 6 }, flags: { storyHeart: 1 }, toast: '你稳住小妹的脉息，心里也安定下来' },
            { text: '闭门静坐，先把这缕灵气纳入丹田', next: 's1', effects: { maxHp: 6, atk: 2 }, toast: '一缕温热灵气沉入丹田' },
            { text: '🍂「孤苦」把仅剩的干粮留给小妹，独自推门', requiresOrigin: ['orphan'], next: 's1', effects: { maxHp: 12, cult: 8 }, flags: { fateKindHeart: 1 }, toast: '你空着肚子走进夜色，脚步却比谁都稳' },
            { text: '📜「书香」翻出父亲旧书，循着紫光记载出门', requiresOrigin: ['scholar'], next: 's1', effects: { cult: 18, crit: 2 }, flags: { fateScholar: 1 }, toast: '书页上的古篆与天边紫光隐隐相合' },
            { text: '🍀「福缘」循着梦里最亮的那颗星走', requiresTalent: ['lucky'], next: 's1', effects: { cult: 15 }, stones: 20, flags: { fateLuck: 1 }, toast: '你在门槛下摸到一枚不知谁遗落的灵石' }
        ]
    },
    {
        id: 's1', tag: '🎭 奇遇', title: '老槐树下的老人',
        desc: '村口老槐树下坐着个衣衫褴褛的老人，脚边搁着一盏没有火的灯。\n他抬眼看你，像早已知晓你会来。\n「小娃娃，紫光现世，灵气将复。你怕不怕？」\n他从怀里摸出一卷泛黄绢布，封皮上写着《吐纳诀》。\n「拿着。山门要开了，可山门里等的，未必都是机缘。」',
        options: [
            { text: '恭敬接过，郑重拜谢', next: 's2', effects: { cult: 25, maxHp: 10 }, toast: '获得《吐纳诀》与秘境玉符' },
            { text: '先问他为何守在这棵树下', next: 's2', effects: { cult: 15, crit: 4 }, toast: '老人笑而不答，只在你掌心画了一道符' },
            { text: '后退半步，握紧剑柄', next: 's2', effects: { atk: 3, maxHp: 5 }, toast: '老人赞许地点头：「有戒心，才活得长。」' },
            { text: '📜「书香」辨出绢布上的古篆，郑重行礼', requiresOrigin: ['scholar'], next: 's2', effects: { cult: 30, crit: 3 }, flags: { fateScroll: 1 }, toast: '老人讶异地看着你，把《吐纳诀》翻到最后一页' },
            { text: '🩸「煞骨」任煞气外露，逼问老人来历', requiresTalent: ['demonbone'], next: 's2', effects: { atk: 6, cult: 10 }, flags: { fateThreat: 1 }, toast: '老人不退反笑：「煞骨……有意思。」' },
            { text: '🪙「商贾」把一袋铜钱放进无火灯里', requiresOrigin: ['merchant'], next: 's2', effects: { cult: 22 }, stones: 30, flags: { fateMerchant: 1 }, toast: '灯芯竟自行亮起一瞬' }
        ]
    },
    {
        id: 's2', tag: '🌟 转折', title: '灵根觉醒·秘境试炼',
        desc: '当夜，丹田一热，一缕灵气自行运转周天——灵根觉醒了。\n玉符灼灼发光，将你传送到青云山门后的秘境。\n湿冷的风从石缝里钻出来，远处有兽吼，也有某种更沉重的东西在呼吸。\n长老的声音在虚空回荡：\n「斩尽十层妖兽者，方可入门。小心那些机缘——福祸相依。」',
        options: [
            { text: '⚔️ 调息片刻，稳住灵台再入秘境', enterDungeon: true, effects: { maxHp: 12 }, toast: '灵台清明，秘境试炼开始' },
            { text: '⚔️ 趁灵气正盛，直接闯入', enterDungeon: true, effects: { atk: 4 }, toast: '剑锋出鞘，秘境试炼开始' },
            { text: '⚔️「剑骨」以剑意劈开秘境入口', requiresTalent: ['swordbone'], enterDungeon: true, effects: { atk: 4, crit: 4 }, flags: { fateSword: 1 }, toast: '剑光落下，石壁裂开一道笔直的门' },
            { text: '🌿「灵根」引秘境灵气入体再入门', requiresTalent: ['spiritroot'], enterDungeon: true, effects: { maxHp: 15, cult: 20 }, flags: { fateRoot: 1 }, toast: '灵气顺着经脉自行运转，灵台一片澄明' }
        ]
    },
    {
        id: 's3', tag: '📖 第一章 · 完', title: '青云入门',
        desc: '你带着满身煞气与机缘走出秘境。\n长老没有立刻说话，只看着你剑上的缺口，又看了看你身后那道正在闭合的门。\n「十层俱过，心性可嘉。」他把一枚外门弟子牌递到你手里，\n「从今日起，你便是青云外门弟子。记住，山门里最不缺的，就是聪明人。」\n山风拂过，钟声再响。你的修仙之路，正式开始了。',
        options: [
            { text: '双手接过弟子牌，郑重行礼', next: 'c1_end', effects: { cult: 40 }, toast: '你正式成为青云外门弟子' },
            { text: '问长老：秘境里的紫光究竟是什么', next: 'c1_end', effects: { cult: 20, crit: 3 }, toast: '长老沉默片刻：「等你站得更高，自然会知道。」' }
        ]
    },
    {
        id: 'c1_end', tag: '🏆 结算', title: '第一章结算',
        desc: '境界提升，新功法初成。\n青云门内，诸峰林立，灵气浓郁。\n你在弟子居所推开窗，看见远处演武场上有人练剑，剑光如一线秋水。\n修仙之路，才刚刚起步。',
        options: [
            { text: '📜 继续修行（进入第二章）', next: 's4', effects: { cult: 50 }, toast: '踏入第二章·筑基之路' }
        ]
    },

    /* ============ 第二章：筑基之路 ============ */
    {
        id: 's4', tag: '📖 第二章 · 筑基之路', title: '地火之约',
        desc: '成为外门弟子半月，你在灵田除草、练剑、吐纳。\n一日，执事长老传话：「外门大比将近，前三入内门，赐筑基丹。」\n你的修为尚浅。演武场边，几个内门弟子正等着看你的笑话。\n长老压低声音：「赤炎洞窟深处有地火灵液，可洗髓筑基。只是那头熔岩地龙，最近醒了。」',
        options: [
            { text: '🏰 闯赤炎洞窟，取地火灵液', enterDungeon: true, effects: { cult: 30 }, toast: '踏入赤炎洞窟' },
            { text: '📚 先研习《青云剑典》（获得穿透剑气）', next: 's5', effects: { cult: 20, range: 8 }, toast: '习得穿透剑气' },
            { text: '⚔️ 去演武场，先摸摸对手的底', next: 's5', effects: { atk: 3 }, toast: '你在演武场看了一整夜' },
            { text: '💰「商才」先与执事堂谈一笔火晶生意', requiresTalent: ['mercantile'], next: 's5', effects: { cult: 25 }, stones: 50, flags: { fateDeal: 1 }, toast: '你用三寸不烂之舌换到一笔盘缠' },
            { text: '🏛️「世家」以旧族名义调阅地火图志', requiresOrigin: ['noble'], next: 's5', effects: { crit: 5, range: 6 }, flags: { fateNoble: 1 }, toast: '图中标注了一处被忽略的入口' },
            { text: '🏹「猎户」循着地火气味的源头潜行', requiresOrigin: ['hunter'], next: 's5', effects: { speed: 0.2, atk: 2 }, flags: { fateHunter: 1 }, toast: '你从兽径摸清了洞窟的呼吸' }
        ]
    },
    {
        id: 's5', tag: '⚔️ 切磋', title: '师兄挑战',
        desc: '练武场上，内门师兄拦路。\n「外门弟子也想要筑基丹？先接我三招！」\n他手中灵剑嗡鸣，围观弟子窃窃私语。\n你看见他起手时左肩会先沉半寸——那是破绽。',
        options: [
            { text: '⚔️ 正面应战，以剑对剑', next: 's6', effects: { cult: 40, atk: 5 }, toast: '三招之后，师兄收剑，眼神变了' },
            { text: '💨 以快打快，绕到他侧后', next: 's6', effects: { cult: 30, speed: 0.25 }, toast: '你从他剑影里穿过去，围观弟子一片哗然' },
            { text: '🤝 抱拳认输，把力气留给赤炎洞窟', next: 's6', effects: { maxHp: 15, cult: 20 }, toast: '师兄愣了愣，收剑还礼' },
            { text: '🗡️「剑骨」一眼看穿师兄左肩的破绽', requiresTalent: ['swordbone'], next: 's6', effects: { cult: 40, atk: 4, crit: 3 }, flags: { fateFlaw: 1 }, toast: '你剑尖停在破绽前三寸，师兄脸色变了' },
            { text: '🛡️「铁骨」硬接三招再还手', requiresTalent: ['ironbody'], next: 's6', effects: { maxHp: 15, atk: 2 }, flags: { fateIron: 1 }, toast: '三招过后，你半步未退' },
            { text: '🍀「福缘」恰有长辈路过喝止', requiresTalent: ['lucky'], next: 's6', effects: { cult: 25, maxHp: 8 }, flags: { fateLuck2: 1 }, toast: '一声轻咳，师兄收了剑' }
        ]
    },
    {
        id: 's6', tag: '🗺️ 探秘', title: '地火异变',
        desc: '赤炎洞窟的地火突然失控，火脉倒灌，连石壁都在发红。\n长老传音：「灵液在熔岩心，熔岩地龙盘踞在那里。它不死，火脉不会平息。」\n你沿着裂开的岩缝深入，脚下每一步都在发烫。\n最深处，一对赤金色的竖瞳缓缓睁开。',
        options: [
            { text: '🏰 正面破开火脉，斩龙取液', enterDungeon: true, effects: { atk: 5 }, toast: '你一剑劈向火脉' },
            { text: '🏰 先绕行火眼，寻找地龙弱点', enterDungeon: true, effects: { crit: 5, cult: 20 }, toast: '你看清了地火流动的方向' },
            { text: '⚗️「药骨」以药粉稳住灼伤，稳步深入', requiresTalent: ['alchemy'], enterDungeon: true, effects: { maxHp: 12 }, flags: { fateAlchemy: 1 }, toast: '药香压住灼痛，你比任何人都走得稳' },
            { text: '🩸「煞骨」以煞气引开熔岩地龙的注意', requiresTalent: ['demonbone'], enterDungeon: true, effects: { atk: 5 }, flags: { fateTease: 1 }, toast: '地龙竟被你的煞气激得更加狂暴' }
        ]
    },
    {
        id: 's7', tag: '💎 收获', title: '地火灵液',
        desc: '熔岩地龙倒下，赤红的火脉渐渐平息。\n一滴金红色的地火灵液从岩心渗出，落入你掌心。\n灵力自丹田轰鸣而上，经脉拓宽，气海凝实——筑基成。\n长老看着你，又看了看正在冷却的洞窟：\n「筑基大成，赐你内门身份，传《青云护身诀》。地火灵液只是开始，幽冥古墟那边，最近也不安分。」',
        options: [
            { text: '🏆 查看本章结算', next: 'c2_end', effects: { cult: 200, maxHp: 50, atk: 10 }, toast: '筑基成！进入第三章' },
            { text: '先问长老：幽冥古墟是什么地方', next: 'c2_end', effects: { cult: 160, crit: 4 }, toast: '长老只说了一个名字：幽墟镇墓兽' }
        ]
    },
    {
        id: 'c2_end', tag: '🏆 结算', title: '第二章结算',
        desc: '筑基大成，正式成为内门弟子。\n获得《青云护身诀》（护盾机制解锁）。\n赤炎洞窟的火脉已平，但掌门说，幽冥古墟的封印正在松动。\n你站在内门灵峰上，看见云海之下有一道黑线——像一道正在裂开的口子。',
        options: [
            { text: '📜 继续精进（进入第三章）', next: 's8', effects: { cult: 100 }, toast: '踏入第三章·金丹问道' }
        ]
    },

    /* ============ 第三章：金丹问道 ============ */
    {
        id: 's8', tag: '📖 第三章 · 金丹问道', title: '古墟封印',
        desc: '内门弟子三百，争锋相对。\n掌门宣布：「三年一度问剑大会照旧，但今年冠军的彩头，是幽冥古墟里的一枚金丹碎片。」\n「古墟封印松动，幽墟镇墓兽苏醒。谁能取回金丹碎片，谁便是这一届问剑魁首。」\n散场时，有人在廊下低声说：今年的签，怕是早就排好了。',
        options: [
            { text: '⚔️ 报名问剑大会，先探古墟', next: 's9', effects: { cult: 50 }, toast: '报名问剑大会' },
            { text: '🏯 向掌门询问古墟封印', next: 's9', effects: { cult: 35, crit: 3 }, toast: '掌门只说：「金丹不是奖赏，是门槛。」' },
            { text: '⚔️ 去演武场磨砺剑意', next: 's9', effects: { atk: 4 }, toast: '你在演武场练到深夜' },
            { text: '📜「书香」从门规里找出问剑大会的旧例', requiresOrigin: ['scholar'], next: 's9', effects: { cult: 40, crit: 4 }, flags: { fateLaw: 1 }, toast: '你发现今年的签序确实被人动过' },
            { text: '🍂「孤苦」不声不响地摸清签筒的机关', requiresOrigin: ['orphan'], next: 's9', effects: { speed: 0.2, cult: 20 }, flags: { fateSneak: 1 }, toast: '签筒底部有一道新刻的暗槽' }
        ]
    },
    {
        id: 's9', tag: '⚔️ 古墟入口', title: '同行者',
        desc: '幽冥古墟入口，阴风从裂开的石碑间吹出。\n苏清雪抱剑立在阶前：「师弟也来了？古墟里不分先后，只看谁能活着出来。」\n姬无常从阴影里走出，指尖转着一盏没有火的魂灯：\n「两位，古墟的规矩是——拿东西，得留下点什么。」',
        options: [
            { text: '⚔️ 与苏清雪并肩入墟', next: 's10', effects: { cult: 60, atk: 4 }, toast: '苏清雪与你并肩踏上古墟石阶' },
            { text: '💨 独自先行，抢在所有人前面', next: 's10', effects: { cult: 60, speed: 0.25 }, toast: '你从阴影里穿过去，魂灯晃了一下' },
            { text: '🛡️ 先与姬无常谈条件', next: 's10', effects: { cult: 45, maxHp: 15 }, toast: '姬无常笑了：「你会需要我的。」' },
            { text: '🩸「煞骨」以煞气震住暗中窥伺的魂灯', requiresTalent: ['demonbone'], next: 's10', effects: { atk: 5, crit: 5 }, flags: { fateAura: 1 }, toast: '魂灯里的火苗齐齐矮了一截' },
            { text: '🤝「善心」把最后一份伤药递给受伤的同行者', requiresFlag: 'fateKindHeart', next: 's10', effects: { maxHp: 15, cult: 30 }, flags: { fateAlly: 1 }, toast: '对方记下了你的名字，愿在古墟里为你挡一次' }
        ]
    },
    {
        id: 's10', tag: '🏆 古墟', title: '镇墓兽',
        desc: '古墟深处，九盏魂灯围着一座残破祭坛。\n祭坛中央悬着一枚金丹碎片，碎片下方，幽墟镇墓兽缓缓抬头。\n姬无常的声音从背后传来：「它守了几百年，可不会讲道理。」\n苏清雪拔剑：「我替你挡住魂灯，你去取碎片。」\n你握紧剑柄，火把在风里晃了一下。',
        options: [
            { text: '⚔️ 决战镇墓兽', enterDungeon: true, effects: { atk: 5 }, toast: '你踏进祭坛' },
            { text: '🛡️ 先破魂灯，再取碎片', enterDungeon: true, effects: { crit: 6, maxHp: 20 }, toast: '魂灯一盏盏熄灭' }
        ]
    },
    {
        id: 's11', tag: '👑 加冕', title: '金丹成·古墟归来',
        desc: '幽墟镇墓兽倒下，九盏魂灯同时熄灭。\n金丹碎片落入你掌心，与体内灵力相合，凝成一颗圆满金丹。\n丹田金光爆发，神识拓展百里——金丹成。\n姬无常看着你，笑了笑：「下一次见面，希望你还没被这颗金丹吞掉。」\n掌门在古墟外等候：「问剑魁首，赐号「剑心」，入核心弟子。」\n\n—— 第三章「金丹问道」· 完 ——\n（幽冥古墟仍会开放，继续追求大道）',
        options: [
            { text: '🏆 查看最终结算', ending: true, effects: { cult: 500, maxHp: 100, atk: 30, crit: 15 }, toast: '金丹成！大道无尽' }
        ]
    }
];
const STORY_LOCATIONS = {
    s0: { x: 360, y: 1840, name: '青云山下·村庄', icon: '🏘️', kind: 'village' },
    s1: { x: 610, y: 1610, name: '村口老槐树', icon: '🌳', kind: 'tree' },
    s2: { x: 900, y: 1390, name: '青云山秘境入口', icon: '🌀', kind: 'portal' },
    s3: { x: 1200, y: 1190, name: '青云仙门', icon: '⛩️', kind: 'gate' },
    c1_end: { x: 1510, y: 1010, name: '外门弟子居所', icon: '🏯', kind: 'sect' },
    s4: { x: 1840, y: 820, name: '外门演武场', icon: '⚔️', kind: 'arena' },
    s5: { x: 2150, y: 1040, name: '问剑台', icon: '🗡️', kind: 'arena' },
    s6: { x: 2480, y: 820, name: '赤炎洞窟·地火脉', icon: '🔥', kind: 'portal' },
    s7: { x: 2820, y: 590, name: '赤炎洞窟·熔岩心', icon: '💠', kind: 'portal' },
    c2_end: { x: 2580, y: 410, name: '内门灵峰', icon: '🏯', kind: 'sect' },
    s8: { x: 2200, y: 300, name: '青云主峰·议事殿', icon: '🏯', kind: 'sect' },
    s9: { x: 1830, y: 470, name: '幽冥古墟·入口', icon: '🕯️', kind: 'portal' },
    s10: { x: 1450, y: 650, name: '幽冥古墟·镇墓殿', icon: '💀', kind: 'portal' },
    s11: { x: 1040, y: 430, name: '幽冥古墟·金丹坛', icon: '👑', kind: 'sect' }
};

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
window.STORY_LOCATIONS = STORY_LOCATIONS;
window.DUNGEONS = DUNGEONS;
window.TECHNIQUES = TECHNIQUES;
window.NPCS = NPCS;
window.DUNGEON_NPC_EVENTS = DUNGEON_NPC_EVENTS;
window.PLAYER_CARDS = PLAYER_CARDS;
window.MONSTER_CARDS = MONSTER_CARDS;
window.MONSTER_RUN_CARDS = MONSTER_RUN_CARDS;
window.REALMS = REALMS;
window.ORIGINS = ORIGINS;
window.TALENTS = TALENTS;
window.rollFate = rollFate;
window.TALENT_RARITY_WEIGHTS = TALENT_RARITY_WEIGHTS;
/* 角色像素帧：npc-sprites.png 每帧 64x64，npc-portraits.png 每帧 100x125 */
window.CHARACTER_ART = {
    ningxiao: 0, linyue: 1, shenli: 2, guqinghan: 3, mochen: 4,
    jichang: 5, hanxing: 6, suwan: 7, zhaotieyi: 8, ashi: 9,
    cultist: 10, bandit: 11, ronin: 12, assassin: 13
};
window.CHARACTER_ART_FRAME = { w: 64, h: 64 };
window.ART_PORTRAIT_FRAME = { w: 100, h: 125 };
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.FLOOR_NAMES = FLOOR_NAMES;
window.DUNGEON_FLOORS = DUNGEON_FLOORS;
window.ITEMS = ITEMS;
window.SECT = SECT;
window.SHOPS = SHOPS;
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
