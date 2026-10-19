/**
 * Jest测试环境设置
 * 模拟浏览器API和全局变量
 */

// 模拟requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// 模拟localStorage
const localStorageMock = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; },
  key(i) { return Object.keys(this.store)[i] || null; },
  get length() { return Object.keys(this.store).length; }
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// jsdom 的 canvas 默认没有 2D 上下文，提供一个最小 mock
if (typeof window !== 'undefined' && window.HTMLCanvasElement) {
  window.HTMLCanvasElement.prototype.getContext = function () {
    return {
      canvas: this,
      fillRect: jest.fn(), clearRect: jest.fn(), drawImage: jest.fn(),
      fillText: jest.fn(), strokeText: jest.fn(),
      measureText: () => ({ width: 100 }),
      beginPath: jest.fn(), arc: jest.fn(), ellipse: jest.fn(),
      moveTo: jest.fn(), lineTo: jest.fn(), quadraticCurveTo: jest.fn(),
      bezierCurveTo: jest.fn(), closePath: jest.fn(),
      fill: jest.fn(), stroke: jest.fn(), save: jest.fn(), restore: jest.fn(),
      translate: jest.fn(), scale: jest.fn(), rotate: jest.fn(),
      setLineDash: jest.fn(),
      createPattern: jest.fn(() => 'pattern'),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      font: '', textAlign: '', textBaseline: '',
      fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
      shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: true
    };
  };
}

// jsdom 没有 Touch/TouchEvent
if (typeof global.Touch === 'undefined') {
  global.Touch = class Touch {
    constructor(init = {}) { Object.assign(this, init); }
  };
}
if (typeof global.TouchEvent === 'undefined') {
  global.TouchEvent = class TouchEvent extends Event {
    constructor(type, init = {}) {
      super(type);
      this.changedTouches = init.changedTouches || [];
      this.touches = init.touches || this.changedTouches;
    }
  };
}

// 模拟canvas
global.HTMLCanvasElement = class {
  constructor() {
    this.width = 960;
    this.height = 540;
    this.style = {};
    this.getContext = () => ({
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: () => ({ width: 100 }),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      createPattern: jest.fn(() => 'pattern'),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      font: '',
      textAlign: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      imageSmoothingEnabled: true
    });
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 960, height: 540 };
  }
  addEventListener() {}
  removeEventListener() {}
};

// 模拟Image
global.Image = class {
  constructor() {
    this.onload = null;
    this.onerror = null;
    this.src = '';
    setTimeout(() => this.onload?.(), 0);
  }
};

// 模拟Element.getBoundingClientRect
Element.prototype.getBoundingClientRect = function() {
  return { left: 0, top: 0, width: 100, height: 100 };
};

// 设置全局常量
global.G = {
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
  achievements: [],
  learnedTechniques: [],
  npcRelations: {},
  npcChoices: {},
  npcRewardClaims: {},
  world: null,
  combo: 0,
  pierce: 0,
  dodge: 0,
  shield: 0,
  split: 0,
  explode: 0
};

global.REALMS = [
  { name: '炼气一重', cult: 0 }, { name: '炼气二重', cult: 60 }, { name: '炼气三重', cult: 140 },
  { name: '炼气四重', cult: 260 }, { name: '炼气五重', cult: 420 }, { name: '炼气六重', cult: 620 },
  { name: '炼气七重', cult: 860 }, { name: '炼气八重', cult: 1150 }, { name: '炼气九重', cult: 1500 },
  { name: '筑基初期', cult: 1950 }, { name: '筑基中期', cult: 2500 }, { name: '筑基后期', cult: 3200 },
  { name: '金丹初期', cult: 4100 }, { name: '金丹中期', cult: 5200 }, { name: '金丹后期', cult: 6600 },
  { name: '元婴真人', cult: 8500 }, { name: '化神真君', cult: 11000 }, { name: '渡劫天尊', cult: 15000 },
  { name: '大乘道主', cult: 21000 }
];

global.ORIGINS = [
  { id: 'poor', emoji: '🌾', name: '寒门子弟', avatarSeed: 'hanmen', desc: '出身贫寒', bonus: { atk: 2, maxHp: 10 } },
  { id: 'merchant', emoji: '🪙', name: '商贾之后', avatarSeed: 'shanggu', desc: '身家丰厚', bonus: { atk: 1, crit: 5 }, startItem: 'pill_hp' },
  { id: 'noble', emoji: '🏛️', name: '没落世家', avatarSeed: 'shijia', desc: '祖传剑法', bonus: { atk: 4, range: 8 } },
  { id: 'hunter', emoji: '🏹', name: '山村猎户', avatarSeed: 'liehu', desc: '身手矫健', bonus: { maxHp: 20, speed: 0.6 } }
];

