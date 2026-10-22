'use strict';

require('../engine/utils/MathUtils.js');
require('../engine/render/AttackFx.js');
require('../engine/systems/CombatSystem.js');

/** data.js 里的全部实体 id：新增怪物必须同步补样式，否则这里会失败 */
const ENTITY_IDS = [
    'player',
    'wolf', 'bat', 'spider', 'skeleton', 'brute', 'charger', 'shaman', 'wraith',
    'slime', 'slimelet', 'frostwitch', 'elite', 'boss', 'qingyunBoss', 'emberBoss',
    'frostBoss', 'netherBoss',
    'bandit', 'cultist', 'ronin', 'fire_cultist', 'demon_spy', 'shadow_assassin',
    'ice_sword', 'frost_guardian', 'sword_master', 'guardian', 'soul_reaper'
];

function fakeCtx() {
    const gradient = { addColorStop: jest.fn() };
    return {
        canvas: { width: 960, height: 540 },
        save: jest.fn(), restore: jest.fn(), translate: jest.fn(), rotate: jest.fn(),
        beginPath: jest.fn(), closePath: jest.fn(), arc: jest.fn(), ellipse: jest.fn(),
        clip: jest.fn(),
        moveTo: jest.fn(), lineTo: jest.fn(), quadraticCurveTo: jest.fn(), bezierCurveTo: jest.fn(),
        fill: jest.fn(), stroke: jest.fn(), fillRect: jest.fn(), clearRect: jest.fn(),
        setLineDash: jest.fn(),
        createRadialGradient: jest.fn(() => gradient),
        createLinearGradient: jest.fn(() => gradient),
        fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
        globalCompositeOperation: 'source-over', lineCap: 'butt', lineJoin: 'miter'
    };
}

