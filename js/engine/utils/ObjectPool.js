'use strict';

class ObjectPool {
    constructor(createFn, resetFn, initialSize = 50) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.active = new Set();

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(createFn());
        }
    }

    acquire() {
        let obj = this.pool.pop() || this.createFn();
        this.active.add(obj);
        return obj;
    }

    release(obj) {
        if (this.active.has(obj)) {
            this.active.delete(obj);
            this.resetFn(obj);
            this.pool.push(obj);
        }
    }

    releaseAll() {
        this.active.forEach(obj => {
            this.resetFn(obj);
            this.pool.push(obj);
        });
        this.active.clear();
    }

    getActiveCount() {
        return this.active.size;
    }

    getPoolSize() {
        return this.pool.length;
    }

    clear() {
        this.pool = [];
        this.active.clear();
    }
}

const PoolTypes = {
    BULLET: () => new ObjectPool(
        () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0, dmg: 0, color: '#fff', life: 0, shouldRemove: false }),
        (b) => { b.x = b.y = b.vx = b.vy = 0; b.r = 0; b.dmg = 0; b.color = '#fff'; b.life = 0; b.shouldRemove = false; },
        100
    ),
    EFFECT: () => new ObjectPool(
        () => ({ type: '', x: 0, y: 0, color: '#fff', t: 0, life: 0, element: '' }),
        (e) => { e.type = ''; e.x = e.y = 0; e.color = '#fff'; e.t = 0; e.life = 0; e.element = ''; },
        50
    ),
    TEXT: () => new ObjectPool(
        () => ({ x: 0, y: 0, text: '', color: '#fff', t: 0, life: 0, vy: 0 }),
        (t) => { t.x = t.y = 0; t.text = ''; t.color = '#fff'; t.t = 0; t.life = 0; t.vy = 0; },
        30
    ),
    MONSTER: () => new ObjectPool(
        () => ({ id: '', name: '', x: 0, y: 0, r: 0, hp: 0, maxHp: 0, atk: 0, speed: 0, facing: 0, atkCd: 0, type: '', img: '', draw: 0, boss: false, elite: false, tint: '' }),
        (m) => { m.id = m.name = ''; m.x = m.y = m.r = 0; m.hp = m.maxHp = m.atk = m.speed = 0; m.facing = m.atkCd = 0; m.type = m.img = ''; m.draw = 0; m.boss = m.elite = false; m.tint = ''; },
        20
    )
};

window.ObjectPool = ObjectPool;
window.PoolTypes = PoolTypes;