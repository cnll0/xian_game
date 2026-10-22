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
