/* 预置作品数据。访客提交的新作品存在浏览器 IndexedDB 里，不会写回这个文件。 */
window.CATEGORIES = [
  '3D 游戏',
  '知识教育',
  '图形渲染',
  'Web 应用',
  '数据可视化',
  '开发工具',
  '桌面应用',
  '自动化',
  'AI 应用',
  '效率工具',
  '内容创作',
  '音视频',
  '实验项目',
  '本地工具'
];

window.SITE = {
  name: 'AI 造物馆·智纪元',
  qq: '993739647',
  wechat: '智纪元AD',
  owner: 'jkl123456',
  repo: 'https://github.com/jkl123456/All'
};

window.SEED_PROJECTS = [
  {
    id: 'zhiyu',
    name: '知屿 · 知识群岛',
    tagline: '在会生长的海岛上建造、耕种、答题',
    categories: ['3D 游戏', '知识教育', '图形渲染', 'Web 应用'],
    platforms: ['Web', '移动端'],
    description:
      '《知屿·知识群岛》是一款把模拟经营、岛屿建造和跨学科学习放进同一片海的 3D 网页游戏。玩家继承一座只有旧帐篷和薄田的小岛，从砍下第一棵树、开出第一块田开始，慢慢把栖云岛变成能住人的家园。游戏没有把「学习」做成弹窗小游戏，而是把它变成地图上的七座学科岛：每座岛对应一门学科，岛上有自己的地形、居民和试炼线，答对问题才能拿到信物；信物不是分数，而是能带回家园的钥匙——一块新土地、一张图纸、一件工具。\n\n岛屿会生长。伐木、采石、开垦、建造都会改变地形与聚落，居民会搬进来，海岸线会随着扩建一点点向海里推。扩建需要材料，也需要学科信物：第一块地只要木材、石料和纤维，开局砍几棵树就能看见新土地从海里升起来；后面两块就得先通过对应学科的试炼。这形成了一个循环：想扩岛→去学科岛→答题→拿信物→回家建造→再扩岛。锻造、耕种、家具制作都挂在这个循环上，玩家不会为了「完成任务」而答题，而是为了把家建得更大。\n\nv2.0「手作光」把操作和画面重做了一遍。底部常驻操作坞把建造、扩建、学习放在拇指边，岛屿边缘立起扩张石碑，走过去按 E 就能填海；木纹、石纹、茅草、瓦片全部是运行时生成的程序化贴图，上千株草叶用 InstancedMesh 随风摆动，配合程序化环境贴图、轻量泛光和重写的水面。手机打开自动横屏，标题页、HUD、对话和建造面板都用横屏紧凑排版，设置里还能切左手 / 右手与三档摇杆。\n\n技术上，它用 Vite 5 + three.js 0.169，原生 ES Modules，没有前端框架。岛屿、配方、题库、对话都放在 src/data，内容与代码分离，新增一座岛或一道题不需要改渲染层，npm run validate 会检查内容完整性。整个项目没有后端，存档在 localStorage，打开网页就能玩。',
    gameplay: [
      '伐木、采石、耕种、建造，把荒岛扩成有居民的小镇',
      '七座学科岛各有一条试炼线，答题拿到信物才能解锁新土地与图纸',
      '锻造与制作：工具、家具、船件，部分蓝图需要跨学科信物',
      'W A S D 移动，E 互动，G 扩建，K 学习，M 海图',
      '手机自动横屏，支持左手 / 右手与三档摇杆'
    ],
    stack: ['three.js', 'Vite', 'WebGL2', 'GLSL', 'InstancedMesh'],
    repo: 'https://github.com/jkl123456/All/tree/main/knowledge-archipelago',
    contactName: 'jkl123456',
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
  },
  {
    id: 'universe',
    name: '知域 · 3D 知识图谱',
    tagline: '14 个学科、75 个知识点，一座可以闯关的星图',
    categories: ['知识教育', '数据可视化', '图形渲染', 'Web 应用'],
    platforms: ['Web', '移动端'],
    description:
      '《知域·3D 知识图谱》把「知识点」画成一片可以漫游的星图。打开页面是一颗颗悬浮的主星，每颗代表一个学科或行业方向：数学、物理、化学、生物、历史、语文、英语、地理，加上程序员、设计师、厨师、建筑、农民、渔民六个行业，一共 14 个方向。主星周围是 75 个知识点，连线表示前置关系，有的知识点要先把旁边那颗点亮才看得懂。\n\n点开知识点不是一段长文，而是一块纸白板。板书按「上一步 / 下一步」一笔一笔画出来：数学走「问题→旧办法→谁提出→公式→代入现实→边界」，历史走时间线与因果，语文按起承转合四格展开，行业讲「麻烦→代价→方法→操作→结果」。短关卡 5 到 7 步，长板书能到 10 到 16 步、分 3 页，前面画过的不擦掉，最后能看见完整推导。都江堰会把鱼嘴、内江外江、飞沙堰、宝瓶口的位置关系画在同一张图上；酸碱有 pH 色带；概率有 6×6 结果网格；桥梁会画梁、拱、桁架、悬索、斜拉五种受力。\n\n段位从黑铁到王者共 8 级，按累计星数晋级。每关最多 3 星：通关 1 星、检查点答对 1 星、全程不用提示 1 星。所有段位和关卡都能直接进入，不设解锁，星数只影响徽章与积分。挑战模式是另一条线：8 题、13 秒一题、3 颗心、连击倍率最高 2.4×，可选本段、已学或全体知识点，结束后给 S/A/B/C 评级和错题复盘。深链接支持 #enter、#lesson=chinese-poem-jingye、#tier=4、#challenge，方便把某一关直接发给别人。\n\n技术上用 esbuild + three.js 0.169，零运行时框架，构建后可以直接打开 index.html。星图是自研球面布局 + 力导向连线 + 镜头缓动，小行星用 InstancedMesh；板书是数据驱动的分步脚本，黏土贴片、手写标注和 SVG/DOM 混排。进度存 localStorage，没有账号也能用。',
    gameplay: [
      '点击知识点，用「上一步 / 下一步」逐格揭示板书',
      '8 个段位从黑铁到王者，按累计星数晋级，所有关卡直接开放',
      '挑战模式：8 题、13 秒一题、3 颗心、连击倍率 2.4×',
      '深链接 #lesson / #tier / #challenge，可直接分享某一关',
      '手机端单指旋转、双指缩放，节点与筛选栏重新排布'
    ],
    stack: ['three.js', 'esbuild', 'SVG', 'WebGL', 'LocalStorage'],
    repo: 'https://github.com/jkl123456/All/tree/main/knowledge-universe-3d',
    contactName: 'jkl123456',
    qq: '993739647',
    date: '2026-10-20',
    cover: 'assets/projects/universe/pc-2.jpg',
    images: [
      { src: 'assets/projects/universe/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/universe/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/universe/pc-3.jpg', label: 'pc' },
      { src: 'assets/projects/universe/pc-4.jpg', label: 'pc' },
      { src: 'assets/projects/universe/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/universe/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'racing',
    name: 'APEX CITY · 极速都市',
    tagline: '程序化城市 + 四视图重建车模的 3D 赛车',
    categories: ['3D 游戏', '图形渲染', 'Web 应用', '实验项目'],
    platforms: ['Web', '移动端'],
    description:
      '《APEX CITY·极速都市》是一款跑在浏览器里的完整 3D 城市赛车游戏。比赛发生在黄昏的港湾街道：整座滨海都市——街区、楼宇、店面、路灯、看台、发车门架、护栏和广告牌——都由代码程序化铺设，没有外部地图数据。发车后 5 台 AI 对手与你同场，3 圈定胜负；也可以切到计时挑战刷个人最快圈，或在自由驾驶里沿滨海公路慢慢开。\n\n两台赛车不是程序化盒子，而是依据四视图重建的真实 GLB 模型：蓝色厂队 GT3「STRADALE Vireo GT3」和白色耐力原型「AURELIA Nocturne LM」，各约 12 万三角面、带 PBR 贴图。灯组、尾翼、进气口、扩散器、轮毂、号码和厂队涂装都烘焙在模型里，引擎侧只额外补了刹车灯辉光、车底阴影和换色着色器。AI 对手复用同款车体，按各自车漆做主色区域替换，号码牌、红色纹样和碳纤维保留原样。\n\n四条赛道各有性格：港湾环道 1.41 km，紧凑慢弯，容错低；海风高速 1.50 km，连续高速弯加长背直道，全油门节奏；中环夜街 1.31 km，窄街组合弯，贴墙飞行；林间山道 1.74 km，松林夹道，盲弯连发。每条赛道都有独立地形、海岸线、城市街区或森林植被，路面、路缘石、护栏、发车门架、看台、维修区和广告牌全部加载。\n\n操作是街机式的：W/↑ 油门，S/↓ 刹车倒车，A D/← → 转向，Space 手刹漂移（漂移为氮气充能），Shift 氮气，C 切追逐 / 引擎盖视角，R 回赛道，P 在结算后进照片模式。支持标准 Xbox 手柄，RT 油门、LT 刹车、左摇杆模拟转向。手机端横屏触控，左下方向、右下油门刹车与氮气。\n\n技术上用 esbuild + three.js 0.169，纯前端无后端。城市与赛道由样条中心线生成，建筑和设施用合并网格 / InstancedMesh 控制 draw call；后期有泛光、色调映射和速度感，引擎声是程序化 Web Audio，碰撞用 AABB / 胶囊并做赛道边界约束。构建后直接双击 index.html 就能玩，不需要联网。',
    gameplay: [
      '城市大奖赛：静态发车，5 台 AI 对手，3 圈定胜负',
      '计时挑战刷个人最快圈，自由驾驶没有对手与计时',
      '四条赛道：港湾环道、海风高速、中环夜街、林间山道',
      'Space 手刹漂移为氮气充能，Shift 释放氮气',
      '支持标准 Xbox 手柄与手机横屏触控'
    ],
    stack: ['three.js', 'esbuild', 'GLSL', 'Web Audio', 'GLTF'],
    repo: 'https://github.com/jkl123456/All/tree/main/official-demo-02-racing',
    contactName: 'jkl123456',
    qq: '993739647',
    date: '2026-10-18',
    cover: 'assets/projects/racing/pc-2.jpg',
    images: [
      { src: 'assets/projects/racing/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/racing/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/racing/pc-3.jpg', label: 'pc' },
      { src: 'assets/projects/racing/pc-4.jpg', label: 'pc' },
      { src: 'assets/projects/racing/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/racing/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'prompt-studio',
    name: '批量提示词工作台',
    tagline: '把「写需求 → 粘贴 → 等 AI 写完」自动化',
    categories: ['开发工具', '桌面应用', '自动化', 'AI 应用', '效率工具'],
    platforms: ['Windows'],
    description:
      '《批量提示词工作台》是一个面向「批量造项目」场景的 Windows 桌面工具。它要解决的动作很具体：写需求→打开 AI→粘贴→等它写完→再写下一个。软件把这套流程变成一条队列：你在左侧建 N 个项目，每个项目写清需求、挂上图片和附件；点一次「开始批量执行」，它会自动打开或激活目标 AI 客户端（默认 WorkBuddy），把提示词填进输入框、按回车发送，等 AI 输出完成后自动开始下一个，直到整条队列跑完。\n\n每个项目会自动分配独立工作目录，路径写进提示词，AI 直接产在那个目录里。图片作为剪贴板图片粘贴进输入框，其他附件把本机路径写进提示词，AI 可以直接读取。右侧是当前项目的详情、附件、单项目超时、实时日志和执行控制，进度条、当前项目、倒计时都能看见，随时暂停、继续、跳过或停止。\n\n最难的是判断「AI 什么时候写完」，软件给了三种模式：画面静止检测（定时截屏比对窗口，连续 N 秒基本不变即认为完成）、固定时长等待、手动确认。输入框定位做了四重保险：先读系统无障碍树拿真实矩形，再退回手动定位点，再按当前布局横向扫描，点击后还要用「粘贴→全选复制→回读剪贴板」确认这个位置真的能吃进文字，所以右侧弹出预览面板、对话区被压窄、窗口尺寸变化时都不需要重新取样。\n\n还内置了 82 个原创需求模板，分游戏、游戏 + 学习、办公、娱乐、大型项目五个方向，选数量一次生成 N 个；提示词支持 {{title}}、{{details}}、{{attachments}}、{{index}}、{{total}} 占位符。数据全部存在本地，附件自动复制到数据目录，不联网、不上传。\n\n技术上用 Electron 33 + 原生 HTML/CSS/JS，没有前端框架。Node 侧用 fs 管项目和附件、child_process 调 PowerShell、窗口枚举与激活；Windows UI 自动化用 UIAutomation 读输入框矩形、剪贴板读写校验、截屏比对判定完成。',
    gameplay: [
      '项目队列：新建 / 复制 / 删除 / 排序，标题 + 需求详情',
      '每个项目独立工作目录，路径自动写进提示词',
      '82 个原创需求模板，五个方向一次生成整条队列',
      '三种完成判定：画面静止、固定等待、手动确认',
      '无障碍树定位输入框 + 剪贴板回读校验，窗口变化不用重新取样'
    ],
    stack: ['Electron', 'Node.js', 'UIAutomation', 'PowerShell', '原生 JS'],
    repo: 'https://github.com/jkl123456/All/tree/main/prompt-batch-studio',
    contactName: 'jkl123456',
    qq: '993739647',
    date: '2026-10-24',
    cover: 'assets/projects/prompt-studio/pc-1.jpg',
    images: [
      { src: 'assets/projects/prompt-studio/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/pc-3.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/pc-4.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/prompt-studio/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'mossbrook',
    name: '苔溪镇 · Mossbrook Village',
    tagline: '模块化中世纪小镇与程序化骨骼动画',
    categories: ['3D 游戏', '图形渲染', '实验项目', 'Web 应用'],
    platforms: ['Web', '移动端'],
    description:
      '《苔溪镇·Mossbrook Village》是一个没有任务的小镇漫步游戏。广场中央是一口石井，四周是条纹遮阳棚的摊位、木栅栏、货车、篝火和闲逛的鹿；街道把广场、客栈、钟楼和北门连起来，边缘接着雨林。玩家可以在里面随意走，没有目标、没有倒计时，也不会被弹出对话框打断。\n\n小镇不是一整块模型，而是用模块化墙体、屋顶、门窗、栅栏、摊位拼装出来的。每栋房子由布局数据决定尺寸、层数、屋顶样式和门窗位置，换一套数据就是另一座镇。游戏里有明确的碰撞：房屋、栅栏、货车、木箱和树木都会挡住角色，可以贴着墙面滑动；右上角小地图实时显示位置和所在区域——中央广场、北门农舍、客栈门口、雨林边缘。\n\n角色使用低多边形冒险者模型，行走、奔跑、站立呼吸全部是代码驱动的程序化骨骼动画，不依赖预制动画片段。骨骼命名在不同模型之间并不统一（Unreal 风格 thigh_l、Blender 风格 thigh.L），代码里有一张别名表，把同一套动作套到不同 Humanoid 骨架上，所以换角色模型不需要重做动画。\n\n操作很轻：W A S D 或方向键移动，Shift 奔跑，按住鼠标拖动旋转镜头，滚轮拉近拉远，H 显示 / 隐藏界面。手机端横屏触控，左下摇杆移动，右侧拖动视角。整个项目没有构建工具，three.js 通过本地 vendor 加载，npm start 起一个零依赖静态服务器就能跑。\n\n技术上用 three.js 0.169 + GLTFLoader，纯 ES Modules。场景用模块化拼装 + InstancedMesh 复用高频道具；碰撞是 AABB/OBB 混合检测加贴墙滑动，第三人称相机有避障和阻尼跟随；动物有简单的行为循环，鹿会在广场和树林之间走动。美术基于 Quaternius 的 Medieval Village 与 Modular Character 素材包改造，仓库只保留运行所需的 GLB，原始素材包和 .blend 源文件没有上传。',
    gameplay: [
      '自由漫步：WASD / 方向键移动，Shift 奔跑，鼠标拖动转视角',
      '区域探索：广场、街道、客栈门口、北门、雨林边缘',
      '碰撞与贴墙滑动，小地图实时显示位置与区域',
      '鹿群在广场与树林之间走动，有简单行为循环',
      '手机横屏触控：左下摇杆移动，右侧拖动视角'
    ],
    stack: ['three.js', 'GLTF', 'ES Modules', 'Canvas'],
    repo: 'https://github.com/jkl123456/All/tree/main/xiaozhen',
    contactName: 'jkl123456',
    qq: '993739647',
    date: '2026-10-26',
    cover: 'assets/projects/mossbrook/pc-3.jpg',
    images: [
      { src: 'assets/projects/mossbrook/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/pc-3.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/pc-4.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/mossbrook/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'video-workshop',
    name: '自动视频图文工坊',
    tagline: '文案 → 配图 → 配音 → 字幕 → 成片',
    categories: ['内容创作', '音视频', '自动化', 'AI 应用', '本地工具'],
    platforms: ['Web', 'Windows'],
    description:
      '《自动视频图文工坊》是一条本地运行的短视频流水线。它不生成文案、不发布，只负责把已有的文案变成成片：每行文案→配图（自动化浏览器）→配音（DashScope）→字幕 / 片头→拼接成片（ffmpeg）。界面是一个本地网页，左边选模式，右边是分镜列表：每一行是一段文案，配一张图、一段配音和一个视频位。\n\n它不调用爬虫接口，而是复用真实浏览器里的登录态：首次使用点「启动浏览器」，程序拉起一个独立的 Chrome 窗口（专用配置目录，不影响日常浏览器），在里面登录豆包（需要视频时再登录即梦），之后所有任务都在这个窗口里跑。生成过程中 AI 会盯着对话，确认回复完成再取图；数量不够会按重试策略补生成，失败时先判断是重试还是中止。\n\n两种模式：图文成片是图片 + 配音，视频成片是图片 + 视频 + 配音。分镜可以单独生成、上传、覆盖图片 / 视频 / 音频，也可以粘贴整段文案按行拆分，或导入剧集文件逐集生成。一键全流程会依次完成生图、配音、字幕 / 片头、拼接，日志实时滚动，可中断、可跳过、可重跑单条。成片在页面里直接预览。\n\n配置上，首次使用需要复制 config.example.json 为 config.json，填入 DeepSeek 与 DashScope 的 Key；系统需要安装 ffmpeg 并加入 PATH。浏览器配置、成片、缓存都放在 data/ 下，不上传云端。\n\n技术上用 Python 3 + Flask 做本地 HTTP 服务和控制台日志总线；Selenium 驱动独立 Chrome profile，复用豆包 / 即梦登录态；DashScope CosyVoice 做 TTS；ffmpeg 完成字幕烧录、片头、转场和拼接。前端是原生 HTML/CSS/JS，任务队列和状态机在 core/pipeline.py，DeepSeek API 负责生成过程中的自动判断与补图决策。',
    gameplay: [
      '图文成片 / 视频成片两种模式，按需组合图片、视频与配音',
      '粘贴整段文案按行拆分，或导入剧集文件逐集生成',
      '一键全流程：生图 → 配音 → 字幕 / 片头 → 拼接',
      '单条可重跑、可中断，成片在页面内直接预览',
      'AI 全程盯豆包，自动判断完成、补图与重试'
    ],
    stack: ['Python', 'Flask', 'Selenium', 'ffmpeg', 'CosyVoice'],
    repo: 'https://github.com/jkl123456/All/tree/main/zidongtuwen',
    contactName: 'jkl123456',
    qq: '993739647',
    date: '2026-10-24',
    cover: 'assets/projects/video-workshop/pc-3.jpg',
    images: [
      { src: 'assets/projects/video-workshop/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/pc-3.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/pc-4.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/video-workshop/mobile-2.jpg', label: 'mobile' }
    ]
  }
];
