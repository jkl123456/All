import * as THREE from 'three';
import {
  makeArrow,
  makeBeam,
  makeDashedLine,
  makeFloorRing,
  makeGlowTexture,
  makeLine,
  makeRibbon,
  makeTextSprite,
  makeTube,
  createCanvasTexture,
  createDiceTexture,
  roundedRect,
  seeded,
} from '../../lib/visuals.js';

export {
  THREE,
  makeArrow,
  makeBeam,
  makeDashedLine,
  makeFloorRing,
  makeGlowTexture,
  makeLine,
  makeRibbon,
  makeTextSprite,
  makeTube,
  createCanvasTexture,
  createDiceTexture,
  roundedRect,
  seeded,
};

export function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(options.emissive ?? color),
    emissiveIntensity: options.emissiveIntensity ?? 0.22,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.12,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    flatShading: options.flatShading ?? false,
    depthWrite: options.depthWrite ?? true,
  });
}

export function basic(color, opacity = 1, options = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: opacity < 1 || options.transparent,
    opacity,
    side: options.side ?? THREE.FrontSide,
    blending: options.blending ?? THREE.NormalBlending,
    depthWrite: options.depthWrite ?? true,
    toneMapped: false,
  });
}

export function mesh(geometry, color, options = {}) {
  return new THREE.Mesh(geometry, material(color, options));
}

export function box(width, height, depth, color, options = {}) {
  return mesh(new THREE.BoxGeometry(width, height, depth), color, options);
}

export function sphere(radius, color, options = {}) {
  return mesh(new THREE.SphereGeometry(radius, options.segments ?? 32, options.rings ?? 20), color, options);
}

export function cylinder(radiusTop, radiusBottom, height, color, options = {}) {
  return mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, options.segments ?? 24, 1, options.openEnded ?? false),
    color,
    options
  );
}

export function cone(radius, height, color, options = {}) {
  return mesh(new THREE.ConeGeometry(radius, height, options.segments ?? 24), color, options);
}

export function torus(radius, tube, color, options = {}) {
  return mesh(new THREE.TorusGeometry(radius, tube, options.radialSegments ?? 8, options.tubularSegments ?? 64), color, {
    ...options,
    emissiveIntensity: options.emissiveIntensity ?? 0.6,
  });
}

export function addLabel(parent, text, position, options = {}) {
  const fontSize = options.fontSize ?? 40;
  const baseScale = options.scale ?? 0.009;
  const scaleBoost = fontSize >= 30 ? 1.15 : fontSize >= 26 ? 1.35 : 1.62;
  const sprite = makeTextSprite(text, {
    color: options.color ?? '#eaf4ff',
    fontSize,
    weight: options.weight ?? 450,
    scale: baseScale * scaleBoost,
    bg: options.bg,
    border: options.border,
    padding: options.padding ?? 12,
    radius: 10,
    glow: options.glow ?? 10,
    glowColor: options.glowColor ?? options.color,
    opacity: options.opacity ?? 1,
    letterSpacing: options.letterSpacing ?? 0,
  });
  if (Array.isArray(position)) sprite.position.set(...position);
  else if (position) sprite.position.copy(position);
  parent.add(sprite);
  return sprite;
}

export function addGlow(parent, color, size, position, opacity = 0.55) {
  const texture = makeGlowTexture(color);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  sprite.scale.set(size, size, 1);
  if (Array.isArray(position)) sprite.position.set(...position);
  else if (position) sprite.position.copy(position);
  parent.add(sprite);
  return sprite;
}

export function addArrow(parent, from, to, color, options = {}) {
  const arrow = makeArrow(new THREE.Vector3(...from), new THREE.Vector3(...to), color, options);
  parent.add(arrow);
  return arrow;
}

export function addLine(parent, points, color, opacity = 0.6, options = {}) {
  const line = makeLine(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    color,
    opacity,
    options
  );
  parent.add(line);
  return line;
}

export function addDashedLine(parent, points, color, opacity = 0.5, dashSize = 0.22, gapSize = 0.16) {
  const line = makeDashedLine(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    color,
    opacity,
    dashSize,
    gapSize
  );
  parent.add(line);
  return line;
}

export function addBeam(parent, from, to, radius, color, opacity = 1) {
  const beam = makeBeam(new THREE.Vector3(...from), new THREE.Vector3(...to), radius, color, opacity);
  parent.add(beam);
  return beam;
}

export function addTube(parent, points, color, radius = 0.025, opacity = 0.8) {
  const tube = makeTube(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    color,
    radius,
    opacity
  );
  parent.add(tube);
  return tube;
}

export function addRibbon(parent, points, width, color, opacity = 0.7, y = 0.01) {
  const ribbon = makeRibbon(
    points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))),
    width,
    color,
    opacity,
    y
  );
  parent.add(ribbon);
  return ribbon;
}

export function ringLine(radius, color, opacity = 0.4, segments = 128, rotationX = 0) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const group = new THREE.Group();
  const line = makeLine(points, color, opacity);
  group.add(line);
  group.rotation.x = rotationX;
  return group;
}

export function arcPoints(from, to, height = 3, segments = 60) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const p = a.clone().lerp(b, t);
    p.y += Math.sin(Math.PI * t) * height;
    points.push(p);
  }
  return points;
}

export function orbitPoints(radius, y = 0, segments = 128, tilt = 0) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    points.push(new THREE.Vector3(x, y + Math.sin(a * 2) * 0.03, z + Math.cos(a) * Math.sin(tilt)));
  }
  return points;
}

