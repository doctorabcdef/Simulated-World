# 山居 · 空间复刻

基于参考照片构建的可交互 Three.js 场景：白墙乡村住宅、蓝灰曲面瓦顶、环绕阳台、不锈钢栏杆、室外楼梯与山林环境。

在线访问：[山居 · 空间复刻](https://doctorabcdef.github.io/Simulated-World/)。

```sh
npm install
npm run dev
```

打开终端显示的本地地址。`npm run build` 生成生产文件，`npm run preview` 预览。

- 鼠标左键拖动旋转，滚轮缩放，右键平移；触屏单指旋转、双指缩放和平移。
- 底部切换照片近似视角、全景、正面和鸟瞰；右下角支持自动旋转与场景设置。
- 支持调节日光、隐藏环境、显示建筑线框、保存 PNG 截图。
- “导出模型”生成以米为单位的建筑 GLB，可导入 Blender 等软件；导出不包含植被环境。

原图位于 `public/reference.jpg`。建筑几何在 `src/house.js`，瓦顶在 `src/roof.js`，环境在 `src/landscape.js`。

在浏览器中点击“导出模型”或“截图”即可保存 GLB 建筑模型和 PNG 场景截图。运行验证脚本也会将这两类文件保存至本地 `artifacts/` 目录，该目录不提交到仓库。

## GitHub Pages 部署

推送到 `main` 分支会触发 `.github/workflows/deploy.yml`，使用 Node.js 22 安装依赖、构建并发布 `dist/` 到 GitHub Pages。仓库 Pages 发布源应设置为 **GitHub Actions**。

Vite 使用相对资源路径，因此可以部署到 `/Simulated-World/` 等仓库子目录。参考照片、图标、脚本和程序化材质均随项目提供，无需外部 CDN 或字体服务。

## 验证

保持本地预览运行，另开终端执行 `npm run check`。验证脚本会使用本机 Chrome / Edge 检查视角与场景控制、PNG 下载、GLB 文件结构和手机布局，将结果写入 `artifacts/verification.json`。可用环境变量 `CHROME_PATH` 指定浏览器，`BASE_URL` 指定预览地址。

单图手工几何重建，不是摄影测量结果。照片可见立面按比例复刻；背面、内部空间、遮挡部分和尺寸为合理推断，并非实测建筑数据。
