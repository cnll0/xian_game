'use strict';

require('../data.js');
require('../story.js');

describe('剧情与秘境映射', () => {
    test('剧情节点对应的秘境 id 正确', () => {
        const map = window.getStoryDungeonId;
        expect(map('s2')).toBe('qingyun');
        expect(map('s4')).toBe('ember');
        expect(map('s6')).toBe('ember');
        expect(map('s10')).toBe('nether');
    });

    test('文本与实际秘境/Boss 对齐', () => {
        const byId = id => window.STORIES.find(node => node.id === id);
        expect(byId('s4').desc).toContain('赤炎洞窟');
        expect(byId('s6').desc).toContain('熔岩地龙');
        expect(byId('s7').desc).toContain('地火灵液');
        expect(byId('s10').desc).toContain('镇墓兽');
        expect(byId('s10').desc).not.toContain('君莫邪');
        expect(byId('s11').desc).toContain('幽墟镇墓兽');
    });
});

describe('随机命格与剧情门槛', () => {
    test('rollFate 只会返回合法出身与天赋', () => {
        for (let i = 0; i < 200; i++) {
            const fate = window.rollFate();
            expect(window.ORIGINS.some(o => o.id === fate.origin.id)).toBe(true);
            expect(window.TALENTS.some(t => t.id === fate.talent.id)).toBe(true);
            expect(fate.talent.id).not.toBe('mortal');
        }
    });

    test('剧情门槛引用的出身/天赋都存在', () => {
        const originIds = new Set(window.ORIGINS.map(o => o.id));
        const talentIds = new Set(window.TALENTS.map(t => t.id));
        let fateOptions = 0;
        for (const node of window.STORIES) {
            for (const option of node.options || []) {
                for (const id of option.requiresOrigin || []) {
                    expect(originIds.has(id)).toBe(true);
                }
                for (const id of option.requiresTalent || []) {
                    expect(talentIds.has(id)).toBe(true);
                }
                if (option.requiresOrigin || option.requiresTalent || option.requiresFlag) fateOptions++;
            }
        }
        expect(fateOptions).toBeGreaterThanOrEqual(8);
    });

    test('人形敌手有人形标记与角色帧', () => {
        const humans = Object.values(window.MONSTERS).filter(m => m.human);
        expect(humans.length).toBeGreaterThanOrEqual(4);
        for (const human of humans) {
            expect(human.art).toBeTruthy();
            expect(window.CHARACTER_ART[human.art]).toBeDefined();
        }
    });
});
