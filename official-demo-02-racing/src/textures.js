import * as THREE from 'three';
import {
  canvasTexture, heightToNormal, makeCanvas, mulberry32, noiseCanvas, radialTexture, roundRect,
} from './utils.js';

const TAU = Math.PI * 2;

function grain(ctx, w, h, amount, seed, colored = false) {
  const rng = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n * (colored ? 1 : 0.9)));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * (colored ? 1.1 : 0.85)));
  }
  ctx.putImageData(img, 0, 0);
}

function asphalt(height = 1024) {
  const c = makeCanvas(height, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#343331';
  ctx.fillRect(0, 0, height, height);
  const rng = mulberry32(88);
  // Broad, low-contrast tonal patches.
  for (let i = 0; i < 24; i++) {
    const x = rng() * height, y = rng() * height, r = 70 + rng() * 230;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rng() > 0.5 ? 67 : 33;
    g.addColorStop(0, `rgba(${tone},${tone - 1},${tone - 2},${0.018 + rng() * 0.022})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine aggregate. Subtle, never high-contrast: this is dry tarmac, not gravel.
  for (let i = 0; i < 30000; i++) {
    const x = rng() * height, y = rng() * height;
    const v = 42 + rng() * 34;
    const a = 0.05 + rng() * 0.07;
    ctx.fillStyle = `rgba(${v},${v - 1},${v - 3},${a})`;
    ctx.fillRect(x, y, rng() < 0.92 ? 1 : 1.6, 1);
  }
  // Very faint tire-worn bands.
  for (const u of [0.27, 0.73]) {
    const g = ctx.createLinearGradient(u * height - 55, 0, u * height + 55, 0);
    g.addColorStop(0, 'rgba(15,15,14,0)');
    g.addColorStop(0.5, 'rgba(15,15,14,0.05)');
    g.addColorStop(1, 'rgba(15,15,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(u * height - 55, 0, 110, height);
  }
  // Occasional hairline crack.
  ctx.strokeStyle = 'rgba(22,21,20,0.26)';
  ctx.lineWidth = 1;
  for (let n = 0; n < 5; n++) {
    let x = rng() * height, y = rng() * height;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      x += (rng() - 0.5) * 26; y += rng() * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grain(ctx, height, height, 4, 22);
  return c;
}

function concrete(height = 512) {
  const c = makeCanvas(height, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b8276';
  ctx.fillRect(0, 0, height, height);
  const rng = mulberry32(42);
  for (let i = 0; i < 1400; i++) {
    const x = rng() * height, y = rng() * height;
    const v = 90 + rng() * 70;
    ctx.fillStyle = `rgba(${v},${v - 5},${v - 10},${0.06 + rng() * 0.1})`;
    ctx.beginPath(); ctx.arc(x, y, rng() * 2.5, 0, TAU); ctx.fill();
  }
  // concrete pavers
  const cell = height / 4;
  ctx.strokeStyle = 'rgba(58,52,45,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(height, i * cell); ctx.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const x = rng() * height, y = rng() * height;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40 + rng() * 80);
    g.addColorStop(0, 'rgba(54,48,42,0.10)'); g.addColorStop(1, 'rgba(54,48,42,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 120, y - 120, 240, 240);
  }
  grain(ctx, height, height, 12, 54);
  return c;
}

function facadeGlass(seed = 1) {
  const w = 512, h = 512, cellW = 128, cellH = 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const height = makeCanvas(w, h), hctx = height.getContext('2d');
  const rng = mulberry32(seed * 91 + 8);
  hctx.fillStyle = '#777'; hctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#29343a'; ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cellW, y = row * cellH;
      // glass pane
      const g = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      const bright = rng() > 0.7;
      g.addColorStop(0, bright ? '#b7b8aa' : '#4c5a5d');
      g.addColorStop(0.32, bright ? '#c9b7a2' : '#637071');
      g.addColorStop(0.55, '#4b5d61');
      g.addColorStop(1, '#18262d');
      ctx.fillStyle = g;
      ctx.fillRect(x + 5, y + 9, cellW - 10, cellH - 26);
      // sky reflection streak
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 5, y + 9, cellW - 10, cellH - 26); ctx.clip();
      const rg = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      rg.addColorStop(0.15, 'rgba(255,227,190,0)');
      rg.addColorStop(0.46, `rgba(255,230,196,${0.1 + rng() * 0.16})`);
      rg.addColorStop(0.5, 'rgba(255,235,205,0)');
      ctx.fillStyle = rg; ctx.fillRect(x, y, cellW, cellH);
      // interior tone
      if (rng() > 0.78) {
        ctx.fillStyle = `rgba(${210 + rng() * 30},${170 + rng() * 40},${110 + rng() * 30},${0.12 + rng() * 0.15})`;
        ctx.fillRect(x + 20, y + 40, cellW - 40, cellH - 80);
        ectx.fillStyle = `rgba(${255},${184 + rng() * 30},${112},${0.28 + rng() * 0.25})`;
        ectx.fillRect(x + 20, y + 40, cellW - 40, cellH - 80);
      }
      ctx.restore();
      // horizontal spandrel
      ctx.fillStyle = '#202a2e';
      ctx.fillRect(x, y + cellH - 18, cellW, 18);
      hctx.fillStyle = '#303030';
      hctx.fillRect(x + 3, y + cellH - 19, cellW - 6, 19);
      // mullions
      ctx.fillStyle = '#111a1d';
      ctx.fillRect(x, y, 5, cellH);
      ctx.fillRect(x + cellW - 5, y, 5, cellH);
      ctx.fillRect(x, y, cellW, 8);
      hctx.fillStyle = '#e0e0e0';
      hctx.fillRect(x, y, 5, cellH);
      hctx.fillRect(x, y, cellW, 8);
      // inner tiny mullion
      ctx.fillStyle = 'rgba(14,22,25,0.6)';
      ctx.fillRect(x + cellW / 2 - 1, y + 8, 2, cellH - 26);
    }
  }
  // subtle vertical grime
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(18,26,28,${0.03 + rng() * 0.05})`;
    ctx.fillRect(rng() * w, 0, 2 + rng() * 9, h);
  }
  grain(ctx, w, h, 6, seed);
  return { map: c, emissive: e, normal: heightToNormal(height, 2.0) };
}

function facadeStone(seed = 2, palette = 0) {
  const w = 512, h = 512, cw = 128, ch = 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const hc = makeCanvas(w, h), hctx = hc.getContext('2d');
  const rng = mulberry32(seed * 33 + 4);
  const bases = ['#9d8e79', '#8a8174', '#a8957e', '#7e7468'];
  ctx.fillStyle = bases[palette % bases.length]; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#8a8a8a'; hctx.fillRect(0, 0, w, h);
  // stone grain
  for (let i = 0; i < 4000; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.fillStyle = `rgba(255,240,220,${0.015 + rng() * 0.04})`;
    ctx.fillRect(x, y, 1 + rng() * 2, 1);
  }
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cw, y = row * ch;
      // pilaster between bays
      ctx.fillStyle = 'rgba(50,43,35,0.17)';
      ctx.fillRect(x, y, 15, ch);
      ctx.fillStyle = 'rgba(255,244,226,0.09)';
      ctx.fillRect(x + 15, y, 3, ch);
      // window recess
      ctx.fillStyle = '#2a2925';
      ctx.fillRect(x + 22, y + 24, cw - 45, 77);
      hctx.fillStyle = '#2f2f2f'; hctx.fillRect(x + 22, y + 24, cw - 45, 77);
      const g = ctx.createLinearGradient(x + 22, y + 24, x + 22, y + 101);
      g.addColorStop(0, '#4d5c61'); g.addColorStop(0.45, '#27363c'); g.addColorStop(1, '#182024');
      ctx.fillStyle = g;
      ctx.fillRect(x + 27, y + 29, cw - 55, 67);
      // slanted sun reflection
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 27, y + 29, cw - 55, 67); ctx.clip();
      ctx.fillStyle = 'rgba(255,214,162,0.16)';
      ctx.beginPath(); ctx.moveTo(x + 22, y + 62); ctx.lineTo(x + 100, y + 24); ctx.lineTo(x + 112, y + 46); ctx.lineTo(x + 40, y + 100); ctx.fill();
      ctx.restore();
      // curtains / lit interior
      if (rng() > 0.66) {
        ctx.fillStyle = `rgba(${140 + rng() * 60},${115 + rng() * 40},${80 + rng() * 35},0.38)`;
        ctx.fillRect(x + 34, y + 32, (cw - 65) * (0.28 + rng() * 0.35), 60);
        ectx.fillStyle = `rgba(255,${160 + rng() * 40},${90 + rng() * 25},${0.3 + rng() * 0.3})`;
        ectx.fillRect(x + 36, y + 34, (cw - 65) * 0.55, 58);
      }
      // window cross
      ctx.fillStyle = 'rgba(21,25,26,0.9)';
      ctx.fillRect(x + cw / 2 - 1, y + 29, 2, 67);
      ctx.fillRect(x + 27, y + 62, cw - 55, 2);
      hctx.fillStyle = '#707070'; hctx.fillRect(x + cw / 2 - 1, y + 29, 2, 67);
      // sill and lintel
      ctx.fillStyle = 'rgba(242,225,198,0.28)'; ctx.fillRect(x + 19, y + 101, cw - 39, 5);
      ctx.fillStyle = 'rgba(45,38,31,0.35)'; ctx.fillRect(x + 19, y + 20, cw - 39, 4);
      ctx.fillStyle = 'rgba(58,50,41,0.16)'; ctx.fillRect(x, y + ch - 10, cw, 10);
      hctx.fillStyle = '#d0d0d0'; hctx.fillRect(x + 19, y + 101, cw - 39, 5);
    }
  }
  grain(ctx, w, h, 7, seed);
  return { map: c, emissive: e, normal: heightToNormal(hc, 2.6) };
}

