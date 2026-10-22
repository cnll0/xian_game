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
});
