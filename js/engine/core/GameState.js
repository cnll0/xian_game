'use strict';

/**
 * @typedef {Object} RuntimeState
 * @property {boolean} running
 * @property {'idle'|'world'|'playing'|'clear'|'dialog'} state
 * @property {boolean} storyDungeon
 * @property {boolean} skirmish
 * @property {number} floor
 * @property {number} floorCount
 * @property {string} dungeonId
 * @property {import('../../types.d.ts').Dungeon|null} dungeon
 * @property {number} time
 * @property {number} mapSeed
 * @property {any|null} portal
 * @property {boolean} noDeathRun
 * @property {import('../../types.d.ts').PlayerEntity|null} player
 * @property {import('../../types.d.ts').MonsterEntity[]} monsters
 * @property {import('../../types.d.ts').Bullet[]} bullets
 * @property {import('../../types.d.ts').Effect[]} effects
 * @property {import('../../types.d.ts').FloatText[]} texts
 * @property {import('../../types.d.ts').Chest[]} chests
 * @property {import('../../types.d.ts').Trap[]} traps
 * @property {import('../../types.d.ts').SceneryItem[]} scenery
 * @property {import('../../types.d.ts').Landmark[]} landmarks
 * @property {import('../../types.d.ts').Vec2[]} arena
 * @property {import('../../types.d.ts').FloorNPC|null} floorNpc
 * @property {number|null} pendingFloorClear
 * @property {string|null} npcPausedState
 * @property {{player:{},monster:{},run:{}}} cards
 * @property {import('../../types.d.ts').MonsterMods} monsterMods
 * @property {Object} world
 * @property {Object} input
 * @property {Object} assets
 */

/**
 * @typedef {Object} Constants
 * @property {number} W
 * @property {number} H
 * @property {number} WORLD_ZOOM
 * @property {number} PAD
 */

/**
 * @typedef {Object} Assets
 * @property {Record<string, HTMLImageElement|null>} images
 * @property {CanvasPattern|null} floorPattern
 */

/**
 * ?????????
 * ?????????????????get/set??
 */
class GameState {
    constructor() {
        /** @type {RuntimeState} */
        this.runtime = {
            running: false,
            state: 'idle',
            storyDungeon: false,
            skirmish: false,
            floor: 1,
            floorCount: 10,
            dungeonId: 'qingyun',
            dungeon: null,
            time: 0,
            mapSeed: 1,
            portal: null,

            player: null,
            monsters: [],
            bullets: [],
            effects: [],
            texts: [],
            chests: [],
            traps: [],
            scenery: [],
            landmarks: [],
            arena: [],
            floorNpc: null,
            pendingFloorClear: null,
            npcPausedState: null,
            noDeathRun: true,

            cards: {
                player: {},
                monster: {},
                run: {}
            },
            monsterMods: {
                hpMul: 1, atkMul: 1, spdMul: 1,
                cntAdd: 0, forceElite: false,
                shield: 0, regen: 0, thorns: 0,
                split: 0, explode: false,
                teleport: 0, summonCd: 0
            },

            world: {
                player: null,
                camera: { x: 0, y: 0 },
                zone: 'overworld',
                time: 0,
                decor: [],
                actors: [],
                creatures: [],
                saveTimer: 0,
                storyPrompted: null,
                npcPrompted: null
            },

            input: {
                keys: {},
                mouse: { x: 480, y: 270, down: false },
                joystick: { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 }
            }
        };

        /** @type {Constants} */
        this.constants = {
            W: 960,
            H: 540,
            WORLD_ZOOM: 1.35,
            PAD: 24
        };

        /** @type {Assets} */
        this.runtime.assets = {
            images: {},
            floorPattern: null
        };
        // 兼容旧代码：assets 与 runtime.assets 指向同一对象
        this.assets = this.runtime.assets;
    }

    /**
     * ????????
     * @param {string} key - ????????? 'world.player.x'
     * @returns {any}
     */
    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.runtime);
    }

    /**
     * ????????
     * @param {string} key - ???????
     * @param {any} value - ?????
     */
    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => {
            if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
            return obj[k];
        }, this.runtime);
        target[lastKey] = value;
    }

    /** ????????? */
    resetRuntime() {
        this.runtime.running = false;
        this.runtime.state = 'idle';
        this.runtime.floor = 1;
        this.runtime.floorCount = 10;
        this.runtime.dungeonId = 'qingyun';
        this.runtime.dungeon = null;
        this.runtime.time = 0;
        this.runtime.mapSeed = 1;
        this.runtime.storyDungeon = false;
        this.runtime.skirmish = false;
        this.runtime.noDeathRun = true;
        this.runtime.player = null;
        this.runtime.monsters = [];
        this.runtime.bullets = [];
        this.runtime.effects = [];
        this.runtime.texts = [];
        this.runtime.chests = [];
        this.runtime.traps = [];
        this.runtime.floorNpc = null;
        this.runtime.pendingFloorClear = null;
        this.runtime.npcPausedState = null;
        this.runtime.cards = { player: {}, monster: {}, run: {} };
        this.runtime.monsterMods = {
            hpMul: 1, atkMul: 1, spdMul: 1,
            cntAdd: 0, forceElite: false,
            shield: 0, regen: 0, thorns: 0,
            split: 0, explode: false,
            teleport: 0, summonCd: 0
        };
        this.runtime.world.player = null;
        this.runtime.world.actors = [];
        this.runtime.world.creatures = [];
        this.runtime.world.saveTimer = 0;
        this.runtime.world.storyPrompted = null;
        this.runtime.world.npcPrompted = null;
        this.runtime.input.keys = {};
    }

    /** ???????? */
    resetWorld() {
        this.runtime.world.player = null;
        this.runtime.world.camera = { x: 0, y: 0 };
        this.runtime.world.zone = 'overworld';
        this.runtime.world.time = 0;
        this.runtime.world.decor = [];
        this.runtime.world.actors = [];
        this.runtime.world.creatures = [];
        this.runtime.world.saveTimer = 0;
        this.runtime.world.storyPrompted = null;
        this.runtime.world.npcPrompted = null;
    }
}

window.GameState = GameState;
window.gameState = new GameState();