function facadeResidential(seed = 3) {
  const w = 512, h = 512, cw = 128, ch = 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const hc = makeCanvas(w, h), hctx = hc.getContext('2d');
  const rng = mulberry32(seed * 57 + 1);
  ctx.fillStyle = '#b3aa9b'; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#9a9a9a'; hctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cw, y = row * ch;
      // balcony void / sliding glass
      ctx.fillStyle = '#39413f'; ctx.fillRect(x + 11, y + 23, cw - 22, 65);
      hctx.fillStyle = '#363636'; hctx.fillRect(x + 11, y + 23, cw - 22, 65);
      const g = ctx.createLinearGradient(x + 11, y + 23, x + cw - 11, y + 88);
      g.addColorStop(0, '#607072'); g.addColorStop(0.45, '#3d5053'); g.addColorStop(1, '#1c292b');
      ctx.fillStyle = g; ctx.fillRect(x + 15, y + 27, cw - 30, 57);
      if (rng() > 0.72) {
        ctx.fillStyle = 'rgba(255,220,170,0.25)'; ctx.fillRect(x + 20, y + 30, cw - 40, 51);
        ectx.fillStyle = 'rgba(255,198,130,0.35)'; ectx.fillRect(x + 22, y + 32, cw - 44, 48);
      }
      // glazing bars
      ctx.fillStyle = 'rgba(35,42,40,0.9)';
      ctx.fillRect(x + cw / 2 - 1, y + 27, 2, 57);
      ctx.fillStyle = 'rgba(238,231,220,0.14)';
      ctx.fillRect(x + 9, y + 88, cw - 18, 4);
      // balcony floor and glass railing
      ctx.fillStyle = 'rgba(20,20,18,0.28)'; ctx.fillRect(x + 5, y + 92, cw - 10, 9);
      ctx.fillStyle = 'rgba(159,190,194,0.23)'; ctx.fillRect(x + 5, y + 83, cw - 10, 10);
      ctx.strokeStyle = 'rgba(226,236,232,0.32)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 5, y + 83, cw - 10, 10);
      // concrete ledge
      ctx.fillStyle = 'rgba(236,226,211,0.18)';
      ctx.fillRect(x + 4, y + 97, cw - 8, 4);
      ctx.fillStyle = 'rgba(34,32,28,0.2)';
      ctx.fillRect(x, y + ch - 4, cw, 4);
      // vertical grooves
      ctx.fillStyle = 'rgba(70,64,55,0.1)'; ctx.fillRect(x, y, 3, ch);
    }
  }
  grain(ctx, w, h, 5, seed);
  return { map: c, emissive: e, normal: heightToNormal(hc, 2.2) };
}

