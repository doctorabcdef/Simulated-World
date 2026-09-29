# 山居 · Mountain Home

根据实景照片重建的乡村房屋第一人称三维网页。基于 Three.js + Vite，可部署至 GitHub Pages，手机和电脑直接使用浏览器访问，无需安装客户端。当前版本重新调整了建筑比例、门窗布局、阳台、瓦顶和周围植被，并将参考照片中的门窗区域映射到三维构件上。

## 已实现

- 不对称的正面门窗、右侧单门、两层生活空间、后退的灰水泥阁楼、波瓦屋顶和宽白檐。
- 正面与右侧阳台、带球形柱帽的不锈钢栏杆、与阳台衔接的可行走外楼梯。
- 门窗原图 UV 纹理、春联、靠墙门板、木料、扫把、编织袋、红砖矮墙和洗衣机等可见细节。
- 有裂缝和污渍的混凝土院落、密集树木与灌丛、周围坡地和远山；室内保留基础家具。
- 第一人称行走、快走、跳跃、墙体碰撞、门的开合。
- 竹篮、柴木、陶杯三个可拾取物品及收集反馈。
- 手机双指操作：左侧虚拟摇杆行走，右侧滑动环顾，按钮互动/跳跃。
- 环境风声、画质切换、暂停、回到入口及返回照片参考视角。
- 静态几何合批、实例化植被、手机默认低画质。

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

开始画面使用房屋右前上方的固定观察视角，便于对照照片查看外观。进入场景后，可在暂停/帮助菜单选择 **返回照片参考视角**；再次点击 **走进山居** 会继续当前探索，物品收集和门的状态保持不变。

## GitHub Pages 部署

目标仓库：[doctorabcdef/Simulated-World](https://github.com/doctorabcdef/Simulated-World)。

1. 将项目文件推送到该仓库 `main` 分支。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. **Actions** 页运行 `Deploy Mountain Home to GitHub Pages` 工作流（推送 main 会自动触发）。
4. 成功后访问 [山居模拟世界](https://doctorabcdef.github.io/Simulated-World/)。新版本需要等待工作流完成后才会更新。

`vite.config.js` 使用相对路径，可适配 GitHub Pages 仓库子目录。核心三维依赖随构建打包，不依赖 CDN；字体使用本机可用字体，不依赖外部字体 CDN。`public/reference-house.png` 是当前使用的完整参考照片，会随构建复制到站点根目录并公开提供，门窗纹理从同一站点加载；环境材质由程序在浏览器内生成。

部署说明参考 [GitHub 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 项目结构

- `src/main.js`：渲染与光照、照片参考观察视角、第一人称控制、拾取和门交互。
- `src/house.js`：房屋几何、照片区域 UV 映射、建筑材质、门窗、栏杆、楼梯、杂物和碰撞体。
- `src/environment.js`：院落纹理、坡地、远山、树木、灌丛及植被实例化。
- `src/physics.js`：碰撞与楼层/楼梯高度判定。
- `src/style.css`：响应式开始画面和游戏操作界面。
- `public/reference-house.png`：随站点部署的参考照片，供门窗和靠板纹理使用。
- `tests/physics.test.js`：楼梯衔接和碰撞回归检查。
- `.github/workflows/deploy.yml`：构建与 Pages 部署。
- `docs/reconstruction.md`：照片可见依据、推测范围和尺寸校准入口。

## 当前精度与边界

这是依据单张照片可见比例制作的可行走重建，尚无实测尺寸，不能视为测量级 1:1 还原。主楼宽约 12.6 米、深约 6.6 米、层高约 3.3 米是用于建立场景尺度的估计值。房屋背面、室内、被遮挡的一楼细节及周围地形仍为推测补全。

门窗采用原照片局部的透视校正 UV 映射，保留了照片中的颜色、反射和部分光照；这些纹理不会随着视角变化生成完整的真实玻璃反射。完整参考照片现已作为 `public/reference-house.png` 纳入项目及公开站点。

当前为单人本地交互，无服务器、多人同步或持久存档。支持现代 WebGL 2 浏览器，实际表现取决于设备；仍需使用目标手机进行性能和触控验收。

进一步接近真实场景，需要房屋四周照片、宽深与层高、门窗尺寸、阳台宽度及楼梯尺寸。如何把实测数据应用到当前模型，见 [重建依据与校准说明](docs/reconstruction.md)。
