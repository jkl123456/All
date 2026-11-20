# 直播间头像简笔画

观众扣 1 排队，程序取他的头像，用 AI/图像算法生成一张简笔画线稿，
再拆成一笔一笔的顺序，在直播画面上由一支笔实时画出来。

```
抖音直播间
   │  弹幕 · 礼物 · 进场（含头像 URL）
   ▼
┌─────────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────────┐
│ 事件接入层   │──▶│  排单队列     │──▶│ 出图流水线  │──▶│  OBS 叠加层  │
│ mock/external│   │ 礼物可插队    │   │ 头像→线稿→  │   │ 逐笔描线+笔尖 │
│ /douyin      │   │ 关键词：扣1   │   │ 骨架→笔顺    │   │ 跟随 + 评分   │
└─────────────┘   └──────────────┘   └────────────┘   └──────────────┘
                                                             │
                                                        RTMP 推流
```

## 快速开始

```bash
python -m pip install -r requirements.txt
python run.py                       # 默认 mock 数据源，浏览器自动打开
```

打开 `http://127.0.0.1:8848/` 就是直播画面（1080×1920 竖屏，按窗口自动缩放）。
mock 模式每 15 秒模拟一个观众进来，会自己排队、自己开始画。

手动塞一单测试（浏览器直接打开这个地址最省事）：

```
http://127.0.0.1:8848/api/simulate?nickname=小明
```

也可以用 curl（注意 Windows 的 cmd.exe 不认单引号，要写成 `-d "{\"nickname\":\"小明\"}"`）：

```bash
curl -X POST http://127.0.0.1:8848/api/simulate \
  -H "content-type: application/json" \
  -d '{"nickname":"小明","avatar":"data/samples/test01.jpg"}'
```

## 用豆包网页出图（图生图 + 渐显）

本地算法只能描边，豆包网页是真正的"按意思画"。脚本用固定调试端口驱动一个**独立 Chrome**，
登录态存在 `.chrome-doubao/` 里，一次登录长期有效。

**第一次：登录（只做一次）**

```bash
python scripts/doubao_grab.py --login
```

会弹出 Chrome（端口 9222）打开豆包。用手机号登录，然后 `Ctrl+C` 结束脚本。
以后每次运行会自动复用这个 profile，不用再登。

**出图（默认素描档）**

```bash
python scripts/doubao_grab.py --avatar data/samples/test01.jpg --tier sketch --supply --nick 橘子汽水
```

一条命令做完：新开会话 → 把头像"粘贴"进输入框 → 输入提示词 → 点发送 → 等出图 →
从页面取 1536px 原图 → 送进直播队列。

| 参数 | 默认 | 作用 |
|---|---|---|
| `--tier` | sketch | 画风档位，对应 `prompts/<档位>.txt`：`simple` 铅笔速写 / `sketch` 铅笔素描 / `color` 彩色卡通 / `fine` 精细素描 |
| `--avatar` | 空 | 参考头像；留空则纯文生图 |
| `--prompt` / `--prompt-file` | 空 | 临时换提示词（中文建议写文件，命令行会乱码） |
| `--count` | 1 | 连画几张 |
| `--supply` | 关 | 出图后直接 POST 进 `/api/supply` 排队 |
| `--timeout` | 240 | 单张等待上限（秒） |
| `--verbose` | 关 | 每秒打印生成状态 |

**四个坑，都已经在脚本里处理掉了**（改代码前先看这段，能省几小时）：

1. **上传**：`DOM.setFileInputFiles` 和模拟 `drop` 事件都会被 tiptap 编辑器忽略。
   只有构造一个带真实 `File` 的 `ClipboardEvent('paste')` 才走得通，等价于 Ctrl+V。
2. **发送**：回车发不出去。发送按钮 `[data-testid=chat_input_send_button]` **只在输入框有内容时才存在**，
   所以它既是触发器也是"可以发了"的判据；脚本点它，并校验输入框真的清空了才算发出。
3. **取图**：结果图的 `src` 含 `rc_gen_image`，页面里 `fetch` 它就能拿到 1536×1536 原图
   （缩略图是 384）。走网络层抓包反而容易抓到加载图标。