function facadeBrick(seed = 4) {
  const w = 512, h = 512, cw = 128, ch = 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const hc = makeCanvas(w, h), hctx = hc.getContext('2d');
  const rng = mulberry32(seed * 13 + 6);
  ctx.fillStyle = '#7b4c3b'; ctx.fillRect(0, 0, w, h);
  // brick courses
  for (let y = 0; y < h; y += 6) {
    const off = (y / 6) % 2 ? 0 : 12;
    for (let x = -24 + off; x < w; x += 24) {
      const tone = 90 + rng() * 55;
      ctx.fillStyle = `rgba(${tone + 25},${tone - 20},${tone - 38},0.34)`;
      ctx.fillRect(x + 1, y + 1, 22, 4);
    }
    ctx.fillStyle = 'rgba(70,50,40,0.26)'; ctx.fillRect(0, y, w, 1);
  }
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cw, y = row * ch;
      // window surround
      ctx.fillStyle = '#a8957e'; ctx.fillRect(x + 18, y + 17, cw - 36, 86);
      hctx.fillStyle = '#bdbdbd'; hctx.fillRect(x + 18, y + 17, cw - 36, 86);
      ctx.fillStyle = '#1d2322'; ctx.fillRect(x + 26, y + 25, cw - 52, 68);
      hctx.fillStyle = '#333'; hctx.fillRect(x + 26, y + 25, cw - 52, 68);
      const g = ctx.createLinearGradient(x + 26, y + 25, x + 26, y + 93);
      g.addColorStop(0, '#4c5d60'); g.addColorStop(0.5, '#2a393d'); g.addColorStop(1, '#172022');
      ctx.fillStyle = g; ctx.fillRect(x + 30, y + 29, cw - 60, 60);
      if (rng() > 0.65) {
        ectx.fillStyle = `rgba(255,${180 + rng() * 40},${110},0.34)`;
        ectx.fillRect(x + 34, y + 33, cw - 68, 52);
        ctx.fillStyle = 'rgba(255,210,160,0.14)'; ctx.fillRect(x + 34, y + 33, cw - 68, 52);
      }
      ctx.fillStyle = 'rgba(22,25,24,0.9)';
      ctx.fillRect(x + cw / 2 - 1, y + 29, 2, 60);
      ctx.fillRect(x + 30, y + 58, cw - 60, 2);
      // flower box
      ctx.fillStyle = 'rgba(39,35,30,0.7)'; ctx.fillRect(x + 32, y + 97, cw - 64, 4);
      // lintel/awning
      ctx.fillStyle = 'rgba(224,213,194,0.24)'; ctx.fillRect(x + 14, y + 13, cw - 28, 3);
    }
  }
  grain(ctx, w, h, 9, seed);
  return { map: c, emissive: e, normal: heightToNormal(hc, 2.4) };
}

