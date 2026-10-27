/**
 * 角色肖像：全部由 SVG 手工拼出的扁平插画，保证离线也能保持统一美术风格。
 */
const PORTRAITS = {
  alan: {
    bg: ['#2e5e58', '#102f2f'],
    skin: '#eac6a2',
    hair: '#333e38',
    clothes: '#365f58',
    trim: '#d8b66f',
    eye: '#26342f',
    hairStyle: 'short',
    hat: 'band',
    accessory: 'earring',
    blush: '#d78f7c',
  },
  sage: {
    bg: ['#4e6964', '#172e2e'],
    skin: '#e7c7a7',
    hair: '#e6e1d4',
    clothes: '#697d7b',
    trim: '#d8c28e',
    eye: '#354540',
    hairStyle: 'long',
    hat: 'crown',
    accessory: 'beard',
    blush: '#c99682',
  },
  compass: {
    bg: ['#4b6578', '#172935'],
    skin: '#e6c4a3',
    hair: '#b7b6ad',
    clothes: '#3c5668',
    trim: '#d8be7e',
    eye: '#273945',
    hairStyle: 'swept',
    hat: 'none',
    accessory: 'spectacles',
    blush: '#c9937e',
  },
  smith: {
    bg: ['#6d4e32', '#2c1e17'],
    skin: '#d9a77f',
    hair: '#9e5636',
    clothes: '#5f4734',
    trim: '#d0a35e',
    eye: '#382a20',
    hairStyle: 'short',
    hat: 'goggles',
    accessory: 'soot',
    blush: '#b57459',
  },
  alchemist: {
    bg: ['#57486e', '#251d33'],
    skin: '#e5c2a7',
    hair: '#735d8e',
    clothes: '#4e4264',
    trim: '#acd7bd',
    eye: '#34293f',
    hairStyle: 'bob',
    hat: 'none',
    accessory: 'roundGlasses',
    blush: '#cb8f91',
  },
  gardener: {
    bg: ['#476b3e', '#1c3322'],
    skin: '#d8aa84',
    hair: '#5c4530',
    clothes: '#5c7c4e',
    trim: '#e4bd74',
    eye: '#2d3c28',
    hairStyle: 'bun',
    hat: 'straw',
    accessory: 'freckles',
    blush: '#ca856d',
  },
  sailor: {
    bg: ['#3f6174', '#172b38'],
    skin: '#e0b896',
    hair: '#303b43',
    clothes: '#3d5666',
    trim: '#e0c98e',
    eye: '#293640',
    hairStyle: 'waves',
    hat: 'sailor',
    accessory: 'earring',
    blush: '#ce8b7b',
  },
  merchant: {
    bg: ['#705339', '#2c2018'],
    skin: '#d9ad84',
    hair: '#4a3526',
    clothes: '#70553a',
    trim: '#dfb267',
    eye: '#36271b',
    hairStyle: 'short',
    hat: 'turban',
    accessory: 'moustache',
    blush: '#bd7d5f',
  },
  player: {
    bg: ['#356b67', '#163333'],
    skin: '#e6bea0',
    hair: '#4e392d',
    clothes: '#3e6e66',
    trim: '#e4c17e',
    eye: '#2b3430',
    hairStyle: 'waves',
    hat: 'none',
    accessory: 'scarf',
    blush: '#d48f7b',
  },
  scholar: {
    bg: ['#455d52', '#172823'],
    skin: '#e3c3a3',
    hair: '#42362f',
    clothes: '#53645b',
    trim: '#d5c08f',
    eye: '#2d322d',
    hairStyle: 'bun',
    hat: 'none',
    accessory: 'spectacles',
    blush: '#c9917d',
  },
  miya: {
    bg: ['#6d583e', '#2d241a'],
    skin: '#ecc4a1',
    hair: '#c4a16d',
    clothes: '#64513c',
    trim: '#d9b973',
    eye: '#3a2d20',
    hairStyle: 'braid',
    hat: 'goggles',
    accessory: 'smudge',
    blush: '#cf8d7e',
  },
  child: {
    bg: ['#446879', '#1b2d35'],
    skin: '#ecc5a4',
    hair: '#3c3530',
    clothes: '#4f7483',
    trim: '#e5c884',
    eye: '#2c3537',
    hairStyle: 'buns',
    hat: 'none',
    accessory: 'sparkle',
    blush: '#db8e88',
  },
  ahe: {
    bg: ['#4f723d', '#1d3020'],
    skin: '#e0b38c',
    hair: '#57412e',
    clothes: '#607b46',
    trim: '#e5be7b',
    eye: '#2d3926',
    hairStyle: 'braid',
    hat: 'straw',
    accessory: 'flower',
    blush: '#cf8b72',
  },
  lingbo: {
    bg: ['#3d6477', '#152a35'],
    skin: '#e1ba99',
    hair: '#2f3940',
    clothes: '#405d6d',
    trim: '#ddc68b',
    eye: '#26343c',
    hairStyle: 'short',
    hat: 'sailor',
    accessory: 'scarf',
    blush: '#cd8a7b',
  },
  luxu: {
    bg: ['#6e5439', '#2c2119'],
    skin: '#dfb68f',
    hair: '#3f3128',
    clothes: '#72583d',
    trim: '#e1b66b',
    eye: '#36281d',
    hairStyle: 'swept',
    hat: 'none',
    accessory: 'moustache',
    blush: '#c08063',
  },
};

