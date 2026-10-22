'use strict';

require('../engine/utils/Collision.js');

describe('Collision 障碍碰撞', () => {
    function wall(overrides = {}) {
        return {
            type: 'broken-wall',
            solid: true,
            x: 100,
            y: 100,
            w: 80,
            h: 40,
            turn: 0,
            ...overrides
        };
    }

    test('只有 solid 地标会生成碰撞体', () => {
        const obstacles = window.Collision.build([
            wall(),
            wall({ type: 'pool', solid: false })
        ]);
        expect(obstacles.length).toBe(1);
    });

    test('实体不能穿墙，且会沿墙滑动', () => {
        const obstacles = window.Collision.build([wall()]);
        // 从墙上方往下撞：纵向被挡住
        const blocked = window.Collision.move(100, 60, 0, 10, 16, obstacles);
        expect(blocked.x).toBe(100);
        expect(blocked.y).toBe(60);
        // 斜着撞：X 方向允许滑动，Y 方向仍然被挡住
        const slide = window.Collision.move(100, 60, 8, 10, 16, obstacles);
        expect(slide.x).toBeGreaterThan(100);
        expect(slide.y).toBe(60);
    });

    test('陷入障碍物时会被推出来', () => {
        const obstacles = window.Collision.build([wall()]);
        const out = window.Collision.resolve(100, 100, 16, obstacles);
        const stillInside = window.Collision.hits(out.x, out.y, 16, obstacles);
        expect(stillInside).toBe(false);
        // 最近的出口在下方（hh=20 + r=16）
        expect(out.y).toBeCloseTo(136, 5);
    });

    test('旋转矩形按 turn 判定，不按轴对齐矩形', () => {
        const obstacles = window.Collision.build([
            wall({ type: 'obelisk', w: 100, h: 40, turn: Math.PI / 2 })
        ]);
        // 旋转 90° 后长轴在 Y 方向
        expect(window.Collision.hits(100, 140, 10, obstacles)).toBe(true);
        expect(window.Collision.hits(140, 100, 10, obstacles)).toBe(false);
    });

    test('AI 正面被挡死时会绕行，而不是永远顶墙', () => {
        const obstacles = window.Collision.build([wall()]);
        const direct = window.Collision.move(100, 60, 0, 10, 16, obstacles);
        expect(direct.y).toBe(60);
        const steered = window.Collision.steer(100, 60, 0, 10, 16, obstacles);
        expect(Math.hypot(steered.x - 100, steered.y - 60)).toBeGreaterThan(1);
        expect(window.Collision.hits(steered.x, steered.y, 16, obstacles)).toBe(false);
    });
});