function facadeRibbon(seed = 5) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const hc = makeCanvas(w, h), hctx = hc.getContext('2d');
  const rng = mulberry32(seed * 71 + 3);
  ctx.fillStyle = '#a69c8c'; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#a0a0a0'; hctx.fillRect(0, 0, w, h);
  const floors = 8;
  const fh = h / floors;
  for (let row = 0; row < floors; row++) {
    const y = row * fh;
    ctx.fillStyle = '#b3a998'; ctx.fillRect(0, y, w, fh);
    // ribbon window
    const g = ctx.createLinearGradient(0, y + fh * 0.34, 0, y + fh * 0.82);
    g.addColorStop(0, '#71817e'); g.addColorStop(0.45, '#394a4b'); g.addColorStop(1, '#172426');
    ctx.fillStyle = g; ctx.fillRect(14, y + fh * 0.34, w - 28, fh * 0.48);
    hctx.fillStyle = '#303030'; hctx.fillRect(14, y + fh * 0.34, w - 28, fh * 0.48);
    // angled reflections
    ctx.save(); ctx.beginPath(); ctx.rect(14, y + fh * 0.34, w - 28, fh * 0.48); ctx.clip();
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 78 + rng() * 20;
      ctx.fillStyle = `rgba(255,230,193,${0.04 + rng() * 0.09})`;
      ctx.beginPath(); ctx.moveTo(x, y + fh); ctx.lineTo(x + 36, y); ctx.lineTo(x + 58, y); ctx.lineTo(x + 22, y + fh); ctx.fill();
    }
    ctx.restore();
    // vertical fins
    ctx.fillStyle = '#817767';
    for (let x = 0; x < w; x += 64) {
      ctx.fillRect(x, y + fh * 0.28, 4, fh * 0.58);
      hctx.fillStyle = '#e0e0e0'; hctx.fillRect(x, y + fh * 0.28, 4, fh * 0.58);
    }
    // spandrel highlight and shadow
    ctx.fillStyle = 'rgba(249,235,210,0.18)'; ctx.fillRect(0, y + fh * 0.22, w, 2);
    ctx.fillStyle = 'rgba(44,38,31,0.25)'; ctx.fillRect(0, y + fh * 0.82, w, fh * 0.18);
    // occasional lit room
    for (let k = 0; k < 2; k++) {
      if (rng() > 0.55) {
        const x = Math.floor(rng() * 7) * 64 + 8;
        ectx.fillStyle = `rgba(255,190,132,${0.16 + rng() * 0.22})`;
        ectx.fillRect(x, y + fh * 0.38, 48, fh * 0.38);
      }
    }
  }
  grain(ctx, w, h, 5, seed);
  return { map: c, emissive: e, normal: heightToNormal(hc, 2.0) };
}

