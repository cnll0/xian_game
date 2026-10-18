'use strict';

class GameState {
    constructor() {
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

        this.constants = {
            W: 960,
            H: 540,
            WORLD_ZOOM: 1.35,
            PAD: 24
        };

        this.assets = {
            images: {},
            floorPattern: null
        };
    }

    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.runtime);
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => obj[k], this.runtime);
        target[lastKey] = value;
    }

    resetRuntime() {
        this.runtime.running = false;
        this.runtime.state = 'idle';
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

    resetWorld() {
        this.runtime.world.player = null;
        this.runtime.world.camera = { x: 0, y: 0 };
        this.runtime.world.zone = 'overworld';
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