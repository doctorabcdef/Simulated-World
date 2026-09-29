# 山居 · 空间复刻

基于四张参考照片构建的可交互 Three.js 场景：白墙乡村住宅、蓝灰曲面瓦顶、环绕阳台、不锈钢栏杆、室外楼梯、门前院落与村道环境。

在线访问：[山居 · 空间复刻](https://doctorabcdef.github.io/Simulated-World/)。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。`npm run build` 生成生产文件，`npm run preview` 预览。

- 鼠标左键拖动旋转，滚轮缩放，右键平移；触屏单指旋转、双指缩放和平移。
- 底部切换照片近似视角、全景、正面、门前院落和鸟瞰；“门前院落”从楼上向外观察新增场景。
- 参考图卡片可切换建筑、门前、围墙、村道四张实景照片，点击照片可放大查看。
- 一楼大门为带帘片、导轨与顶罩的卷帘门；每层窗户使用一致尺寸，楼层之间保留不同规格。
- 门前包含带白色修补裂缝的混凝土院落、砖墙、绿色垃圾桶、覆盖料堆、银色车辆、红土路肩，以及电杆、路灯、架空线和邻家瓦房。
- 支持调节日光、隐藏环境、显示建筑线框、保存 PNG 截图。
- “导出模型”生成以米为单位的建筑 GLB，可导入 Blender 等软件；导出不包含植被环境。

建筑原图位于 `public/reference.jpg`，三张院落照片位于 `public/references/`。建筑几何在 `src/house.js`，瓦顶在 `src/roof.js`，环境在 `src/landscape.js`，院落与村道在 `src/forecourt.js`，车辆在 `src/vehicle.js`。

在浏览器中点击“导出模型”或“截图”即可保存 GLB 建筑模型和 PNG 场景截图。运行验证脚本也会将这两类文件保存至本地 `artifacts/` 目录，该目录不提交到仓库。

## GitHub Pages 部署

推送到 `main` 分支会触发 `.github/workflows/deploy.yml`，使用 Node.js 22 安装依赖、构建并发布 `dist/` 到 GitHub Pages。仓库 Pages 发布源应设置为 **GitHub Actions**。

Vite 使用相对资源路径，因此可以部署到 `/Simulated-World/` 等仓库子目录。参考照片、图标、脚本和程序化材质均随项目提供，无需外部 CDN 或字体服务。

## 验证

保持本地预览运行，另开终端执行 `npm run check`。验证脚本会使用本机 Chrome / Edge 检查视角与场景控制、PNG 下载、GLB 文件结构和手机布局，将结果写入 `artifacts/verification.json`。可用环境变量 `CHROME_PATH` 指定浏览器，`BASE_URL` 指定预览地址。

依据多张照片手工进行几何重建，不是摄影测量结果。照片可见部分按比例复刻；背面、内部空间、遮挡部分和尺寸为合理推断，并非实测建筑数据。按用户确认，同一楼层的窗户大小一致，三层之间允许不同；当前一楼为 1.70 × 1.85 m、二楼为 1.90 × 2.04 m、三楼为 1.90 × 0.86 m，均为建模估计尺寸。
