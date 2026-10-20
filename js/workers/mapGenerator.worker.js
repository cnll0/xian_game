/**
 * Web Worker: 地图生成
 * 专门处理耗时的地图生成计算，不阻塞主线程
 */

// 导入确定性随机数生成器（内联避免模块依赖）
class SeededRandom {
    constructor(seed = 1) {
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
    nextInt(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    nextFloat(min, max) {
        return min + this.next() * (max - min);
    }
    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }
    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

// 常量定义（与主线程保持一致）
const W = 960, H = 540, PAD = 24;

// 地形类型配置
const TERRAIN_CONFIG = {
    forest: { types: ['shrub', 'flower', 'stone'], counts: [24, 34, 22], sizes: [[12,28], [2,5], [5,13]], colors: [['#254e3a','#396448','#527044'], ['#c7a76a','#e3c97a','#8dbf81'], ['#55534d','#736c5c','#494950']] },
    bamboo: { types: ['bamboo', 'flower', 'stone'], counts: [24, 34, 22], sizes: [[12,28], [2,5], [5,13]], colors: [['#3f704b','#5d8556','#2f5e43'], ['#c7a76a','#e3c97a','#8dbf81'], ['#55534d','#736c5c','#494950']] },
    bones: { types: ['bone', 'bonepile', 'stone'], counts: [17, 11, 15], sizes: [[12,24], [17,29], [5,14]], colors: [['#c2b99d','#ddd1ad','#a69a81'], ['#8d897a','#a69b83'], ['#615b57','#77716a']] },
    mine: { types: ['crystal', 'ore', 'stone'], counts: [17, 18, 17], sizes: [[13,27], [9,20], [5,14]], colors: [['#62d6bd','#7df9d0','#a5e9d1'], ['#72574d','#8b694d','#a88957'], ['#52464b','#73605c']] },
    lava: { types: ['basalt', 'ember', 'crystal'], counts: [22, 32, 9], sizes: [[10,24], [2,5], [11,22]], colors: [['#51413d','#65504a','#433c43'], ['#ff803d','#ffd166','#e44f35'], ['#f27148','#ffad54']] },
    ice: { types: ['ice', 'icepool', 'stone'], counts: [21, 12, 14], sizes: [[12,27], [20,40], [6,16]], colors: [['#83d9ee','#c8f5f3','#7faec9'], ['#6db6d0','#97dfeb'], ['#687c85','#718c95']] },
    temple: { types: ['pillar', 'rune', 'brazier', 'stone'], counts: [10, 20, 5, 18], sizes: [[22,40], [5,12], [12,19], [5,14]], colors: [['#897455','#a18c67','#6e5b50'], ['#d2b56f','#b69ce9','#79d8c5'], ['#ff9c4d','#ffd166'], ['#67584c','#81705c']] },
    altar: { types: ['pillar', 'rune', 'brazier', 'stone'], counts: [12, 20, 8, 18], sizes: [[22,40], [5,12], [12,19], [5,14]], colors: [['#897455','#a18c67','#6e5b50'], ['#d2b56f','#b69ce9','#79d8c5'], ['#ff9c4d','#ffd166'], ['#67584c','#81705c']] },
    ruins: { types: ['rubble', 'rune', 'stone'], counts: [25, 24, 20], sizes: [[8,22], [5,13], [5,14]], colors: [['#57504e','#71645c','#47464c'], ['#8c77d2','#6ed9c6','#b69ce9'], ['#4f4b51','#6b6261']] }
};

const LANDMARK_OPTIONS = {
    forest: ['grove', 'pool', 'fallen-log'],
    ruins: ['broken-wall', 'sunken-court', 'obelisk'],
    bones: ['bone-pit', 'rib-cage', 'bone-pile'],
    mine: ['crystal-vein', 'ore-field', 'collapsed-shaft'],
    bamboo: ['bamboo-grove', 'stream', 'fallen-log'],
    lava: ['lava-rift', 'basalt-island', 'ember-crater'],
    temple: ['sunken-court', 'obelisk', 'broken-wall'],
    ice: ['frozen-pond', 'ice-spines', 'stream'],
    altar: ['ritual-ring', 'obelisk', 'basalt-island']
};

const LANDMARK_COLORS = {
    forest: ['#43654a', '#718255'], ruins: ['#706477', '#8f816f'],
    bones: ['#887c67', '#c1b28d'], mine: ['#398c7a', '#a77f50'],
    bamboo: ['#47704b', '#83a35b'], lava: ['#763e35', '#de6843'],
    temple: ['#85704d', '#baa36c'], ice: ['#5b9fb2', '#b5e2e6'],
    altar: ['#6a467b', '#bc79d5']
};

const SOLID_LANDMARK_TYPES = ['grove', 'fallen-log', 'broken-wall', 'obelisk',
    'bone-pit', 'rib-cage', 'bone-pile', 'crystal-vein',
    'collapsed-shaft', 'bamboo-grove', 'basalt-island', 'ice-spines'];

const TRAP_TYPES = {
    1: 'roots', 2: 'blade', 3: 'sinkhole', 4: 'bone', 5: 'crystal',
    6: 'miasma', 7: 'fire', 8: 'rune', 9: 'ice', 10: 'altar'
};

const TRAP_DETAILS = {
    roots: { name: '缠灵藤·束足', hint: '缠住后移动减慢', color: '#83d378', damage: 8, damageRatio: 0.08, slow: 1.4 },
    blade: { name: '回风双刃', hint: '旋刃沿直线扫击', color: '#d9b16b', damage: 12, damageRatio: 0.12, knockback: 28 },
    sinkhole: { name: '流沙陷环', hint: '外环伤人并吸向中心', color: '#c79a65', damage: 13, damageRatio: 0.12, slow: 0.7 },
    bone: { name: '白骨潮汐', hint: '六道骨刃旋扫', color: '#e2d1ae', damage: 13, damageRatio: 0.13, knockback: 20 },
    crystal: { name: '灵晶飞爆', hint: '晶刺从中心向外弹射', color: '#75e8d2', damage: 10, damageRatio: 0.1 },
    miasma: { name: '腐心瘴云', hint: '中毒后持续损失生命', color: '#91c46d', damage: 8, damageRatio: 0.07, poison: 3.2 },
    fire: { name: '地火喷口', hint: '离开火口以免持续灼烧', color: '#ff743e', damage: 14, damageRatio: 0.12, burn: 2.25, burnDamage: 0.025 },
    rune: { name: '镇魂禁攻阵', hint: '受击后攻击间隔延长', color: '#d4a0ff', damage: 11, damageRatio: 0.1, attackSlow: 3 },
    ice: { name: '寒潭滑裂', hint: '踏入后会惯性滑行', color: '#9defff', damage: 9, damageRatio: 0.09, slide: 1.4 },
    altar: { name: '蟒巢聚灵坛', hint: '范围内妖兽会周期回春', color: '#e692ff', damage: 15, damageRatio: 0.14 }
};

const ARENA_LAYOUTS = {
    1: [[.08,.03],[.92,.03],[.99,.20],[.87,.44],[.96,.78],[.77,.97],[.23,.97],[.04,.78],[.13,.44],[.01,.20]],
    2: [[.24,.03],[.76,.03],[.97,.22],[.97,.76],[.76,.97],[.24,.97],[.03,.76],[.03,.22]],
    3: [[.14,.03],[.86,.03],[.98,.30],[.88,.75],[.72,.97],[.28,.97],[.12,.75],[.02,.30]],
    4: [[.17,.03],[.83,.03],[.99,.38],[.82,.97],[.18,.97],[.01,.38]],
    5: [[.34,.03],[.66,.03],[.89,.15],[.82,.86],[.65,.97],[.35,.97],[.18,.86],[.11,.15]],
    6: [[.12,.03],[.88,.03],[.98,.18],[.90,.84],[.78,.97],[.22,.97],[.10,.84],[.02,.18]],
    7: [[.15,.03],[.85,.03],[.96,.16],[.86,.31],[.99,.46],[.87,.62],[.95,.83],[.76,.97],[.24,.97],[.05,.83],[.13,.62],[.01,.46],[.14,.31],[.04,.16]],
    8: [[.22,.03],[.78,.03],[.97,.22],[.97,.78],[.78,.97],[.22,.97],[.03,.78],[.03,.22]],
    9: [[.20,.03],[.80,.03],[.98,.25],[.87,.43],[.95,.76],[.72,.97],[.28,.97],[.05,.76],[.13,.43],[.02,.25]],
    10: [[.50,.02],[.84,.13],[.98,.45],[.84,.82],[.50,.97],[.16,.82],[.02,.45],[.16,.13]],
    11: [[.08,.06],[.34,.04],[.64,.02],[.90,.10],[.97,.32],[.86,.56],[.94,.80],[.74,.96],[.26,.97],[.06,.78],[.12,.52],[.02,.32]],
    12: [[.16,.04],[.46,.02],[.75,.10],[.96,.35],[.87,.74],[.69,.96],[.31,.97],[.13,.78],[.02,.38],[.10,.20]],
    13: [[.10,.22],[.26,.04],[.62,.02],[.86,.14],[.97,.42],[.90,.72],[.70,.96],[.30,.97],[.04,.76],[.08,.48],[.02,.24]],
    14: [[.12,.03],[.38,.04],[.58,.18],[.86,.10],[.98,.36],[.90,.60],[.96,.83],[.78,.95],[.22,.97],[.04,.82],[.10,.48],[.02,.20]]
};

// 工具函数
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeRandom(seed) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

// 主生成函数
function generateFloorScenery(floor, mapSeed, W, H, PAD, theme) {
    const seed = (mapSeed + floor * 7919 + 104729) % 2147483647;
    const random = makeRandom(seed);

    const terrain = theme || (floor === 1 ? 'forest' :
        floor <= 3 ? 'ruins' :
        floor === 4 ? 'bones' :
        floor === 5 ? 'mine' :
        floor === 6 ? 'bamboo' :
        floor === 7 ? 'lava' :
        floor === 8 ? 'temple' :
        floor === 9 ? 'ice' : 'altar');

    const config = TERRAIN_CONFIG[terrain] || TERRAIN_CONFIG.ruins;
    const scenery = [];

    const add = (type, count, minSize, maxSize, colors) => {
        for (let i = 0; i < count; i++) {
            let x = PAD + 18 + random() * (W - PAD * 2 - 36);
            let y = PAD + 18 + random() * (H - PAD * 2 - 36);
            if (x > W * 0.36 && x < W * 0.64 && y > H * 0.67) {
                y = PAD + 25 + random() * (H * 0.43);
            }
            scenery.push({
                type, x, y,
                size: minSize + random() * (maxSize - minSize),
                turn: random() * Math.PI * 2,
                color: colors[Math.floor(random() * colors.length)],
                phase: random() * Math.PI * 2
            });
        }
    };

    config.types.forEach((type, idx) => {
        add(type, config.counts[idx], config.sizes[idx][0], config.sizes[idx][1], config.colors[idx]);
    });

    return scenery;
}

function generateFloorLandmarks(floor, mapSeed, W, H, PAD, theme) {
    const seed = (mapSeed + floor * 104729) % 2147483647;
    const random = makeRandom(seed);

    const terrain = theme || (floor === 1 ? 'forest' :
        floor <= 3 ? 'ruins' :
        floor === 4 ? 'bones' :
        floor === 5 ? 'mine' :
        floor === 6 ? 'bamboo' :
        floor === 7 ? 'lava' :
        floor === 8 ? 'temple' :
        floor === 9 ? 'ice' : 'altar');

    const options = LANDMARK_OPTIONS[terrain] || LANDMARK_OPTIONS.ruins;
    const colors = LANDMARK_COLORS[terrain] || LANDMARK_COLORS.ruins;

    const landmarks = [];
    const kinds = options;
    const count = 3 + Math.floor(random() * 2);

    for (let i = 0; i < count; i++) {
        const type = kinds[Math.floor(random() * kinds.length)];
        const w = 78 + random() * 95;
        const h = 48 + random() * 63;
        const clearance = Math.max(w, h) * 0.55 + 44;

        let x, y, tries = 0;
        const isAvailable = (cx, cy) =>
            Math.hypot(cx - W / 2, cy - (H - 70)) >= clearance + 50 &&
            Math.hypot(cx - W / 2, cy - (PAD + 70)) >= clearance + 30 &&
            landmarks.every(item => Math.hypot(cx - item.x, cy - item.y) >=
                Math.max(item.w, item.h) * 0.55 + clearance);

        do {
            x = W * (0.17 + random() * 0.66);
            y = H * (0.16 + random() * 0.65);
            tries++;
        } while (tries < 40 && !isAvailable(x, y));

        if (!isAvailable(x, y)) {
            let found = false;
            for (let gy = H * 0.16; gy <= H * 0.81 && !found; gy += 24) {
                for (let gx = W * 0.17; gx <= W * 0.83; gx += 24) {
                    if (!isAvailable(gx, gy)) continue;
                    x = gx; y = gy; found = true; break;
                }
            }
            if (!found) continue;
        }

        landmarks.push({
            type,
            solid: SOLID_LANDMARK_TYPES.includes(type),
            x, y, w, h,
            turn: random() * Math.PI * 2,
            color: colors[Math.floor(random() * colors.length)],
            phase: random() * Math.PI * 2
        });
    }
    return landmarks;
}

function generateFloorTraps(floor, mapSeed, time, W, H, PAD, trapType) {
    const type = trapType || TRAP_TYPES[floor] || 'rune';
    const trapCount = floor >= 10 ? 3 : floor >= 6 ? 4 : 3;
    const traps = [];
    const seed = (mapSeed + floor * 31337) % 2147483647;
    const random = makeRandom(seed);
    let attempts = 0;

    const details = TRAP_DETAILS[type];
    const randomArenaPos = (minX, maxY, padding) => ({
        x: minX + random() * (W - 2 * minX),
        y: minX + random() * (maxY - minX)
    });

    while (traps.length < trapCount && attempts < 60) {
        attempts++;
        const pos = randomArenaPos(PAD + 60, H - PAD - 60, 38);
        const trap = Object.assign({}, pos, details, {
            id: floor + '-' + traps.length,
            type,
            radius: 44 + (floor >= 6 && floor < 10 ? 5 : 0),
            period: 3.8 + random() * 0.8,
            warning: 1.2 + random() * 0.3,
            activeDuration: 1.35 + random() * 0.4,
            phase: 0,
            playerCycle: -1,
            playerNextHit: 0
        });
        trap.phase = (trap.period - (time % trap.period)) % trap.period;
        if (Math.hypot(trap.x - W / 2, trap.y - (H - 70)) < 125) continue;
        if (traps.some(other => Math.hypot(trap.x - other.x, trap.y - other.y) < 110)) continue;
        traps.push(trap);
    }
    return traps;
}

function generateArenaLayout(floor, mapSeed, W, H, arenaStyle) {
    let points = ARENA_LAYOUTS[floor] || ARENA_LAYOUTS[1];
    if (arenaStyle === 'cavern') {
        points = points.map(([x, y]) => [0.5 + (x - 0.5) * 0.68, 0.5 + (y - 0.5) * 0.68]);
    } else if (arenaStyle === 'cross') {
        points = [[.5,.03],[.78,.06],[.97,.30],[.94,.62],[.72,.94],[.42,.97],[.08,.82],[.03,.52],[.06,.22],[.26,.06]];
    } else if (arenaStyle === 'corridor') {
        points = [[.08,.16],[.08,.5],[.08,.84],[.25,.3],[.25,.7],[.75,.3],[.75,.7],[.92,.16],[.92,.5],[.92,.84],[.5,.1],[.5,.9]];
    }

    const seed = (mapSeed + floor * 31337) % 2147483647;
    const random = makeRandom(seed);

    return points.map(([rx, ry]) => ({
        x: rx * W,
        y: ry * H,
        vx: (random() - 0.5) * 20,
        vy: (random() - 0.5) * 20
    }));
}

// ============ 大型秘境世界生成 ============
const DUNGEON_WORLD_W = 2400;
const DUNGEON_WORLD_H = 1600;
const DUNGEON_PAD = 40;

const DUNGEON_LANDMARK_OPTIONS = {
    forest: ['ancient-tree', 'shrine', 'pool'],
    ruins: ['broken-wall', 'sunken-court', 'obelisk', 'statue'],
    bones: ['bone-pit', 'rib-cage', 'bone-pile', 'skull-altar'],
    mine: ['crystal-vein', 'ore-field', 'collapsed-shaft', 'mine-cart'],
    bamboo: ['bamboo-grove', 'stream', 'fallen-log', 'tea-house'],
    lava: ['lava-rift', 'basalt-island', 'ember-crater', 'forge'],
    temple: ['sunken-court', 'obelisk', 'broken-wall', 'altar'],
    ice: ['frozen-pond', 'ice-spines', 'stream', 'ice-cave'],
    altar: ['ritual-ring', 'obelisk', 'basalt-island', 'summoning-circle']
};

const DUNGEON_LANDMARK_COLORS = {
    forest: ['#43654a', '#718255'], ruins: ['#706477', '#8f816f'],
    bones: ['#887c67', '#c1b28d'], mine: ['#398c7a', '#a77f50'],
    bamboo: ['#47704b', '#83a35b'], lava: ['#763e35', '#de6843'],
    temple: ['#85704d', '#baa36c'], ice: ['#5b9fb2', '#b5e2e6'],
    altar: ['#6a467b', '#bc79d5']
};

const DUNGEON_SOLID_LANDMARK_TYPES = ['ancient-tree', 'fallen-log', 'broken-wall', 'obelisk',
    'bone-pit', 'rib-cage', 'bone-pile', 'crystal-vein',
    'collapsed-shaft', 'bamboo-grove', 'basalt-island', 'ice-spines',
    'statue', 'skull-altar', 'mine-cart', 'tea-house', 'forge',
    'ice-cave', 'summoning-circle', 'altar', 'shrine'];

const DUNGEON_TRAP_DETAILS = {
    roots: { name: '缠灵藤', color: '#83d378', damage: 6, damageRatio: 0.06, slow: 1.3 },
    blade: { name: '回风双刃', color: '#d9b16b', damage: 10, damageRatio: 0.1, knockback: 24 },
    sinkhole: { name: '流沙陷环', color: '#c79a65', damage: 11, damageRatio: 0.1, slow: 0.6 },
    bone: { name: '白骨潮汐', color: '#e2d1ae', damage: 11, damageRatio: 0.11, knockback: 18 },
    crystal: { name: '灵晶飞爆', color: '#75e8d2', damage: 9, damageRatio: 0.09 },
    miasma: { name: '腐心瘴云', color: '#91c46d', damage: 7, damageRatio: 0.06, poison: 2.8 },
    fire: { name: '地火喷口', color: '#ff743e', damage: 12, damageRatio: 0.1, burn: 2, burnDamage: 0.022 },
    rune: { name: '镇魂禁攻阵', color: '#d4a0ff', damage: 9, damageRatio: 0.08, attackSlow: 2.5 },
    ice: { name: '寒潭滑裂', color: '#9defff', damage: 8, damageRatio: 0.08, slide: 1.3 },
    altar: { name: '蟒巢聚灵坛', color: '#e692ff', damage: 13, damageRatio: 0.12 }
};

function generateDungeonWorld(dungeon, floor, mapSeed) {
    // 地形装饰（比普通地板更密集）
    const decor = generateWorldDecor(600);

    // 地标（秘境特有建筑/遗迹）
    const landmarks = generateDungeonWorldLandmarks(dungeon, floor, mapSeed, DUNGEON_WORLD_W, DUNGEON_WORLD_H);

    // 陷阱分布（秘境特有陷阱）
    const traps = generateDungeonWorldTraps(dungeon, floor, mapSeed, DUNGEON_WORLD_W, DUNGEON_WORLD_H);

    // 怪物分布（按层数和秘境类型）
    const creatures = generateDungeonWorldCreatures(dungeon, floor, mapSeed, DUNGEON_WORLD_W, DUNGEON_WORLD_H);

    // NPC（秘境内随机遇到的NPC）
    const npcs = generateDungeonWorldNPCs(dungeon, floor, mapSeed, DUNGEON_WORLD_W, DUNGEON_WORLD_H);

    // 入口/出口位置
    const entry = { x: DUNGEON_WORLD_W / 2, y: DUNGEON_WORLD_H - 80 };
    const exit = { x: DUNGEON_WORLD_W / 2, y: 80 };

    return {
        width: DUNGEON_WORLD_W,
        height: DUNGEON_WORLD_H,
        decor,
        landmarks,
        traps,
        creatures,
        npcs,
        entry,
        exit,
        floorTheme: dungeon.floorThemes ? dungeon.floorThemes[Math.min(floor - 1, dungeon.floorThemes.length - 1)] : 'ruins',
        ambient: dungeon.ambient || 'leaves'
    };
}

function generateWorldDecor(count = 600) {
    const random = makeRandom(74291);
    const decor = [];
    for (let i = 0; i < count; i++) {
        decor.push({
            x: 55 + random() * (DUNGEON_WORLD_W - 110),
            y: 55 + random() * (DUNGEON_WORLD_H - 110),
            size: 8 + random() * 17,
            kind: random() > 0.1 ? 'tree' : 'rock'
        });
    }
    return decor;
}

function generateDungeonWorldLandmarks(dungeon, floor, mapSeed, W, H) {
    const seed = (mapSeed + floor * 104729) % 2147483647;
    const random = makeRandom(seed);

    const theme = dungeon.floorThemes ? dungeon.floorThemes[Math.min(floor - 1, dungeon.floorThemes.length - 1)] : 'ruins';
    const options = DUNGEON_LANDMARK_OPTIONS[theme] || DUNGEON_LANDMARK_OPTIONS.ruins;
    const colors = DUNGEON_LANDMARK_COLORS[theme] || DUNGEON_LANDMARK_COLORS.ruins;

    const landmarks = [];
    const kinds = options;
    const count = 4 + Math.floor(random() * 3);

    for (let i = 0; i < count; i++) {
        const type = kinds[Math.floor(random() * kinds.length)];
        const w = 80 + random() * 100;
        const h = 50 + random() * 70;
        const clearance = Math.max(w, h) * 0.6 + 50;

        const entry = { x: W / 2, y: H - 80 };
        const exit = { x: W / 2, y: 80 };

        let x, y, tries = 0;
        const isAvailable = (cx, cy) =>
            Math.hypot(cx - entry.x, cy - entry.y) >= clearance + 60 &&
            Math.hypot(cx - exit.x, cy - exit.y) >= clearance + 60 &&
            landmarks.every(item => Math.hypot(cx - item.x, cy - item.y) >=
                Math.max(item.w, item.h) * 0.6 + clearance);

        do {
            x = W * (0.15 + random() * 0.7);
            y = H * (0.15 + random() * 0.7);
            tries++;
        } while (tries < 50 && !isAvailable(x, y));

        if (!isAvailable(x, y)) continue;

        landmarks.push({
            type,
            solid: DUNGEON_SOLID_LANDMARK_TYPES.includes(type),
            x, y, w, h,
            turn: random() * Math.PI * 2,
            color: colors[Math.floor(random() * colors.length)],
            phase: random() * Math.PI * 2
        });
    }
    return landmarks;
}

function generateDungeonWorldTraps(dungeon, floor, mapSeed, W, H) {
    const trapSequence = dungeon.trapSequence || ['rune'];
    const type = trapSequence[Math.min(floor - 1, trapSequence.length - 1)];
    const trapCount = 6 + Math.floor(floor / 2);
    const traps = [];
    const seed = (mapSeed + floor * 31337) % 2147483647;
    const random = makeRandom(seed);

    const details = DUNGEON_TRAP_DETAILS[type];
    let attempts = 0;

    while (traps.length < trapCount && attempts < 100) {
        attempts++;
        const x = 60 + random() * (W - 120);
        const y = 60 + random() * (H - 120);

        // 避开入口出口
        if (Math.hypot(x - W / 2, y - (H - 80)) < 100) continue;
        if (Math.hypot(x - W / 2, y - 80) < 100) continue;

        // 避开其他陷阱
        if (traps.some(other => Math.hypot(x - other.x, y - other.y) < 90)) continue;

        const trap = Object.assign({}, { x, y }, details, {
            id: `dungeon-${floor}-${traps.length}`,
            type,
            radius: 48,
            period: 4.0 + random() * 1.0,
            warning: 1.3 + random() * 0.4,
            activeDuration: 1.5 + random() * 0.5,
            phase: random() * Math.PI * 2,
            playerCycle: -1,
            playerNextHit: 0
        });
        traps.push(trap);
    }
    return traps;
}

function generateDungeonWorldCreatures(dungeon, floor, mapSeed, W, H) {
    const random = makeRandom(135791 + dungeon.id.length * 817 + floor * 997);
    const pool = dungeon.floorPool[Math.min(floor - 1, dungeon.floorPool.length - 1)] || ['wolf'];
    
    // 模拟 MONSTERS 数据（Worker中无法访问window.MONSTERS）
    const MONSTER_DATA = {
        wolf: { id: 'wolf', name: '灰风狼', img: 'wolf', hp: 30, atk: 8, speed: 2.1, r: 16, draw: 48, vision: 180 },
        bat: { id: 'bat', name: '血翼蝠', img: 'bat', hp: 18, atk: 6, speed: 3.0, r: 12, draw: 36, vision: 200 },
        spider: { id: 'spider', name: '毒玉蛛', img: 'spider', hp: 45, atk: 11, speed: 1.6, r: 18, draw: 52, vision: 220, ranged: true, keepDistance: true, shootRange: 210, shootCd: 3.2, projectileColor: '#a8dc75', poison: 2.2 },
        skeleton: { id: 'skeleton', name: '骷髅弓手', img: 'skeleton', hp: 35, atk: 10, speed: 1.2, r: 16, draw: 48, vision: 240, ranged: true, shootRange: 260, shootCd: 2.2 },
        brute: { id: 'brute', name: '赤甲魈', img: 'brute', hp: 85, atk: 15, speed: 1.15, r: 22, draw: 60, vision: 160 },
        charger: { id: 'charger', name: '裂岩犀', img: 'brute', hp: 92, atk: 17, speed: 1.05, r: 23, draw: 64, vision: 150, charge: true, tint: '#e88a50' },
        shaman: { id: 'shaman', name: '枯木巫祝', img: 'skeleton', hp: 58, atk: 8, speed: 0.85, r: 17, draw: 52, vision: 200, ranged: true, shootRange: 0, shootCd: 4.2, healer: true, tint: '#77d68a' },
        wraith: { id: 'wraith', name: '幽冥游魂', img: 'bat', hp: 48, atk: 13, speed: 1.75, r: 15, draw: 48, vision: 180, blink: true, tint: '#b694ed' },
        slime: { id: 'slime', name: '吞灵软泥', img: 'spider', hp: 72, atk: 10, speed: 0.9, r: 21, draw: 58, vision: 140, splitOnDeath: true, tint: '#66d8c0' },
        slimelet: { id: 'slimelet', name: '软泥幼体', img: 'bat', hp: 18, atk: 5, speed: 2.5, r: 10, draw: 30, vision: 120, tint: '#9be8bd' },
        frostwitch: { id: 'frostwitch', name: '寒魄妖姬', img: 'skeleton', hp: 62, atk: 12, speed: 1.0, r: 17, draw: 54, vision: 230, ranged: true, keepDistance: true, shootRange: 280, shootCd: 2.8, projectileColor: '#8cecff', slow: 1.4, tint: '#8cecff' },
        elite: { id: 'elite', name: '魔将·血煞', img: 'elite', hp: 220, atk: 22, speed: 1.7, r: 26, draw: 72, vision: 250, elite: true },
        boss: { id: 'boss', name: '赤鳞蟒', img: 'boss', hp: 650, atk: 20, speed: 1.35, r: 42, draw: 120, vision: 300, boss: true }
    };

    const validPool = pool.filter(id => MONSTER_DATA[id] && !MONSTER_DATA[id].boss);
    if (validPool.length === 0) validPool.push('wolf');

    const baseCount = dungeon.id === 'qingyun' ? 8 : dungeon.id === 'nether' ? 14 : 10;
    const count = baseCount + Math.floor(floor * 1.2);
    const creatures = [];

    for (let i = 0; i < count; i++) {
        const monsterId = validPool[Math.floor(random() * validPool.length)];
        const monster = MONSTER_DATA[monsterId];
        if (!monster) continue;

        const angle = random() * Math.PI * 2;
        const minDist = 180;
        const maxDist = Math.min(W, H) * 0.4;
        const distance = minDist + random() * (maxDist - minDist);
        const centerX = W / 2;
        const centerY = H / 2;

        let x = centerX + Math.cos(angle) * distance;
        let y = centerY + Math.sin(angle) * distance;

        x = Math.max(60, Math.min(W - 60, x));
        y = Math.max(60, Math.min(H - 60, y));

        const hpMul = dungeon.hpScale * (1 + (floor - 1) * 0.25);
        const atkMul = dungeon.atkScale * (1 + (floor - 1) * 0.12);

        creatures.push({
            id: monster.id,
            name: monster.name,
            img: monster.img,
            x, y,
            homeX: x,
            homeY: y,
            hp: Math.round(monster.hp * hpMul),
            maxHp: Math.round(monster.hp * hpMul),
            atk: Math.round(monster.atk * atkMul),
            speed: monster.speed * (0.9 + random() * 0.2),
            r: monster.r,
            draw: monster.draw,
            tint: monster.tint || '#a9aa83',
            vision: monster.vision || 200,
            phase: random() * Math.PI * 2,
            bob: random() * Math.PI * 2,
            state: 'wander',
            target: null,
            lastSeenPlayer: null,
            ranged: !!monster.ranged,
            keepDistance: !!monster.keepDistance,
            shootRange: monster.shootRange || 0,
            shootCd: monster.shootCd || 2.5,
            shootTimer: random() * 2,
            projectileColor: monster.projectileColor || '#ffb86b',
            healer: !!monster.healer,
            charge: !!monster.charge,
            blink: !!monster.blink,
            elite: !!monster.elite,
            boss: !!monster.boss
        });
    }
    return creatures;
}

function generateDungeonWorldNPCs(dungeon, floor, mapSeed, W, H) {
    // Worker中无法访问window.DUNGEON_NPC_EVENTS，返回空数组
    // 主线程会补充NPC数据
    return [];
}

// 消息处理
self.onmessage = function(e) {
    const { type, payload, requestId } = e.data;

    switch (type) {
        case 'PING': {
            self.postMessage({ type: 'PONG' });
            break;
        }
        case 'GENERATE_FLOOR_SCENERY': {
            const { floor, mapSeed, theme } = payload;
            const scenery = generateFloorScenery(floor, mapSeed, W, H, PAD, theme);
            self.postMessage({ type: 'FLOOR_SCENERY_READY', requestId, floor, scenery });
            break;
        }
        case 'GENERATE_FLOOR_LANDMARKS': {
            const { floor, mapSeed, theme } = payload;
            const landmarks = generateFloorLandmarks(floor, mapSeed, W, H, PAD, theme);
            self.postMessage({ type: 'FLOOR_LANDMARKS_READY', requestId, floor, landmarks });
            break;
        }
        case 'GENERATE_FLOOR_TRAPS': {
            const { floor, mapSeed, time, trapType } = payload;
            const traps = generateFloorTraps(floor, mapSeed, time, W, H, PAD, trapType);
            self.postMessage({ type: 'FLOOR_TRAPS_READY', requestId, floor, traps });
            break;
        }
        case 'GENERATE_ARENA_LAYOUT': {
            const { floor, mapSeed, arenaStyle } = payload;
            const arena = generateArenaLayout(floor, mapSeed, W, H, arenaStyle);
            self.postMessage({ type: 'ARENA_LAYOUT_READY', requestId, floor, arena });
            break;
        }
        case 'GENERATE_FULL_FLOOR': {
            // 一次性生成整层所有数据（旧竞技场模式）
            const { floor, mapSeed, time, theme, trapType, arenaStyle } = payload;
            const scenery = generateFloorScenery(floor, mapSeed, W, H, PAD, theme);
            const landmarks = generateFloorLandmarks(floor, mapSeed, W, H, PAD, theme);
            const traps = generateFloorTraps(floor, mapSeed, time, W, H, PAD, trapType);
            const arena = generateArenaLayout(floor, mapSeed, W, H, arenaStyle);
            self.postMessage({ type: 'FULL_FLOOR_READY', requestId, floor, scenery, landmarks, traps, arena });
            break;
        }
        case 'GENERATE_DUNGEON_WORLD': {
            // 生成大型秘境世界地图
            const { dungeon, floor, mapSeed } = payload;
            const world = generateDungeonWorld(dungeon, floor, mapSeed);
            self.postMessage({ type: 'DUNGEON_WORLD_READY', requestId, floor, world });
            break;
        }
    }
};