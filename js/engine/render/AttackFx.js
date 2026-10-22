'use strict';

/**
 * AttackFx —— 每个实体独立的攻击特效，以及“特效与判定同源”的几何判定。
 *
 * 约定（改战斗表现前先读）：
 * 1. 特效和判定必须来自同一份几何：`geometry(effect)` 给出
 *    { x, y, a, arcHalf, inner, outer }，绘制严格画在这块扇形里，
 *    `inSector(effect, x, y, r)` 也用这块扇形判定命中。
 *    所以“玩家看到的刀光范围”就是“真正掉血的范围”，不允许另写一套半径/夹角。
 * 2. 每个实体（玩家 + 每一种怪物）都有独立样式：颜色、弧宽、内径、刀数、扫向、粒子形状。
 *    不要再退回 `slash_* / claw_*` 两张共用贴图，也不要把刀光画进角色贴图里
 *    （那会变成“人物自带的攻击特效”，换怪也分不出来）。
 * 3. 玩家攻击朝向来自鼠标（CombatSystem._aimAtMouse 计算 angle/reach），
 *    这里拿到的 `a` 就是鼠标方向，`outer` 就是鼠标到玩家的距离（夹在攻击范围内）。
 */

class AttackFx {
    /**
     * 手写的每实体样式表。新增怪物必须在这里补一条，否则会走 fallback 样式。
     * c1=高光 c2=主色 c3=暗部；arc=扇形半角；inner=内径比例；
     * blades=刀光层数；sweep=扫向；sparks/spark=粒子数量/形状；
     * reachBonus=怪物近战判定额外半径；proj=远程弹体造型。
     * @returns {Record<string, any>}
     */
    static _buildStyles() {
        return {
            /* ===== 玩家：中距离扇形剑光（范围由 G.range 决定，可随功法成长） ===== */
            player: {
                label: '青云剑光', kind: 'blade', shape: 'fan', rangeMul: 1,
                c1: '#ffffff', c2: '#7df9ff', c3: '#2f7bff',
                arc: 0.95, inner: 0.14, blades: 3, sweep: 1, sparks: 14, spark: 'spark',
                life: 0.24, proj: 'orb'
            },

            /* ===== 妖兽 ===== */
            // 三道独立爪痕：三条窄扇区，比普通扇形更贴身、更凶
            wolf: {
                label: '灰风狼·裂爪', kind: 'claw', shape: 'claw', rangeMul: 0.95,
                c1: '#ffe9c9', c2: '#b9c9dd', c3: '#5f7285',
                arc: 0.42, inner: 0.18, laneSpread: 0.42, laneHalf: 0.1, lanes: 3, blades: 3, sweep: -1,
                sparks: 8, spark: 'shard', life: 0.22, proj: 'orb'
            },
            // 超大张角音啸：近身但横向极宽
            bat: {
                label: '血翼蝠·音啸', kind: 'sound', shape: 'fan', rangeMul: 1.05,
                c1: '#ffd6f5', c2: '#ff7ad9', c3: '#8a2a6a',
                arc: 1.25, inner: 0.1, blades: 3, sweep: 1, sparks: 6, spark: 'note',
                life: 0.26, proj: 'orb'
            },
            // 远程妖蛛：结网范围比普通近战长
            spider: {
                label: '毒玉蛛·缚网', kind: 'web', shape: 'fan', rangeMul: 1.3,
                c1: '#e8ffc0', c2: '#9fe36b', c3: '#3f6f2f',
                arc: 1.05, inner: 0.16, blades: 2, sweep: 1, sparks: 9, spark: 'droplet',
                life: 0.26, proj: 'orb'
            },
            // 骷髅弓手：骨矛突刺，又细又长
            skeleton: {
                label: '骷髅弓手·骨矛', kind: 'bone', shape: 'thrust', rangeMul: 1.6,
                c1: '#fff7e0', c2: '#e4d6ae', c3: '#7a6a45',
                width: 9, lanes: 1, spark: 'bone', sparks: 8, life: 0.24, proj: 'arrow'
            },
            // 赤甲魈：砸地冲击环，360° 近身 AoE
            brute: {
                label: '赤甲魈·碎岳', kind: 'slam', shape: 'ring', rangeMul: 1.0,
                c1: '#ffe0cc', c2: '#ff7a5a', c3: '#8f2f1e',
                width: 18, spark: 'debris', sparks: 12, life: 0.3, proj: 'orb'
            },
            // 裂岩犀：更大的地裂环
            charger: {
                label: '裂岩犀·地裂', kind: 'quake', shape: 'ring', rangeMul: 1.15,
                c1: '#ffe6bf', c2: '#e8a050', c3: '#6a4218',
                width: 22, spark: 'debris', sparks: 14, life: 0.32, proj: 'orb'
            },
            // 巫祝：藤蔓够得远
            shaman: {
                label: '枯木巫祝·缠藤', kind: 'vine', shape: 'fan', rangeMul: 1.45,
                c1: '#e9ffd6', c2: '#8fe07a', c3: '#3d6f34',
                arc: 1.0, inner: 0.16, blades: 3, sweep: 1, sparks: 10, spark: 'leaf',
                life: 0.3, proj: 'orb'
            },
            wraith: {
                label: '幽冥游魂·摄魄', kind: 'void', shape: 'fan', rangeMul: 1.15,
                c1: '#e2d0ff', c2: '#b694ed', c3: '#3a2260',
                arc: 0.95, inner: 0.12, blades: 2, sweep: 1, sparks: 9, spark: 'wisp',
                life: 0.28, proj: 'orb'
            },
            // 软泥：溅射扇形，宽而短
            slime: {
                label: '吞灵软泥·腐液', kind: 'acid', shape: 'fan', rangeMul: 0.95,
                c1: '#d6fff5', c2: '#66e0c8', c3: '#1f6f5e',
                arc: 1.25, inner: 0.1, blades: 2, sweep: 1, sparks: 10, spark: 'bubble',
                life: 0.28, proj: 'orb'
            },
            // 幼体：极小范围
            slimelet: {
                label: '软泥幼体·酸滴', kind: 'acid', shape: 'fan', rangeMul: 0.6,
                c1: '#f2fff8', c2: '#9be8bd', c3: '#3f7a55',
                arc: 0.7, inner: 0.24, blades: 2, sweep: -1, sparks: 6, spark: 'bubble',
                life: 0.2, proj: 'orb'
            },
            frostwitch: {
                label: '寒魄妖姬·冰棱', kind: 'frost', shape: 'fan', rangeMul: 1.4,
                c1: '#f2feff', c2: '#8cecff', c3: '#2f72a0',
                arc: 1.0, inner: 0.12, blades: 3, sweep: -1, sparks: 10, spark: 'shard',
                life: 0.26, proj: 'shard'
            },
            // 魔将：交叉血斩（X 形双刀）
            elite: {
                label: '魔将·血煞', kind: 'blood', shape: 'cross', rangeMul: 1.1,
                c1: '#ffd6de', c2: '#ff4d6a', c3: '#7a1020',
                arc: 1.15, inner: 0.12, width: 10, spark: 'droplet', sparks: 12, life: 0.3, proj: 'orb'
            },
            // 赤鳞蟒：巨型龙噬，范围最大的扇形
            boss: {
                label: '赤鳞蟒·龙噬', kind: 'maw', shape: 'fan', rangeMul: 1.6,
                c1: '#fff0c2', c2: '#ffb03c', c3: '#9a2410',
                arc: 1.35, inner: 0.08, blades: 2, sweep: 1, sparks: 16, spark: 'ember',
                life: 0.34, proj: 'ember'
            },
            qingyunBoss: {
                label: '赤鳞蟒·青鳞噬', kind: 'maw', shape: 'fan', rangeMul: 1.4,
                c1: '#fff7d6', c2: '#7de8d8', c3: '#1f6f7a',
                arc: 1.2, inner: 0.1, blades: 2, sweep: -1, sparks: 14, spark: 'shard',
                life: 0.32, proj: 'ember'
            },
            emberBoss: {
                label: '熔岩地龙·岩焰', kind: 'flame', shape: 'fan', rangeMul: 1.55,
                c1: '#fff2b8', c2: '#ff743e', c3: '#8a1f08',
                arc: 1.25, inner: 0.1, blades: 3, sweep: 1, sparks: 16, spark: 'ember',
                life: 0.34, proj: 'ember'
            },
            frostBoss: {
                label: '寒潭蛟王·霜噬', kind: 'frost', shape: 'fan', rangeMul: 1.55,
                c1: '#ffffff', c2: '#a8ecff', c3: '#2f6f9a',
                arc: 1.28, inner: 0.08, blades: 3, sweep: -1, sparks: 16, spark: 'shard',
                life: 0.34, proj: 'shard'
            },
            // 镇墓兽：360° 镇魂符环
            netherBoss: {
                label: '幽墟镇墓兽·镇魂', kind: 'void', shape: 'ring', rangeMul: 1.35,
                c1: '#f0e2ff', c2: '#b388e8', c3: '#3a1a5a',
                width: 26, spark: 'rune', sparks: 18, life: 0.38, proj: 'orb'
            },

            /* ===== 人形敌手 ===== */
            bandit: {
                label: '拦路山匪·劈山', kind: 'blade', shape: 'fan', rangeMul: 1.0,
                c1: '#ffe8c4', c2: '#d9b57a', c3: '#6a4a22',
                arc: 0.82, inner: 0.2, blades: 1, sweep: 1, sparks: 6, spark: 'debris',
                life: 0.24, proj: 'orb'
            },
            cultist: {
                label: '魔道散修·阴掌', kind: 'palm', shape: 'fan', rangeMul: 1.15,
                c1: '#ffd6e0', c2: '#c96a72', c3: '#4a1620',
                arc: 0.9, inner: 0.16, blades: 1, sweep: -1, sparks: 7, spark: 'rune',
                life: 0.3, proj: 'orb'
            },
            // 浪人：居合突刺，细长的直刺
            ronin: {
                label: '浪人剑客·居合', kind: 'blade', shape: 'thrust', rangeMul: 1.5,
                c1: '#f2faff', c2: '#d6e6ff', c3: '#4a6382',
                width: 6, lanes: 1, spark: 'spark', sparks: 7, life: 0.18, proj: 'orb'
            },
            fire_cultist: {
                label: '赤炎邪修·烈焰掌', kind: 'flame', shape: 'fan', rangeMul: 1.2,
                c1: '#fff0b8', c2: '#ff8a3c', c3: '#8a2408',
                arc: 1.0, inner: 0.16, blades: 3, sweep: 1, sparks: 10, spark: 'ember',
                life: 0.28, proj: 'ember'
            },
            // 探子：三根毒针并列突刺
            demon_spy: {
                label: '魔道探子·毒针', kind: 'dart', shape: 'thrust', rangeMul: 1.55,
                c1: '#ffd6ec', c2: '#e66ac8', c3: '#6a1a4a',
                width: 4, lanes: 3, laneGap: 14, spark: 'spark', sparks: 5, life: 0.16, proj: 'orb'
            },
            // 影杀：交叉影刃
            shadow_assassin: {
                label: '影杀·影刃', kind: 'shadow', shape: 'cross', rangeMul: 1.3,
                c1: '#e8dcff', c2: '#8f6fd0', c3: '#20103a',
                arc: 0.95, inner: 0.1, width: 8, spark: 'wisp', sparks: 8, life: 0.22, proj: 'orb'
            },
            ice_sword: {
                label: '寒潭剑仆·霜剑', kind: 'frost', shape: 'fan', rangeMul: 1.2,
                c1: '#f6ffff', c2: '#8ecfe6', c3: '#2f6f8a',
                arc: 0.85, inner: 0.14, blades: 2, sweep: 1, sparks: 8, spark: 'shard',
                life: 0.22, proj: 'shard'
            },
            // 守境人：震盾，贴身环形
            frost_guardian: {
                label: '守境人·震盾', kind: 'bash', shape: 'ring', rangeMul: 0.9,
                c1: '#f0ffff', c2: '#9fe7f2', c3: '#2f6f7a',
                width: 20, spark: 'shard', sparks: 8, life: 0.28, proj: 'orb'
            },
            // 剑术教习：四道剑意，多段窄扇区
            // 剑术教习：五道剑意，多段窄扇区
            sword_master: {
                label: '剑术教习·剑意', kind: 'blade', shape: 'lobes', rangeMul: 1.3,
                c1: '#fff4d2', c2: '#d6c08a', c3: '#6a4f22',
                lanes: 5, laneSpread: 0.24, laneHalf: 0.08, sweep: 1, spark: 'spark', sparks: 10,
                life: 0.26, proj: 'orb'
            },
            // 护院：极大张角横扫
            guardian: {
                label: '青云护院·横扫', kind: 'sweep', shape: 'fan', rangeMul: 1.25,
                c1: '#eef4ff', c2: '#a8b6c4', c3: '#43535f',
                arc: 1.42, inner: 0.16, blades: 1, sweep: -1, sparks: 8, spark: 'debris',
                life: 0.3, proj: 'orb'
            },
            // 引魂人：超长镰光
            soul_reaper: {
                label: '引魂人·夺魄镰', kind: 'scythe', shape: 'fan', rangeMul: 1.5,
                c1: '#f0e2ff', c2: '#c9a8f0', c3: '#30144a',
                arc: 1.05, inner: 0.05, blades: 1, sweep: 1, sparks: 10, spark: 'wisp',
                life: 0.32, proj: 'orb'
            }
        };
    }