describe('AttackFx 每个实体独立攻击特效', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('玩家与每一种怪物都有独立样式，且互不重复', () => {
        const AttackFx = window.AttackFx;
        expect(AttackFx).toBeTruthy();
        const signatures = new Map();
        for (const id of ENTITY_IDS) {
            const style = AttackFx.styles()[id];
            expect(style).toBeTruthy();
            expect(style.label).toBeTruthy();
            const sig = [style.kind, style.c1, style.c2, style.arc, style.blades, style.sweep, style.spark].join('|');
            expect(signatures.has(sig)).toBe(false);
            signatures.set(sig, id);
        }
        expect(signatures.size).toBe(ENTITY_IDS.length);
    });

    test('未知实体用 id 哈希生成稳定且唯一的兜底样式', () => {
        const AttackFx = window.AttackFx;
        const a = AttackFx.styleFor('new_monster_a');
        const b = AttackFx.styleFor('new_monster_b');
        expect(a.kind).toBeTruthy();
        expect(a.c2).toBeTruthy();
        expect([a.kind, a.c2, a.arc, a.blades].join('|'))
            .not.toBe([b.kind, b.c2, b.arc, b.blades].join('|'));
        expect(AttackFx.styleFor('new_monster_a').label).toBe(a.label);
    });

    test('决斗对手 duel_<npcId> 映射到对应人形敌手样式', () => {
        const AttackFx = window.AttackFx;
        expect(AttackFx.keyFor({ id: 'duel_guqinghan' })).toBe('ice_sword');
        expect(AttackFx.styleFor('duel_guqinghan').kind).toBe('frost');
        expect(AttackFx.keyFor('duel_zhaotieyi')).toBe('sword_master');
        // 未登记的 NPC 用 npcId 生成独立兜底样式，不会退回共用贴图
        expect(AttackFx.keyFor('duel_some_new_npc')).toBe('some_new_npc');
        expect(AttackFx.styleFor('duel_some_new_npc').label).toBeTruthy();
    });

    test('玩家样式随剑诀/元素/进化变化颜色，但几何只有一份', () => {
        const AttackFx = window.AttackFx;
        const base = AttackFx.playerStyle({});
        const fire = AttackFx.playerStyle({ elemFire: true });
        const ice = AttackFx.playerStyle({ elemIce: true });
        const evo = AttackFx.playerStyle({ evoBlade: true });
        expect(base.kind).toBe('blade');
        expect(fire.c2).not.toBe(base.c2);
        expect(ice.c2).not.toBe(base.c2);
        expect(evo.c2).not.toBe(base.c2);
        // 判定的扇形宽度只由 style.arc 决定，不随颜色变化
        expect(AttackFx.geometry(AttackFx.makeEffect({
            fx: 'player', x: 0, y: 0, angle: 0, reach: 46, arcHalf: base.arc
        })).arcHalf).toBeCloseTo(base.arc, 5);
    });

    test('判定扇形与特效几何同源：正面命中、背后/超距/内圈不命中', () => {
        const AttackFx = window.AttackFx;
        const effect = AttackFx.makeEffect({
            fx: 'player', x: 100, y: 100, angle: 0, reach: 100, arcHalf: 0.5, innerR: 20
        });
        const geo = AttackFx.geometry(effect);
        expect(geo).toMatchObject({ x: 100, y: 100, a: 0, outer: 100, inner: 20 });
        expect(geo.arcHalf).toBeCloseTo(0.5, 5);

        expect(AttackFx.inSector(effect, 180, 100, 0)).toBe(true);   // 正前方
        expect(AttackFx.inSector(effect, 100, 190, 0)).toBe(false);  // 正侧方（90°）
        expect(AttackFx.inSector(effect, 20, 100, 0)).toBe(false);   // 背后
        expect(AttackFx.inSector(effect, 260, 100, 0)).toBe(false);  // 超出射程
        expect(AttackFx.inSector(effect, 108, 100, 0)).toBe(false);  // 内圈空心处
        // 目标半径带来的边缘容差：贴边怪按贴图重叠算命中
        expect(AttackFx.inSector(effect, 180, 170, 30)).toBe(true);
    });

    test('每个实体不只是换色：攻击形状至少覆盖 6 种，距离也拉开档次', () => {
        const AttackFx = window.AttackFx;
        const shapes = new Set(ENTITY_IDS.map(id => AttackFx.styles()[id].shape));
        expect(shapes.size).toBeGreaterThanOrEqual(6);
        expect(AttackFx.styles().skeleton.shape).toBe('thrust');
        expect(AttackFx.styles().brute.shape).toBe('ring');
        expect(AttackFx.styles().charger.shape).toBe('ring');
        expect(AttackFx.styles().elite.shape).toBe('cross');
        expect(AttackFx.styles().sword_master.shape).toBe('lobes');
        expect(AttackFx.styles().wolf.shape).toBe('claw');
        expect(AttackFx.styles().bat.shape).toBe('fan');

        const wolfReach = AttackFx.reachForMonster({ id: 'wolf', r: 16 }, 16);
        const bossReach = AttackFx.reachForMonster({ id: 'boss', r: 42 }, 16);
        const slimeletReach = AttackFx.reachForMonster({ id: 'slimelet', r: 10 }, 16);
        // 龙噬范围要明显大于狼爪，幼体最小
        expect(bossReach).toBeGreaterThan(wolfReach * 1.8);
        expect(wolfReach).toBeGreaterThan(slimeletReach);
    });

    test('突刺形状：只命中细长的刺线，侧后方不命中', () => {
        const AttackFx = window.AttackFx;
        const effect = AttackFx.makeEffect({ fx: 'ronin', x: 0, y: 0, angle: 0, reach: 100 });
        expect(AttackFx.shapeOf(effect).type).toBe('thrust');
        expect(AttackFx.inSector(effect, 90, 0, 0)).toBe(true);
        expect(AttackFx.inSector(effect, 90, 4, 0)).toBe(true);   // 半个宽度内
        expect(AttackFx.inSector(effect, 90, 40, 0)).toBe(false); // 偏离刺线
        expect(AttackFx.inSector(effect, 0, 90, 0)).toBe(false);
        expect(AttackFx.inSector(effect, -60, 0, 0)).toBe(false);
    });

    test('环形冲击：360° 都能命中，环心与超距不命中', () => {
        const AttackFx = window.AttackFx;
        const effect = AttackFx.makeEffect({ fx: 'charger', x: 0, y: 0, angle: 0, reach: 80 });
        expect(AttackFx.shapeOf(effect).type).toBe('ring');
        expect(AttackFx.inSector(effect, 75, 0, 0)).toBe(true);
        expect(AttackFx.inSector(effect, 0, 75, 0)).toBe(true);
        expect(AttackFx.inSector(effect, -75, 0, 0)).toBe(true);
        expect(AttackFx.inSector(effect, 0, 0, 0)).toBe(false);  // 环心是空的
        expect(AttackFx.inSector(effect, 130, 0, 0)).toBe(false);
    });

    test('三道爪痕：每条爪痕命中，爪痕之间不命中', () => {
        const AttackFx = window.AttackFx;
        const effect = AttackFx.makeEffect({ fx: 'wolf', x: 0, y: 0, angle: 0, reach: 60 });
        const spread = AttackFx.styles().wolf.laneSpread;
        const gapAngle = spread / 2;
        const r = 50;
        expect(AttackFx.inSector(effect, r, 0, 0)).toBe(true);
        expect(AttackFx.inSector(effect, Math.cos(spread) * r, Math.sin(spread) * r, 0)).toBe(true);
        expect(AttackFx.inSector(effect, Math.cos(gapAngle) * r, Math.sin(gapAngle) * r, 0)).toBe(false);
    });

    test('交叉斩 / 五道剑意：只在各自刀光范围内命中', () => {
        const AttackFx = window.AttackFx;
        const cross = AttackFx.makeEffect({ fx: 'shadow_assassin', x: 0, y: 0, angle: 0, reach: 80 });
        expect(AttackFx.shapeOf(cross).type).toBe('cross');
        expect(AttackFx.inSector(cross, 70, 0, 0)).toBe(true);   // 交叉点/正中
        expect(AttackFx.inSector(cross, 50, 40, 0)).toBe(true);  // 扇形范围内
        expect(AttackFx.inSector(cross, 0, 70, 0)).toBe(false);  // 正侧方
        expect(AttackFx.inSector(cross, -70, 0, 0)).toBe(false); // 背后

        const lobes = AttackFx.makeEffect({ fx: 'sword_master', x: 0, y: 0, angle: 0, reach: 80 });
        const step = AttackFx.styles().sword_master.laneSpread;
        expect(AttackFx.inSector(lobes, 70, 0, 0)).toBe(true);  // 中间一道剑意
        expect(AttackFx.inSector(lobes, Math.cos(step / 2) * 70, Math.sin(step / 2) * 70, 0)).toBe(false);
    });

    test('每种特效都能画完整个生命周期而不报错', () => {
        const AttackFx = window.AttackFx;
        for (const id of ENTITY_IDS) {
            for (const prog of [0, 0.35, 0.8, 0.99]) {
                const ctx = fakeCtx();
                const effect = AttackFx.makeEffect({
                    fx: id, x: 100, y: 100, angle: 0.7, reach: 90, monster: id !== 'player'
                });
                effect.t = effect.life * prog;
                expect(() => AttackFx.draw(ctx, effect)).not.toThrow();
                expect(ctx.save).toHaveBeenCalled();
            }
        }
    });

    test('远程弹体按实体区分造型且不报错', () => {
        const AttackFx = window.AttackFx;
        for (const id of ['skeleton', 'spider', 'frostwitch', 'boss', 'netherBoss']) {
            const style = AttackFx.styleFor(id);
            const ctx = fakeCtx();
            expect(() => AttackFx.drawProjectile(ctx, {
                x: 10, y: 10, vx: 100, vy: 0, r: 6, fx: id, proj: style.proj
            })).not.toThrow();
        }
    });
});