global.DUNGEONS = [
  { id: 'qingyun', name: '青云外围', realmMin: 0, floorCount: 10, hpScale: 0.52, atkScale: 0.58,
    floorPool: [['wolf', 'bat'], ['wolf', 'bat'], ['wolf', 'spider'], ['bat', 'spider']],
    techniques: ['qingyun_sword'], position: { x: 900, y: 1390 } }
];

global.MONSTERS = {
  wolf: { id: 'wolf', name: '灰狼', hp: 30, atk: 8, speed: 2.5, r: 14, draw: 32, cult: 5, img: 'wolf', tint: '#a9aa83' },
  bat: { id: 'bat', name: '吸血蝠', hp: 20, atk: 6, speed: 3.0, r: 12, draw: 28, cult: 4, img: 'bat', tint: '#8b7a9d' },
  spider: { id: 'spider', name: '剧毒蛛', hp: 25, atk: 7, speed: 2.2, r: 13, draw: 30, cult: 6, img: 'spider', tint: '#7d9a7d' },
  elite: { id: 'elite', name: '魔将·血煞', hp: 220, atk: 22, speed: 1.7, r: 26, draw: 72, cult: 45, elite: true, img: 'elite', tint: '#c0392b' },
  boss: { id: 'boss', name: '赤鳞蟒', hp: 650, atk: 20, speed: 1.35, r: 42, draw: 120, cult: 120, boss: true, img: 'boss', tint: '#8b0000' }
};

global.CARDS = [
  { id: 'power1', type: 'pure', emoji: '⚔️', name: '力量符', desc: '攻击力提升3点', effects: { atk: 3 } },
  { id: 'hp1', type: 'pure', emoji: '🛡️', name: '龟甲符', desc: '最大生命提升25点', effects: { maxHp: 25 } },
  { id: 'speed1', type: 'pure', rarity: 'uncommon', emoji: '💨', name: '疾风符', desc: '移动速度提升0.5', effects: { speed: 0.5 } }
];

global.MONSTER_RUN_CARDS = [];

global.ACHIEVEMENTS = [
  { id: 'first_kill', emoji: '🏆', name: '初试锋芒', desc: '击杀第一只妖兽', check: (ctx) => ctx.flags.kills >= 1 },
  { id: 'first_clear', emoji: '🏆', name: '秘境新人', desc: '首次通关秘境', check: (ctx) => ctx.flags.clears >= 1 }
];