let portraitId = 0;

function hair(config) {
  const h = config.hair;
  switch (config.hairStyle) {
    case 'long':
      return `<path d="M31 59c-3-24 10-39 29-39 20 0 32 16 29 39l-3 33H34Z" fill="${h}"/><path d="M37 51c3-13 12-22 24-22 11 0 20 8 23 22-7-2-12-7-15-11-5 7-18 11-32 11Z" fill="${h}"/>`;
    case 'bun':
      return `<circle cx="60" cy="21" r="9" fill="${h}"/><path d="M37 51c0-15 9-25 23-25 15 0 24 10 24 26-7-4-12-9-15-14-6 8-16 11-32 13Z" fill="${h}"/>`;
    case 'buns':
      return `<circle cx="34" cy="35" r="10" fill="${h}"/><circle cx="86" cy="35" r="10" fill="${h}"/><path d="M36 54c0-15 9-25 24-25s24 10 24 26c-6-5-11-9-14-14-5 8-16 11-34 13Z" fill="${h}"/>`;
    case 'bob':
      return `<path d="M32 57c-2-22 10-36 28-36 19 0 30 14 28 37l-4 17H37Z" fill="${h}"/><path d="M38 48c2-12 10-20 22-20 11 0 20 7 22 19-8-3-13-7-17-12-5 7-15 11-27 13Z" fill="${h}"/>`;
    case 'braid':
      return `<path d="M35 55c-1-18 9-30 25-30s25 12 25 30c0 12-5 19-8 29-3-3-6-5-10-5 5-6 7-14 7-23-5 5-10 8-14 9-8 2-16 1-25-10Z" fill="${h}"/><path d="M80 68c6 3 9 8 8 14s-6 10-8 15c-3-4-4-9-2-13-3-4-3-8 2-16Z" fill="${h}"/><path d="m82 94 4 7-5-1-2 5-2-8Z" fill="${config.trim}"/>`;
    case 'swept':
      return `<path d="M35 55c-3-19 8-31 25-31 19 0 29 12 27 32-7-1-13-3-20-8-3 5-15 9-32 7Z" fill="${h}"/><path d="M78 27c8 2 12 7 15 16-6-5-11-7-18-7Z" fill="${h}"/>`;
    case 'waves':
    default:
      return `<path d="M35 56c-2-20 9-32 26-32 18 0 27 12 26 30-6-1-10-4-15-8-4 7-16 10-37 10Z" fill="${h}"/><path d="M40 39c7 2 12 1 17-3 6 5 12 8 21 8-5-11-12-16-22-16-8 0-14 4-16 11Z" fill="${h}"/>`;
  }
}

