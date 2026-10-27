import { artFor } from './board-art.js';
import { ROCKET_BOARD } from './rocket-board.js';

/**
 * 板书剧本：像老师在白板上一步步画出来。
 * 每一步只多画几笔，前面的内容留在板上，最后合成一张完整的图。
 * 坐标基于 1000 × 620 的画布。
 */

const BLUE = '#2f5d8f';
const RED = '#b6412f';
const GRAY = '#5d6470';
const GOLD = '#b4831f';
const GREEN = '#2c7355';

const P = (type, x, y, o = {}) => ({ k: 'clay', type, x, y, ...o });
const T = (t, x, y, o = {}) => ({ k: 'text', t, x, y, ...o });
const A = (from, to, o = {}) => ({ k: 'arrow', from, to, ...o });
const L = (x, y, rx, ry, o = {}) => ({ k: 'loop', x, y, rx, ry, ...o });
const U = (x, y, w, o = {}) => ({ k: 'underline', x, y, w, ...o });
const S = (x, y, o = {}) => ({ k: 'star', x, y, ...o });
const CARD = (x, y, w, h, title, lines, o = {}) => ({ k: 'card', x, y, w, h, title, lines, ...o });
const TAG = (t, x, y, o = {}) => ({ k: 'tag', t, x, y, ...o });
const D = (x, y, w, o = {}) => ({ k: 'divider', x, y, w, ...o });
const PATH = (d, o = {}) => ({ k: 'path', d, ...o });
const NOTE = (x, y, w, h, lines, o = {}) => ({ k: 'note', x, y, w, h, lines, ...o });

