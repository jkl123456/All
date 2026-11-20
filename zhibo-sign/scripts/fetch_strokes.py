"""预下载常用汉字的笔顺数据，之后断网也能按正确笔顺写。

为什么要预下载：第一次遇到某个字要联网取（约 1.4 秒），直播间断网或 unpkg 抽风
时就只能退回几何猜测。把常用字一次性抓下来（3500 字约 8MB），之后永久离线。

用法：
    python scripts/fetch_strokes.py            # 抓常用 3500 字
    python scripts/fetch_strokes.py --all      # 抓 hanzi-writer 全部（约 9000 字，30MB）
    python scripts/fetch_strokes.py 张三李四    # 只抓指定的字
    python scripts/fetch_strokes.py --check    # 只看现在有多少字已缓存
"""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.pipeline import hanzi  # noqa: E402

# 常用字表（一级字库 3500 字，覆盖日常人名的 99% 以上）。
COMMON = (
    "的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里"
    "后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第"
    "样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位"
    "分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理"
    "尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太"
    "新比才便夫再书部水像眼等体却加电主界门利海受听表德少克代员许稜先口由死安"
    "写性马光白或住难望教命花结乐色更拉东神记处让母父应直字场平报友关放至张认"
    "接告入笑内英军候民岁往何度山觉路带万男边风解叫任金快原吃妈变通师立象数四"
    "失满战远格士音轻目条呢病始达深完今提求清王化空业思切怎非找片罗钱紶吗语元"
    "喜曾离飞科言干流欢约各即指合反题必该论交终林请医晚制球决窢传画保读运及则"
    "房早院量苦火布品近坐产答星精视五连司巴奇管类未朋且婚台夜青北队久乎越观落"
    "尽形影红爸百令周吧识步希亚术留市半热送兴造谈容极随演收首根讲整式取照办强"
    "石古华諣拿计您装似足双妻尼转诉米称丽客南领节衣站黑刻统断福城故历惊脸选包"
    "紧争另建维绝树系伤示愿持千史谁准联妇纪基买志静阿诗独复痛消社算义竟确酒需"
    "单治卡幸兰念举仅钟怕共毛句息功官待究跟穿室易游程号居考突皮哪费倒价图具刚"
    "脑永歌响商礼细专黄块脚味灵改据般破引食仍存众注笔甚某沉血备习校默务土微娘"
    "须试怀料调广苏显赛查密议底列富梦错座参八除跑亮假印设线温虽掉京初养香停际"
    "致阳纸李纳验助激够严证帝饭忘趣支春集丈木研班普导顿睡展跳获艺六波察群皇段"
    "急庭创区奥器谢弟店否害草排背止组州朝封睛板角况曲馆育忙质河续哥呼若推境遇"
    "雨标姐充围案伦护冷警贝著雪索剧啊船险烟依斗值帮汉慢佛肯闻唱沙局伯族低玩资"
    "屋击速顾泪洲团圣旁堂兵七露园牛哭旅街劳型烈姑陈莫鱼异抱宝权鲁简态级票怪寻"
    "杀律胜份汽右洋范床舞秘午登楼贵吸责例追较职属渐左录丝牙党继托赶章智冲叶胡"
    "吉卖坚喝肉遗救修松临藏担戏善卫药悲敢靠伊村戴词森耳差短祖云规窗散迷油旧适"
    "乡架恩投弹铁博雷府压超负勒杂醒洗采毫嘴毕九冰既状乱景席珍童顶派素脱农疑练"
    "野按犯拍征坏骨余承置藏彩灯巨琴免环姆暗换技翻束增忍餐洛塞缺忆判欧层付阵玛"
    "批岛项狗休懂武革良恶恋委拥娜妙探呀营退摇弄桌熟诺宣银势奖宫忽套康供优课鸟"
    "喊降夏困刘罪亡鞋健模败伴守挥鲜财孤枪禁恐伙杰迹妹遍盖副坦牌江顺秋萨菜划授"
    "归浪凡预奶雄升编典袋莱含盛济蒙棋端腿招释介烧误"
)

# 百家姓：直播间的名字绝大多数是"姓 + 名"，姓氏必须先备好。
SURNAMES = (
    "王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于"
    "蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛"
    "闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤常温康施文牛樊葛邢安齐易乔伍"
    "庞颜倪庄聂章鲁岳翟殷詹申欧耿关兰焦俞左柳甘祝包宁尚符舒阮柯纪梅童凌毕单季裴霍"
    "涂成苗谷盛曲翁冉骆蓝路游辛靳管柴蒙鲍华喻祁蒲房滕屈饶解牟艾尤阳时穆农司卓古吉"
    "缪简车项连芦麦褚娄窦戚岑景党宫费卜冷晏席卫米柏宗瞿桂全佟应臧闵苟邬边卞姬师和"
    "仇栾隋商刁沙荣巫寇桑郎甄丛仲虞敖巩明佘池查麻苑迟邝官封谈匡鞠惠荆乐冀郁胥南班"
    "储原栗燕楚鄢劳谌奚皮粟冼蔺楼盘满闻位厉伊仝区郜海阚花权强帅屠豆朴盖练廉禹井祖"
    "漆巴丰支卿国狄平计索宣晋相初门云容敬来扈晁芮都普阙浦戈伏鹿薄邸雍辜羊阿乌母裘"
    "修邰赫杭况那宿鲜印逯隆茹诸战慕危玉银亢嵇公哈湛宾戎勾茅利於居揭干但尉冶斯元束"
    "檀衣展阴昝智幸奉植衡富尧闭由"
)

HERE = Path(__file__).resolve().parent
HANZI_DATA = "https://unpkg.com/hanzi-writer-data@2.0.1/"


def fetch(ch: str) -> bool:
    if not ("\u4e00" <= ch <= "\u9fff"):
        return False
    if (hanzi.CACHE / f"{ch}.json").exists():
        return True
    return hanzi.medians(ch) is not None


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--check" in sys.argv:
        have = len(list(hanzi.CACHE.glob("*.json"))) if hanzi.CACHE.exists() else 0
        print(f"已缓存 {have} 个字 -> {hanzi.CACHE}")
        return

    if "--all" in sys.argv:
        text = "".join(chr(c) for c in range(0x4E00, 0x9FA6))
    elif args:
        text = "".join(args)
    else:
        text = SURNAMES + COMMON

    chars = [c for c in dict.fromkeys(text) if "\u4e00" <= c <= "\u9fff"]
    done = sum(1 for c in chars if (hanzi.CACHE / f"{c}.json").exists())
    print(f"待处理 {len(chars)} 字（已缓存 {done}），输出到 {hanzi.CACHE}")
    hanzi.CACHE.mkdir(parents=True, exist_ok=True)

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(fetch, c): c for c in chars}
        for i, f in enumerate(as_completed(futs), 1):
            if f.result():
                ok += 1
            else:
                fail += 1
            if i % 200 == 0 or i == len(chars):
                print(f"  {i}/{len(chars)}  成功 {ok}  失败 {fail}")
    print(f"完成：成功 {ok}，失败 {fail}（失败的会在直播时再试一次）")


if __name__ == "__main__":
    main()