function storefront() {
  const w = 1024, h = 256;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  const rng = mulberry32(555);
  ctx.fillStyle = '#26211c'; ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  const units = ['CAFFÈ NERO', 'LUMEN', 'MARANELLO', 'ATELIER 09', 'SALT & VINE', 'STUDIO APEX'];
  const awningColors = ['#7b2b24', '#27453e', '#be8b2f', '#273d55', '#6c1d30', '#3a3a33'];
  const unitW = w / 4;
  for (let i = 0; i < 4; i++) {
    const x = i * unitW;
    // warm glass
    ctx.fillStyle = '#17130f'; ctx.fillRect(x + 14, 72, unitW - 28, 163);
    const g = ctx.createLinearGradient(x, 72, x, 235);
    g.addColorStop(0, 'rgba(255,207,152,0.22)'); g.addColorStop(0.6, 'rgba(111,73,38,0.32)'); g.addColorStop(1, 'rgba(20,15,10,0.8)');
    ctx.fillStyle = g; ctx.fillRect(x + 22, 78, unitW - 44, 150);
    ectx.fillStyle = 'rgba(255,170,90,0.18)'; ectx.fillRect(x + 22, 82, unitW - 44, 140);
    // interior silhouettes
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = `rgba(14,10,7,${0.35 + rng() * 0.3})`;
      const sx = x + 35 + rng() * (unitW - 110);
      ctx.fillRect(sx, 150 + rng() * 20, 22 + rng() * 34, 76);
    }
    // mullions
    ctx.fillStyle = '#0c0b09';
    ctx.fillRect(x + 14, 72, 4, 163); ctx.fillRect(x + unitW - 18, 72, 4, 163);
    ctx.fillRect(x + 14, 190, unitW - 28, 3);
    // fascia + glowing shop sign
    ctx.fillStyle = '#171411'; ctx.fillRect(x, 20, unitW, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 8, 26, unitW - 16, 40);
    ctx.font = '600 21px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#f3e6cd';
    ctx.textAlign = 'center';
    ctx.fillText(units[(i + 1) % units.length], x + unitW / 2, 52);
    ectx.font = '600 21px "Barlow Condensed", sans-serif';
    ectx.fillStyle = 'rgba(255,214,160,0.8)';
    ectx.textAlign = 'center';
    ectx.fillText(units[(i + 1) % units.length], x + unitW / 2, 52);
    // awning
    if (i % 2 === 0) {
      ctx.fillStyle = awningColors[i];
      ctx.beginPath();
      ctx.moveTo(x + 10, 62); ctx.lineTo(x + unitW - 10, 62); ctx.lineTo(x + unitW - 30, 84); ctx.lineTo(x + 30, 84); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let s = x + 30; s < x + unitW - 30; s += 26) ctx.fillRect(s, 62, 10, 22);
    }
  }
  // pavement reflection strip
  ctx.fillStyle = 'rgba(255,206,150,0.06)'; ctx.fillRect(0, 235, w, 21);
  return { map: c, emissive: e };
}