/* ============================== 历史 · 安史之乱 ============================== */
const ANSHI = {
  steps: [
    {
      title: '一开始，兵是自己种田养出来的',
      text: '唐太宗的府兵制，本质是一笔交换：国家按丁给你田，你平时种地，战时自备武器上阵。不用发军饷，也不用养常备军。',
      note: '看箭头：制度把「田」和「兵」绑在了一起。',
      chips: ['府兵制', '兵农合一'],
      items: [
        P('person', 118, 196, { hat: 'emperor', robe: '#d8a25a', s: 0.95 }),
        P('gate', 236, 196, { s: 0.74 }),
        P('person', 372, 196, { hat: 'soldier', robe: '#7d8b99', s: 0.8 }),
        P('horse', 450, 196, { s: 0.62 }),
        T('从府兵到藩镇', 500, 66, { size: 24, color: BLUE, rot: -1 }),
        T('一条制度链是怎么断的', 500, 96, { size: 15, color: GRAY }),
        T('唐太宗', 118, 238, { size: 25 }),
        T('府兵', 404, 238, { size: 23 }),
        T('府兵制 ★', 336, 108, { size: 23, color: RED, rot: -3 }),
        A([332, 122], [368, 158], { color: RED, bend: -0.1 }),
      ],
    },
    {
      title: '这套交换的前提，是田一直在',
      text: '均田制把田分给男丁，丁口有田，才有力役，才有兵源。所以府兵制的底座不是军事，是土地。',
      note: '制度是叠起来的：上面一层塌了，往往是因为下面那层先空了。',
      chips: ['均田制', '土地'],
      items: [
        P('gate', 108, 372, { s: 0.56 }),
        P('field', 230, 372, { s: 0.95 }),
        P('person', 318, 372, { s: 0.42, hat: 'scholar', robe: '#8a9a6b' }),
        P('person', 354, 372, { s: 0.42, hat: 'scholar', robe: '#b08968' }),
        P('person', 390, 372, { s: 0.42, hat: 'scholar', robe: '#7f8fa6' }),
        T('均田制', 258, 306, { size: 34, color: RED, rot: -3 }),
        U(196, 318, 128, { color: RED }),
        T('按丁授田 → 有田才有兵', 252, 424, { size: 16, color: GRAY }),
        A([318, 248], [286, 284], { color: BLUE, bend: 0.1 }),
      ],
    },
    {
      title: '田被兼并了，交换就断了',
      text: '人口增长、土地兼并，国家手里没有田可授。农民失地逃亡，府兵的名单上再也凑不出人。唐玄宗只能改募兵：国家发饷，招职业兵。',
      note: '这不是「换了个制度」，是被现实逼出来的替代方案。',
      chips: ['唐玄宗', '募兵制'],
      items: [
        P('person', 606, 196, { hat: 'emperor', robe: '#d8a25a', s: 0.95 }),
        P('gate', 700, 196, { s: 0.54 }),
        P('book', 788, 202, { s: 1.1 }),
        P('person', 884, 196, { hat: 'soldier', robe: '#a05a4a', s: 0.85, spear: true }),
        T('唐玄宗', 606, 238, { size: 25 }),
        T('募兵制 ★', 848, 104, { size: 23, color: RED, rot: 3 }),
        A([836, 120], [864, 156], { color: RED, bend: 0.12 }),
        T('均田制瓦解 → 兵源断 → 雇兵', 764, 248, { size: 15, color: GRAY }),
      ],
    },
    {
      title: '职业兵要有人管，于是有了节度使',
      text: '募兵制下，边镇需要常设的指挥官。节度使一开始只是军区司令，后来把兵、财、政都握在手里——中央给的授权，慢慢变成了他自己的本钱。',
      note: '同一条制度，从「工具」长成了「势力」，只差时间。',
      chips: ['节度使', '军镇'],
      items: [
        P('towerPavilion', 806, 386, { s: 0.8 }),
        P('flag', 894, 386, { s: 0.8 }),
        TAG('兵', 690, 300, { w: 42, color: RED, fill: 'rgba(255,244,234,0.7)' }),
        TAG('政', 690, 334, { w: 42, color: RED, fill: 'rgba(255,244,234,0.7)' }),
        TAG('财', 690, 368, { w: 42, color: RED, fill: 'rgba(255,244,234,0.7)' }),
        T('节度使', 812, 430, { size: 28 }),
        L(812, 420, 74, 26, { color: RED, rot: -5 }),
        T('一镇之内，军政财一把抓', 812, 468, { size: 16, color: GRAY }),
      ],
    },
    {
      title: '一个人管三个镇，就不只是将军了',
      text: '安禄山身兼平卢、范阳、河东三镇节度使，手下是职业兵，只认发饷的人。朝廷里李林甫、杨国忠在争权，边镇却在长肌肉。',
      note: '「节度使 × 3」是这页板书里最危险的一行字。',
      chips: ['安禄山', '三镇'],
      items: [
        P('person', 106, 552, { hat: 'official', robe: '#a8452f', s: 0.78 }),
        P('person', 174, 552, { hat: 'official', robe: '#8e6b9e', s: 0.78 }),
        T('李林甫', 106, 588, { size: 19 }),
        T('杨国忠', 174, 588, { size: 19 }),
        P('person', 330, 552, { hat: 'general', robe: '#6b5a46', s: 1.0, bulk: 0.55, beard: true }),
        T('安禄山', 330, 590, { size: 21 }),
        T('节度使 × 3', 428, 512, { size: 24, color: RED, rot: -4 }),
        S(392, 500, { size: 20 }),
        A([402, 500], [366, 486], { color: RED, bend: 0.2 }),
      ],
    },
    {
      title: '然后，兵锋转向了长安',
      text: '755 年安禄山以「清君侧」为名起兵，史思明响应。八年战乱，洛阳、长安相继失守。唐没有亡，但从此藩镇割据、赋税崩坏——盛唐在这一页结束。',
      note: '安史之乱不是一场叛乱，是一条制度链的断裂声。',
      chips: ['755—763', '由盛转衰'],
      items: [
        P('person', 616, 552, { hat: 'general', robe: '#7a4b3a', s: 0.85, bulk: 0.2, flag: true, flagColor: '#b6412f' }),
        P('person', 700, 552, { hat: 'general', robe: '#5c5a6b', s: 0.85, flag: true, flagColor: '#7a5c2f' }),
        T('安禄山', 616, 590, { size: 17 }),
        T('史思明', 700, 590, { size: 17 }),
        T('安史之乱', 872, 522, { size: 42, color: RED, rot: -5 }),
        U(782, 538, 192, { color: RED }),
        T('755 — 763 · 唐由盛转衰', 872, 560, { size: 16, color: GRAY, rot: -3 }),
      ],
    },
  ],
  quiz: [
    {
      q: '府兵制能够运转，最关键的前提是什么？',
      options: ['皇帝本人能打仗', '国家手里有田可分，兵农合一', '边境长期没有战争', '朝廷有足够的白银发军饷'],
      answer: 1,
      why: '府兵靠「授田」自养，田是军役的报酬。均田制瓦解，府兵制就断了根。',
    },
    {
      q: '唐玄宗改行募兵制，直接原因是什么？',
      options: ['想削弱宰相的权力', '府兵逃亡，均田制瓦解后兵源枯竭', '为了对外扩张领土', '为了减少军费开支'],
      answer: 1,
      why: '田被兼并、农户逃亡，府兵名单凑不出人，只能由国家发饷雇职业兵。',
    },
    {
      q: '节度使为什么会变成安史之乱的隐患？',
      options: ['他们世代都是皇族', '他们只拿俸禄，没有兵权', '兵、财、政三权集于一身，职业兵只认发饷的人', '他们掌握着科举取士的权力'],
      answer: 2,
      why: '募兵制让边镇拥有了常备职业兵，节度使又兼领财政与民政，中央的授权变成了地方的本钱。',
    },
  ],
};

