/**
 * 手写关卡剧本：语文全部为分幕演出，另有若干重点学科的「示范关卡」。
 * state 里只写要变的量，其余交给引擎默认值。
 */

export function handBeatsOf(id) {
  return HAND_BEATS[id]?.beats || null;
}

export const HAND_BEATS = {
  /* ------------------------------- 语文 · 诗 ------------------------------- */
  'chinese-poem-jingye': {
    engine: 'scene',
    spec: { scene: 'room', tone: '#FF7096' },
    vars: [
      { key: 'moon', label: '月亮高度', min: 0.05, max: 1, step: 0.01, digits: 2 },
      { key: 'frost', label: '霜色浓度', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一幕',
        title: '屋里没有点灯',
        text: '半夜醒来，房里是黑的。地上却白了一块——不是灯，是月光从窗格里漏进来。',
        quote: '床前明月光',
        note: '注意：诗人先写“光”，还没有写“月”。',
        state: { moon: 0.32, beam: 0.16, frost: 0.05, pose: 0, stars: 0.7 },
        chips: ['月光', '屋内'],
      },
      {
        label: '第二幕',
        title: '他以为是霜',
        text: '第一反应不是抬头看月亮，而是“地上结了霜”。冷，是从这个错觉里先来的。',
        quote: '疑是地上霜',
        note: '一个“疑”字，把视觉写成了触觉。',
        state: { moon: 0.5, beam: 0.5, frost: 0.62, pose: 0.15, stars: 0.6 },
        chips: ['错觉', '通感'],
      },
      {
        label: '第三幕',
        title: '抬头，光有了来源',
        text: '抬头才看见月亮。刚刚那片白，忽然有了出处；冷，也有了出处。',
        quote: '举头望明月',
        state: { moon: 0.88, beam: 0.82, frost: 0.2, pose: 1, stars: 0.9 },
        chips: ['举头', '空间打开'],
      },
      {
        label: '第四幕',
        title: '低头，人回到千里之外',
        text: '视线从天上落回地面，心事从月亮落回故乡。全诗没有“愁”字，愁在动作里。',
        quote: '低头思故乡',
        note: '举头 → 低头，一开一合，二十个字就结束了。',
        state: { moon: 0.72, beam: 0.5, frost: 0.12, pose: 0, stars: 0.85 },
        chips: ['动作对举', '思乡'],
      },
    ],
    quiz: [
      {
        q: '“疑是地上霜”的“疑”，最接近下面哪种意思？',
        options: ['怀疑诗人在说谎', '误以为、好像', '犹豫着不敢看', '质问月亮'],
        answer: 1,
        why: '“疑”是“好像是”的意思：把月光错看成霜，冷的感觉就先到了。',
      },
      {
        q: '全诗四句的顺序，正确的是？',
        options: ['月光 → 疑霜 → 举头 → 低头', '举头 → 月光 → 低头 → 疑霜', '低头 → 举头 → 疑霜 → 月光', '疑霜 → 月光 → 低头 → 举头'],
        answer: 0,
        why: '先是地上的光，再是错觉，然后抬头看见月亮，最后低头想家。',
      },
      {
        q: '诗人为什么不直接写“我很想家”？',
        options: ['格律不允许出现“想”字', '怕同乡笑话', '让动作和物象替他说，读者自己体会', '因为当时还没有“想”这个字'],
        answer: 2,
        why: '一“举”一“低”，情绪由动作带出。直接说出来，反而薄了。',
      },
    ],
  },

  'chinese-poem-dengguanque': {
    engine: 'scene',
    spec: { scene: 'tower', tone: '#FFC94D' },
    vars: [{ key: 'lift', label: '登楼层数', min: 0, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一幕',
        title: '太阳落到山后面',
        text: '站在楼上往西看，白日正贴着山脊一点点沉下去。这是“尽”——不是消失，是走到尽头。',
        quote: '白日依山尽',
        state: { sun: 0.85, lift: 0.04, river: 0.4, birds: 0.1, haze: 0.3 },
        chips: ['近景', '落日'],
      },
      {
        label: '第二幕',
        title: '黄河往东流到海',
        text: '视线从西边的山转到东边的河。一个“入”字，把看不见的海也拉进了画面。',
        quote: '黄河入海流',
        note: '白日对黄河，依山尽对入海流——两句正好是一副对子。',
        state: { sun: 0.8, lift: 0.1, river: 1, birds: 0.2, haze: 0.4 },
        chips: ['远景', '对仗'],
      },
      {
        label: '第三幕',
        title: '想看得更远',
        text: '景物已经写到天边，诗人却还嫌不够。“欲穷千里目”，是一句愿望。',
        quote: '欲穷千里目',
        state: { sun: 0.72, lift: 0.55, river: 0.9, birds: 0.35, haze: 0.5 },
        chips: ['由景入理'],
      },
      {
        label: '第四幕',
        title: '那就再上一层',
        text: '想看得更远，办法只有一个：站得更高。前两句写景，后两句说理，理是从景里长出来的。',
        quote: '更上一层楼',
        note: '全诗没有一个生僻字，却完成了一次从风景到人生态度的跳跃。',
        state: { sun: 0.66, lift: 1, river: 0.85, birds: 0.5, haze: 0.45 },
        chips: ['哲理', '递进'],
      },
    ],
    quiz: [
      {
        q: '“白日依山尽，黄河入海流”主要用了什么手法？',
        options: ['夸张', '对仗', '拟人', '反问'],
        answer: 1,
        why: '白日对黄河，依山尽对入海流，字数、词性、结构都相对。',
      },
      {
        q: '后两句“欲穷千里目，更上一层楼”在全诗中的作用是？',
        options: ['继续写景', '由景入理，点出人生态度', '交代写作时间', '描写楼的高度'],
        answer: 1,
        why: '前两句写景，后两句说理；景是理的证据，理是景的升华。',
      },
      {
        q: '如果把“更上一层楼”只理解成爬楼梯，会丢失什么？',
        options: ['诗的韵脚', '诗句的对仗', '由具体动作引申出的普遍道理', '作者的籍贯'],
        answer: 2,
        why: '这句话之所以流传，是因为它从登楼说到了做事与做人。',
      },
    ],
  },

  'chinese-poetry': {
    engine: 'scene',
    spec: { scene: 'river', tone: '#FF7096' },
    vars: [
      { key: 'frost', label: '寒意', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'lamp', label: '渔火', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一幕 · 视觉',
        title: '月落',
        text: '月亮正在往下沉。不是“明月当空”，而是“月落”——光在退，夜色在涨。',
        quote: '月落乌啼霜满天',
        state: { moon: 0.12, night: 0.98, birds: 0.1, boat: 1, lamp: 0.35, tree: 1, frost: 0.2 },
        chips: ['月落', '视觉'],
      },
      {
        label: '第二幕 · 听觉',
        title: '乌啼',
        text: '看不见鸟，只听见叫声。视觉退下去，听觉顶上来，夜一下子有了空间。',
        quote: '乌啼',
        state: { moon: 0.08, night: 1, birds: 1, frost: 0.4, lamp: 0.4 },
        chips: ['乌啼', '听觉'],
      },
      {
        label: '第三幕 · 触觉',
        title: '霜满天',
        text: '霜不会真的满天飞，这是把冷写成了看得见的东西。三种感官，全打开了。',
        quote: '霜满天',
        note: '意象 = 物象 + 情感。冷的不是霜，是人。',
        state: { moon: 0.05, night: 1, birds: 0.4, frost: 1, lamp: 0.5 },
        chips: ['霜', '触觉'],
      },
      {
        label: '第四幕 · 一点暖色',
        title: '江枫渔火',
        text: '岸上有枫，江上有一盏渔火。整幅画唯一的暖色，反而把孤独衬得更清楚。',
        quote: '江枫渔火对愁眠',
        state: { moon: 0.03, night: 1, birds: 0.2, frost: 0.8, lamp: 1, boat: 1, tree: 1 },
        chips: ['冷暖对比', '渔火'],
      },
    ],
    quiz: [
      {
        q: '“霜满天”里的“霜”，最主要的作用是？',
        options: ['说明当时在下霜', '把寒意写成可见的物象', '交代季节是秋天', '押韵需要'],
        answer: 1,
        why: '霜是意象，不是气象记录：它把看不见的冷，变成了看得见的东西。',
      },
      {
        q: '“江枫渔火”中那一点渔火，为什么反而让人更觉孤独？',
        options: ['渔火太暗', '暖色与寒冷形成对比，衬出旅人的孤单', '渔火代表危险', '说明有人陪伴'],
        answer: 1,
        why: '整幅冷色调里唯一的暖光，是别人的灯，不是自己的家。',
      },
      {
        q: '下面哪一组词语最接近“意象”的定义？',
        options: ['物象 + 情感', '景物 + 地名', '修辞 + 韵脚', '叙事 + 议论'],
        answer: 0,
        why: '意象不是纯景物，它一定带着诗人的情绪与选择。',
      },
    ],
  },

  /* ------------------------------ 语文 · 成语 ------------------------------ */
  'chinese-idiom-shouzhu': {
    engine: 'scene',
    spec: { scene: 'field', tone: '#FF7096' },
    vars: [{ key: 'hare', label: '兔子出现的概率', min: 0, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一幕',
        title: '一声闷响',
        text: '宋国的农夫正在田里除草，听见树桩那边一声闷响：一只兔子撞上去，倒下了。',
        quote: '田中有株，兔走触株，折颈而死',
        state: { hare: 0.12, farmer: 0.9, stump: 0.7, sun: 0.7, dust: 0.1 },
        chips: ['偶然', '起因'],
      },
      {
        label: '第二幕',
        title: '白捡的一顿肉',
        text: '没花一点力气，就得到一只兔子。他把兔子拎回家，心里记住的不是“运气”，是“树桩”。',
        quote: '因释其耒而守株',
        state: { hare: 0.72, farmer: 0.5, stump: 0.9, sun: 0.65, dust: 0.3 },
        chips: ['侥幸', '归因'],
      },
      {
        label: '第三幕',
        title: '第二天，他坐在树桩旁',
        text: '锄头靠在树边，人坐在桩旁。他不再种田，只等下一只兔子。',
        quote: '冀复得兔',
        state: { hare: 0, farmer: 1, stump: 1, sun: 0.45, dust: 0.5 },
        chips: ['守株', '放弃本业'],
      },
      {
        label: '第四幕',
        title: '草长过了禾苗',
        text: '兔子没有再来。田荒了。韩非用这个故事，讽刺那些拿旧办法应付新情况的人。',
        quote: '兔不可复得，而身为宋国笑',
        note: '偶然事件 → 错误归纳 → 荒废本业。',
        state: { hare: 0, farmer: 0.85, stump: 1, sun: 0.3, dust: 0.9 },
        chips: ['寓意', '韩非子'],
      },
    ],
    quiz: [
      {
        q: '“守株待兔”出自哪部书？',
        options: ['《论语》', '《韩非子》', '《庄子》', '《史记》'],
        answer: 1,
        why: '出自《韩非子·五蠹》，原本是用来批评“以先王之政治当世之民”的。',
      },
      {
        q: '这个农夫犯的核心错误是？',
        options: ['不该吃兔子', '把一次偶然当成了可以重复的规律', '不该把锄头放在树边', '没有把树桩挖掉'],
        answer: 1,
        why: '一次侥幸被当成了必然，于是他放弃了真正能带来收成的事。',
      },
      {
        q: '下面哪种做法最像“守株待兔”？',
        options: ['每天练习投篮', '背完一本单词书', '押中一次题之后，之后只背那一套题', '换一种方法再试一次'],
        answer: 2,
        why: '把一次偶然的成功当成方法，就是守株待兔。',
      },
    ],
  },

  'chinese-idiom-kezhou': {
    engine: 'scene',
    spec: { scene: 'river', tone: '#FF7096' },
    vars: [{ key: 'drift', label: '船走的距离', min: 0, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一幕',
        title: '剑掉进了江里',
        text: '楚人坐船渡江，佩剑从船边滑落，直直沉下去。水面合上，像什么都没发生。',
        quote: '楚人有涉江者，其剑自舟中坠于水',
        state: { boat: 1, drift: 0.02, sword: 0.55, notch: 0, night: 0.55, tree: 0.7, lamp: 0.7 },
        chips: ['起因', '落水'],
      },
      {
        label: '第二幕',
        title: '他在船上刻了个记号',
        text: '他不慌，掏出小刀，在剑落水的地方刻了一道记号：“剑是从这儿掉的。”',
        quote: '遽契其舟曰：是吾剑之所从坠',
        note: '注意：记号刻在船上，船是会动的。',
        state: { boat: 1, drift: 0.1, sword: 0.75, notch: 1, night: 0.6, tree: 0.8, lamp: 0.75 },
        chips: ['刻舟', '参照系'],
      },
      {
        label: '第三幕',
        title: '船一直在走',
        text: '船顺流而下。记号跟着船走，剑却留在原处。两者之间的距离，越拉越开。',
        quote: '舟已行矣，而剑不行',
        state: { boat: 1, drift: 0.9, sword: 0.85, notch: 1, night: 0.7, tree: 0.9, lamp: 0.6 },
        chips: ['船动', '剑静'],
      },
      {
        label: '第四幕',
        title: '按记号下水，当然找不到',
        text: '船靠岸了，他照着记号跳下去。水很清，剑不在那里。《吕氏春秋》问：这不是很糊涂吗？',
        quote: '求剑若此，不亦惑乎',
        note: '参照系选错，后面的推理再严谨也没用。',
        state: { boat: 1, drift: 1, sword: 1, notch: 1, night: 0.8, tree: 1, lamp: 0.5 },
        chips: ['变化', '寓意'],
      },
    ],
    quiz: [
      {
        q: '楚人找不到剑的根本原因是？',
        options: ['水太深', '记号刻错了位置', '船在动而剑不动，参照系选错了', '剑被鱼吃了'],
        answer: 2,
        why: '记号相对于船是固定的，但船相对于剑在移动，所以记号早已失效。',
      },
      {
        q: '“刻舟求剑”出自？',
        options: ['《韩非子》', '《吕氏春秋》', '《战国策》', '《左传》'],
        answer: 1,
        why: '出自《吕氏春秋·察今》，原文评论“舟已行矣，而剑不行”。',
      },
      {
        q: '这个故事在今天最像下面哪种情况？',
        options: ['用去年的价格表做今年的预算', '每天坚持记账', '出门前看天气预报', '把钥匙放在固定位置'],
        answer: 0,
        why: '条件变了还用旧坐标，就是刻舟求剑。',
      },
    ],
  },

  /* ------------------------------ 语文 · 字与文 ------------------------------ */
  'chinese-hanzi': {
    engine: 'glyph',
    spec: {
      char: '休',
      stages: ['甲骨文', '金文', '小篆', '隶书', '楷书'],
      parts: [
        ['亻', '人', '形旁：与人有关'],
        ['木', '树', '形旁：与树木有关'],
      ],
      note: '会意：人靠在树边，就是休息',
    },
    vars: [],
    beats: [
      {
        label: '第一幕',
        title: '先有画，再有字',
        text: '最早的汉字是画出来的。“日”是一个圆加一点，“山”是三座峰。看到形，就猜到义。',
        state: { reveal: 0.28, focus: 0 },
        chips: ['象形'],
      },
      {
        label: '第二幕',
        title: '把两幅画拼起来',
        text: '一个人，一棵树。人靠在树边——这个动作被画成一个字：“休”。这叫会意。',
        state: { reveal: 0.55, focus: 1 },
        chips: ['会意', '休'],
      },
      {
        label: '第三幕',
        title: '形声字占了大半',
        text: '后来有了更省力的办法：一半表义，一半表音。“江”用“氵”表水，用“工”表音。',
        state: { reveal: 0.82, focus: 1 },
        chips: ['形声', '形旁 + 声旁'],
      },
      {
        label: '第四幕',
        title: '三千年，一笔没断',
        text: '从甲骨文到楷书，字形一直在简化，但那条“人靠着树”的思路还在。',
        state: { reveal: 1, focus: 0 },
        chips: ['演变', '隶变'],
      },
    ],
    quiz: [
      {
        q: '“休”属于哪种造字法？',
        options: ['象形', '指事', '会意', '形声'],
        answer: 2,
        why: '“人”与“木”两个部件合起来表示“休息”，是会意字。',
      },
      {
        q: '现代汉字中数量最多的是？',
        options: ['象形字', '指事字', '会意字', '形声字'],
        answer: 3,
        why: '形声字约占现代汉字的 80% 以上，一半表义、一半表音。',
      },
      {
        q: '汉字演变的大致顺序是？',
        options: ['甲骨文 → 金文 → 小篆 → 隶书 → 楷书', '金文 → 甲骨文 → 楷书 → 小篆', '小篆 → 甲骨文 → 隶书 → 楷书', '甲骨文 → 小篆 → 金文 → 楷书'],
        answer: 0,
        why: '隶变是从古文字到今文字的关键一步，之后字形基本稳定。',
      },
    ],
  },

  'chinese-couplet': {
    engine: 'mirror',
    spec: {
      rows: [
        [
          { text: '两个', role: '数量' },
          { text: '黄鹂', role: '名词' },
          { text: '鸣', role: '动词' },
          { text: '翠柳', role: '名词' },
        ],
        [
          { text: '一行', role: '数量' },
          { text: '白鹭', role: '名词' },
          { text: '上', role: '动词' },
          { text: '青天', role: '名词' },
        ],
      ],
      labelA: '出句',
      labelB: '对句',
      note: '数量对数量 · 名词对名词 · 动词对动词',
    },
    vars: [],
    beats: [
      {
        label: '第一幕',
        title: '先把两句话摆在一起',
        text: '“两个黄鹂鸣翠柳，一行白鹭上青天。”读一遍，像照镜子。',
        state: { reveal: 0.4, focus: 0 },
        chips: ['对仗', '杜甫'],
      },
      {
        label: '第二幕',
        title: '数量对数量',
        text: '“两个”对“一行”，都是数量词。位置一样，功能一样。',
        state: { reveal: 0.6, focus: 0 },
        chips: ['数量'],
      },
      {
        label: '第三幕',
        title: '名词对名词，动词对动词',
        text: '黄鹂对白鹭（鸟），鸣对上（动作），翠柳对青天（颜色 + 名词）。',
        state: { reveal: 0.85, focus: 2 },
        chips: ['词性相对'],
      },
      {
        label: '第四幕',
        title: '美在对称，也美在开阔',
        text: '一低一高，一近一远。形式上的对称，把视野也撑开了。',
        state: { reveal: 1, focus: 3 },
        chips: ['意境', '空间'],
      },
    ],
    quiz: [
      {
        q: '对仗最基本的要求不包括下面哪一项？',
        options: ['字数相等', '词性相对', '结构相同', '必须押同一个韵'],
        answer: 3,
        why: '对仗讲的是句内对称，押韵是另一套规则。',
      },
      {
        q: '“两个黄鹂鸣翠柳”中，与“鸣”相对的字是？',
        options: ['一', '行', '上', '天'],
        answer: 2,
        why: '“鸣”与“上”都是动词，处在相同位置。',
      },
      {
        q: '对仗带来的阅读感受，最准确的是？',
        options: ['节奏整齐、画面开阔', '句子变长', '意思变模糊', '情感更激烈'],
        answer: 0,
        why: '对称的句式产生稳定的节奏，配合高低远近的意象，画面被打开。',
      },
    ],
  },

  'chinese-rhetoric': {
    engine: 'mapping',
    spec: {
      headLeft: '本体（眼前的）',
      headRight: '喻体 / 另一种感官',
      left: [
        { word: '荷香', role: '嗅觉' },
        { word: '月光', role: '视觉' },
        { word: '琴声', role: '听觉' },
      ],
      right: [
        { word: '渺茫的歌声', role: '听觉' },
        { word: '流水', role: '视觉 + 听觉' },
        { word: '薄纱', role: '触觉' },
      ],
      note: '本体 + 相似点 + 喻体：相似点是桥',
    },
    vars: [],
    beats: [
      {
        label: '第一幕',
        title: '把陌生的接到熟悉的上面',
        text: '“荷香”看不见摸不着。朱自清说它像“远处高楼上渺茫的歌声”，你立刻懂了那种若有若无。',
        quote: '香气仿佛远处高楼上渺茫的歌声似的',
        state: { reveal: 0.5, focus: 0 },
        chips: ['比喻', '相似点'],
      },
      {
        label: '第二幕',
        title: '桥必须搭得住',
        text: '相似点是“若有若无、断断续续”。如果换成“像一锅红烧肉”，桥就断了。',
        state: { reveal: 0.7, focus: 0 },
        chips: ['相似点', '边界'],
      },
      {
        label: '第三幕',
        title: '通感：让感官串门',
        text: '嗅觉被写成听觉，这叫通感。感官换了，感觉反而更准。',
        quote: '微风过处，送来缕缕清香，仿佛远处高楼上渺茫的歌声似的',
        state: { reveal: 0.9, focus: 0 },
        chips: ['通感', '跨感官'],
      },
      {
        label: '第四幕',
        title: '不是所有比喻都成立',
        text: '喻体要比本体更具体、更可感。用抽象解释抽象，等于没解释。',
        state: { reveal: 1, focus: 1 },
        chips: ['可感性', '修辞的边界'],
      },
    ],
    quiz: [
      {
        q: '“香气仿佛远处高楼上渺茫的歌声”用了什么修辞？',
        options: ['比喻 + 通感', '拟人', '夸张', '排比'],
        answer: 0,
        why: '把嗅觉写成听觉，既是比喻，也是通感。',
      },
      {
        q: '比喻成立的关键是？',
        options: ['喻体必须很美', '本体与喻体之间有相似点', '字数要一样', '必须出现“像”字'],
        answer: 1,
        why: '没有相似点，两个事物硬接在一起，读者只会更糊涂。',
      },
      {
        q: '下面哪一句最接近通感？',
        options: ['月亮像玉盘', '他的声音很亮', '他跑得像风一样快', '花儿红了'],
        answer: 1,
        why: '“亮”本来是视觉词，用来写声音，是听觉与视觉的串门。',
      },
    ],
  },

  'chinese-classical': {
    engine: 'sentence',
    spec: {
      text: '吾尝终日|而|思矣，不如须臾|之|所学也。',
      markChars: ['而', '之'],
      tags: [
        ['而', '连词 · 表修饰'],
        ['之', '助词 · 取消句子独立性'],
      ],
      gloss: '“而”连接状语与动词，“之”让“须臾所学”成为一个整体',
      note: '虚词不写内容，只写关系',
    },
    vars: [],
    beats: [
      {
        label: '第一幕',
        title: '先把句子读断',
        text: '“吾尝终日而思矣”——我曾经整天思考。“而”在这里不译，只表示“终日”是“思”的方式。',
        quote: '吾尝终日而思矣',
        state: { reveal: 0.55, focus: 0 },
        chips: ['而', '修饰'],
      },
      {
        label: '第二幕',
        title: '一个“之”，改变结构',
        text: '“须臾之所学”——片刻学到的东西。“之”把“须臾”和“所学”绑成一个名词性短语。',
        quote: '不如须臾之所学也',
        state: { reveal: 0.8, focus: 1 },
        chips: ['之', '取消独立性'],
      },
      {
        label: '第三幕',
        title: '虚词一错，句意就散',
        text: '把“而”读成“却”，句子就变成“整天思考却学习”，逻辑全反了。',
        state: { reveal: 1, focus: 0 },
        chips: ['关系', '逻辑'],
      },
    ],
    quiz: [
      {
        q: '“吾尝终日而思矣”中的“而”表示？',
        options: ['转折', '修饰', '并列', '承接'],
        answer: 1,
        why: '“终日”修饰“思”，说明思考的状态，不译。',
      },
      {
        q: '“须臾之所学”中的“之”作用是？',
        options: ['代词，指代前文', '动词，往', '助词，取消句子独立性', '助词，的'],
        answer: 2,
        why: '“之”使“须臾所学”成为名词性短语，作“如”的宾语。',
      },
    ],
  },

  /* ------------------------------- 示范 · 数学 ------------------------------- */
  'math-parabola': {
    engine: 'curve',
    spec: { mode: 'parabola', xLabel: '水平距离', yLabel: '高度', tone: '#5B9DFF' },
    vars: [
      { key: 'a', label: '开口大小 a', min: 0.4, max: 2.4, step: 0.05, digits: 2 },
      { key: 't', label: '球的位置', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一步',
        title: '球出手了',
        text: '水平方向匀速，竖直方向被重力拉着匀减速。两条直线般的运动，合起来是一条弯的线。',
        state: { a: 0.8, b: 2.6, t: 0.15 },
        chips: ['分解运动'],
      },
      {
        label: '第二步',
        title: '这条弯线就是抛物线',
        text: '把时间 t 消掉，得到 y 与 x 的二次关系。它的图像一定是抛物线。',
        quote: 'y = x·tanθ − gx² / (2v₀²cos²θ)',
        state: { a: 1.1, b: 3.0, t: 0.5 },
        chips: ['二次函数'],
      },
      {
        label: '第三步',
        title: '换一个出手角度',
        text: '拖动 a 看开口变化：开口越窄，球飞得越高、落得越近。',
        state: { a: 2.0, b: 3.6, t: 0.78 },
        chips: ['变量'],
      },
      {
        label: '第四步',
        title: '最高点在哪',
        text: '顶点就是竖直速度为零的那一刻。找到它，就找到了抛体运动的“分界点”。',
        state: { a: 1.0, b: 3.0, t: 0.5 },
        chips: ['顶点', '对称'],
      },
    ],
    quiz: [
      {
        q: '斜抛运动的轨迹是？',
        options: ['直线', '圆', '抛物线', '双曲线'],
        answer: 2,
        why: '水平匀速、竖直匀变速，消去时间后得到二次函数，图像是抛物线。',
      },
      {
        q: '抛物线的最高点对应？',
        options: ['水平速度为零', '竖直速度为零', '加速度为零', '速度为零'],
        answer: 1,
        why: '最高点竖直分速度减为零，之后开始下落；水平分速度始终不变。',
      },
    ],
  },

  'physics-pendulum': {
    engine: 'motion',
    spec: { mode: 'pendulum', tone: '#9B7BFF' },
    vars: [
      { key: 'length', label: '摆长 L (m)', min: 0.25, max: 1.6, step: 0.01, digits: 2 },
      { key: 'gravity', label: '重力 g (m/s²)', min: 1.6, max: 20, step: 0.1, digits: 1 },
    ],
    beats: [
      {
        label: '第一步',
        title: '让它摆起来',
        text: '同一个摆，摆得高一点、低一点，来回一次的时间几乎不变——这就是等时性。',
        state: { length: 1.0, gravity: 9.8, amp: 22 },
        chips: ['等时性'],
      },
      {
        label: '第二步',
        title: '只跟摆长有关',
        text: '把摆长加倍，周期变成原来的 √2 倍。公式里没有质量，也没有振幅。',
        quote: 'T = 2π√(L/g)',
        state: { length: 1.6, gravity: 9.8, amp: 22 },
        chips: ['周期', '√L'],
      },
      {
        label: '第三步',
        title: '换到月球上',
        text: '重力变小，摆得更慢。同一个钟摆，在月球上一天会走慢很多。',
        state: { length: 1.0, gravity: 1.6, amp: 22 },
        chips: ['重力', 'g'],
      },
      {
        label: '第四步',
        title: '一秒，是这样被守住的',
        text: '摆长约 0.994 米的单摆，周期正好 2 秒。惠更斯用它把日误差从 15 分钟降到 15 秒。',
        state: { length: 0.994, gravity: 9.8, amp: 18 },
        chips: ['摆钟', '惠更斯'],
      },
    ],
    quiz: [
      {
        q: '单摆的周期与什么无关？',
        options: ['摆长', '重力加速度', '摆球质量', '以上都有关'],
        answer: 2,
        why: 'T = 2π√(L/g)，公式里没有质量项，这叫等时性。',
      },
      {
        q: '把摆长变为原来的 4 倍，周期变为？',
        options: ['2 倍', '4 倍', '1/2', '不变'],
        answer: 0,
        why: '周期与摆长的平方根成正比，√4 = 2。',
      },
    ],
  },

  'physics-refraction': {
    engine: 'motion',
    spec: { mode: 'refraction', tone: '#9B7BFF' },
    vars: [
      { key: 'n2', label: '水的折射率 n₂', min: 1.01, max: 2.4, step: 0.01, digits: 2 },
      { key: 'angle', label: '入射角 θ₁', min: 1, max: 88, step: 1, digits: 0, unit: '°' },
    ],
    beats: [
      {
        label: '第一步',
        title: '光进入水里会拐弯',
        text: '斜着射入水面，光会向法线靠拢。垂直射入时，不偏折。',
        state: { n2: 1.33, angle: 20 },
        chips: ['折射', '法线'],
      },
      {
        label: '第二步',
        title: '角度变大，偏得更多',
        text: '入射角增大，折射角也增大，但永远小于入射角（从空气到水）。',
        quote: 'n₁ sinθ₁ = n₂ sinθ₂',
        state: { n2: 1.33, angle: 58 },
        chips: ['斯涅尔定律'],
      },
      {
        label: '第三步',
        title: '反过来：全反射',
        text: '如果光从水射向空气，角度超过临界角，就再也出不去了。光纤靠的就是这个。',
        state: { n2: 2.2, angle: 78 },
        chips: ['临界角', '全反射'],
      },
      {
        label: '第四步',
        title: '所以筷子看起来断了',
        text: '眼睛沿着折射后的直线回溯，看到的位置比实际更高——筷子在水面处“折断”了。',
        state: { n2: 1.33, angle: 44 },
        chips: ['视深', '错觉'],
      },
    ],
    quiz: [
      {
        q: '光从空气斜射入水中，折射角与入射角的关系是？',
        options: ['折射角更大', '折射角更小', '相等', '无法判断'],
        answer: 1,
        why: '水是光密介质，光速更慢，光线向法线偏折。',
      },
      {
        q: '发生全反射的条件是？',
        options: ['从光疏到光密，且角度够大', '从光密到光疏，且入射角大于临界角', '垂直入射', '任何情况都可能'],
        answer: 1,
        why: '必须从光密介质射向光疏介质，且入射角超过临界角。',
      },
    ],
  },

  'chemistry-water': {
    engine: 'orbit',
    spec: { mode: 'molecule', tone: '#2FE0A8' },
    vars: [{ key: 'angle', label: '键角 H–O–H', min: 90, max: 180, step: 0.5, digits: 1, unit: '°' }],
    beats: [
      {
        label: '第一步',
        title: '两个氢，一个氧',
        text: '氧原子有两对孤对电子，它们把两个氢“压”下来，键角不是 180°。',
        state: { angle: 180 },
        chips: ['共价键'],
      },
      {
        label: '第二步',
        title: '104.5°，一个折角',
        text: '真实键角约 104.5°。分子成了 V 形，正负电荷中心不重合。',
        state: { angle: 104.5 },
        chips: ['V 形', '极性'],
      },
      {
        label: '第三步',
        title: '极性带来的连锁反应',
        text: '极性分子之间形成氢键：沸点高、表面张力大、能溶解盐和糖。',
        state: { angle: 104.5 },
        chips: ['氢键', '溶解性'],
      },
      {
        label: '第四步',
        title: '如果它是直线',
        text: '把键角推到 180°，电荷中心重合，水就会像二氧化碳一样，变成非极性分子。',
        state: { angle: 178 },
        chips: ['反事实'],
      },
    ],
    quiz: [
      {
        q: '水分子呈 V 形、键角约 104.5°，主要原因是？',
        options: ['氢原子太小', '氧原子有两对孤对电子，排斥成键电子对', '水分子之间有氢键', '氧的原子量更大'],
        answer: 1,
        why: '孤对电子对成键电子对的排斥更强，把键角压到 104.5°。',
      },
      {
        q: '水能溶解食盐，主要因为水是？',
        options: ['非极性分子', '极性分子', '酸性物质', '小分子'],
        answer: 1,
        why: '极性水分子能包围并分离离子，形成水合离子。',
      },
    ],
  },

  'chemistry-acidbase': {
    engine: 'ph',
    spec: { tone: '#2FE0A8' },
    vars: [
      { key: 'ph', label: '溶液 pH', min: 0, max: 14, step: 0.1, digits: 1 },
      { key: 'base', label: '加入碱的量', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一步',
        title: '胃里太酸了',
        text: '胃酸的主要成分是盐酸。pH 很低时，H⁺ 浓度高，黏膜被刺激。',
        state: { ph: 1.8, base: 0 },
        chips: ['酸', 'H⁺'],
      },
      {
        label: '第二步',
        title: '吃一片胃药',
        text: '氢氧化铝与盐酸反应，生成氯化铝和水。pH 开始上升。',
        quote: 'Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O',
        state: { ph: 4.5, base: 0.5 },
        chips: ['中和', '盐 + 水'],
      },
      {
        label: '第三步',
        title: 'pH 是对数尺',
        text: 'pH 从 3 到 2，不是“酸了一点”，而是 H⁺ 浓度变成了 10 倍。',
        state: { ph: 6.5, base: 0.8 },
        chips: ['对数', '10 倍'],
      },
      {
        label: '第四步',
        title: '中和不是“消灭酸”',
        text: 'H⁺ 与 OH⁻ 结合成水，酸和碱都还在，只是以盐的形式存在。',
        state: { ph: 7.2, base: 1 },
        chips: ['H⁺ + OH⁻ → H₂O'],
      },
    ],
    quiz: [
      {
        q: 'pH 从 4 降到 3，氢离子浓度变为原来的？',
        options: ['1/10', '2 倍', '10 倍', '不变'],
        answer: 2,
        why: 'pH = −lg[H⁺]，每降 1，浓度增大 10 倍。',
      },
      {
        q: '盐酸与氢氧化钠反应生成？',
        options: ['NaCl + H₂O', 'Na₂O + H₂', 'NaOH + HCl', 'NaCl + H₂'],
        answer: 0,
        why: 'H⁺ + OH⁻ → H₂O，剩下的 Na⁺ 与 Cl⁻ 组成 NaCl。',
      },
    ],
  },

  'biology-photosynthesis': {
    engine: 'cycle',
    spec: {
      tone: '#79E86B',
      center: '光合作用',
      nodes: [
        { label: '阳光', sub: '光能' },
        { label: '叶绿体', sub: '场所' },
        { label: 'CO₂ + H₂O', sub: '原料' },
        { label: '葡萄糖', sub: '产物' },
        { label: 'O₂', sub: '副产物' },
      ],
      notes: [
        '光能被叶绿素捕获，转换成化学能',
        '叶绿体是反应的“车间”，类囊体膜上完成光反应',
        '二氧化碳和水是最初的原料',
        '糖是能量的储存形式，也是植物的“身体”',
        '氧气是水被分解后的“废料”，却养活了整个星球',
      ],
    },
    vars: [{ key: 'speed', label: '光照强度', min: 0, max: 1.6, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一步',
        title: '一片叶子在干活',
        text: '叶子把阳光、二氧化碳和水变成糖，同时放出氧气。整件事在叶绿体里完成。',
        state: { focus: 0, speed: 0.2 },
        chips: ['光反应'],
      },
      {
        label: '第二步',
        title: '光越强，反应越快',
        text: '在一定范围内，光照增强，光合速率上升；超过饱和点，再强的光也用不上。',
        state: { focus: 1, speed: 1.2 },
        chips: ['限制因子'],
      },
      {
        label: '第三步',
        title: '原料从哪来',
        text: 'CO₂ 从气孔进来，水从根部上来。缺水或气孔关闭，光合就会停。',
        state: { focus: 2, speed: 0.8 },
        chips: ['气孔', '水分'],
      },
      {
        label: '第四步',
        title: '产物去了哪',
        text: '葡萄糖变成淀粉储存，或变成纤维素搭起身体；氧气从气孔离开。',
        state: { focus: 3, speed: 1 },
        chips: ['产物', '能量'],
      },
    ],
    quiz: [
      {
        q: '光合作用的场所是？',
        options: ['线粒体', '叶绿体', '细胞核', '液泡'],
        answer: 1,
        why: '叶绿体含有叶绿素，是光合作用的核心场所。',
      },
      {
        q: '光合作用释放的氧气来自？',
        options: ['二氧化碳', '水', '葡萄糖', '空气'],
        answer: 1,
        why: '光反应中水被分解，氧气作为副产物释放。',
      },
    ],
  },

  'geography-seasons': {
    engine: 'seasons',
    spec: { tone: '#56D9C7' },
    vars: [
      { key: 'month', label: '地球公转位置', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'tilt', label: '地轴倾角', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一步',
        title: '地球是斜着转的',
        text: '地轴与公转平面大约有 23.5° 的夹角。这个倾斜，是四季的根本原因。',
        state: { month: 0.25, tilt: 1 },
        chips: ['黄赤交角'],
      },
      {
        label: '第二步',
        title: '直射点来回移动',
        text: '夏至直射北回归线，冬至直射南回归线。直射意味着单位面积获得更多能量。',
        state: { month: 0.5, tilt: 1 },
        chips: ['直射点'],
      },
      {
        label: '第三步',
        title: '把倾角调到 0',
        text: '如果地轴不倾斜，直射点永远在赤道，四季就消失了。',
        state: { month: 0.5, tilt: 0.05 },
        chips: ['反事实'],
      },
      {
        label: '第四步',
        title: '远近不是主因',
        text: '一月初地球离太阳最近，北半球却是冬天。决定冷热的，是角度，不是距离。',
        state: { month: 0.78, tilt: 1 },
        chips: ['常见误解'],
      },
    ],
    quiz: [
      {
        q: '四季形成的主要原因是？',
        options: ['地球离太阳的远近变化', '地轴倾斜导致太阳高度角变化', '太阳亮度变化', '大气层厚度变化'],
        answer: 1,
        why: '黄赤交角约 23.5°，使太阳直射点南北移动，改变太阳高度角与昼长。',
      },
      {
        q: '北半球夏至时，太阳直射？',
        options: ['赤道', '北回归线', '南回归线', '北极点'],
        answer: 1,
        why: '夏至太阳直射北回归线（约 23.5°N），北极圈内出现极昼。',
      },
    ],
  },

  'history-dujiangyan': {
    engine: 'timeline',
    spec: {
      mode: 'press',
      tone: '#FFB86B',
      stages: ['鱼嘴', '飞沙堰', '宝瓶口'],
      notes: [
        '鱼嘴把岷江分成内江与外江：内江引水灌溉，外江排洪',
        '飞沙堰在洪水时溢流，把泥沙和多余的水甩回外江',
        '宝瓶口是人工凿开的引水口，控制进入成都平原的水量',
      ],
      formula: '无坝引水 · 自动分沙 · 自动泄洪',
    },
    vars: [{ key: 'step', label: '工程环节', min: 0, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一步',
        title: '先把江水分开',
        text: '鱼嘴站在江心，把岷江一分为二。内江引水，外江排洪。',
        state: { step: 0.2 },
        chips: ['鱼嘴', '分流'],
      },
      {
        label: '第二步',
        title: '让泥沙自己走',
        text: '飞沙堰在洪水期溢流，利用弯道环流把泥沙甩向外江，不用人挖。',
        state: { step: 0.55 },
        chips: ['飞沙堰', '排沙'],
      },
      {
        label: '第三步',
        title: '把口子凿在正确的位置',
        text: '宝瓶口窄而深，像瓶颈一样限制进水量。水多时漫过飞沙堰，水少时全部进渠。',
        state: { step: 0.85 },
        chips: ['宝瓶口', '控量'],
      },
      {
        label: '第四步',
        title: '两千年还在用',
        text: '三者合起来是一套自动控制系统：不用闸门，不用电，靠地形和水力自己工作。',
        state: { step: 1 },
        chips: ['系统', '可持续'],
      },
    ],
    quiz: [
      {
        q: '都江堰“鱼嘴”的主要作用是？',
        options: ['分水', '排沙', '控量', '发电'],
        answer: 0,
        why: '鱼嘴把岷江分为内江与外江，实现分流。',
      },
      {
        q: '都江堰最了不起的地方是？',
        options: ['用了大量钢铁', '靠地形与水力自动运行，无需闸门', '完全阻止了洪水', '只灌溉不排洪'],
        answer: 1,
        why: '分水、排沙、控量三套机制靠地形自动完成，维护成本极低。',
      },
    ],
  },

  'programmer-binarytree': {
    engine: 'graph',
    spec: { mode: 'tree', tone: '#00E1FF' },
    vars: [{ key: 'step', label: '插入节点数', min: 0.06, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一步',
        title: '先放一个根',
        text: '第一个数成为根。之后每个数都和当前节点比：小的往左，大的往右。',
        state: { step: 0.2 },
        chips: ['二叉搜索树'],
      },
      {
        label: '第二步',
        title: '每比一次，砍掉一半',
        text: '树越平衡，查找路径越短。n 个节点的树，高度约为 log₂n。',
        state: { step: 0.55 },
        chips: ['O(log n)'],
      },
      {
        label: '第三步',
        title: '如果它长歪了',
        text: '按顺序插入 10、20、30……树会退化成一条链，查找变成 O(n)。',
        state: { step: 0.85 },
        chips: ['退化', '平衡'],
      },
      {
        label: '第四步',
        title: '平衡是一种纪律',
        text: '红黑树、AVL 树通过旋转维持平衡，把最坏情况也压在对数级。',
        state: { step: 1 },
        chips: ['旋转', '最坏情况'],
      },
    ],
    quiz: [
      {
        q: '二叉搜索树的查找时间复杂度，平均是？',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
        answer: 1,
        why: '每次比较都能排除一半子树，平均复杂度为 O(log n)。',
      },
      {
        q: '什么情况下二叉搜索树会退化成链表？',
        options: ['数据随机', '按有序顺序插入', '节点太少', '使用递归'],
        answer: 1,
        why: '有序插入会让每个新节点都挂在同一侧，树高变成 n。',
      },
    ],
  },

  'chef-maillard': {
    engine: 'heat',
    spec: { mode: 'pan', tone: '#FFB86B' },
    vars: [
      { key: 'heat', label: '锅温', min: 0.1, max: 1, step: 0.01, digits: 2 },
      { key: 'time', label: '加热时间', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一步',
        title: '先把锅烧热',
        text: '锅温不够时，肉只是在脱水，颜色发灰，香气也出不来。',
        state: { heat: 0.3, time: 0.15 },
        chips: ['脱水'],
      },
      {
        label: '第二步',
        title: '140°C 之后，反应开始',
        text: '氨基酸与还原糖反应，生成褐色物质和上百种香气分子——美拉德反应。',
        state: { heat: 0.7, time: 0.4 },
        chips: ['美拉德', '褐变'],
      },
      {
        label: '第三步',
        title: '温度与时间要一起给',
        text: '高温短时间得到焦香外壳、内部仍嫩；低温久煎则整体变柴。',
        state: { heat: 0.9, time: 0.55 },
        chips: ['火候', '权衡'],
      },
      {
        label: '第四步',
        title: '别把它烧成碳',
        text: '超过 200°C，反应走向焦化甚至碳化，苦味盖过香气。',
        state: { heat: 1, time: 0.95 },
        chips: ['上限', '焦化'],
      },
    ],
    quiz: [
      {
        q: '煎牛排表面变褐、产生香气，主要是？',
        options: ['焦糖化', '美拉德反应', '蛋白质凝固', '水分蒸发'],
        answer: 1,
        why: '氨基酸与还原糖在高温下反应，生成褐色物质与香气分子。',
      },
      {
        q: '锅温不够时下肉，最可能的结果是？',
        options: ['外焦里嫩', '大量出水、肉质变柴', '香气更浓', '完全不变'],
        answer: 1,
        why: '温度不足以触发美拉德反应，肉只是在脱水。',
      },
    ],
  },

  'architect-light': {
    engine: 'mech',
    spec: { mode: 'sun', tone: '#56D9C7' },
    vars: [{ key: 'altitude', label: '太阳高度角', min: 0.05, max: 1, step: 0.01, digits: 2 }],
    beats: [
      {
        label: '第一步',
        title: '冬天，太阳很低',
        text: '冬至正午太阳高度角最低，阳光几乎是斜着射进屋子，能照到很深的地方。',
        state: { altitude: 0.28 },
        chips: ['冬至', '低角度'],
      },
      {
        label: '第二步',
        title: '夏天，太阳很高',
        text: '夏至正午太阳高度角大，光被屋檐挡住，屋里反而凉快。',
        state: { altitude: 0.85 },
        chips: ['夏至', '遮阳'],
      },
      {
        label: '第三步',
        title: '屋檐要多深',
        text: '屋檐深度按夏季高度角设计：挡住夏天，放过冬天。这是一次几何计算。',
        state: { altitude: 0.6 },
        chips: ['挑檐', '几何'],
      },
      {
        label: '第四步',
        title: '坐北朝南的理由',
        text: '北半球南向窗冬季得热最多、夏季最少。朝向本身就是一套被动式节能系统。',
        state: { altitude: 0.4 },
        chips: ['朝向', '被动节能'],
      },
    ],
    quiz: [
      {
        q: '北半球住宅“坐北朝南”，主要是为了？',
        options: ['避开北风并获取冬季日照', '方便看风水', '减少造价', '增加建筑面积'],
        answer: 0,
        why: '南向窗在冬季获得最多低角度直射光，夏季则被屋檐遮挡。',
      },
      {
        q: '屋檐深度主要依据哪个角度确定？',
        options: ['冬季正午太阳高度角', '夏季正午太阳高度角', '年平均气温', '当地纬度的一半'],
        answer: 1,
        why: '要挡住夏季高角度的直射光，同时放过冬季低角度的阳光。',
      },
    ],
  },

  'designer-contrast': {
    engine: 'layout',
    spec: { mode: 'contrast', tone: '#FF7AD9' },
    vars: [
      { key: 'scale', label: '标题／正文比', min: 0, max: 1, step: 0.01, digits: 2 },
      { key: 'contrast', label: '正文对比度', min: 0, max: 1, step: 0.01, digits: 2 },
    ],
    beats: [
      {
        label: '第一步',
        title: '所有字一样大',
        text: '左边：标题和正文几乎一个分量。视线没有落点，读者不知道先看哪。',
        state: { scale: 0.05, contrast: 0.7 },
        chips: ['无层级'],
      },
      {
        label: '第二步',
        title: '把标题放大',
        text: '标题放大到 1.6 倍以上，阅读顺序立刻出现。',
        state: { scale: 0.55, contrast: 0.7 },
        chips: ['大小'],
      },
      {
        label: '第三步',
        title: '再把正文压暗',
        text: '正文不需要抢戏。降低明度，信息还在，注意力回来了。',
        state: { scale: 0.55, contrast: 0.28 },
        chips: ['明度'],
      },
      {
        label: '第四步',
        title: '一个屏，一个焦点',
        text: '最强的对比只留一个。处处强调，等于没有强调。',
        state: { scale: 0.8, contrast: 0.35 },
        chips: ['焦点', '克制'],
      },
    ],
    quiz: [
      {
        q: '建立视觉层级，最有效的手段是？',
        options: ['加更多边框', '制造大小、粗细、明度的差异', '使用更多颜色', '增加动画'],
        answer: 1,
        why: '层级来自差异，不来自装饰。',
      },
      {
        q: '一屏之内，最强的对比应该？',
        options: ['越多越好', '只保留一个', '完全不要', '放在页脚'],
        answer: 1,
        why: '焦点只有一个，否则视线无处落脚。',
      },
    ],
  },
};

export const HAND_QUIZ = {};