    /** @returns {Record<string, any>} */
    static styles() {
        if (!this._styles) this._styles = this._buildStyles();
        return this._styles;
    }

    /** 怪物/玩家统一取样式键 */
    static keyFor(entityOrKey) {
        if (typeof entityOrKey === 'string') return this._resolveKey(entityOrKey);
        if (!entityOrKey) return 'player';
        return this._resolveKey(entityOrKey.id || entityOrKey.type || 'wolf');
    }

    /**
     * 决斗对手的 id 是 `duel_<npcId>`，没有 MONSTERS 条目；
     * 这里映射到气质相近的人形敌手样式，未知 NPC 则用 npcId 生成独特兜底样式。
     */
    static _resolveKey(key) {
        if (typeof key !== 'string' || key.indexOf('duel_') !== 0) return key;
        const npcId = key.slice(5);
        const map = {
            guqinghan: 'ice_sword',
            zhaotieyi: 'sword_master',
            ashi: 'guardian',
            jichang: 'soul_reaper',
            hanxing: 'frost_guardian',
            mochen: 'shadow_assassin',
            shenli: 'bandit',
            linyue: 'ronin',
            suwan: 'cultist',
            ningxiao: 'ronin'
        };
        return map[npcId] || npcId;
    }

    /** @returns {any} */
    static styleFor(entityOrKey) {
        const key = this.keyFor(entityOrKey);
        const table = this.styles();
        return table[key] || this._fallbackStyle(key);
    }

    /** 玩家样式：保留剑诀/元素/进化的颜色差异，但几何仍然只有一份 */
    static playerStyle(mods) {
        const base = this.styleFor('player');
        const style = Object.assign({}, base, { pal: [base.c1, base.c2, base.c3] });
        const m = mods || {};
        if (m.evoBlade) {
            style.c1 = '#fffbe0';
            style.c2 = '#ffd86b';
            style.c3 = '#c98a1c';
            style.pal = [style.c1, style.c2, style.c3];
            style.spark = 'rune';
            style.sparks = 18;
            style.blades = 4;
        } else if (m.elemIce) {
            style.c1 = '#f4feff';
            style.c2 = '#8beaff';
            style.c3 = '#2f6fa8';
            style.pal = [style.c1, style.c2, style.c3];
            style.spark = 'shard';
            style.sparks = 14;
        } else if (m.elemFire) {
            style.c1 = '#fff3c4';
            style.c2 = '#ff8a4c';
            style.c3 = '#a8240c';
            style.pal = [style.c1, style.c2, style.c3];
            style.spark = 'ember';
            style.sparks = 16;
        }
        if (m.doubleHit) style.blades = Math.min(4, style.blades + 1);
        if (m.pierce) style.arc = Math.min(1.2, style.arc + 0.06);
        if (m.dashStrike) style.life = Math.max(style.life, 0.28);
        return style;
    }

