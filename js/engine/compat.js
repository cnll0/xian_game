'use strict';

/**
 * 兼容层：只补 data.js / story.js 里没有的运行时辅助函数。
 * 不再覆盖 story.js 的剧情、NPC、通关回调，避免加载顺序造成静默失效。
 */
function initCompatibilityLayer() {
    window.floatText = function(x, y, text, color) {
        const runtime = window.gameState && window.gameState.runtime;
        if (runtime) {
            // 同一帧的伤害/治疗数字错开并向上堆叠，避免叠成“-512”
            const recent = runtime.texts.filter(item => item.t < 0.22).length;
            const jitterX = (Math.random() - 0.5) * 18;
            const jitterY = (Math.random() - 0.5) * 6 - Math.min(4, recent) * 17;
            runtime.texts.push({ x: x + jitterX, y: y + jitterY, text, color, t: 0, life: 1.2, vy: -30 });
        }
    };

    window.gainCultivation = function(amount) {
        const oldRealm = window.G.realm;
        const gainBonus = (window.G.flags && window.G.flags.cultGain) || 0;
        const finalAmount = Math.max(0, Math.round(amount * (1 + gainBonus)));
        window.G.cultivation += finalAmount;
        while (window.G.realm < window.REALMS.length - 1 &&
            window.G.cultivation >= window.REALMS[window.G.realm + 1].cult) {
            window.G.realm++;
            window.toast('🎉 境界突破：' + window.REALMS[window.G.realm].name, 'gold');
        }
        if (window.G.realm > oldRealm && window.audioManager) window.audioManager.levelUp();
        window.updateHUD();
    };

    window.showDualCardChoice = function() {
        const instance = window.Engine && window.Engine.getInstance
            ? window.Engine.getInstance()
            : null;
        if (instance && instance.cardSystem) {
            instance.cardSystem.showDualCardChoice();
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCompatibilityLayer);
} else {
    initCompatibilityLayer();
}
