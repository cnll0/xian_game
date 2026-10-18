/**
 * EventBus 单元测试
 */

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('订阅和发射事件', () => {
    const callback = jest.fn();
    bus.on('test', callback);
    bus.emit('test', { data: 123 });
    expect(callback).toHaveBeenCalledWith({ data: 123 });
  });

  test('取消订阅后不再触发', () => {
    const callback = jest.fn();
    const off = bus.on('test', callback);
    off();
    bus.emit('test');
    expect(callback).not.toHaveBeenCalled();
  });

  test('一次性监听', () => {
    const callback = jest.fn();
    bus.once('test', callback);
    bus.emit('test', 1);
    bus.emit('test', 2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  test('多个监听器都触发', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    bus.on('test', cb1);
    bus.on('test', cb2);
    bus.emit('test', 'data');
    expect(cb1).toHaveBeenCalledWith('data');
    expect(cb2).toHaveBeenCalledWith('data');
  });

  test('清空所有事件', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    bus.on('test1', cb1);
    bus.on('test2', cb2);
    bus.clear();
    bus.emit('test1');
    bus.emit('test2');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  test('发射不存在的事件不报错', () => {
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  test('回调抛出错误不影响其他监听器', () => {
    const errorCb = jest.fn(() => { throw new Error('test error'); });
    const normalCb = jest.fn();
    bus.on('test', errorCb);
    bus.on('test', normalCb);
    expect(() => bus.emit('test')).not.toThrow();
    expect(normalCb).toHaveBeenCalled();
  });

  test('off移除特定回调', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    bus.on('test', cb1);
    bus.on('test', cb2);
    bus.off('test', cb1);
    bus.emit('test');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });
});