    /** 未知实体：用 id 的哈希生成一套稳定且唯一的样式，避免又退回共用贴图 */
    static _fallbackStyle(key) {
        const kinds = ['blade', 'claw', 'shard', 'sound', 'web', 'vine', 'void', 'blood', 'palm', 'flame'];
        const pals = [
            ['#ffffff', '#ff9b63', '#7a2a10'],
            ['#f2ffff', '#8cecff', '#2f6f9a'],
            ['#ffe9ff', '#d08af0', '#4a1a6a'],
            ['#eaffe0', '#9fe36b', '#3a6a2a'],
            ['#fff3d0', '#ffd166', '#7a5210'],
            ['#ffe0e8', '#ff7a90', '#6a1020'],
            ['#e6f0ff', '#8fb4ff', '#2f4a8a'],
            ['#fff6e0', '#d6b07a', '#6a4a22']
        ];
        const sparkShapes = ['spark', 'shard', 'ember', 'droplet', 'rune', 'wisp'];
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 9973;
        const pal = pals[hash % pals.length];
        return {
            label: key + '·攻击',
            kind: kinds[hash % kinds.length],
            shape: ['fan', 'thrust', 'ring', 'cross', 'lobes', 'claw'][(hash >> 2) % 6],
            rangeMul: 0.8 + ((hash >> 4) % 9) * 0.1,
            c1: pal[0], c2: pal[1], c3: pal[2],
            arc: 0.7 + ((hash >> 3) % 7) * 0.08,
            inner: 0.14 + ((hash >> 5) % 5) * 0.04,
            blades: 1 + ((hash >> 6) % 3),
            sweep: (hash % 2) ? -1 : 1,
            sparks: 6 + ((hash >> 7) % 8),
            spark: sparkShapes[(hash >> 8) % sparkShapes.length],
            width: 6 + ((hash >> 9) % 3) * 4,
            lanes: 1 + ((hash >> 10) % 3),
            laneSpread: 0.35 + ((hash >> 11) % 4) * 0.08,
            laneHalf: 0.08,
            laneGap: 12,
            life: 0.2 + ((hash >> 9) % 4) * 0.03,
            proj: 'orb'
        };
    }

    /**
     * 怪物攻击距离：体型 + 样式 rangeMul 决定。
     * 同一个数字同时给 AI 出手距离、特效半径与命中判定 —— 三者必须一致。
     * @param {any} monster
     * @param {number} [targetRadius]
     */
    static reachForMonster(monster, targetRadius) {
        const style = this.styleFor(monster);
        const r = Number(monster && monster.r) || 16;
        const tr = Number.isFinite(targetRadius) ? targetRadius : 16;
        const base = 28 + r * 0.9;
        return Math.max(r + tr + 12, base * (style.rangeMul || 1));
    }

    /**
     * 统一几何：绘制与命中都用它。
     * @param {any} e
     * @returns {{x:number,y:number,a:number,arcHalf:number,inner:number,outer:number}}
     */
    static geometry(e) {
        const arcRaw = Number.isFinite(e.arcHalf) ? e.arcHalf : (Number.isFinite(e.arc) ? e.arc : 1.1);
        const outer = Math.max(10, Number.isFinite(e.r) ? e.r : 46);
        let inner = Number.isFinite(e.innerR) ? e.innerR : outer * 0.18;
        inner = Math.max(0, Math.min(inner, outer - 6));
        return {
            x: Number.isFinite(e.x) ? e.x : 0,
            y: Number.isFinite(e.y) ? e.y : 0,
            a: Number.isFinite(e.a) ? e.a : (Number.isFinite(e.angle) ? e.angle : 0),
            arcHalf: Math.max(0.08, Math.min(Math.PI, arcRaw)),
            inner,
            outer
        };
    }

    /**
     * 形状描述（局部坐标以 +x 为攻击方向）。
     * type: fan 扇形 / thrust 突刺 / ring 环形冲击 / cross 交叉斩 / lobes 多道剑意 / claw 多道爪痕
     */
    static shapeOf(e) {
        const geo = this.geometry(e);
        const style = this.styleFor(e.fx || (e.monster ? 'wolf' : 'player'));
        return {
            type: e.shape || style.shape || 'fan',
            x: geo.x, y: geo.y, a: geo.a,
            reach: geo.outer,
            arcHalf: geo.arcHalf,
            inner: geo.inner,
            width: Number.isFinite(e.width) ? e.width : (style.width || 12),
            lanes: Number.isFinite(e.lanes) ? e.lanes : (style.lanes || 1),
            laneGap: Number.isFinite(e.laneGap) ? e.laneGap : (style.laneGap || 14),
            laneSpread: Number.isFinite(e.laneSpread) ? e.laneSpread : (style.laneSpread || 0.45),
            laneHalf: Number.isFinite(e.laneHalf) ? e.laneHalf : (style.laneHalf || 0.1)
        };
    }

    /**
     * 形状 -> 局部图元。sector(扇形) / capsule(胶囊突刺) / annulus(环带)。
     * 每种图元的判定都与绘制共用同一参数。
     * @param {any} e
     * @returns {{shape:any, parts:any[]}}
     */
    static localParts(e) {
        const s = this.shapeOf(e);
        const parts = [];
        const reach = s.reach;
        if (s.type === 'thrust') {
            const lanes = Math.max(1, s.lanes);
            for (let i = 0; i < lanes; i++) {
                const off = (i - (lanes - 1) / 2) * s.laneGap;
                parts.push({ kind: 'capsule', x1: 0, y1: off, x2: reach, y2: off, r: Math.max(2, s.width) });
            }
        } else if (s.type === 'ring') {
            const inner = Math.max(0, reach - Math.max(6, s.width));
            parts.push({ kind: 'annulus', inner, outer: reach });
        } else if (s.type === 'cross') {
            // 交叉斩：命中区域是整块扇形，视觉上由两道反向刀光在正中交叉（X 形）
            parts.push({ kind: 'sector', a: 0, arcHalf: Math.max(0.35, s.arcHalf), inner: s.inner, outer: reach });
        } else if (s.type === 'claw' || s.type === 'lobes') {
            const lanes = Math.max(1, s.lanes || 3);
            for (let i = 0; i < lanes; i++) {
                const ang = (i - (lanes - 1) / 2) * s.laneSpread;
                parts.push({ kind: 'sector', a: ang, arcHalf: s.laneHalf, inner: s.inner, outer: reach });
            }
        } else {
            parts.push({ kind: 'sector', a: 0, arcHalf: s.arcHalf, inner: s.inner, outer: reach });
        }
        return { shape: s, parts };
    }

    /** 局部坐标下目标圆是否落在图元里 */
    static _containsLocal(part, lx, ly, tr) {
        if (part.kind === 'sector') {
            const dist = Math.hypot(lx, ly);
            if (dist > part.outer + tr || dist < part.inner - tr) return false;
            if (dist <= 0.0001) return true;
            const diff = Math.abs(MathUtils.angleDiff(Math.atan2(ly, lx), part.a));
            if (diff <= part.arcHalf) return true;
            const extra = Math.asin(Math.min(1, tr / Math.max(dist, tr)));
            return diff <= part.arcHalf + extra;
        }
        if (part.kind === 'annulus') {
            const dist = Math.hypot(lx, ly);
            return dist <= part.outer + tr && dist >= part.inner - tr;
        }
        const vx = part.x2 - part.x1;
        const vy = part.y2 - part.y1;
        const len2 = vx * vx + vy * vy || 1;
        let t = ((lx - part.x1) * vx + (ly - part.y1) * vy) / len2;
        t = Math.max(0, Math.min(1, t));
        const dx = lx - (part.x1 + vx * t);
        const dy = ly - (part.y1 + vy * t);
        return dx * dx + dy * dy <= (part.r + tr) * (part.r + tr);
    }

