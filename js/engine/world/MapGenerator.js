'use strict';

class MapGenerator {
    constructor(seed = 1) {
        this.baseSeed = seed;
    }

    _makeRandom(seed) {
        return () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
    }

    generateWorldDecor(count = 820) {
        const random = this._makeRandom(74291);
        const decor = [];
        for (let i = 0; i < count; i++) {
            decor.push({
                x: 55 + random() * 3490,
                y: 55 + random() * 2290,
                size: 8 + random() * 17,
                kind: random() > 0.1 ? 'tree' : 'rock'
            });
        }
        return decor;
    }

    generateWorldActors(npcs, zone) {
        return npcs
            .filter(npc => (npc.zone || 'overworld') === zone)
            .map((npc, index) => ({
                npc: Object.assign({}, npc),
                x: npc.x,
                y: npc.y,
                phase: index * 2.13,
                roam: 8 + (index % 4) * 3,
                facing: (index % 8) * Math.PI / 4,
                walkT: 0,
                vx: 0,
                vy: 0
            }));
    }

    generateWorldCreatures(monsters, dungeon, zone, position) {
        const random = this._makeRandom(135791 + zone.length * 817);
        const pool = Array.from(new Set(
            dungeon.floorPool
                .slice(0, Math.min(3, dungeon.floorPool.length))
                .flat()
        )).filter(id => !monsters[id]?.boss && id !== 'elite');

        const validPool = pool.length ? pool : ['wolf', 'bat'];
        const creatures = [];
        const count = zone === 'overworld' ? 5 : 9;

        for (let i = 0; i < count; i++) {
            const angle = random() * Math.PI * 2;
            const distance = 180 + random() * (zone === 'overworld' ? 850 : 500);
            const monster = monsters[validPool[Math.floor(random() * validPool.length)]];
            creatures.push({
                id: monster.id,
                img: monster.img,
                name: monster.name,
                x: MathUtils.clamp(position.x + Math.cos(angle) * distance, 80, 3520),
                y: MathUtils.clamp(position.y + Math.sin(angle) * distance, 80, 2320),
                homeX: position.x + Math.cos(angle) * distance,
                homeY: position.y + Math.sin(angle) * distance,
                phase: random() * Math.PI * 2,
                r: monster.r,
                draw: monster.draw,
                tint: monster.tint || '#a9aa83',
                speed: monster.speed,
                bob: random() * Math.PI * 2
            });
        }
        return creatures;
    }

    generateFloorScenery(floor, mapSeed, W, H, PAD, theme) {
        const seed = (mapSeed + floor * 7919 + 104729) % 2147483647;
        const random = this._makeRandom(seed);

        const terrain = theme || (floor === 1 ? 'forest' :
            floor <= 3 ? 'ruins' :
            floor === 4 ? 'bones' :
            floor === 5 ? 'mine' :
            floor === 6 ? 'bamboo' :
            floor === 7 ? 'lava' :
            floor === 8 ? 'temple' :
            floor === 9 ? 'ice' : 'altar');

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

        if (terrain === 'forest' || terrain === 'bamboo') {
            add(terrain === 'forest' ? 'shrub' : 'bamboo', 24, 12, 28,
                terrain === 'forest' ? ['#254e3a', '#396448', '#527044'] : ['#3f704b', '#5d8556', '#2f5e43']);
            add('flower', 34, 2, 5, ['#c7a76a', '#e3c97a', '#8dbf81']);
            add('stone', 22, 5, 13, ['#55534d', '#736c5c', '#494950']);
        } else if (terrain === 'bones') {
            add('bone', 17, 12, 24, ['#c2b99d', '#ddd1ad', '#a69a81']);
            add('bonepile', 11, 17, 29, ['#8d897a', '#a69b83']);
            add('stone', 15, 5, 14, ['#615b57', '#77716a']);
        } else if (terrain === 'mine') {
            add('crystal', 17, 13, 27, ['#62d6bd', '#7df9d0', '#a5e9d1']);
            add('ore', 18, 9, 20, ['#72574d', '#8b694d', '#a88957']);
            add('stone', 17, 5, 14, ['#52464b', '#73605c']);
        } else if (terrain === 'lava') {
            add('basalt', 22, 10, 24, ['#51413d', '#65504a', '#433c43']);
            add('ember', 32, 2, 5, ['#ff803d', '#ffd166', '#e44f35']);
            add('crystal', 9, 11, 22, ['#f27148', '#ffad54']);
        } else if (terrain === 'ice') {
            add('ice', 21, 12, 27, ['#83d9ee', '#c8f5f3', '#7faec9']);
            add('icepool', 12, 20, 40, ['#6db6d0', '#97dfeb']);
            add('stone', 14, 6, 16, ['#687c85', '#718c95']);
        } else if (terrain === 'temple' || terrain === 'altar') {
            add('pillar', terrain === 'altar' ? 12 : 10, 22, 40, ['#897455', '#a18c67', '#6e5b50']);
            add('rune', 20, 5, 12, ['#d2b56f', '#b69ce9', '#79d8c5']);
            add('brazier', terrain === 'altar' ? 8 : 5, 12, 19, ['#ff9c4d', '#ffd166']);
            add('stone', 18, 5, 14, ['#67584c', '#81705c']);
        } else {
            add('rubble', 25, 8, 22, ['#57504e', '#71645c', '#47464c']);
            add('rune', 24, 5, 13, ['#8c77d2', '#6ed9c6', '#b69ce9']);
            add('stone', 20, 5, 14, ['#4f4b51', '#6b6261']);
        }
        return scenery;
    }

