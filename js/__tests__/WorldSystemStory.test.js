'use strict';

require('../engine/world/MapGenerator.js');
require('../engine/world/WorldSystem.js');

describe('WorldSystem 剧情交互优先级', () => {
    beforeEach(() => {
        window.STORY_LOCATIONS = {
            s0: { x: 360, y: 1840, name: '青云山下·村庄', kind: 'village' },
            s1: { x: 610, y: 1610, name: '村口老槐树', kind: 'tree' }
        };
        window.STORIES = [
            { id: 's0', title: '山雨欲来', options: [] },
            { id: 's1', title: '老槐树下的老人', options: [] }
        ];
        window.G.story.node = 's1';
    });

    function createSystem(player, actors, creatures) {
        const gameState = new window.GameState();
        gameState.runtime.state = 'world';
        gameState.runtime.world.player = player;
        gameState.runtime.world.actors = actors;
        gameState.runtime.world.creatures = creatures;
        return new window.WorldSystem(gameState, new window.MapGenerator(), new window.EventBus());
    }

    test('站在剧情点上时，旁边的 NPC / 妖兽不会挡住主线', () => {
        const system = createSystem(
            { x: 610, y: 1610 },
            [{ x: 520, y: 1650, npc: { id: 'ningxiao', name: '宁小雨' } }],
            [{ x: 640, y: 1620, name: '灰风狼' }]
        );

        system._checkInteractions();

        expect(system.state.nearbyStory).toBeTruthy();
        expect(system.state.nearbyStory.id).toBe('s1');
        expect(system.state.nearbyNpc).toBeNull();
        expect(system.state.nearbyCreature).toBeNull();
        expect(system.getStoryTarget().distance).toBe(0);
    });

    test('离开剧情点后 NPC 恢复可交互', () => {
        const system = createSystem(
            { x: 100, y: 100 },
            [{ x: 160, y: 100, npc: { id: 'ningxiao', name: '宁小雨' } }],
            []
        );

        system._checkInteractions();

        expect(system.state.nearbyStory).toBeNull();
        expect(system.state.nearbyNpc).toBeTruthy();
        expect(system.state.nearbyNpc.id).toBe('ningxiao');
    });

    test('范围内优先最近目标：NPC 更近时先和 NPC 交互', () => {
        const system = createSystem(
            { x: 650, y: 1610 },
            [{ x: 640, y: 1610, npc: { id: 'ningxiao', name: '宁小雨' } }],
            []
        );

        system._checkInteractions();

        expect(system.state.interaction).toBeTruthy();
        expect(system.state.interaction.type).toBe('npc');
        expect(system.state.nearbyNpc.id).toBe('ningxiao');
        expect(system.state.nearbyStory).toBeNull();
    });

    test('tryInteract 优先返回剧情', () => {
        const system = createSystem(
            { x: 610, y: 1610 },
            [{ x: 610, y: 1650, npc: { id: 'ningxiao', name: '宁小雨' } }],
            []
        );
        system._checkInteractions();
        expect(system.tryInteract()).toBe(true);
        expect(window.onWorldStoryNearby).toHaveBeenCalled();
    });

    test('站在非当前剧情点：显示“此处暂无剧情”并指回当前目标', () => {
        window.G.story.node = 's0';
        const system = createSystem(
            { x: 610, y: 1610 },
            [],
            []
        );

        system._checkInteractions();

        expect(system.state.interaction).toBeNull();
        expect(system.state.storyMismatch).toBeTruthy();
        expect(system.state.storyMismatch.id).toBe('s1');
        expect(system.tryInteract()).toBe(true);
        expect(window.toast).toHaveBeenCalledWith(
            expect.stringContaining('当前剧情在「青云山下·村庄」'), 'gold');
    });
});