4. **水印**：右下角"豆包 AI 生成"是毁画元凶。**不用裁图也不用抠图**——渲染时在右下角盖一张
   "今日手绘"便签，位置正好压住它（见 `overlay/style.css` 的 `.stamp-cover`）。

时间账：上传 1.5 秒 + 生成 20~25 秒 ≈ **26 秒一张**。画出来另算 20 秒，所以一人一幅约 46 秒；
连单多的时候靠 producer/presenter 双流水线顶着，队列不会卡画笔。

`avatar` 留空会从 `data/samples/` 随机取一张图。放几张真人头像进去调试最方便。

## 画出来是什么效果

AI 成稿（`kind=ai`）**不再拆成笔画**：铅笔素描有几百条软笔触，拆出来的线条断断续续，很难看。

改成"渐显"：整张图先画在画布下层，上层盖一张纸色遮罩，画笔按**斜向笔道**一条条把遮罩擦掉。

关键是笔道不是横着一行行刷（那样像打印机），而是：

1. 用 `deepseek-flash` 看一遍图，给出**头发 / 脸 / 脖子 / 衣服**四块的比例坐标；
2. 在整幅画上铺 38° 斜向的平行笔道，一条笔道被部位边界切成若干段；
3. 按 **头发 → 脸 → 脖子 → 衣服 → 背景** 的顺序播放，同一条斜线上了不同部位不会连笔。

20 秒铺满，边界是斜的，脸部拿的时间权重最高（1.35），空白纸面最后一遍带过。

`overlay/draw.js` 里对应 `mode: "reveal"`，服务端在 `build_payload()` 里对 `kind=ai` / `virtual`
直接返回 `art_url` + `regions`。本地算法那条路径（`strokes` / `hatch` / `fills`）仍然保留。


### 分区为什么要缓存

`deepseek-flash` 回答四个框要约 11 秒（它先花两千 token 推理）。这段时间绝不能加在观众送礼到落笔之间，
所以分区**不在关键路径上**：

- 缓存命中 → 立即用（虚拟图库 20 张在启动后 8 秒开始后台预热，第一轮就全命中）；
- 缓存未命中 → 先用几何默认值开画，同时后台请求模型并写缓存，下一轮同图直接命中。

日志里 `分区cached` / `分区warming` 就是这个状态。想强制重算，删掉 `data/cache/regions/` 即可。


## 后台管理（/admin）

`http://127.0.0.1:8848/admin/`，给主播自己看的，不进直播画面：

| 区域 | 内容 |
|---|---|
| 顶部统计 | 排队人数、正在画谁、今日已完成、虚拟图库张数、**观看端连接数** |
| 全部排队 | 所有队列（不只前 5），带来源标记、等待时长、置顶 / 移除 |
| 手动加单 | 填昵称选档位直接入队，用来试画面 |
| 运行日志 | 最近 80 行，出图失败、分区状态都在这 |

顶栏四个开关：暂停接单 / 跳过当前 / 清空队列 / 虚拟队列开关，右侧是直播画面入口。

直播端（`/`）底部只显示**前 5 位**排队，格式为序号 + 昵称 + 档位。


## 虚拟队列（没人时的保底）

半夜没人排队，画布空着比重复画更难看。队列一空就从 `data/virtual/` 取一张图，
配一个虚拟昵称，当成新观众进来，轮流画。

- 图片放进 `data/virtual/`，支持 jpg/png/webp，**建议 20 张**，按文件名顺序轮转；
- 目录会实时重新扫描，加图不用重启；
- 最多同时挂 2 个虚拟单，够撑场面又不会让真观众排长队；
- 真实订单会插到虚拟单**前面**（`QueueManager._push`），观众不会看到自己排在假人后面；
- 后台可以一键关掉。


## 目录

