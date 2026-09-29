# 山居 · Mountain Home

根据实景照片制作的乡村房屋第一人称三维网页原型。基于 Three.js + Vite，可部署至 GitHub Pages，手机和电脑直接使用浏览器访问，无需安装客户端。

## 已实现

- 白墙、蓝灰瓦顶、两层生活空间、阁楼、环绕阳台、金属栏杆和可行走外楼梯。
- 山林、院落、菜地、盆栽、长凳和基础室内家具。
- 第一人称行走、快走、跳跃、墙体碰撞、门的开合。
- 竹篮、柴木、陶杯三个可拾取物品及收集反馈。
- 手机双指操作：左侧虚拟摇杆行走，右侧滑动环顾，按钮互动/跳跃。
- 环境风声、画质切换、暂停及回到入口。
- 静态几何合批、实例化树林、手机默认低画质。

## 本地运行

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

访问终端显示的本地地址。同一 Wi-Fi 手机可以访问 `http://电脑局域网IP:5173`，需要允许本机防火墙的相应端口。不要直接双击 index.html。

```sh
npm test
npm run build
npm run preview
```

## 操作

| 设备 | 操作 |
| --- | --- |
| 电脑 | WASD / 方向键移动，鼠标环顾，E 开门/拾取，空格跳跃，Shift 快走，Esc 暂停 |
| 手机 | 左摇杆移动，右侧空白区域滑动环顾，右下按钮互动/跳跃；推荐横屏 |

拾取时站到物品附近（2.7 米内），使屏幕中心对准物品。上楼从房屋右侧的外楼梯进入。收集进度仅在当前页面会话中保留，刷新后重置。

## GitHub Pages 部署

目标仓库：https://github.com/doctorabcdef/Simulated-World

1. 将项目文件推送到该仓库 `main` 分支。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. **Actions** 页运行 `Deploy Mountain Home to GitHub Pages` 工作流（推送 main 会自动触发）。
4. 成功后访问 https://doctorabcdef.github.io/Simulated-World/ 。此地址只有在部署成功后才可用。

`vite.config.js` 使用相对路径，可适配 GitHub Pages 仓库子目录。核心三维依赖随构建打包，不依赖 CDN；可选 Google 字体加载失败会回退至本地字体。

部署说明参考 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 项目结构

- `src/main.js`：程序化建模、渲染、第一人称控制、拾取和门交互。
- `src/physics.js`：碰撞与楼层/楼梯高度判定。
- `src/style.css`：响应式开始画面和游戏操作界面。
- `tests/physics.test.js`：楼梯衔接和碰撞回归检查。
- `.github/workflows/deploy.yml`：构建与 Pages 部署。

## 当前精度与边界

这是单张照片参考的风格化可玩原型，不是摄影测量或测绘级数字孪生。房屋背面、室内、尺寸和周围地形为合理补全；原始照片不包含在公开构建中。当前为单人本地交互，无服务器、多人同步或持久存档。支持现代 WebGL 2 浏览器，尚需实际目标手机进行性能和触控验收。

要提升实景还原度，可补充四周照片、每层平面草图、房屋宽深/层高和周围道路方位；再替换为经简化压缩的 GLB 模型。不要直接将高面数摄影测量模型用于手机网页。