function crowd() {
  const w = 1024, h = 256;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const rng = mulberry32(987);
  ctx.fillStyle = '#191817'; ctx.fillRect(0, 0, w, h);
  for (let row = 0; row < 7; row++) {
    const y = 16 + row * 32;
    for (let x = 4; x < w; x += 8 + rng() * 8) {
      const shade = 30 + rng() * 80;
      const palette = [
        `rgba(${shade + 30},${shade + 15},${shade},0.75)`,
        `rgba(${shade},${shade + 20},${shade + 30},0.7)`,
        `rgba(${shade + 60},${shade + 20},${shade + 10},0.5)`,
        `rgba(${shade + 10},${shade + 45},${shade + 35},0.55)`,
      ];
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.beginPath(); ctx.arc(x + 2, y + 5 + rng() * 3, 2.2 + rng() * 1.3, 0, TAU); ctx.fill();
      ctx.fillRect(x - 1, y + 8, 6, 9 + rng() * 5);
    }
  }
  // concrete step shadows
  for (let row = 0; row < 8; row++) {
    ctx.fillStyle = 'rgba(7,7,7,0.38)'; ctx.fillRect(0, row * 32 + 28, w, 5);
  }
  grain(ctx, w, h, 8, 3);
  return c;
}

function checkered(size = 512, cells = 16) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const s = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#efe9dd' : '#141311';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return c;
}

