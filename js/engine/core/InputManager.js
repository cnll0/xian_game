'use strict';

/**
 * ????? - ???????????????????
 * @typedef {Object} MovementVector
 * @property {number} x - ???? [-1,1]
 * @property {number} y - ???? [-1,1]
 * @property {number} length - ????
 */

/**
 * @typedef {Object} InputManagerConfig
 * @property {HTMLCanvasElement} canvas - ????
 */

class InputManager {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        /** @type {HTMLCanvasElement} */
        this.canvas = canvas;
        /** @type {Record<string, boolean>} */
        this.keys = {};
        /** @type {{x:number,y:number,down:boolean}} */
        this.mouse = { x: 480, y: 270, down: false };
        /** @type {{active:boolean,id:number|null,ox:number,oy:number,dx:number,dy:number}} */
        this.joystick = {
            active: false,
            id: null,
            ox: 0, oy: 0,
            dx: 0, dy: 0
        };
        /** @type {boolean} */
        this.attackPressed = false;
        /** @type {boolean} */
        this.interactPressed = false;

        this._bindEvents();
    }

    _bindEvents() {
        const isTyping = (target) => target && (
            target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

        window.addEventListener('keydown', (e) => {
            if (isTyping(e.target)) return;
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
            if ((e.code === 'KeyJ' || e.code === 'Space' || e.code === 'KeyZ')) {
                this.attackPressed = true;
            }
            if (e.code === 'KeyE' || e.code === 'Enter') {
                this.interactPressed = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (isTyping(e.target)) return;
            this.keys[e.code] = false;
            if (e.code === 'KeyJ' || e.code === 'Space' || e.code === 'KeyZ') {
                this.attackPressed = false;
            }
            if (e.code === 'KeyE' || e.code === 'Enter') {
                this.interactPressed = false;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (document.querySelector('.overlay.active')) return;
            this.mouse.down = true;
            this.attackPressed = true;
        });

        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
            this.attackPressed = false;
        });

        this._bindTouchEvents();
    }

    _bindTouchEvents() {
        const joyBase = document.getElementById('joyBase');
        const joyKnob = document.getElementById('joyKnob');
        const joyZone = document.getElementById('joyZone');
        const atkBtn = document.getElementById('atkBtn');
        const interactBtn = document.getElementById('interactBtn');

        if (interactBtn) {
            interactBtn.addEventListener('click', () => {
                this.interactPressed = true;
            });
        }

        if (joyZone) {
            joyZone.addEventListener('touchstart', (e) => {
                const t = e.changedTouches[0];
                this.joystick.active = true;
                this.joystick.id = t.identifier;
                const zr = joyZone.getBoundingClientRect();
                this.joystick.ox = t.clientX;
                this.joystick.oy = t.clientY;
                if (joyBase) {
                    joyBase.style.left = (t.clientX - zr.left - 40) + 'px';
                    joyBase.style.top = (t.clientY - zr.top - 40) + 'px';
                    joyBase.style.display = 'block';
                    joyKnob.style.display = 'block';
                    joyKnob.style.left = '24px';
                    joyKnob.style.top = '24px';
                }
                e.preventDefault();
            }, { passive: false });

            joyZone.addEventListener('touchmove', (e) => {
                for (const t of e.changedTouches) {
                    if (t.identifier !== this.joystick.id) continue;
                    let dx = t.clientX - this.joystick.ox;
                    let dy = t.clientY - this.joystick.oy;
                    let len = Math.hypot(dx, dy) || 1;
                    const max = 40;
                    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
                    this.joystick.dx = dx / max;
                    this.joystick.dy = dy / max;
                    if (joyKnob) {
                        joyKnob.style.left = (24 + dx) + 'px';
                        joyKnob.style.top = (24 + dy) + 'px';
                    }
                }
                e.preventDefault();
            }, { passive: false });

            const joyEnd = (e) => {
                for (const t of e.changedTouches) {
                    if (t.identifier !== this.joystick.id) continue;
                    this.joystick.active = false;
                    this.joystick.dx = 0;
                    this.joystick.dy = 0;
                    this.joystick.id = null;
                    if (joyBase) { joyBase.style.display = 'none'; joyKnob.style.display = 'none'; }
                }
            };
            joyZone.addEventListener('touchend', joyEnd);
            joyZone.addEventListener('touchcancel', joyEnd);
        }

        if (atkBtn) {
            const fire = (e) => {
                e.preventDefault();
                if (document.querySelector('.overlay.active')) return;
                this.attackPressed = true;
            };
            atkBtn.addEventListener('touchstart', fire, { passive: false });
            atkBtn.addEventListener('mousedown', fire);
        }
    }

    /**
     * ?????????
     * @returns {MovementVector}
     */
    getMovementVector() {
        let mx = 0, my = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) my -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) my += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
        if (this.joystick.active) { mx += this.joystick.dx; my += this.joystick.dy; }
        const len = Math.hypot(mx, my);
        if (len > 1) { mx /= len; my /= len; }
        return { x: mx, y: my, length: Math.min(1, len) };
    }

    /**
     * ????????
     * @returns {boolean}
     */
    consumeAttack() {
        const pressed = this.attackPressed;
        this.attackPressed = false;
        return pressed;
    }

    /**
     * ????????
     * @returns {boolean}
     */
    consumeInteract() {
        const pressed = this.interactPressed;
        this.interactPressed = false;
        return pressed;
    }

    /**
     * ????????
     * @param {string} code - ????
     * @returns {boolean}
     */
    isKeyPressed(code) {
        return !!this.keys[code];
    }
}

window.InputManager = InputManager;