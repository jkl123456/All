# AI 造物馆·智纪元

智纪元AD 的 AI 作品展馆：收集用 AI 开发的小软件、游戏与工具。不上传源码、不跑在线 Demo，只保留 4 张 PC 截图、2 张手机截图、一段介绍、玩法、技术栈，以及作者留下的开源地址和联系方式。

![首页](assets/projects/universe/pc-2.jpg)

## 功能

- **作品墙**：PC 一排 4 个、手机一排 2 个；14 个细分分类（3D 游戏、知识教育、图形渲染、Web 应用、数据可视化、开发工具、桌面应用、自动化、AI 应用、效率工具、内容创作、音视频、实验项目、本地工具），支持分类筛选与全文搜索。
- **分页**：每页 8 件，底部页码自动出现；筛选或搜索时回到第 1 页。
- **独立详情页**：`detail.html?id=xxx`，4 张 PC 大图两列平铺、2 张手机图并排，点击任意图片全屏放大。
- **折叠阅读**：介绍与玩法默认只展示 6 行，超出部分用渐变遮罩收起，点「展开全文 / 展开全部」阅读完整内容。
- **发布日期**：作品墙卡片与详情页都会显示作品的发布时间。
- **上传页**：`submit.html` 独立页面，手机首页右下角有加号悬浮按钮直达；最多 8 张截图，拖拽或点选，自动压缩到 1600px，每张图可切换「PC 端 / 手机端」标注。
- **公众号**：关注「智纪元AD」，收录、合作与反馈都走公众号；技术问题可联系 QQ 993739647。
- **本地持久化**：提交的作品存在浏览器 IndexedDB 里，刷新不丢；预置作品来自 `data/projects.js`。

## 运行

纯静态，零依赖。可以直接双击 `index.html`，也可以起一个静态服务：

```bash
python -m http.server 8899
# 打开 http://127.0.0.1:8899
```

## 部署到 GitHub Pages

仓库自带 `.github/workflows/deploy-showcase.yml`，会把 `ai-showcase/` 单独发布：

1. 打开仓库 **Settings → Pages**，把 Source 切到 **GitHub Actions**；
2. 推送到 `main`（或手动运行 workflow），站点会发布在 `https://<用户名>.github.io/All/`。

也可以把 `ai-showcase/` 单独建一个仓库，根目录直接发布，不需要构建。

## 收录作品

访客在 `submit.html` 提交的作品只存在他自己的浏览器里。想收录到正式作品墙：

1. 关注公众号「智纪元AD」，在后台留言说明作品名称；
2. 或把你的作品信息按 `data/projects.js` 的格式整理成 PR；
3. 图片建议存成文件放到 `assets/projects/<slug>/`，再把 `src` 改成相对路径。

## 数据结构

```js
{
  id: 'zhiyu',
  name: '知屿 · 知识群岛',
  tagline: '一句话简介',
  categories: ['3D 游戏', '知识教育', '图形渲染', 'Web 应用'], // 可多选，最多 3 个
  platforms: ['Web', '移动端'],
  description: '600–800 字介绍，用 \\n\\n 分段……',
  gameplay: ['玩法一', '玩法二'],
  stack: ['three.js', 'Vite'],
  repo: 'https://github.com/...',   // 选填
  contactName: '昵称',              // 选填
  contact: '邮箱 / 主页 / 微信',     // 选填
  qq: '993739647',
  date: '2026-10-25',
  cover: 'assets/projects/zhiyu/pc-2.jpg',
  images: [
    { src: 'assets/projects/zhiyu/pc-1.jpg', label: 'pc' },
    { src: 'assets/projects/zhiyu/pc-2.jpg', label: 'pc' },
    { src: 'assets/projects/zhiyu/pc-3.jpg', label: 'pc' },
    { src: 'assets/projects/zhiyu/pc-4.jpg', label: 'pc' },
    { src: 'assets/projects/zhiyu/mobile-1.jpg', label: 'mobile' },
    { src: 'assets/projects/zhiyu/mobile-2.jpg', label: 'mobile' }
  ]
}
```

## 目录

```
index.html            首页：搜索、14 个分类、四列作品墙、分页、公众号
submit.html           上传页：表单与图片上传
detail.html           作品详情：4 PC + 2 手机截图、折叠介绍、发布日期
styles.css            首页与共用组件
submit.css            上传页布局
detail.css            详情页与图片灯箱
app.js                首页：筛选、搜索、分页、IndexedDB 读取
submit.js             上传页：表单校验、图片压缩、IndexedDB 保存
detail.js             详情页渲染、折叠、灯箱
data/projects.js      分类、站点信息与 6 件预置作品
assets/projects/      各作品截图（每件 4 PC + 2 手机）
```

## 说明

- 截图会自动压缩为 JPEG（最长边 1600px），避免 IndexedDB 撑爆。
- 如果浏览器禁用了 IndexedDB，提交会失败并给出提示；换 Chrome / Edge 或部署到 HTTPS 即可。
- 网站不收集任何访客数据，没有后端与统计脚本。

## 许可

MIT