describe('CombatSystem 攻击跟随鼠标、判定与特效一致', () => {
    function makeCombat(extra) {
        const combat = Object.create(window.CombatSystem.prototype);
        combat.state = Object.assign({
            player: {
                x: 400, y: 300, r: 16, hp: 100, maxHp: 100, facing: 0,
                atkCd: 0, swinging: 0, invuln: 0, walkT: 0,
                mods: { atk: 0, crit: 0, range: 0, dodge: 0, thorns: 0 }
            },
            monsters: [],
            bullets: [],
            effects: [],
            texts: [],
            time: 0,
            dungeonWorldMode: false,
            dungeonWorld: null,
            dungeonMods: null,
            state: 'playing'
        }, extra || {});
        combat.constants = { W: 960, H: 540, PAD: 24 };
        combat.damageMonster = jest.fn();
        combat.hurtPlayer = jest.fn();
        return combat;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        window.gameInput = { mouse: { x: 400, y: 300, down: false } };
    });

    test('鼠标方向决定朝向；射程随鼠标距离变化并夹在攻击范围内', () => {
        const combat = makeCombat();
        window.gameInput.mouse = { x: 460, y: 300, down: false };
        const aim = combat._aimAtMouse(46);
        expect(aim.angle).toBeCloseTo(0, 5);
        expect(aim.reach).toBeCloseTo(46, 5);

        window.gameInput.mouse = { x: 430, y: 300, down: false };
        const near = combat._aimAtMouse(46);
        expect(near.reach).toBeCloseTo(42, 5); // 鼠标更近：刀光只扫到鼠标，不再固定打满射程

        window.gameInput.mouse = { x: 400, y: 300, down: false };
        const center = combat._aimAtMouse(46);
        expect(center.angle).toBeCloseTo(0, 5);
        expect(center.reach).toBe(46);
    });

    test('秘境世界里鼠标坐标要减去相机偏移', () => {
        const combat = makeCombat({
            dungeonWorldMode: true,
            dungeonWorld: { width: 2400, height: 1600 }
        });
        // 玩家在 (1200, 800) 时相机应停在 (720, 530)
        combat.state.player.x = 1200;
        combat.state.player.y = 800;
        window.gameInput.mouse = { x: 480, y: 270, down: false };
        const world = combat._mouseWorld();
        expect(world.x).toBeCloseTo(1200, 5);
        expect(world.y).toBeCloseTo(800, 5);
    });

    test('玩家挥剑只命中刀光扇形内的怪，背后的怪不掉血', () => {
        const combat = makeCombat();
        const front = { x: 440, y: 300, r: 16, hp: 30, maxHp: 30 };
        const behind = { x: 360, y: 300, r: 16, hp: 30, maxHp: 30 };
        const side = { x: 400, y: 380, r: 16, hp: 30, maxHp: 30 };
        combat.state.monsters = [front, behind, side];
        window.gameInput.mouse = { x: 440, y: 300, down: false };

        combat.tryAttack();
        const slash = combat.state.effects.find(e => e.type === 'slash');
        expect(slash).toBeTruthy();
        expect(slash.fx).toBe('player');
        // 子弹与特效的几何完全一致
        const bullet = combat.state.bullets[0];
        expect(bullet.arcHalf).toBe(slash.arcHalf);
        expect(bullet.range).toBe(slash.r);
        expect(bullet.innerR).toBe(slash.innerR);

        combat._updateBullets(1 / 60);
        const hitTargets = combat.damageMonster.mock.calls.map(c => c[0]);
        expect(hitTargets).toContain(front);
        expect(hitTargets).not.toContain(behind);
        expect(hitTargets).not.toContain(side);
    });

    test('怪物近战特效与掉血判定同源：玩家在扇形内才受伤', () => {
        const combat = makeCombat();
        const monster = {
            id: 'boss', x: 400, y: 300, r: 40, atk: 10, facing: 0,
            hp: 100, maxHp: 100, human: false
        };
        const player = combat.state.player;
        player.x = 400;
        player.y = 300;
        monster.x = 400 - 70;
        combat._monsterAttack(monster, player);
        expect(combat.state.effects.some(e => e.type === 'slash' && e.fx === 'boss')).toBe(true);
        expect(combat.hurtPlayer).toHaveBeenCalledTimes(1);

        // 把玩家挪到特效范围之外（背后），同样的攻击不应再掉血
        combat.hurtPlayer.mockClear();
        player.x = monster.x - 400;
        player.y = monster.y;
        combat._monsterAttack(monster, player);
        expect(combat.hurtPlayer).not.toHaveBeenCalled();
    });

    test('怪物出手距离按形状/体型区分，并直接作为特效半径', () => {
        const combat = makeCombat();
        const bossRange = combat._monsterMeleeRange({ id: 'boss', r: 42 }, combat.state.player);
        const wolfRange = combat._monsterMeleeRange({ id: 'wolf', r: 16 }, combat.state.player);
        const slimeletRange = combat._monsterMeleeRange({ id: 'slimelet', r: 10 }, combat.state.player);
        expect(bossRange).toBeGreaterThan(wolfRange * 1.8);
        expect(wolfRange).toBeGreaterThan(slimeletRange);

        const effect = window.AttackFx.makeEffect({
            fx: 'boss', x: 0, y: 0, angle: 0, reach: bossRange, monster: true
        });
        expect(window.AttackFx.shapeOf(effect).reach).toBeCloseTo(bossRange, 5);
    });
});
