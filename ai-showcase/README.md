# AI 造物馆·智纪元

智纪元AD 的 AI 作品展示站，带账号、邮箱验证码注册、作品审核、点赞收藏评论与管理后台。

- 访客：浏览已审核通过的作品、按分类筛选/搜索、查看详情（4 张 PC + 2 张手机截图）、点赞、收藏、评论。
- 创作者：注册登录后发布作品，作品先进入待审核队列，只有自己能在「我的作品」看到；审核通过后才出现在作品墙。
- 管理员：审核通过/驳回、助推排序、删除作品、搜索用户、拉黑、禁言、查看用户作品与评论。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript，无框架、无构建步骤
- 后端：Node.js + Express + JWT（httpOnly cookie）+ multer + nodemailer
- 数据：Node 内置 `node:sqlite`（无需编译原生模块），数据库在 `server/data/app.db`，图片存 `server/data/uploads/`

> 环境要求：**Node.js 22.5+**（推荐 24）。启动脚本已带 `--experimental-sqlite`，不需要再装 `better-sqlite3`，也不需要 Visual Studio 编译工具链。

## 快速开始

```bash
cd ai-showcase
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run seed              # 初始化 6 件预置作品 + 管理员
npm start                 # http://127.0.0.1:3000
```

`npm run seed` 会读取 `.env` 里的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`：

- 邮箱对应的账号不存在时创建管理员；
- 已存在时更新昵称、角色，并把密码同步为 `ADMIN_PASSWORD`（忘记密码时重跑一次即可重置）；
- 同时创建系统作者 `showcase@zhijiyuan.local`，6 件预置作品都挂在它名下。

正式使用前请修改 `.env` 里的 `ADMIN_EMAIL` 与 `ADMIN_PASSWORD`，并重新运行 `npm run seed`。

## 邮箱验证码

在 `.env` 里配置 SMTP（QQ 邮箱填授权码，不是登录密码）：

```
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@qq.com
SMTP_PASS=你的SMTP授权码
SMTP_FROM=you@qq.com
```

未配置 SMTP 时，验证码会打印到服务端控制台，并在注册页的提示里显示（仅开发模式），方便本地跑通流程。

## 审核与排序规则

- 新发布的作品状态为 `pending`：作者本人与管理员可见，游客访问详情返回 404。
- 管理员在 `/admin.html` 通过后状态变为 `approved`，进入作品墙；驳回可填写原因，作者在「我的作品」能看到。
- 作者编辑已通过的作品后，状态会回到 `pending` 重新审核。

**推荐（一次性的首页机会）**

- 推荐作品只影响**第 1 页**：最多 8 个，按发布时间倒序排列。
- 推荐不足 8 个时，用普通作品按时间补满第 1 页。
- 推荐占满第 1 页时，普通作品从第 2 页开始。
- 被挤出首页的推荐作品，在第 2 页起与普通作品完全一样，只按时间排序。
- 第 1 页不显示「精选」之类的标识，推荐与普通作品在外观上无差别。

**降低优先级**

- 被降级的作品不出现在第 1、2 页，从第 3 页开始参与排序。
- 第 3 页起，推荐、普通、降级作品统一按发布时间倒序，不再有任何优先级差别。


## 用户管理

后台「用户」页支持：

- 搜索邮箱 / 昵称 / ID
- 查看基本信息：注册时间、作品数、评论数、点赞数、最近作品与评论
- 拉黑：账号无法登录、无法发布与互动
- 禁言：可设置分钟数（60 = 1 小时，1440 = 1 天），禁言期间不能评论，其余功能正常

## 目录

```
index.html / app.js          首页：分类、搜索、分页、精选标识
detail.html / detail.js      详情：截图平铺、折叠介绍、点赞收藏评论
submit.html / submit.js      发布：登录校验、图片压缩上传、提交审核
my.html / my.js              我的：作品状态、收藏、评论
admin.html / admin.js        后台：概览、审核、助推、用户管理
auth.html / auth.js          登录 / 邮箱验证码注册
api.js                       统一 API 封装与顶栏登录态
styles.css / detail.css / submit.css / console.css / auth.css
data/projects.js             14 个分类、站点信息、6 件预置作品（seed 用）
assets/projects/             预置作品截图
server/
  index.js                   Express 入口、静态托管
  db.js                      SQLite 初始化与查询
  auth.js                    验证码、注册、登录、中间件
  projects.js                作品 CRUD、点赞收藏、评论、图片上传
  admin.js                   审核、助推、用户管理
  my.js                      我的作品 / 收藏 / 评论
  mailer.js                  SMTP 发信（未配置时打印验证码）
  seed.js                    初始化预置数据与管理员
  data/                      SQLite 与上传图片（已 gitignore）
```

## API 速览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/send-code` | 发送注册验证码 |
| POST | `/api/auth/register` | 注册并登录 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/projects?page=&category=&q=` | 已审核作品（助推在前） |
| GET | `/api/projects/:id` | 详情（未审核仅作者/管理员） |
| POST | `/api/projects` | 发布作品（pending） |
| POST | `/api/projects/:id/like` | 点赞 / 取消 |
| POST | `/api/projects/:id/favorite` | 收藏 / 取消 |
| GET/POST | `/api/projects/:id/comments` | 评论列表 / 发表 |
| POST | `/api/projects/upload/images` | 上传截图（最多 8 张） |
| GET | `/api/my/projects` | 我的作品（含审核状态） |
| GET | `/api/admin/stats` | 后台统计 |
| GET | `/api/admin/projects?status=` | 后台作品列表 |
| POST | `/api/admin/projects/:id/review` | 通过 / 驳回 |
| POST | `/api/admin/projects/:id/boost` | 推荐首页 / 取消推荐 |
| POST | `/api/admin/projects/:id/demote` | 降低优先级 / 取消 |
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/users/:id/ban` | 拉黑 / 解除 |
| POST | `/api/admin/users/:id/mute` | 禁言 / 解除 |

## 部署

这是带 Node 服务的应用，**不能直接放 GitHub Pages**（静态页面能打开，但登录、发布、评论都需要后端）。部署到任意支持 Node 18+ 的服务器：

```bash
npm install --omit=dev
NODE_ENV=production PORT=3000 node --experimental-sqlite --disable-warning=ExperimentalWarning server/index.js
```

建议前面加 Nginx 反代并启用 HTTPS，同时：

- 设置强随机 `JWT_SECRET`
- 配置 SMTP
- 备份 `server/data/`（数据库与上传图片）

GitHub 仓库里只保留源码与预置截图，`server/data/`、`.env`、`node_modules/` 都已排除。

## 常见问题

**启动报 `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED`**
旧版本用过 `better-sqlite3`，原生模块与当前 Node 版本不匹配。现在的版本已经改用 Node 内置 `node:sqlite`，删掉 `node_modules` 重新 `npm install` 即可。

**启动报 `--experimental-sqlite` 不识别 / `node:sqlite` 找不到**
Node 版本低于 22.5。升级到 Node 22.5+（推荐 24），或换用 `H:\node\node.exe` 这类较新的安装。

**验证码收不到**
未配置 SMTP 时验证码只会打印在服务端控制台，并在注册页提示（开发模式）。配置 `.env` 里的 SMTP 后才会真实发信。

## 许可

仅限个人学习、研究与技术交流使用，**不可用于商业用途**。商业授权请联系作者 QQ 993739647，详见仓库根目录 [LICENSE](../LICENSE)。
