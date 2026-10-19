'use strict';

/**
 * MapGeneratorWorker - 主线程与Worker通信的封装类
 * 提供Promise风格API，自动处理Worker生命周期和消息路由
 */

class MapGeneratorWorker {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.requestId = 0;
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * 初始化Worker
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            let timer = null;
            const fail = (err) => {
                if (timer) clearTimeout(timer);
                this.initPromise = null;
                reject(err);
            };

            try {
                this.worker = new Worker('./js/workers/mapGenerator.worker.js');

                timer = setTimeout(() => {
                    fail(new Error('MapGeneratorWorker init timeout'));
                }, 5000);

                this.worker.onmessage = (e) => {
                    if (e.data.type === 'PONG') {
                        if (timer) clearTimeout(timer);
                        this.initialized = true;
                        this.worker.onmessage = (ev) => this._handleMessage(ev);
                        resolve();
                        return;
                    }
                    this._handleMessage(e);
                };
                this.worker.onerror = (err) => {
                    console.error('MapGeneratorWorker error:', err);
                    fail(err);
                };

                this.worker.postMessage({ type: 'PING' });
            } catch (err) {
                fail(err);
            }
        });

        return this.initPromise;
    }

    _handleMessage(e) {
        const { type, requestId, ...data } = e.data;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            this.pendingRequests.delete(requestId);
            if (type.endsWith('_READY')) {
                pending.resolve(data);
            } else if (type === 'ERROR') {
                pending.reject(new Error(data.message));
            }
        }
    }

    /**
     * 发送请求到Worker
     * @param {string} type - 请求类型
     * @param {Object} payload - 参数
     * @returns {Promise<Object>} 结果
     */
    _request(type, payload) {
        return new Promise((resolve, reject) => {
            const requestId = ++this.requestId;
            this.pendingRequests.set(requestId, { resolve, reject });
            this.worker.postMessage({ type, payload, requestId });

            // 超时保护
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`Worker request timeout: ${type}`));
                }
            }, 10000);
        });
    }

    /**
     * 生成地形装饰
     * @param {number} floor - 层数
     * @param {number} mapSeed - 地图种子
     * @returns {Promise<Array>} scenery数组
     */
    async generateFloorScenery(floor, mapSeed) {
        const { scenery } = await this._request('GENERATE_FLOOR_SCENERY', { floor, mapSeed });
        return scenery;
    }

    /**
     * 生成地标
     * @param {number} floor - 层数
     * @param {number} mapSeed - 地图种子
     * @returns {Promise<Array>} landmarks数组
     */
    async generateFloorLandmarks(floor, mapSeed) {
        const { landmarks } = await this._request('GENERATE_FLOOR_LANDMARKS', { floor, mapSeed });
        return landmarks;
    }

    /**
     * 生成陷阱
     * @param {number} floor - 层数
     * @param {number} mapSeed - 地图种子
     * @param {number} time - 当前时间
     * @returns {Promise<Array>} traps数组
     */
    async generateFloorTraps(floor, mapSeed, time) {
        const { traps } = await this._request('GENERATE_FLOOR_TRAPS', { floor, mapSeed, time });
        return traps;
    }

    /**
     * 生成竞技场布局
     * @param {number} floor - 层数
     * @param {number} mapSeed - 地图种子
     * @returns {Promise<Array>} arena数组
     */
    async generateArenaLayout(floor, mapSeed) {
        const { arena } = await this._request('GENERATE_ARENA_LAYOUT', { floor, mapSeed });
        return arena;
    }

    /**
     * 一次性生成整层所有数据
     * @param {number} floor - 层数
     * @param {number} mapSeed - 地图种子
     * @param {number} time - 当前时间
     * @returns {Promise<Object>} { scenery, landmarks, traps, arena }
     */
    async generateFullFloor(floor, mapSeed, time) {
        return this._request('GENERATE_FULL_FLOOR', { floor, mapSeed, time });
    }

    /**
     * 终止Worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.initialized = false;
            this.pendingRequests.clear();
        }
    }

    /**
     * 检查是否支持Worker
     * @returns {boolean}
     */
    static isSupported() {
        return typeof Worker !== 'undefined';
    }
}

window.MapGeneratorWorker = MapGeneratorWorker;