function adBoard(kind) {
  const w = 768, h = 320;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  if (kind === 0) {
    ctx.fillStyle = '#15130f'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ff5a1f'); g.addColorStop(0.55, '#d73812'); g.addColorStop(1, '#501408');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, 16);
    ctx.font = '800 118px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#f1e8d7'; ctx.fillText('APEX', 40, 132);
    ctx.fillStyle = '#ff5a1f'; ctx.fillText('CITY', 40, 238);
    ctx.font = '600 19px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(241,232,215,0.72)'; ctx.fillText('BEYOND THE LIMIT', 43, 280);
    ctx.strokeStyle = 'rgba(241,232,215,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(20, 20, w - 40, h - 40);
  } else if (kind === 1) {
    ctx.fillStyle = '#0d0f10'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, h, w, 0);
    g.addColorStop(0, '#2a6a5e'); g.addColorStop(1, '#a5d7c6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 10, h);
    ctx.font = '800 94px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#f1e8d7'; ctx.fillText('NOCTURNE', 38, 160);
    ctx.font = '600 17px "Manrope", sans-serif';
    ctx.fillStyle = 'rgba(241,232,215,0.5)'; ctx.fillText('AURELIA  /  ELECTRIFIED PERFORMANCE', 41, 196);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 140, 250); ctx.lineTo(90 + i * 140, 250); ctx.stroke(); }
  } else if (kind === 2) {
    ctx.fillStyle = '#d7cbbc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#131211';
    ctx.font = '800 124px "Barlow Condensed", sans-serif'; ctx.fillText('VELOCITY', 38, 160);
    ctx.font = '600 18px "Manrope", sans-serif'; ctx.fillText('LIFE AT FULL THROTTLE', 42, 198);
    ctx.fillStyle = '#ff5a1f'; ctx.fillRect(0, h - 24, w, 24);
    ctx.fillStyle = '#131211';
    for (let i = 0; i < 14; i++) ctx.fillRect(40 + i * 52, h - 60, 26, 4);
  } else {
    ctx.fillStyle = '#191817'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(0, i * 16); ctx.lineTo(w, i * 16); ctx.stroke(); }
    ctx.font = '700 76px "Barlow Condensed", sans-serif'; ctx.fillStyle = '#f1e8d7'; ctx.fillText('APEX CITY', 40, 138);
    ctx.font = '500 18px "Manrope", sans-serif'; ctx.fillStyle = '#ff8b52'; ctx.fillText('STREET CIRCUIT · ROUND 02', 43, 180);
    ctx.font = '600 52px "Barlow Condensed", sans-serif'; ctx.fillStyle = 'rgba(241,232,215,0.16)'; ctx.fillText('SEASIDE / 18:42', 40, 260);
  }
  return c;
}

function barrierBanner() {
  const w = 1024, h = 128;
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#e8e2d6'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#151310'; ctx.fillRect(0, h - 14, w, 14);
  ctx.font = '800 63px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#151310';
  ctx.fillText('APEX CITY', 38, 78);
  ctx.fillStyle = '#ff5a1f';
  ctx.fillRect(390, 25, 8, 62);
  ctx.font = '600 18px "Manrope", sans-serif';
  ctx.fillStyle = '#5f574c';
  ctx.fillText('OFFICIAL STREET CIRCUIT', 425, 56);
  ctx.font = '600 14px "Manrope", sans-serif';
  ctx.fillStyle = '#8f8577';
  ctx.fillText('APEX CITY · ROUND 02', 425, 82);
  ctx.font = '800 42px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#ff5a1f';
  ctx.fillText('02', 920, 82);
  return c;
}

function tireWall() {
  const s = 512;
  const c = makeCanvas(s, s), ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1918'; ctx.fillRect(0, 0, s, s);
  const rng = mulberry32(71);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 7; x++) {
      const cx = x * 78 + (y % 2 ? 39 : 0), cy = y * 88 + 34;
      ctx.fillStyle = '#232220'; ctx.beginPath(); ctx.arc(cx, cy, 37, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#33322f'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,90,31,${0.12 + rng() * 0.1})`;
      ctx.beginPath(); ctx.arc(cx + 10, cy - 8, 3, 0, TAU); ctx.fill();
    }
  }
  return c;
}

