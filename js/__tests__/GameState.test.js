/**
 * GameState 单元测试
 */

describe('GameState', () => {
  let gameState;

  beforeEach(() => {
    // 重新创建实例（单例模式）
    gameState = new GameState();
  });

  describe('初始状态', () => {
    test('运行时状态正确初始化', () => {
      const rt = gameState.runtime;
      expect(rt.running).toBe(false);
      expect(rt.state).toBe('idle');
      expect(rt.floor).toBe(1);
      expect(rt.floorCount).toBe(10);
      expect(rt.dungeonId).toBe('qingyun');
      expect(rt.player).toBeNull();
      expect(rt.monsters).toEqual([]);
      expect(rt.bullets).toEqual([]);
      expect(rt.effects).toEqual([]);
    });

    test('常量正确', () => {
      expect(gameState.constants.W).toBe(960);
      expect(gameState.constants.H).toBe(540);
      expect(gameState.constants.WORLD_ZOOM).toBe(1.35);
      expect(gameState.constants.PAD).toBe(24);
    });
  });

  describe('get/set 路径访问', () => {
    test('get 获取嵌套属性', () => {
      expect(gameState.get('floor')).toBe(1);
      expect(gameState.get('world.zone')).toBe('overworld');
      expect(gameState.get('world.camera.x')).toBe(0);
    });

    test('set 修改嵌套属性', () => {
      gameState.set('floor', 5);
      expect(gameState.get('floor')).toBe(5);

      gameState.set('world.camera.x', 100);
      expect(gameState.get('world.camera.x')).toBe(100);
    });

    test('set 创建新路径', () => {
      gameState.set('custom.new.path', 'value');
      expect(gameState.get('custom.new.path')).toBe('value');
    });
  });

  describe('resetRuntime', () => {
    test('重置运行时状态', () => {
      // 先修改一些状态
      gameState.runtime.running = true;
      gameState.runtime.state = 'playing';
      gameState.runtime.floor = 5;
      gameState.runtime.player = { hp: 50 };
      gameState.runtime.monsters = [{ hp: 30 }];

      gameState.resetRuntime();

      expect(gameState.runtime.running).toBe(false);
      expect(gameState.runtime.state).toBe('idle');
      expect(gameState.runtime.floor).toBe(1);
      expect(gameState.runtime.player).toBeNull();
      expect(gameState.runtime.monsters).toEqual([]);
      expect(gameState.runtime.bullets).toEqual([]);
      expect(gameState.runtime.cards.player).toEqual({});
      expect(gameState.runtime.monsterMods.hpMul).toBe(1);
    });
  });

  describe('resetWorld', () => {
    test('重置世界状态', () => {
      gameState.runtime.world.player = { x: 100 };
      gameState.runtime.world.zone = 'ember';
      gameState.runtime.world.actors = [{ x: 1 }];
      gameState.runtime.world.saveTimer = 100;

      gameState.resetWorld();

      expect(gameState.runtime.world.player).toBeNull();
      expect(gameState.runtime.world.zone).toBe('overworld');
      expect(gameState.runtime.world.actors).toEqual([]);
      expect(gameState.runtime.world.creatures).toEqual([]);
      expect(gameState.runtime.world.saveTimer).toBe(0);
      expect(gameState.runtime.world.storyPrompted).toBeNull();
    });
  });
});

/**
 * ObjectPool 单元测试
 */

describe('ObjectPool', () => {
  let pool;
  let createFn;
  let resetFn;

  beforeEach(() => {
    createFn = () => ({ x: 0, y: 0, active: false });
    resetFn = (obj) => { obj.x = 0; obj.y = 0; obj.active = false; };
    pool = new ObjectPool(createFn, resetFn, 5);
  });

  test('获取对象', () => {
    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(obj.active).toBe(false);
    expect(pool.getActiveCount()).toBe(1);
    expect(pool.getPoolSize()).toBe(4);
  });

  test('释放对象回收', () => {
    const obj = pool.acquire();
    obj.x = 100;
    obj.active = true;
    pool.release(obj);
    expect(obj.x).toBe(0);
    expect(obj.active).toBe(false);
    expect(pool.getActiveCount()).toBe(0);
    expect(pool.getPoolSize()).toBe(5);
  });

  test('池耗尽时创建新对象', () => {
    const objects = [];
    for (let i = 0; i < 10; i++) {
      objects.push(pool.acquire());
    }
    expect(pool.getActiveCount()).toBe(10);
    expect(pool.getPoolSize()).toBe(0);
  });

  test('releaseAll释放所有', () => {
    const objects = [];
    for (let i = 0; i < 3; i++) {
      objects.push(pool.acquire());
    }
    pool.releaseAll();
    expect(pool.getActiveCount()).toBe(0);
    expect(pool.getPoolSize()).toBe(5); // 初始 5 个，3 个借出后归还
  });

  test('clear清空池', () => {
    pool.acquire();
    pool.clear();
    expect(pool.getActiveCount()).toBe(0);
    expect(pool.getPoolSize()).toBe(0);
  });

  test('重复释放同一对象不重复', () => {
    const obj = pool.acquire();
    pool.release(obj);
    pool.release(obj); // 重复释放
    expect(pool.getPoolSize()).toBe(5);
  });
});

/**
 * PoolTypes 预定义池测试
 */

describe('PoolTypes', () => {
  test('BULLET池创建对象结构正确', () => {
    const bulletPool = PoolTypes.BULLET();
    const bullet = bulletPool.acquire();
    expect(bullet).toHaveProperty('x', 0);
    expect(bullet).toHaveProperty('y', 0);
    expect(bullet).toHaveProperty('vx', 0);
    expect(bullet).toHaveProperty('vy', 0);
    expect(bullet).toHaveProperty('r', 0);
    expect(bullet).toHaveProperty('dmg', 0);
    expect(bullet).toHaveProperty('color', '#fff');
    expect(bullet).toHaveProperty('shouldRemove', false);
  });

  test('EFFECT池创建对象结构正确', () => {
    const effectPool = PoolTypes.EFFECT();
    const effect = effectPool.acquire();
    expect(effect).toHaveProperty('type', '');
    expect(effect).toHaveProperty('x', 0);
    expect(effect).toHaveProperty('y', 0);
    expect(effect).toHaveProperty('color', '#fff');
    expect(effect).toHaveProperty('t', 0);
    expect(effect).toHaveProperty('life', 0);
  });

  test('TEXT池创建对象结构正确', () => {
    const textPool = PoolTypes.TEXT();
    const text = textPool.acquire();
    expect(text).toHaveProperty('x', 0);
    expect(text).toHaveProperty('y', 0);
    expect(text).toHaveProperty('text', '');
    expect(text).toHaveProperty('color', '#fff');
    expect(text).toHaveProperty('vy', 0);
  });
});