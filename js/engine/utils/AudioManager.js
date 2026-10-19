'use strict';

/**
 * 极简 WebAudio 音效：不依赖外部音频文件。
 * 浏览器要求在用户手势后创建/恢复 AudioContext，因此 ensure() 在第一次攻击或点击时调用。
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.18;
        try { this.muted = localStorage.getItem('xian2d_muted') === '1'; } catch (e) { /* ignore */ }
    }

    ensure() {
        if (this.muted) return null;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!this.ctx) {
            try {
                this.ctx = new Ctx();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.volume;
                this.master.connect(this.ctx.destination);
            } catch (e) {
                return null;
            }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    tone(freq, duration, type = 'sine', volume = 1, slide = 0) {
        const ctx = this.ensure();
        if (!ctx || !this.master) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slide) osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    attack() { this.tone(240, 0.07, 'square', 0.18, -120); }
    hit() { this.tone(110, 0.08, 'sawtooth', 0.22, -40); }
    hurt() { this.tone(90, 0.13, 'sawtooth', 0.28, -35); }
    pickup() { this.tone(660, 0.08, 'sine', 0.2, 220); setTimeout(() => this.tone(880, 0.1, 'sine', 0.16, 120), 70); }
    levelUp() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.16), i * 90));
    }
    card() {
        [440, 554, 659].forEach((f, i) => setTimeout(() => this.tone(f, 0.1, 'triangle', 0.14), i * 60));
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
        try { localStorage.setItem('xian2d_muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
        return this.muted;
    }
}

window.AudioManager = AudioManager;
window.audioManager = new AudioManager();
