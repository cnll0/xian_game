// 零依赖单元测试：npm test 在未安装 devDependencies 的环境也能运行。
// 需要完整 Jest 用例时可执行 npm run test:jest（需 npm install）。
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage() {}, createPattern() { return 'pattern'; } })
    })
};
globalThis.addEventListener = () => {};
globalThis.Image = class {
    set src(value) {
        this._src = value;
        setTimeout(() => this.onload && this.onload(), 0);
    }
    get src() { return this._src; }
};
window.Image = globalThis.Image;

await import('../js/engine/utils/MathUtils.js');
await import('../js/engine/utils/ObjectPool.js');
await import('../js/engine/core/EventBus.js');
await import('../js/engine/core/GameState.js');
await import('../js/engine/core/InputManager.js');
await import('../js/engine/utils/AssetLoader.js');
await import('../js/engine/systems/CardSystem.js');

const { MathUtils, SeededRandom, ObjectPool, PoolTypes, EventBus, GameState, InputManager, AssetLoader, CardSystem } = globalThis;

test('MathUtils: clamp / distance / angleDiff', () => {
    assert.equal(MathUtils.clamp(12, 0, 10), 10);
    assert.equal(MathUtils.clamp(-3, 0, 10), 0);
    assert.equal(MathUtils.distance(0, 0, 3, 4), 5);
    assert.equal(MathUtils.distanceSq(0, 0, 3, 4), 25);
    assert.ok(Math.abs(MathUtils.angleDiff(Math.PI, -Math.PI)) < 1e-9);
    assert.ok(Math.abs(Math.abs(MathUtils.normalizeAngle(3 * Math.PI)) - Math.PI) < 1e-9);
});

test('SeededRandom: 同种子序列稳定且范围正确', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    for (let i = 0; i < 20; i++) {
        const x = a.next();
        assert.equal(x, b.next());
        assert.ok(x >= 0 && x < 1);
    }
});

test('EventBus: on / emit / off / once', () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.on('evt', v => { count += v; });
    bus.emit('evt', 2);
    bus.emit('evt', 3);
    assert.equal(count, 5);
    off();
    bus.emit('evt', 10);
    assert.equal(count, 5);

    let once = 0;
    bus.once('one', v => { once += v; });
    bus.emit('one', 1);
    bus.emit('one', 1);
    assert.equal(once, 1);
});

test('ObjectPool: acquire / release / 扩容', () => {
    const pool = new ObjectPool(() => ({ x: 0 }), o => { o.x = 0; }, 2);
    const a = pool.acquire();
    a.x = 9;
    assert.equal(pool.getActiveCount(), 1);
    pool.release(a);
    assert.equal(a.x, 0);
    assert.equal(pool.getActiveCount(), 0);
    assert.ok(pool.acquire());
    assert.ok(pool.acquire());
    assert.ok(pool.acquire());
    assert.equal(PoolTypes.BULLET().acquire().shouldRemove, false);
});

test('GameState: 默认值 / get/set / reset / assets', () => {
    const gs = new GameState();
    assert.equal(gs.get('state'), 'idle');
    assert.equal(gs.get('world.zone'), 'overworld');
    assert.ok(gs.runtime.assets && gs.runtime.assets.images);
    gs.set('floor', 4);
    assert.equal(gs.get('floor'), 4);
    gs.set('world.camera.x', 88);
    assert.equal(gs.get('world.camera.x'), 88);
    gs.runtime.running = true;
    gs.runtime.monsters = [{ hp: 1 }];
    gs.resetRuntime();
    assert.equal(gs.runtime.running, false);
    assert.deepEqual(gs.runtime.monsters, []);
});

