'use strict';

require('../engine/world/MapGenerator.js');
require('../engine/systems/CombatSystem.js');

describe('CombatSystem 障碍物碰撞', () => {
    function createCombat() {
        const gameState = new window.GameState();
        const dungeon = window.DUNGEONS[0];
        gameState.runtime.dungeon = dungeon;
        gameState.runtime.dungeonId = dungeon.id;
        gameState.runtime.floor = 1;
        gameState.runtime.floorCount = 10;
        gameState.runtime.skirmish = false;
        gameState.runtime.mapSeed = 12345;
        gameState.runtime.state = 'dungeon_world';
        gameState.runtime.dungeonWorldMode = true;
        gameState.runtime.dungeonWorld = {
            width: 2400,
            height: 1600,
            entry: { x: 1200, y: 1520 },
            exit: { x: 1200, y: 80 }
        };
        gameState.runtime.landmarks = [{
            type: 'broken-wall', solid: true,
            x: 1200, y: 800, w: 200, h: 80, turn: 0,
            color: '#888', phase: 0
        }];
        gameState.runtime.player = {
            x: 1200, y: 700, r: 16, hp: 100, maxHp: 100,
            shield: 0, invuln: 0, facing: 0, atkCd: 0, swinging: 0,
            walkT: 0, vx: 0, vy: 0, slideTime: 0,
            dashCd: 0, dashTime: 0, dashVx: 0, dashVy: 0,
            mods: { speed: 0, dashStrike: false }
        };
        const combat = new window.CombatSystem(
            gameState,
            new window.MapGenerator(),
            new window.EventBus(),
            {},
            null
        );
        combat._resetObstacles();
        return { combat, gameState };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        window.gameInput = undefined;
    });

    test('solid 地标挡住玩家，且玩家可以贴墙横移', () => {
        const { combat, gameState } = createCombat();
        const obstacles = combat._obstacles();
        const startX = gameState.runtime.player.x;

        // 从墙上方往下撞：最终停在墙面外
        window.gameInput = { movement: { x: 0, y: 1, length: 1 }, mouse: { x: 1200, y: 900 } };
        for (let i = 0; i < 150; i++) combat._updatePlayerMovement(1 / 60);

        const p = gameState.runtime.player;
        expect(p.y).toBeLessThan(760); // 墙顶 760，玩家半径 16
        expect(window.Collision.hits(p.x, p.y, p.r, obstacles)).toBe(false);

        // 斜着撞：X 方向仍然能滑动
        window.gameInput = { movement: { x: 1, y: 1, length: 0.707 }, mouse: { x: 1400, y: 900 } };
        for (let i = 0; i < 30; i++) combat._updatePlayerMovement(1 / 60);
        expect(p.x).toBeGreaterThan(startX);

        // 冲刺也不能穿墙
        p.dashTime = 0.15;
        p.dashVx = 0;
        p.dashVy = 600;
        window.gameInput = { movement: { x: 0, y: 0, length: 0 }, mouse: { x: p.x, y: p.y + 10 } };
        for (let i = 0; i < 20; i++) combat._updatePlayerMovement(1 / 60);
        expect(window.Collision.hits(p.x, p.y, p.r, obstacles)).toBe(false);
        expect(p.y).toBeLessThan(760);
    });

    test('妖兽追击时不会穿过 solid 地标', () => {
        const { combat, gameState } = createCombat();
        const obstacles = combat._obstacles();
        // 玩家在墙下，妖兽在墙上：追击时会绕行，但任何一帧都不能陷进墙里
        gameState.runtime.player.x = 1200;
        gameState.runtime.player.y = 900;
        const monster = {
            x: 1200, y: 700, r: 16, hp: 40, maxHp: 40, atk: 8, speed: 2,
            state: 'chase', canSeePlayer: true, vision: 900,
            homeX: 1200, homeY: 700, atkCd: 0, stunCd: 0, shootTimer: 0,
            ranged: false, keepDistance: false, wanderTimer: 0,
            facing: 0, flash: 0, trapCycles: {}
        };
        gameState.runtime.monsters = [monster];

        for (let i = 0; i < 240; i++) {
            combat._updateMonstersDungeonWorld(1 / 60);
            expect(window.Collision.hits(monster.x, monster.y, monster.r, obstacles)).toBe(false);
        }
        // 确实动过（不是被冻住）
        expect(Math.hypot(monster.x - 1200, monster.y - 700)).toBeGreaterThan(1);
    });

    test('击退/出生重叠会被推出障碍物', () => {
        const { combat, gameState } = createCombat();
        const obstacles = combat._obstacles();
        const monster = { x: 1200, y: 800, r: 16 };
        gameState.runtime.monsters = [monster];

        combat._pushActor(monster, 0, 0);

        expect(window.Collision.hits(monster.x, monster.y, monster.r, obstacles)).toBe(false);
    });
});