```
app/
  main.py            FastAPI + 排单 worker + WebSocket 下发
  queue_manager.py   队列（礼物插队、去重、暂停/跳过、虚拟单插入位置）
  bus.py             事件广播 + 心跳超时清理
  virtual.py         虚拟观众池（空场保底）
  pipeline/
    avatar.py        头像下载/缓存/居中裁切
    sketch.py        头像 → 线稿（local / openai / command 三种 provider）
    strokes.py       线稿 → 骨架 → 折线 → 按最短笔程排序
    regions.py       分区（deepseek-flash 看图，带缓存与后台预热）
  platforms/
    mock.py          本地模拟，不用真直播间也能调 UI
    external.py      用 WebSocket 接任何现成弹幕工具
    douyin.py        抖音 webcast IM 适配器（含 protobuf 解码）
overlay/             直播叠加层（原生 Canvas + SVG 笔，OBS 直接用）
admin/               后台管理页
scripts/
  doubao_grab.py     豆包网页出图 + 抓图 + 入队
  shot_supply.py     推一张图进去并分阶段截图，验证画法
  shot_page.py       截任意页面（排队面板、后台）
```

## 出图方案

`config.yaml` → `sketch.provider`：

| provider | 效果 | 成本 | 说明 |
|---|---|---|---|
| `local` | 人像裁切 + 边缘描线，像速写 | 0 | 0.3 秒出图，纯 OpenCV，断网也能跑 |
| `openai` | 真·简笔画，会归纳造型 | 几分钱/张 | 任意 OpenAI 兼容的出图接口（豆包/通义/自建 SD） |
| `command` | 自己写 | - | `command: ["python","my.py","{in}","{out}"]` |

三种都会做失败兜底：AI 报错自动降级到 `local`，直播不会中断。

### 为什么之前"画的不像"

两个原因，都不是笔的问题，是线稿的问题：

1. **整张照片描边**。观众头像里有背景、衣服褶皱、头发纹理，全被描出来，
   结果是一张"照片轮廓"而不是一个人的简笔画。
   → 现在先做 `portrait_crop()`：居中偏上裁到 72%，把背景和多余身体裁掉，
   脸变大，线条自然就集中在五官上。
2. **线条是断的**。Canny 边缘天生断续，骨架化又在每个交叉点断一次，
   最后是一堆虚线拼起来的脸。
   → 新增 `stitch()`：把端点距离小于 `stitch_gap` 的笔画接成一条。
   实测 151 笔碎线 → 69 笔长线，平均笔长 37px → 89px，跨画面跳笔也少了。

另外 `local` 模式不要用"局部阈值"提取线稿：它会把皮肤和头发变成实心剪影，
骨架化之后是中轴乱线（第一版就是栽在这里）。现在用的是边缘 + 按线宽剔除实心块。

**真正想"像"，还是接 AI。** `local` 的物理上限就是描边：它不知道那是眼睛还是阴影。
`sketch.provider: openai` 填上 key，模型会把头像重画成简笔画，造型、比例、神态都对。

## 画面调参（config.yaml → draw）

| 项 | 默认 | 作用 |
|---|---|---|
| `duration_seconds` | **1.0** | 一幅画画多久。1.0 = 一秒一个（吞吐约 1.14 秒/幅）；想看过程改 3~5，想表演改 8~15 |
| `hold_seconds` | 0.3 | 画完停留展示评分的时间 |
| `stroke_width` | 4.6 | 线宽，投影到 1080 竖屏刚好 |
| `canvas` | 900 | 笔迹坐标系边长，改大更精细但笔画更多更慢 |
| `min_stroke_len` | 8 | 过滤碎线，调大画面更"简" |
| `simplify` | 1.6 | 折线简化容差，调大更抽象 |
| `stitch_gap` | 14 | 端点缝合距离。调大线条更连续、笔数更少；调到 0 关闭缝合 |

一幅 640 头像约 60~70 笔、5500~6000 像素总长。

**吞吐是怎么做到的**：生成（0.5s）和绘制是两条独立流水线，画 A 的同时已经在生成 B
（`app/main.py` 里的 `producer` / `presenter`），所以每个观众的耗时 ≈ 绘制时长 + 停留时长，
而不是两者相加。实测 14 个连续订单 16 秒跑完。

## 抖音接入

**先说结论：抖音没有给个人开发者开放"读取直播间弹幕+头像"的官方接口。**
三条路，按可行性排序。

