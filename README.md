# 修仙传说 2D

一款使用原生 HTML、CSS 和 JavaScript 制作的 2D 动作修仙游戏。探索大地图、推进章节剧情、挑战分级秘境，并在战斗中选择机缘卡牌、学习功法和结识 NPC。

- 在线游玩：[Netlify 部署版](https://xiangame.netlify.app/)
- 项目仓库：[cnll0/xian_game](https://github.com/cnll0/xian_game)
- 使用指南与开发说明：[GitHub Wiki](https://github.com/cnll0/xian_game/wiki)

## 开始游戏

### 在线游玩

打开 [在线版本](https://xiangame.netlify.app/) 即可游玩。账号、密码和角色进度保存在当前浏览器本地，不会上传到服务器；换浏览器或清除站点数据后，进度不会自动同步。

### 本地运行

需要安装 Python 3。进入项目目录后启动静态文件服务器：

```bash
python -m http.server 8081
```

然后访问 <http://localhost:8081/>。Windows 用户也可运行 `启动游戏.bat`（该脚本会启动端口 8081 的本地服务器）。

项目无需 npm 安装或构建步骤。直接双击打开 `index.html` 可能会因浏览器对本地文件的限制导致资源加载异常，建议使用本地 HTTP 服务器。

当前入口 `index.html` 使用 `js/engine/` 下的模块化引擎，项目只保留这一套引擎；旧版单文件引擎 `js/engine.js` 与回退入口 `legacy.html` 已移除。

### 开发与验证

```bash
npm test             # 零依赖单元测试（Node 内置 test runner）
npm run smoke        # 无额外依赖的浏览器冒烟测试（需本机 Chrome/Edge）
npm install          # 需要完整 Jest/ESLint/tsc 时再安装
npm run test:jest    # 可选，完整 Jest 用例
npm run lint
npm run typecheck
```

`npm run smoke` 会自动启动临时静态服务器，用无头浏览器完成“游客登录 → 大地图移动 → 进入秘境 → 战斗 → 清层 → 选卡 → 图鉴/存档”的完整链路，并检查世界渲染、HUD 与通关回调。

## 游戏内容

- **大地图探索与章节剧情**：在可移动视野的大地图中探索地点，与人物交谈并推进主线。
- **动作战斗**：实时移动、攻击、闪避，并面对拥有不同特性的妖兽与首领。
- **秘境挑战**：探索青云外围、赤炎洞窟、寒潭秘境和幽冥古墟。秘境有境界门槛、分层战斗和专属功法；出口默认被妖气封印，需清剿至少 75% 妖兽，Boss 层还必须击败首领才能开启，不能直接跑图跳过战斗。
- **机缘卡牌**：每层提供玩家强化与妖魔强化各 3 张，玩家/妖魔选择数量相等后确认；诅咒从属于玩家/妖魔卡池，以 25% 概率随机占用其中一列的一张卡位。重复获得的卡牌可以进阶并解锁进化分支。
- **NPC 遭遇**：在大地图和秘境中结识不同人物。秘境遭遇会提供多种选择，可能带来疗伤、护盾、战斗强化、修为或相应风险。
- **背包与灵石**：丹药、材料、珍宝统一进背包；宝箱、妖兽、宗门俸禄都会产出灵石。背包里可以直接使用丹药，也能去商店出售材料。
- **宗门与商店**：青云门有外门/内门/核心弟子身份、贡献、每日俸禄和晋升；执事堂与行商出售丹药、护身符和材料。沈砺、林越、苏晚、赵铁衣、阿石都有各自的对话与入口。
- **永久成长**：提升境界，并将学会的功法永久记入角色成长。

## 操作方式

| 操作 | 键位 |
| --- | --- |
| 移动 | `W` `A` `S` `D` 或方向键 |
| 攻击 | `J`、`Z` 或空格 |
| 交谈 / 互动 | `E` 或回车 |
| 背包 / 宗门 | HUD 右侧 🎒 / 🏯，或菜单里的「背包」「宗门」 |
| 移动端 | 使用屏幕摇杆和攻击按钮 |
| 音效 | 点击 HUD 右侧 🔊 按钮开关 |

移动为八向，但角色只用 4 张方向图：左右用 `player_east/west`，左上/右上用 `player_north`，左下/右下用 `player_south`；不再单独做斜向行走图。攻击方向跟随鼠标/攻击目标。

## 项目结构

```text
assets/          图片、精灵图与卡牌图标；assets/attack 为 8 方向攻击贴图
css/             游戏界面样式
js/
  data.js        境界、地图、秘境、卡牌、功法、NPC 与剧情数据
  main.js        界面初始化、登录、HUD 与菜单
  save.js        浏览器本地存档与本地密码校验
  story.js       剧情、NPC 对话与秘境选择
  inventory.js   背包、灵石、宗门贡献/俸禄、物品使用
  panels.js      背包、宗门大殿与商店界面
  engine/
    Engine.js     引擎生命周期、主循环与静态 API
    compat.js     模块化引擎的少量兼容辅助函数
    core/         GameState、EventBus、InputManager
    systems/      CombatSystem、CardSystem
    world/        WorldSystem、NPCManager、MapGenerator、Worker 封装
    render/       WorldRenderer、Renderer
    utils/        MathUtils、AssetLoader、ObjectPool、AudioManager
  workers/       地图生成 Web Worker
  __tests__/     Jest 单元测试
scripts/
  smoke.mjs      浏览器冒烟测试脚本
  generate-attack-art.ps1  重新生成 8 方向刀光/爪击贴图
tests/
  unit.test.mjs  零依赖单元测试
  smoke.html     冒烟测试页面
index.html       模块化引擎入口
```

## 资源与音效

运行时立绘已压缩为 256px WebP，`assets/` 体积从约 9.9MB 降至约 3MB（其中仍保留 `assets/raw/` 源图）。基础攻击、受击、拾取、升级与选卡音效由 WebAudio 实时合成，不依赖外部音频文件。

物品图标在 `assets/item-icons.svg`，宗门徽记在 `assets/sect-emblem.svg`；8 方向攻击贴图在 `assets/attack/`（`slash_0..7.png` / `claw_0..7.png`），可用 `scripts/generate-attack-art.ps1` 重新生成。主角行走图只有 north/south/east/west 四张，斜向由 north/south 复用。新增物品/宗门/攻击特效时不要只写文字，记得补对应贴图。

## 存档与隐私

角色数据保存在浏览器 `localStorage` 中，按当前浏览器和设备隔离。游戏不提供服务器账号验证或云存档；请勿将浏览器站点数据清除后仍期待恢复进度。

## 反馈与参与

欢迎在 [GitHub Issues](https://github.com/cnll0/xian_game/issues) 报告问题或提出建议。玩法指南、秘境资料和代码结构说明请参阅[项目 Wiki](https://github.com/cnll0/xian_game/wiki)。
