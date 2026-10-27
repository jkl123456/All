/**
 * 知域 · 内容数据
 * 每个领域包含 3～10 个知识点；每个知识点对应一个可交互的 3D 演示。
 * 扩充知识点来自 extra.js，段位来自 tiers.js。
 */
import { EXTRA_POINTS } from './extra.js';
import { POINT_TIER } from './tiers.js';

export const SUBJECTS = [
  {
    id: 'math',
    name: '数学',
    en: 'MATHEMATICS',
    glyph: '数',
    color: '#5B9DFF',
    kind: 'academic',
    tagline: '用符号描述世界的秩序',
    intro: '从一条投篮弧线到一个黄金矩形，数学把现实世界压缩成可以被推演的语言。',
    points: [
      {
        id: 'math-parabola',
        title: '抛物线',
        hook: '篮球出手后的完美弧线',
        tags: ['二次函数', '运动学'],
        summary:
          '二次函数的图像是一条抛物线。在重力作用下，斜抛物体在水平方向匀速、竖直方向匀变速，合成的轨迹正好是一条抛物线。',
        case:
          '库里投篮时，篮球离手后的轨迹近似抛物线。出手角度约 45°～52°、配合合适的初速度，才能让球在最高点附近越过防守，再落进篮筐。',
        principles: [
          '水平方向匀速：x = v₀cosθ · t',
          '竖直方向匀变速：y = v₀sinθ · t − ½gt²',
          '消去时间 t，得到一条开口向下的抛物线',
        ],
        formula: 'y = x·tanθ − gx² / (2v₀²cos²θ)',
        demo: { type: 'projectile' },
      },
      {
        id: 'math-golden',
        title: '黄金比例',
        hook: '帕特农神庙里的 1.618',
        tags: ['比例', '几何'],
        summary:
          '把一条线段分成两段，使整体比长段等于长段比短段，这个比值约为 1.618，被称为黄金比例 φ。',
        case:
          '帕特农神庙正立面的宽高比接近 1.618；向日葵种子按约 137.5° 的黄金角螺旋排列，能获得最密的堆积。设计师也常用它安排版式与留白。',
        principles: [
          'φ = (1 + √5) / 2 ≈ 1.618',
          '黄金矩形不断切掉正方形，可以铺出一条螺旋',
          '黄金角 ≈ 137.5°，让种子均匀分布',
        ],
        formula: 'φ = (1 + √5) / 2 ≈ 1.618',
        demo: { type: 'golden' },
      },
      {
        id: 'math-probability',
        title: '概率',
        hook: '掷骰子与天气预报',
        tags: ['统计', '随机'],
        summary:
          '概率用 0 到 1 之间的数描述随机事件发生的可能性。大量重复试验中，事件发生的频率会稳定在它的概率附近。',
        case:
          '天气预报说“明天降雨概率 70%”，不是说明天有七成时间在下雨，而是在相似的气象条件下，100 次里大约有 70 次会下雨。',
        principles: [
          '每个结果的概率都在 0 到 1 之间',
          '所有可能结果的概率之和等于 1',
          '大数定律：试验越多，频率越接近概率',
        ],
        formula: 'P(A) = 有利结果数 / 所有等可能结果数',
        demo: { type: 'probability' },
      },
    ],
  },
  {
    id: 'physics',
    name: '物理',
    en: 'PHYSICS',
    glyph: '理',
    color: '#9B7BFF',
    kind: 'academic',
    tagline: '读懂万物运行的规则',
    intro: '从摆钟的一秒到巨轮的浮力，物理把日常现象还原成少数几条守恒与作用规律。',
    points: [
      {
        id: 'physics-pendulum',
        title: '单摆',
        hook: '摆钟如何守住一秒',
        tags: ['振动', '周期'],
        summary:
          '小角度摆动时，单摆的周期只与摆长和重力加速度有关，与摆球质量、振幅无关，这叫单摆的等时性。',
        case:
          '1656 年，惠更斯据此造出摆钟，把日误差从 15 分钟降到 15 秒。摆长约 0.994 米的单摆，周期恰好是 2 秒，钟摆每摆一次就是一秒。',
        principles: [
          '周期公式：T = 2π√(L/g)',
          '摆球质量不影响周期（等时性）',
          '只有小角度摆动时，sinθ ≈ θ 才成立',
        ],
        formula: 'T = 2π√(L/g)',
        demo: { type: 'pendulum' },
      },
      {
        id: 'physics-buoyancy',
        title: '浮力',
        hook: '钢铁巨轮为什么能浮',
        tags: ['流体', '阿基米德'],
        summary:
          '浸在流体中的物体受到向上的浮力，浮力大小等于它排开的流体所受的重力。',
        case:
          '一艘 20 万吨的矿砂船，船体做成空心，排开海水的体积足够大，浮力就能平衡自重与货物。潜水艇则通过注水、排水改变自身重力，实现下潜与上浮。',
        principles: [
          '阿基米德原理：F浮 = ρ液 · g · V排',
          '浮力来自物体上下表面的压力差',
          '漂浮时浮力与重力平衡：F浮 = G物',
        ],
        formula: 'F浮 = ρ液 · g · V排',
        demo: { type: 'buoyancy', config: { mode: 'ship' } },
      },
      {
        id: 'physics-induction',
        title: '电磁感应',
        hook: '风如何点亮一座城',
        tags: ['电磁', '能源'],
        summary:
          '闭合电路的一部分导体在磁场中做切割磁感线运动时，电路中会产生感应电流，机械能转化为电能。',
        case:
          '风力发电机的叶片带动转子，让线圈在磁场中持续转动，机械能转化为电能。偏航、变桨与变速控制，都是为了让切割磁感线的效率更高。',
        principles: [
          '磁通量变化产生感应电动势',
          '感应电流的方向总是阻碍磁通量的变化（楞次定律）',
          '能量转化：风能 → 机械能 → 电能',
        ],
        formula: 'E = −N · ΔΦ / Δt',
        demo: { type: 'induction' },
      },
    ],
  },
  {
    id: 'chemistry',
    name: '化学',
    en: 'CHEMISTRY',
    glyph: '化',
    color: '#2FE0A8',
    kind: 'academic',
    tagline: '看见分子之间的握手',
    intro: '水、火焰与雪花都由微粒构成。化学研究它们如何结合、拆分，又如何释放能量。',
    points: [
      {
        id: 'chemistry-water',
        title: '分子结构',
        hook: '一个水分子的两个氢键',
        tags: ['共价键', '极性'],
        summary:
          '水分子由两个氢原子和一个氧原子通过共价键结合，呈约 104.5° 的 V 形，是极性分子。',
        case:
          '水分子的极性让它能溶解盐和糖，也能通过氢键形成表面张力。水黾因此能在水面行走，植物也能把水从根部一路运到叶尖。',
        principles: [
          '共价键：原子共享电子对',
          '氧原子有两对孤对电子，把键角压到约 104.5°',
          '极性分子之间形成氢键，带来高沸点与表面张力',
        ],
        formula: 'H₂O，键角 ≈ 104.5°',
        demo: { type: 'molecule' },
      },
      {
        id: 'chemistry-combustion',
        title: '燃烧',
        hook: '燃气灶上的一簇蓝火',
        tags: ['氧化反应', '能量'],
        summary:
          '燃烧是可燃物与氧气发生的剧烈氧化反应，释放光和热。甲烷充分燃烧生成二氧化碳和水。',
        case:
          '天然气的主要成分是甲烷，在灶具中与空气预混后燃烧，蓝焰温度高、燃烧充分。如果进风不足，火焰发黄并产生一氧化碳，所以厨房必须保持通风。',
        principles: [
          '甲烷燃烧：CH₄ + 2O₂ → CO₂ + 2H₂O',
          '充分燃烧需要足够的氧气和良好的混合',
          '不完全燃烧会产生有毒的一氧化碳',
        ],
        formula: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
        demo: { type: 'combustion' },
      },
      {
        id: 'chemistry-crystal',
        title: '晶体',
        hook: '雪花为什么总是六瓣',
        tags: ['晶体', '对称'],
        summary:
          '晶体中的微粒按一定规则周期性排列。雪花是水分子以六方冰晶为骨架生长出来的晶体。',
        case:
          '雪花在云中从一个小冰晶开始，沿六个方向优先生长。温度和湿度的细微差别会形成片状、柱状、针状等上万种形态，但六重对称始终保留。',
        principles: [
          '晶体具有规则的点阵结构',
          '六方冰晶的分子排列决定六重对称',
          '生长环境的温湿度决定最终形态',
        ],
        formula: '六方晶系：a = b ≠ c，γ = 120°',
        demo: { type: 'crystal' },
      },
    ],
  },
  {
    id: 'english',
    name: '英语',
    en: 'ENGLISH',
    glyph: '英',
    color: '#FFC94D',
    kind: 'academic',
    tagline: '换一种方式组织世界',
    intro: '介词描述空间，时态描述时间，词根串起词汇。语言是一套可以看见结构的系统。',
    points: [
      {
        id: 'english-preposition',
        title: '方位介词',
        hook: 'in / on / under 的空间逻辑',
        tags: ['介词', '空间'],
        summary:
          '方位介词描述两个物体之间的空间关系：in 表示在内部，on 表示在表面接触，under 表示在正下方。',
        case:
          '“The keys are on the table.” 钥匙与桌面接触；“in the drawer” 在抽屉内部；“under the bed” 在床的正下方。换一个介词，画面就完全不同。',
        principles: [
          'in = 被包围或在某个范围内',
          'on = 与表面接触',
          'under = 垂直下方；介词后接名词或代词宾格',
        ],
        formula: '位置关系 = 介词 + 名词短语',
        demo: { type: 'preposition' },
      },
      {
        id: 'english-tense',
        title: '时态',
        hook: '一条时间轴看懂英语时态',
        tags: ['语法', '时间'],
        summary:
          '英语时态由“时间”（过去 / 现在 / 将来）与“体”（一般 / 进行 / 完成 / 完成进行）交叉构成。',
        case:
          '“I have lived here for ten years.” 强调从过去一直延续到现在；“I lived here for ten years.” 只陈述过去的一段经历。同一件事，时态不同，与现在的联系就不同。',
        principles: [
          '时间轴分为过去、现在、将来',
          '完成体强调“截至某一时刻”的结果或延续',
          '进行体强调某一时刻正在发生',
        ],
        formula: 'have / has + 过去分词（现在完成时）',
        demo: { type: 'timeline' },
      },
      {
        id: 'english-wordtree',
        title: '词根词缀',
        hook: 'spect = 看见',
        tags: ['词根', '构词法'],
        summary:
          '词根承载核心含义，前缀改变方向，后缀改变词性。掌握一个词根，就能串起一整族单词。',
        case:
          'inspect（向内看 → 检查）、respect（回头看 → 尊重）、spectator（看的人 → 观众）、perspective（看穿 → 视角）。记住 spect，就像拿到一串钥匙。',
        principles: [
          '前缀表示方向、否定或数量',
          '词根承载核心语义',
          '后缀决定词性：-or 人、-ion 名词、-ive 形容词',
        ],
        formula: 'prefix + spect + suffix',
        demo: { type: 'wordTree' },
      },
    ],
  },
  {
    id: 'biology',
    name: '生物',
    en: 'BIOLOGY',
    glyph: '生',
    color: '#79E86B',
    kind: 'academic',
    tagline: '生命是一部精密的分形',
    intro: '从叶绿体捕获的一束光，到 DNA 里的一串字母，生命用极小的结构支撑极大的系统。',
    points: [
      {
        id: 'biology-photosynthesis',
        title: '光合作用',
        hook: '一片叶子里的太阳能工厂',
        tags: ['叶绿体', '能量'],
        summary:
          '绿色植物利用光能，把二氧化碳和水合成有机物（葡萄糖），并释放氧气，完成光能到化学能的转化。',
        case:
          '一片中等大小的叶子一天能合成几克糖，同时释放足够一个人呼吸的氧气。地球大气中的氧，几乎都来自几十亿年的光合作用。',
        principles: [
          '场所：叶绿体；条件：光',
          '原料：CO₂ 和 H₂O',
          '产物：葡萄糖和 O₂',
        ],
        formula: '6CO₂ + 6H₂O —光/叶绿体→ C₆H₁₂O₆ + 6O₂',
        demo: { type: 'photosynthesis' },
      },
      {
        id: 'biology-dna',
        title: 'DNA 双螺旋',
        hook: '30 亿个字母写成的你',
        tags: ['遗传', '双螺旋'],
        summary:
          'DNA 是由四种碱基（A、T、C、G）组成的双螺旋分子。碱基互补配对保证遗传信息可以被精确复制。',
        case:
          '人类基因组约有 30 亿个碱基对。把一个人的 DNA 拉直，长度约 2 米，却能装进直径只有 6 微米的细胞核。亲子鉴定与刑侦比对，都依赖碱基序列的特异性。',
        principles: [
          '双螺旋骨架由磷酸和脱氧核糖构成',
          'A 与 T、C 与 G 互补配对',
          '半保留复制保证遗传信息稳定传递',
        ],
        formula: 'A = T（2 个氢键），C ≡ G（3 个氢键）',
        demo: { type: 'dna' },
      },
      {
        id: 'biology-foodchain',
        title: '生态系统',
        hook: '草原上的一条能量阶梯',
        tags: ['食物链', '能量流动'],
        summary:
          '生态系统由生产者、消费者和分解者构成。能量沿食物链单向流动，每一级约只有 10%～20% 传递到下一级。',
        case:
          '草原上，草 → 兔 → 狐狸 → 鹰构成食物链。要养活一只鹰，需要大量兔子和更多草，所以顶级捕食者数量总是很少，营养级一般不超过五级。',
        principles: [
          '生产者通过光合作用固定太阳能',
          '能量单向流动、逐级递减',
          '物质可以循环利用，能量不能',
        ],
        formula: '能量传递效率 ≈ 10%～20%',
        demo: { type: 'foodchain' },
      },
    ],
  },
  {
    id: 'geography',
    name: '地理',
    en: 'GEOGRAPHY',
    glyph: '地',
    color: '#35C8F5',
    kind: 'academic',
    tagline: '在尺度之间理解家园',
    intro: '从地核到季风，从板块漂移到一层梯田，地理把空间与时间叠在一起。',
    points: [
      {
        id: 'geography-earth',
        title: '地球圈层',
        hook: '从地核到大气',
        tags: ['圈层', '地球内部'],
        summary:
          '地球内部由地核、地幔、地壳组成；外部有大气圈、水圈和生物圈，共同构成人类生存的环境。',
        case:
          '地核温度可达 5000℃ 以上，外核流动的液态铁产生地球磁场，为我们挡住太阳风。地壳平均只有约 17 千米厚，却承载着全部大陆与海洋。',
        principles: [
          '内部圈层：地壳、地幔、地核',
          '外部圈层：大气圈、水圈、生物圈',
          '软流层是岩浆的主要发源地',
        ],
        formula: '地壳 ≈ 17 km / 地幔 ≈ 2900 km / 地核 ≈ 3480 km',
        demo: { type: 'earthLayers' },
      },
      {
        id: 'geography-monsoon',
        title: '季风',
        hook: '夏天为什么吹东南风',
        tags: ['气候', '大气环流'],
        summary:
          '海陆热力性质差异造成气压差，风从高压吹向低压，并受地转偏向力影响发生偏转，形成季风。',
        case:
          '夏季陆地升温快，形成低压，风从海洋吹向陆地，我国东部盛行东南季风，带来丰沛降水；冬季相反，盛行西北风，寒冷干燥。',
        principles: [
          '海陆比热容差异造成气压差',
          '夏季风：海洋 → 陆地；冬季风：陆地 → 海洋',
          '地转偏向力使风向发生偏转',
        ],
        formula: '风向 = 气压梯度力 + 地转偏向力 + 摩擦力',
        demo: { type: 'monsoon' },
      },
      {
        id: 'geography-plates',
        title: '板块运动',
        hook: '喜马拉雅山还在长高',
        tags: ['板块构造', '地震'],
        summary:
          '岩石圈被划分为多个板块，板块在地幔对流驱动下运动。碰撞挤压形成山脉，张裂形成裂谷与海洋。',
        case:
          '印度板块以每年约 5 厘米的速度撞向欧亚板块，喜马拉雅山仍在缓慢抬升，珠峰每年约长高 0.3～1 厘米，同时地震频繁。',
        principles: [
          '板块内部相对稳定，边界活跃',
          '消亡边界：碰撞挤压，形成山脉或海沟',
          '生长边界：张裂拉伸，形成裂谷或洋中脊',
        ],
        formula: '印度板块 ≈ 5 cm / 年',
        demo: { type: 'plates' },
      },
    ],
  },
  {
    id: 'history',
    name: '历史',
    en: 'HISTORY',
    glyph: '史',
    color: '#D977FF',
    kind: 'academic',
    tagline: '在时间里寻找因果',
    intro: '一座水利工程、一条商路、一套活字，都是文明留下来的解题思路。',
    points: [
      {
        id: 'history-dujiangyan',
        title: '都江堰',
        hook: '无坝引水，泽被两千年',
        tags: ['水利工程', '李冰'],
        summary:
          '战国时期李冰主持修建的都江堰，由鱼嘴分水堤、飞沙堰溢洪道和宝瓶口引水口三大主体工程组成，至今仍在灌溉成都平原。',
        case:
          '鱼嘴把岷江分为内江和外江，内江引水灌溉、外江泄洪；飞沙堰在洪水时溢流排沙；宝瓶口控制进水量。三者配合，实现“旱则引水浸润，雨则杜塞水门”。',
        principles: [
          '鱼嘴：四六分水，内外江分流',
          '飞沙堰：溢洪排沙，保护灌区',
          '宝瓶口：控制进水量，稳定引水',
        ],
        formula: '深淘滩，低作堰',
        demo: { type: 'dujiangyan' },
      },
      {
        id: 'history-silkroad',
        title: '丝绸之路',
        hook: '一条路，连接两个文明',
        tags: ['张骞', '文明交流'],
        summary:
          '丝绸之路是汉代张骞出使西域后逐渐形成的贸易通道，东起长安，经河西走廊、西域，通往中亚、西亚和欧洲。',
        case:
          '商队带着丝绸、瓷器西去，带回葡萄、苜蓿、良马和玻璃器。它不只是商路，也是宗教、艺术与技术的传播通道，佛教正是沿这条路传入中国。',
        principles: [
          '张骞两次出使西域（前 138 年、前 119 年）',
          '主线：长安 → 河西走廊 → 西域 → 中亚 → 欧洲',
          '交流是双向的：商品、技术、宗教与艺术',
        ],
        formula: '长安 — 敦煌 — 撒马尔罕 — 巴格达 — 罗马',
        demo: { type: 'silkroad' },
      },
      {
        id: 'history-printing',
        title: '活字印刷',
        hook: '一个工匠，让知识跑起来',
        tags: ['毕昇', '四大发明'],
        summary:
          '北宋毕昇发明泥活字印刷：先刻单字，再按需排版、涂墨印刷，可重复使用，大幅降低书籍成本。',
        case:
          '相比雕版印刷，活字印刷把“刻一整版”变成“拼装单字”，一套字可以印多本书。它和造纸术、火药、指南针一起，改变了世界知识传播的速度。',
        principles: [
          '单字可以重复使用',
          '排版灵活，修改方便',
          '降低书籍成本，推动教育普及',
        ],
        formula: '刻字 → 排版 → 涂墨 → 印刷 → 拆版',
        demo: { type: 'printing' },
      },
    ],
  },
  {
    id: 'chinese',
    name: '语文',
    en: 'CHINESE',
    glyph: '文',
    color: '#FF7096',
    kind: 'academic',
    tagline: '在字句之间安放情感',
    intro: '一个意象、一副对仗、一个汉字，都是中国人理解世界的方式。',
    points: [
      {
        id: 'chinese-poetry',
        title: '诗歌意象',
        hook: '月落乌啼霜满天',
        tags: ['意象', '意境'],
        summary:
          '意象是寄托了诗人情感的物象。张继《枫桥夜泊》把月落、乌啼、霜、江枫、渔火组合成一幅清冷孤寂的秋夜图。',
        case:
          '“月落乌啼霜满天，江枫渔火对愁眠。”月亮西沉、乌鸦啼叫、寒霜弥漫，视觉、听觉、触觉同时打开；渔火的一点暖色，反而衬出旅人的孤独。',
        principles: [
          '意象 = 物象 + 情感',
          '多感官组合，营造可进入的意境',
          '冷暖、动静对比，强化情绪',
        ],
        formula: '意境 = 意象群 + 情感基调',
        demo: { type: 'poetry' },
      },
      {
        id: 'chinese-couplet',
        title: '对仗',
        hook: '两句诗里的对称美学',
        tags: ['格律', '杜甫'],
        summary:
          '对仗要求上下句字数相等、词性相对、结构相同、平仄相谐，是中国古典诗歌重要的形式美。',
        case:
          '“两个黄鹂鸣翠柳，一行白鹭上青天。”数量、颜色、动作、空间一一对应，读起来像照镜子，节奏整齐而画面开阔。',
        principles: [
          '上下句字数相等',
          '词性相对：名词对名词、动词对动词',
          '结构一致，平仄相对',
        ],
        formula: '两个黄鹂鸣翠柳 / 一行白鹭上青天',
        demo: { type: 'couplet' },
      },
      {
        id: 'chinese-hanzi',
        title: '汉字',
        hook: '从甲骨文到今天',
        tags: ['象形', '会意'],
        summary:
          '汉字起源于象形，经历了甲骨文、金文、小篆、隶书、楷书等形态演变，兼具表意与表音功能。',
        case:
          '“日”在甲骨文里像一个圆圈加一点，像太阳；“山”像三座山峰；“休”由“人”和“木”组成，人靠在树边休息——会意字把生活画进了字里。',
        principles: [
          '象形：画出事物的轮廓',
          '指事、会意：用符号组合表达抽象含义',
          '形声：形旁表义，声旁表音，占汉字的大多数',
        ],
        formula: '甲骨文 → 金文 → 小篆 → 隶书 → 楷书',
        demo: { type: 'hanzi' },
      },
    ],
  },
  {
    id: 'programmer',
    name: '程序员',
    en: 'PROGRAMMING',
    glyph: '码',
    color: '#00E1FF',
    kind: 'industry',
    tagline: '用抽象驯服复杂度',
    intro: '树、递归、分层协议——编程的本质，是把复杂问题拆成可以重复使用的结构。',
    points: [
      {
        id: 'programmer-binarytree',
        title: '二叉树',
        hook: '为什么查词典这么快',
        tags: ['数据结构', '查找'],
        summary:
          '二叉搜索树每个节点最多有两个子节点，左子树小于根、右子树大于根。查找时每次排除一半，平均效率为 O(log n)。',
        case:
          '在 100 万条数据中顺序查找平均要 50 万次，平衡二叉搜索树只需约 20 次。数据库索引、文件系统目录都大量使用树结构。',
        principles: [
          '左子树 < 根 < 右子树',
          '查找、插入、删除平均 O(log n)',
          '退化成链表时变成 O(n)，所以需要平衡',
        ],
        formula: 'h ≈ log₂(n + 1)',
        demo: { type: 'binaryTree' },
      },
      {
        id: 'programmer-hanoi',
        title: '递归',
        hook: '汉诺塔：把复杂拆成同样的小问题',
        tags: ['算法', '分治'],
        summary:
          '递归是函数调用自身来解决问题，必须包含“基准情形”和“向基准推进”的递归步骤。',
        case:
          '汉诺塔 n 个盘子需要 2ⁿ−1 步。64 个盘子即使每秒移动一次，也要约 5845 亿年——递归把复杂问题拆成“移动 n−1 个盘子”的重复子问题。',
        principles: [
          '基准情形：n = 1 时直接移动',
          '递归步骤：先移走 n−1 个，再移最大盘，再移回 n−1 个',
          '时间复杂度 O(2ⁿ)',
        ],
        formula: 'T(n) = 2T(n−1) + 1 = 2ⁿ − 1',
        demo: { type: 'hanoi' },
      },
      {
        id: 'programmer-network',
        title: '网络分层',
        hook: '一次点击，穿过四层协议',
        tags: ['协议', 'OSI'],
        summary:
          '网络通信被拆成多层，每层只负责一件事：应用层产生数据，传输层保证端到端，网络层负责寻址路由，链路层负责物理传输。',
        case:
          '打开网页时，HTTP 请求从应用层出发，被 TCP 分段、IP 加上地址、以太网封装成帧，经过路由器和光缆到达服务器，再逐层拆包。分层让每一层都可以独立升级。',
        principles: [
          '分层解耦，各司其职',
          '发送时逐层封装，接收时逐层解封装',
          'IP 负责“送到哪”，TCP 负责“送对、送全”',
        ],
        formula: '应用层 → 传输层 → 网络层 → 链路层',
        demo: { type: 'network' },
      },
    ],
  },
  {
    id: 'designer',
    name: '设计师',
    en: 'DESIGN',
    glyph: '设',
    color: '#FF6FC0',
    kind: 'industry',
    tagline: '让信息拥有秩序与情绪',
    intro: '颜色、网格与曲线，是设计师用来组织注意力、传递情绪的三件工具。',
    points: [
      {
        id: 'designer-color',
        title: '色相环',
        hook: '为什么红配绿会“打架”',
        tags: ['色彩', '对比'],
        summary:
          '色相环把颜色按光谱顺序排列。互补色位于色环对面，对比强烈；邻近色彼此相邻，搭配柔和。',
        case:
          '红与绿、蓝与橙是互补色，放在一起会产生强烈的视觉振动；而蓝与青、橙与黄是邻近色，适合营造统一氛围。品牌常用“主色 + 互补色点缀”提高识别度。',
        principles: [
          '互补色：色环对面，强对比',
          '邻近色：相隔 30° 以内，柔和统一',
          '三角配色：色环三等分，平衡而活泼',
        ],
        formula: '色相 H / 饱和度 S / 明度 L',
        demo: { type: 'colorWheel' },
      },
      {
        id: 'designer-grid',
        title: '版式网格',
        hook: '看不见的线，撑起好设计',
        tags: ['栅格', '排版'],
        summary:
          '网格系统用栏、行、边距把版面切成可复用的单元，让信息层级清晰、节奏统一。',
        case:
          '报纸、杂志和网页都使用栅格：12 栏网格可以灵活组合成 1/2、1/3、1/4 栏。对齐不是束缚，而是让读者更快找到重点。',
        principles: [
          '栏与槽决定内容宽度',
          '8px 基准保证间距统一',
          '留白也是版面的一部分',
        ],
        formula: '内容宽度 = 栏宽 × 栏数 + 槽宽 × (栏数 − 1)',
        demo: { type: 'layoutGrid' },
      },
      {
        id: 'designer-bezier',
        title: '贝塞尔曲线',
        hook: '一条曲线，撑起所有字体',
        tags: ['矢量', '字体'],
        summary:
          '贝塞尔曲线由控制点定义，通过伯恩斯坦多项式插值，广泛用于字体、矢量图形和动画缓动。',
        case:
          '字母“S”的轮廓由多段三次贝塞尔曲线拼接，CSS 的 cubic-bezier() 也用它描述动画速度。移动两个控制点，曲线的“性格”就完全改变。',
        principles: [
          '曲线经过起点和终点',
          '控制点决定曲线在端点的切线方向',
          '三次贝塞尔有 4 个控制点',
        ],
        formula: 'B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃',
        demo: { type: 'bezier' },
      },
    ],
  },
  {
    id: 'chef',
    name: '厨师',
    en: 'CUISINE',
    glyph: '厨',
    color: '#FF9F45',
    kind: 'industry',
    tagline: '用热量重组风味',
    intro: '火候不是玄学：温度、时间与传热方式，决定了焦香、嫩度与香气。',
    points: [
      {
        id: 'chef-maillard',
        title: '美拉德反应',
        hook: '牛排焦香的秘密',
        tags: ['烹饪化学', '风味'],
        summary:
          '美拉德反应是氨基酸与还原糖在加热时发生的一系列反应，生成棕色物质和上百种香气分子。',
        case:
          '牛排下锅前要擦干表面，锅温达到 150℃ 以上才能快速形成焦褐色外壳。如果锅不够热，肉汁先渗出，牛排就变成“煮”而不是“煎”。',
        principles: [
          '温度需达到 140～165℃ 以上',
          '干燥表面更容易发生反应',
          '产物：类黑精 + 上百种香气化合物',
        ],
        formula: '氨基酸 + 还原糖 —加热→ 类黑精 + 风味分子',
        demo: { type: 'maillard' },
      },
      {
        id: 'chef-heat',
        title: '热传导',
        hook: '爆炒与慢炖，差的不只是火',
        tags: ['热学', '烹饪'],
        summary:
          '热通过传导、对流和辐射传递。金属锅导热快，适合爆炒；砂锅导热慢、保温好，适合慢炖。',
        case:
          '铁锅大火爆炒，锅壁迅速把热量传给食材，水分快速蒸发，产生“锅气”；砂锅小火慢炖，热量温和均匀，胶原蛋白慢慢水解，汤更浓稠。',
        principles: [
          '传导：固体中分子振动传递热量',
          '对流：流体流动带动热量',
          '辐射：不需要介质，以电磁波传递',
        ],
        formula: 'Q = k · A · ΔT · t / d',
        demo: { type: 'heat' },
      },
      {
        id: 'chef-dough',
        title: '发酵',
        hook: '面包里的气孔从哪来',
        tags: ['发酵', '生物化学'],
        summary:
          '酵母在无氧条件下分解糖，产生二氧化碳和酒精。气体被面筋网络包裹，使面团膨胀。',
        case:
          '面包发酵时，酵母分解面粉中的糖，释放 CO₂ 气泡；揉面形成的面筋像一张网，把气泡留住。烤箱里气体受热膨胀，面包就鼓起来，形成松软气孔。',
        principles: [
          '酵母 → CO₂ + 酒精',
          '面筋网络包裹并留住气体',
          '25～28℃ 是大多数面团最适宜的发酵温度',
        ],
        formula: 'C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂',
        demo: { type: 'dough' },
      },
    ],
  },
  {
    id: 'architect',
    name: '建筑',
    en: 'ARCHITECTURE',
    glyph: '筑',
    color: '#D9B877',
    kind: 'industry',
    tagline: '把力流变成空间',
    intro: '拱、桁架与阻尼器，都是人类与重力、风力谈判的方式。',
    points: [
      {
        id: 'architect-arch',
        title: '拱结构',
        hook: '赵州桥为什么能站 1400 年',
        tags: ['拱桥', '受力'],
        summary:
          '拱把竖向荷载转化为沿拱轴线的压力。石材抗压性能好，因此拱桥能用小块石料跨越很宽的河道。',
        case:
          '赵州桥采用敞肩圆弧拱，主拱跨度 37.02 米，两端各开两个小拱，既减轻自重又利于泄洪。1400 多年来历经地震与洪水，至今仍屹立。',
        principles: [
          '拱内主要受力为压力',
          '拱脚需要坚固支撑，抵抗向外的推力',
          '敞肩拱减轻自重，并增加泄洪面积',
        ],
        formula: '拱高 f / 跨度 L ≈ 1/5 ～ 1/7',
        demo: { type: 'arch' },
      },
      {
        id: 'architect-truss',
        title: '桁架',
        hook: '三角形为什么不塌',
        tags: ['结构', '三角形'],
        summary:
          '桁架由若干直杆组成三角形单元，荷载只使杆件受拉或受压，不易弯曲，因此结构轻而强。',
        case:
          '桥梁、屋顶和起重机臂常用桁架。三角形具有几何不变性：边长确定后形状唯一；四边形则会变形，需要加斜撑。',
        principles: [
          '三角形具有几何稳定性',
          '杆件主要承受轴力：拉力或压力',
          '三角形单元越多，可跨越的跨度越大',
        ],
        formula: '三角形内角和 180°，边长确定形状唯一',
        demo: { type: 'truss' },
      },
      {
        id: 'architect-wind',
        title: '风荷载',
        hook: '摩天楼为什么会在风中摇晃',
        tags: ['高层建筑', '风工程'],
        summary:
          '高层建筑迎风面受正压、背风面受负压，风荷载随高度和风速增大。结构通过刚度、阻尼和外形设计抵抗风振。',
        case:
          '上海中心大厦高 632 米，采用螺旋上升的外形，把风涡旋打散，减少约 24% 的风荷载；楼顶还装有调谐质量阻尼器，用来抵消晃动。',
        principles: [
          '风压与风速的平方成正比',
          '涡激振动会造成横向摆动',
          '阻尼器把振动能量转化为热能',
        ],
        formula: 'w = ½ · ρ · v²',
        demo: { type: 'towerWind' },
      },
    ],
  },
  {
    id: 'fisherman',
    name: '渔民',
    en: 'FISHING',
    glyph: '渔',
    color: '#35E0D0',
    kind: 'industry',
    tagline: '读懂海面之下的规律',
    intro: '浮力、潮汐与声呐，是渔民与大海相处的三套语言。',
    points: [
      {
        id: 'fisher-buoy',
        title: '浮标',
        hook: '海面上的小小“信号兵”',
        tags: ['浮力', '渔业'],
        summary:
          '浮标能浮在水面，是因为它排开海水的重力等于自身重力；浮标下的锚链把位置固定在渔场。',
        case:
          '渔民在养殖区布设浮标，标记网箱和渔场边界。浮标多为空心塑料或泡沫，密度远小于海水；潮涨潮落时浮标随水位上下，但锚链让它不被冲走。',
        principles: [
          '漂浮条件：F浮 = G',
          '空心结构增大排水体积，提高浮力',
          '锚链提供水平固定力，使浮标停留在渔场',
        ],
        formula: 'ρ海水 · g · V排 = m · g',
        demo: { type: 'buoyancy', config: { mode: 'buoy' } },
      },
      {
        id: 'fisher-tide',
        title: '潮汐',
        hook: '月亮拉起的海水',
        tags: ['潮汐', '月球'],
        summary:
          '月球和太阳的引力使海水产生周期性涨落。多数海区一天有两次涨潮和两次落潮。',
        case:
          '渔民根据潮汐表安排出海：涨潮时鱼群随水靠近岸边，落潮时滩涂露出，适合赶海。大潮出现在朔望月，小潮出现在上、下弦月。',
        principles: [
          '月球引潮力是潮汐的主要原因',
          '太阳引潮力约为月球的 46%',
          '朔望月形成大潮，上下弦月形成小潮',
        ],
        formula: '潮汐周期 ≈ 12 小时 25 分',
        demo: { type: 'tide' },
      },
      {
        id: 'fisher-sonar',
        title: '声呐',
        hook: '用声音“看”海底',
        tags: ['声波', '探测'],
        summary:
          '声呐向水中发射声波，利用回声的时间差计算距离。声波在水中传播比电磁波远得多。',
        case:
          '渔船用探鱼仪发射超声波，遇到鱼群或海底反射回来，屏幕上显示鱼群深度和海底地形。军舰和潜艇也用声呐进行探测与导航。',
        principles: [
          '声波在水中衰减小、传播远',
          '距离 = 声速 × 时间 / 2',
          '频率越高分辨率越高，但衰减越快',
        ],
        formula: 's = v · t / 2（海水中 v ≈ 1500 m/s）',
        demo: { type: 'sonar' },
      },
    ],
  },
  {
    id: 'farmer',
    name: '农民',
    en: 'FARMING',
    glyph: '农',
    color: '#C2E85C',
    kind: 'industry',
    tagline: '把天文、地理写进农时',
    intro: '节气是太阳的刻度，梯田是等高线的作品，灌溉是连通器的日常应用。',
    points: [
      {
        id: 'farmer-solarterms',
        title: '二十四节气',
        hook: '把太阳一年走的路分成 24 份',
        tags: ['历法', '农事'],
        summary:
          '二十四节气根据太阳在黄道上的位置划分，每 15° 一个节气，反映季节、气候和物候变化。',
        case:
          '黄河流域的农民依节气安排农事：清明前后种瓜点豆，芒种忙收麦，白露收高粱。2016 年，二十四节气被列入联合国教科文组织人类非物质文化遗产。',
        principles: [
          '地球绕太阳公转 360°，每 15° 一个节气',
          '节气属于阳历，日期在公历中基本固定',
          '反映太阳辐射的季节变化',
        ],
        formula: '360° ÷ 24 = 15°',
        demo: { type: 'solarTerms' },
      },
      {
        id: 'farmer-terrace',
        title: '梯田',
        hook: '把山坡切成一层层台阶',
        tags: ['梯田', '水土保持'],
        summary:
          '梯田沿等高线修筑，把坡地改造成台阶状平地，减少水土流失，方便灌溉和耕作。',
        case:
          '云南哈尼梯田从山脚修到山顶，最高处海拔 2000 多米，级数可达 3000 多级。森林涵养水源，村寨居中，梯田在下，形成“森林—村寨—梯田—水系”的循环。',
        principles: [
          '沿等高线修筑，减缓坡度',
          '减少地表径流，保水保土保肥',
          '层层拦蓄，形成立体的水循环',
        ],
        formula: '等高线密集处坡陡，稀疏处坡缓',
        demo: { type: 'terrace' },
      },
      {
        id: 'farmer-irrigation',
        title: '灌溉',
        hook: '水为什么会自己流进田里',
        tags: ['连通器', '节水'],
        summary:
          '连通器中同种液体静止时液面总保持相平。渠道和水管利用这一原理，把水引到田间。',
        case:
          '都江堰、坎儿井和现代滴灌都利用重力与连通器原理。新疆坎儿井用地下暗渠把天山雪水引到绿洲，减少蒸发，千年不涸。',
        principles: [
          '连通器中同种液体静止时液面相平',
          '水从高处流向低处',
          '滴灌把水直接送到根部，可节水 30%～50%',
        ],
        formula: 'p = ρgh',
        demo: { type: 'irrigation' },
      },
    ],
  },
];

