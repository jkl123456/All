# AI 造物馆 · AI Maker Gallery

一个只放作品的展示站：收集用 AI 开发的小软件、游戏与工具。不上传源码、不跑在线 Demo，只保留几张 PC / 手机截图、一段介绍、玩法、技术栈，以及作者留下的开源地址和联系方式。

![首页](assets/projects/universe/pc-2.jpg)

## 功能

- **作品墙**：卡片网格展示，支持分类、平台筛选与全文搜索（名称、简介、技术栈、玩法）。
- **作品详情**：PC / 手机截图画廊，缩略图切换、键盘左右翻页，介绍、玩法、技术栈、联系方式与开源地址。
- **提交作品**：表单最多上传 8 张截图，拖拽或点选，自动压缩到 1600px；每张图可一键切换「PC 端 / 手机端」标注。
- **本地持久化**：提交的作品存在浏览器 IndexedDB 里，刷新不丢；预置作品来自 `data/projects.js`。
- **导入 / 导出**：把自己的提交导出成 JSON，交给站长收录；也可以导入别人分享的作品包。
- **响应式**：桌面三列、平板两列、手机单列；详情与表单在手机上全屏显示。

## 运行

纯静态，零依赖。可以直接双击 `index.html`，也可以起一个静态服务：

```bash
python -m http.server 8899
# 打开 http://127.0.0.1:8899
```

## 部署到 GitHub Pages

1. 把仓库推到 GitHub，在 Settings → Pages 里选择分支与 `/ai-showcase` 目录；
2. 或者把 `ai-showcase/` 作为独立仓库的根目录发布。

所有资源都是相对路径，不需要构建。

## 收录作品

访客提交的作品只存在他自己的浏览器里。收录流程：

1. 访客在「关于」里点「导出我的作品」，得到 `ai-gallery-YYYY-MM-DD.json`；
2. 站长打开这个 JSON，把 `projects` 数组里的条目合并进 `data/projects.js` 的 `SEED_PROJECTS`；
3. 图片如果是 base64，建议先存成文件放到 `assets/projects/<slug>/`，再把 `src` 改成相对路径。

## 数据结构

```js
{
  id: 'zhiyu',
  name: '知屿 · 知识群岛',
  tagline: '一句话简介',
  category: '游戏',                 // 游戏 / 知识教育 / 开发工具 / 自动化 / 其他
  platforms: ['Web', '移动端'],
  description: '介绍……',
  gameplay: ['玩法一', '玩法二'],
  stack: ['three.js', 'Vite'],
  repo: 'https://github.com/...',   // 选填
  contactName: '昵称',              // 选填
  contact: '邮箱 / 主页 / 微信',     // 选填
  cover: 'assets/projects/zhiyu/pc-1.jpg',
  images: [
    { src: 'assets/projects/zhiyu/pc-1.jpg', label: 'pc' },
    { src: 'assets/projects/zhiyu/mobile-1.jpg', label: 'mobile' }
  ]
}
```

## 目录

```
index.html          页面结构
styles.css          设计系统与响应式
app.js              筛选、详情、提交、IndexedDB、导入导出
data/projects.js    预置作品数据
assets/projects/    各作品截图
```

## 说明

- 截图会自动压缩为 JPEG（最长边 1600px），避免 IndexedDB 撑爆。
- 如果浏览器禁用了 IndexedDB，提交会失败并给出提示；换 Chrome / Edge 或部署到 HTTPS 即可。
- 网站不收集任何访客数据，没有后端与统计脚本。

## 许可

MIT
