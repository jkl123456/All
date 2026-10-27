const fs = require('fs');
let s = fs.readFileSync('src/data/extra.js', 'utf8').replace(/\r\n/g, '\n');
const anchor = `      formula: 'source → tokens → AST → IR → target',
      demo: { type: 'compiler' },
    },
  ],`;
if (!s.includes(anchor)) throw new Error('anchor extra');
s = s.replace(anchor, `      formula: 'source → tokens → AST → IR → target',
      demo: { type: 'compiler' },
    },
    {
      id: 'programmer-fullstack',
      title: '一个项目是怎么跑起来的',
      hook: '从输入网址，到看见页面',
      tags: ['全栈', '链路'],
      summary:
        '浏览器先用 DNS 把域名换成 IP，再与服务器建立连接；服务器上的后端接收请求、读写数据库，把结果返回前端；前端用 HTML/CSS/JS 渲染成页面。本地开发是把这条链路缩到一台机器，上线才需要域名、公网 IP 与证书。',
      case:
        '你在手机上打开 shop.example.com：DNS 返回 203.0.113.10，请求到达 Nginx，转发给 Node 服务；服务查 PostgreSQL，把 JSON 返回；React 渲染出商品列表。任何一环慢了，页面就白屏。',
      principles: [
        '域名是给人看的，DNS 负责换成 IP',
        '服务器是一台一直开机的电脑，Nginx 负责接请求并转发',
        '后端写业务逻辑：校验、计算、拼数据',
        '数据库负责持久化，服务重启数据还在',
        '前端拿到 JSON，用 HTML/CSS/JS 画成页面',
      ],
      formula: '域名 → 服务器 → 后端 → 数据库 → 前端',
      demo: { type: 'fullstack' },
    },
  ],`);
fs.writeFileSync('src/data/extra.js', s);

let t = fs.readFileSync('src/data/tiers.js', 'utf8').replace(/\r\n/g, '\n');
t = t.replace("  'programmer-network': 7,", "  'programmer-network': 7,\n  'programmer-fullstack': 6,");
fs.writeFileSync('src/data/tiers.js', t);
console.log('ok');