function accessory(config) {
  switch (config.accessory) {
    case 'beard':
      return `<path d="M44 72c2 16 8 25 16 28 9-3 15-12 16-28-4 6-9 9-16 9-6 0-12-3-16-9Z" fill="#e8e4da"/><path d="M51 65c3 2 7 2 10 0M63 65c3 2 7 2 9 0" stroke="#d7d0c0" stroke-width="2" fill="none"/><path d="M54 82c4 3 8 3 12 0" stroke="#a8947e" stroke-width="1.2" fill="none"/>`;
    case 'spectacles':
      return `<g fill="none" stroke="#c9ad70" stroke-width="1.7"><rect x="43" y="54" width="14" height="10" rx="4"/><rect x="63" y="54" width="14" height="10" rx="4"/><path d="M57 58h6M43 57l-6 1M77 57l5 1"/></g>`;
    case 'roundGlasses':
      return `<g fill="none" stroke="#c8b16f" stroke-width="1.6"><circle cx="49" cy="59" r="7"/><circle cx="71" cy="59" r="7"/><path d="M56 59h8M42 58l-5 1M78 58l5 1"/></g>`;
    case 'moustache':
      return `<path d="M49 75c4-4 8-3 11 0 3-3 7-4 11 0-2 4-6 5-11 3-5 2-9 1-11-3Z" fill="${config.hair}"/>`;
    case 'freckles':
      return `<g fill="#b8795f" opacity=".7"><circle cx="44" cy="68" r="1"/><circle cx="48" cy="71" r=".8"/><circle cx="72" cy="68" r="1"/><circle cx="76" cy="71" r=".8"/></g>`;
    case 'soot':
      return `<path d="M73 67c3 1 5 3 5 6-3 0-6-1-8-3Z" fill="#5c493a" opacity=".4"/>`;
    case 'smudge':
      return `<path d="M41 69c2 1 4 2 4 4-3 0-5-1-6-3Z" fill="#806951" opacity=".45"/>`;
    case 'earring':
      return `<circle cx="84" cy="65" r="2.3" fill="${config.trim}"/><path d="m84 67-1 4" stroke="${config.trim}" stroke-width="1"/>`;
    case 'flower':
      return `<g transform="translate(83 33)"><circle r="4" fill="#e9b7aa"/><circle cx="-5" cy="0" r="3" fill="#e9b7aa"/><circle cx="5" cy="0" r="3" fill="#e9b7aa"/><circle cx="0" cy="-5" r="3" fill="#e9b7aa"/><circle r="2" fill="#e4c46f"/></g>`;
    case 'sparkle':
      return `<path d="m91 43 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" fill="#ecd28e"/>`;
    case 'scarf':
      return `<path d="M35 83c10 6 17 9 25 9s17-3 25-9l4 9c-10 8-19 12-29 12S19 97 17 92Z" fill="${config.trim}"/><path d="M74 94c6 2 10 5 11 10l-9 3c0-4-2-7-6-9Z" fill="${config.trim}" opacity=".8"/>`;
    default:
      return '';
  }
}

function hat(config) {
  switch (config.hat) {
    case 'straw':
      return `<ellipse cx="60" cy="34" rx="39" ry="9" fill="#cba662"/><path d="M38 33c2-15 10-21 22-21 13 0 21 7 23 21-14 3-31 3-45 0Z" fill="#d7b56f"/><path d="M36 33c15 4 33 4 49 0" stroke="#9d7a45" stroke-width="2" fill="none"/><path d="M53 13c2 7 3 13 2 20" stroke="#b48d50" stroke-width="2" fill="none"/>`;
    case 'sailor':
      return `<path d="M37 34c2-14 11-21 23-21 13 0 22 7 24 21-14 4-33 4-47 0Z" fill="#e3ddc7"/><path d="M35 34h51v5c-16 4-35 4-51 0Z" fill="#374c58"/><path d="M51 13h18l3 7H48Z" fill="#d8c383"/><path d="M60 4v5" stroke="#d8c383" stroke-width="2"/>`;
    case 'turban':
      return `<path d="M35 32c1-15 11-23 25-23 15 0 25 8 26 23-17 4-35 4-51 0Z" fill="#c9a36d"/><path d="M38 27c7 2 13 1 18-4 5 5 12 7 22 5 2 3 4 5 7 6-14 5-35 5-49 0Z" fill="#d8b77d"/><path d="M78 14c7 1 12 5 14 12l-7 2Z" fill="#b78e59"/><circle cx="60" cy="15" r="3" fill="#8f6f4b"/>`;
    case 'goggles':
      return `<path d="M34 30c14-3 38-3 53 0l-2 10H36Z" fill="#4e4034"/><g fill="none" stroke="#d5b978" stroke-width="2"><circle cx="48" cy="34" r="7"/><circle cx="72" cy="34" r="7"/><path d="M55 34h10"/></g>`;
    case 'crown':
      return `<path d="m38 30 4-12 8 7 10-12 9 12 9-7 4 12Z" fill="#b79c62"/><path d="M38 30c15 4 30 4 47 0" stroke="#dfc98d" stroke-width="2" fill="none"/><circle cx="60" cy="16" r="2.5" fill="#dbe6d6"/>`;
    case 'band':
      return `<path d="M36 35c16-5 33-5 48 0l-1 6c-15-4-31-4-46 0Z" fill="${config.trim}"/><path d="m81 32 8-8 3 2-6 10Z" fill="${config.trim}" opacity=".9"/>`;
    default:
      return '';
  }
}