export const CROSS_LINKS = [
  ['math', 'physics'],
  ['math', 'programmer'],
  ['math', 'designer'],
  ['math', 'architect'],
  ['physics', 'chemistry'],
  ['physics', 'architect'],
  ['physics', 'fisherman'],
  ['physics', 'geography'],
  ['chemistry', 'biology'],
  ['chemistry', 'chef'],
  ['biology', 'geography'],
  ['biology', 'farmer'],
  ['biology', 'fisherman'],
  ['geography', 'history'],
  ['geography', 'farmer'],
  ['geography', 'fisherman'],
  ['history', 'chinese'],
  ['history', 'geography'],
  ['chinese', 'english'],
  ['english', 'programmer'],
  ['programmer', 'designer'],
  ['designer', 'architect'],
  ['chef', 'farmer'],
  ['architect', 'programmer'],
];

export const AFFINITY = {
  math: ['physics', 'programmer', 'designer', 'architect'],
  physics: ['math', 'architect', 'fisherman', 'chemistry'],
  chemistry: ['biology', 'chef', 'physics'],
  english: ['chinese', 'programmer'],
  biology: ['chemistry', 'geography', 'farmer'],
  geography: ['history', 'biology', 'farmer', 'fisherman'],
  history: ['chinese', 'geography'],
  chinese: ['history', 'english'],
  programmer: ['math', 'designer', 'english'],
  designer: ['math', 'programmer', 'architect'],
  chef: ['chemistry', 'farmer', 'biology'],
  architect: ['physics', 'designer', 'math'],
  fisherman: ['physics', 'geography', 'biology'],
  farmer: ['geography', 'biology', 'chef'],
};

