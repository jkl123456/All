/**
 * 无外部素材依赖的手绘感 SVG 图标库。
 */
const P = {
  map: '<path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z"/><path d="M8.5 4v13.5M15.5 6.5V20"/>',
  build: '<path d="m14 4 6 6-3 3-6-6z"/><path d="m12.5 9.5-8 8L3 21l3.5-1.5 8-8"/><path d="m15 6 3 3"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9.5 13h5"/>',
  book: '<path d="M4 5.5c3-1 5.5-.8 8 1v13c-2.5-1.8-5-2-8-1z"/><path d="M20 5.5c-3-1-5.5-.8-8 1v13c2.5-1.8 5-2 8-1z"/><path d="M7 9c1.4 0 2.6.2 3.5.7"/>',
  quest: '<path d="M7 3h10v18l-5-3-5 3z"/><path d="M9.5 8h5M9.5 11.5h5"/>',
  hammer: '<path d="m13 3 6 4-2.2 3.2-6-4z"/><path d="m11.5 7.5-3 2 4 10.5 2.2-1-2.7-7.3 2-1.5z"/><path d="M4 20.5 6.5 17"/>',
  axe: '<path d="M14.5 4c3 0 5 2 5.5 4l-7 3-2-2z"/><path d="m13 8.5-8 12"/><path d="m4 19.5 2.5 2"/>',
  pickaxe: '<path d="M3 6c5-3 13-3 18 0-4-1-6 1-9 3S6 7 3 6Z"/><path d="m12 9-4 12"/><path d="m10 10 4 1"/>',
  sword: '<path d="m5 19 2-5 9-9 3-2-2 3-9 9z"/><path d="m7 17-3 3M4 16l4 4"/>',
  star: '<path d="m12 3 2.6 5.7L21 10l-4.8 4.6 1.2 6.4-5.4-3-5.4 3 1.2-6.4L3 10l6.4-1.3z"/>',
  seed: '<path d="M12 21c5-3 7-8 6-13-5-1-10 1-12 6-1 3.6 2 6.4 6 7Z"/><path d="M8 18c1.5-4 4-7 7-9"/>',
  grow: '<path d="M12 21V10"/><path d="M12 12C8 12 5 9 5 5c4 0 7 3 7 7Z"/><path d="M12 9c4 0 7-3 7-7-4 0-7 3-7 7Z"/><path d="M8 21h8"/>',
  leaf: '<path d="M4 20c0-9 5-15 16-16 1 11-5 16-14 16"/><path d="M4 20c3-5 7-8 12-10"/>',
  boat: '<path d="M3 14h18l-3 5H7z"/><path d="M12 3v11M12 4c3.5 1.5 6 4 8 7h-8z"/>',
  talk: '<path d="M4 5h11a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-5 3z"/><path d="M18 8h1a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-1l-3 2v-4"/><path d="M8 11h5"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  muted: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  spark: '<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2.2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9.5c2.5-2 6-1 6 1.4 0 2.2-2.8 2.1-5.4 2.8-2 .6-1.9 3 .4 3.4 1.6.3 3.3-.3 4.3-1.3"/><path d="M12 7v10"/>',
  insight: '<path d="M12 3c4 0 7 2.7 7 6.3 0 2.5-1.5 4.2-3 5.7-.9.9-1.2 1.7-1.2 3H9.2c0-1.3-.3-2.1-1.2-3-1.5-1.5-3-3.2-3-5.7C5 5.7 8 3 12 3Z"/><path d="M9.5 21h5M9 18h6"/>',
  energy: '<path d="m13 2-8 12h6l-1 8 9-13h-6z"/>',
  wood: '<path d="m4 8 3-3 13 4-3 3z"/><path d="M7 5v12l13 4V10z"/><path d="M10 10.5c2 0 3.5 1 4 2.5"/><ellipse cx="8.5" cy="8.5" rx="1.6" ry="1.2" transform="rotate(20 8.5 8.5)"/>',
  stone: '<path d="m4 15 2-7 5-3 6 2 3 8-5 5H8z"/><path d="m6 8 6 4 5-2M12 12v8"/>',
  fiber: '<path d="M5 20c3-7 5-11 11-16M9 20c1-5 4-9 9-11M4 17c4 0 7-1 9-4M15 20c1-3 3-5 5-6"/>',
  ore: '<path d="m5 17 1-7 5-5 7 3 2 8-6 5z"/><path d="m6 10 5 2 7-4M11 12l3 9"/><path d="m13 7 1 5"/>',
  crystal: '<path d="m12 2 5 6-2 12-3 2-4-10z"/><path d="m12 2-4 8 4 3 5-5M8 10l7 12"/>',
  food: '<path d="M5 8h14c0 7-2.5 11-7 11S5 15 5 8Z"/><path d="M9 8c0-3 2-5 5-5M8 3c.5-1 .3-2-1-2"/><path d="M3 8h18"/>',
  workshop: '<path d="M3 10 12 3l9 7v10H3z"/><path d="M3 12h18M9 20v-5h6v5"/><path d="m15 7 2 2"/>',
  forge: '<path d="M4 20V9l5-3v4l5-4v4l6-2v12z"/><path d="M8 20v-5h5v5M6 10h1"/><path d="M19 4v4M17 6h4"/>',
  cottage: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6M8 16h8"/><path d="M16 6V3h2v5"/>',
  bridge: '<path d="M3 16c4-7 14-7 18 0M3 16v4M21 16v4M6 13v7M12 10v10M18 13v7"/><path d="M5 19h14"/>',
  market: '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6M4 9c0 2 3 2 4 0 0 2 3 2 4 0 0 2 3 2 4 0 0 2 3 2 4 0"/>',
  campfire: '<path d="M12 3c1 4-3 4-1 7 2-1 2-2 2-4 3 2 5 5 5 8a6 6 0 0 1-12 0c0-4 3-8 6-11Z"/><path d="m5 21 14-1"/>',
  pavilion: '<path d="M3 10h18L12 3z"/><path d="M5 10v10M19 10v10M8 20v-6h8v6"/><path d="M2 10c1 2 2 2 3 0 1 2 2 2 3 0 1 2 2 2 3 0 1 2 2 2 3 0 1 2 2 2 3 0 1 2 2 2 3 0"/>',
  fountain: '<ellipse cx="12" cy="17" rx="9" ry="4"/><path d="M3 17v3c0 2 4 3 9 3s9-1 9-3v-3"/><path d="M12 13V4M9 7c0 3 3 3 3 1 0 2 3 2 3-1"/>',
  windmill: '<path d="M12 12 7 4M12 12l8-3M12 12l-4 8M12 12l-7 4"/><circle cx="12" cy="12" r="2.3"/><path d="M8 20h8l1-8H7z"/>',
  flower: '<circle cx="12" cy="9" r="3"/><circle cx="7" cy="9" r="2.5"/><circle cx="17" cy="9" r="2.5"/><circle cx="12" cy="4" r="2.5"/><path d="M12 12c0 4-1 6-1 9M8 21h8"/>',
  lighthouse: '<path d="M9 21h6l-1-14H10z"/><path d="M8 7h8l-1-4H9z"/><path d="M12 3V1M6 5 3 3M18 5l3-2"/><path d="M10 12h4M10 16h4"/><path d="M5 21h14"/>',
  observatory: '<path d="M3 21h18"/><path d="M5 21V9c0-4 3-7 7-7s7 3 7 7v12"/><path d="M8 21v-8h8v8"/><path d="m10 10 8-6M17 2l2 3"/><path d="M9 8a5 5 0 0 1 6-3"/>',
  ink: '<path d="M8 3h8l1 11c0 4-2.5 7-5 7s-5-3-5-7z"/><path d="M5 17c0 2 3 4 7 4s7-2 7-4"/><path d="M10 8c1-1 3-1 4 0"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/>',
  atom: '<ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.5"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  chart: '<path d="M4 4h16v16H4z"/><path d="m7 15 3-4 3 2 4-6"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="7" r="1"/>',
  badge: '<circle cx="12" cy="10" r="7"/><path d="m8 16-1 5 5-2 5 2-1-5"/><path d="m9 10 2 2 4-4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6"/><path d="M16 5a3 3 0 0 1 0 6M17 14c2 .5 4 2.5 4 6"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  crown: '<path d="M3 7 7 11l5-7 5 7 4-4-2 12H5z"/><path d="M5 20h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  rotate: '<path d="M20 8V3l-2 2a8 8 0 1 0 2 8"/><path d="M20 3h-5"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 .5-7L4 10"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 .8c0 2-2.5 2-2.5 4M12 17.5v.1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/>',
  save: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h7V4M8 20v-6h8v6"/>',
  gift: '<path d="M4 10h16v10H4zM3 6h18v4H3zM12 6v14"/><path d="M12 6C9 6 7 5 7 3.5S8 1 9.5 1 12 3 12 6ZM12 6c3 0 5-1 5-2.5S16 1 14.5 1 12 3 12 6Z"/>',
  anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 12H3c0 5 4 9 9 9s9-4 9-9h-2M8 10h8"/>',
  island: '<path d="M3 17c3-4 6-6 9-6s6 2 9 6"/><path d="M2 20c2 1 4 1 6 0s4-1 6 0 4 1 6 0M12 11V4M12 4c3 0 5 2 5 4-3 1-5 0-5-4ZM12 8C9 8 7 7 7 5c2-1 4 0 5 3Z"/><path d="M8 17h8"/>',
  tea: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M6 5c1-1 2-1 3 0s2 1 3 0 2-1 3 0M8 23h8"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.2-8A5.5 5.5 0 0 1 17.5 9 4.5 4.5 0 0 1 18 18z"/>',
  rain: '<path d="M7 15a4 4 0 0 1-.2-8A5.5 5.5 0 0 1 17.5 6 4.5 4.5 0 0 1 18 15z"/><path d="m8 18-1 3M13 18l-1 3M18 18l-1 3"/>',
  radish: '<path d="M12 21c4-3 6-7 5-11-4-1-8 0-10 4-2 4 1 6 5 7Z"/><path d="M12 10c-1-4 0-7 3-8M12 10c-4-2-6-1-8 1M12 10c2-3 4-4 7-4"/>',
  berry: '<path d="M12 21c5 0 8-3 8-7s-4-7-8-7-8 3-8 7 3 7 8 7Z"/><circle cx="9" cy="12" r="1"/><circle cx="14" cy="10" r="1"/><circle cx="15" cy="15" r="1"/><path d="M12 7c0-3 2-5 5-5M12 7c-2-2-4-2-6-1"/>',
  lotus: '<path d="M4 17c2-5 5-7 8-7s6 2 8 7c-5 3-11 3-16 0Z"/><path d="M12 10c-3-3-3-7 0-9 3 2 3 6 0 9ZM12 10c-4 0-7-1-8-4 3-1 6 0 8 4ZM12 10c4 0 7-1 8-4-3-1-6 0-8 4Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
};

export function icon(name, className = '') {
  const path = P[name] ?? P.spark;
  return `<svg class="ico ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const name = element.getAttribute('data-icon');
    if (!element.querySelector('svg')) element.innerHTML = icon(name);
  });
}

export function iconNameForItem(item) {
  return item?.icon ?? 'spark';
}

export function itemGlyphMarkup(kind, name = 'spark', extra = '') {
  return `<span class="item-glyph ${extra}" data-kind="${kind}">${icon(name)}</span>`;
}