export function portrait(name = 'player', className = '') {
  const config = PORTRAITS[name] ?? PORTRAITS.player;
  const uid = `p${++portraitId}`;
  const bgId = `bg-${uid}`;
  const skinId = `sk-${uid}`;
  return `<div class="portrait portrait--${name} ${className}" aria-hidden="true">
    <svg viewBox="0 0 120 120" role="presentation">
      <defs>
        <radialGradient id="${bgId}" cx="38%" cy="30%" r="85%">
          <stop offset="0" stop-color="${config.bg[0]}"/>
          <stop offset="1" stop-color="${config.bg[1]}"/>
        </radialGradient>
        <linearGradient id="${skinId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${config.skin}"/>
          <stop offset="1" stop-color="${config.skin}" stop-opacity=".82"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#${bgId})"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="${config.trim}" stroke-opacity=".16" stroke-width="1"/>
      <path d="M12 105c12-18 27-27 48-27s37 9 48 27" fill="${config.clothes}"/>
      <path d="M27 120c3-20 14-31 33-34 19 3 30 14 33 34Z" fill="${config.clothes}"/>
      <path d="M50 83c1 8 20 8 21 0l5 3c-2 11-8 17-16 17s-14-6-16-17Z" fill="${config.trim}" opacity=".22"/>
      <rect x="53" y="69" width="14" height="21" rx="7" fill="${config.skin}" opacity=".82"/>
      ${hair(config)}
      <ellipse cx="60" cy="57" rx="23" ry="26" fill="url(#${skinId})"/>
      <ellipse cx="37" cy="61" rx="4.2" ry="6" fill="${config.skin}"/>
      <ellipse cx="83" cy="61" rx="4.2" ry="6" fill="${config.skin}"/>
      <path d="M45 55c2-1.5 5-1.5 7-.5M68 54.5c2-1 5-1 7 .5" stroke="${config.hair}" stroke-width="2" stroke-linecap="round" fill="none"/>
      <ellipse cx="48" cy="59" rx="2" ry="2.4" fill="${config.eye}"/>
      <ellipse cx="72" cy="59" rx="2" ry="2.4" fill="${config.eye}"/>
      <circle cx="48.6" cy="58.4" r=".6" fill="#fff" opacity=".8"/>
      <circle cx="72.6" cy="58.4" r=".6" fill="#fff" opacity=".8"/>
      <path d="M59 60c-1 4-1 6 2 6.5" stroke="${config.skin}" stroke-width="1.3" fill="none" opacity=".7"/>
      <path d="M52 74c4 3 12 3 16-1" stroke="#9d5c57" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".7"/>
      <ellipse cx="41" cy="68" rx="5" ry="2.6" fill="${config.blush}" opacity=".18"/>
      <ellipse cx="79" cy="68" rx="5" ry="2.6" fill="${config.blush}" opacity=".18"/>
      ${accessory(config)}
      ${hat(config)}
      <circle cx="99" cy="99" r="3" fill="${config.trim}" opacity=".3"/>
      <path d="m20 35 2-5 5-2-5-2-2-5-2 5-5 2 5 2Z" fill="${config.trim}" opacity=".25"/>
    </svg>
  </div>`;
}

export function portraitForGuardian(guardian) {
  return portrait(guardian?.avatar ?? 'alan');
}
