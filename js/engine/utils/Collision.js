'use strict';

/**
 * 障碍物碰撞（世界坐标）。
 *
 * 大/小地图里带 `solid: true` 的地标（断墙、方尖碑、古树、碎石堆……）都会被
 * `build()` 转成碰撞体；玩家、妖兽、召唤物、NPC 等一切会移动的实体都必须
 * 通过这里的 `move()` / `steer()` / `resolve()` 改坐标，不能直接写 `x +=`。
 *
 * 碰撞体只有两种：
 *   - box：旋转矩形（地标本身带 turn，画出来就是旋转的）
 *   - circle：圆形（预留给圆形障碍）
 *
 * 坐标约定：
 *   世界坐标 (x, y) -> 地标本地坐标 (lx, ly) = R(-turn) * (x - ox, y - oy)
 *   本地坐标 -> 世界坐标 = R(turn) * (lx, ly)
 */

class Collision {
    /**
     * 地标 -> 碰撞体。只有 solid 的地标才挡路。
     * @param {Object} landmark
     * @returns {Object|null}
     */
    static fromLandmark(landmark) {
        if (!landmark || landmark.solid !== true) return null;

        const w = Math.max(8, Number(landmark.w) || 48);
        const h = Math.max(8, Number(landmark.h) || 32);
        const turn = Number(landmark.turn) || 0;

        // 实心地标统一用整块 w×h。现在每张地图的 solid 地标都换成一张实心美术，
        // 不再区分“古树只挡树干”，否则玩家会走进神龛/图腾的模型里。
        const hw = w / 2;
        const hh = h / 2;

        return {
            shape: 'box',
            x: Number(landmark.x) || 0,
            y: Number(landmark.y) || 0,
            hw,
            hh,
            turn,
            cos: Math.cos(turn),
            sin: Math.sin(turn),
            type: landmark.type || 'landmark'
        };
    }

    /**
     * 地标数组 -> 碰撞体数组（缓存到调用方，不要每帧重建）。
     * @param {Array} landmarks
     * @returns {Array}
     */
    static build(landmarks) {
        const obstacles = [];
        if (!Array.isArray(landmarks)) return obstacles;
        for (const landmark of landmarks) {
            const obstacle = Collision.fromLandmark(landmark);
            if (obstacle) obstacles.push(obstacle);
        }
        return obstacles;
    }

    /**
     * 圆形实体是否与任意障碍物相交。
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {Array} obstacles
     * @returns {boolean}
     */
    static hits(x, y, radius, obstacles) {
        if (!obstacles || obstacles.length === 0) return false;
        for (let i = 0; i < obstacles.length; i++) {
            if (Collision._hitsOne(x, y, radius, obstacles[i])) return true;
        }
        return false;
    }

    static _hitsOne(x, y, radius, obstacle) {
        const r = Math.max(0, radius || 0);
        if (obstacle.shape === 'circle') {
            const dx = x - obstacle.x;
            const dy = y - obstacle.y;
            const reach = r + obstacle.r;
            return dx * dx + dy * dy < reach * reach;
        }

        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const lx = dx * obstacle.cos + dy * obstacle.sin;
        const ly = -dx * obstacle.sin + dy * obstacle.cos;
        const cx = lx < -obstacle.hw ? -obstacle.hw : lx > obstacle.hw ? obstacle.hw : lx;
        const cy = ly < -obstacle.hh ? -obstacle.hh : ly > obstacle.hh ? obstacle.hh : ly;
        const ddx = lx - cx;
        const ddy = ly - cy;
        return ddx * ddx + ddy * ddy < r * r;
    }

    /**
     * 把已经陷进障碍物的实体推出来（出生点、击退、闪现、传送后用）。
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {Array} obstacles
     * @returns {{x:number, y:number}}
     */
    static resolve(x, y, radius, obstacles) {
        let px = x;
        let py = y;
        if (!obstacles || obstacles.length === 0) return { x: px, y: py };

        // 多个障碍物重叠时一次推不全，迭代几次收敛。
        for (let pass = 0; pass < 4; pass++) {
            let pushed = false;
            for (let i = 0; i < obstacles.length; i++) {
                const result = Collision._pushOut(px, py, radius, obstacles[i]);
                if (!result) continue;
                px = result.x;
                py = result.y;
                pushed = true;
            }
            if (!pushed) break;
        }
        return { x: px, y: py };
    }