    /**
     * 命中判定：目标圆是否与特效形状相交（扇形 / 突刺 / 环带 / 多段）。
     * 与 draw() 的 clip 来自同一份 localParts()。
     * @param {any} e 特效（或构造了同样字段的临时对象）
     * @param {number} tx
     * @param {number} ty
     * @param {number} tr 目标半径
     */
    static inSector(e, tx, ty, tr) {
        const { shape, parts } = this.localParts(e);
        const dx = tx - shape.x;
        const dy = ty - shape.y;
        const cos = Math.cos(shape.a);
        const sin = Math.sin(shape.a);
        const lx = dx * cos + dy * sin;
        const ly = -dx * sin + dy * cos;
        const radius = Math.max(0, tr || 0);
        for (const part of parts) {
            if (this._containsLocal(part, lx, ly, radius)) return true;
        }
        return false;
    }

    /**
     * 生成一条攻击特效（type 仍是 slash，保持旧存档/调试兼容）。
     * @param {any} opts
     */
    static makeEffect(opts) {
        const fx = opts.fx || 'player';
        const style = this.styleFor(fx);
        const outer = Math.max(10, opts.reach || 46);
        const arcHalf = Number.isFinite(opts.arcHalf) ? opts.arcHalf : style.arc;
        const innerR = Number.isFinite(opts.innerR) ? opts.innerR : outer * (style.inner || 0.18);
        const pick = (value, fallback) => (Number.isFinite(value) ? value : fallback);
        return {
            type: 'slash',
            fx,
            x: opts.x,
            y: opts.y,
            a: Number.isFinite(opts.angle) ? opts.angle : 0,
            r: outer,
            arcHalf,
            innerR,
            shape: opts.shape || style.shape || 'fan',
            width: pick(opts.width, style.width || 12),
            lanes: pick(opts.lanes, style.lanes || 1),
            laneGap: pick(opts.laneGap, style.laneGap || 14),
            laneSpread: pick(opts.laneSpread, style.laneSpread || 0.45),
            laneHalf: pick(opts.laneHalf, style.laneHalf || 0.1),
            pal: opts.pal || [style.c1, style.c2, style.c3],
            kind: opts.kind || style.kind,
            blades: opts.blades || style.blades || 1,
            sweep: opts.sweep || style.sweep || 1,
            spark: opts.spark || style.spark,
            seeds: Number.isFinite(opts.seeds) ? opts.seeds : (style.sparks || 8),
            t: 0,
            life: opts.life || style.life || 0.24,
            seed: Number.isFinite(opts.seed) ? opts.seed : Math.random() * 997,
            monster: !!opts.monster
        };
    }

    /** 绘制一条攻击特效：先把绘制裁剪到与判定完全相同的图元，再按形状画 */
    static draw(ctx, e) {
        if (!e || !ctx) return;
        const { shape, parts } = this.localParts(e);
        if (shape.reach <= 6 || !parts.length) return;
        const style = this.styleFor(e.fx || (e.monster ? 'wolf' : 'player'));
        const pal = e.pal || [style.c1, style.c2, style.c3];
        const life = Math.max(0.05, e.life || style.life || 0.24);
        const prog = Math.max(0, Math.min(1, (e.t || 0) / life));
        const alpha = Math.pow(1 - prog, 0.8);
        if (alpha <= 0.01) return;
        const cfg = {
            kind: e.kind || style.kind,
            blades: e.blades || style.blades || 1,
            sweep: e.sweep || style.sweep || 1,
            spark: e.spark || style.spark,
            sparkCount: Number.isFinite(e.seeds) ? e.seeds : (style.sparks || 8)
        };
        ctx.save();
        ctx.translate(shape.x, shape.y);
        ctx.rotate(shape.a);
        ctx.beginPath();
        for (const part of parts) this._clipPart(ctx, part);
        ctx.clip();
        this._paint(ctx, shape, parts, cfg, pal, e.seed || 0, prog, alpha);
        ctx.restore();
    }

    /** 把图元写进当前 path（用于 clip） */
    static _clipPart(ctx, part) {
        if (part.kind === 'sector') {
            const inner = Math.max(0, part.inner);
            ctx.moveTo(Math.cos(part.a - part.arcHalf) * inner, Math.sin(part.a - part.arcHalf) * inner);
            ctx.arc(0, 0, part.outer, part.a - part.arcHalf, part.a + part.arcHalf);
            ctx.arc(0, 0, inner, part.a + part.arcHalf, part.a - part.arcHalf, true);
            ctx.closePath();
        } else if (part.kind === 'annulus') {
            ctx.moveTo(part.outer, 0);
            ctx.arc(0, 0, part.outer, 0, Math.PI * 2);
            ctx.moveTo(part.inner, 0);
            ctx.arc(0, 0, part.inner, Math.PI * 2, 0, true);
            ctx.closePath();
        } else {
            const ang = Math.atan2(part.y2 - part.y1, part.x2 - part.x1);
            ctx.arc(part.x2, part.y2, part.r, ang - Math.PI / 2, ang + Math.PI / 2);
            ctx.arc(part.x1, part.y1, part.r, ang + Math.PI / 2, ang - Math.PI / 2);
            ctx.closePath();
        }
    }