/* ============================== 化学 · 电池怎么选 ============================== */
const BATTERY = {
  steps: [
    {
      title: '电池不是「装电的盒子」，是搬锂离子的泵',
      text: '放电时，锂离子从负极穿过电解液跑到正极，电子走外电路，灯就亮了；充电时，外部电压把它们推回去。所谓「电量」，就是有多少锂离子还能来回跑。',
      note: '记住这个来回：容量 = 可搬运的锂离子总量。',
      chips: ['锂离子', '充放电'],
      items: [
        P('person', 140, 250, { robe: '#5b7fa6', hat: 'none', s: 1.15 }),
        P('person', 860, 250, { robe: '#a8533f', hat: 'none', s: 1.15 }),
        P('bulb', 500, 152, { s: 1.32 }),
        P('bird', 320, 206, { s: 0.9 }),
        P('bird', 412, 176, { s: 0.78 }),
        P('bird', 588, 176, { s: 0.78 }),
        P('bird', 680, 206, { s: 0.9 }),
        A([250, 116], [750, 116], { color: RED, bend: -0.04, label: '放电', labelAt: [500, 72], labelSize: 22 }),
        A([750, 318], [250, 318], { color: BLUE, bend: 0.05, label: '充电', labelAt: [500, 352], labelSize: 22 }),
        T('Li⁺ 锂离子', 500, 268, { size: 24 }),
      ],
    },
    {
      title: '负极：锂离子挤进石墨的层间',
      text: '石墨是一层层的，锂离子像书签一样插进去。插进去叫充电，拔出来叫放电。插拔次数多了，层间距被撑坏，能装回去的离子越来越少——这就是电量衰减。',
      note: '所以「循环寿命」不是一个营销词，是结构疲劳。',
      chips: ['石墨', '衰减'],
      items: [
        P('graphite', 140, 456, { s: 1.0 }),
        T('负极 · 石墨', 140, 492, { size: 21 }),
        T('锂离子挤进层间', 300, 392, { size: 16, color: GRAY, anchor: 'start' }),
        T('反复插拔 → 层结构疲劳', 300, 416, { size: 16, color: GRAY, anchor: 'start' }),
        T('电量衰减', 330, 456, { size: 25, color: RED, rot: -3 }),
        U(282, 470, 96, { color: RED }),
        A([286, 438], [254, 448], { color: RED, bend: 0.1 }),
      ],
    },
    {
      title: '正极：两条路线，两种性格',
      text: '磷酸铁锂（LFP）结构稳、便宜、循环长，缺点是能量密度低，同样重量跑得近；三元锂（NCM/NCA）镍钴锰搭配，能量密度高、低温好，但贵，热失控风险更高。',
      note: '不是谁更先进，是你在拿「跑多远」换「多安全、多便宜」。',
      chips: ['磷酸铁锂', '三元锂'],
      items: [
        P('panel', 690, 450, { s: 1.0 }),
        P('panel', 860, 450, { s: 1.0, kind: 'triple' }),
        T('磷酸铁锂', 690, 486, { size: 20 }),
        T('便宜 · 安全 · 长寿', 690, 508, { size: 14, color: GRAY }),
        T('三元锂', 860, 486, { size: 20 }),
        T('镍钴锰 · 轻 · 贵', 860, 508, { size: 14, color: GRAY }),
        T('正极', 776, 376, { size: 22 }),
        A([754, 386], [704, 418], { color: BLUE, bend: 0.12 }),
        A([798, 386], [846, 418], { color: BLUE, bend: -0.12 }),
      ],
    },
    {
      title: '鼓包与漏液：安全红线',
      text: '过充、过热、内部短路会让电解液分解产气，电芯鼓起来；再严重就是漏液、起火。鼓包不是「还能再用用」，是结构已经坏了。',
      note: '看到鼓包就换，不要按压、不要继续充。',
      chips: ['鼓包', '安全'],
      items: [
        P('pouch', 500, 416, { s: 0.78 }),
        T('鼓包', 500, 450, { size: 23, color: RED }),
        T('内部产气 / 副反应', 500, 472, { size: 14, color: GRAY }),
        S(556, 392, { size: 24, color: RED }),
        A([552, 400], [526, 412], { color: RED, bend: -0.1 }),
      ],
    },
    {
      title: '怎么选：先问三件事',
      text: '一看能量密度（同样重量能跑多远），二看循环寿命（能用几年），三看安全与成本（会不会鼓包、换不换得起）。通勤短途，磷酸铁锂更划算；要轻要远、冬天还要跑，三元锂更合适。',
      note: '参数不是越高越好，是匹配你的使用方式。',
      chips: ['选择标准'],
      items: [
        CARD(168, 606, 190, 66, '能量密度', ['同样重量跑多远'], { size: 13, titleSize: 17 }),
        CARD(390, 606, 190, 66, '循环寿命', ['能用几年'], { size: 13, titleSize: 17 }),
        CARD(612, 606, 190, 66, '安全 / 成本', ['会不会鼓包'], { size: 13, titleSize: 17 }),
        T('短途通勤 → 磷酸铁锂', 862, 570, { size: 16, color: RED }),
        T('要轻要远 → 三元锂', 862, 598, { size: 16, color: BLUE }),
      ],
    },
  ],
  quiz: [
    {
      q: '电池放电时，锂离子实际发生了什么？',
      options: ['被消耗掉了，所以电量变少', '从负极移动到正极，电子走外电路', '在原地振动产生电流', '变成气体排出'],
      answer: 1,
      why: '锂离子在两极之间来回搬运，电子走外电路做功；离子本身没有被消灭。',
    },
    {
      q: '「电量衰减」最根本的原因是？',
      options: ['电池外壳生锈', '石墨层结构在反复插拔中被破坏，可用的锂离子变少', '灯泡把电用掉了', '正极材料颜色变了'],
      answer: 1,
      why: '每一次充放电都是一次插拔，层结构疲劳后能容纳的锂离子减少，容量就下降。',
    },
    {
      q: '同样重量下想跑得更远，应该优先考虑？',
      options: ['磷酸铁锂，因为它更便宜', '三元锂，因为它能量密度更高', '铅酸电池，因为技术成熟', '把电池做得更大更重'],
      answer: 1,
      why: '三元锂（镍钴锰）能量密度更高，代价是成本与热稳定性；磷酸铁锂胜在安全、寿命和价格。',
    },
  ],
};

