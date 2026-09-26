# 巴巴博弈 2.0

一个无需数据库、无需安装依赖的博弈论游戏站。包含 11 种可交互玩法、单人 AI、WebSocket 双人实时房间、断线重连和三套可切换视觉主题。

## 运行

需要 Node.js 18 或更高版本。

```bash
node server.js
```

也可在 Windows 上双击 `start.bat`。启动后访问：

```text
http://localhost:4173
```

同一局域网内的朋友可访问 `http://你的局域网IP:4173`，选择相同玩法后输入房间号加入。部署到公网时，托管平台需要支持 Node.js 和 WebSocket。

> 不要直接双击 `index.html`：联机房间需要由 `server.js` 提供 WebSocket 服务。

## 已实现

- 巴什、Nim、威佐夫、欧几里得、碎片化 Nim、Yet Another Number Game
- 兔兔与蛋蛋、一双木棋、树上游戏、Tom & Jerry、字符串游戏
- 创建/加入 6 位房间、回合同步、状态版本检查、掉线提示、刷新重连
- 极光、明纸、街机三套主题，动态背景、棋子/卡片/结果动画及移动端布局
- 修复最后一步、无合法操作、计分和平局等胜负判断

## 测试

```bash
node tests/game.test.js
node tests/server.test.js
```

第二项会在随机本地端口启动真实 WebSocket 服务，验证创建、加入、同步和重连。

## 房间说明

房间状态保存在运行中的 Node 进程内，空闲两小时后自动清理；重启服务会清空房间。项目不再包含或依赖第三方 Supabase 密钥。