### 路线 A：external 桥接（建议先用这个跑通）

不碰抖音协议，用现成的弹幕工具把事件转成 JSON 推给本项目：

```yaml
platform:
  type: external
  external:
    ws_url: "ws://127.0.0.1:9000/events"
```

你的桥接程序连上这个地址，发：

```json
{"type":"chat","nickname":"小明","avatar":"https://p3-pc.douyinpic.com/...","content":"1"}
{"type":"gift","nickname":"小明","avatar":"https://...","gift":"玫瑰"}
```

字段兼容 `nickname/nick_name/user`、`avatar/avatar_thumb`、`content/text/msg`。
现成的抖音弹幕工具（如 DouyinLiveWebFetcher 一类）拿到事件后转发一下就行，
十几行代码。好处是：协议变了只改桥接，画面和出图完全不受影响。

### 路线 B：本项目内置的 douyin 适配器

`app/platforms/douyin.py` 已经实现了握手、gzip 解帧、protobuf 免 proto 文件解码，
`WebcastChatMessage / GiftMessage / MemberMessage` 的用户昵称和 `avatar_thumb` 都能取到。

缺的是 `signature` —— 它由抖音前端混淆 JS 生成，几小时就失效，没法离线算。做法：

1. Chrome 打开直播间 `https://live.douyin.com/房间号`，F12 → Network → WS
2. 找 `webcast/im/push/v2` 这条连接，复制 Query String 里的
   `signature`、`ttwid`、`user_unique_id`、`device_id`
3. 复制 Request Headers 里的完整 `Cookie`
4. 全部填进 `config.yaml` → `platform.douyin`，`room_id` 填 URL 里那串房间号
5. `python run.py --source douyin --debug`

`--debug` 会把收到的每条消息类型打出来。如果昵称/头像取不到，
说明字段号漂移了，改 `douyin.py` 顶部的 `FIELD_MAP` 即可。

**风险**：非官方接口，抖音改协议就失效；频繁请求会触发风控；有账号风险。
自己小规模玩可以，别拿来做规模化商用抓取。

### 路线 C：抖音开放平台「直播小玩法」

官方支持弹幕/礼物/进场事件，但要求企业主体、游戏类目、审核签约，
个人开发者基本进不去。如果你有公司资质，这条路最稳，走通后把事件
按路线 A 的 JSON 格式喂进来即可，其他代码一行不用改。

## OBS 推流

1. 来源 → 添加 → **浏览器**
2. URL 填 `http://127.0.0.1:8848/`，宽 `1080` 高 `1920`
3. 勾上「关闭源时关闭页面」→ 不勾；「场景激活时刷新浏览器」→ 可勾
4. 右键 → 变换 → 适配屏幕
5. 设置 → 推流 → 自定义，服务商填抖音，粘贴 RTMP 地址和推流码

想让人和画同框：加摄像头源放右下角，浏览器源设成透明背景
（把 `overlay/style.css` 里 `#stage` 的 `background` 删掉即可）。

## 接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/` | 叠加层画面 |
| GET | `/api/status` | 队列/当前/日志 |
| POST | `/api/simulate` | 手动塞一单 `{"nickname","avatar"}` |
| GET | `/api/simulate?nickname=小明` | 同上，浏览器直接打开即可 |
| POST | `/api/control` | `{"action":"pause\|resume\|skip\|clear"}` |
| WS | `/ws/overlay` | 叠加层通道 |

## 已知限制

- 头像质量决定成画质量：糊图/logo/风景头像出图会很怪，可以加个
  "人脸检测不通过就换一张"的过滤（`cv2.CascadeClassifier` 即可，还没做）。
- `local` 模式不理解语义，复杂背景会画出多余线条；`openai` 模式明显更好。
- 笔顺是按"离上一笔终点最近"贪心排的，个别地方会有跨画面跳笔。
- 视频号没有可用的公开弹幕通道，只能投屏 OCR 或网页抓包，不建议做第一版。

## 许可

仅限个人学习、研究与技术交流使用，**不可用于商业用途**。商业授权请联系作者 QQ 993739647，详见仓库根目录 [LICENSE](../LICENSE)。