    generateFloorLandmarks(floor, mapSeed, W, H, PAD, theme) {
        const seed = (mapSeed + floor * 104729) % 2147483647;
        const random = this._makeRandom(seed);

        const terrain = theme || (floor === 1 ? 'forest' :
            floor <= 3 ? 'ruins' :
            floor === 4 ? 'bones' :
            floor === 5 ? 'mine' :
            floor === 6 ? 'bamboo' :
            floor === 7 ? 'lava' :
            floor === 8 ? 'temple' :
            floor === 9 ? 'ice' : 'altar');

        const options = {
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

        const colors = {
            forest: ['#43654a', '#718255'], ruins: ['#706477', '#8f816f'],
            bones: ['#887c67', '#c1b28d'], mine: ['#398c7a', '#a77f50'],
            bamboo: ['#47704b', '#83a35b'], lava: ['#763e35', '#de6843'],
            temple: ['#85704d', '#baa36c'], ice: ['#5b9fb2', '#b5e2e6'],
            altar: ['#6a467b', '#bc79d5']
        };

        const landmarks = [];
        const kinds = options[terrain] || options.ruins;
        const count = 3 + Math.floor(random() * 2);
        const solidTypes = ['grove', 'fallen-log', 'broken-wall', 'obelisk',
            'bone-pit', 'rib-cage', 'bone-pile', 'crystal-vein',
            'collapsed-shaft', 'bamboo-grove', 'basalt-island', 'ice-spines'];

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
                solid: solidTypes.includes(type),
                x, y, w, h,
                turn: random() * Math.PI * 2,
                color: colors[terrain][Math.floor(random() * colors[terrain].length)],
                phase: random() * Math.PI * 2
            });
        }
        return landmarks;
    }

    generateFloorTraps(floor, mapSeed, time, W, H, PAD, trapType) {
        const trapTypes = {
            1: 'roots', 2: 'blade', 3: 'sinkhole', 4: 'bone', 5: 'crystal',
            6: 'miasma', 7: 'fire', 8: 'rune', 9: 'ice', 10: 'altar'
        };

        const trapDetails = {
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

        const type = trapType || trapTypes[floor] || 'rune';
        const trapCount = floor >= 10 ? 3 : floor >= 6 ? 4 : 3;
        const traps = [];
        const seed = (mapSeed + floor * 31337) % 2147483647;
        const random = this._makeRandom(seed);
        let attempts = 0;

        const randomArenaPos = (minX, maxY, padding) => ({
            x: minX + random() * (W - 2 * minX),
            y: minX + random() * (maxY - minX)
        });

        while (traps.length < trapCount && attempts < 60) {
            attempts++;
            const details = trapDetails[type];
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

    generateArenaLayout(floor, mapSeed, W, H, arenaStyle) {
        const layouts = {
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

        let points = layouts[floor] || layouts[1];
        if (arenaStyle === 'cavern') {
            // 赤炎洞窟：向中心收束，形成狭窄的环形溶洞
            points = points.map(([x, y]) => [0.5 + (x - 0.5) * 0.68, 0.5 + (y - 0.5) * 0.68]);
        } else if (arenaStyle === 'cross') {
            // 寒潭秘境：十字形冰台，四角留出空场
            points = [[.5,.03],[.78,.06],[.97,.30],[.94,.62],[.72,.94],[.42,.97],[.08,.82],[.03,.52],[.06,.22],[.26,.06]];
        } else if (arenaStyle === 'corridor') {
            // 幽冥古墟：狭长走廊 + 两端祭台
            points = [[.08,.16],[.08,.5],[.08,.84],[.25,.3],[.25,.7],[.75,.3],[.75,.7],[.92,.16],[.92,.5],[.92,.84],[.5,.1],[.5,.9]];
        }

        const seed = (mapSeed + floor * 31337) % 2147483647;
        const random = this._makeRandom(seed);

        const arena = points.map(([rx, ry]) => ({
            x: rx * W,
            y: ry * H,
            vx: (random() - 0.5) * 20,
            vy: (random() - 0.5) * 20
        }));

        return arena;
    }
}

window.MapGenerator = MapGenerator;