/**
 * 修仙传说2D - 核心类型定义
 * 所有游戏核心数据结构的TypeScript类型定义
 */

// ============================================
// 基础几何与数学类型
// ============================================

interface Vec2 {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Color = string; // CSS颜色值

// ============================================
// 游戏常量与配置类型
// ============================================

const enum RealmIndex {
  LianQi1 = 0,
  LianQi2 = 1,
  LianQi3 = 2,
  LianQi4 = 3,
  LianQi5 = 4,
  LianQi6 = 5,
  LianQi7 = 6,
  LianQi8 = 7,
  LianQi9 = 8,
  ZhuJi1 = 9,
  ZhuJi2 = 10,
  ZhuJi3 = 11,
  JinDan1 = 12,
  JinDan2 = 13,
  JinDan3 = 14,
  YuanYing = 15,
  HuaShen = 16,
  DuJie = 17,
  DaCheng = 18
}

interface Realm {
  name: string;
  cult: number; // 突破所需修为
}

interface Origin {
  id: string;
  emoji: string;
  name: string;
  avatarSeed: string;
  desc: string;
  bonus: Partial<PlayerBaseAttrs>;
  startItem?: string;
}

interface Dungeon {
  id: string;
  name: string;
  subtitle: string;
  realmMin: number;
  floorCount: number;
  hpScale: number;
  atkScale: number;
  color: string;
  entry: Vec2;
  floorPool: string[][];
  techniques: string[];
  position: Vec2;
}

// ============================================
// 玩家基础属性
// ============================================

interface PlayerBaseAttrs {
  atk: number;
  maxHp: number;
  speed: number;
  range: number;
  lifesteal: number;
  crit: number;
  cult: number; // 修为
}

// ============================================
// 玩家运行时修饰符 (秘境内临时)
// ============================================

interface PlayerMods {
  // 基础数值加成
  atk: number;
  maxHp: number;
  speed: number;
  range: number;
  crit: number;
  lifesteal: number;

  // 特殊机制
  doubleHit: boolean;
  pierce: boolean;
  knockback: number;
  stunChance: number;
  stunDur: number;
  elemFire: boolean;
  elemDmg: number;
  elemIce: boolean;
  freezeChance: number;
  freezeDur: number;
  chain: number;
  chainDmg: number;
  dashStrike: boolean;
  dashCd: number;
  shield: number;
  shieldCd: number;
  dodge: number;
  regen: number;
  thorns: number;
  combo: number;
  split: number;
  explode: number;
  burnTime: number;

  // 进化专属
  evoBlade: boolean;
  evoFlame: boolean;
  evoFrost: boolean;
  evoStorm: boolean;
  evoAegis: boolean;
  evoPhantom: boolean;
  evoSoul: boolean;
  evoRuin: boolean;
  evoBloom: boolean;

  // 诅咒专属
  curseSoulHarvest: number;
  curseFrenzy: number;
  curseFrenzyTimer: number;
  curseLastStand: boolean;
  curseLastStandHp: number;
  curseLastStandUsed: boolean;
}

// ============================================
// 怪物运行时修饰符 (累积)
// ============================================

interface MonsterMods {
  hpMul: number;
  atkMul: number;
  spdMul: number;
  cntAdd: number;
  forceElite: boolean;
  shield: number;
  regen: number;
  thorns: number;
  split: number;
  explode: boolean;
  teleport: number;
  summonCd: number;
}

// ============================================
// 卡牌系统类型
// ============================================

type CardType = 'pure' | 'mixed' | 'cursed' | 'monster';
type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type CurseTier = 'minor' | 'major' | 'calamity';

interface CardEffect {
  [key: string]: number | boolean;
}

interface Card {
  id: string;
  type: CardType;
  emoji: string;
  name: string;
  desc: string;
  rarity?: CardRarity;
  effects: CardEffect;
  monsterEffects?: CardEffect;
  curseTier?: CurseTier;
  curseGift?: CardEffect;
  curseCost?: CardEffect;
  curseUpgrade?: CardEffect;
  selectedBranch?: string;
}

interface CardRank {
  player: Record<string, number>;
  monster: Record<string, number>;
  run: Record<string, number>;
}

interface CardEvolution {
  id: string;
  name: string;
  desc: string;
  effects: CardEffect;
  curseUpgrade?: CardEffect;
}

// ============================================
// 实体基类
// ============================================

interface BaseEntity {
  id: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  facing: number;
}

// ============================================
// 玩家实体
// ============================================

interface PlayerEntity extends BaseEntity {
  hp: number;
  maxHp: number;
  atkCd: number;
  swinging: number;
  invuln: number;
  hitSet: Set<string> | null;
  walkT: number;
  vx: number;
  vy: number;
  dashCd: number;
  dashTime: number;
  dashVx: number;
  dashVy: number;
  shield: number;
  shieldMax: number;
  shieldCooldown: number;
  slowTime: number;
  stunTime: number;
  attackSlowTime: number;
  slideTime: number;
  burnTime: number;
  hazardBurnDamage: number;
  poisonTime: number;
  poisonTick: number;
  iceDriftX: number;
  iceDriftY: number;
  curseFrenzyTimer: number;
  curseFrenzyAtk: number;
  curseLastStandUsed: boolean;
  mods: PlayerMods;
  anim: {
    fw: number;
    fh: number;
    cols: number;
    frameTime: number;
    dirMap: {
      up: string;
      down: string;
      left: string;
      upleft: string;
      downleft: string;
    };
  };
}

// ============================================
// 怪物实体
// ============================================

type MonsterType = 'normal' | 'elite' | 'boss' | 'ranged';

interface MonsterEntity extends BaseEntity {
  id: string;
  name: string;
  img: string;
  boss: boolean;
  elite: boolean;
  atk: number;
  speed: number;
  atkCd: number;
  stunCd: number;
  controlEffect: string | null;
  type: MonsterType;
  draw: number;
  tint: string;
  trapCycles: Record<string, number>;
  burnTime: number;
  poisonTime: number;
  poisonTick: number;
  flash: number;
  // 远程怪特有
  ranged?: boolean;
  keepDistance?: boolean;
  shootRange?: number;
  shootCd?: number;
  projectileColor?: string;
  slow?: number;
}

// ============================================
// 子弹/投射物
// ============================================

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  color: string;
  life: number;
  shouldRemove: boolean;
  // 斩击特有
  angle?: number;
  range?: number;
  isCrit?: boolean;
  pierce?: boolean;
  chain?: number;
  chainDmg?: number;
  elemFire?: boolean;
  elemIce?: boolean;
  freezeChance?: number;
  freezeDur?: number;
  lifesteal?: number;
  knockback?: number;
  stunChance?: number;
  stunDur?: number;
  thorns?: number;
}

