/**
 * MathUtils 单元测试
 */

describe('MathUtils', () => {
  describe('clamp', () => {
    test('限制在范围内', () => {
      expect(MathUtils.clamp(5, 0, 10)).toBe(5);
    });
    test('小于最小值返回最小值', () => {
      expect(MathUtils.clamp(-5, 0, 10)).toBe(0);
    });
    test('大于最大值返回最大值', () => {
      expect(MathUtils.clamp(15, 0, 10)).toBe(10);
    });
    test('边界值', () => {
      expect(MathUtils.clamp(0, 0, 10)).toBe(0);
      expect(MathUtils.clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    test('线性插值中点', () => {
      expect(MathUtils.lerp(0, 10, 0.5)).toBe(5);
    });
    test('线性插值起点', () => {
      expect(MathUtils.lerp(0, 10, 0)).toBe(0);
    });
    test('线性插值终点', () => {
      expect(MathUtils.lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('distance', () => {
    test('计算两点距离', () => {
      expect(MathUtils.distance(0, 0, 3, 4)).toBe(5);
    });
    test('同一点距离为0', () => {
      expect(MathUtils.distance(5, 5, 5, 5)).toBe(0);
    });
  });

  describe('distanceSq', () => {
    test('计算距离平方', () => {
      expect(MathUtils.distanceSq(0, 0, 3, 4)).toBe(25);
    });
  });

  describe('angleBetween', () => {
    test('计算角度', () => {
      expect(MathUtils.angleBetween(0, 0, 1, 0)).toBe(0);
      expect(MathUtils.angleBetween(0, 0, 0, 1)).toBe(Math.PI / 2);
      expect(MathUtils.angleBetween(0, 0, -1, 0)).toBe(Math.PI);
    });
  });

  describe('normalizeAngle', () => {
    test('归一化到 [-PI, PI]', () => {
      expect(MathUtils.normalizeAngle(0)).toBe(0);
      expect(MathUtils.normalizeAngle(Math.PI * 3)).toBe(-Math.PI);
      expect(MathUtils.normalizeAngle(-Math.PI * 2)).toBe(0);
    });
  });

  describe('angleDiff', () => {
    test('计算最短角度差', () => {
      expect(MathUtils.angleDiff(Math.PI / 2, 0)).toBe(Math.PI / 2);
      expect(MathUtils.angleDiff(0, Math.PI / 2)).toBe(-Math.PI / 2);
      // 跨越边界
      expect(MathUtils.angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    });
  });

  describe('fastSin/fastCos', () => {
    test('查找表结果接近标准值', () => {
      expect(MathUtils.fastSin(0)).toBeCloseTo(0, 5);
      expect(MathUtils.fastSin(90)).toBeCloseTo(1, 5);
      expect(MathUtils.fastCos(0)).toBeCloseTo(1, 5);
      expect(MathUtils.fastCos(90)).toBeCloseTo(0, 5);
    });
    test('角度归一化', () => {
      expect(MathUtils.fastSin(450)).toBeCloseTo(MathUtils.fastSin(90), 5);
      expect(MathUtils.fastSin(-90)).toBeCloseTo(MathUtils.fastSin(270), 5);
    });
  });

  describe('random', () => {
    test('生成范围内随机数', () => {
      for (let i = 0; i < 100; i++) {
        const v = MathUtils.random(10, 20);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThan(20);
      }
    });
  });

  describe('randomInt', () => {
    test('生成范围内整数', () => {
      for (let i = 0; i < 100; i++) {
        const v = MathUtils.randomInt(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
        expect(Number.isInteger(v)).toBe(true);
      }
    });
  });

  describe('randomChoice', () => {
    test('从数组随机选择元素', () => {
      const arr = ['a', 'b', 'c'];
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(MathUtils.randomChoice(arr));
      }
    });
    test('单元素数组', () => {
      expect(MathUtils.randomChoice(['only'])).toBe('only');
    });
  });

  describe('weightedRandom', () => {
    test('按权重选择索引', () => {
      const weights = [1, 9]; // 10% vs 90%
      let count0 = 0, count1 = 0;
      for (let i = 0; i < 1000; i++) {
        if (MathUtils.weightedRandom(weights) === 0) count0++;
        else count1++;
      }
      // 允许一定误差
      expect(count0).toBeLessThan(200);
      expect(count1).toBeGreaterThan(800);
    });
  });

  describe('resolvePosition', () => {
    test('限制在边界内', () => {
      const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      expect(MathUtils.resolvePosition(-10, 50, 10, bounds)).toEqual({ x: 10, y: 50 });
      expect(MathUtils.resolvePosition(110, 50, 10, bounds)).toEqual({ x: 90, y: 50 });
      expect(MathUtils.resolvePosition(50, -10, 10, bounds)).toEqual({ x: 50, y: 10 });
      expect(MathUtils.resolvePosition(50, 110, 10, bounds)).toEqual({ x: 50, y: 90 });
    });
    test('内部位置不变', () => {
      const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      expect(MathUtils.resolvePosition(50, 50, 10, bounds)).toEqual({ x: 50, y: 50 });
    });
  });

  describe('rotatePoint', () => {
    test('绕原点旋转90度', () => {
      const result = MathUtils.rotatePoint(1, 0, 0, 0, Math.PI / 2);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(1, 5);
    });
    test('绕中心点旋转', () => {
      const result = MathUtils.rotatePoint(2, 0, 1, 0, Math.PI);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(0, 5);
    });
  });
});

describe('SeededRandom', () => {
  test('相同种子产生相同序列', () => {
    const r1 = new SeededRandom(12345);
    const r2 = new SeededRandom(12345);
    for (let i = 0; i < 10; i++) {
      expect(r1.next()).toBe(r2.next());
    }
  });

  test('不同种子产生不同序列', () => {
    const r1 = new SeededRandom(111);
    const r2 = new SeededRandom(222);
    expect(r1.next()).not.toBe(r2.next());
  });

  test('nextInt生成范围内整数', () => {
    const r = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = r.nextInt(5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(15);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test('nextFloat生成范围内浮点数', () => {
    const r = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = r.nextFloat(1.5, 3.5);
      expect(v).toBeGreaterThanOrEqual(1.5);
      expect(v).toBeLessThan(3.5);
    }
  });

  test('choice从数组选择', () => {
    const r = new SeededRandom(42);
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.choice(arr));
    }
  });

  test('shuffle不改变元素', () => {
    const r = new SeededRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = r.shuffle(arr);
    expect(shuffled.sort()).toEqual(arr);
    expect(shuffled).not.toEqual(arr); // 极小概率相等，忽略
  });
});