global.FLOOR_NAMES = ['初层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '十层'];

global.DUNGEON_NPC_EVENTS = {
  qingyun: [
    { floor: 3, npcId: 'ningxiao', title: '迷路弟子', line: '道友救命！', choices: [
      { text: '给丹药', reply: '多谢！', favor: 10, technique: 'breath_cycle' }
    ]}
  ]
};

global.STORIES = [];
global.STORY_LOCATIONS = {};

global.CARD_TYPE_LABELS = { pure: '✨ 纯增益', mixed: '⚖️ 利弊共存', cursed: '💀 诅咒', monster: '👿 妖祸契约' };
global.CURSE_TIERS = { minor: { label: '小劫', unlockFloor: 2, weight: 2.4 }, major: { label: '凶煞', unlockFloor: 4, weight: 0.85 }, calamity: { label: '天厄', unlockFloor: 7, weight: 0.3 } };
global.CARD_CURSE_TIER_LABELS = { minor: '小劫', major: '凶煞', calamity: '天厄' };
global.CARD_DUPLICATE_BONUSES = {};

global.NPCS = [
  { id: 'ningxiao', name: '宁小雨', title: '迷路的外门弟子', portrait: 'ningxiao', x: 520, y: 1650, faction: '青云门', attitude: 'friendly', color: '#72b89d', zone: 'overworld', greeting: '呼……', choices: [] }
];

// 导入待测模块需要的全局函数
global.drawCardsByTier = (available, count, floor, getRank) => {
  const tiers = { common: 0.65, uncommon: 0.25, rare: 0.08, legendary: 0.02 };
  const weights = available.map(c => (tiers[c.rarity || 'common'] || 0.65) * Math.pow(0.35, getRank(c.id) || 0));
  const picked = [];
  const avail = [...available];
  const w = [...weights];
  for (let i = 0; i < count && avail.length > 0; i++) {
    const r = Math.random() * w.reduce((a, b) => a + b, 0);
    let sum = 0, idx = 0;
    for (let j = 0; j < w.length; j++) { sum += w[j]; if (r <= sum) { idx = j; break; } }
    picked.push(avail[idx]);
    avail.splice(idx, 1); w.splice(idx, 1);
  }
  return picked;
};

global.cardArt = (id) => `<span>${id}</span>`;
global.getCardDrawTierLabel = (c) => c.rarity || 'common';
global.getCardEvolutions = () => [];
global.floatText = jest.fn();
global.gainCultivation = jest.fn();
global.hurtPlayer = jest.fn();
global.killMonster = jest.fn();
global.damageMonster = jest.fn();
global.showDualCardChoice = jest.fn();
global.learnDungeonTechnique = jest.fn();
global.onDungeonFloorClear = jest.fn();
global.onDungeonDeath = jest.fn();
global.onDungeonClear = jest.fn();
global.onWorldNpcNearby = jest.fn();
global.onWorldStoryNearby = jest.fn();
global.onDungeonNpcNearby = jest.fn();
global.showStoryDialog = jest.fn();
global.getStoryNode = (id) => global.STORIES.find(s => s.id === id);
global.getStoryDungeonId = () => 'qingyun';
global.learnPermanentTechnique = jest.fn();
global.getNpcRelation = (npc) => 0;
global.npcRelationLabel = (score) => ({ label: '中立', className: '' });
global.showNpcDialog = jest.fn();
global.chooseNpcOption = jest.fn();
global.closeNpcDialog = jest.fn();
global.showDungeonSelector = jest.fn();
global.showTechniques = jest.fn();
global.getDungeonFloorForChapter = () => 1;
global.showEnding = jest.fn();
global.eStat = (l, v) => `<div>${l}:${v}</div>`;
global.showCardChoices = jest.fn();
global.drawRunCards = jest.fn();
global.pickRunCard = jest.fn();
global.applyRunCard = jest.fn();
global.applyRunMonsterEffects = jest.fn();
global.SAVE_VERSION = 2;
global.SAVE_PREFIX = 'xian2d_save_';
global.USER_PREFIX = 'xian2d_user_';
global.getSaveKey = () => 'xian2d_save_test';
global.bytesToHex = (b) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
global.hexToBytes = (h) => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
global.hashLocalPassword = async () => 'hash';
global.createPasswordSalt = () => 'salt';
global.getSaveData = () => '{}';
global.applySaveData = () => true;
global.saveGame = jest.fn();
global.doLogin = jest.fn();
global.guestLogin = jest.fn();
global.toast = jest.fn();
global.updateHUD = jest.fn();
global.renderOrigins = jest.fn();
global.showSaveLoad = jest.fn();
global.closeSaveLoad = jest.fn();
global.renderLocalSaves = jest.fn();
global.loadLocalByKey = jest.fn();
global.showAchievements = jest.fn();
global.renderAchievements = jest.fn();
global.showCodex = jest.fn();
global.renderCodexTab = jest.fn();
global.renderMonsterCodex = jest.fn();
global.renderPlayerCodex = jest.fn();
global.renderCardCodex = jest.fn();
global.renderItemCodex = jest.fn();
global.confirmReset = jest.fn();
global.closeMenu = jest.fn();
global.showGameShell = jest.fn();
global.newGame = jest.fn();
global.renderAchievementBadge = jest.fn();
global.init = jest.fn();
global.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
global.checkAchievements = jest.fn();
global.originAvatar = (o) => `https://api.dicebear.com/9.x/adventurer/svg?seed=${o.avatarSeed}`;
global.drawNpcPortrait = jest.fn(() => true);

if (typeof window !== 'undefined') {
    window.Image = global.Image;
    window.requestAnimationFrame = global.requestAnimationFrame;
    window.cancelAnimationFrame = global.cancelAnimationFrame;
    try { window.localStorage = global.localStorage; } catch (e) { /* jsdom 自带 localStorage */ }
}

// 加载被测模块
require('../engine/utils/MathUtils.js');
require('../engine/utils/AssetLoader.js');
require('../engine/utils/ObjectPool.js');
require('../engine/core/EventBus.js');
require('../engine/core/GameState.js');
require('../engine/core/InputManager.js');

// 模块通过 window.X 暴露类；测试里直接使用裸类名
for (const name of ['MathUtils', 'SeededRandom', 'ObjectPool', 'PoolTypes', 'EventBus',
    'GameState', 'InputManager', 'AssetLoader']) {
    if (typeof window !== 'undefined' && window[name]) {
        global[name] = window[name];
    }
}