export function makeCanvasLabelTexture(text, options = {}) {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  return createCanvasTexture(width, height, (ctx, w, h) => {
    const bg = options.bg ?? 'rgba(9, 15, 27, 0.9)';
    ctx.fillStyle = bg;
    roundedRect(ctx, 0, 0, w, h, options.radius ?? 28);
    ctx.fill();
    if (options.border) {
      ctx.strokeStyle = options.border;
      ctx.lineWidth = 4;
      roundedRect(ctx, 3, 3, w - 6, h - 6, options.radius ?? 26);
      ctx.stroke();
    }
    ctx.fillStyle = options.color ?? '#eaf4ff';
    ctx.font = `${options.weight ?? 500} ${options.fontSize ?? 180}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + (options.offsetY ?? 0));
    if (options.sub) {
      ctx.fillStyle = options.subColor ?? 'rgba(160, 190, 230, 0.7)';
      ctx.font = `400 ${options.subSize ?? 38}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillText(options.sub, w / 2, h * 0.79);
    }
  });
}

export function glyphPlane(char, size = 0.6, options = {}) {
  const texture = makeCanvasLabelTexture(char, {
    width: 256,
    height: 256,
    bg: options.bg ?? '#15253a',
    color: options.color ?? '#ffe9c9',
    fontSize: options.fontSize ?? 170,
    border: options.border,
    radius: 18,
  });
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(size, size);
  return new THREE.Mesh(geometry, material);
}

export function makeParticles(count, color, options = {}) {
  const rand = seeded(options.seed ?? 42);
  const positions = new Float32Array(count * 3);
  const velocity = [];
  for (let i = 0; i < count; i += 1) {
    positions.set(
      [
        (rand() - 0.5) * (options.spreadX ?? 6),
        (rand() - 0.5) * (options.spreadY ?? 4),
        (rand() - 0.5) * (options.spreadZ ?? 6),
      ],
      i * 3
    );
    velocity.push(new THREE.Vector3((rand() - 0.5) * 0.4, rand() * 0.6 + 0.1, (rand() - 0.5) * 0.4));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(color),
    size: options.size ?? 0.06,
    transparent: true,
    opacity: options.opacity ?? 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    map: makeGlowTexture(color),
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.velocity = velocity;
  points.userData.center = options.center ?? [0, 0, 0];
  points.userData.bounds = options.bounds ?? [4, 4, 4];
  points.frustumCulled = false;
  return points;
}

export function updateParticles(points, dt, options = {}) {
  const positions = points.geometry.attributes.position.array;
  const velocity = points.userData.velocity;
  const [cx, cy, cz] = points.userData.center;
  const [bx, by, bz] = points.userData.bounds;
  for (let i = 0; i < velocity.length; i += 1) {
    const v = velocity[i];
    positions[i * 3] += v.x * dt * (options.speed ?? 1);
    positions[i * 3 + 1] += v.y * dt * (options.speed ?? 1);
    positions[i * 3 + 2] += v.z * dt * (options.speed ?? 1);
    if (positions[i * 3] > cx + bx / 2 || positions[i * 3] < cx - bx / 2) v.x *= -1;
    if (positions[i * 3 + 1] > cy + by || positions[i * 3 + 1] < cy) {
      positions[i * 3 + 1] = cy;
      v.y = Math.abs(v.y);
    }
    if (positions[i * 3 + 2] > cz + bz / 2 || positions[i * 3 + 2] < cz - bz / 2) v.z *= -1;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

export function addPole(parent, position, height, color, radius = 0.012, opacity = 0.4) {
  const line = makeLine(
    [new THREE.Vector3(position[0], position[1], position[2]), new THREE.Vector3(position[0], position[1] + height, position[2])],
    color,
    opacity
  );
  parent.add(line);
  return line;
}

export function makeLabeledDot(parent, position, color, label, options = {}) {
  const group = new THREE.Group();
  group.position.set(...position);
  const dot = sphere(options.radius ?? 0.14, color, { emissiveIntensity: 0.9 });
  group.add(dot);
  const glow = addGlow(group, color, (options.radius ?? 0.14) * 6, [0, 0, 0], 0.4);
  if (label) {
    addLabel(group, label, [0, (options.radius ?? 0.14) + 0.35, 0], {
      fontSize: 28,
      scale: 0.007,
      color: options.labelColor ?? '#dff4ff',
      bg: 'rgba(4, 8, 16, 0.72)',
      border: color,
      padding: 8,
    });
  }
  parent.add(group);
  return { group, dot, glow };
}

export function makeHumanoid(color = '#ffd8a8', scale = 1) {
  const group = new THREE.Group();
  const head = sphere(0.16 * scale, color, { emissiveIntensity: 0.2 });
  head.position.y = 1.05 * scale;
  const body = cylinder(0.12 * scale, 0.18 * scale, 0.5 * scale, color, { emissiveIntensity: 0.15 });
  body.position.y = 0.68 * scale;
  const legL = cylinder(0.05 * scale, 0.05 * scale, 0.5 * scale, color, { emissiveIntensity: 0.1 });
  legL.position.set(-0.08 * scale, 0.28 * scale, 0);
  const legR = legL.clone();
  legR.position.x = 0.08 * scale;
  group.add(head, body, legL, legR);
  return group;
}