/* ============================ 建筑 · 亭台楼阁 ============================ */
const PAVILION = {
  steps: [
    {
      title: '亭：有顶，没有墙',
      text: '亭的本义就是「停」。四面通透，只留柱子与屋顶，用来在半路上停下来、看风景、歇脚。有顶无墙，是它和「屋」最根本的区别。',
      quote: '亭者，停也。人所停集也。——《释名》',
      note: '记住两个特征：有顶、无墙。',
      chips: ['亭', '有顶无墙'],
      items: [
        P('pavilion', 190, 300, { s: 0.92 }),
        P('person', 190, 296, { s: 0.42, hat: 'scholar', robe: '#7f9bb5' }),
        T('亭', 190, 346, { size: 44, color: RED }),
        T('有顶无墙，停下来看风景', 190, 376, { size: 16, color: GRAY }),
        S(126, 336, { size: 22 }),
        U(158, 356, 64, { color: RED }),
      ],
    },
    {
      title: '屋 → 楼 → 阁：看层数与架空',
      text: '单层的是屋；两层以上、可以登临的是楼；楼而架空、四周设窗设栏、用来藏书或供佛的，是阁。三者是同一套木构，按「层」和「虚」往上长。',
      note: '判断顺序：先数层，再看有没有架空与开敞。',
      chips: ['屋', '楼', '阁'],
      items: [
        P('house', 540, 300, { s: 0.68 }),
        P('storey', 682, 300, { s: 0.72, levels: 2 }),
        P('towerPavilion', 842, 300, { s: 0.76 }),
        T('屋', 540, 348, { size: 24, color: RED }),
        T('楼', 682, 348, { size: 24, color: RED }),
        T('阁', 842, 348, { size: 24, color: RED }),
        A([578, 322], [636, 322], { color: BLUE, bend: 0 }),
        A([720, 322], [790, 322], { color: BLUE, bend: 0 }),
        T('单层为屋；两层以上为楼；架空开敞为阁', 700, 380, { size: 15, color: GRAY }),
      ],
    },
    {
      title: '廊与轩：一个连，一个停',
      text: '廊是带顶的通道，把一栋栋建筑串起来，也把风、光、视线引进来；轩是有窗的小室，靠窗而坐，尺度比厅堂小，气质更轻。',
      note: '廊解决「怎么走」，轩解决「在哪坐」。',
      chips: ['廊', '轩'],
      items: [
        P('corridor', 250, 474, { s: 0.8, w: 300 }),
        P('house', 640, 474, { s: 0.64 }),
        T('廊', 250, 514, { size: 30, color: RED }),
        T('轩', 640, 514, { size: 30, color: RED }),

        A([382, 434], [556, 434], { color: BLUE, bend: -0.18, label: '连通', labelAt: [468, 404], labelSize: 16 }),
      ],
    },
    {
      title: '台：高而平的底座',
      text: '台是用土石垒起来的高平台，上面可以瞭望、祭祀、宴饮。它本身不是房子，是给房子和人用的「高度」。',
      note: '台强调的不是屋顶，是标高。',
      chips: ['台', '高台'],
      items: [
        P('terrace', 152, 584, { s: 0.95, w: 150 }),
        T('台', 244, 566, { size: 30, color: RED, anchor: 'start' }),
        T('高而平，可瞭望、可祭祀', 244, 592, { size: 15, color: GRAY, anchor: 'start' }),
      ],
    },
    {
      title: '榭与舫：把房子放到水边、水上',
      text: '榭多建在水边或水上，平台挑出水面，靠水看景；舫是船形的建筑，泊在岸边，形似船而不能行。江南园林里，「水榭」与「石舫」几乎是标配。',
      note: '榭的关键是「临水」，舫的关键是「像船」。',
      chips: ['榭', '舫'],
      items: [
        D(462, 594, 150, { color: 'rgba(92,150,170,0.5)' }),
        D(462, 604, 150, { color: 'rgba(92,150,170,0.4)' }),
        P('waterPavilion', 556, 584, { s: 0.68 }),
        P('boat', 766, 584, { s: 0.62 }),
        T('榭', 624, 576, { size: 28, color: RED, anchor: 'start' }),
        T('舫', 818, 586, { size: 28, color: RED, anchor: 'start' }),
        D(690, 596, 140, { color: 'rgba(92,150,170,0.45)' }),
      ],
    },
    {
      title: '一句话把这八个字分清楚',
      text: '亭无墙，台无顶，楼多层，阁架空，轩有窗，榭临水，廊连通，舫似船。看古建时先找这八个特征，名字就不会混。',
      note: '这一行可以抄在笔记本第一页。',
      chips: ['口诀'],
      items: [
        T('亭无墙 · 台无顶 · 楼多层 · 阁架空', 500, 76, { size: 23, color: RED, rot: -1 }),
        T('轩有窗 · 榭临水 · 廊连通 · 舫似船', 500, 110, { size: 23, color: RED, rot: -1 }),
        S(150, 70, { size: 22 }),
      ],
    },
  ],
  quiz: [
    {
      q: '「亭」与「屋」最根本的区别是？',
      options: ['亭比屋矮', '亭有顶无墙，四面通透', '亭只能用木头建造', '亭一定建在水上'],
      answer: 1,
      why: '亭的本义是「停」，有顶无墙、四面开敞，用来观景歇脚；屋是有围护的居住空间。',
    },
    {
      q: '「阁」与「楼」的主要差别在于？',
      options: ['阁一定比楼高', '阁架空开敞、四面设窗设栏，多用于藏书供佛', '楼只能建在城里', '阁没有屋顶'],
      answer: 1,
      why: '楼强调可登临的层数；阁强调架空的底座与开敞的窗栏，功能上常作藏书、供佛之用。',
    },
    {
      q: '「榭」和「舫」分别对应哪种特征？',
      options: ['榭有窗，舫有台', '榭临水，舫似船', '榭多层，舫无顶', '榭用来藏书，舫用来祭祀'],
      answer: 1,
      why: '榭是建在水边或水上的敞屋，舫是船形的建筑，泊岸而不能行。',
    },
  ],
};

