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
function generateFloorScenery(floor, mapSeed, W, H, PAD) {
    const seed = (mapSeed + floor * 7919 + 104729) % 2147483647;
    const random = makeRandom(seed);

    const terrain = floor === 1 ? 'forest' :
        floor <= 3 ? 'ruins' :
        floor === 4 ? 'bones' :
        floor === 5 ? 'mine' :
        floor === 6 ? 'bamboo' :
        floor === 7 ? 'lava' :
        floor === 8 ? 'temple' :
        floor === 9 ? 'ice' : 'altar';

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

function generateFloorLandmarks(floor, mapSeed, W, H, PAD) {
    const seed = (mapSeed + floor * 104729) % 2147483647;
    const random = makeRandom(seed);

    const terrain = floor === 1 ? 'forest' :
        floor <= 3 ? 'ruins' :
        floor === 4 ? 'bones' :
        floor === 5 ? 'mine' :
        floor === 6 ? 'bamboo' :
        floor === 7 ? 'lava' :
        floor === 8 ? 'temple' :
        floor === 9 ? 'ice' : 'altar';

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

function generateFloorTraps(floor, mapSeed, time, W, H, PAD) {
    const type = TRAP_TYPES[floor] || 'rune';
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

function generateArenaLayout(floor, mapSeed, W, H) {
    const base = ARENA_LAYOUTS[floor] || ARENA_LAYOUTS[1];
    const seed = (mapSeed + floor * 31337) % 2147483647;
    const random = makeRandom(seed);

    return base.map(([rx, ry]) => ({
        x: rx * W,
        y: ry * H,
        vx: (random() - 0.5) * 20,
        vy: (random() - 0.5) * 20
    }));
}

// 消息处理
self.onmessage = function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'GENERATE_FLOOR_SCENERY': {
            const { floor, mapSeed } = payload;
            const scenery = generateFloorScenery(floor, mapSeed, W, H, PAD);
            self.postMessage({ type: 'FLOOR_SCENERY_READY', floor, scenery });
            break;
        }
        case 'GENERATE_FLOOR_LANDMARKS': {
            const { floor, mapSeed } = payload;
            const landmarks = generateFloorLandmarks(floor, mapSeed, W, H, PAD);
            self.postMessage({ type: 'FLOOR_LANDMARKS_READY', floor, landmarks });
            break;
        }
        case 'GENERATE_FLOOR_TRAPS': {
            const { floor, mapSeed, time } = payload;
            const traps = generateFloorTraps(floor, mapSeed, time, W, H, PAD);
            self.postMessage({ type: 'FLOOR_TRAPS_READY', floor, traps });
            break;
        }
        case 'GENERATE_ARENA_LAYOUT': {
            const { floor, mapSeed } = payload;
            const arena = generateArenaLayout(floor, mapSeed, W, H);
            self.postMessage({ type: 'ARENA_LAYOUT_READY', floor, arena });
            break;
        }
        case 'GENERATE_FULL_FLOOR': {
            // 一次性生成整层所有数据
            const { floor, mapSeed, time } = payload;
            const scenery = generateFloorScenery(floor, mapSeed, W, H, PAD);
            const landmarks = generateFloorLandmarks(floor, mapSeed, W, H, PAD);
            const traps = generateFloorTraps(floor, mapSeed, time, W, H, PAD);
            const arena = generateArenaLayout(floor, mapSeed, W, H);
            self.postMessage({ type: 'FULL_FLOOR_READY', floor, scenery, landmarks, traps, arena });
            break;
        }
    }
};