// ============================================
// 特效
// ============================================

type EffectType = 'boom' | 'element' | 'evolution';

interface Effect {
  type: EffectType;
  x: number;
  y: number;
  color: string;
  t: number;
  life: number;
  element?: 'fire' | 'ice' | 'poison' | 'heal' | 'shield' | 'chain' | 'crystal' | 'seal' | 'roots' | 'void';
}

// ============================================
// 飘字
// ============================================

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  life: number;
  vy: number;
}

// ============================================
// 陷阱
// ============================================

type TrapType = 'roots' | 'blade' | 'sinkhole' | 'bone' | 'crystal' | 'miasma' | 'fire' | 'rune' | 'ice' | 'altar';

interface Trap {
  id: string;
  type: TrapType;
  x: number;
  y: number;
  radius: number;
  name: string;
  hint: string;
  color: string;
  damage: number;
  damageRatio: number;
  period: number;
  warning: number;
  activeDuration: number;
  phase: number;
  playerCycle: number;
  playerNextHit: number;
  // 特定类型属性
  slow?: number;
  knockback?: number;
  burn?: number;
  burnDamage?: number;
  stun?: number;
  shock?: number;
  poison?: number;
  attackSlow?: number;
  slide?: number;
  drain?: number;
  projectileCycle?: number;
  healCycle?: number;
}

// ============================================
// 宝箱
// ============================================

interface Chest {
  x: number;
  y: number;
  opened: boolean;
  r: number;
}

// ============================================
// 场景装饰
// ============================================

interface SceneryItem {
  type: string;
  x: number;
  y: number;
  size: number;
  turn: number;
  color: string;
  phase: number;
}

// ============================================
// 地标
// ============================================

interface Landmark {
  type: string;
  solid: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  turn: number;
  color: string;
  phase: number;
}

// ============================================
// 世界系统类型
// ============================================

interface WorldPlayer {
  x: number;
  y: number;
  facing: number;
  walkT: number;
  vx: number;
  vy: number;
  anim: {
    fw: number;
    fh: number;
    cols: number;
    frameTime: number;
  };
}

interface Camera {
  x: number;
  y: number;
}

interface WorldActor {
  npc: NPC;
  x: number;
  y: number;
  phase: number;
  roam: number;
  facing: number;
  walkT: number;
  vx: number;
  vy: number;
}

interface WorldCreature {
  id: string;
  img: string;
  name: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  phase: number;
  r: number;
  draw: number;
  tint: string;
  speed: number;
  bob: number;
}

interface WorldProgress {
  x: number;
  y: number;
  zone: string;
}

// ============================================
// NPC系统
// ============================================

type NPCAttitude = 'friendly' | 'neutral' | 'hostile';

interface NPCChoice {
  text: string;
  reply: string;
  favor?: number;
  technique?: string;
  reward?: Partial<PlayerBaseAttrs>;
  effect?: NPCEffect;
}

interface NPCEffect {
  type: 'heal' | 'healCult' | 'attack' | 'shield' | 'cult' | 'speed' | 'bloodPrice' | 'riskCult';
  amount?: number;
  cult?: number;
  hp?: number;
  attack?: number;
}