    /** 远程怪的攻击特效：弹体也按实体区分造型 */
    static drawProjectile(ctx, b) {
        if (!b || !ctx) return;
        const style = this.styleFor(b.fx || 'wolf');
        const pal = b.pal || [style.c1, style.c2, style.c3];
        const r = Math.max(3, b.r || 6);
        const shape = b.proj || style.proj || 'orb';
        const ang = Math.atan2(b.vy || 0, b.vx || 1);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        this._flare(ctx, 0, 0, r * 2.2, pal[2], 0.55);
        if (shape === 'arrow') {
            ctx.strokeStyle = pal[1];
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-r * 1.6, 0);
            ctx.lineTo(r * 1.2, 0);
            ctx.stroke();
            ctx.fillStyle = pal[0];
            ctx.beginPath();
            ctx.moveTo(r * 1.7, 0);
            ctx.lineTo(r * 0.7, -r * 0.55);
            ctx.lineTo(r * 0.7, r * 0.55);
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'shard') {
            ctx.fillStyle = pal[1];
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(r * 1.7, 0);
            ctx.lineTo(0, -r * 0.7);
            ctx.lineTo(-r * 1.1, 0);
            ctx.lineTo(0, r * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = pal[0];
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
            grad.addColorStop(0, this._rgba(pal[0], 0.95));
            grad.addColorStop(0.5, this._rgba(pal[1], 0.8));
            grad.addColorStop(1, this._rgba(pal[2], 0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /* ================= 绘制实现 ================= */

    static _paint(ctx, shape, parts, cfg, pal, seed, prog, alpha) {
        const type = shape.type;
        if (type === 'thrust') {
            this._paintThrust(ctx, shape, cfg, pal, prog, alpha);
        } else if (type === 'ring') {
            this._paintRing(ctx, shape, cfg, pal, seed, prog, alpha);
        } else if (type === 'cross') {
            this._paintCross(ctx, shape, cfg, pal, seed, prog, alpha);
        } else if (type === 'lobes') {
            this._paintLobes(ctx, shape, cfg, pal, prog, alpha);
        } else if (type === 'claw') {
            this._paintClawLanes(ctx, shape, cfg, pal, seed, prog, alpha);
        } else {
            const geo = { outer: shape.reach, inner: shape.inner, arcHalf: shape.arcHalf };
            const kind = cfg.kind;
            if (kind !== 'sound' && kind !== 'void' && kind !== 'shadow') {
                this._wedge(ctx, geo, pal, alpha);
            }
            switch (kind) {
                case 'claw': this._paintClaw(ctx, geo, cfg, pal, seed, prog, alpha); break;
                case 'sound': this._paintSound(ctx, geo, cfg, pal, prog, alpha); break;
                case 'web': this._paintWeb(ctx, geo, pal, seed, prog, alpha); break;
                case 'bone': this._paintBone(ctx, geo, pal, seed, prog, alpha); break;
                case 'slam': this._paintSlam(ctx, geo, pal, seed, prog, alpha); break;
                case 'quake': this._paintQuake(ctx, geo, pal, seed, prog, alpha); break;
                case 'vine': this._paintVine(ctx, geo, pal, seed, prog, alpha); break;
                case 'void': this._paintVoid(ctx, geo, pal, seed, prog, alpha); break;
                case 'acid': this._paintAcid(ctx, geo, pal, seed, prog, alpha); break;
                case 'frost': this._paintFrost(ctx, geo, pal, seed, prog, alpha); break;
                case 'blood': this._paintBlood(ctx, geo, pal, prog, alpha); break;
                case 'maw': this._paintMaw(ctx, geo, pal, prog, alpha); break;
                case 'palm': this._paintPalm(ctx, geo, pal, prog, alpha); break;
                case 'flame': this._paintFlame(ctx, geo, pal, seed, prog, alpha); break;
                case 'dart': this._paintDart(ctx, geo, pal, prog, alpha); break;
                case 'shadow': this._paintShadow(ctx, geo, pal, prog, alpha); break;
                case 'sweep': this._paintSweep(ctx, geo, pal, prog, alpha); break;
                case 'bash': this._paintBash(ctx, geo, pal, prog, alpha); break;
                case 'scythe': this._paintScythe(ctx, geo, pal, seed, prog, alpha); break;
                default: this._paintBlade(ctx, geo, cfg, pal, prog, alpha); break;
            }
        }
        this._particles(ctx, shape, cfg, pal, seed, prog, alpha);
    }

    /** 突刺：细长的枪/剑/毒针，长度与宽度按实体区分 */
    static _paintThrust(ctx, shape, cfg, pal, prog, alpha) {
        const lanes = Math.max(1, shape.lanes);
        const ease = 1 - Math.pow(1 - prog, 2);
        const len = shape.reach * (0.35 + 0.65 * ease);
        for (let i = 0; i < lanes; i++) {
            const off = (i - (lanes - 1) / 2) * shape.laneGap;
            ctx.beginPath();
            ctx.moveTo(0, off);
            ctx.lineTo(len, off);
            ctx.strokeStyle = pal[1];
            ctx.lineWidth = Math.max(1.5, shape.width * 1.5) * (1 - prog * 0.5) + 1;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.7;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, off);
            ctx.lineTo(len, off);
            ctx.strokeStyle = pal[0];
            ctx.lineWidth = Math.max(1.2, shape.width * 0.55);
            ctx.globalAlpha = alpha;
            ctx.stroke();
            this._flare(ctx, len, off, Math.max(7, shape.width * 2), pal[0], alpha);
        }
        // 速度线：只画在图元内部
        for (let i = 0; i < 5; i++) {
            const off = (i - 2) * shape.width * 1.3;
            const l0 = len * (0.35 + (i % 3) * 0.12);
            ctx.beginPath();
            ctx.moveTo(l0 * 0.7, off);
            ctx.lineTo(l0, off);
            ctx.strokeStyle = i % 2 ? pal[2] : pal[1];
            ctx.lineWidth = 1.3;
            ctx.globalAlpha = alpha * 0.45;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    /** 环形冲击：360° 冲击波，用于砸地/地裂/震盾/镇魂 */
    static _paintRing(ctx, shape, cfg, pal, seed, prog, alpha) {
        const outer = shape.reach;
        const inner = Math.max(0, outer - Math.max(6, shape.width));
        const ease = 1 - Math.pow(1 - prog, 2);
        const radius = inner + (outer - inner) * (0.15 + 0.85 * ease);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = Math.max(2, shape.width * 0.55) * (1 - prog * 0.5) + 1;
        ctx.globalAlpha = alpha * 0.9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = Math.max(1.2, shape.width * 0.16);
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, inner + (outer - inner) * 0.3 * ease, 0, Math.PI * 2);
        ctx.strokeStyle = pal[2];
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.5;
        ctx.stroke();
        if (cfg.kind === 'quake' || cfg.kind === 'slam') {
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4 + 0.3;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * inner * 0.75, Math.sin(a) * inner * 0.75);
                ctx.lineTo(Math.cos(a) * Math.min(outer, radius + 4), Math.sin(a) * Math.min(outer, radius + 4));
                ctx.strokeStyle = pal[2];
                ctx.globalAlpha = alpha * 0.45;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        } else if (cfg.kind === 'void') {
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3 + prog * 2;
                this._spark(ctx, 'rune', Math.cos(a) * radius, Math.sin(a) * radius,
                    5.5, a, i % 2 ? pal[0] : pal[1], alpha * 0.85);
            }
        } else if (cfg.kind === 'bash') {
            ctx.beginPath();
            ctx.arc(0, 0, radius, -Math.PI * 0.32, Math.PI * 0.32);
            ctx.strokeStyle = pal[0];
            ctx.lineWidth = 7 * (1 - prog) + 2;
            ctx.globalAlpha = alpha;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    /** 交叉斩：两把长剑在正前方交叉成 X；命中区域是外层扇形 */
    static _paintCross(ctx, shape, cfg, pal, seed, prog, alpha) {
        const arc = shape.arcHalf;
        this._wedge(ctx, { outer: shape.reach, inner: shape.inner, arcHalf: arc }, pal, alpha * 0.55);
        const spread = Math.min(arc * 0.86, 1.0);
        const cx = shape.reach * 0.45;
        const halfLen = shape.reach * 0.62;
        const thick = Math.max(2.5, shape.width * 0.45);
        for (let i = 0; i < 2; i++) {
            const dir = i ? -1 : 1;
            const ux = Math.cos(spread * dir);
            const uy = Math.sin(spread * dir);
            const x1 = cx - ux * halfLen;
            const y1 = -uy * halfLen;
            const x2 = cx + ux * halfLen;
            const y2 = uy * halfLen;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = i ? pal[2] : pal[1];
            ctx.lineWidth = thick * (1 - prog * 0.5) + 1;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * 0.9;
            ctx.stroke();
            ctx.strokeStyle = pal[0];
            ctx.lineWidth = 2;
            ctx.globalAlpha = alpha;
            ctx.stroke();
            this._flare(ctx, x2, y2, thick * 2.2, pal[0], alpha * 0.9);
            this._flare(ctx, x1, y1, thick * 1.2, pal[1], alpha * 0.55);
        }
        ctx.globalAlpha = 1;
    }

    /** 多道剑意：每条窄扇区一束光 */
    static _paintLobes(ctx, shape, cfg, pal, prog, alpha) {
        const n = Math.max(1, shape.lanes);
        const ease = 1 - Math.pow(1 - prog, 2);
        for (let i = 0; i < n; i++) {
            const ang = (i - (n - 1) / 2) * shape.laneSpread;
            const len = shape.reach * (0.3 + 0.7 * ease);
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * shape.reach * 0.08, Math.sin(ang) * shape.reach * 0.08);
            ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
            ctx.strokeStyle = i === Math.floor(n / 2) ? pal[0] : pal[1];
            ctx.lineWidth = 4.5 * (1 - prog * 0.5) + 1;
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * (i === Math.floor(n / 2) ? 1 : 0.7);
            ctx.stroke();
            this._flare(ctx, Math.cos(ang) * len, Math.sin(ang) * len, 6, pal[0], alpha);
        }
        ctx.globalAlpha = 1;
    }

    /** 多道爪痕：每条窄扇区一道带锯齿的抓痕 */
    static _paintClawLanes(ctx, shape, cfg, pal, seed, prog, alpha) {
        const n = Math.max(1, shape.lanes || 3);
        for (let i = 0; i < n; i++) {
            const ang = (i - (n - 1) / 2) * shape.laneSpread;
            const wobble = Math.sin(prog * Math.PI) * 0.02 * (i % 2 ? -1 : 1);
            this._gash(ctx, shape.inner, shape.reach * (0.99 - i * 0.03), ang + wobble,
                4.4 - i * 0.35, i === Math.floor(n / 2) ? pal[0] : pal[1],
                alpha * (0.98 - i * 0.1), seed + i * 7.3);
        }
        this._flare(ctx, shape.reach * 0.9, 0, shape.reach * 0.14, pal[0], alpha);
        ctx.globalAlpha = 1;
    }

    static _wedge(ctx, geo, pal, alpha) {
        const grad = ctx.createRadialGradient(0, 0, geo.inner, 0, 0, geo.outer);
        grad.addColorStop(0, this._rgba(pal[2], 0));
        grad.addColorStop(0.6, this._rgba(pal[1], 0.2 * alpha));
        grad.addColorStop(1, this._rgba(pal[0], 0.42 * alpha));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer, -geo.arcHalf, geo.arcHalf);
        ctx.arc(0, 0, geo.inner, geo.arcHalf, -geo.arcHalf, true);
        ctx.closePath();
        ctx.fill();
    }

    static _paintBlade(ctx, geo, cfg, pal, prog, alpha) {
        const arc = geo.arcHalf;
        const sweep = cfg.sweep || 1;
        const ease = 1 - Math.pow(1 - prog, 2);
        const head = -arc * sweep + 2 * arc * sweep * ease;
        const tail = head - sweep * Math.min(arc * 1.35, 1.0);
        const blades = Math.max(1, cfg.blades || 1);
        for (let i = blades - 1; i >= 0; i--) {
            const radius = geo.outer * (1 - i * 0.075) - 1;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(geo.inner + 2, radius), tail, head, sweep < 0);
            ctx.strokeStyle = i === 0 ? pal[0] : pal[1];
            ctx.globalAlpha = alpha * (i === 0 ? 0.95 : Math.max(0.16, 0.5 - i * 0.1));
            ctx.lineWidth = (7 - i * 1.6) * (1 - prog * 0.7) + 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        this._flare(ctx, Math.cos(head) * geo.outer, Math.sin(head) * geo.outer, geo.outer * 0.18, pal[0], alpha);
        ctx.globalAlpha = 1;
    }

    static _paintClaw(ctx, geo, cfg, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 3; i++) {
            const off = (i - 1) * arc * 0.55;
            const wobble = Math.sin(prog * Math.PI) * 0.05 * (i % 2 ? -1 : 1) * arc;
            this._gash(ctx, geo.inner, geo.outer * (0.98 - i * 0.04), off + wobble,
                3.4 - i * 0.3, i === 1 ? pal[0] : pal[1], alpha * (0.9 - i * 0.12), seed + i * 7.3);
        }
        this._flare(ctx, geo.outer * 0.94, 0, geo.outer * 0.14, pal[0], alpha);
        ctx.globalAlpha = 1;
    }

    static _paintSound(ctx, geo, cfg, pal, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 4; i++) {
            const t = (prog + i * 0.24) % 1;
            const radius = geo.inner + (geo.outer - geo.inner) * (0.15 + t * 0.85);
            ctx.beginPath();
            ctx.arc(0, 0, radius, -arc * (0.75 + i * 0.06), arc * (0.75 + i * 0.06));
            ctx.strokeStyle = i % 2 ? pal[1] : pal[0];
            ctx.lineWidth = 3.5 * (1 - t) + 1;
            ctx.globalAlpha = alpha * Math.max(0, 0.85 - i * 0.16);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    static _paintWeb(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.strokeStyle = pal[1];
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 1.6;
        for (let i = 0; i <= 5; i++) {
            const ang = -arc + 2 * arc * (i / 5);
            const len = geo.outer * (0.9 + 0.1 * this._rand(seed + i * 2.7));
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * geo.inner, Math.sin(ang) * geo.inner);
            ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
            ctx.stroke();
        }
        for (let ring = 1; ring <= 3; ring++) {
            const radius = geo.inner + (geo.outer - geo.inner) * (ring / 3) * (0.85 + 0.15 * prog);
            ctx.beginPath();
            for (let i = 0; i <= 5; i++) {
                const ang = -arc + 2 * arc * (i / 5);
                const x = Math.cos(ang) * radius;
                const y = Math.sin(ang) * radius;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = ring === 2 ? pal[0] : pal[2];
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    static _paintBone(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * (0.93 + 0.05 * prog), -arc * 0.9, arc * 0.9);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = 5 * (1 - prog) + 1.5;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
            const ang = (-0.9 + (i / 5) * 1.8) * arc;
            const dist = geo.inner + (geo.outer - geo.inner) * (0.35 + 0.55 * ((prog + this._rand(seed + i * 3.9)) % 1));
            this._rotRect(ctx, Math.cos(ang) * dist, Math.sin(ang) * dist, 9, 3,
                ang + prog * 2 + this._rand(seed + i), pal[1], alpha * 0.9);
        }
        ctx.globalAlpha = 1;
    }

    static _paintSlam(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.97, -arc, arc);
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = 12 * (1 - prog * 0.6) + 2;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        const ring = geo.inner + (geo.outer - geo.inner) * (0.35 + 0.65 * prog);
        ctx.beginPath();
        ctx.arc(0, 0, ring, -arc, arc);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = 4 * (1 - prog) + 1;
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
            const ang = -arc + 2 * arc * ((i + 0.5) / 4);
            this._crack(ctx, ang, geo.inner, geo.outer * (0.65 + 0.35 * prog), pal[2], alpha);
        }
        ctx.globalAlpha = 1;
    }