    /**
     * 计算把圆推出单个障碍物的位移；不相交返回 null。
     * @returns {{x:number, y:number}|null}
     */
    static _pushOut(x, y, radius, obstacle) {
        const r = Math.max(0, radius || 0);

        if (obstacle.shape === 'circle') {
            let dx = x - obstacle.x;
            let dy = y - obstacle.y;
            let dist = Math.hypot(dx, dy);
            const reach = r + obstacle.r;
            if (dist >= reach) return null;
            if (dist < 1e-6) {
                dx = 1;
                dy = 0;
                dist = 1;
            }
            const nx = dx / dist;
            const ny = dy / dist;
            const push = reach - dist;
            return { x: x + nx * push, y: y + ny * push };
        }

        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        const lx = dx * obstacle.cos + dy * obstacle.sin;
        const ly = -dx * obstacle.sin + dy * obstacle.cos;
        const inside = Math.abs(lx) <= obstacle.hw && Math.abs(ly) <= obstacle.hh;

        let nlx;
        let nly;
        let push;

        if (inside) {
            // 已经陷进矩形：沿最近的一面推出去（含实体半径）。
            const faceX = obstacle.hw + r - Math.abs(lx);
            const faceY = obstacle.hh + r - Math.abs(ly);
            if (faceX <= faceY) {
                nlx = lx >= 0 ? 1 : -1;
                nly = 0;
                push = faceX;
            } else {
                nlx = 0;
                nly = ly >= 0 ? 1 : -1;
                push = faceY;
            }
        } else {
            const cx = lx < -obstacle.hw ? -obstacle.hw : lx > obstacle.hw ? obstacle.hw : lx;
            const cy = ly < -obstacle.hh ? -obstacle.hh : ly > obstacle.hh ? obstacle.hh : ly;
            const ddx = lx - cx;
            const ddy = ly - cy;
            const dist = Math.hypot(ddx, ddy);
            if (dist >= r) return null;
            if (dist < 1e-6) {
                nlx = 1;
                nly = 0;
                push = r;
            } else {
                nlx = ddx / dist;
                nly = ddy / dist;
                push = r - dist;
            }
        }

        // 本地法线转回世界坐标
        const nx = nlx * obstacle.cos - nly * obstacle.sin;
        const ny = nlx * obstacle.sin + nly * obstacle.cos;
        return { x: x + nx * push, y: y + ny * push };
    }

    /**
     * 玩家式移动：先推出重叠，再尝试整段移动；被挡住时按 X / Y 轴滑动。
     * @param {number} x
     * @param {number} y
     * @param {number} dx
     * @param {number} dy
     * @param {number} radius
     * @param {Array} obstacles
     * @returns {{x:number, y:number}}
     */
    static move(x, y, dx, dy, radius, obstacles) {
        const base = Collision.resolve(x, y, radius, obstacles);
        if (!obstacles || obstacles.length === 0) {
            return { x: base.x + dx, y: base.y + dy };
        }

        if (!Collision.hits(base.x + dx, base.y + dy, radius, obstacles)) {
            return { x: base.x + dx, y: base.y + dy };
        }

        let nx = base.x;
        let ny = base.y;
        if (dx !== 0 && !Collision.hits(nx + dx, ny, radius, obstacles)) {
            nx += dx;
        }
        if (dy !== 0 && !Collision.hits(nx, ny + dy, radius, obstacles)) {
            ny += dy;
        }
        return { x: nx, y: ny };
    }

    /**
     * AI 式移动：正面被挡死时尝试左右偏转绕行，避免妖兽永远顶在树/墙上。
     * 玩家不要用这个，玩家应该只按输入方向滑。
     * @param {number} x
     * @param {number} y
     * @param {number} dx
     * @param {number} dy
     * @param {number} radius
     * @param {Array} obstacles
     * @returns {{x:number, y:number}}
     */
    static steer(x, y, dx, dy, radius, obstacles) {
        const direct = Collision.move(x, y, dx, dy, radius, obstacles);
        if (!obstacles || obstacles.length === 0) return direct;

        const moved = Math.hypot(direct.x - x, direct.y - y);
        const wanted = Math.hypot(dx, dy);
        // 已经走掉大半，说明是贴墙滑动，直接接受。
        if (wanted < 1e-6 || moved >= wanted * 0.5) return direct;

        const base = Collision.resolve(x, y, radius, obstacles);
        const angle = Math.atan2(dy, dx);
        // 先试小角度，再试接近垂直的侧移；不要试反向（会看起来像 AI 乱抖）。
        const offsets = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.5708, -1.5708];
        for (let i = 0; i < offsets.length; i++) {
            const a = angle + offsets[i];
            const tx = base.x + Math.cos(a) * wanted;
            const ty = base.y + Math.sin(a) * wanted;
            if (!Collision.hits(tx, ty, radius, obstacles)) {
                return { x: tx, y: ty };
            }
        }
        return direct;
    }
}

window.Collision = Collision;
