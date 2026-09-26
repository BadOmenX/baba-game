# 巴巴博弈

一个无需构建即可运行的博弈论可视化游戏，包含单人 AI、双人实时房间和经典局面分析。

## 本地运行

项目是纯 HTML/CSS/JavaScript。为避免浏览器对本地文件的限制，请通过静态服务器打开：

```bash
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173`。

## 测试

需要 Node.js 18 或更高版本：

```bash
node tests/game.test.js
```

测试覆盖移动合法性、胜负判定、状态同步，以及 Nim、威佐夫、欧几里得、字符串和 Tom & Jerry 求解器。

## 在线房间

房间功能使用 `js/config.js` 中配置的 Supabase 项目。部署到其他环境时，请确认 `rooms` 表允许匿名用户读取、创建和更新房间记录，并已在 Supabase Realtime 中启用 Broadcast。浏览器无法访问 Supabase 时，页面会显示实际连接错误，而不会停留在无响应状态。