    static _paintQuake(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 3; i++) {
            const t = Math.min(1, prog + i * 0.18);
            const radius = geo.inner + (geo.outer - geo.inner) * t;
            ctx.beginPath();
            ctx.arc(0, 0, radius, -arc, arc);
            ctx.strokeStyle = i === 0 ? pal[0] : pal[2];
            ctx.lineWidth = 5 * (1 - t) + 1;
            ctx.globalAlpha = alpha * Math.max(0, 0.8 - i * 0.2);
            ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
            const ang = -arc + 2 * arc * this._rand(seed + i * 3.3);
            const dist = geo.inner + (geo.outer - geo.inner) * (0.35 + 0.5 * prog);
            this._rotRect(ctx, Math.cos(ang) * dist, Math.sin(ang) * dist, 7, 4,
                ang + this._rand(seed + i) * 3, pal[1], alpha * 0.85);
        }
        ctx.globalAlpha = 1;
    }

    static _paintVine(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 3; i++) {
            const base = -arc + 2 * arc * ((i + 0.5) / 3);
            ctx.beginPath();
            for (let s = 0; s <= 8; s++) {
                const t = s / 8;
                const r = geo.inner + (geo.outer - geo.inner) * t;
                const swing = Math.sin(t * Math.PI * 2 + prog * 4 + i) * 0.16 * (1 - t * 0.4);
                const ang = base + swing;
                const x = Math.cos(ang) * r;
                const y = Math.sin(ang) * r;
                if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = i === 1 ? pal[0] : pal[1];
            ctx.lineWidth = 3.5 - i * 0.6;
            ctx.globalAlpha = alpha;
            ctx.stroke();
        }
        for (let i = 0; i < 5; i++) {
            const ang = -arc + 2 * arc * this._rand(seed + i * 5.1);
            const r = geo.inner + (geo.outer - geo.inner) * (0.4 + 0.5 * prog);
            this._leaf(ctx, Math.cos(ang) * r, Math.sin(ang) * r, 6, ang + prog * 3, pal[2], alpha);
        }
        ctx.globalAlpha = 1;
    }

    static _paintVoid(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer, -arc, arc);
        ctx.arc(0, 0, geo.inner, arc, -arc, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(12, 6, 24, ' + (0.55 * alpha) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.98, -arc, arc);
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.85;
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
            const ang = -arc + 2 * arc * this._rand(seed + i * 4.7);
            const dist = geo.outer * (1 - 0.65 * prog) * (0.5 + 0.5 * this._rand(seed + i * 2.1));
            this._flare(ctx, Math.cos(ang) * dist, Math.sin(ang) * dist, 5 * (1 - prog), pal[0], alpha);
        }
        ctx.globalAlpha = 1;
    }

    static _paintAcid(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 7; i++) {
            const ang = -arc + 2 * arc * this._rand(seed + i * 3.7);
            const t = (prog + this._rand(seed + i) * 0.2) % 1;
            const dist = geo.inner + (geo.outer - geo.inner) * (0.22 + 0.72 * t);
            const size = (3.5 + this._rand(seed + i * 1.9) * 5) * (1 - t * 0.4);
            ctx.beginPath();
            ctx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, size, 0, Math.PI * 2);
            ctx.fillStyle = i % 2 ? pal[0] : pal[1];
            ctx.globalAlpha = alpha * (1 - t * 0.5);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    static _paintFrost(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 7; i++) {
            const ang = -arc + 2 * arc * ((i + 0.5) / 7);
            const len = (geo.outer - geo.inner) * (0.55 + 0.4 * this._rand(seed + i * 2.7));
            const w = 0.03 + 0.02 * this._rand(seed + i);
            const r0 = geo.inner;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
            ctx.lineTo(Math.cos(ang - w) * (r0 + len * 0.6), Math.sin(ang - w) * (r0 + len * 0.6));
            ctx.lineTo(Math.cos(ang) * (r0 + len), Math.sin(ang) * (r0 + len));
            ctx.lineTo(Math.cos(ang + w) * (r0 + len * 0.6), Math.sin(ang + w) * (r0 + len * 0.6));
            ctx.closePath();
            ctx.fillStyle = i % 2 ? pal[0] : pal[1];
            ctx.globalAlpha = alpha * 0.45;
            ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.96, -arc, arc);
        ctx.strokeStyle = pal[0];
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 2.5 * (1 - prog) + 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    static _paintBlood(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 2; i++) {
            const dir = i ? -1 : 1;
            const head = (i ? 0.55 : 0.35) * arc * (0.4 + prog) * dir;
            ctx.beginPath();
            ctx.arc(0, 0, geo.outer * (0.98 - i * 0.18), -arc * 0.9 + head, arc * 0.9 + head);
            ctx.strokeStyle = i ? pal[1] : pal[0];
            ctx.lineWidth = (7 - i * 3) * (1 - prog * 0.6) + 1;
            ctx.globalAlpha = alpha * (0.9 - i * 0.3);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    static _paintMaw(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        this._teeth(ctx, geo, arc, geo.outer * 0.97, 1, pal[0], alpha);
        this._teeth(ctx, geo, arc, geo.inner + (geo.outer - geo.inner) * 0.32, -1, pal[1], alpha);
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.99, -arc, arc);
        ctx.strokeStyle = pal[0];
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    static _paintPalm(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        const cx = geo.outer * 0.6;
        const palmR = geo.outer * 0.16;
        ctx.beginPath();
        ctx.arc(cx, 0, palmR, 0, Math.PI * 2);
        ctx.fillStyle = pal[1];
        ctx.globalAlpha = alpha * 0.5;
        ctx.fill();
        ctx.strokeStyle = pal[0];
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 2;
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
            const ang = -0.42 + i * 0.21;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * palmR * 0.6, Math.sin(ang) * palmR * 0.6);
            ctx.lineTo(cx + Math.cos(ang) * geo.outer * 0.92, Math.sin(ang) * geo.outer * 0.92);
            ctx.strokeStyle = i === 2 ? pal[0] : pal[1];
            ctx.lineWidth = 2.4;
            ctx.globalAlpha = alpha * 0.8;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * (0.9 + 0.04 * prog), -arc * 0.95, arc * 0.95);
        ctx.setLineDash([6, 7]);
        ctx.strokeStyle = pal[2];
        ctx.globalAlpha = alpha * 0.6;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
    }

    static _paintFlame(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 4; i++) {
            const ang = -arc + 2 * arc * ((i + 0.5) / 4);
            const len = geo.outer * (0.62 + 0.32 * this._rand(seed + i * 1.7)) - geo.inner;
            const mid = ang + Math.sin(prog * 6 + i) * 0.08;
            const side = Math.sin(prog * 9 + i * 2) * 0.16;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * geo.inner, Math.sin(ang) * geo.inner);
            ctx.quadraticCurveTo(
                Math.cos(mid) * (geo.inner + len * 0.55) + Math.cos(mid + 1.4) * len * side,
                Math.sin(mid) * (geo.inner + len * 0.55) + Math.sin(mid + 1.4) * len * side,
                Math.cos(ang) * (geo.inner + len), Math.sin(ang) * (geo.inner + len));
            ctx.quadraticCurveTo(
                Math.cos(mid) * (geo.inner + len * 0.55) + Math.cos(mid - 1.4) * len * side,
                Math.sin(mid) * (geo.inner + len * 0.55) + Math.sin(mid - 1.4) * len * side,
                Math.cos(ang) * geo.inner, Math.sin(ang) * geo.inner);
            const grad = ctx.createRadialGradient(0, 0, geo.inner, 0, 0, geo.outer);
            grad.addColorStop(0, this._rgba(pal[2], 0.05 * alpha));
            grad.addColorStop(0.55, this._rgba(pal[1], 0.45 * alpha));
            grad.addColorStop(1, this._rgba(pal[0], 0.8 * alpha));
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    static _paintDart(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 3; i++) {
            const ang = (i - 1) * 0.4 * arc;
            const r1 = geo.outer * (0.85 + 0.15 * (1 - Math.abs(prog - 0.4)));
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * geo.inner, Math.sin(ang) * geo.inner);
            ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.strokeStyle = i === 1 ? pal[0] : pal[1];
            ctx.lineWidth = 2.4;
            ctx.globalAlpha = alpha;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.lineTo(Math.cos(ang - 0.16) * (r1 - 8), Math.sin(ang - 0.16) * (r1 - 8));
            ctx.lineTo(Math.cos(ang + 0.16) * (r1 - 8), Math.sin(ang + 0.16) * (r1 - 8));
            ctx.closePath();
            ctx.fillStyle = pal[0];
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    static _paintShadow(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        for (let i = 0; i < 2; i++) {
            const dir = i ? -1 : 1;
            const ease = 1 - Math.pow(1 - prog, 3);
            const head = -arc * dir + 2 * arc * dir * ease;
            ctx.beginPath();
            ctx.arc(0, 0, geo.outer * (0.92 - i * 0.12), head - dir * arc * 0.9, head, dir < 0);
            ctx.strokeStyle = i ? pal[2] : pal[1];
            ctx.lineWidth = (6 - i * 2) * (1 - prog * 0.6) + 1;
            ctx.globalAlpha = alpha * (0.85 - i * 0.25);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    static _paintSweep(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.95, -arc, arc);
        ctx.strokeStyle = pal[1];
        ctx.lineCap = 'butt';
        ctx.lineWidth = geo.outer * 0.24 * (1 - prog * 0.5) + 2;
        ctx.globalAlpha = alpha * 0.45;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.99, -arc, arc);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(-arc) * geo.inner, Math.sin(-arc) * geo.inner);
        ctx.lineTo(Math.cos(arc) * geo.outer, Math.sin(arc) * geo.outer);
        ctx.strokeStyle = pal[2];
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = alpha * 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    static _paintBash(ctx, geo, pal, prog, alpha) {
        const arc = geo.arcHalf;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.92, -arc, arc);
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = 10 * (1 - prog * 0.5) + 3;
        ctx.globalAlpha = alpha * 0.7;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.92, -arc, arc);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        this._flare(ctx, geo.outer * 0.95, 0, geo.outer * 0.22, pal[0], alpha);
        ctx.globalAlpha = 1;
    }

    static _paintScythe(ctx, geo, pal, seed, prog, alpha) {
        const arc = geo.arcHalf;
        const ease = 1 - Math.pow(1 - prog, 2);
        const head = -arc + 2 * arc * ease;
        ctx.beginPath();
        ctx.arc(0, 0, geo.outer * 0.96, -arc, head);
        ctx.strokeStyle = pal[1];
        ctx.lineWidth = 4 * (1 - prog * 0.6) + 1.5;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Math.cos(head) * geo.outer * 0.96, Math.sin(head) * geo.outer * 0.96);
        ctx.quadraticCurveTo(
            Math.cos(head) * geo.outer * 0.72, Math.sin(head) * geo.outer * 0.72,
            Math.cos(head - 0.5) * geo.outer * 0.5, Math.sin(head - 0.5) * geo.outer * 0.5);
        ctx.strokeStyle = pal[0];
        ctx.lineWidth = 3;
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
            const orb = (prog * 1.2 + i * 0.33) % 1;
            const ang = -arc + 2 * arc * (0.2 + 0.6 * this._rand(seed + i * 4.1));
            const dist = geo.inner + (geo.outer - geo.inner) * orb;
            this._flare(ctx, Math.cos(ang) * dist, Math.sin(ang) * dist,
                6 * Math.sin(orb * Math.PI) + 2, pal[0], alpha * 0.8);
        }
        ctx.globalAlpha = 1;
    }

    static _particles(ctx, shape, cfg, pal, seed, prog, alpha) {
        const count = Math.max(0, Math.min(24, cfg.sparkCount || 0));
        const type = shape.type;
        const arc = shape.arcHalf || 0.8;
        if (count <= 0) return;
        for (let i = 0; i < count; i++) {
            const r1 = this._rand(seed + i * 3.11);
            const r2 = this._rand(seed + i * 7.31 + 1.7);
            const r3 = this._rand(seed + i * 5.77 + 3.3);
            let ang;
            let dist;
            if (type === 'ring') {
                ang = r1 * Math.PI * 2;
                dist = shape.reach * (0.6 + 0.4 * r2);
            } else if (type === 'thrust') {
                const lanes = Math.max(1, shape.lanes);
                const lane = Math.floor(r1 * lanes);
                const off = (lane - (lanes - 1) / 2) * shape.laneGap + (r2 * 2 - 1) * shape.width;
                const along = shape.reach * (0.25 + 0.75 * prog) * (0.4 + 0.6 * r3);
                ang = Math.atan2(off, along);
                dist = Math.hypot(off, along);
            } else if (type === 'cross') {
                ang = (r1 * 2 - 1) * arc * 0.9;
                dist = shape.reach * (0.3 + 0.7 * prog) * (0.5 + 0.5 * r3);
            } else if (type === 'claw' || type === 'lobes') {
                const lanes = Math.max(1, shape.lanes || 3);
                const lane = Math.floor(r1 * lanes);
                ang = (lane - (lanes - 1) / 2) * shape.laneSpread + (r2 * 2 - 1) * shape.laneHalf * 1.4;
                dist = shape.reach * (0.2 + 0.8 * (0.15 + prog * (0.5 + 0.5 * r3)));
            } else {
                ang = (r1 * 2 - 1) * arc * 0.92;
                const start = shape.inner + (shape.reach - shape.inner) * (0.2 + r2 * 0.62);
                const travel = (shape.reach - shape.inner) * (0.22 + r3 * 0.5) * prog;
                dist = start + travel;
            }
            dist = Math.min(dist, shape.reach * 1.02);
            const size = 3.4 * (0.55 + r2) * (1 - prog * 0.45);
            this._spark(ctx, cfg.spark, Math.cos(ang) * dist, Math.sin(ang) * dist,
                size, ang, i % 3 === 0 ? pal[0] : pal[1], alpha * (0.35 + 0.65 * (1 - r3)));
        }
        ctx.globalAlpha = 1;
    }

    /* ================= 小工具 ================= */

    static _spark(ctx, shape, x, y, size, ang, color, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        if (shape === 'shard') {
            ctx.beginPath();
            ctx.moveTo(size * 1.4, 0);
            ctx.lineTo(-size * 0.6, -size * 0.55);
            ctx.lineTo(-size * 0.2, size * 0.55);
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'bubble') {
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, size * 0.7), 0, Math.PI * 2);
            ctx.stroke();
        } else if (shape === 'rune') {
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.7, 0);
            ctx.lineTo(0, size);
            ctx.lineTo(-size * 0.7, 0);
            ctx.closePath();
            ctx.fill();
        } else if (shape === 'bone' || shape === 'debris') {
            ctx.fillRect(-size * 0.8, -size * 0.28, size * 1.6, size * 0.56);
        } else if (shape === 'leaf') {
            ctx.beginPath();
            ctx.ellipse(0, 0, size, size * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'note') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, size * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(size * 0.4, 0);
            ctx.lineTo(size * 0.4, -size * 1.6);
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else if (shape === 'wisp') {
            this._flare(ctx, 0, 0, size * 1.8, color, alpha * 0.85);
        } else if (shape === 'ember' || shape === 'droplet') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, size * 0.6), 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.lineWidth = Math.max(1, size * 0.35);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-size, 0);
            ctx.lineTo(size, 0);
            ctx.stroke();
        }
        ctx.restore();
    }

    static _gash(ctx, r0, r1, ang, width, color, alpha, seed) {
        const segs = 6;
        ctx.beginPath();
        for (let s = 0; s <= segs; s++) {
            const t = s / segs;
            const r = r0 + (r1 - r0) * t;
            const wob = (this._rand(seed + s * 2.3) - 0.5) * 0.1 * (1 - t * 0.4);
            const a = ang + wob;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.stroke();
    }

    static _teeth(ctx, geo, arc, radius, dir, color, alpha) {
        const count = 9;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const a0 = -arc + (2 * arc) * (i / count);
            const a1 = -arc + (2 * arc) * ((i + 0.5) / count);
            const a2 = -arc + (2 * arc) * ((i + 1) / count);
            const spike = geo.outer * 0.12 * (0.55 + this._rand(i * 3.7) * 0.6);
            ctx.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius);
            ctx.lineTo(Math.cos(a1) * (radius + dir * spike), Math.sin(a1) * (radius + dir * spike));
            ctx.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fill();
    }

    static _crack(ctx, ang, r0, r1, color, alpha) {
        ctx.beginPath();
        for (let s = 0; s <= 4; s++) {
            const t = s / 4;
            const r = r0 + (r1 - r0) * t;
            const a = ang + Math.sin(s * 2.3 + ang * 7) * 0.08;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.8));
        ctx.lineWidth = 1.6;
        ctx.stroke();
    }

    static _rotRect(ctx, x, y, w, h, ang, color, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }

    static _leaf(ctx, x, y, size, ang, color, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = color;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    static _flare(ctx, x, y, radius, color, alpha) {
        const r = Math.max(1, radius);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, this._rgba(color, 0.95 * alpha));
        grad.addColorStop(0.45, this._rgba(color, 0.4 * alpha));
        grad.addColorStop(1, this._rgba(color, 0));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    static _rand(seed) {
        const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return value - Math.floor(value);
    }

    static _rgba(color, alpha) {
        if (typeof color !== 'string') return 'rgba(255,255,255,' + alpha + ')';
        if (color.charAt(0) === '#') {
            let hex = color.slice(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            const n = parseInt(hex.slice(0, 6), 16);
            if (!Number.isNaN(n)) {
                return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
            }
        }
        return color;
    }
}

window.AttackFx = AttackFx;