interface NPC {
  id: string;
  name: string;
  title: string;
  portrait: string;
  x: number;
  y: number;
  faction: string;
  attitude: NPCAttitude;
  color: string;
  zone: string;
  greeting: string;
  choices: NPCChoice[];
  dungeonEncounter?: boolean;
}

// ============================================
// 剧情系统
// ============================================

interface StoryNode {
  id: string;
  tag: string;
  title: string;
  desc: string;
  options: StoryOption[];
}

interface StoryOption {
  text: string;
  reply?: string;
  favor?: number;
  effects?: Partial<PlayerBaseAttrs & { cult: number }>;
  toast?: string;
  next?: string;
  ending?: boolean;
  enterDungeon?: boolean;
}

interface StoryLocation {
  name: string;
  x: number;
  y: number;
}

interface StoryProgress {
  node: string;
  done: string[];
}

// ============================================
// 成就系统
// ============================================

interface Achievement {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  check: (ctx: { flags: GameFlags; realm: number }) => boolean;
}

// ============================================
// 游戏标志
// ============================================

interface GameFlags {
  kills: number;
  runs: number;
  clears: number;
  maxFloor: number;
  cursedPicks: number;
  storyClear: number;
  deaths: number;
  noDeathClear: number;
}

// ============================================
// 存档数据
// ============================================

interface SaveData {
  ver: number;
  username: string;
  origin: string | null;
  created: boolean;
  realm: number;
  cultivation: number;
  atk: number;
  maxHp: number;
  speed: number;
  range: number;
  lifesteal: number;
  crit: number;
  hp: number;
  flags: GameFlags;
  story: StoryProgress;
  world: WorldProgress | null;
  learnedTechniques: string[];
  npcRelations: Record<string, number>;
  npcChoices: Record<string, number[]>;
  npcRewardClaims: Record<string, boolean>;
  achievements: string[];
  saveTs: number;
}

// ============================================
// 运行时完整状态
// ============================================

interface RuntimeState {
  // 核心运行状态
  running: boolean;
  state: 'idle' | 'world' | 'playing' | 'clear' | 'dialog';
  storyDungeon: boolean;
  skirmish: boolean;
  floor: number;
  floorCount: number;
  dungeonId: string;
  dungeon: Dungeon | null;
  time: number;
  mapSeed: number;
  portal: any | null;
  noDeathRun: boolean;

  // 战斗实体
  player: PlayerEntity | null;
  monsters: MonsterEntity[];
  bullets: Bullet[];
  effects: Effect[];
  texts: FloatText[];
  chests: Chest[];
  traps: Trap[];
  scenery: SceneryItem[];
  landmarks: Landmark[];
  arena: Vec2[];
  floorNpc: FloorNPC | null;
  pendingFloorClear: number | null;
  npcPausedState: string | null;

  // 卡牌系统
  cards: CardRank;
  monsterMods: MonsterMods;

  // 世界系统
  world: {
    player: WorldPlayer | null;
    camera: Camera;
    zone: string;
    decor: SceneryItem[];
    actors: WorldActor[];
    creatures: WorldCreature[];
    saveTimer: number;
    storyPrompted: string | null;
    npcPrompted: string | null;
  };

  // 输入
  input: {
    keys: Record<string, boolean>;
    mouse: { x: number; y: number; down: boolean };
    joystick: { active: boolean; id: number | null; ox: number; oy: number; dx: number; dy: number };
  };

  // 资源
  assets: {
    images: Record<string, HTMLImageElement | null>;
    floorPattern: CanvasPattern | null;
  };
}

// 秘境NPC
interface FloorNPC {
  x: number;
  y: number;
  phase: number;
  used: boolean;
  npc: NPC;
}

// ============================================
// 全局游戏状态 (G对象)
// ============================================

interface GlobalGameState {
  username: string | null;
  guest: boolean;
  created: boolean;
  origin: string | null;
  realm: number;
  cultivation: number;
  atk: number;
  maxHp: number;
  speed: number;
  range: number;
  lifesteal: number;
  crit: number;
  hp: number;
  flags: GameFlags;
  story: StoryProgress;
  achievements: string[];
  learnedTechniques: string[];
  npcRelations: Record<string, number>;
  npcChoices: Record<string, number[]>;
  npcRewardClaims: Record<string, boolean>;
  world: WorldProgress | null;
  // 运行时全局修饰符
  combo: number;
  pierce: number;
  dodge: number;
  shield: number;
  split: number;
  explode: number;
}

// ============================================
// 导出所有类型
// ============================================

// 供JSDoc使用的类型别名
type GameState = RuntimeState & { progress: GlobalGameState };
type EngineState = RuntimeState;
type WorldState = RuntimeState['world'];
type CombatState = Pick<RuntimeState, 'player' | 'monsters' | 'bullets' | 'effects' | 'traps' | 'floor' | 'floorCount' | 'dungeonId'>;