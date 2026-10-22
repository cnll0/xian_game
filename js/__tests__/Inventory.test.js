'use strict';

require('../inventory.js');

describe('背包 / 灵石 / 宗门', () => {
    beforeEach(() => {
        window.ITEMS = [
            { id: 'pill_hp', name: '回春丹', type: 'consumable', rarity: 'common', icon: 'pill-red', price: 20, sell: 8, use: { hp: 50 } },
            { id: 'herb_ling', name: '灵草', type: 'material', rarity: 'common', icon: 'herb', price: 0, sell: 6 }
        ];
        window.SECT = {
            name: '青云门',
            ranks: [
                { name: '外门弟子', contribution: 0, realmMin: 0, salary: 20, discount: 0 },
                { name: '内门弟子', contribution: 120, realmMin: 4, salary: 50, discount: 0.05 }
            ],
            contributionPerFloor: 8,
            contributionPerBoss: 25,
            contributionPerClear: 20
        };
        window.SHOPS = { sect: { id: 'sect', name: '执事堂', stock: ['pill_hp'] } };
        window.G.inventory = {};
        window.G.spiritStones = 0;
        window.G.sect = { rank: 0, contribution: 0, lastSalary: '' };
        window.G.hp = 40;
        window.G.maxHp = 100;
    });

    test('addItem / removeItem / countItem 正确堆叠', () => {
        addItem('pill_hp', 2);
        addItem('pill_hp', 1);
        expect(countItem('pill_hp')).toBe(3);
        expect(removeItem('pill_hp', 2)).toBe(true);
        expect(countItem('pill_hp')).toBe(1);
        expect(removeItem('pill_hp', 5)).toBe(false);
        expect(countItem('pill_hp')).toBe(1);
    });

    test('getItemPrice 按宗门身份打折', () => {
        const pill = getItemDef('pill_hp');
        expect(getItemPrice(pill, 'sect')).toBe(20);
        window.G.sect.rank = 1;
        expect(getItemPrice(pill, 'sect')).toBe(19);
        expect(getItemPrice(pill, 'linyue')).toBe(20);
    });

    test('useItem 回血并消耗，非消耗品不能使用', () => {
        addItem('pill_hp', 1);
        addItem('herb_ling', 1);
        expect(useItem('pill_hp')).toBe(true);
        expect(window.G.hp).toBe(90);
        expect(countItem('pill_hp')).toBe(0);
        expect(useItem('herb_ling')).toBe(false);
    });

    test('宗门贡献 / 晋升 / 俸禄', () => {
        addSectContribution(130);
        window.G.realm = 4;
        expect(canPromoteSect()).toBe(true);
        expect(promoteSect()).toBe(true);
        expect(getSectRank().name).toBe('内门弟子');
        const salary = claimSectSalary();
        expect(salary).toBe(50);
        expect(window.G.spiritStones).toBe(50);
        expect(claimSectSalary()).toBe(0);
    });
});
