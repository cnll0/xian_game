'use strict';

/**
 * 兼容层：只补 data.js / story.js 里没有的运行时辅助函数。
 * 不再覆盖 story.js 的剧情、NPC、通关回调，避免加载顺序造成静默失效。
 */
function initCompatibilityLayer() {
    window.floatText = function(x, y, text, color) {
        const runtime = window.gameState && window.gameState.runtime;
        if (runtime) {
            runtime.texts.push({ x, y, text, color, t: 0, life: 1.2, vy: -30 });
        }
    };

    window.gainCultivation = function(amount) {
        const oldRealm = window.G.realm;
        window.G.cultivation += amount;
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
