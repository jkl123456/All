/**
 * 七座知识岛 × 四档难度 × 每档四题。
 * 每题都带讲解；答错也会被收进「知海」，作为之后可以反复翻阅的知识卡。
 * answer 是 options 的从 0 开始的索引。
 */
const RAW = {
  wen: {
    junior: [
      {
        topic: '成语',
        question: '“画蛇添足”最恰当的意思是？',
        options: ['做事有始有终', '做了多余的事，反而不好', '画技非常高超', '在比赛里故意让步'],
        answer: 1,
        explanation: '画蛇添足出自《战国策》：蛇本来没有脚，画上脚反而多此一举。比喻做了多余的事，非但无益，反而不合适。',
      },
      {
        topic: '诗词',
        question: '“床前明月光，疑是地上霜”的作者是？',
        options: ['杜甫', '王维', '李白', '白居易'],
        answer: 2,
        explanation: '这两句出自李白的《静夜思》。短短二十字，用月光与霜的错觉写出了游子的思乡。',
      },
      {
        topic: '修辞',
        question: '“小鸟在枝头唱歌”使用了哪种修辞手法？',
        options: ['比喻', '拟人', '排比', '夸张'],
        answer: 1,
        explanation: '把小鸟当作会“唱歌”的人来写，是拟人。拟人让万物拥有人的动作或情感，画面会更亲切。',
      },
      {
        topic: '字词',
        question: '下列词语书写完全正确的一项是？',
        options: ['再接再励', '再接再厉', '再接再利', '再接再力'],
        answer: 1,
        explanation: '“再接再厉”出自韩愈《斗鸡联句》，原意是公鸡相斗时每次交锋前都磨快嘴。“厉”同“砺”，有磨砺之意。',
      },
    ],
    senior: [
      {
        topic: '文学常识',
        question: '《诗经》的三种主要表现手法是？',
        options: ['风、雅、颂', '赋、比、兴', '起、承、转', '平、上、去'],
        answer: 1,
        explanation: '“风、雅、颂”是《诗经》的内容分类；“赋、比、兴”才是表现手法：赋是铺陈，比是打比方，兴是先言他物以引出所咏。',
      },
      {
        topic: '病句',
        question: '“通过这次航海，使我明白了团队的重要。”这句话的主要问题是？',
        options: ['用词重复', '缺少主语', '逻辑矛盾', '语序完全颠倒'],
        answer: 1,
        explanation: '“通过……”是介词短语，“使”又让后半句成为兼语结构，结果全句找不到主语。删去“通过”或“使”即可。',
      },
      {
        topic: '文言实词',
        question: '古汉语中“走”的常见意义是？',
        options: ['行走', '逃跑或跑', '离开家乡', '走亲戚'],
        answer: 1,
        explanation: '古义“走”多指跑、逃跑，如“弃甲曳兵而走”。现代汉语的“走”在古文中更常用“行”。',
      },
      {
        topic: '现代文学',
        question: '中国现代文学史上第一篇白话短篇小说是？',
        options: ['《阿Q正传》', '《狂人日记》', '《孔乙己》', '《边城》'],
        answer: 1,
        explanation: '鲁迅的《狂人日记》发表于 1918 年《新青年》，以白话写成，被视为中国现代文学史上第一篇白话短篇小说。',
      },
    ],
    university: [
      {
        topic: '语言学',
        question: '索绪尔区分“语言（langue）”与“言语（parole）”，其中 langue 更接近？',
        options: ['每个人每次说出的具体话语', '社会共享的抽象语言系统', '书面语中的标点系统', '语言的发音器官'],
        answer: 1,
        explanation: 'langue 是某一语言共同体共享的抽象规则系统；parole 是个人在实际情境中的具体言语活动。索绪尔强调研究 langue。',
      },
      {
        topic: '文学理论',
        question: '《文心雕龙》的作者是？',
        options: ['刘勰', '钟嵘', '曹丕', '严羽'],
        answer: 0,
        explanation: '《文心雕龙》为南朝梁代刘勰所著，是中国古代体系最完整的文学理论著作之一，共五十篇。',
      },
      {
        topic: '文学理论',
        question: '“境界说”主要见于王国维的哪部著作？',
        options: ['《人间词话》', '《谈艺录》', '《诗品》', '《沧浪诗话》'],
        answer: 0,
        explanation: '王国维在《人间词话》中标举“境界”，认为词以有境界为最上，并提出“有我之境”与“无我之境”。',
      },
      {
        topic: '古代文学',
        question: '“沉郁顿挫”常用于概括哪位诗人的风格？',
        options: ['李白', '杜甫', '孟浩然', '李清照'],
        answer: 1,
        explanation: '杜甫诗风常被概括为“沉郁顿挫”：情感深厚沉着，章法转折有力，与其忧国忧民的生命经验密切相关。',
      },
    ],
    postgrad: [
      {
        topic: '训诂学',
        question: '清代学者段玉裁最重要的《说文解字》研究著作是？',
        options: ['《说文解字注》', '《尔雅义疏》', '《广雅疏证》', '《释名疏证》'],
        answer: 0,
        explanation: '段玉裁《说文解字注》以毕生精力疏证《说文》，是清代“说文学”的巅峰之作；《广雅疏证》为王念孙所著。',
      },
      {
        topic: '音韵学',
        question: '传统“反切”注音的基本原则是？',
        options: ['上字取韵、下字取声', '上字取声母、下字取韵母和声调', '两字相加取平均音', '只取两字中的元音'],
        answer: 1,
        explanation: '反切用两个字拼出第三个字的读音：上字取其声母，下字取其韵母和声调。例如“冬，都宗切”。',
      },
      {
        topic: '比较文学',
        question: '巴赫金用“复调”描述陀思妥耶夫斯基小说，强调的核心是？',
        options: ['多种独立意识平等对话', '情节必须多线并进', '叙述者必须全知全能', '所有人物最后达成统一'],
        answer: 0,
        explanation: '复调理论强调人物具有独立于作者的意识与声音，彼此构成对话关系，而非被作者统一安排的单声部世界。',
      },
      {
        topic: '接受美学',
        question: '姚斯提出的“期待视野”主要指？',
        options: ['作者写作前预设的销售目标', '读者阅读前由经验形成的理解结构', '文本内部的空间描写', '译者对原文的还原程度'],
        answer: 1,
        explanation: '“期待视野”是接受美学的核心概念，指读者在阅读前由既有文学经验、文化背景形成的理解框架，作品会证实、打破或重建它。',
      },
    ],
  },
  shu: {
    junior: [
      {
        topic: '方程',
        question: '解方程 2x + 5 = 13，x 等于？',
        options: ['3', '4', '5', '9'],
        answer: 1,
        explanation: '两边先减 5 得 2x = 8，再除以 2，得到 x = 4。解方程的关键是等式两边做同样的运算。',
      },
      {
        topic: '概率',
        question: '掷一枚均匀的六面骰子，掷出偶数的概率是？',
        options: ['1/6', '1/3', '1/2', '2/3'],
        answer: 2,
        explanation: '1 到 6 中偶数有 2、4、6 三个，共六种等可能结果，所以概率是 3/6 = 1/2。',
      },
      {
        topic: '几何',
        question: '圆的半径为 3，它的面积是？',
        options: ['3π', '6π', '9π', '12π'],
        answer: 2,
        explanation: '圆面积公式为 S = πr²。r = 3 时，S = π × 3² = 9π。',
      },
      {
        topic: '百分数',
        question: '250 的 20% 是多少？',
        options: ['25', '40', '50', '75'],
        answer: 2,
        explanation: '20% = 0.2，250 × 0.2 = 50。百分数可以化成分数或小数再计算。',
      },
    ],
    senior: [
      {
        topic: '导数',
        question: '函数 f(x) = x² 在 x = 3 处的导数是？',
        options: ['3', '6', '9', '12'],
        answer: 1,
        explanation: 'x² 的导数是 2x，所以 f′(3) = 2 × 3 = 6。导数在这里表示曲线在该点的切线斜率。',
      },
      {
        topic: '三角函数',
        question: 'sin 30° 的值是？',
        options: ['1/2', '√2/2', '√3/2', '1'],
        answer: 0,
        explanation: '30° 的正弦值是 1/2。在 30°−60°−90° 直角三角形中，30° 角对的边是斜边的一半。',
      },
      {
        topic: '数列',
        question: '1 + 2 + 3 + … + 100 的和是？',
        options: ['1000', '4950', '5050', '10100'],
        answer: 2,
        explanation: '这是等差数列求和：(首项 + 末项) × 项数 ÷ 2 = (1 + 100) × 100 ÷ 2 = 5050。',
      },
      {
        topic: '函数',
        question: '下列函数中，是偶函数的是？',
        options: ['f(x) = x³', 'f(x) = x²', 'f(x) = x + 1', 'f(x) = eˣ'],
        answer: 1,
        explanation: '偶函数满足 f(−x) = f(x)。因为 (−x)² = x²，所以 f(x) = x² 是偶函数，图象关于 y 轴对称。',
      },
    ],
    university: [
      {
        topic: '线性代数',
        question: '二阶行列式 |1 2; 3 4| 的值是？',
        options: ['2', '−2', '10', '−10'],
        answer: 1,
        explanation: '二阶行列式 ad − bc：1 × 4 − 2 × 3 = 4 − 6 = −2。',
      },
      {
        topic: '微积分',
        question: '定积分 ∫₀¹ x dx 等于？',
        options: ['0', '1/2', '1', '2'],
        answer: 1,
        explanation: 'x 的原函数是 x²/2。代入上下限：[1²/2] − [0²/2] = 1/2。几何上，它是底为 1、高为 1 的三角形面积。',
      },
      {
        topic: '微积分',
        question: '函数 y = e^{2x} 的导数是？',
        options: ['e^{2x}', '2e^{2x}', 'e^{2x}/2', '2x e^{2x}'],
        answer: 1,
        explanation: '由复合函数求导法则：设 u = 2x，则 y = e^u，dy/dx = e^u × u′ = e^{2x} × 2 = 2e^{2x}。',
      },
      {
        topic: '线性代数',
        question: '三阶单位矩阵 I₃ 的秩是？',
        options: ['0', '1', '2', '3'],
        answer: 3,
        explanation: '单位矩阵的三列线性无关，列空间的维数是 3，所以 rank(I₃) = 3。',
      },
    ],
    postgrad: [
      {
        topic: '实分析',
        question: '关于闭区间上的连续函数，下列结论正确的是？',
        options: ['一定可导', '一定有界且取得最大最小值', '一定是常数', '一定单调递增'],
        answer: 1,
        explanation: '连续函数在紧集（如闭区间）上的像仍是紧集，因此有界，并且能取到最大值和最小值。连续性不能保证可导。',
      },
      {
        topic: '群论',
        question: '拉格朗日定理说明，有限群 G 的任一子群 H 的阶？',
        options: ['一定等于 G 的阶', '一定整除 G 的阶', '一定与 G 的阶互素', '一定大于 G 的阶'],
        answer: 1,
        explanation: '若 G 为有限群、H 为子群，则 |G| = [G:H] × |H|，因此 |H| 必整除 |G|。注意逆命题一般不成立。',
      },
      {
        topic: '微积分',
        question: '若 f′(x₀) = 0，则 x₀ 一定是 f 的极值点吗？',
        options: ['一定是极大值点', '一定是极小值点', '不一定，例如 f(x) = x³ 在 0 处', '当且仅当 f 连续时是'],
        answer: 2,
        explanation: '导数为零只是可导函数取得极值的必要条件，不是充分条件。x³ 在 0 处导数为 0，但函数单调穿过，取不到极值。',
      },
      {
        topic: '矩阵论',
        question: '实方阵 A 为正交矩阵的等价条件是？',
        options: ['A = Aᵀ', 'AᵀA = I', 'A² = I', 'A 的所有元素为正'],
        answer: 1,
        explanation: '正交矩阵满足 AᵀA = AAᵀ = I，因此它保持向量内积与长度不变。对称矩阵满足 A = Aᵀ，和正交是不同概念。',
      },
    ],
  },
  wu: {
    junior: [
      {
        topic: '运动',
        question: '36 km/h 换算成米每秒是？',
        options: ['3.6 m/s', '10 m/s', '36 m/s', '100 m/s'],
        answer: 1,
        explanation: '1 km = 1000 m，1 h = 3600 s。36 km/h = 36 × 1000 ÷ 3600 = 10 m/s。',
      },
      {
        topic: '密度',
        question: '密度的计算公式是？',
        options: ['ρ = m/V', 'ρ = V/m', 'ρ = m × V', 'ρ = m + V'],
        answer: 0,
        explanation: '密度是单位体积的质量，ρ = m/V。同一种物质在状态不变时密度通常一定，可用于鉴别物质。',
      },
      {
        topic: '电路',
        question: '两个小灯泡串联在同一电路中，通过它们的电流关系是？',
        options: ['电流相等', '越靠前的灯泡电流越大', '越靠后的灯泡电流越大', '电流大小与灯泡电阻无关'],
        answer: 0,
        explanation: '串联电路只有一条路径，电流处处相等，即 I₁ = I₂。它们两端的电压则可能因电阻不同而不同。',
      },
      {
        topic: '光学',
        question: '凸透镜对光线有什么作用？',
        options: ['使光线会聚', '使光线发散', '使光线全部反射', '让光线停止传播'],
        answer: 0,
        explanation: '凸透镜中间厚、边缘薄，对平行光有会聚作用，因此又叫会聚透镜。凹透镜则使平行光发散。',
      },
    ],
    senior: [
      {
        topic: '自由落体',
        question: '物体从静止自由下落 2 秒（g 取 10 m/s²，不计空气阻力），下落高度约为？',
        options: ['10 m', '20 m', '40 m', '80 m'],
        answer: 1,
        explanation: 'h = ½gt² = ½ × 10 × 2² = 20 m。自由落体加速度相同，与物体质量无关。',
      },
      {
        topic: '电场',
        question: '电荷量为 q 的点电荷处于电场 E 中，所受电场力为？',
        options: ['F = qE', 'F = q/E', 'F = E/q', 'F = qE²'],
        answer: 0,
        explanation: '电场强度的定义式 E = F/q，因此 F = qE。正电荷受力方向与电场方向相同，负电荷相反。',
      },
      {
        topic: '动量',
        question: '系统动量守恒的条件是？',
        options: ['系统所受合外力为零', '系统内没有摩擦力', '系统动能不变', '系统内没有碰撞'],
        answer: 0,
        explanation: '动量守恒的条件是系统所受合外力为零，或合外力在某方向上的分量为零。内力可以改变各自动量，但总动量不变。',
      },
      {
        topic: '近代物理',
        question: '光子能量与频率的关系是？',
        options: ['E = hν', 'E = h/ν', 'E = ν/h', 'E = hν²'],
        answer: 0,
        explanation: '普朗克关系 E = hν，h 为普朗克常量。频率越高，单个光子能量越大；光的强度则与光子数目有关。',
      },
    ],
    university: [
      {
        topic: '角动量',
        question: '质点系关于某点的角动量守恒，需要满足的条件是？',
        options: ['合外力为零', '合外力矩为零', '合外力做功为零', '系统总能量为零'],
        answer: 1,
        explanation: '角动量定理表明，角动量的变化率等于合外力矩。因此合外力矩为零时，角动量守恒。合外力为零并不能保证合外力矩为零。',
      },
      {
        topic: '热力学',
        question: '热力学第二定律关于孤立系统熵的表述是？',
        options: ['熵总是减少', '熵保持不变', '熵不可能自发减少', '熵没有方向性'],
        answer: 2,
        explanation: '孤立系统的熵永不减少：可逆过程保持不变，不可逆过程增加。它给出了时间箭头的宏观方向。',
      },
      {
        topic: '电磁学',
        question: '理想 LC 振荡电路的固有角频率是？',
        options: ['√(LC)', '1/√(LC)', '2π√(LC)', '1/(2π√(LC))'],
        answer: 1,
        explanation: 'LC 回路满足 d²q/dt² + q/(LC) = 0，振荡角频率 ω = 1/√(LC)；频率 f = ω/(2π)。',
      },
      {
        topic: '电磁学',
        question: '麦克斯韦方程组中“位移电流”的引入主要是为了？',
        options: ['解释静电屏蔽', '保证变化电场也能产生磁场并满足电荷守恒', '说明欧姆定律失效', '描述超导现象'],
        answer: 1,
        explanation: '位移电流项 ε₀∂E/∂t 补全了安培环路定理，使变化电场能产生磁场，并保证电荷守恒；它预言了电磁波。',
      },
    ],
    postgrad: [
      {
        topic: '理论物理',
        question: '诺特定理揭示了什么关系？',
        options: ['对称性与守恒律', '温度与体积', '概率与测量', '力与加速度'],
        answer: 0,
        explanation: '诺特定理指出，作用量的每一种连续对称性都对应一个守恒量：时间平移对称对应能量守恒，空间平移对应动量守恒，旋转对称对应角动量守恒。',
      },
      {
        topic: '相对论',
        question: '狭义相对论中，真空光速在不同惯性系中的性质是？',
        options: ['与光源速度相加', '与观察者速度相加', '在一切惯性系中相同', '只在光源静止系中相同'],
        answer: 2,
        explanation: '光速不变原理是狭义相对论的基本公设：真空光速 c 在一切惯性系中都相同，与光源和观察者的相对运动无关。',
      },
      {
        topic: '量子力学',
        question: '一维量子谐振子的零点能是？',
        options: ['0', '½ℏω', 'ℏω', '2ℏω'],
        answer: 1,
        explanation: '量子谐振子能级为 Eₙ = (n + ½)ℏω，n = 0, 1, 2…。最低能级不是零，而是 ½ℏω，体现不确定性原理的限制。',
      },
      {
        topic: '统计物理',
        question: '泡利不相容原理主要适用于哪类粒子？',
        options: ['玻色子', '费米子', '所有光子', '所有无质量粒子'],
        answer: 1,
        explanation: '费米子（如电子、质子）遵守泡利不相容原理：两个全同费米子不能占据完全相同的量子态。玻色子则可以大量处于同一态。',
      },
    ],
  },
  hua: {
    junior: [
      {
        topic: '酸碱',
        question: '某溶液的 pH 为 3，它的酸碱性是？',
        options: ['酸性', '中性', '碱性', '无法判断'],
        answer: 0,
        explanation: '常温下 pH < 7 为酸性，pH = 7 为中性，pH > 7 为碱性。pH 越小，氢离子浓度越大，酸性越强。',
      },
      {
        topic: '物质变化',
        question: '下列属于化学变化的是？',
        options: ['冰融化成水', '铁钉生锈', '玻璃破碎', '水沸腾变成水蒸气'],
        answer: 1,
        explanation: '铁生锈生成了新物质（铁的氧化物），属于化学变化；冰融化、玻璃破碎、水沸腾只改变状态或形状，是物理变化。',
      },
      {
        topic: '物态',
        question: '水由液态变为气态的过程叫？',
        options: ['凝固', '液化', '汽化', '升华'],
        answer: 2,
        explanation: '液态变气态是汽化，包括蒸发和沸腾，需要吸热。气态变液态是液化，需要放热。',
      },
      {
        topic: '化学式',
        question: '二氧化碳的化学式是？',
        options: ['CO', 'CO₂', 'C₂O', 'H₂CO₃'],
        answer: 1,
        explanation: '一个二氧化碳分子由 1 个碳原子和 2 个氧原子组成，化学式为 CO₂。CO 是一氧化碳，毒性很强。',
      },
    ],
    senior: [
      {
        topic: '物质的量',
        question: '18 g 水的物质的量约为？',
        options: ['0.5 mol', '1 mol', '2 mol', '18 mol'],
        answer: 1,
        explanation: '水的摩尔质量是 18 g/mol，n = m/M = 18 g ÷ 18 g/mol = 1 mol。这包含约 6.02 × 10²³ 个水分子。',
      },
      {
        topic: '化学平衡',
        question: '在密闭容器中，增加反应物浓度通常会使平衡？',
        options: ['向正反应方向移动', '向逆反应方向移动', '完全不移动', '先正向后逆向永久移动'],
        answer: 0,
        explanation: '根据勒夏特列原理，增加反应物浓度会使平衡向消耗反应物的方向移动，也就是正反应方向，但平衡常数温度不变时不变。',
      },
      {
        topic: '同分异构',
        question: '分子式 C₄H₁₀ 的烷烃同分异构体有几种？',
        options: ['1 种', '2 种', '3 种', '4 种'],
        answer: 1,
        explanation: 'C₄H₁₀ 有正丁烷和异丁烷（2-甲基丙烷）两种结构。碳链异构是高中同分异构体最常见的类型。',
      },
      {
        topic: '氧化还原',
        question: '在氧化还原反应中，氧化剂在反应中？',
        options: ['失去电子，被氧化', '得到电子，被还原', '不参与电子转移', '一定是单质'],
        answer: 1,
        explanation: '氧化剂得到电子、被还原；还原剂失去电子、被氧化。口诀“升失氧、降得还”可帮助记忆。',
      },
    ],
    university: [
      {
        topic: '热力学',
        question: '在恒温恒压下，反应自发进行的判据是？',
        options: ['ΔH < 0 且必须放热', 'ΔG < 0', 'ΔS < 0', 'ΔG > 0'],
        answer: 1,
        explanation: '恒温恒压且无非体积功时，吉布斯自由能变 ΔG < 0 表示过程自发。ΔG = ΔH − TΔS，兼顾了焓与熵两种驱动力。',
      },
      {
        topic: '有机机理',
        question: 'SN1 反应的决速步通常取决于？',
        options: ['亲核试剂的浓度', '碳正离子中间体的稳定性', '产物的颜色', '溶剂的沸点'],
        answer: 1,
        explanation: 'SN1 分两步进行，决速步是卤代烃解离形成碳正离子。碳正离子越稳定（如三级），反应越快；动力学上表现为一级反应。',
      },
      {
        topic: '配位化学',
        question: '八面体配合物的中心离子配位数通常是？',
        options: ['2', '4', '6', '8'],
        answer: 2,
        explanation: '八面体配位中，六个配体沿三个互相垂直的轴方向接近中心金属离子，因此配位数通常为 6。',
      },
      {
        topic: '芳香性',
        question: '苯的芳香性常归因于其 π 电子数满足？',
        options: ['2 个 π 电子', '4 个 π 电子', '6 个 π 电子', '8 个 π 电子'],
        answer: 2,
        explanation: '苯是平面环状共轭体系，拥有 6 个 π 电子，满足休克尔规则 4n + 2（n = 1），因而具有芳香稳定化能。',
      },
    ],
    postgrad: [
      {
        topic: '物理有机',
        question: '哈蒙德假说认为，在放热反应的过渡态附近？',
        options: ['过渡态结构更接近产物', '过渡态结构更接近反应物', '过渡态结构与反应物、产物都无关', '不存在过渡态'],
        answer: 1,
        explanation: '哈蒙德假说：过渡态结构与能量最接近的物种相似。放热反应过渡态能量更靠近反应物，因此结构更像反应物；吸热反应则更像产物。',
      },
      {
        topic: '酶动力学',
        question: '米氏常数 Km 的物理意义是？',
        options: ['最大反应速率', '反应速率为最大速率一半时的底物浓度', '酶的总浓度', '抑制剂浓度'],
        answer: 1,
        explanation: '在米氏方程中，当 [S] = Km 时，v = Vmax/2。Km 越小，通常表示酶与底物的亲和力越强。',
      },
      {
        topic: '光谱',
        question: '饱和酮的 C=O 伸缩振动在红外光谱中通常出现在什么波数附近？',
        options: ['约 3400 cm⁻¹', '约 2200 cm⁻¹', '约 1700 cm⁻¹', '约 800 cm⁻¹'],
        answer: 2,
        explanation: '常见羰基 C=O 伸缩振动在 1650–1750 cm⁻¹ 附近，饱和酮约 1715 cm⁻¹。3400 cm⁻¹ 附近多为 O—H/N—H 伸缩。',
      },
      {
        topic: '立体化学',
        question: '对映异构体的定义是？',
        options: ['构造相同但官能团不同的分子', '互为镜像且不能重合的分子', '所有物理性质完全相同的分子', '双键两侧基团相同的分子'],
        answer: 1,
        explanation: '对映异构体互为不可重合的镜像，通常含手性中心。它们旋光方向相反，但在非手性环境中许多物理性质相同。',
      },
    ],
  },
  sheng: {
    junior: [
      {
        topic: '细胞',
        question: '植物进行光合作用的主要细胞器是？',
        options: ['线粒体', '叶绿体', '细胞核', '液泡'],
        answer: 1,
        explanation: '叶绿体含有叶绿素，能吸收光能，将二氧化碳和水转化为有机物并释放氧气。线粒体则主要负责细胞呼吸。',
      },
      {
        topic: '生态',
        question: '食物链中能量流动的方向是？',
        options: ['由消费者流向生产者', '由生产者流向各级消费者', '双向循环且不损耗', '由分解者流向消费者'],
        answer: 1,
        explanation: '能量通过食物链由生产者流向初级消费者、次级消费者等，流动是单向的、逐级递减的，传递效率通常约 10%–20%。',
      },
      {
        topic: '植物',
        question: '叶片上的气孔主要有什么功能？',
        options: ['吸收土壤中的无机盐', '进行气体交换和蒸腾作用', '运输有机物', '感受重力'],
        answer: 1,
        explanation: '气孔由保卫细胞围成，是二氧化碳进入、氧气和水蒸气排出的通道，同时参与蒸腾作用。',
      },
      {
        topic: '遗传',
        question: 'DNA 分子中与腺嘌呤（A）配对的是？',
        options: ['鸟嘌呤（G）', '胸腺嘧啶（T）', '胞嘧啶（C）', '尿嘧啶（U）'],
        answer: 1,
        explanation: 'DNA 双链中 A 与 T 配对、G 与 C 配对，通过氢键相连。RNA 中与 A 配对的是 U。',
      },
    ],
    senior: [
      {
        topic: '细胞分裂',
        question: '有丝分裂结束后，子细胞的染色体数目与母细胞相比？',
        options: ['加倍', '减半', '相同', '随机变化'],
        answer: 2,
        explanation: '有丝分裂中染色体复制一次、平均分配一次，因此两个子细胞的染色体数目与亲代细胞相同，保持遗传稳定。',
      },
      {
        topic: '酶',
        question: '高温使酶失活的主要原因是？',
        options: ['酶被稀释', '酶的空间结构被破坏', '底物消失', '酶的化学本质变成糖'],
        answer: 1,
        explanation: '大多数酶是蛋白质，高温会破坏其空间结构（变性），导致活性中心无法与底物结合，而且通常不可逆。',
      },
      {
        topic: '遗传',
        question: '基因型为 Aa 的两个个体杂交（完全显性），后代表型比约为？',
        options: ['1:1', '2:1', '3:1', '9:3:3:1'],
        answer: 2,
        explanation: 'Aa × Aa 的子代基因型为 AA:Aa:aa = 1:2:1；完全显性时，AA 与 Aa 都表现显性，因此表型比约为 3:1。',
      },
      {
        topic: '调节',
        question: '胰岛素对血糖的主要作用是？',
        options: ['升高血糖', '降低血糖', '使血糖不变', '促进糖异生'],
        answer: 1,
        explanation: '胰岛素由胰岛 B 细胞分泌，能促进组织摄取、利用和储存葡萄糖，从而降低血糖；胰高血糖素则升高血糖。',
      },
    ],
    university: [
      {
        topic: '分子生物学',
        question: '真核细胞中，转录和翻译的主要场所分别是？',
        options: ['细胞质、细胞核', '细胞核、核糖体', '核糖体、细胞核', '线粒体、高尔基体'],
        answer: 1,
        explanation: '真核细胞的核基因在细胞核内转录为 mRNA，mRNA 经加工后进入细胞质，在核糖体上翻译成蛋白质。',
      },
      {
        topic: '生态学',
        question: '净初级生产量（NPP）与总初级生产量（GPP）的关系是？',
        options: ['NPP = GPP + 呼吸消耗', 'NPP = GPP − 生产者呼吸消耗', 'NPP = GPP × 呼吸率', 'NPP 与呼吸无关'],
        answer: 1,
        explanation: '总初级生产量 GPP 是光合作用固定的总能量，生产者自身呼吸消耗 R 后，剩余用于生长的部分才是净初级生产量：NPP = GPP − R。',
      },
      {
        topic: '生化',
        question: '线粒体内膜上 ATP 合酶合成 ATP 时，直接利用的能量形式是？',
        options: ['光能', '质子梯度势能', 'ATP 水解能', 'NADH 的化学键直接转移'],
        answer: 1,
        explanation: '电子传递链把质子泵到膜间隙，形成跨膜质子梯度；质子经 ATP 合酶回流时释放的势能驱动 ADP 与 Pi 合成 ATP，即化学渗透。',
      },
      {
        topic: '酶动力学',
        question: '竞争性抑制剂对酶促反应动力学参数的典型影响是？',
        options: ['Vmax 降低，Km 不变', 'Vmax 不变，表观 Km 增大', 'Vmax 增大，Km 减小', 'Vmax 和 Km 都降低'],
        answer: 1,
        explanation: '竞争性抑制剂与底物争夺活性中心，可通过增加底物浓度克服，因此 Vmax 不变，但需要更高底物浓度达到半最大速度，表观 Km 增大。',
      },
    ],
    postgrad: [
      {
        topic: '表观遗传',
        question: '基因启动子区域 DNA 高度甲基化通常会导致？',
        options: ['转录增强', '转录抑制', 'DNA 复制停止', '蛋白质空间结构改变'],
        answer: 1,
        explanation: '启动子 CpG 岛甲基化常招募甲基化结合蛋白及组蛋白去乙酰化酶，使染色质凝聚，从而抑制转录。它是一种可遗传但DNA序列不变的调控。',
      },
      {
        topic: '基因编辑',
        question: 'CRISPR-Cas9 系统实现靶向切割主要依赖？',
        options: ['随机断裂 DNA', '向导 RNA 与靶序列互补配对', '抗体识别 DNA', 'DNA 聚合酶延伸'],
        answer: 1,
        explanation: 'sgRNA 通过碱基互补识别目标 DNA，引导 Cas9 核酸酶在邻近 PAM 的位置切割双链，造成双链断裂，随后由细胞修复机制完成编辑。',
      },
      {
        topic: '群体遗传',
        question: '哈迪-温伯格平衡的成立通常不要求下列哪一项？',
        options: ['随机交配', '种群足够大', '没有选择压力', '表现型必须完全相同'],
        answer: 3,
        explanation: '哈迪-温伯格平衡要求种群大、随机交配、无突变、无迁移、无选择。个体的表现型当然可以不同，等位基因频率才需保持稳定。',
      },
      {
        topic: '蛋白质调节',
        question: '别构调节剂通常作用于酶的哪个部位？',
        options: ['活性中心', '活性中心之外的调节位点', '底物分子', 'mRNA'],
        answer: 1,
        explanation: '别构调节剂结合在活性中心以外的别构位点，通过改变酶构象影响催化活性，可产生正协同或负协同效应。',
      },
    ],
  },
  ying: {
    junior: [
      {
        topic: 'Vocabulary',
        question: 'Choose the correct word: “I ___ to school every day.”',
        options: ['go', 'goes', 'going', 'went'],
        answer: 0,
        explanation: '一般现在时中，主语 I 后使用动词原形 go。若主语是第三人称单数（he/she/it），动词才加 -s。',
      },
      {
        topic: 'Synonyms',
        question: 'Which word is closest in meaning to “happy”?',
        options: ['angry', 'glad', 'tired', 'quiet'],
        answer: 1,
        explanation: 'glad 与 happy 都表示“高兴的”。angry 是生气的，tired 是疲惫的，quiet 是安静的。',
      },
      {
        topic: 'Grammar',
        question: 'What is the plural form of “child”?',
        options: ['childs', 'childes', 'children', 'childrens'],
        answer: 2,
        explanation: 'child 是不规则复数名词，复数是 children，不是加 -s。类似还有 man → men、foot → feet。',
      },
      {
        topic: 'Useful Words',
        question: 'What does “library” mean in Chinese?',
        options: ['图书馆', '实验室', '书店', '博物馆'],
        answer: 0,
        explanation: 'library 意为“图书馆”。bookstore 是书店，laboratory 是实验室，museum 是博物馆。',
      },
    ],
    senior: [
      {
        topic: 'Tense',
        question: 'Choose the best answer: “I ___ here since 2020.”',
        options: ['live', 'lived', 'have lived', 'am living'],
        answer: 2,
        explanation: 'since 2020 表示从过去持续到现在的状态，需用现在完成时 have lived。它强调过去的动作对现在造成的结果或延续。',
      },
      {
        topic: 'Subjunctive',
        question: 'Choose the correct sentence:',
        options: ['If I was you, I will apologize.', 'If I were you, I would apologize.', 'If I am you, I would apologize.', 'If I were you, I will apologized.'],
        answer: 1,
        explanation: '与现在事实相反的虚拟条件句：if 从句用过去式（be 动词常用 were），主句用 would + 动词原形。',
      },
      {
        topic: 'Idioms',
        question: 'What does “break the ice” most likely mean?',
        options: ['打碎冰块', '打破僵局，活跃气氛', '结束一段关系', '让冬天结束'],
        answer: 1,
        explanation: 'break the ice 是习语，字面是“破冰”，实际表示在陌生场合打破沉默或尴尬，让交流开始。',
      },
      {
        topic: 'Passive Voice',
        question: 'Choose the correct passive form: “The novel ___ by a young writer.”',
        options: ['writes', 'was written', 'has wrote', 'is writing'],
        answer: 1,
        explanation: '小说是被写的，且叙述发生在过去，用一般过去时的被动语态 was/were + 过去分词：was written。',
      },
    ],
    university: [
      {
        topic: 'Academic Vocabulary',
        question: 'What does “ubiquitous” mean?',
        options: ['extremely rare', 'present everywhere', 'carefully hidden', 'newly invented'],
        answer: 1,
        explanation: 'ubiquitous 意为“无处不在的”。例如：Mobile phones have become ubiquitous in modern life.',
      },
      {
        topic: 'Academic Writing',
        question: 'In “The results suggest that the hypothesis may hold”, the word “suggest” mainly functions to?',
        options: ['state absolute certainty', 'hedge the claim cautiously', 'introduce a quotation', 'contradict the results'],
        answer: 1,
        explanation: '学术写作常用 may、suggest、appear 等模糊限制语（hedges），以保持谨慎和可证伪性，避免把有限证据表述成绝对结论。',
      },
      {
        topic: 'Sustainability',
        question: 'Which definition best matches “sustainable development”?',
        options: ['发展越快越好', '满足当代需求而不损害后代满足其需求能力的发展', '完全停止使用自然资源', '只追求经济增长'],
        answer: 1,
        explanation: '可持续被广泛定义为“既满足当代人的需要，又不损害后代人满足其需要的能力”。它同时关注环境、社会与经济。',
      },
      {
        topic: 'Advanced Grammar',
        question: 'Choose the correct sentence:',
        options: ['Scarcely I had arrived when it began to rain.', 'Scarcely had I arrived when it began to rain.', 'Scarcely I arrived than it began to rain.', 'Scarcely had I arrived than it began to rain.'],
        answer: 1,
        explanation: 'scarcely…when… 表示“一……就……”。否定副词 scarcely 置于句首时主句部分倒装：Scarcely had I arrived when…',
      },
    ],
    postgrad: [
      {
        topic: 'Academic Discourse',
        question: 'In academic contexts, a “paradigm” is best understood as?',
        options: ['a single data point', 'a shared framework of assumptions and methods', 'a grammatical mistake', 'a type of footnote'],
        answer: 1,
        explanation: 'paradigm 指某一学科共同体共享的理论框架、假设、方法与范例，由库恩在《科学革命的结构》中系统使用。',
      },
      {
        topic: 'Literary Theory',
        question: '“Intertextuality” refers to?',
        options: ['the relationship between texts through quotation, allusion and transformation', 'the translation of a text into another language', 'the length of a paragraph', 'the literal meaning of idioms'],
        answer: 0,
        explanation: '互文性由克里斯蒂娃提出，强调任何文本都不是孤立的，而是在引用、回应、改写其他文本的网络中生成意义。',
      },
      {
        topic: 'Logic & Argument',
        question: 'The phrase “begs the question” traditionally means?',
        options: ['raises an interesting question', 'assumes the conclusion it is supposed to prove', 'asks the audience to vote', 'changes the subject'],
        answer: 1,
        explanation: '“beg the question”传统上是逻辑谬误 petitio principii，即把待证结论当作前提。日常英语中常被误用为“引出问题”，学术写作应避免这种误用。',
      },
      {
        topic: 'Pragmatics',
        question: 'Pragmatics primarily studies?',
        options: ['the internal structure of sentences only', 'how context shapes meaning and language use', 'the history of spelling', 'the physical sounds of speech only'],
        answer: 1,
        explanation: '语用学研究语言在具体语境中的使用与意义，如指示、预设、会话含义和言语行为。“你能把盐递给我吗？”往往不是询问能力。',
      },
    ],
  },
  gong: {
    junior: [
      {
        topic: '急救',
        question: '轻微烫伤后，第一步应该怎么做？',
        options: ['立刻涂牙膏', '用流动的凉水持续冲洗', '马上挑破水泡', '用冰块直接敷很久'],
        answer: 1,
        explanation: '轻度烫伤应先用流动凉水冲洗约 15–20 分钟，降低局部温度，然后覆盖干净敷料。不要涂牙膏、酱油，也不要挑破水泡。',
      },
      {
        topic: '用电安全',
        question: '维修家用电器前，最重要的第一步是？',
        options: ['戴上一双棉手套', '切断电源', '用湿布擦干净', '先拆开外壳看看'],
        answer: 1,
        explanation: '任何电器维修都应先断开电源，必要时拔掉插头，确认无电后再操作。湿手、湿布和带电操作都可能造成触电。',
      },
      {
        topic: '消防',
        question: '使用灭火器时，应该把喷口对准火焰的哪里？',
        options: ['火焰最上方', '火焰中部', '火焰根部', '冒烟最浓处'],
        answer: 2,
        explanation: '灭火器应在上风方向，对准火焰根部左右扫射。只喷火焰上方无法切断燃烧物与氧气的接触。',
      },
      {
        topic: '生活常识',
        question: '在中国大陆拨打医疗急救电话，应拨打？',
        options: ['110', '119', '120', '122'],
        answer: 2,
        explanation: '120 是医疗急救，110 是报警，119 是火警，122 是交通事故报警。紧急情况要清楚说明地点、人数和伤情。',
      },
    ],
    senior: [
      {
        topic: '经济常识',
        question: '当通货膨胀明显高于存款利率时，把钱长期存在银行最可能发生什么？',
        options: ['购买力上升', '购买力下降', '本金自动翻倍', '风险完全消失'],
        answer: 1,
        explanation: '实际收益约等于名义利率减通胀率。当通胀高于存款利率时，实际利率为负，钱的账面数字可能增加，但能买到的东西变少。',
      },
      {
        topic: '法律常识',
        question: '一份有效合同通常至少需要哪些核心要素？',
        options: ['口头承诺即可，无需内容', '要约与承诺，并具备相应民事行为能力', '必须经过公证', '必须使用手写签名'],
        answer: 1,
        explanation: '合同成立通常需一方要约、另一方承诺，当事人具有相应民事行为能力，意思表示真实，内容不违反法律强制性规定。公证并非所有合同的生效要件。',
      },
      {
        topic: '健康',
        question: '关于均衡饮食，下列做法最合理的是？',
        options: ['只吃高蛋白食物', '完全不吃主食', '食物多样，注意谷类、蔬果和优质蛋白搭配', '用含糖饮料代替喝水'],
        answer: 2,
        explanation: '均衡饮食强调食物多样化与适量：谷类提供能量，蔬果提供维生素和膳食纤维，鱼禽蛋奶豆提供优质蛋白，同时控制油盐糖。',
      },
      {
        topic: '金融',
        question: '1000 元按年利率 10% 复利计算，两年后本息合计约为？',
        options: ['1100 元', '1200 元', '1210 元', '1300 元'],
        answer: 2,
        explanation: '复利计算：1000 × (1 + 10%)² = 1000 × 1.21 = 1210 元。第二年的利息也会在第一年利息的基础上产生。',
      },
    ],
    university: [
      {
        topic: '结构',
        question: '三角形结构在建筑中特别稳定的主要原因是？',
        options: ['三角形面积最大', '受外力时边长固定的三角形不易变形', '三角形一定使用钢材', '三角形看起来更美'],
        answer: 1,
        explanation: '三根杆件用铰接形成三角形后，若边长不变，其形状即被几何约束，不容易像四边形那样发生剪切变形，因此桁架中大量使用三角形。',
      },
      {
        topic: '会计',
        question: '会计恒等式“资产 = 负债 + 所有者权益”说明？',
        options: ['资产一定来自借款', '企业资源由债权人和所有者提供的权益构成', '负债永远大于资产', '利润等于现金'],
        answer: 1,
        explanation: '企业全部资产由两方权益主张：债权人（负债）与所有者（所有者权益）。任何交易都保持这一恒等式平衡。',
      },
      {
        topic: '项目管理',
        question: '项目网络计划中的“关键路径”是指？',
        options: ['最短的路径', '总工期最长的路径', '成本最低的路径', '参与人数最少的路径'],
        answer: 1,
        explanation: '关键路径是从开始到结束耗时最长的路径，决定项目最短总工期。关键路径上活动的延误会直接推迟整个项目。',
      },
      {
        topic: '设计思维',
        question: '设计思维通常以什么为起点？',
        options: ['先确定最终外观', '理解真实用户及其需求', '先购买最贵的材料', '先写广告文案'],
        answer: 1,
        explanation: '设计思维以共情用户、定义问题为起点，再经过构思、原型和测试迭代。它强调先理解问题，而不是直接跳到解决方案。',
      },
    ],
    postgrad: [
      {
        topic: '决策',
        question: '在做“是否继续投入”的理性决策时，沉没成本应该？',
        options: ['计入未来收益', '被忽略，只比较未来增量成本与收益', '一定优先回收', '按比例摊到每个项目'],
        answer: 1,
        explanation: '沉没成本已经发生且无法收回，不应影响未来决策。理性决策应比较继续投入的边际成本与预期边际收益。',
      },
      {
        topic: '工程经济',
        question: '一个独立项目在基准收益率下的净现值（NPV）为正值，通常意味着？',
        options: ['项目收益低于最低要求', '项目在财务上值得接受', '项目没有风险', '投资回收期为零'],
        answer: 1,
        explanation: 'NPV 大于零表示项目按基准折现率折现后的收益现值超过成本，能为投资者创造额外价值；但还应考虑风险、资金约束与非财务因素。',
      },
      {
        topic: '统计',
        question: '中心极限定理主要说明，在适当条件下？',
        options: ['总体一定服从正态分布', '样本均值的抽样分布随样本量增大趋近正态', '样本一定代表总体', '标准差会消失'],
        answer: 1,
        explanation: '中心极限定理指出，在独立同分布、方差有限等条件下，样本量增大时样本均值的分布趋近正态，不论原总体分布如何。这支撑了很多统计推断。',
      },
      {
        topic: '项目管理',
        question: '敏捷开发强调的典型做法是？',
        options: ['一次交付全部功能，之后不再修改', '短周期迭代、持续反馈与适应变化', '只做文档不做软件', '取消所有用户沟通'],
        answer: 1,
        explanation: '敏捷方法以短迭代增量交付，通过持续反馈和跨职能协作应对不确定性，而不是在开始就冻结所有需求。它并非等于没有计划。',
      },
    ],
  },
};

const LEVEL_LABEL = { junior: '初中', senior: '高中', university: '大学', postgrad: '研究生' };
const ISLAND_NAME = { wen: '语文', shu: '数学', wu: '物理', hua: '化学', sheng: '生物', ying: '英语', gong: '百工' };

export const QUESTIONS = Object.entries(RAW).flatMap(([island, levels]) =>
  Object.entries(levels).flatMap(([level, items]) =>
    items.map((item, index) => ({
      ...item,
      id: `${island}-${level}-${index + 1}`,
      island,
      islandName: ISLAND_NAME[island],
      level,
      levelLabel: LEVEL_LABEL[level],
    })),
  ),
);

export const QUESTIONS_BY_ID = Object.fromEntries(QUESTIONS.map((question) => [question.id, question]));

export function getQuestionPool(islandId, level) {
  const pool = QUESTIONS.filter((question) => question.island === islandId && question.level === level);
  return pool.length ? pool : QUESTIONS.filter((question) => question.island === islandId);
}

export function getQuestionById(id) {
  return QUESTIONS_BY_ID[id] ?? null;
}

export function drawQuestions(islandId, level, count = 3, rng = Math.random) {
  const pool = [...getQuestionPool(islandId, level)];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