function asphaltRoughness() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b7b7b7'; ctx.fillRect(0, 0, s, s);
  const rng = mulberry32(123);
  for (let i = 0; i < 2400; i++) {
    const v = 100 + rng() * 120;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.1 + rng() * 0.16})`;
    ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 1 + rng() * 10, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(60,60,60,0.25)';
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 80 + rng() * 20;
    ctx.fillRect(x, 0, 14 + rng() * 18, s);
  }
  return c;
}

function smokeTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.35, 'rgba(240,236,228,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return c;
}

function sunGlow() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,249,235,1)');
  g.addColorStop(0.08, 'rgba(255,241,211,0.95)');
  g.addColorStop(0.25, 'rgba(255,190,106,0.34)');
  g.addColorStop(0.55, 'rgba(255,126,50,0.09)');
  g.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return c;
}

export function createTextureLibrary() {
  const asphaltCanvas = asphalt(1024);
  const asphaltRough = asphaltRoughness();
  const asphaltBump = noiseCanvas(512, 512, '#7f7f7f', 0.9, 7);
  const concreteCanvas = concrete(512);
  const sidewalkNormal = heightToNormal(concreteCanvas, 1.2);
  const store = storefront();
  const crowdCanvas = crowd();

  const lib = {
    asphalt: canvasTexture(asphaltCanvas, { repeat: [1, 1], anisotropy: 16 }),
    asphaltRough: canvasTexture(asphaltRough, { srgb: false, anisotropy: 8 }),
    asphaltBump: canvasTexture(asphaltBump, { srgb: false, anisotropy: 4 }),
    concrete: canvasTexture(concreteCanvas, { repeat: [1, 1] }),
    concreteNormal: canvasTexture(sidewalkNormal, { srgb: false }),
    storeMap: canvasTexture(store.map, { anisotropy: 8 }),
    storeEmissive: canvasTexture(store.emissive, { anisotropy: 8 }),
    crowd: canvasTexture(crowdCanvas, { anisotropy: 8 }),
    checkered: canvasTexture(checkered(512, 16), { repeat: [1, 1] }),
    barrierBanner: canvasTexture(barrierBanner(), { anisotropy: 8 }),
    tireWall: canvasTexture(tireWall(), { repeat: [1, 1] }),
    smoke: canvasTexture(smokeTexture(), { repeat: [1, 1] }),
    sunGlow: canvasTexture(sunGlow(), { repeat: [1, 1] }),
    shop: {
      map: canvasTexture(store.map, { anisotropy: 8 }),
      emissive: canvasTexture(store.emissive, { anisotropy: 8 }),
    },
    billboards: [0, 1, 2, 3].map((k) => {
      const tex = canvasTexture(adBoard(k), { anisotropy: 8 });
      return tex;
    }),
    facades: [],
  };

  const glass = facadeGlass(2);
  const stoneA = facadeStone(12, 0);
  const stoneB = facadeStone(14, 2);
  const residential = facadeResidential(8);
  const brick = facadeBrick(22);
  const ribbon = facadeRibbon(6);

  const pack = (set, name, roughness, metalness, emissiveIntensity = 0.55) => ({
    name,
    map: canvasTexture(set.map, { anisotropy: 8 }),
    emissiveMap: canvasTexture(set.emissive, { anisotropy: 8 }),
    normalMap: canvasTexture(set.normal, { srgb: false, anisotropy: 8 }),
    roughness, metalness, emissiveIntensity,
  });

  lib.facades.push(pack(glass, 'glass', 0.22, 0.62, 0.55));
  lib.facades.push(pack(stoneA, 'stone-a', 0.82, 0.05, 0.45));
  lib.facades.push(pack(stoneB, 'stone-b', 0.8, 0.05, 0.4));
  lib.facades.push(pack(residential, 'residence', 0.86, 0.04, 0.4));
  lib.facades.push(pack(brick, 'brick', 0.92, 0.02, 0.35));
  lib.facades.push(pack(ribbon, 'ribbon', 0.62, 0.22, 0.4));

  return lib;
}
