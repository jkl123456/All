/* 预置作品数据。提交的新作品存在浏览器 IndexedDB 里，不会写回这个文件。 */
window.SEED_PROJECTS = [
  {
    id: 'zhiyu',
    name: '知屿 · 知识群岛',
    tagline: '在会生长的海岛上建造、耕种、答题',
    category: '游戏',
    platforms: ['Web', '移动端'],
    description:
      '浏览器里的 3D 岛屿生活游戏。继承一座只有旧帐篷的小岛，乘船前往七座学科岛，通过知识试炼拿到信物、材料与图纸，再回栖云岛建屋、耕种、锻造，让海岸线一点点向海里生长。',
    gameplay: [
      '伐木采石、开垦建造，把荒岛扩成有居民的小镇',
      '七座学科岛各有一条试炼线，答题解锁土地与图纸',
      '手机自动横屏，支持左手 / 右手与三档摇杆'
    ],
    stack: ['three.js', 'Vite', 'WebGL2', 'GLSL'],
    repo: 'https://github.com/jkl123456/All/tree/main/knowledge-archipelago',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/zhiyu/pc-1.jpg',
    images: [
      { src: 'assets/projects/zhiyu/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/zhiyu/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/zhiyu/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/zhiyu/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'universe',
    name: '知域 · 3D 知识图谱',
    tagline: '14 个学科、75 个知识点，一座可以闯关的星图',
    category: '知识教育',
    platforms: ['Web', '移动端'],
    description:
      '把知识画成一片可以漫游的星图。每个学科是一颗主星，知识点是周围的小行星，连线表示前置关系。点进去不是长文，而是一块会逐步生长的板书，按「上一步 / 下一步」一笔一笔画完。',
    gameplay: [
      '8 个段位从黑铁到王者，按累计星数晋级',
      '挑战模式：8 题、13 秒一题、3 颗心、连击倍率 2.4×',
      '深链接可直接跳到学科、关卡或挑战'
    ],
    stack: ['three.js', 'esbuild', 'SVG', 'LocalStorage'],
    repo: 'https://github.com/jkl123456/All/tree/main/knowledge-universe-3d',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/universe/pc-2.jpg',
    images: [
      { src: 'assets/projects/universe/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/universe/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/universe/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/universe/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'racing',
    name: 'APEX CITY · 极速都市',
    tagline: '程序化城市 + 四视图重建车模的 3D 赛车',
    category: '游戏',
    platforms: ['Web', '移动端'],
    description:
      '黄金时刻的港湾街道。整座滨海都市由代码铺设，两台依据四视图重建的 GT 赛车各约 12 万三角面，5 台 AI 对手同场竞速，支持漂移、氮气与手柄。',
    gameplay: [
      '城市大奖赛 / 计时挑战 / 自由驾驶三种模式',
      '四条赛道：港湾环道、海风高速、中环夜街、林间山道',
      'Space 手刹漂移充能，Shift 氮气，P 进入照片模式'
    ],
    stack: ['three.js', 'esbuild', 'GLSL', 'Web Audio'],
    repo: 'https://github.com/jkl123456/All/tree/main/official-demo-02-racing',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/racing/pc-2.jpg',
    images: [
      { src: 'assets/projects/racing/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/racing/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/racing/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/racing/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'prompt-studio',
    name: '批量提示词工作台',
    tagline: '把「写需求 → 粘贴 → 等 AI 写完」自动化',
    category: '开发工具',
    platforms: ['Windows'],
    description:
      'Windows 桌面工具。建 N 个项目、写清需求、挂上素材，点一次开始，它会自动激活目标 AI 客户端、填入提示词、发送，等输出完成后接着跑下一个。',
    gameplay: [
      '82 个原创需求模板，一次生成整条队列',
      '三种完成判定：画面静止、固定等待、手动确认',
      '无障碍树定位输入框 + 剪贴板回读校验'
    ],
    stack: ['Electron', 'Node.js', 'UIAutomation', 'PowerShell'],
    repo: 'https://github.com/jkl123456/All/tree/main/prompt-batch-studio',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/prompt-studio/pc-1.jpg',
    images: [
      { src: 'assets/projects/prompt-studio/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/prompt-studio/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/prompt-studio/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'mossbrook',
    name: '苔溪镇 · Mossbrook Village',
    tagline: '模块化中世纪小镇与程序化骨骼动画',
    category: '游戏',
    platforms: ['Web', '移动端'],
    description:
      '一个没有任务的小镇。石井、集市、客栈、钟楼、鹿群与雨林边缘，走进去就能逛。房屋由模块化墙体、屋顶、门窗拼装，角色行走与呼吸全靠代码驱动骨骼。',
    gameplay: [
      'WASD 移动、Shift 奔跑、拖拽旋转镜头',
      '房屋、栅栏、货车、树木都有碰撞，可贴墙滑动',
      '小地图实时显示位置与所在区域'
    ],
    stack: ['three.js', 'GLTF', 'ES Modules', 'Canvas'],
    repo: 'https://github.com/jkl123456/All/tree/main/xiaozhen',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/mossbrook/pc-1.jpg',
    images: [
      { src: 'assets/projects/mossbrook/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/mossbrook/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/mossbrook/mobile-2.jpg', label: 'mobile' }
    ]
  },
  {
    id: 'video-workshop',
    name: '自动视频图文工坊',
    tagline: '文案 → 配图 → 配音 → 字幕 → 成片',
    category: '自动化',
    platforms: ['Web', 'Windows'],
    description:
      '本地运行的短视频流水线。每行文案自动配图、合成配音、烧字幕、加片头，最后用 ffmpeg 拼成片。复用真实浏览器登录态，不调爬虫接口。',
    gameplay: [
      '图文成片 / 视频成片两种模式',
      '粘贴整段文案按行拆分，或导入剧集逐集生成',
      'AI 全程盯豆包，自动判断完成、补图与重试'
    ],
    stack: ['Python', 'Flask', 'Selenium', 'ffmpeg', 'CosyVoice'],
    repo: 'https://github.com/jkl123456/All/tree/main/zidongtuwen',
    contactName: 'jkl123456',
    contact: 'https://github.com/jkl123456',
    cover: 'assets/projects/video-workshop/pc-1.jpg',
    images: [
      { src: 'assets/projects/video-workshop/pc-1.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/pc-2.jpg', label: 'pc' },
      { src: 'assets/projects/video-workshop/mobile-1.jpg', label: 'mobile' },
      { src: 'assets/projects/video-workshop/mobile-2.jpg', label: 'mobile' }
    ]
  }
];