test('InputManager: 键盘/摇杆移动向量', () => {
    const canvas = { width: 960, height: 540, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), addEventListener: () => {} };
    const input = new InputManager(canvas);
    input.keys.KeyW = true;
    assert.deepEqual(input.getMovementVector(), { x: 0, y: -1, length: 1 });
    input.keys.KeyW = false;
    input.keys.KeyD = true;
    const right = input.getMovementVector();
    assert.equal(right.x, 1);
    input.keys.KeyD = false;
    input.joystick.active = true;
    input.joystick.dx = 1;
    input.joystick.dy = 0;
    assert.equal(input.getMovementVector().x, 1);
});

test('CardSystem: 诅咒至多 1 张，25% 概率插入', () => {
    window.MONSTER_CARDS = [
        { id: 'c1', name: '诅咒一', type: 'cursed', curseTier: 'minor', effects: {}, curseCost: {}, curseGift: { curseSoulHarvest: 0.01 } },
        { id: 'c2', name: '诅咒二', type: 'cursed', curseTier: 'major', effects: {}, curseCost: {}, curseGift: { curseFrenzy: 0.1 } },
        { id: 'c3', name: '诅咒三', type: 'cursed', curseTier: 'calamity', effects: {}, curseCost: {}, curseGift: { curseLastStand: true } }
    ];
    const state = { runtime: { cards: { player: {}, monster: {} }, floor: 1 } };
    const system = new CardSystem(state, { emit() {} });
    const originalRandom = Math.random;
    Math.random = () => 0.24;
    assert.equal(system._rollCurseCard().length, 1);
    Math.random = () => 0.25;
    assert.equal(system._rollCurseCard().length, 0);
    Math.random = () => 0.9;
    assert.equal(system._rollCurseCard().length, 0);
    Math.random = originalRandom;
});

test('CardSystem: 诅咒占用玩家/妖魔一张卡位，不生成第三列', () => {
    window.PLAYER_CARDS = [
        { id: 'p1', name: '玩家一', type: 'stat', effects: { atk: 1 } },
        { id: 'p2', name: '玩家二', type: 'stat', effects: { atk: 1 } },
        { id: 'p3', name: '玩家三', type: 'stat', effects: { atk: 1 } },
        { id: 'pc', name: '玩家诅咒', type: 'cursed', curseTier: 'minor', effects: {}, curseGift: { curseSoulHarvest: 0.01 } }
    ];
    window.MONSTER_CARDS = [
        { id: 'm1', name: '妖魔一', type: 'stat', effects: { hpMul: 1.1 } },
        { id: 'mc', name: '妖魔诅咒', type: 'cursed', curseTier: 'major', effects: {}, curseGift: { curseFrenzy: 0.1 } }
    ];
    const state = { runtime: { cards: { player: {}, monster: {} }, floor: 1 } };
    const system = new CardSystem(state, { emit() {} });
    system._pendingPlayerCards = window.PLAYER_CARDS.slice(0, 3).map(c => Object.assign({}, c, { selected: false }));
    system._pendingMonsterCards = [Object.assign({}, window.MONSTER_CARDS[0], { selected: false })];
    system._pendingCurseCards = [];

    const originalRandom = Math.random;
    Math.random = () => 0.1;
    const occupied = system._attachCurseCard();
    Math.random = originalRandom;

    assert.equal(occupied.side, 'player');
    assert.equal(system._pendingPlayerCards.length, 3);
    assert.equal(system._pendingPlayerCards.filter(c => c.curseOccupied).length, 1);
    assert.equal(system._pendingPlayerCards[0].id, 'pc');
    assert.equal(system._pendingCurseCards.length, 0);
});

test('AssetLoader: 加载 / 缓存 / 失败返回 null', async () => {
    const loader = new AssetLoader();
    const img = await loader.loadImage('a', 'a.png');
    assert.ok(img);
    assert.equal(await loader.loadImage('a', 'a.png'), img);
    const oldImage = globalThis.Image;
    globalThis.Image = class {
        set src(value) {
            this._src = value;
            setTimeout(() => this.onerror && this.onerror(), 0);
        }
    };
    const fail = await loader.loadImage('bad', 'bad.png');
    assert.equal(fail, null);
    globalThis.Image = oldImage;
});
