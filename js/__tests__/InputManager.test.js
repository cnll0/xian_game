/**
 * AssetLoader 单元测试
 */

describe('AssetLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new AssetLoader();
  });

  afterEach(() => {
    loader.clear();
  });

  test('loadImage加载成功', async () => {
    const img = await loader.loadImage('test', 'test.png');
    expect(img).toBeInstanceOf(Image);
    expect(loader.getImage('test')).toBe(img);
  });

  test('loadImage缓存机制', async () => {
    const img1 = await loader.loadImage('cached', 'test.png');
    const img2 = await loader.loadImage('cached', 'test.png');
    expect(img1).toBe(img2);
  });

  test('loadImage失败返回null', async () => {
    // 使用无效URL触发onerror
    const originalImage = global.Image;
    global.Image = class {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.src = '';
        setTimeout(() => this.onerror?.(), 0);
      }
    };

    const img = await loader.loadImage('failed', 'invalid.png');
    expect(img).toBeNull();
    expect(loader.hasImage('failed')).toBe(false);

    global.Image = originalImage;
  });

  test('loadImages批量加载', async () => {
    const list = {
      img1: 'test1.png',
      img2: 'test2.png',
      img3: 'test3.png'
    };
    await loader.loadImages(list);
    expect(loader.hasImage('img1')).toBe(true);
    expect(loader.hasImage('img2')).toBe(true);
    expect(loader.hasImage('img3')).toBe(true);
  });

  test('createPattern创建模式', async () => {
    await loader.loadImage('pattern', 'test.png');
    const pattern = loader.createPattern('pattern', 'repeat');
    expect(pattern).toBeDefined();
  });

  test('createPattern不存在返回null', () => {
    const pattern = loader.createPattern('nonexistent');
    expect(pattern).toBeNull();
  });
});

/**
 * InputManager 单元测试
 */

describe('InputManager', () => {
  let canvas;
  let inputManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    document.body.appendChild(canvas);

    // 创建必要的DOM元素
    const createElement = (id, className = '') => {
      const el = document.createElement('div');
      el.id = id;
      el.className = className;
      document.body.appendChild(el);
      return el;
    };
    createElement('joyBase');
    createElement('joyKnob');
    createElement('joyZone');
    createElement('atkBtn');
    createElement('interactBtn');

    inputManager = new InputManager(canvas);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('按键按下/释放', () => {
    const keydown = new KeyboardEvent('keydown', { code: 'KeyW' });
    window.dispatchEvent(keydown);
    expect(inputManager.isKeyPressed('KeyW')).toBe(true);

    const keyup = new KeyboardEvent('keyup', { code: 'KeyW' });
    window.dispatchEvent(keyup);
    expect(inputManager.isKeyPressed('KeyW')).toBe(false);
  });

  test('方向键阻止默认行为', () => {
    const keydown = new KeyboardEvent('keydown', { code: 'ArrowUp' });
    const preventDefault = jest.spyOn(keydown, 'preventDefault');
    window.dispatchEvent(keydown);
    expect(preventDefault).toHaveBeenCalled();
  });

  test('攻击按键触发', () => {
    const keydown = new KeyboardEvent('keydown', { code: 'KeyJ' });
    window.dispatchEvent(keydown);
    expect(inputManager.consumeAttack()).toBe(true);
    expect(inputManager.consumeAttack()).toBe(false); // 已消费
  });

  test('交互按键触发', () => {
    const keydown = new KeyboardEvent('keydown', { code: 'KeyE' });
    window.dispatchEvent(keydown);
    expect(inputManager.consumeInteract()).toBe(true);
  });

  test('快速点按 E：keydown 后立刻 keyup 也不丢输入', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
    expect(inputManager.consumeInteract()).toBe(true);
    expect(inputManager.consumeInteract()).toBe(false);
  });

  test('鼠标位置更新', () => {
    const rect = canvas.getBoundingClientRect();
    const mousemove = new MouseEvent('mousemove', {
      clientX: rect.left + 100,
      clientY: rect.top + 50
    });
    canvas.dispatchEvent(mousemove);
    expect(inputManager.mouse.x).toBeCloseTo(100, 0);
    expect(inputManager.mouse.y).toBeCloseTo(50, 0);
  });

  test('鼠标按下触发攻击', () => {
    const mousedown = new MouseEvent('mousedown');
    canvas.dispatchEvent(mousedown);
    expect(inputManager.consumeAttack()).toBe(true);
  });

  test('覆盖层显示时忽略鼠标攻击', () => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay active';
    document.body.appendChild(overlay);

    const mousedown = new MouseEvent('mousedown');
    canvas.dispatchEvent(mousedown);
    expect(inputManager.consumeAttack()).toBe(false);

    overlay.remove();
  });

  test('虚拟摇杆触摸', () => {
    const joyZone = document.getElementById('joyZone');
    const touchstart = new TouchEvent('touchstart', {
      changedTouches: [new Touch({ identifier: 1, clientX: 100, clientY: 100 })]
    });
    joyZone.dispatchEvent(touchstart);

    expect(inputManager.joystick.active).toBe(true);
    expect(inputManager.joystick.id).toBe(1);

    const touchmove = new TouchEvent('touchmove', {
      changedTouches: [new Touch({ identifier: 1, clientX: 130, clientY: 100 })]
    });
    joyZone.dispatchEvent(touchmove);

    expect(inputManager.joystick.dx).toBeGreaterThan(0);
    expect(inputManager.joystick.dy).toBe(0);

    const touchend = new TouchEvent('touchend', {
      changedTouches: [new Touch({ identifier: 1 })]
    });
    joyZone.dispatchEvent(touchend);

    expect(inputManager.joystick.active).toBe(false);
    expect(inputManager.joystick.dx).toBe(0);
  });

  test('getMovementVector键盘输入', () => {
    const keydownW = new KeyboardEvent('keydown', { code: 'KeyW' });
    window.dispatchEvent(keydownW);

    const vec = inputManager.getMovementVector();
    expect(vec.y).toBe(-1);
    expect(vec.x).toBe(0);
    expect(vec.length).toBe(1);
  });

  test('getMovementVector组合输入归一化', () => {
    const keydownW = new KeyboardEvent('keydown', { code: 'KeyW' });
    const keydownD = new KeyboardEvent('keydown', { code: 'KeyD' });
    window.dispatchEvent(keydownW);
    window.dispatchEvent(keydownD);

    const vec = inputManager.getMovementVector();
    expect(Math.abs(vec.x)).toBeCloseTo(0.707, 2);
    expect(Math.abs(vec.y)).toBeCloseTo(0.707, 2);
    expect(vec.length).toBeCloseTo(1, 2);
  });

  test('摇杆输入合成键盘输入', () => {
    const keydownW = new KeyboardEvent('keydown', { code: 'KeyW' });
    window.dispatchEvent(keydownW);

    // 模拟摇杆向右
    inputManager.joystick.active = true;
    inputManager.joystick.dx = 1;
    inputManager.joystick.dy = 0;

    const vec = inputManager.getMovementVector();
    // 向上 + 向右 = 对角线，归一化后
    expect(Math.abs(vec.x)).toBeCloseTo(0.707, 2);
    expect(Math.abs(vec.y)).toBeCloseTo(0.707, 2);
  });
});