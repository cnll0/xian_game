'use strict';

require('../engine/world/MapGenerator.js');
require('../engine/systems/CombatSystem.js');

describe('CombatSystem 秘境 NPC', () => {
    function createCombat() {
        const gameState = new window.GameState();
        const dungeon = window.DUNGEONS[0];
        gameState.runtime.dungeon = dungeon;
        gameState.runtime.dungeonId = dungeon.id;
        gameState.runtime.floor = 3;
        gameState.runtime.floorCount = 10;
        gameState.runtime.skirmish = false;
        gameState.runtime.mapSeed = 12345;

        const mapGenerator = new window.MapGenerator();
        const combat = new window.CombatSystem(
            gameState,
            mapGenerator,
            new window.EventBus(),
            {},
            null
        );
        return { combat, gameState, mapGenerator, dungeon };
    }

    function createWorld(mapGenerator, dungeon) {
        const world = mapGenerator.generateDungeonWorld(dungeon, 3, 12345);
        // 模拟 Worker：Worker 内拿不到主线程的 NPC 数据，npcs 为空
        world.npcs = [];
        return world;
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Worker 返回空 npcs 时由主线程补全，且 NPC id 有效', () => {
        const { combat, gameState, mapGenerator, dungeon } = createCombat();
        gameState.runtime.dungeonWorld = createWorld(mapGenerator, dungeon);

        combat._finishSpawnDungeonWorld();

        const floorNpc = gameState.runtime.floorNpc;
        expect(floorNpc).toBeTruthy();
        expect(floorNpc.npc).toBeTruthy();
        expect(floorNpc.npc.id).toBe('ningxiao');
        expect(floorNpc.npc.name).toBeTruthy();
        expect(floorNpc.npc.dungeonEncounter).toBe(true);
        expect(floorNpc.used).toBe(false);
    });

    test('兼容只有 npcId 的旧版遭遇数据，不再产生 undefined 立绘 id', () => {
        const { combat, gameState, mapGenerator, dungeon } = createCombat();
        const world = createWorld(mapGenerator, dungeon);
        world.npcs = [{
            floor: 3,
            npcId: 'ningxiao',
            title: '迷路弟子',
            line: '道友救命！',
            choices: [],
            x: 480,
            y: 260,
            phase: 0
        }];
        gameState.runtime.dungeonWorld = world;

        combat._finishSpawnDungeonWorld();

        expect(gameState.runtime.floorNpc).toBeTruthy();
        expect(gameState.runtime.floorNpc.npc.id).toBe('ningxiao');
        expect(gameState.runtime.floorNpc.x).toBe(480);
    });

    test('NPC 消失后清理 nearbyDungeonNpc，避免按 E 重复触发', () => {
        const { combat, gameState } = createCombat();
        gameState.runtime.floorNpc = null;
        gameState.runtime.nearbyDungeonNpc = { used: false, npc: { id: 'ningxiao' } };

        combat._updateFloorNpc();

        expect(gameState.runtime.nearbyDungeonNpc).toBeNull();
    });

    test('tryInteractDungeonWorld 只接受当前楼层 NPC，并在对话失败时恢复状态', () => {
        const { combat, gameState } = createCombat();
        const floorNpc = { used: false, npc: { id: 'ningxiao' } };
        gameState.runtime.floorNpc = floorNpc;
        gameState.runtime.nearbyDungeonNpc = floorNpc;

        expect(combat.tryInteractDungeonWorld()).toBe(true);
        expect(floorNpc.used).toBe(true);
        expect(window.onDungeonNpcNearby).toHaveBeenCalledWith(floorNpc.npc);

        floorNpc.used = false;
        window.onDungeonNpcNearby.mockImplementationOnce(() => {
            throw new Error('dialogue failed');
        });
        expect(combat.tryInteractDungeonWorld()).toBe(false);
        expect(floorNpc.used).toBe(false);

        gameState.runtime.floorNpc = null;
        expect(combat.tryInteractDungeonWorld()).toBe(false);
    });

    test('玩家站着不动时，近战怪物会贴上来并造成伤害', () => {
        const { combat, gameState } = createCombat();
        gameState.runtime.dungeonWorld = { width: 2400, height: 1600, exit: { x: 1200, y: 80 } };
        gameState.runtime.player = {
            x: 1200, y: 800, r: 16, hp: 100, maxHp: 100,
            shield: 0, invuln: 0, facing: 0,
            mods: { dodge: 0, shieldCd: 0, thorns: 0, curseLastStand: false }
        };
        // 距离 60px：旧逻辑会在 +20 的 chase 阈值处切 attack，但攻击判定只有 +10，
        // 于是怪物站在攻击距离外不动，玩家不动就永远不掉血。
        const monster = {
            x: 1260, y: 800, r: 16, hp: 40, maxHp: 40, atk: 8, speed: 2,
            state: 'wander', canSeePlayer: true, vision: 200,
            homeX: 1260, homeY: 800, atkCd: 0, stunCd: 0, shootTimer: 0,
            ranged: false, keepDistance: false, wanderTimer: 0
        };
        gameState.runtime.monsters = [monster];

        for (let i = 0; i < 180; i++) combat._updateMonstersDungeonWorld(1 / 60);

        expect(monster.state).toBe('attack');
        expect(gameState.runtime.player.hp).toBeLessThan(100);
    });
});
