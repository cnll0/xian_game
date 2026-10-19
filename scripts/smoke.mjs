#!/usr/bin/env node
/**
 * 无依赖浏览器冒烟测试。
 * 用法: node scripts/smoke.mjs
 * 需要本机有 Chrome/Edge；可用 CHROME_PATH 指定浏览器路径。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
};

function findBrowser() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ].filter(Boolean);
    return candidates.find(p => fs.existsSync(p)) || null;
}

function serve() {
    const server = http.createServer((req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const rel = urlPath === '/' ? 'tests/smoke.html' : urlPath.replace(/^\/+/, '');
        const file = path.resolve(root, rel);
        if (!file.startsWith(root + path.sep)) {
            res.writeHead(403);
            res.end('forbidden');
            return;
        }
        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
            res.end(data);
        });
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function runBrowser(browser, url) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xian-smoke-'));
    const args = [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--virtual-time-budget=20000',
        `--user-data-dir=${profile}`,
        '--dump-dom',
        url
    ];
    return new Promise((resolve, reject) => {
        const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('浏览器超时（20s）'));
        }, 60000);
        child.stdout.on('data', d => { out += d.toString(); });
        child.stderr.on('data', d => { err += d.toString(); });
        child.on('error', e => {
            clearTimeout(timer);
            reject(e);
        });
        child.on('close', code => {
            clearTimeout(timer);
            try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
            if (code !== 0) {
                reject(new Error(`浏览器退出码 ${code}\n${err.slice(-2000)}`));
                return;
            }
            resolve(out);
        });
    });
}

function decodeHtml(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function main() {
    const browser = findBrowser();
    if (!browser) {
        console.error('未找到 Chrome/Edge，请设置 CHROME_PATH。');
        process.exit(2);
    }
    serve().then(async server => {
        const { port } = server.address();
        const url = `http://127.0.0.1:${port}/tests/smoke.html`;
        console.log(`浏览器: ${browser}`);
        console.log(`测试页: ${url}`);
        try {
            const dom = await runBrowser(browser, url);
            const match = dom.match(/<pre id="auditResult">([\s\S]*?)<\/pre>/);
            if (!match) throw new Error('未找到 auditResult，页面可能没有执行');
            const result = decodeHtml(match[1]);
            console.log(result);
            const lines = Object.fromEntries(
                result.split(/\r?\n/)
                    .map(line => {
                        const i = line.indexOf('=');
                        return i > 0
                            ? [line.slice(0, i).trim(), line.slice(i + 1).trim()]
                            : [line.trim(), ''];
                    })
            );
            const failures = [];
            if (lines['EngineInstance'] !== 'true') failures.push('EngineInstance');
            const afterNewGame = JSON.parse(lines['afterNewGame'] || '{}');
            if (afterNewGame.state !== 'world') failures.push('afterNewGame.state');
            if (!(parseFloat(lines['move.deltaX']) > 0)) failures.push('move.deltaX');
            const run = JSON.parse(lines['run'] || '{}');
            if (run.state !== 'playing' || !(run.monsters > 0)) failures.push('run');
            if (!(parseFloat(lines['attack.drop']) > 0)) failures.push('attack.drop');
            const floorClear = JSON.parse(lines['floorClear'] || '{}');
            if (floorClear.floor !== 2) failures.push('floorClear.floor');
            if (!/^3\/[01]\/3$/.test(lines['cardChoices'] || '')) failures.push('cardChoices');
            if (lines['confirmEnabled'] !== 'true') failures.push('confirmEnabled');
            const cardPick = JSON.parse(lines['cardPick'] || '{}');
            if (cardPick.overlay !== null || cardPick.state !== 'playing') failures.push('cardPick');
            if (lines['codex'] !== 'opened') failures.push('codex');
            if (lines['save.exists'] !== 'true') failures.push('save.exists');
            if (lines['errors'] !== '[]') failures.push('window errors');
            if (failures.length) {
                console.error('冒烟测试失败: ' + failures.join(', '));
                process.exitCode = 1;
            } else {
                console.log('冒烟测试通过');
            }
        } catch (e) {
            console.error('冒烟测试异常:', e.message);
            process.exitCode = 1;
        } finally {
            server.close();
        }
    });
}

main();
