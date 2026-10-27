import * as THREE from 'three';

const DEFAULT_FONT = '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function seeded(seed = 1) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function withAlpha(hex, alpha) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`;
}

export function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function makeTextSprite(text, options = {}) {
  const {
    color = '#eaf2ff',
    fontSize = 48,
    weight = 500,
    font = DEFAULT_FONT,
    padding = 18,
    linePadding = 0,
    bg = null,
    border = null,
    radius = 14,
    glow = 0,
    glowColor = color,
    scale = 0.01,
    opacity = 1,
    align = 'center',
    letterSpacing = 0,
  } = options;

  const lines = String(text).split('\n');
  const dpr = 2;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontStr = `${weight} ${fontSize}px ${font}`;
  ctx.font = fontStr;

  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width + letterSpacing * Math.max(0, line.length - 1));
  }

  const lineHeight = fontSize * 1.28 + linePadding;
  const width = Math.ceil(maxWidth + padding * 2);
  const height = Math.ceil(lineHeight * lines.length + padding * 2);
  canvas.width = Math.max(2, width * dpr);
  canvas.height = Math.max(2, height * dpr);
  ctx.scale(dpr, dpr);
  ctx.font = fontStr;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  if (bg || border) {
    if (bg) {
      ctx.fillStyle = bg;
      roundedRect(ctx, 1, 1, width - 2, height - 2, radius);
      ctx.fill();
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      roundedRect(ctx, 1.5, 1.5, width - 3, height - 3, radius);
      ctx.stroke();
    }
  }

  if (glow > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow;
  }

  const x = align === 'left' ? padding : align === 'right' ? width - padding : width / 2;
  lines.forEach((line, index) => {
    const y = padding + lineHeight * (index + 0.5) - linePadding * 0.15;
    if (letterSpacing) {
      const total = ctx.measureText(line).width + letterSpacing * Math.max(0, line.length - 1);
      let cursor = x - (align === 'center' ? total / 2 : 0);
      ctx.textAlign = 'left';
      for (const char of line) {
        ctx.fillStyle = color;
        ctx.fillText(char, cursor, y);
        cursor += ctx.measureText(char).width + letterSpacing;
      }
      ctx.textAlign = align;
    } else {
      ctx.fillStyle = color;
      ctx.fillText(line, x, y);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: options.depthTest ?? false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width * scale, height * scale, 1);
  sprite.renderOrder = options.renderOrder ?? 20;
  sprite.userData.width = width;
  sprite.userData.height = height;
  sprite.userData.aspect = width / height;

  sprite.setOpacity = (value) => {
    material.opacity = value;
    sprite.visible = value > 0.01;
  };
  return sprite;
}

export function makeGlowTexture(inner = '#9befff', outer = 'rgba(0,0,0,0)') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, withAlpha(inner, 0.55));
  g.addColorStop(0.62, withAlpha(inner, 0.13));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTextureCache = new Map();

export function glowSprite(color = '#6be7ff', size = 3, opacity = 0.8) {
  const key = color;
  let texture = glowTextureCache.get(key);
  if (!texture) {
    texture = makeGlowTexture(color);
    glowTextureCache.set(key, texture);
  }
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 3;
  sprite.userData.baseOpacity = opacity;
  return sprite;
}

export function makeStars(count = 1600, minRadius = 55, maxRadius = 150, color = '#a8c8ff', size = 0.5) {
  const rand = seeded(918273 + count);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = minRadius + Math.pow(rand(), 0.65) * (maxRadius - minRadius);
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius * 0.8;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: glowTextureCache.get('#9befff') || makeGlowTexture('#9befff'),
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

export function makeLine(points, color = '#6be7ff', opacity = 0.5, options = {}) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: options.blending ?? THREE.AdditiveBlending,
    toneMapped: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = options.renderOrder ?? 2;
  return line;
}

export function makeDashedLine(points, color = '#6be7ff', opacity = 0.4, dashSize = 0.24, gapSize = 0.18) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    dashSize,
    gapSize,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

export function makeTube(points, color = '#6be7ff', radius = 0.035, opacity = 1, tension = 0.4) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
  const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 6, false);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: opacity < 1,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.Mesh(geometry, material);
}

export function makeArrow(from, to, color = '#6be7ff', options = {}) {
  const start = from.isVector3 ? from.clone() : new THREE.Vector3(...from);
  const end = to.isVector3 ? to.clone() : new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const length = dir.length();
  if (length < 0.0001) return new THREE.Group();
  dir.normalize();
  const shaftRadius = options.radius ?? 0.018;
  const headLength = options.headLength ?? Math.min(length * 0.28, 0.32);
  const headRadius = options.headRadius ?? 0.065;
  const shaftLength = Math.max(0.0001, length - headLength);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: options.opacity ?? 0.9,
    toneMapped: false,
    depthWrite: false,
  });
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 6), mat);
  shaft.position.y = shaftLength / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 8), mat);
  head.position.y = shaftLength + headLength / 2;
  group.add(shaft, head);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.position.copy(start);
  group.userData.length = length;
  group.userData.material = mat;
  return group;
}

export function makeBeam(from, to, radius = 0.04, color = '#6be7ff', opacity = 1) {
  const start = from.isVector3 ? from.clone() : new THREE.Vector3(...from);
  const end = to.isVector3 ? to.clone() : new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const length = dir.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 6);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function makeRibbon(points, width = 1, color = '#2f9cff', opacity = 0.6, y = 0) {
  const verts = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, prev);
    tangent.y = 0;
    tangent.normalize();
    const normal = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(width / 2);
    const p = points[i];
    verts.push(p.x + normal.x, y, p.z + normal.z);
    verts.push(p.x - normal.x, y, p.z - normal.z);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return mesh;
}

export function makeFloorRing(radius = 6, color = '#6be7ff', opacity = 0.25) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.012, radius, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const inner = ring.clone();
  inner.scale.setScalar(0.72);
  inner.material = ring.material.clone();
  inner.material.opacity = opacity * 0.5;
  group.add(inner);
  return group;
}

export function disposeObject(root) {
  const seen = new Set();
  root.traverse((obj) => {
    if (obj.geometry && !seen.has(obj.geometry)) {
      seen.add(obj.geometry);
      obj.geometry.dispose();
    }
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const material of materials) {
      if (seen.has(material)) continue;
      seen.add(material);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) {
        if (material[key]) material[key].dispose();
      }
      material.dispose();
    }
  });
}

export function createCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createDiceTexture(value, color = '#f7fbff', pipColor = '#141d2e') {
  return createCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    roundedRect(ctx, 10, 10, w - 20, h - 20, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 4;
    ctx.stroke();
    const pips = {
      1: [[0.5, 0.5]],
      2: [[0.28, 0.28], [0.72, 0.72]],
      3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
      4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
      5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
      6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
    }[value] || [];
    ctx.fillStyle = pipColor;
    for (const [x, y] of pips) {
      ctx.beginPath();
      ctx.arc(x * w, y * h, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function makeSwayGroup() {
  return new THREE.Group();
}