/* ============================== 生物 · 光合作用 ============================== */
const PHOTOSYNTHESIS = {
  steps: [
    {
      title: '一棵树几百公斤，物质从哪来',
      text: '树不吃东西，却从一粒种子长成几十米高。十七世纪以前，人们以为它吃的是土。可花盆里的土几乎没少——那多出来的重量，只能来自空气和水。',
      note: '先记住这个疑问：叶子到底在偷偷造什么？',
      chips: ['问题', '质量守恒'],
      items: [
        T('叶子不吃东西，却在长大', 500, 62, { size: 26, color: RED, rot: -1 }),
        T('那多出来的几百公斤，从哪来？', 500, 96, { size: 15, color: GRAY }),
        P('leaf', 300, 380, { scale: 1.9 }),
        P('sun', 110, 210, { scale: 0.95 }),
        T('一棵树', 170, 408, { size: 15, color: GRAY }),
      ],
    },
    {
      title: '二氧化碳从气孔进来',
      text: '叶子背面有成千上万个气孔，二氧化碳从空气里扩散进来。它不是“养料”，是造糖的碳骨架。',
      note: '气孔还能关：缺水时关闭，光合作用也跟着停。',
      chips: ['CO₂', '气孔'],
      items: [
        TAG('CO₂', 720, 220, { w: 104, h: 48, size: 20, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        T('从空气里扩散进来', 720, 260, { size: 14, color: GRAY }),
        A([660, 236], [440, 286], { color: BLUE, bend: -0.16 }),
        T('气孔', 540, 330, { size: 16, color: BLUE, rot: -8 }),
      ],
    },
    {
      title: '水从根上来',
      text: '根从土壤里吸水，经导管一路送到叶脉。水在光反应里被拆开，提供氢和电子，同时放出氧气。',
      note: '所以“浇水”不是为了解渴，是给光合作用送原料。',
      chips: ['H₂O', '导管'],
      items: [
        P('droplet', 640, 540, { scale: 0.95 }),
        T('根吸收 · 导管上运', 640, 566, { size: 14, color: GRAY }),
        A([600, 496], [430, 350], { color: '#4f8fb0', bend: 0.18 }),
      ],
    },
    {
      title: '光被叶绿素抓住',
      text: '叶绿体里的叶绿素只吸收红光和蓝紫光，把绿光反射出去——所以叶子看起来是绿的。被吸收的光，变成了化学能。',
      note: '绿光没被用上，这是“叶子为什么绿”的答案。',
      chips: ['叶绿体', '光'],
      items: [
        TAG('叶绿体', 300, 262, { w: 116, h: 46, size: 18, color: GREEN, fill: 'rgba(220,240,210,0.75)' }),
        A([168, 220], [240, 250], { color: GOLD, bend: 0.1 }),
        A([150, 180], [250, 230], { color: GOLD, bend: -0.08 }),
        T('光能 → 化学能', 300, 300, { size: 15, color: GOLD }),
      ],
    },
    {
      title: '叶绿体里其实有两步',
      text: '光反应先把水拆开，放出氧气、存下能量；卡尔文循环再用这些能量，把二氧化碳装成葡萄糖。前一步要光，后一步不直接需要光。',
      note: '两步接力，缺一步都没有糖。',
      chips: ['光反应', '卡尔文循环'],
      items: [
        TAG('光反应', 210, 486, { w: 120, h: 44, size: 17, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        TAG('卡尔文循环', 420, 486, { w: 140, h: 44, size: 17, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        A([272, 486], [348, 486], { color: BLUE, bend: -0.1 }),
        A([300, 392], [276, 450], { color: GREEN, bend: 0.12 }),
        T('在叶绿体里', 372, 424, { size: 13, color: GREEN }),
        T('拆水 · 放氧 · 存能量', 210, 520, { size: 13, color: GRAY }),
        T('用能量 · 固定 CO₂ · 造糖', 420, 520, { size: 13, color: GRAY }),
      ],
    },
    {
      title: '产物去哪了',
      text: '氧气从叶片扩散出去，成为动物呼吸的来源；葡萄糖留在植物体里，变成淀粉、纤维素，或者被吃掉。整条食物链的能量，从这里开始。',
      note: '光合作用是“把光变成食物”的唯一大规模入口。',
      chips: ['O₂', '葡萄糖'],
      items: [
        TAG('O₂', 760, 330, { w: 92, h: 46, size: 19, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        A([440, 300], [700, 326], { color: BLUE, bend: -0.12 }),
        TAG('葡萄糖', 760, 408, { w: 116, h: 46, size: 18, color: RED, fill: 'rgba(255,245,238,0.7)' }),
        A([440, 340], [700, 404], { color: RED, bend: 0.12 }),
        T('6CO₂ + 6H₂O —光/叶绿体→ C₆H₁₂O₆ + 6O₂', 500, 572, { size: 20, color: BLUE }),
        U(190, 584, 620, { color: BLUE, width: 2 }),
      ],
    },
  ],
  quiz: [
    {
      q: '光合作用制造的葡萄糖，碳元素来自哪里？',
      options: ['土壤里的有机质', '空气中的二氧化碳', '水里的氢', '叶绿体自己合成'],
      answer: 1,
      why: '碳来自 CO₂；水提供氢和电子，并放出氧气。土壤主要提供水和矿质元素。',
    },
    {
      q: '叶子为什么看起来是绿色的？',
      options: ['叶绿素把绿光都吸收了', '叶绿素反射绿光，吸收红光和蓝紫光', '叶子里的水是绿的', '绿光能量最低，被丢弃'],
      answer: 1,
      why: '叶绿素主要吸收红光和蓝紫光，绿光被反射或透过，所以人眼看到绿色。',
    },
    {
      q: '光反应和卡尔文循环的关系是？',
      options: ['两者都不需要光', '光反应供能，卡尔文循环用能量固定 CO₂', '卡尔文循环先发生', '两者完全独立'],
      answer: 1,
      why: '光反应拆水、放氧、产生 ATP 与 NADPH；卡尔文循环用它们把 CO₂ 变成糖。',
    },
  ],
};


const FULLSTACK = {
  steps: [
    {
      title: '一个项目，是五段链路接起来的',
      text: '你在手机上输入一个网址，几百毫秒后看见页面。这中间有五段：域名与 DNS、服务器、后端、数据库、前端。少一段，页面就打不开。',
      note: '先记住这五段，后面每一段都能单独深挖。',
      chips: ['全貌', '五段链路'],
      items: [
        T('从输入网址，到看见页面', 500, 62, { size: 26, color: RED, rot: -1 }),
        T('中间到底发生了什么', 500, 96, { size: 15, color: GRAY }),
        ...artFor({ id: 'programmer-fullstack', subjectId: 'programmer' }, 250, 232),
        T('① 域名 → ② 服务器 → ③ 后端 → ④ 数据库 → ⑤ 前端', 500, 356, { size: 17, color: BLUE }),
      ],
    },
    {
      title: '第一步：域名换成 IP',
      text: '域名是给人看的，机器只认 IP。DNS 就是互联网的电话簿：它在几百毫秒内把 shop.example.com 换成 203.0.113.10。',
      note: 'DNS 慢了，你会感觉“网站打不开”，其实是还没找到地址。',
      chips: ['DNS', '域名'],
      items: [
        TAG('域名 / DNS', 150, 470, { w: 140, h: 46, size: 16, color: GOLD, fill: 'rgba(255,248,225,0.7)' }),
        T('名字 → IP', 150, 506, { size: 13, color: GRAY }),
        T('203.0.113.10', 150, 400, { size: 14, color: GOLD }),
        A([150, 412], [150, 444], { color: GOLD, bend: 0 }),
        A([222, 470], [258, 470], { color: BLUE, bend: 0 }),
      ],
    },
    {
      title: '第二步：请求到达服务器',
      text: '服务器是一台一直开机的电脑，有公网 IP。Nginx 在 443 端口接住请求，做 TLS、转发、限流，再把请求交给后端进程。',
      note: '服务器不是“云”，是一台别人替你开着的机器。',
      chips: ['服务器', 'Nginx'],
      items: [
        TAG('服务器 · Nginx', 330, 470, { w: 150, h: 46, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.6)' }),
        T('接请求 · TLS · 转发', 330, 506, { size: 13, color: GRAY }),
        T('一直开机', 330, 400, { size: 13, color: GRAY }),
        A([406, 470], [438, 470], { color: BLUE, bend: 0 }),
      ],
    },
    {
      title: '第三步：后端写业务',
      text: '后端不负责好看，它负责对：校验参数、判断权限、计算结果、拼出 JSON。你看到的“加入购物车”，在这里被拆成库存、价格、优惠券三件事。',
      note: '前后端的分工：前端负责“看见”，后端负责“算对”。',
      chips: ['后端', '接口'],
      items: [
        TAG('后端', 510, 470, { w: 140, h: 46, size: 17, color: GREEN, fill: 'rgba(232,244,226,0.7)' }),
        T('校验 · 计算 · 拼 JSON', 510, 506, { size: 13, color: GRAY }),
        T('业务逻辑', 510, 400, { size: 13, color: GRAY }),
        A([586, 470], [618, 470], { color: BLUE, bend: 0 }),
      ],
    },
    {
      title: '第四步：数据库把数据留住',
      text: '数据库负责持久化：服务器重启、代码回滚，数据都还在。表结构、索引、事务，决定了系统能不能扛住并发。',
      note: '没有数据库，服务一重启，所有订单都归零。',
      chips: ['数据库', '持久化'],
      items: [
        TAG('数据库', 690, 470, { w: 140, h: 46, size: 17, color: RED, fill: 'rgba(255,245,238,0.7)' }),
        T('表 · 索引 · 事务', 690, 506, { size: 13, color: GRAY }),
        T('重启也不丢', 690, 400, { size: 13, color: GRAY }),
        A([766, 470], [798, 470], { color: BLUE, bend: 0 }),
      ],
    },
    {
      title: '第五步：前端把它画出来',
      text: '后端返回 JSON，前端用 HTML 搭结构、CSS 定样式、JS 处理交互，把数据变成你能点的页面。浏览器还会缓存、预加载、做首屏优化。',
      note: '同一份数据，前端决定它看起来值多少钱。',
      chips: ['前端', '渲染'],
      items: [
        TAG('前端', 870, 470, { w: 130, h: 46, size: 17, color: '#8a5fb0', fill: 'rgba(244,238,252,0.75)' }),
        T('HTML · CSS · JS', 870, 506, { size: 13, color: GRAY }),
        T('画成页面', 870, 400, { size: 13, color: GRAY }),
        PATH('M870 444 Q870 340 700 316', { stroke: '#8a5fb0', width: 2, opacity: 0.7 }),
        T('响应回来', 760, 330, { size: 13, color: '#8a5fb0' }),
      ],
    },
    {
      title: '本地与上线，差在哪',
      text: '本地开发是把五段链路缩到一台机器：浏览器 + 本机服务 + 本地数据库，用 localhost 访问。上线才需要域名、公网 IP、证书、反向代理和备份。',
      note: '先跑通链路，再谈优化。',
      chips: ['本地', '上线'],
      items: [
        T('本地：浏览器 + 本机服务 + 本地库', 500, 556, { size: 17, color: GRAY }),
        T('上线：域名 + 公网 IP + 证书 + 备份', 500, 586, { size: 17, color: RED }),
        U(300, 598, 400, { color: RED, width: 2 }),
      ],
    },
  ],
  quiz: [
    {
      q: '在浏览器输入域名后，第一步通常发生什么？',
      options: ['后端开始查数据库', 'DNS 把域名解析成 IP', '前端开始渲染 HTML', '服务器重启'],
      answer: 1,
      why: '浏览器先做 DNS 解析拿到 IP，才能建立 TCP/TLS 连接并发送 HTTP 请求。',
    },
    {
      q: '后端与前端的分工，下面哪种说法最准确？',
      options: ['后端负责样式，前端负责数据', '后端负责业务与数据，前端负责呈现与交互', '两者都只负责样式', '前端负责数据库'],
      answer: 1,
      why: '后端校验、计算、读写数据库并返回数据；前端把数据渲染成可交互的页面。',
    },
    {
      q: '本地开发与上线部署，最大的差别是？',
      options: ['本地不需要数据库', '上线需要域名、公网 IP、证书与反向代理', '本地不能写后端', '上线后不需要前端'],
      answer: 1,
      why: '本地把链路缩到一台机器用 localhost 访问；上线要补齐公网入口、证书、代理、备份等工程设施。',
    },
  ],
};


const ENGLISH_TENSE = {
  steps: [
    {
      title: '同一件事，时间不同，说法就不同',
      text: '时态不是背表格，是让听的人知道：这件事发生在什么时候、进行到哪一步。先看两个人在咖啡店的四句话。',
      note: '注意每句话里“时间”和“体”各在哪里。',
      chips: ['场景', '时间 + 体'],
      items: [
        T('同一件事，时间不同，说法就不同', 500, 64, { size: 24, color: RED, rot: -1 }),
        P('person', 120, 520, { hat: 'none', robe: '#5b7fa6', s: 0.9 }),
        P('person', 880, 520, { hat: 'none', robe: '#a8533f', s: 0.9 }),
        T('A', 120, 550, { size: 16, color: BLUE }),
        T('B', 880, 550, { size: 16, color: RED }),
      ],
    },
    {
      title: 'A：我每天喝咖啡',
      text: '一般现在时说的是习惯、规律、反复发生的事。时间词是 every morning，动词用原形 drink。',
      note: '看到 every day / usually，先想到一般现在时。',
      quote: 'I drink coffee every morning.',
      chips: ['一般现在时'],
      items: [
        NOTE(320, 180, 380, 104, ['I drink coffee', 'every morning.'], { color: BLUE, seed: 71, size: 19, lineHeight: 30 }),
        TAG('一般现在时', 320, 250, { w: 128, h: 34, size: 15, color: BLUE, fill: 'rgba(255,255,255,0.7)' }),
        T('习惯 · 规律', 320, 286, { size: 13, color: GRAY }),
        U(250, 162, 88, { color: BLUE }),
      ],
    },
    {
      title: 'B：我昨天喝了三杯',
      text: '一般过去时说的是已经结束、和现在没有直接关系的事。时间词是 yesterday，动词用过去式 drank。',
      note: 'yesterday / last week 出现，动词就要变过去式。',
      quote: 'I drank three cups yesterday.',
      chips: ['一般过去时'],
      items: [
        NOTE(680, 306, 380, 104, ['I drank three cups', 'yesterday.'], { color: RED, seed: 72, size: 19, lineHeight: 30 }),
        TAG('一般过去时', 680, 376, { w: 128, h: 34, size: 15, color: RED, fill: 'rgba(255,255,255,0.7)' }),
        T('已结束 · 与现在无关', 680, 412, { size: 13, color: GRAY }),
        U(600, 288, 66, { color: RED }),
      ],
    },
    {
      title: 'A：这周我已经喝太多了',
      text: '现在完成时说的不是“过去发生”，而是“过去发生的事，对现在有影响”。have + 过去分词，时间跨度延续到现在。',
      note: 'this week / already / yet，常常配现在完成时。',
      quote: 'I have drunk too much this week.',
      chips: ['现在完成时'],
      items: [
        NOTE(320, 432, 380, 104, ['I have drunk too much', 'this week.'], { color: GREEN, seed: 73, size: 18, lineHeight: 30 }),
        TAG('现在完成时', 320, 502, { w: 128, h: 34, size: 15, color: GREEN, fill: 'rgba(255,255,255,0.7)' }),
        T('对现在有影响', 320, 538, { size: 13, color: GRAY }),
        U(236, 414, 132, { color: GREEN }),
      ],
    },
    {
      title: '最后，把公式收起来',
      text: '时态 = 时间（过去 / 现在 / 将来）× 体（一般 / 进行 / 完成）。四个时间点、三种体，交叉出十几种说法；先记住最常见的六种就够用。',
      note: '先定时间，再定体，最后才选动词形式。',
      chips: ['一句话'],
      items: [
        T('时间 + 体 = 时态', 700, 486, { size: 30, color: RED }),
        U(590, 500, 220, { color: RED }),
        T('时间：过去 / 现在 / 将来', 700, 534, { size: 15, color: GRAY }),
        T('体：一般 / 进行 / 完成', 700, 560, { size: 15, color: GRAY }),
        S(930, 480, { size: 18, color: GOLD }),
      ],
    },
  ],
};


export const BOARD_LESSONS = {
  'physics-rocket': ROCKET_BOARD,
  'history-anshi': ANSHI,
  'chemistry-battery': BATTERY,
  'architect-pavilion': PAVILION,
  'biology-photosynthesis': PHOTOSYNTHESIS,
  'programmer-fullstack': FULLSTACK,
  'english-tense': ENGLISH_TENSE,
};

/* ------------------------------ 通用板书（其他知识点） ------------------------------ */
function wrap(str, n) {
  const text = String(str || '').replace(/\s+/g, '');
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out.slice(0, 6);
}

export function buildAutoBoard(point) {
  const title = point.title;
  const principles = (point.principles || []).slice(0, 3);
  const marks = ['①', '②', '③'];
  const cards = [];
  principles.forEach((p, i) => {
    const y = 312 + i * 92;
    cards.push(CARD(330, y, 432, 84, null, [`${marks[i]} ${wrap(p, 21)[0]}`, ...wrap(p, 21).slice(1)], {
      size: 16,
      lineColor: '#3c4756',
      fill: '#fdf8ec',
    }));
  });

  const steps = [
    {
      items: [
        T(title, 500, 122, { size: title.length > 7 ? 38 : 44, color: RED, rot: -1.5 }),
        L(500, 112, Math.min(300, 62 + title.length * 26), 40, { color: BLUE, rot: -3 }),
        T(point.hook, 500, 166, { size: 20, color: GRAY }),
        TAG(point.subject?.name || '', 500, 200, { w: 92, h: 28, color: BLUE, fill: 'rgba(255,255,255,0.55)', size: 15 }),
      ],
    },
    {
      items: [
        ...cards,
      ],
    },
    {
      items: [
        CARD(776, 470, 344, 300, '现实里', wrap(point.case, 17), {
          size: 16,
          lineColor: '#3c4756',
          fill: '#fbf4e4',
          titleSize: 19,
        }),

      ],
    },
    {
      items: [
        T('带走这一句', 500, 556, { size: 16, color: GRAY }),
        T(point.formula, 500, 592, { size: point.formula.length > 18 ? 22 : 27, color: RED }),
        U(500 - Math.min(230, point.formula.length * 7), 600, Math.min(460, point.formula.length * 14), { color: RED }),
        S(860, 578, { size: 24 }),
      ],
    },
  ];
  return { steps };
}
