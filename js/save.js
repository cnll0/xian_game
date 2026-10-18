'use strict';

const SAVE_VERSION = 2;
const SAVE_PREFIX = 'xian2d_save_';
const USER_PREFIX = 'xian2d_user_';

function getSaveKey() {
    return SAVE_PREFIX + (G.username || 'guest');
}

function bytesToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('无效的密码盐值');
    return new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
}

async function hashLocalPassword(password, salt, iterations) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('当前浏览器不支持安全的本地密码存储，请使用 HTTPS 或 localhost');
    }
    let material = await window.crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    let bits = await window.crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: hexToBytes(salt),
        iterations
    }, material, 256);
    return bytesToHex(new Uint8Array(bits));
}

function createPasswordSalt() {
    if (!window.crypto || !window.crypto.getRandomValues) {
        throw new Error('当前浏览器不支持安全的随机数，请使用 HTTPS 或 localhost');
    }
    return bytesToHex(window.crypto.getRandomValues(new Uint8Array(16)));
}

function getSaveData() {
    return JSON.stringify({
        ver: SAVE_VERSION,
        username: G.username,
        origin: G.origin,
        created: G.created,
        realm: G.realm,
        cultivation: G.cultivation,
        atk: G.atk, maxHp: G.maxHp, speed: G.speed,
        range: G.range, lifesteal: G.lifesteal, crit: G.crit,
        hp: G.hp,
        flags: G.flags,
        story: G.story,
        achievements: G.achievements,
        saveTs: Date.now()
    });
}

function applySaveData(raw) {
    let d = JSON.parse(raw);
    if (!d || !d.created) {
        toast('❌ 存档损坏', 'bad');
        return false;
    }
    G.username = d.username || G.username;
    G.origin = d.origin || null;
    G.created = true;
    G.realm = d.realm || 0;
    G.cultivation = d.cultivation || 0;
    G.atk = d.atk || 10;
    G.maxHp = d.maxHp || 100;
    G.speed = d.speed || 3.2;
    G.range = d.range || 46;
    G.lifesteal = d.lifesteal || 0;
    G.crit = d.crit || 0;
    G.hp = Math.min(d.hp != null ? d.hp : G.maxHp, G.maxHp);
    G.flags = Object.assign({ kills: 0, runs: 0, clears: 0, maxFloor: 0, cursedPicks: 0, storyClear: 0, deaths: 0, noDeathClear: 0 }, d.flags || {});
    G.story = d.story || { node: 's0', done: [] };
    G.achievements = d.achievements || [];
    hideOverlay('loginOverlay');
    hideOverlay('createOverlay');
    showGameShell();
    updateHUD();
    renderAchievementBadge();
    toast('📂 存档已加载（v' + (d.ver || 1) + '）', 'gold');
    let node = getStoryNode(G.story.node);
    if (node) showStoryDialog(node);
    else hideOverlay('storyOverlay');
    return true;
}

function saveGame(showToast) {
    if (!G.created) {
        if (showToast) toast('❌ 无可保存进度', 'bad');
        return false;
    }
    try {
        let data = getSaveData();
        localStorage.setItem(getSaveKey(), data);
        if (showToast) toast('💾 存档已保存在此浏览器', 'good');
        return true;
    } catch (e) {
        if (showToast) toast('❌ 存档失败', 'bad');
        return false;
    }
}

async function doLogin() {
    let name = $('loginName').value.trim();
    let pass = $('loginPass').value;
    if (!name) { $('loginHint').textContent = '❌ 请输入道号'; $('loginHint').style.color = '#b22234'; return; }
    if (name.length < 2) { $('loginHint').textContent = '❌ 道号至少2字'; $('loginHint').style.color = '#b22234'; return; }
    if (!pass) { $('loginHint').textContent = '❌ 请输入密码'; $('loginHint').style.color = '#b22234'; return; }
    if (/[<>"/]/.test(name)) { $('loginHint').textContent = '❌ 道号含非法字符'; $('loginHint').style.color = '#b22234'; return; }
    try {
        let key = USER_PREFIX + name;
        let stored = localStorage.getItem(key);
        if (stored) {
            let user = JSON.parse(stored);
            if (user.pass) {
                if (user.pass !== pass) {
                    $('loginHint').textContent = '❌ 密码错误';
                    $('loginHint').style.color = '#b22234';
                    return;
                }
                let salt = createPasswordSalt();
                let iterations = 210000;
                localStorage.setItem(key, JSON.stringify({
                    passwordHash: await hashLocalPassword(pass, salt, iterations),
                    salt, iterations, created: user.created || Date.now()
                }));
            } else {
                let iterations = user.iterations;
                if (!user.salt || !user.passwordHash || !Number.isInteger(iterations) ||
                    iterations < 100000 || iterations > 1000000) {
                    throw new Error('本地账号数据损坏');
                }
                let passwordHash = await hashLocalPassword(pass, user.salt, iterations);
                if (passwordHash !== user.passwordHash) {
                    $('loginHint').textContent = '❌ 密码错误';
                    $('loginHint').style.color = '#b22234';
                    return;
                }
            }
        } else {
            let salt = createPasswordSalt();
            let iterations = 210000;
            localStorage.setItem(key, JSON.stringify({
                passwordHash: await hashLocalPassword(pass, salt, iterations),
                salt, iterations, created: Date.now()
            }));
        }
    } catch (error) {
        console.error('本地账号验证失败：', error);
        $('loginHint').textContent = '❌ 本地账号验证失败：' + error.message;
        $('loginHint').style.color = '#b22234';
        return;
    }
    G.username = name;
    G.guest = false;
    localStorage.setItem('xian2d_last_user', name);
    hideOverlay('loginOverlay');
    let raw = localStorage.getItem(getSaveKey());
    if (raw) {
        applySaveData(raw);
    } else {
        showOverlay('createOverlay');
        renderOrigins();
    }
    toast('✅ 欢迎，' + name + '！', 'gold');
}

function guestLogin() {
    G.username = 'guest_' + Math.random().toString(36).slice(2, 8);
    G.guest = true;
    hideOverlay('loginOverlay');
    showOverlay('createOverlay');
    renderOrigins();
    toast('👻 游客模式：仅本地存档', 'bad');
}