/* ------------------------ 合并扩充知识点 + 段位标注 ------------------------ */

for (const subject of SUBJECTS) {
  const extra = EXTRA_POINTS[subject.id];
  if (extra?.length) subject.points.push(...extra);
  for (const point of subject.points) {
    point.tier = POINT_TIER[point.id] || 3;
    point.subjectId = subject.id;
    point.subject = subject;
  }
  // 领域内按段位从低到高排列，形成一条可读的进阶线
  subject.points.sort((a, b) => a.tier - b.tier);
}

/* 去掉过于基础、只配一句话的知识点，把位置留给更复杂的问题 */
const RETIRED = new Set([
  'english-preposition',
  'english-tense',
  'english-wordtree',
  'chef-heat',
  'designer-color',
  'biology-foodchain',
  'physics-buoyancy',
  'math-golden',
  'chemistry-dissolve',
]);
for (const subject of SUBJECTS) {
  subject.points = subject.points.filter((point) => !RETIRED.has(point.id));
}

export const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((s) => [s.id, s]));

export const ALL_POINTS = SUBJECTS.flatMap((subject) => subject.points);

export const POINT_BY_ID = Object.fromEntries(ALL_POINTS.map((point) => [point.id, point]));

export const POINTS_BY_TIER = ALL_POINTS.reduce((acc, point) => {
  (acc[point.tier] ||= []).push(point);
  return acc;
}, {});

export const TIER_COUNT = Object.keys(POINTS_BY_TIER).length;

export function relatedPoints(point, limit = 3) {
  const out = [];
  const pool = AFFINITY[point.subjectId] || [];
  for (const subjectId of pool) {
    const subject = SUBJECT_BY_ID[subjectId];
    if (!subject) continue;
    const pick = subject.points.find((p) => p.id !== point.id);
    if (pick) out.push({ ...pick, subjectId, subject });
    if (out.length >= limit) return out;
  }
  return out;
}
