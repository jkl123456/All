import * as THREE from 'three';
import {
  BUILDINGS_BY_ID,
  CROPS_BY_ID,
  EXPANSIONS,
  RESIDENTS_BY_ID,
  STARTING_PLOTS,
} from '../data/gameData.js';
import { clamp, mulberry32, randomRange } from '../core/utils.js';
import { rts } from './rtsAssets.js';
import {
  M,
  createArchRuin,
  createBarrel,
  createBench,
  createBoat,
  createCrate,
  createFlowerPot,
  createLaundryLine,
  createStoneWall,
  createWell,
  createWoodpile,
  createBush,
  createCharacter,
  createCrystalCluster,
  createDock,
  createExpansionStele,
  createFarmPlot,
  createFenceSegment,
  createFlowerPatch,
  createGrassTuft,
  createHalo,
  createKnowledgeTree,
  createLanternPost,
  createMailbox,
  createMushroom,
  createReeds,
  createRock,
  createSignpost,
  createTent,
  createTree,
  createTrialMonument,
  createUmbrellaTree,
  glowSprite,
  glyphSprite,
  group,
  material,
  mesh,
  shadows,
} from './modelKit.js';
import { buildingInteraction, createBuilding } from './buildingFactory.js';
import { createGroundCover, createGroundShadow, createButterflies } from './vegetation.js';
import { getSurface } from './textures.js';
import { tropical } from './tropicalAssets.js';
import { jungle } from './jungleAssets.js';
import { createPaving, createVillageGround, resolveFreePosition } from './villageScene.js';
import { buildGarden, gardenClearAt, planGarden } from './islandGarden.js';
import { beach } from './beachAssets.js';
import { nature } from './natureAssets.js';
import { village } from './villageAssets.js';
import { createMeadow, groundTextures } from './meadow.js';

const GROUND_Y = 1.12;

function addTick(target, fn) {
  const previous = target.userData.tick;
  target.userData.tick = (time, delta, night) => {
    previous?.(time, delta, night);
    fn(time, delta, night);
  };
}

function addInteraction(list, data) {
  list.push({
    range: 3.2,
    markerHeight: 2.8,
    ...data,
  });
}

function addBlocker(list, x, z, radius, type = 'scenery') {
  list.push({ x, z, radius, type });
}

function topPoint(radius, angle, ratio = 1, seed = 1) {
  const jitter = 1 + Math.sin(angle * 3 + seed * 0.37) * 0.027 + Math.cos(angle * 5 - seed * 0.19) * 0.018;
  return {
    x: Math.cos(angle) * radius * ratio * jitter,
    z: Math.sin(angle) * radius * ratio * jitter,
  };
}

function terrainY(ratio, angle, seed) {
  const wobble = Math.sin(angle * 2.7 + seed) * 0.035 + Math.cos(angle * 4.1 - seed * 0.5) * 0.025;
  return GROUND_Y - Math.pow(ratio, 7) * 0.24 + wobble * Math.pow(ratio, 2);
}

function createTerrain(radius, palette, seed, options = {}) {
  const root = new THREE.Group();
  root.userData.terrain = true;
  const segments = 72;
  const rings = 14;
  const positions = [];
  const colors = [];
  const indices = [];
  const grass = new THREE.Color(palette.grass);
  const grassDeep = new THREE.Color(palette.grassDeep ?? palette.grass);
  const sand = new THREE.Color(palette.sand ?? '#e4ca96');
  const tmpColor = new THREE.Color();

  // 顶部低多边形盘面
  positions.push(0, terrainY(0, 0, seed) + 0.02, 0);
  tmpColor.copy(grass).lerp(grassDeep, 0.08);
  colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
  for (let ring = 1; ring <= rings; ring += 1) {
    const ratio = Math.pow(ring / rings, 0.94);
    for (let seg = 0; seg < segments; seg += 1) {
      const angle = (seg / segments) * Math.PI * 2;
      const point = topPoint(radius, angle, ratio, seed);
      const y = terrainY(ratio, angle, seed);
      positions.push(point.x, y, point.z);
      const noise = (Math.sin(angle * 4.3 + ring * 2.1 + seed) + 1) / 2;
      const patch = Math.sin(point.x * 0.42 + seed * 0.7) * Math.cos(point.z * 0.36 - seed * 0.4);
      if (ratio > 0.9) {
        tmpColor.copy(grassDeep).lerp(sand, clamp((ratio - 0.9) / 0.1 + noise * 0.15, 0, 1));
      } else {
        tmpColor.copy(grass).lerp(grassDeep, noise * 0.4 + (ring / rings) * 0.1);
        // 大块的深浅草斑，让草地不是一张均匀的绿纸
        tmpColor.offsetHSL(patch * 0.012, patch * 0.05, patch * 0.045);
        if (patch > 0.55) tmpColor.lerp(new THREE.Color(palette.grassDry ?? '#a8b876'), (patch - 0.55) * 0.42);
        if (patch < -0.55) tmpColor.lerp(new THREE.Color(palette.grassWet ?? '#4a8058'), (-patch - 0.55) * 0.36);
      }
      colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }
  // center fan
  for (let seg = 0; seg < segments; seg += 1) {
    const current = 1 + seg;
    const next = 1 + ((seg + 1) % segments);
    indices.push(0, next, current);
  }
  // rings
  for (let ring = 0; ring < rings - 1; ring += 1) {
    const innerStart = 1 + ring * segments;
    const outerStart = 1 + (ring + 1) * segments;
    for (let seg = 0; seg < segments; seg += 1) {
      const nextSeg = (seg + 1) % segments;
      const a = innerStart + seg;
      const b = innerStart + nextSeg;
      const c = outerStart + seg;
      const d = outerStart + nextSeg;
      indices.push(a, b, c, b, d, c);
    }
  }
  const topGeometry = new THREE.BufferGeometry();
  topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  topGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  topGeometry.setIndex(indices);
  topGeometry.computeVertexNormals();
  // 平面投影 UV：让草地细节按世界尺度重复，而不是被拉伸
  const topUvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i += 1) {
    topUvs[i * 2] = positions[i * 3] / 7.5;
    topUvs[i * 2 + 1] = positions[i * 3 + 2] / 7.5;
  }
  topGeometry.setAttribute('uv', new THREE.BufferAttribute(topUvs, 2));
  const grassSurface = getSurface('grass', 1);
  const topMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    map: grassSurface.map,
    bumpMap: grassSurface.bump,
    bumpScale: 0.055,
    flatShading: false,
  });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.receiveShadow = true;
  top.castShadow = false;
  root.add(top);

  // 侧面的低多边形崖壁
  const wallPositions = [];
  const wallColors = [];
  const wallIndices = [];
  const levels = [
    { r: 1.0, y: 0.0, color: 0.0 },
    { r: 1.025, y: 0.62, color: 0.18 },
    { r: 0.99, y: 1.12, color: 0.5 },
    { r: 0.86, y: 1.9, color: 0.72 },
    { r: 0.62, y: 2.8, color: 0.9 },
  ];
  const cliff = new THREE.Color(palette.cliff);
  const darkCliff = cliff.clone().multiplyScalar(0.52);
  const sandColor = new THREE.Color(palette.sand ?? '#e4ca96');
  levels.forEach((level, levelIndex) => {
    for (let seg = 0; seg < segments; seg += 1) {
      const angle = (seg / segments) * Math.PI * 2;
      const edge = topPoint(radius, angle, 1, seed);
      const edgeY = terrainY(1, angle, seed);
      const jitter = 1 + Math.sin(seg * 1.9 + levelIndex * 2.4) * 0.035;
      wallPositions.push(
        edge.x * level.r * jitter,
        edgeY - level.y + (levelIndex === 0 ? -0.012 : 0),
        edge.z * level.r * jitter,
      );
      tmpColor.copy(levelIndex < 2 ? sandColor : cliff).lerp(darkCliff, level.color);
      if (levelIndex === 1) tmpColor.multiplyScalar(0.94);
      wallColors.push(tmpColor.r, tmpColor.g, tmpColor.b);
    }
  });
  for (let level = 0; level < levels.length - 1; level += 1) {
    for (let seg = 0; seg < segments; seg += 1) {
      const nextSeg = (seg + 1) % segments;
      const a = level * segments + seg;
      const b = level * segments + nextSeg;
      const c = (level + 1) * segments + seg;
      const d = (level + 1) * segments + nextSeg;
      wallIndices.push(a, c, b, b, c, d);
    }
  }
  const cliffGeometry = new THREE.BufferGeometry();
  cliffGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
  cliffGeometry.setAttribute('color', new THREE.Float32BufferAttribute(wallColors, 3));
  cliffGeometry.setIndex(wallIndices);
  cliffGeometry.computeVertexNormals();
  const cliffUvs = new Float32Array((wallPositions.length / 3) * 2);
  for (let i = 0; i < wallPositions.length / 3; i += 1) {
    const x = wallPositions[i * 3];
    const y = wallPositions[i * 3 + 1];
    const z = wallPositions[i * 3 + 2];
    cliffUvs[i * 2] = (Math.atan2(z, x) * radius) / 6;
    cliffUvs[i * 2 + 1] = y / 3.2;
  }
  cliffGeometry.setAttribute('uv', new THREE.BufferAttribute(cliffUvs, 2));
  const stoneSurface = getSurface('stone', 1);
  const cliffMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    map: stoneSurface.map,
    bumpMap: stoneSurface.bump,
    bumpScale: 0.11,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const cliffMesh = new THREE.Mesh(cliffGeometry, cliffMaterial);
  cliffMesh.receiveShadow = true;
  cliffMesh.castShadow = false;
  root.add(cliffMesh);

  // 水下深色基座
  mesh(root, new THREE.CylinderGeometry(radius * 0.64, radius * 0.3, 5.2, 32), material('#2c4b4c', { roughness: 1 }), [0, -3.4, 0], [0, 0, 0], [1, 1, 1], false);

  // 海水泡沫
  const foamGroup = new THREE.Group();
  const foamMat = new THREE.MeshBasicMaterial({
    color: palette.foam ?? '#d6eee2',
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  [1.015, 1.09, 1.16].forEach((scale, index) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * scale, radius * scale + 0.13 + index * 0.08, 64), foamMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2 + index * 0.004;
    foamGroup.add(ring);
  });
  root.add(foamGroup);
  addTick(foamGroup, (t) => {
    foamGroup.children.forEach((ring, index) => {
      ring.material.opacity = 0.1 + Math.sin(t * 0.7 + index * 1.7) * 0.045;
    });
    foamGroup.scale.setScalar(1 + Math.sin(t * 0.4) * 0.007);
  });

  // 岛上的细碎生命：草与花全部来自 mox 的贴图（见 meadow.js），
  // 这里不再生成程序化的草叶与野花。
  shadows(root, true, true);
  if (!options.noButterflies) {
    const butterflies = createButterflies({ count: 5, radius: radius * 0.32, center: new THREE.Vector3(0, 0, 0), seed: seed + 17 });
    butterflies.position.y = GROUND_Y - 0.12;
    root.add(butterflies);
  }
  return root;
}

function groundPatch(parent, x, z, radius = 1.2, color = '#c8b184', y = GROUND_Y + 0.015, opacity = 0.75) {
  const mat = material(color, { roughness: 1, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 14), mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(x, y, z);
  patch.receiveShadow = true;
  parent.add(patch);
  return patch;
}

function makeTextPlane(text, color = '#f3e4c2', options = {}) {
  const width = options.canvasWidth ?? 512;
  const height = options.canvasHeight ?? 160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = options.border ?? color;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, width - 16, height - 16);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (options.vertical) {
    const characters = [...text];
    const size = Math.min(width * 0.6, (height * 0.82) / Math.max(1, characters.length));
    ctx.font = options.font ?? `600 ${Math.floor(size)}px "STKaiti", "KaiTi", "Georgia", serif`;
    const step = height / (characters.length + 0.35);
    characters.forEach((character, index) => {
      ctx.fillText(character, width / 2, step * (index + 0.75));
    });
  } else {
    ctx.font = options.font ?? `600 ${Math.floor(height * 0.46)}px "STKaiti", "KaiTi", "Georgia", serif`;
    ctx.fillText(text, width / 2, height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  mat.userData.uniqueTexture = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(options.width ?? 3, options.height ?? 0.9), mat);
  return plane;
}

function createBridgeSegment(expansion, color = '#8b6748') {
  const root = new THREE.Group();
  const deckY = GROUND_Y + 0.02;
  const length = Math.abs(expansion.bridge.to - expansion.bridge.from);
  const horizontal = expansion.bridge.axis === 'x';
  const center = (expansion.bridge.from + expansion.bridge.to) / 2;
  for (let i = 0; i < Math.ceil(length / 0.55); i += 1) {
    const along = expansion.bridge.from + (i + 0.5) * (length / Math.ceil(length / 0.55));
    if (horizontal) {
      mesh(root, new THREE.BoxGeometry(0.52, 0.12, 2.0), i % 2 ? M.wood(color) : M.woodLight(), [along, deckY, expansion.bridge.cross], [0, 0, 0]);
    } else {
      mesh(root, new THREE.BoxGeometry(2.0, 0.12, 0.52), i % 2 ? M.wood(color) : M.woodLight(), [expansion.bridge.cross, deckY, along], [0, 0, 0]);
    }
  }
  for (let i = 0; i <= 6; i += 1) {
    const along = expansion.bridge.from + (length / 6) * i;
    for (const offset of [-1.05, 1.05]) {
      if (horizontal) {
        mesh(root, new THREE.CylinderGeometry(0.065, 0.075, 0.9, 5), M.woodDark(), [along, deckY + 0.45, expansion.bridge.cross + offset]);
      } else {
        mesh(root, new THREE.CylinderGeometry(0.065, 0.075, 0.9, 5), M.woodDark(), [expansion.bridge.cross + offset, deckY + 0.45, along]);
      }
    }
  }
  for (const offset of [-1.05, 1.05]) {
    if (horizontal) {
      mesh(root, new THREE.BoxGeometry(length, 0.06, 0.06), M.woodDark(), [center, deckY + 0.82, expansion.bridge.cross + offset]);
    } else {
      mesh(root, new THREE.BoxGeometry(0.06, 0.06, length), M.woodDark(), [expansion.bridge.cross + offset, deckY + 0.82, center]);
    }
  }
  return root;
}

function createExpansionGroup(expansion, state, seed) {
  const root = new THREE.Group();
  const islet = createTerrain(expansion.radius, { ...expansion.palette, foam: '#d9eee1' }, seed, { grassCount: 14 });
  islet.position.set(expansion.center.x, 0, expansion.center.z);
  root.add(islet);
  root.add(createBridgeSegment(expansion));
  // 小岛上的自然装饰，避开中央建造区
  const rng = mulberry32(seed + 55);
  for (let i = 0; i < 5; i += 1) {
    const angle = rng() * Math.PI * 2;
    const ratio = 0.64 + rng() * 0.2;
    const px = expansion.center.x + Math.cos(angle) * expansion.radius * ratio;
    const pz = expansion.center.z + Math.sin(angle) * expansion.radius * ratio;
    let decor = null;
    if (jungle.ready) {
      decor = i % 3 === 0
        ? jungle.random(rng, { scale: 0.62, keys: ['palm_a', 'palm_b', 'palm_queen'] })
        : jungle.random(rng, { scale: 0.45, keys: ['fern', 'bush', 'elephant'] });
    }
    if (!decor && tropical.ready) decor = tropical.randomPalm(rng, { scale: 0.66 });
    if (!decor) decor = tropical.create('beach-rock', { scale: 0.4 }) ?? createRock(seed + i, '#8b8f83', 0.45);
    decor.position.set(px, GROUND_Y, pz);
    root.add(decor);
  }
  if (tropical.ready) {
    for (let i = 0; i < 3; i += 1) {
      const plant = tropical.create(i === 2 ? 'fern' : 'beach-grass', { scale: 0.7 + rng() * 0.5, rotation: rng() * Math.PI * 2 });
      if (!plant) continue;
      const angle = rng() * Math.PI * 2;
      const radius = expansion.radius * (0.72 + rng() * 0.16);
      plant.position.set(
        expansion.center.x + Math.cos(angle) * radius,
        GROUND_Y - 0.02,
        expansion.center.z + Math.sin(angle) * radius,
      );
      root.add(plant);
    }
  }
  const sign = createSignpost(expansion.name.slice(0, 2), '#e2c18a');
  const bridgeDir = expansion.bridge.axis === 'x'
    ? Math.sign(expansion.center.x - expansion.bridge.cross)
    : expansion.bridge.cross;
  sign.position.set(
    expansion.center.x + (expansion.bridge.axis === 'x' ? -expansion.radius * 0.5 : 1.5),
    GROUND_Y,
    expansion.center.z + (expansion.bridge.axis === 'x' ? 1.7 : expansion.bridge.to / Math.abs(expansion.bridge.to) * expansion.radius * 0.35),
  );
  sign.rotation.y = expansion.bridge.axis === 'x' ? (bridgeDir > 0 ? -Math.PI / 2 : Math.PI / 2) : 0;
  root.add(sign);
  return root;
}

function createNpc(avatar, options = {}) {
  const looks = {
    alan: { robe: '#3e675f', robeDark: '#2a4b46', trim: '#e3c17d', skin: '#eac6a2', hair: '#343f39', scarf: '#c6a765', hat: 'conical', backpack: true },
    player: { robe: '#43776e', robeDark: '#2e574f', trim: '#e5c17f', skin: '#e6bea0', hair: '#4e392d', scarf: '#e0bd78', hat: null, backpack: true },
    sage: { robe: '#6d807d', robeDark: '#4d5b59', trim: '#dac591', skin: '#e7c7a7', hair: '#e6e1d4', hat: 'hood', staff: true },
    compass: { robe: '#405e6a', robeDark: '#2b414a', trim: '#d7bf83', skin: '#e5c3a2', hair: '#b2b1a8', hat: 'cap' },
    smith: { robe: '#73543b', robeDark: '#4c3a2a', trim: '#d0a461', skin: '#d9a77f', hair: '#985133', hat: null, scarf: '#8b5f43' },
    alchemist: { robe: '#584b6b', robeDark: '#3e354e', trim: '#a5d6bc', skin: '#e6c2a7', hair: '#725c8d', hat: 'hood', staff: true },
    gardener: { robe: '#5c7a4d', robeDark: '#3f5838', trim: '#e4bd74', skin: '#d8aa84', hair: '#5b4430', hat: 'straw', backpack: true },
    sailor: { robe: '#3d5c6d', robeDark: '#29434f', trim: '#ddc98e', skin: '#e0b896', hair: '#303b43', hat: 'cap', scarf: '#c9b375' },
    merchant: { robe: '#72563b', robeDark: '#4e3b2a', trim: '#dcb36a', skin: '#d9ad84', hair: '#4a3526', hat: 'straw', backpack: true },
    scholar: { robe: '#53665b', robeDark: '#3b4a41', trim: '#d7c18f', skin: '#e3c3a3', hair: '#42362f', hat: 'none' },
    miya: { robe: '#6b593f', robeDark: '#4a3e2e', trim: '#d7b873', skin: '#ecc4a1', hair: '#c4a16d', hat: 'goggles' },
    child: { robe: '#4f7483', robeDark: '#38545f', trim: '#e5c884', skin: '#ecc5a4', hair: '#3c3530', hat: null, backpack: true },
    ahe: { robe: '#637e49', robeDark: '#455d36', trim: '#e4bd77', skin: '#e0b38c', hair: '#57412e', hat: 'straw' },
    lingbo: { robe: '#425f6e', robeDark: '#2c424d', trim: '#ddc688', skin: '#e1ba99', hair: '#303a41', hat: 'cap', scarf: '#d6bf88' },
    luxu: { robe: '#71583e', robeDark: '#4e3c2b', trim: '#ddb46b', skin: '#dfb68f', hair: '#3f3128', hat: null },
  };
  const config = looks[avatar] ?? looks.player;
  const character = createCharacter({ ...config, ...options });
  character.scale.setScalar(1.03);
  return character;
}

function addResourceNode({
  parent, interactions, blockers, id, x, z, type = 'tree', label, model, object, yields, glyph,
  color = '#e8cf96', range = 3.0, markerHeight = null,
}) {
  const visual = object ?? model;
  if (!visual) return;
  visual.position.set(x, GROUND_Y, z);
  parent.add(visual);
  const gatherKind = type;
  addInteraction(interactions, {
    id,
    kind: 'gather',
    object: visual,
    position: { x, z },
    label,
    prompt: '采集',
    action: 'gather',
    glyph,
    markerColor: color,
    range,
    markerHeight: markerHeight ?? (type === 'tree' ? 3.2 : type === 'mushroom' ? 1.6 : 1.7),
    data: { gatherKind, yields, label },
  });
  addBlocker(blockers, x, z, 0.9, 'resource');
  return visual;
}

/**
 * Build a dock out of the pack's simple jetty sections. Each section is
 * 3.07 m long along local X, so we rotate it onto the world +Z axis and
 * stretch the deck width slightly. The original nine-metre procedural pier
 * becomes three connected timber sections, with the broken state leaving a
 * real gap for the repair quest.
 */
function createTropicalDockVisual({ broken = false, accent = '#d7b56f', sections = 3, canopy = false } = {}) {
  if (!tropical.has('jetty-simple')) return null;
  const root = new THREE.Group();
  const base = tropical.getSize('jetty-simple');
  const sectionLength = base.x * 1.08;
  const sectionScale = new THREE.Vector3(1.08, 0.94, 2.05);
  for (let i = 0; i < sections; i += 1) {
    if (broken && i === 1) continue;
    const section = tropical.create('jetty-simple', { scale: 1 });
    section.rotation.y = -Math.PI / 2;
    section.scale.copy(sectionScale);
    section.position.set(0, 0, sectionLength * (i + 0.5));
    root.add(section);
  }
  const lantern = createLanternPost(accent);
  lantern.position.set(-0.85, 0, sectionLength * sections - 0.35);
  lantern.scale.setScalar(0.82);
  root.add(lantern);

  if (canopy && tropical.has('jetty')) {
    const cover = tropical.create('jetty', { scale: 1 });
    cover.rotation.y = -Math.PI / 2;
    cover.scale.set(0.58, 0.52, 0.76);
    cover.position.set(0, 0.1, sectionLength * (sections - 1) + 0.35);
    root.add(cover);
  }

  if (broken) {
    mesh(root, new THREE.BoxGeometry(1.1, 0.12, 1.7), M.wood(), [0.55, 0.32, sectionLength * 1.7], [0.24, 0, -0.65]);
    mesh(root, new THREE.BoxGeometry(0.14, 1.5, 0.14), M.woodDark(), [1.15, 0.85, sectionLength * 1.4], [0.35, 0, 0.28]);
    const flag = mesh(root, new THREE.PlaneGeometry(0.9, 0.5), material('#e5d6b7', { side: THREE.DoubleSide, roughness: 0.95 }), [1.15, 1.85, sectionLength * 1.4], [0, 0.35, 0.15]);
    flag.castShadow = false;
  }
  root.userData.dockLength = sectionLength * sections;
  return root;
}

function addTropicalShore({
  parent,
  island,
  rng,
  blockers,
  walkRadius = island.walkRadius ?? 13,
  count = 5,
  withFoliage = true,
  withHut = false,
  radiusRatio = 0.92,
}) {
  if (!tropical.ready) return;
  const dockAngle = Math.atan2(10.6, -5.6);
  const baseAngles = [0.28, 0.82, 3.48, 4.2, 5.0, 5.7];
  for (let i = 0; i < count; i += 1) {
    let angle = baseAngles[i % baseAngles.length] + (rng() - 0.5) * 0.2;
    if (Math.abs(angle - dockAngle) < 0.32) angle += 0.48;
    const radius = walkRadius * (radiusRatio + rng() * 0.04);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const key = i === 1 && tropical.has('cecropia') ? 'cecropia'
      : i === 3 && tropical.has('banana') ? 'banana'
        : null;
    const scale = key === 'cecropia' ? 0.52 : key === 'banana' ? 0.95 : 0.88 + rng() * 0.24;
    const tree = key ? tropical.create(key, { scale, rotation: rng() * Math.PI * 2 }) : tropical.randomPalm(rng, { scale });
    if (!tree) continue;
    tree.position.set(x, GROUND_Y - 0.03, z);
    parent.add(tree);
    addBlocker(blockers, x, z, key ? 0.9 : 0.65, 'scenery');
    const grass = tropical.create('beach-grass', { scale: 0.8 + rng() * 0.8, rotation: rng() * Math.PI * 2 });
    if (grass) {
      grass.position.set(x + (rng() - 0.5) * 2.0, GROUND_Y, z + (rng() - 0.5) * 2.0);
      parent.add(grass);
    }
  }

  if (withFoliage) {
    for (let i = 0; i < 8; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = walkRadius * (0.78 + rng() * 0.18);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const key = i % 3 === 0 && tropical.has('elephant-ear') ? 'elephant-ear'
        : i % 3 === 1 && tropical.has('fern') ? 'fern'
          : 'beach-grass';
      const plant = tropical.create(key, { scale: key === 'beach-grass' ? 0.8 + rng() * 0.7 : 0.7 + rng() * 0.45, rotation: rng() * Math.PI * 2 });
      if (!plant) continue;
      plant.position.set(x, GROUND_Y - 0.02, z);
      parent.add(plant);
    }
  }

  for (let i = 0; i < 3; i += 1) {
    const angle = 2.6 + i * 1.4 + rng() * 0.4;
    const radius = walkRadius * (0.88 + rng() * 0.08);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rock = tropical.create(i % 2 ? 'beach-rock' : 'stone', { scale: 0.28 + rng() * 0.2, rotation: rng() * Math.PI * 2 });
    if (!rock) continue;
    rock.position.set(x, GROUND_Y - 0.02, z);
    parent.add(rock);
    addBlocker(blockers, x, z, 0.55, 'scenery');
  }

  if (withHut && tropical.has('hut')) {
    const hut = tropical.create('hut', { scale: 0.58, rotation: -0.35 });
    hut.position.set(8.3, GROUND_Y - 0.02, 12.5);
    parent.add(hut);
    addBlocker(blockers, 8.3, 12.5, 2.5, 'hut');
    const crate = tropical.create('crate', { scale: 0.55, rotation: 0.45 });
    if (crate) {
      crate.position.set(5.4, GROUND_Y, 13.7);
      parent.add(crate);
    }
  }
}

/**
 * 沙滩上的生活痕迹：阳伞、躺椅、浮圈、皮球、冰桶……
 * 模型来自 mox/cartoon_beach_prop_pack，绕着岛缘的沙带摆一圈。
 */
function createBeachLife(parent, island, rng, blockers, yAt) {
  if (!beach.ready) return;
  const walk = island.walkRadius;
  const group = new THREE.Group();
  group.name = 'beach-life';
  parent.add(group);

  const chairKeys = ['chair_01', 'chair_02', 'chair_03', 'chair_04'].filter((key) => beach.has(key));
  const floatKeys = ['float_01', 'float_02', 'float_03', 'float_04'].filter((key) => beach.has(key));
  const clusters = Math.max(3, Math.round(walk / 6));

  const drop = (key, x, z, rotation, scale = 1) => {
    const object = beach.create(key, { scale, rotation });
    if (!object) return null;
    const ratio = Math.hypot(x, z) / island.radius;
    object.position.set(x, yAt(Math.min(0.99, ratio), Math.atan2(z, x)) - 0.02, z);
    group.add(object);
    blockers.push({ x, z, radius: 0.55, type: 'beach-prop' });
    return object;
  };

  for (let i = 0; i < clusters; i += 1) {
    const angle = (i / clusters) * Math.PI * 2 + rng() * 0.42;
    const radius = walk * (0.88 + rng() * 0.05);
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    // 码头正前方留一条上船的路
    if (Math.abs(x) < 7 && z > walk * 0.72) continue;
    const spot = resolveFreePosition(x, z, blockers, { radius: 2.4, limit: walk * 1.02 });
    if (Math.hypot(spot.x, spot.z) > walk + 0.5) continue;

    const face = angle + Math.PI; // 躺椅冲海里
    drop('parasol', spot.x, spot.z, rng() * Math.PI * 2, 1);
    const chairs = 1 + Math.floor(rng() * 2);
    for (let c = 0; c < chairs && chairKeys.length; c += 1) {
      const key = chairKeys[Math.floor(rng() * chairKeys.length) % chairKeys.length];
      const cx = spot.x + Math.sin(face + Math.PI * 0.5) * (1.1 + c * 1.15);
      const cz = spot.z + Math.cos(face + Math.PI * 0.5) * (1.1 + c * 1.15);
      drop(key, cx, cz, face + (rng() - 0.5) * 0.3);
    }
    if (beach.has('cooler') && rng() > 0.4) {
      drop('cooler', spot.x - Math.sin(face) * 1.4, spot.z - Math.cos(face) * 1.4, rng() * Math.PI);
    }
    if (beach.has('ball') && rng() > 0.5) {
      drop('ball', spot.x + 1.9, spot.z + 0.6, rng() * Math.PI);
    }
    if (beach.has('picnic_basket') && rng() > 0.6) {
      drop('picnic_basket', spot.x - 1.7, spot.z + 1.2, rng() * Math.PI);
    }
    if (beach.has('toy_bucket') && rng() > 0.55) {
      drop('toy_bucket', spot.x + 0.8, spot.z + 2.1, rng() * Math.PI);
    }
  }

  // 水边漂着的浮圈
  if (floatKeys.length) {
    for (let i = 0; i < 4; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = walk * (0.995 + rng() * 0.03);
      const key = floatKeys[Math.floor(rng() * floatKeys.length) % floatKeys.length];
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const object = beach.create(key, { scale: 1, rotation: rng() * Math.PI * 2 });
      if (!object) continue;
      object.position.set(x, 0.55 + rng() * 0.06, z);
      group.add(object);
    }
  }
}

/**
 * 码头的生活痕迹：木桶、板条箱、干草、麻袋，再加一盏灯。
 * 码头是每座岛的第一眼，光秃秃的栈桥不像有人住。
 */
function decorateDock(parent, blockers, rng, { x, z, angle, groundY = GROUND_Y, scale = 1 }) {
  const random = rng ?? Math.random;
  const group = new THREE.Group();
  group.name = 'dock-props';
  parent.add(group);
  const side = { x: Math.cos(angle), z: -Math.sin(angle) };
  const props = [
    { piece: 'Crate', offset: -1.9, depth: 0.5, scale: 2.1 },
    { piece: 'Barrel', offset: 1.7, depth: 0.6, scale: 2.0 },
    { piece: 'Barrel', offset: 2.3, depth: -0.2, scale: 1.8 },
    { piece: 'Bags', offset: 1.1, depth: -1.1, scale: 1.9 },
    { piece: 'Hay', offset: -1.4, depth: -1.0, scale: 2.0 },
  ];
  for (const prop of props) {
    if (!village.has(prop.piece)) continue;
    const object = village.create(prop.piece, {
      scale: prop.scale * scale,
      rotation: random() * Math.PI * 2,
    });
    if (!object) continue;
    object.position.set(
      x + side.x * prop.offset - Math.sin(angle) * prop.depth,
      groundY - 0.02,
      z + side.z * prop.offset - Math.cos(angle) * prop.depth,
    );
    group.add(object);
  }
  const lantern = createLanternPost('#ffd9a0');
  lantern.position.set(x + side.x * 2.4 - Math.sin(angle) * 1.4, groundY, z + side.z * 2.4 - Math.cos(angle) * 1.4);
  group.add(lantern);
  return group;
}

function createHomeScenery(parent, island, state, rng, blockers) {
  const ground = new THREE.Group();
  parent.add(ground);
  // 岛上的树：阔叶树来自 Ultimate Stylized Nature，岸线交给热带棕榈
  for (let i = 0; i < 26; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = island.walkRadius * (0.8 + rng() * 0.16);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 8 && z > island.walkRadius * 0.7) continue;
    const nearShore = radius > island.walkRadius * 0.9;
    const tree = nearShore
      ? jungle.random(rng, { scale: 0.8, keys: ['palm_a', 'palm_b', 'palm_queen', 'palm_beach'] })
      : nature.random(rng, { scale: 0.85, keys: HOME_TREES });
    if (!tree) continue;
    tree.position.set(x, GROUND_Y - 0.06, z);
    ground.add(tree);
    addBlocker(blockers, x, z, 0.55, 'scenery');
  }
  // 岸边成片的蕨类与灌木
  for (let i = 0; i < 18; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = island.walkRadius * (0.72 + rng() * 0.24);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const bush = jungle.random(rng, { scale: 0.5, keys: ['fern', 'bush', 'elephant'] });
    if (!bush) continue;
    bush.position.set(x, GROUND_Y - 0.04, z);
    ground.add(bush);
  }
  // 云影里的旧船，非交互
  const boat = createBoat('#d4ad69');
  boat.position.set(-3.6, 0.55, 19.6);
  boat.scale.setScalar(0.6);
  boat.rotation.y = 0.35;
  parent.add(boat);
  // 岛牌：立在进村的路口
  const sign = createSignpost('栖云岛', '#e0c184');
  sign.position.set(-4.6, GROUND_Y, 13.4);
  sign.rotation.y = 0.3;
  parent.add(sign);
  addBlocker(blockers, -4.6, 13.4, 0.7, 'scenery');

  // 把海滩真正种出来：林缘棕榈、贴地海草、海蚀岩与一间木栈小屋。
  addTropicalShore({
    parent,
    island,
    rng,
    blockers,
    walkRadius: 18.4,
    count: 3,
    withFoliage: true,
    withHut: true,
  });
}

/**
 * 营地三档：议事厅 Level1 / Level2 / Level3。
 * 开局只有最低的一档；把它扩成木寨、石厅，需要先答完对应的题目。
 */
export const CAMP_LEVELS = [
  { level: 1, key: 'TownCenter_FirstAge_Level1', width: 11, height: 4.0, title: '草棚议事厅' },
  { level: 2, key: 'TownCenter_FirstAge_Level2', width: 12, height: 5.6, title: '木寨议事厅' },
  { level: 3, key: 'TownCenter_FirstAge_Level3', width: 13, height: 7.0, title: '石厅议事厅' },
];

function buildHomeCamp(parent, state, blockers) {
  const level = clamp(Math.round(state?.flags?.campLevel ?? 1), 1, 3);
  const entry = CAMP_LEVELS[level - 1];
  const model = rts.create(entry.key, { targetWidth: entry.width });
  if (!model) return null;
  model.position.set(0, GROUND_Y, 0);
  model.rotation.y = 0.2;
  model.name = 'home-camp';
  parent.add(model);
  const footprint = rts.footprint(entry.key, { targetWidth: entry.width });
  addBlocker(blockers, 0, 0, Math.max(3.4, Math.max(footprint.w, footprint.d) * 0.42), 'camp');
  return { object: model, level, title: entry.title, height: entry.height, x: 0, z: 0 };
}

function homeBaseInteractions(parent, island, state, interactions, blockers, camp = null) {
  // 营地：可休息，也是「升级房子」的入口。模型缺失时退回旧帐篷，休息功能不丢。
  if (camp?.object) {
    addInteraction(interactions, {
      id: 'home-tent',
      kind: 'station',
      object: camp.object,
      position: { x: camp.x, z: camp.z },
      label: '回营地歇一晚',
      prompt: `营地 · ${camp.title}`,
      action: 'sleep',
      glyph: '息',
      markerColor: '#f0cf95',
      markerHeight: camp.height + 0.8,
      range: 5.4,
    });
    if (camp.level < 3) {
      addInteraction(interactions, {
        id: 'home-camp-upgrade',
        kind: 'station',
        object: camp.object,
        position: { x: camp.x + 1.6, z: camp.z + 1.6 },
        label: camp.level === 1 ? '把营地扩成木寨' : '把营地扩成石厅',
        prompt: '营地',
        action: 'upgrade-camp',
        glyph: '筑',
        markerColor: '#e9c88c',
        markerHeight: camp.height + 2.4,
        range: 5.8,
      });
    }
  } else {
    const tent = createTent();
    tent.position.set(0, GROUND_Y, -3.0);
    parent.add(tent);
    addInteraction(interactions, {
      id: 'home-tent',
      kind: 'station',
      object: tent,
      position: { x: 0, z: -3.0 },
      label: '回帐篷休息',
      prompt: '旧帐篷',
      action: 'sleep',
      glyph: '息',
      markerColor: '#f0cf95',
      markerHeight: 3.2,
      range: 3.2,
    });
    addBlocker(blockers, 0, -3.0, 2.3, 'tent');
  }

  // 营地边上的火堆：围一圈石头，夜里有个聚会的地方。
  {
    const fireSpot = camp ? { x: 9.2, z: 4.6 } : { x: 4.9, z: 3.0 };
    const fireRing = new THREE.Group();
    const fire = mesh(fireRing, new THREE.ConeGeometry(0.33, 0.9, 5), new THREE.MeshBasicMaterial({ color: '#ffad56', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), [0, 0.42, 0]);
    const fire2 = mesh(fireRing, new THREE.ConeGeometry(0.2, 0.65, 5), new THREE.MeshBasicMaterial({ color: '#ffe5a1', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), [0.06, 0.38, 0.02], [0, 0, 0.16]);
    fire.castShadow = false;
    fire2.castShadow = false;
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      mesh(fireRing, new THREE.DodecahedronGeometry(0.16, 0), M.stone(), [Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55], [0, a, 0], [1, 0.65, 1]);
    }
    for (let i = 0; i < 3; i += 1) {
      mesh(fireRing, new THREE.CylinderGeometry(0.07, 0.1, 0.7, 5), M.bark(), [0.05 * i, 0.2, 0], [0.9, i * 1.1, 0.2]);
    }
    const fireGlow = glowSprite('#ffb363', 2.2, 0.4);
    fireGlow.position.y = 0.5;
    fireRing.add(fireGlow);
    fireRing.position.set(fireSpot.x, GROUND_Y, fireSpot.z);
    parent.add(fireRing);
    addBlocker(blockers, fireSpot.x, fireSpot.z, 1.1, 'campfire');
    addTick(fireRing, (t) => {
      fire.scale.y = 0.86 + Math.sin(t * 7) * 0.14;
      fire2.rotation.y = t * 0.7;
      fireGlow.material.opacity = 0.37 + Math.sin(t * 4.2) * 0.09;
    });
  }

  // 信箱：立在广场北侧的客栈门口
  const mailboxSpot = resolveFreePosition(-9.2, -11.0, blockers, { radius: 0.9, limit: 30 });
  const mailbox = createMailbox();
  mailbox.position.set(mailboxSpot.x, GROUND_Y, mailboxSpot.z);
  mailbox.rotation.y = -0.35;
  parent.add(mailbox);
  addInteraction(interactions, {
    id: 'home-mailbox',
    kind: 'station',
    object: mailbox,
    position: { x: mailboxSpot.x, z: mailboxSpot.z },
    label: '查看岛上来信',
    prompt: '木信箱',
    action: 'mailbox',
    glyph: '信',
    markerColor: '#e6cb91',
    markerHeight: 1.8,
    range: 3,
  });
  addBlocker(blockers, mailboxSpot.x, mailboxSpot.z, 0.8, 'mailbox');

  // 田地：村子南边、通往码头那条街的旁边，正好在广场与马厩之间
  const greenhouse = state.hasBuilding('greenhouse');
  const farmTargets = [
    { x: -7.0, z: 20.0 },
    { x: -4.4, z: 22.6 },
    { x: -9.2, z: 23.4 },
  ];
  STARTING_PLOTS.forEach((plot, index) => {
    const plotState = state.plots.find((entry) => entry.id === plot.id) ?? { ...plot, seed: null, plantedDay: null };
    let crop = null;
    let growth = 0;
    if (plotState.seed) {
      crop = plotState.seed;
      const info = CROPS_BY_ID[crop];
      const growDays = Math.max(1, info.days - (greenhouse ? 1 : 0));
      const elapsed = Math.max(0, state.day - (plotState.plantedDay ?? state.day));
      growth = clamp(elapsed / growDays, 0, 1);
    }
    const target = farmTargets[index % farmTargets.length];
    const spot = resolveFreePosition(target.x, target.z, blockers, { radius: 1.7, limit: island.walkRadius - 3 });
    const bed = createFarmPlot({ ...plot, x: spot.x, z: spot.z }, crop, growth, island.accent);
    parent.add(bed);
    addInteraction(interactions, {
      id: `home-farm-${plot.id}`,
      kind: 'farm',
      object: bed,
      position: { x: spot.x, z: spot.z },
      label: crop && growth >= 1 ? '收获作物' : crop ? '查看田垄' : '种下种子',
      prompt: '田垄',
      action: 'farm',
      glyph: '田',
      markerColor: '#e3cf91',
      markerHeight: 1.8,
      range: 3.2,
      data: { plotId: plot.id },
    });
    addBlocker(blockers, spot.x, spot.z, 1.3, 'farm');
  });

  // 知海树：村子西南的草坡上，老树一个人待着
  const treeSpot = resolveFreePosition(-24.0, 12.0, blockers, { radius: 2.2, limit: island.walkRadius - 3 });
  const knowledgeTree = jungle.create('cecropia', { scale: 1.05, rotation: 0.6 })
    ?? jungle.create('palm_queen', { scale: 1.1 })
    ?? createKnowledgeTree();
  knowledgeTree.position.set(treeSpot.x, GROUND_Y, treeSpot.z);
  parent.add(knowledgeTree);
  addInteraction(interactions, {
    id: 'home-knowledge-tree',
    kind: 'codex',
    object: knowledgeTree,
    position: { x: treeSpot.x, z: treeSpot.z },
    label: '翻开知海',
    prompt: '知海树',
    action: 'codex',
    glyph: '知',
    markerColor: '#e6cf8f',
    markerHeight: 4.6,
    range: 3.8,
  });
  addBlocker(blockers, treeSpot.x, treeSpot.z, 2.2, 'tree');

  // 南岸码头和渡船：用环境包的木栈桥替换原来的程序化码头。
  const dock = createTropicalDockVisual({
    broken: !state.flags.dockRepaired,
    accent: island.accent,
    sections: 3,
    canopy: state.flags.dockRepaired,
  }) ?? createDock(!state.flags.dockRepaired, island.accent);
  const dockZ = island.walkRadius * 0.84;
  dock.position.set(0, GROUND_Y - 0.1, dockZ);
  parent.add(dock);
  addInteraction(interactions, {
    id: 'home-dock',
    kind: 'dock',
    object: dock,
    position: { x: 0, z: dockZ + 1.2 },
    label: state.flags.dockRepaired ? '展开海图，启航' : '修复南岸码头',
    prompt: state.flags.dockRepaired ? '渡口' : '断掉的码头',
    action: state.flags.dockRepaired ? 'open-map' : 'repair-dock',
    glyph: '船',
    markerColor: '#e1c381',
    markerHeight: 3.1,
    range: 3.4,
  });
  addBlocker(blockers, 0, dockZ + 2, 2, 'dock');
  decorateDock(parent, blockers, null, { x: 0, z: dockZ - 1.4, angle: 0, scale: 1 });

  // 守岛人：站在广场边上，谁来都先看见他
  const alanSpot = resolveFreePosition(-4.2, 6.0, blockers, { radius: 1.0, limit: 24 });
  const alan = createNpc('alan');
  alan.position.set(alanSpot.x, GROUND_Y, alanSpot.z);
  alan.rotation.y = -0.5;
  parent.add(alan);
  addInteraction(interactions, {
    id: 'npc-alan',
    kind: 'npc',
    object: alan,
    position: { x: alanSpot.x, z: alanSpot.z },
    label: '和守岛人聊聊',
    prompt: '阿岚',
    action: 'npc:alan',
    glyph: '谈',
    markerColor: '#e4c17d',
    markerHeight: 2.7,
    range: 3.2,
  });
  addBlocker(blockers, alanSpot.x, alanSpot.z, 0.9, 'npc');

  // 留居的旅人：散在广场周围
  const plaza = { x: 0, z: 0, radius: HOME_LAYOUT.plazaRadius };
  state.residents.forEach((residentId, index) => {
    const resident = RESIDENTS_BY_ID[residentId];
    if (!resident) return;
    const npc = createNpc(resident.avatar);
    const angle = (index / Math.max(1, state.residents.length)) * Math.PI * 2 + 0.6;
    const wanted = {
      x: plaza.x + Math.sin(angle) * plaza.radius * 0.62,
      z: plaza.z + Math.cos(angle) * plaza.radius * 0.62,
    };
    const spot = resolveFreePosition(wanted.x, wanted.z, blockers, { radius: 0.9, limit: plaza.radius + 3 });
    npc.position.set(spot.x, GROUND_Y, spot.z);
    npc.rotation.y = -0.4;
    parent.add(npc);
    addInteraction(interactions, {
      id: `resident-${resident.id}`,
      kind: 'resident',
      object: npc,
      position: { x: spot.x, z: spot.z },
      label: `和${resident.name}聊聊`,
      prompt: resident.name,
      action: `resident:${resident.id}`,
      glyph: '谈',
      markerColor: resident.color,
      markerHeight: 2.5,
      range: 3.1,
      data: { residentId: resident.id, wander: true, homeX: spot.x, homeZ: spot.z },
    });
    addBlocker(blockers, spot.x, spot.z, 0.75, 'resident');
  });
}

function addBuiltBuildings(parent, island, state, interactions, blockers) {
  const tier = state.getRank().tier;
  state.built.forEach((buildingData) => {
    const definition = BUILDINGS_BY_ID[buildingData.type];
    if (!definition) return;
    const model = createBuilding(buildingData.type, tier, {
      modelKey: definition.model,
      modelHeight: definition.modelHeight,
      modelWidth: definition.modelWidth,
      shadowRadius: (definition.radius ?? 2.4) * 0.92,
    });
    model.position.set(buildingData.x, GROUND_Y, buildingData.z);
    model.rotation.y = buildingData.rotation || 0;
    parent.add(model);
    const meta = buildingInteraction(buildingData.type);
    addInteraction(interactions, {
      id: `built-${buildingData.uid}`,
      kind: 'building',
      object: model,
      position: { x: buildingData.x, z: buildingData.z },
      label: meta.label,
      prompt: meta.prompt,
      action: meta.action,
      glyph: meta.glyph,
      markerColor: island.accent,
      markerHeight: buildingData.type === 'lighthouse' ? 6.4 : buildingData.type === 'observatory' ? 5.2 : 3.3,
      range: Math.max(3.1, definition.radius + 1.1),
      data: { buildingId: buildingData.uid, buildingType: buildingData.type },
    });
    addBlocker(blockers, buildingData.x, buildingData.z, definition.radius * 0.9, 'building');
  });
}

/**
 * 栖云岛：直接把苔溪镇的村子搬过来。
 * 布局、朝向、道具清单都来自原项目，只是整体收缩到岛的尺寸里。
 */
/** 家岛的树：白桦与枫树混着长 */
const HOME_TREES = ['BirchTree_1', 'BirchTree_2', 'MapleTree_1', 'MapleTree_2'];

/** 每座学科岛自己的树种，配合自己的气候 */
const ISLAND_TREES = {
  wen: ['MapleTree_1', 'MapleTree_2', 'MapleTree_3'],
  shu: ['BirchTree_1', 'BirchTree_3'],
  wu: ['BirchTree_2', 'MapleTree_3'],
  hua: ['MapleTree_2', 'BirchTree_4'],
  sheng: ['BirchTree_1', 'BirchTree_4', 'MapleTree_1'],
  ying: ['MapleTree_1', 'BirchTree_3'],
  gong: ['BirchTree_2', 'BirchTree_4'],
};

const HOME_LAYOUT = {
  // 岛放大到两倍之后，村子可以按苔溪镇原本的尺寸整座搬过来
  layoutScale: 1,
  buildingScale: 1,
  propScale: 1,
  center: { x: 0, z: 0 },
  plazaRadius: 11.5,
  rotation: 0,
  lane: Math.PI * 0.55,
  laneLength: 0.96,
  streetWidthScale: 1,
  ringRoad: true,
  subset: null,
};

/** 广场与主街上不长草，铺石板的地方留给石板 */
function villageClearAt(plazaRadius, streetAngle, streetLength = 24, laneAngle = null, laneLength = 0) {
  return (x, z) => {
    const distance = Math.hypot(x, z);
    if (distance < plazaRadius * 1.04) return true;
    const angle = Math.atan2(x, z);
    const off = (a) => {
      let delta = Math.abs(angle - a);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      return delta;
    };
    if (off(streetAngle) < 0.085 && distance < streetLength) return true;
    if (laneAngle !== null && off(laneAngle) < 0.06 && distance < plazaRadius + laneLength) return true;
    return false;
  };
}

function createHomeIsland(island, state, seed = 33, quality = 'high') {
  const root = new THREE.Group();
  const palette = island.palette;
  const layout = HOME_LAYOUT;
  const streetAngle = 0;
  const laneAngle = streetAngle + layout.lane;
  const terrain = createTerrain(island.radius, palette, seed, {
    quality,
    clearAt: villageClearAt(layout.plazaRadius, streetAngle, island.walkRadius * 0.94, laneAngle, layout.plazaRadius * layout.laneLength),
  });
  root.add(terrain);
  const rng = mulberry32(seed + 21);
  const interactions = [];
  const blockers = [];
  const solid = [];
  const navZones = [{ type: 'circle', x: 0, z: 0, r: island.walkRadius }];
  const buildZones = [{ type: 'circle', x: 0, z: 0, r: island.walkRadius - 4.2 }];

  createHomeScenery(root, island, state, rng, blockers);

  // 村子地面：草地 + 被踩实的土路 + 广场 + 环村道
  root.add(createVillageGround({
    center: layout.center,
    radius: island.walkRadius * 0.995,
    groundY: GROUND_Y,
    plazaRadius: layout.plazaRadius,
    streetAngle,
    laneAngle,
    laneLength: layout.laneLength,
    streetWidthScale: layout.streetWidthScale,
    ringRoad: layout.ringRoad,
    palette,
    seed,
    grassPhoto: groundTextures.images.get('grass'),
  }));
  // 广场与主街的石板（只铺广场中心，外圈留成踩实的土地）
  root.add(createPaving({
    center: layout.center,
    plazaRadius: layout.plazaRadius * 0.56,
    streetAngle,
    laneAngle,
    withLane: true,
    streetLength: island.walkRadius * 0.86,
    groundY: GROUND_Y,
    seed,
  }));

  // 岛心只留一座营地：RTS 建筑包里最低一档的议事厅。
  // 岛上其它房子一律空着，等玩家自己盖——盖到哪一档，由完成的题目决定。
  const camp = buildHomeCamp(root, state, blockers);
  if (camp) solid.push({ x: 0, z: 0, radius: 4.2 });

  // mox 的草叶与沙滩道具：草地铺满岛，沙滩沿岛缘摆一圈
  root.add(createMeadow({
    radius: island.radius,
    yAt: (ratio, angle) => terrainY(ratio, angle, seed),
    seed: seed + 3,
    quality,
    clearAt: villageClearAt(layout.plazaRadius, streetAngle, island.walkRadius * 0.94, laneAngle, layout.plazaRadius * layout.laneLength),
  }));
  createBeachLife(root, island, rng, blockers, (ratio, angle) => terrainY(ratio, angle, seed));

  homeBaseInteractions(root, island, state, interactions, blockers, camp);
  addBuiltBuildings(root, island, state, interactions, blockers);

  // 岛缘的扩建石碑：不用翻菜单，走过去按 E 就能把海变成土地
  EXPANSIONS.forEach((expansion) => {
    if (state.expansions.includes(expansion.id)) return;
    const angle = Math.atan2(expansion.center.z, expansion.center.x);
    const distance = island.walkRadius - 1.4;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const stele = createExpansionStele('扩', expansion.palette?.sand ?? '#e2c68c');
    stele.position.set(x, GROUND_Y - 0.02, z);
    stele.rotation.y = -angle + Math.PI / 2;
    root.add(stele);
    addInteraction(interactions, {
      id: `expand-${expansion.id}`,
      kind: 'expand',
      object: stele,
      position: { x, z },
      label: `扩建 · ${expansion.name}`,
      prompt: '岛屿扩建',
      action: `expand:${expansion.id}`,
      glyph: '扩',
      markerColor: expansion.palette?.sand ?? '#e2c68c',
      markerHeight: 2.6,
      range: 3.4,
    });
    addBlocker(blockers, x, z, 0.9, 'scenery');
  });

  // 可采集资源
  const resourceSpecs = [
    { x: -12.6, z: -2.0, type: 'broadleaf', label: '海岛榆', yields: { wood: 3 }, seed: 1 },
    { x: -11.0, z: 8.4, type: 'pine', label: '海风松', yields: { wood: 4 }, seed: 2 },
    { x: 10.8, z: 9.1, type: 'broadleaf', label: '阔叶树', yields: { wood: 3 }, seed: 3 },
    { x: 12.6, z: -5.0, type: 'pine', label: '老松', yields: { wood: 4 }, seed: 4 },
    { x: -4.3, z: -12.5, type: 'broadleaf', label: '岛北榆树', yields: { wood: 3 }, seed: 5 },
    { x: 6.5, z: -13.2, type: 'pine', label: '风折松', yields: { wood: 4 }, seed: 6 },
    { x: -14.0, z: -8.0, type: 'broadleaf', label: '背风树', yields: { wood: 3 }, seed: 7 },
    { x: 13.4, z: 3.2, type: 'rock', label: '潮痕石', yields: { stone: 3 }, seed: 8 },
    { x: 8.4, z: -8.9, type: 'rock', label: '白纹岩', yields: { stone: 4 }, seed: 9 },
    { x: -2.4, z: -14.2, type: 'rock', label: '旧岛岩', yields: { stone: 3 }, seed: 10 },
    { x: -13.6, z: 4.5, type: 'rock', label: '青苔石', yields: { stone: 3 }, seed: 11 },
    { x: 7.1, z: 5.2, type: 'bush', label: '红珠莓丛', yields: { food: 1, fiber: 2 }, seed: 12 },
    { x: 8.2, z: 1.7, type: 'bush', label: '红珠莓丛', yields: { food: 1, fiber: 2 }, seed: 13 },
    { x: -10.5, z: 11.1, type: 'bush', label: '海崖莓丛', yields: { food: 1, fiber: 2 }, seed: 14 },
    { x: -3.0, z: 11.3, type: 'fiber', label: '韧草', yields: { fiber: 3 }, seed: 15 },
    { x: 4.2, z: -10.4, type: 'fiber', label: '海风麻', yields: { fiber: 3 }, seed: 16 },
    { x: -14.4, z: 0.8, type: 'fiber', label: '沙滩芦苇', yields: { fiber: 2, food: 1 }, seed: 17 },
  ];
  const tropicalLabels = {
    broadleaf: ['海风椰', '珊瑚椰', '岛北椰树'],
    pine: ['王棕', '老椰树', '风折棕'],
    rock: ['潮痕礁石', '白纹礁岩', '旧岛礁石', '青苔礁石'],
  };
  resourceSpecs.forEach((spec, index) => {
    let model;
    let markerHeight = null;
    // 所有资源点都用模型库里的 GLB，不再现场拼几何体
    if (spec.type === 'rock') {
      const scale = 0.52 + (index % 2) * 0.12;
      model = tropical.has('beach-rock')
        ? tropical.create(index % 2 ? 'stone' : 'beach-rock', { scale, rotation: rng() * Math.PI * 2 })
        : jungle.random(rng, { scale: 1.1, keys: ['palm_a'] });
      markerHeight = 1.35;
    } else if (spec.type === 'bush') {
      model = jungle.random(rng, { scale: 0.55, keys: ['bush', 'fern'] });
    } else if (spec.type === 'fiber') {
      model = jungle.random(rng, { scale: 0.5, keys: ['fern', 'elephant'] });
    } else {
      model = jungle.random(rng, { scale: 0.9, keys: ['palm_a', 'palm_b', 'palm_queen', 'cecropia', 'copal'] });
      if (!model) model = tropical.randomPalm(rng, { scale: 0.86 });
      if (model) {
        const size = model.userData.jungleSize ?? model.userData.tropicalSize;
        if (size) markerHeight = Math.min(7.0, size.y * model.scale.y + 0.6);
      }
    }
    const labels = tropicalLabels[spec.type];
    const label = labels ? labels[index % labels.length] : spec.label;
    // 资源点原本散在岛腰上，现在要给村落让路：压到房子就顺着半径往外挪
    const spot = resolveFreePosition(spec.x * 1.9, spec.z * 1.9, blockers, {
      radius: spec.type === 'fiber' || spec.type === 'bush' ? 0.6 : 1.0,
      limit: island.walkRadius - 1.2,
    });
    addResourceNode({
      parent: root,
      interactions,
      blockers,
      id: `home-resource-${index}`,
      x: spot.x,
      z: spot.z,
      type: spec.type,
      label,
      object: model,
      yields: spec.yields,
      color: palette.accent,
      markerHeight,
    });
  });

  // 扩建外岛
  const expansionZones = [];
  state.expansions.forEach((expansionId, index) => {
    const expansion = EXPANSIONS.find((entry) => entry.id === expansionId);
    if (!expansion) return;
    const expansionGroup = createExpansionGroup(expansion, state, seed + 100 + index * 17);
    root.add(expansionGroup);
    const bridge = expansion.bridge;
    const cross = expansion.bridge.cross;
    navZones.push({ type: 'circle', x: expansion.center.x, z: expansion.center.z, r: expansion.radius - 1.1 });
    if (bridge.axis === 'x') {
      navZones.push({ type: 'rect', x1: Math.min(bridge.from, bridge.to) - 0.5, x2: Math.max(bridge.from, bridge.to) + 0.5, z1: cross - 1.05, z2: cross + 1.05 });
    } else {
      navZones.push({ type: 'rect', x1: cross - 1.05, x2: cross + 1.05, z1: Math.min(bridge.from, bridge.to) - 0.5, z2: Math.max(bridge.from, bridge.to) + 0.5 });
    }
    const buildZone = { type: 'circle', x: expansion.center.x, z: expansion.center.z, r: expansion.radius - 1.25 };
    buildZones.push(buildZone);
    expansionZones.push(expansion);
  });

  // 把中心区域里过于靠近码头的建筑限制交给世界系统处理
  return {
    group: root,
    interactions,
    blockers,
    solid,
    navZones,
    buildZones,
    expansionZones,
    spawn: { x: state.player.x, z: state.player.z },
    titleFocus: new THREE.Vector3(0, 2.2, 1),
    titleRadius: 34,
  };
}

function npcLookFor(avatar) {
  return avatar;
}

function createStyleScenery(style, parent, island, rng) {
  const accent = island.accent;
  const focus = new THREE.Group();
  parent.add(focus);
  const decorBlockers = [];
  if (style === 'wen') {
    // 墨池与石桥
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.0, 28), material('#375b58', { roughness: 0.28, metalness: 0.1, transparent: true, opacity: 0.82 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-6.4, GROUND_Y + 0.025, -6.2);
    focus.add(pond);
    for (let i = 0; i < 3; i += 1) {
      mesh(focus, new THREE.TorusGeometry(3.05 + i * 0.25, 0.04, 4, 36), material('#7e9388', { roughness: 1 }), [-6.4, GROUND_Y + 0.03, -6.2], [Math.PI / 2, 0, 0]);
    }
    const bridge = new THREE.Group();
    for (let i = 0; i < 11; i += 1) {
      const t = i / 10;
      const deck = mesh(bridge, new THREE.BoxGeometry(0.7, 0.12, 1.65), i % 3 ? M.wood('#6b5d4b') : M.woodLight(), [(t - 0.5) * 5.7, 0.3 + Math.sin(t * Math.PI) * 0.5, 0], [0, 0, -Math.cos(t * Math.PI) * 0.25]);
      deck.castShadow = true;
    }
    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      for (const z of [-0.9, 0.9]) mesh(bridge, new THREE.CylinderGeometry(0.045, 0.06, 0.75, 4), M.woodDark(), [(t - 0.5) * 5.7, 0.72 + Math.sin(t * Math.PI) * 0.5, z]);
    }
    bridge.position.set(-6.4, GROUND_Y, -6.2);
    bridge.rotation.y = 0.35;
    focus.add(bridge);
    // 巨型毛笔与悬浮卷轴
    const brush = new THREE.Group();
    mesh(brush, new THREE.CylinderGeometry(0.1, 0.13, 4.2, 6), M.bark('#7f6546'), [0, 2.1, 0]);
    mesh(brush, new THREE.ConeGeometry(0.32, 1.35, 7), material('#3d4640'), [0, 0.2, 0], [Math.PI, 0, 0]);
    mesh(brush, new THREE.TorusGeometry(0.17, 0.04, 4, 12), material(accent, { metalness: 0.4 }), [0, 4.15, 0], [Math.PI / 2, 0, 0]);
    brush.position.set(-9.2, GROUND_Y + 0.2, 2.8);
    brush.rotation.z = -0.35;
    focus.add(brush);
    const scrollGroup = new THREE.Group();
    const scrollWords = ['风起', '月落', '诗成'];
    for (let i = 0; i < 3; i += 1) {
      const scroll = new THREE.Group();
      mesh(scroll, new THREE.CylinderGeometry(0.055, 0.055, 1.25, 5), material('#b99f70', { metalness: 0.2 }), [0, 0, 0], [0, 0, Math.PI / 2]);
      const paper = mesh(scroll, new THREE.PlaneGeometry(1.2, 1.6), material('#dfd4ba', { side: THREE.DoubleSide }), [0, -0.78, 0]);
      paper.castShadow = false;
      const writing = makeTextPlane(scrollWords[i], '#394840', {
        vertical: true,
        width: 0.54,
        height: 1.15,
        canvasWidth: 180,
        canvasHeight: 420,
      });
      writing.position.set(0.02, -0.8, 0.015);
      writing.rotation.z = -0.03;
      scroll.add(writing);
      const seal = mesh(scroll, new THREE.PlaneGeometry(0.16, 0.16), material('#9e5b4e', { side: THREE.DoubleSide }), [0.33, -1.18, 0.02], [0, 0, 0], [1, 1, 1], false);
      seal.castShadow = false;
      scroll.position.set(-5 + i * 2.2, 3.6 + (i % 2) * 0.5, -10.4);
      scroll.rotation.z = (i - 1) * 0.08;
      scrollGroup.add(scroll);
    }
    focus.add(scrollGroup);
    addTick(focus, (t) => {
      scrollGroup.children.forEach((scroll, index) => {
        scroll.position.y = 3.6 + (index % 2) * 0.5 + Math.sin(t * 0.55 + index * 1.8) * 0.16;
        scroll.rotation.y = Math.sin(t * 0.3 + index) * 0.2;
      });
    });
    // 竹群
    for (let i = 0; i < 4; i += 1) {
      const bamboo = createBambooCluster(20 + i);
      const angle = -2.2 + i * 0.38;
      bamboo.position.set(Math.cos(angle) * 11.2, GROUND_Y, Math.sin(angle) * 9.8);
      bamboo.scale.setScalar(0.9);
      focus.add(bamboo);
    }
    const stoneLantern = createLanternPost('#f2d9a2');
    stoneLantern.position.set(6.3, GROUND_Y, -1.4);
    focus.add(stoneLantern);
    decorBlockers.push({ x: -6.4, z: -6.2, r: 3.5, type: 'pond' });
  } else if (style === 'shu') {
    // 浮空的几何体
    const floatGroup = new THREE.Group();
    [
      { x: -8.2, y: 4.4, z: -5.5, geo: new THREE.IcosahedronGeometry(0.9, 1), color: '#d5e7e9' },
      { x: 8.2, y: 3.8, z: -7.8, geo: new THREE.TorusKnotGeometry(0.6, 0.16, 48, 6), color: accent },
      { x: 4.2, y: 5.3, z: -11.5, geo: new THREE.OctahedronGeometry(0.75, 0), color: '#c6d8e0' },
      { x: -5.2, y: 3.1, z: 5.3, geo: new THREE.TorusGeometry(0.8, 0.09, 5, 24), color: '#e2d6b5' },
    ].forEach((item, index) => {
      const object = mesh(floatGroup, item.geo, material(item.color, { roughness: 0.36, metalness: 0.25, transparent: true, opacity: 0.86 }), [item.x, item.y, item.z], [index, index, 0]);
      object.castShadow = false;
      addTick(floatGroup, (t) => {
        object.rotation.x = t * (0.08 + index * 0.02);
        object.rotation.y = t * (0.14 + index * 0.025);
        object.position.y = item.y + Math.sin(t * 0.5 + index) * 0.22;
      });
    });
    focus.add(floatGroup);
    // 白色测海柱与弧
    for (let i = 0; i < 4; i += 1) {
      const angle = -0.1 + i * 0.32;
      const x = Math.cos(angle) * 10.7;
      const z = Math.sin(angle) * 9.4;
      mesh(focus, new THREE.CylinderGeometry(0.34, 0.5, 3.5 + i * 0.35, 6), material('#d9d6c7', { roughness: 0.92 }), [x, GROUND_Y + 1.7, z]);
      mesh(focus, new THREE.BoxGeometry(1.2, 0.16, 1.2), material('#c4c0ad'), [x, GROUND_Y + 0.08, z]);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.09, 5, 32, Math.PI), material('#e6d5a9', { roughness: 0.5 }));
    arc.position.set(-8.8, GROUND_Y + 0.1, 8.8);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = 0.25;
    focus.add(arc);
    const pillars = [-11.5, 9.8];
    pillars.forEach((x, index) => {
      const pillar = mesh(focus, new THREE.CylinderGeometry(0.45, 0.6, 5.8, 6), material('#e1dac7', { roughness: 0.9 }), [x, GROUND_Y + 2.8, index ? -9.5 : 5.8], [0, 0.2, 0], [1, 1, 1]);
      mesh(pillar, new THREE.CylinderGeometry(0.55, 0.55, 0.18, 6), material(accent, { metalness: 0.35 }), [0, 2.9, 0]);
    });
    // 浮动的数字/公式碑
    const formula = makeTextPlane('a² + b² = c²', '#dfd5b7', { background: 'rgba(48,73,76,.7)', border: accent, width: 4.2, height: 1.2 });
    formula.position.set(7.7, GROUND_Y + 2.1, 6.5);
    formula.rotation.y = -0.5;
    focus.add(formula);
  } else if (style === 'wu') {
    // 山壁齿轮
    const gearGroup = new THREE.Group();
    gearGroup.position.set(0, GROUND_Y, 0);
    focus.add(gearGroup);
    const createGear = (radius, teeth, color, x, y, z) => {
      const gear = group(focus, [x, y, z], [0.15, 0, 0]);
      mesh(gear, new THREE.TorusGeometry(radius, radius * 0.12, 6, 28), material(color, { metalness: 0.55, roughness: 0.4 }));
      for (let i = 0; i < teeth; i += 1) {
        const angle = (i / teeth) * Math.PI * 2;
        mesh(gear, new THREE.BoxGeometry(radius * 0.24, radius * 0.3, 0.2), material(color, { metalness: 0.5, roughness: 0.45 }), [Math.cos(angle) * radius, Math.sin(angle) * radius, 0], [0, 0, angle]);
      }
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2;
        mesh(gear, new THREE.BoxGeometry(radius * 0.1, radius * 0.18, 0.24), material('#3e4b45'), [Math.cos(angle) * radius * 0.35, Math.sin(angle) * radius * 0.35, 0], [0, 0, angle]);
      }
      mesh(gear, new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, 0.4, 8), material('#384640', { metalness: 0.6 }), [0, 0, 0], [Math.PI / 2, 0, 0]);
      return gear;
    };
    const gearA = createGear(2.4, 12, '#b28b52', -9.3, 4.7, -7.6);
    const gearB = createGear(1.55, 10, '#9e7748', -5.8, 3.0, -6.2);
    const gearC = createGear(1.0, 8, accent, 8.2, 3.3, -9.0);
    addTick(focus, (t) => {
      gearA.rotation.z = t * 0.09;
      gearB.rotation.z = -t * 0.145;
      gearC.rotation.z = t * 0.2;
    });
    // 摆锤
    const pendulumGroup = group(focus, [5.6, 5.4, 2.3]);
    const pendulumArm = group(pendulumGroup);
    mesh(pendulumArm, new THREE.CylinderGeometry(0.025, 0.025, 3.2, 4), material('#c1a06b', { metalness: 0.4 }), [0, -1.6, 0]);
    mesh(pendulumArm, new THREE.SphereGeometry(0.34, 8, 6), material('#a7804c', { metalness: 0.65, roughness: 0.3 }), [0, -3.2, 0]);
    mesh(pendulumGroup, new THREE.BoxGeometry(0.16, 0.16, 1.1), material('#d5b87a', { metalness: 0.4 }), [0, 0.1, 0]);
    addTick(pendulumGroup, (t) => {
      pendulumArm.rotation.z = Math.sin(t * 0.9) * 0.25;
    });
    // 铜管和蒸汽
    for (let i = 0; i < 3; i += 1) {
      const pipe = mesh(focus, new THREE.CylinderGeometry(0.12, 0.16, 3.2 + i * 0.6, 6), material('#9f8455', { metalness: 0.55, roughness: 0.4 }), [8.5 + i * 0.15, GROUND_Y + 1.5, -4.5 - i * 0.7], [0.1, 0, 0.12]);
      mesh(pipe, new THREE.TorusGeometry(0.24, 0.06, 4, 12, Math.PI), material('#6d5b3c', { metalness: 0.5 }), [0, 1.5, 0]);
    }
    // 石砧与铁轨
    const anvil = createRock(45, '#797b72', 0.8);
    anvil.position.set(9.2, GROUND_Y, 3.4);
    focus.add(anvil);
    const rails = new THREE.Group();
    for (const z of [-2.1, -1.3]) mesh(rails, new THREE.BoxGeometry(5.6, 0.1, 0.12), material('#6d6b60', { metalness: 0.4 }), [0, 0, z]);
    for (let i = 0; i < 8; i += 1) mesh(rails, new THREE.BoxGeometry(0.14, 0.08, 1.0), M.woodDark(), [-2.5 + i * 0.72, 0.02, -1.7]);
    rails.position.set(-1.3, GROUND_Y + 0.05, -11.2);
    focus.add(rails);
    decorBlockers.push({ x: -9.3, z: -7.6, r: 2.9, type: 'gear' });
  } else if (style === 'hua') {
    // 彩色炼金池
    const pools = [
      { x: -8.5, z: -5.6, r: 2.3, color: '#735b9c' },
      { x: 8.1, z: 4.0, r: 1.9, color: '#5a8f86' },
      { x: -7.9, z: 8.0, r: 1.5, color: '#91617e' },
    ];
    pools.forEach((pool, index) => {
      const base = mesh(focus, new THREE.CylinderGeometry(pool.r, pool.r + 0.22, 0.35, 22), material('#74667b', { roughness: 0.9 }), [pool.x, GROUND_Y + 0.12, pool.z]);
      const liquid = mesh(focus, new THREE.CircleGeometry(pool.r - 0.12, 22), material(pool.color, { roughness: 0.24, metalness: 0.15, transparent: true, opacity: 0.9, emissive: pool.color, emissiveIntensity: 0.28 }), [pool.x, GROUND_Y + 0.31, pool.z], [-Math.PI / 2, 0, 0]);
      const glow = glowSprite(pool.color, pool.r * 1.8, 0.23);
      glow.position.set(pool.x, GROUND_Y + 0.55, pool.z);
      focus.add(glow);
      const bubbles = group(focus);
      for (let i = 0; i < 4; i += 1) {
        const bubble = mesh(bubbles, new THREE.SphereGeometry(0.05 + i * 0.012, 4, 3), material(pool.color, { transparent: true, opacity: 0.5, emissive: pool.color, emissiveIntensity: 0.5 }), [pool.x + (i - 1.5) * 0.3, GROUND_Y + 0.6 + i * 0.2, pool.z + Math.sin(i) * 0.2], [0, 0, 0], [1, 1, 1], false);
        bubble.castShadow = false;
      }
      addTick(bubbles, (t) => {
        bubbles.children.forEach((bubble, i) => {
          bubble.position.y = GROUND_Y + 0.4 + ((t * 0.2 + i * 0.28) % 1.2);
          bubble.material.opacity = 0.45 * (1 - ((bubble.position.y - GROUND_Y) / 1.6));
        });
      });
      decorBlockers.push({ x: pool.x, z: pool.z, r: pool.r + 0.6, type: 'pool' });
    });
    // 巨型蒸馏瓶
    const alembic = new THREE.Group();
    mesh(alembic, new THREE.SphereGeometry(1.35, 12, 9), material('#b6d8cf', { transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.08 }), [0, 1.4, 0]);
    mesh(alembic, new THREE.SphereGeometry(1.05, 10, 8), material('#b46e9d', { transparent: true, opacity: 0.46, emissive: '#7d3d72', emissiveIntensity: 0.2, roughness: 0.2 }), [0, 1.25, 0]);
    mesh(alembic, new THREE.CylinderGeometry(0.25, 0.45, 2.0, 8), material('#b6d8cf', { transparent: true, opacity: 0.34 }), [0, 2.85, 0]);
    mesh(alembic, new THREE.CylinderGeometry(0.52, 0.52, 0.14, 8), material(accent, { metalness: 0.5 }), [0, 3.85, 0]);
    for (let i = 0; i < 4; i += 1) {
      const bubble = mesh(alembic, new THREE.SphereGeometry(0.07, 4, 3), material('#d3a0c8', { transparent: true, opacity: 0.6 }), [Math.sin(i * 2) * 0.4, 0.8 + i * 0.16, 0.3], [0, 0, 0], [1, 1, 1], false);
      bubble.userData.rise = i * 0.7;
    }
    alembic.position.set(9.7, GROUND_Y, -8.0);
    alembic.scale.setScalar(0.85);
    focus.add(alembic);
    addTick(focus, (t) => {
      alembic.children.forEach((child) => {
        if (child.userData.rise !== undefined) {
          child.position.y = 0.7 + ((t * 0.14 + child.userData.rise) % 1.0);
          child.position.x = Math.sin(t * 1.2 + child.userData.rise) * 0.35;
        }
      });
    });
    // 元素符号石碑
    ['H', 'O', 'C'].forEach((symbol, index) => {
      const stone = mesh(focus, new THREE.BoxGeometry(0.7, 1.4 + index * 0.3, 0.35), material('#685d6e', { roughness: 0.95 }), [7.4 + index * 1.0, GROUND_Y + 0.8, 8.2 - index * 0.3], [0, index * 0.16, 0]);
      const glyph = glowSprite('#b9e7d5', 0.75, 0.22);
      glyph.position.set(7.4 + index * 1.0, GROUND_Y + 1.1, 8.0 - index * 0.3);
      focus.add(glyph);
      decorBlockers.push({ x: 7.4 + index * 1.0, z: 8.2 - index * 0.3, r: 0.7, type: 'monolith' });
    });
  } else if (style === 'sheng') {
    // 巨菇群
    for (let i = 0; i < 6; i += 1) {
      const giant = i < 3;
      const mushroom = createMushroom(60 + i, giant, giant ? ['#dc9e96', '#ce95b3', '#d5bf8a'][i % 3] : '#e4b7a3');
      const angle = i * 1.2 - 0.35;
      const distance = giant ? 8.7 : 6.2;
      mushroom.position.set(Math.cos(angle) * distance, GROUND_Y, Math.sin(angle) * distance - 1.0);
      mushroom.rotation.y = i * 0.9;
      focus.add(mushroom);
      if (giant) decorBlockers.push({ x: Math.cos(angle) * distance, z: Math.sin(angle) * distance - 1.0, r: 1.4, type: 'mushroom' });
    }
    // 巨大的蕨叶与藤蔓拱
    for (let i = 0; i < 4; i += 1) {
      const leaf = mesh(focus, new THREE.SphereGeometry(1.6, 5, 3), M.leaf(i % 2 ? '#4f8751' : '#63965c'), [-10.3, GROUND_Y + 2.3 + i * 0.3, -9.0 + i * 0.6], [0.15, i * 0.9, -0.2], [2.4, 0.12, 0.6]);
      leaf.castShadow = false;
    }
    const vineArch = new THREE.Group();
    for (let i = 0; i < 2; i += 1) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.8 + i * 3.6, 0, 0),
        new THREE.Vector3(-1.4 + i * 3.0, 3.2, 0.2),
        new THREE.Vector3(0.2 + i * 0.8, 4.4, 0.1),
        new THREE.Vector3(1.7 + i * 0.2, 3.1, -0.1),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.08, 5, false), M.bark('#6a7851'));
      tube.castShadow = true;
      vineArch.add(tube);
    }
    for (let i = 0; i < 14; i += 1) {
      const a = rng() * Math.PI;
      mesh(vineArch, new THREE.SphereGeometry(0.12, 4, 3), M.leaf(i % 2 ? '#6da261' : '#87b878'), [Math.cos(a) * 1.8, 0.3 + Math.sin(a) * 3.8, (rng() - 0.5) * 0.5], [0, a, 0], [1.6, 0.4, 0.8], false);
    }
    vineArch.position.set(0.5, GROUND_Y, 10.2);
    vineArch.rotation.y = 0.2;
    focus.add(vineArch);
    // 蝴蝶
    const butterflies = new THREE.Group();
    for (let i = 0; i < 8; i += 1) {
      const butterfly = new THREE.Group();
      const wingMat = material(i % 2 ? '#f0b7a3' : '#e7d28e', { side: THREE.DoubleSide, emissive: i % 2 ? '#b56d64' : '#ab924e', emissiveIntensity: 0.18, transparent: true, opacity: 0.9 });
      mesh(butterfly, new THREE.CircleGeometry(0.16, 8), wingMat, [-0.11, 0, 0], [0, 0.2, 0], [1, 0.65, 1], false);
      mesh(butterfly, new THREE.CircleGeometry(0.16, 8), wingMat, [0.11, 0, 0], [0, -0.2, 0], [1, 0.65, 1], false);
      butterfly.position.set(-8 + rng() * 16, GROUND_Y + 2 + rng() * 3, -8 + rng() * 10);
      butterfly.scale.setScalar(0.8 + rng() * 0.6);
      butterflies.add(butterfly);
    }
    addTick(focus, (t) => {
      butterflies.children.forEach((butterfly, index) => {
        butterfly.position.x += Math.sin(t * 0.8 + index) * 0.0025;
        butterfly.position.y += Math.cos(t * 1.1 + index) * 0.0018;
        butterfly.rotation.y = t * 0.7 + index;
      });
    });
    focus.add(butterflies);
  } else if (style === 'ying') {
    // 白色灯塔轮廓
    const lighthouse = new THREE.Group();
    mesh(lighthouse, new THREE.CylinderGeometry(0.68, 1.1, 6.4, 9), material('#e8e0ce', { roughness: 0.9 }), [0, 3.2, 0]);
    for (let i = 0; i < 3; i += 1) mesh(lighthouse, new THREE.CylinderGeometry(1.0 - i * 0.09, 1.05 - i * 0.09, 0.45, 9), material(i % 2 ? '#d8bc83' : '#a65f52'), [0, 1.3 + i * 1.6, 0]);
    mesh(lighthouse, new THREE.CylinderGeometry(0.55, 0.65, 0.18, 8), material('#4a5a58'), [0, 6.45, 0]);
    mesh(lighthouse, new THREE.CylinderGeometry(0.4, 0.45, 0.8, 8), material('#c6e2dc', { transparent: true, opacity: 0.5 }), [0, 6.95, 0]);
    const light = glowSprite('#ffe6a1', 2.0, 0.5);
    light.position.set(0, 6.95, 0);
    lighthouse.add(light);
    mesh(lighthouse, new THREE.ConeGeometry(0.62, 0.55, 8), material('#5d5041'), [0, 7.6, 0]);
    mesh(lighthouse, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4), material('#c3a367'), [0, 8.0, 0]);
    lighthouse.position.set(10.2, GROUND_Y, -8.3);
    lighthouse.scale.setScalar(0.8);
    focus.add(lighthouse);
    addTick(focus, (t) => { light.material.opacity = 0.4 + Math.sin(t * 1.7) * 0.1; });
    // 船桅与欢迎牌
    const ship = new THREE.Group();
    mesh(ship, new THREE.CylinderGeometry(0.55, 0.3, 5.2, 7, 1, true), material('#6b543d', { side: THREE.DoubleSide }), [0, 0.5, 0], [Math.PI / 2, 0, 0], [1, 0.5, 1]);
    mesh(ship, new THREE.CylinderGeometry(0.06, 0.08, 4.6, 5), M.woodDark(), [0, 2.4, 0]);
    mesh(ship, new THREE.PlaneGeometry(2.4, 2.1), material('#e8ddc3', { side: THREE.DoubleSide }), [0.7, 3.3, 0], [0, 0.2, 0.1]);
    ship.position.set(-10.2, GROUND_Y + 0.1, 5.6);
    ship.rotation.y = 0.5;
    ship.rotation.z = 0.08;
    focus.add(ship);
    const sign = makeTextPlane('WELCOME', '#f2e2bb', { background: 'rgba(49,72,77,.8)', border: accent, width: 4.7, height: 1.2 });
    sign.position.set(8.1, GROUND_Y + 2.2, 7.2);
    sign.rotation.y = -0.5;
    focus.add(sign);
    parallelFlags(focus, [[-6.6, 8.8], [6.6, 8.8]], accent);
  } else if (style === 'gong') {
    // 百工城的小街景：铺子、脚手架和吊车
    const shop = new THREE.Group();
    mesh(shop, new THREE.BoxGeometry(3.2, 2.1, 2.2), material('#d9c6a0', { roughness: 0.95 }), [0, 1.05, 0]);
    mesh(shop, new THREE.ConeGeometry(2.5, 1.0, 4), material('#8b5947', { roughness: 0.9 }), [0, 2.5, 0], [0, Math.PI / 4, 0]);
    for (let i = 0; i < 4; i += 1) mesh(shop, new THREE.BoxGeometry(0.12, 2.2, 0.12), M.woodDark(), [-1.5 + i * 1.0, 1.1, 1.15]);
    mesh(shop, new THREE.BoxGeometry(2.8, 0.15, 0.24), material('#8c5a47'), [0, 2.0, 1.16]);
    mesh(shop, new THREE.BoxGeometry(0.6, 0.9, 0.08), material('#594536'), [-0.7, 0.5, 1.12]);
    const shopSign = makeTextPlane('百工铺', '#f1d8a2', { background: 'rgba(75,52,34,.88)', border: accent, width: 2.4, height: 0.7 });
    shopSign.position.set(0, 2.1, 1.19);
    shop.add(shopSign);
    shop.position.set(-8.8, GROUND_Y, 6.8);
    shop.rotation.y = 0.15;
    focus.add(shop);
    // 脚手架
    const scaffold = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 2; j += 1) mesh(scaffold, new THREE.BoxGeometry(0.12, 3.5, 0.12), M.woodDark(), [j * 2.4, 1.75, (i % 2) * 2.2]);
      mesh(scaffold, new THREE.BoxGeometry(2.9, 0.12, 0.12), M.wood(), [1.2, 0.9 + i * 0.8, (i % 2) * 2.2]);
    }
    for (let i = 0; i < 2; i += 1) mesh(scaffold, new THREE.BoxGeometry(0.1, 3.8, 2.4), M.wood(), [i * 2.4, 1.8, 1.1], [0, 0, 0.12]);
    scaffold.position.set(8.3, GROUND_Y, -8.6);
    focus.add(scaffold);
    // 吊车与木箱
    const crane = new THREE.Group();
    mesh(crane, new THREE.CylinderGeometry(0.35, 0.55, 3.3, 5), M.woodDark(), [0, 1.6, 0]);
    mesh(crane, new THREE.BoxGeometry(0.35, 0.35, 4.4), M.woodDark(), [0, 3.3, 1.1]);
    mesh(crane, new THREE.CylinderGeometry(0.02, 0.02, 2.6, 3), material('#a28a68'), [0, 2.0, 2.7]);
    mesh(crane, new THREE.BoxGeometry(0.5, 0.24, 0.35), material('#5d5a4e', { metalness: 0.3 }), [0, 0.7, 2.7]);
    crane.position.set(9.8, GROUND_Y, 3.2);
    focus.add(crane);
    for (let i = 0; i < 4; i += 1) {
      mesh(focus, new THREE.BoxGeometry(0.55, 0.55, 0.55), M.wood(i % 2 ? undefined : '#9b704b'), [6.8 + (i % 2) * 0.6, GROUND_Y + 0.3 + (i > 1 ? 0.55 : 0), 7.2 + (i > 1 ? 0.3 : 0)]);
    }
    // 灯串
    const lanterns = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const lamp = new THREE.Group();
      const curveY = Math.sin((i / 3) * Math.PI) * 0.5;
      const lantern = mesh(lamp, new THREE.OctahedronGeometry(0.13, 0), material(accent, { emissive: accent, emissiveIntensity: 1 }), [0, 0, 0], [0, 0, 0], [1, 1.5, 1]);
      lantern.castShadow = false;
      const glow = glowSprite('#ffd894', 0.6, 0.35);
      lamp.add(glow);
      lamp.position.set(-3.7 + i * 2.4, GROUND_Y + 2.9 + curveY, -7.0);
      lanterns.add(lamp);
    }
    focus.add(lanterns);
    addTick(focus, (t) => {
      lanterns.children.forEach((lamp, index) => {
        lamp.rotation.z = Math.sin(t * 0.9 + index) * 0.12;
      });
    });
    // 百工城不是一块空地，而是一条正在营业的小街。补几座错落的屋顶。
    const miniHouses = [
      { x: -11.2, z: -5.8, color: '#8d604b', scale: 0.9, rot: 0.4 },
      { x: 11.4, z: -4.6, color: '#778b77', scale: 0.78, rot: -0.45 },
      { x: 10.6, z: 8.8, color: '#a26d50', scale: 0.7, rot: 0.2 },
    ];
    miniHouses.forEach((house, index) => {
      const group = new THREE.Group();
      mesh(group, new THREE.BoxGeometry(2.1, 1.5, 1.7), material(index === 2 ? '#d8c49c' : '#d6c4a3', { roughness: 0.95 }), [0, 0.75, 0]);
      mesh(group, new THREE.ConeGeometry(1.65, 0.8, 4), material(house.color, { roughness: 0.9 }), [0, 1.82, 0], [0, Math.PI / 4, 0]);
      mesh(group, new THREE.BoxGeometry(0.45, 0.82, 0.1), material('#5f4532'), [0, 0.42, 0.87]);
      mesh(group, new THREE.BoxGeometry(0.32, 0.32, 0.08), material('#e7c982', { emissive: '#e7c982', emissiveIntensity: 0.55 }), [-0.62, 0.95, 0.87]);
      mesh(group, new THREE.BoxGeometry(0.32, 0.32, 0.08), material('#e7c982', { emissive: '#e7c982', emissiveIntensity: 0.55 }), [0.62, 0.95, 0.87]);
      mesh(group, new THREE.CylinderGeometry(0.1, 0.13, 0.7, 5), M.woodDark(), [0.6, 2.2, -0.35]);
      const cloth = mesh(group, new THREE.PlaneGeometry(0.9, 0.5), material(index % 2 ? '#e4c177' : '#b76856', { side: THREE.DoubleSide }), [0.95, 1.65, 0.2]);
      cloth.castShadow = false;
      group.position.set(house.x, GROUND_Y, house.z);
      group.rotation.y = house.rot;
      group.scale.setScalar(house.scale);
      focus.add(group);
      addTick(group, (t) => { cloth.rotation.y = Math.sin(t * 1.1 + index) * 0.08; });
    });
  } else {
    // 家岛场景已单独处理
  }
  return { group: focus, blockers: decorBlockers };
}

function parallelFlags(parent, positions, color) {
  positions.forEach(([x, z], index) => {
    const pole = new THREE.Group();
    mesh(pole, new THREE.CylinderGeometry(0.04, 0.06, 3.5, 4), M.woodDark(), [0, 1.75, 0]);
    const flag = mesh(pole, new THREE.PlaneGeometry(1.2, 0.65), material(index % 2 ? '#e4d8bd' : color, { side: THREE.DoubleSide, roughness: 0.9 }), [0.6, 3.05, 0], [0, 0.1, -0.05]);
    flag.castShadow = false;
    pole.position.set(x, GROUND_Y, z);
    parent.add(pole);
    addTick(pole, (t) => { flag.rotation.y = 0.1 + Math.sin(t * 1.7 + index) * 0.12; });
  });
}

function knowledgeNodeSpec(style, seed) {
  const rng = mulberry32(seed);
  const common = [
    { x: -7.6, z: 6.4 },
    { x: 7.5, z: 7.2 },
    { x: -9.4, z: -1.0 },
    { x: 9.2, z: -1.7 },
    { x: -1.8, z: 6.8 },
  ];
  const styleData = {
    wen: [
      { ...common[0], type: 'bamboo', label: '听雨墨竹', yields: { wood: 3, fiber: 1, insight: 2 }, seed: seed + 1 },
      { ...common[2], type: 'rock', label: '洗砚石', yields: { stone: 3, crystal: 1, insight: 2 }, seed: seed + 2 },
      { ...common[1], type: 'bamboo', label: '风骨竹', yields: { wood: 4, fiber: 1, insight: 2 }, seed: seed + 3 },
      { ...common[3], type: 'bush', label: '砚池莓', yields: { food: 2, fiber: 2 }, seed: seed + 4 },
    ],
    shu: [
      { ...common[2], type: 'rock', label: '刻纹白石', yields: { stone: 4, crystal: 1, insight: 2 }, seed: seed + 1 },
      { ...common[1], type: 'crystal', label: '正多面晶簇', yields: { crystal: 3, insight: 3 }, seed: seed + 2 },
      { ...common[3], type: 'tree', label: '比例杉', yields: { wood: 4, insight: 1 }, seed: seed + 3 },
      { ...common[4], type: 'bush', label: '斐波那契花丛', yields: { food: 2, fiber: 2 }, seed: seed + 4 },
    ],
    wu: [
      { ...common[2], type: 'rock', label: '磁铁矿', yields: { ore: 4, stone: 2, insight: 2 }, seed: seed + 1 },
      { ...common[1], type: 'rock', label: '机巧废铁', yields: { ore: 3, stone: 2, insight: 2 }, seed: seed + 2 },
      { ...common[3], type: 'crystal', label: '共振晶簇', yields: { crystal: 2, ore: 1, insight: 3 }, seed: seed + 3 },
      { ...common[0], type: 'tree', label: '雷击木', yields: { wood: 3, ore: 1, insight: 2 }, seed: seed + 4 },
    ],
    hua: [
      { ...common[2], type: 'crystal', label: '沉淀晶簇', yields: { crystal: 3, insight: 2 }, seed: seed + 1 },
      { ...common[1], type: 'bush', label: '试剂莓', yields: { food: 1, fiber: 3, insight: 2 }, seed: seed + 2 },
      { ...common[4], type: 'mushroom', label: '催化菇', yields: { food: 2, fiber: 1, insight: 2 }, seed: seed + 3 },
      { ...common[3], type: 'rock', label: '矿渣岩', yields: { ore: 3, stone: 2 }, seed: seed + 4 },
    ],
    sheng: [
      { ...common[0], type: 'tree', label: '共生古树', yields: { wood: 5, fiber: 1, insight: 2 }, seed: seed + 1 },
      { ...common[2], type: 'mushroom', label: '灯芯巨菇', yields: { food: 3, fiber: 2, insight: 2 }, seed: seed + 2 },
      { ...common[3], type: 'bush', label: '传粉花丛', yields: { food: 2, fiber: 2, insight: 1 }, seed: seed + 3 },
      { ...common[1], type: 'crystal', label: '琥珀结晶', yields: { crystal: 2, food: 1, insight: 2 }, seed: seed + 4 },
    ],
    ying: [
      { ...common[0], type: 'tree', label: '沉船桅木', yields: { wood: 4, fiber: 1, insight: 2 }, seed: seed + 1 },
      { ...common[2], type: 'rock', label: '带盐礁石', yields: { stone: 4, insight: 1 }, seed: seed + 2 },
      { ...common[1], type: 'fiber', label: '航海绳草', yields: { fiber: 4, insight: 2 }, seed: seed + 3 },
      { ...common[3], type: 'bush', label: '异乡果丛', yields: { food: 2, fiber: 2 }, seed: seed + 4 },
    ],
    gong: [
      { ...common[1], type: 'rock', label: '废弃料堆', yields: { ore: 3, stone: 2, insight: 1 }, seed: seed + 1 },
      { ...common[0], type: 'tree', label: '老梁木', yields: { wood: 4, fiber: 1, insight: 2 }, seed: seed + 2 },
      { ...common[3], type: 'bush', label: '集市果架', yields: { food: 2, fiber: 2, insight: 1 }, seed: seed + 3 },
      { ...common[4], type: 'fiber', label: '织布麻', yields: { fiber: 3, insight: 1 }, seed: seed + 4 },
    ],
  };
  return styleData[style] ?? styleData.wen;
}

/** 学问碑往广场里收一点，把外圈让给房子 */
const TRIAL_PULL = 1;

function createKnowledgeIsland(island, state, seed = 51, quality = 'high') {
  const root = new THREE.Group();
  const palette = island.palette;
  const dockScale = island.walkRadius / 12.8;
  const streetAngle = Math.atan2(-5.4, 11.6);
  const dockPos = { x: -5.6 * dockScale, z: 10.6 * dockScale };
  const dockAnchor = { x: -5.4 * dockScale, z: 11.6 * dockScale };
  // 先规划园林：地形上的草、草甸的草都要避开路面与花圃
  const plan = planGarden({
    island,
    dock: dockAnchor,
    seed,
    treeKeys: ISLAND_TREES[island.style] ?? HOME_TREES,
    reserved: [
      { x: dockAnchor.x, z: dockAnchor.z, radius: 1.9, type: 'dock' },
      { x: 5.2, z: 7.4, radius: 0.95, type: 'npc' },
      ...(island.trials ?? []).map((trial) => ({
        x: trial.position.x * TRIAL_PULL,
        z: trial.position.z * TRIAL_PULL,
        radius: 2.0,
        type: 'trial',
      })),
    ],
  });
  const clearAt = gardenClearAt(plan);
  root.add(createTerrain(island.radius, palette, seed, { quality, clearAt }));
  const rng = mulberry32(seed + 10);
  const interactions = [];
  const blockers = [];
  const solid = [];
  const navZones = [{ type: 'circle', x: 0, z: 0, r: island.walkRadius }];
  const buildZones = [];

  // 渡船码头：村子南边的小湾
  const dock = createTropicalDockVisual({ accent: island.accent, sections: 3, canopy: false })
    ?? createDock(false, island.accent);
  dock.position.set(dockPos.x, GROUND_Y - 0.16, dockPos.z);
  dock.scale.setScalar(0.78 * Math.max(1, dockScale * 0.72));
  dock.rotation.y = -0.08;
  root.add(dock);
  addInteraction(interactions, {
    id: `${island.id}-dock`,
    kind: 'dock',
    object: dock,
    position: { x: -5.4 * dockScale, z: 11.6 * dockScale },
    label: '展开海图，前往别处',
    prompt: '渡船',
    action: 'open-map',
    glyph: '船',
    markerColor: '#e3c889',
    markerHeight: 2.7,
    range: 3.3,
  });
  addBlocker(blockers, -5.4 * dockScale, 13.2 * dockScale, 1.8, 'dock');
  decorateDock(root, blockers, rng, {
    x: dockPos.x,
    z: dockPos.z - 1.2,
    angle: streetAngle,
    scale: Math.max(0.9, dockScale * 0.5),
  });
  const sign = createSignpost(island.name, island.accent);
  sign.position.set(3.3 * dockScale, GROUND_Y, 10.4 * dockScale);
  sign.rotation.y = -0.4;
  root.add(sign);

  // 守岛 NPC
  const guardian = createNpc(island.guardian.avatar);
  guardian.position.set(5.2, GROUND_Y, 7.4);
  guardian.rotation.y = -0.6;
  root.add(guardian);
  addInteraction(interactions, {
    id: `npc-${island.id}-guardian`,
    kind: 'npc',
    object: guardian,
    position: { x: 5.2, z: 7.4 },
    label: `与${island.guardian.name}交谈`,
    prompt: island.guardian.name,
    action: `npc:${island.id}`,
    glyph: '谈',
    markerColor: island.accent,
    markerHeight: 2.7,
    range: 3.2,
  });
  addBlocker(blockers, 5.2, 7.4, 0.9, 'npc');

  // 学问碑：往广场里收一点，村子的房子留在外圈
  island.trials.forEach((trial, index) => {
    const passed = state.hasTrialPassed(trial.id);
    const trialSpot = {
      x: trial.position.x * TRIAL_PULL,
      z: trial.position.z * TRIAL_PULL,
    };
    const monument = createTrialMonument(island.style, island.accent, Boolean(trial.main));
    monument.position.set(trialSpot.x, GROUND_Y, trialSpot.z);
    monument.rotation.y = trial.main ? 0.1 : -0.18;
    root.add(monument);
    if (island.style === 'wen') {
      const plaque = makeTextPlane(trial.main ? '问' : '拾', '#e4d4b0', {
        vertical: true,
        width: 0.48,
        height: 0.86,
        canvasWidth: 160,
        canvasHeight: 300,
      });
      plaque.position.set(0, 1.35, 0.34);
      monument.add(plaque);
    } else if (island.style === 'gong') {
      const plaque = makeTextPlane(trial.main ? '百工' : '日用', '#ead6a6', {
        vertical: true,
        width: 0.36,
        height: 0.9,
        canvasWidth: 140,
        canvasHeight: 320,
      });
      plaque.position.set(0, 0.78, 0.44);
      monument.add(plaque);
    }
    addInteraction(interactions, {
      id: `trial-${trial.id}`,
      kind: 'trial',
      object: monument,
      position: { ...trialSpot },
      label: passed ? `重温「${trial.name}」` : `登上「${trial.name}」`,
      prompt: trial.name,
      action: `trial:${trial.id}`,
      glyph: trial.main ? '问' : '答',
      markerColor: island.accent,
      markerHeight: trial.main ? 4.4 : 3.5,
      range: 3.6,
      data: { trial, islandId: island.id, index },
    });
    addBlocker(blockers, trialSpot.x, trialSpot.z, 1.9, 'trial');
    if (passed) {
      const halo = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.42, 40), new THREE.MeshBasicMaterial({ color: island.accent, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(trialSpot.x, GROUND_Y + 0.08, trialSpot.z);
      root.add(halo);
      const seal = glowSprite(island.accent, 2.6, 0.22);
      seal.position.set(trialSpot.x, GROUND_Y + 2.8, trialSpot.z);
      root.add(seal);
    }
  });

  // 园林：每座学科岛自己的路面、建筑与花草
  buildGarden({
    root,
    island,
    plan,
    blockers,
    solid,
    seed,
    quality,
    grassPhoto: groundTextures.images.get('grass'),
  });

  root.add(createMeadow({
    radius: island.radius,
    yAt: (ratio, angle) => terrainY(ratio, angle, seed),
    seed: seed + 3,
    quality,
    clearAt,
  }));
  createBeachLife(root, island, rng, blockers, (ratio, angle) => terrainY(ratio, angle, seed));

  // 本地资源
  const specs = knowledgeNodeSpec(island.style, seed);
  specs.forEach((spec, index) => {
    let model;
    // 树、竹、灌木、蕨类、石头全部用模型库里的 GLB
    if (spec.type === 'tree') model = nature.random(rng, { scale: 0.9, keys: ISLAND_TREES[island.style] ?? HOME_TREES }) ?? jungle.random(rng, { scale: 0.95, keys: ['palm_a', 'cecropia'] });
    else if (spec.type === 'bamboo') model = jungle.random(rng, { scale: 0.62, keys: ['banana', 'cecropia'] });
    else if (spec.type === 'rock') model = tropical.has('stone')
      ? tropical.create(index % 2 ? 'beach-rock' : 'stone', { scale: 0.58, rotation: rng() * Math.PI * 2 })
      : jungle.random(rng, { scale: 1.0, keys: ['palm_a'] });
    else if (spec.type === 'bush') model = jungle.random(rng, { scale: 0.55, keys: ['bush', 'fern'] });
    else if (spec.type === 'fiber') model = jungle.random(rng, { scale: 0.45, keys: ['fern', 'elephant'] });
    else if (spec.type === 'crystal') model = createCrystalCluster(seed + index, palette.accent);
    else model = jungle.random(rng, { scale: 0.45, keys: ['bush', 'fern'] });
    const spot = resolveFreePosition(spec.x * 2.1, spec.z * 2.1, blockers, {
      radius: spec.type === 'fiber' || spec.type === 'bush' ? 0.6 : 0.95,
      limit: island.walkRadius - 1.1,
    });
    addResourceNode({
      parent: root,
      interactions,
      blockers,
      id: `${island.id}-resource-${index}`,
      x: spot.x,
      z: spot.z,
      type: spec.type,
      label: spec.label,
      object: model,
      yields: spec.yields,
      color: island.accent,
      glyph: '采',
    });
  });

  // 岛缘的树与灌木：全部用模型库里的 GLB
  for (let i = 0; i < 18; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = island.walkRadius * (0.8 + rng() * 0.16);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.hypot(x, z) < island.walkRadius - 2.2) continue;
    if (blockers.some((blocker) => Math.hypot(x - blocker.x, z - blocker.z) < blocker.radius + 1.2)) continue;
    const item = i % 3 === 0
      ? nature.random(rng, { scale: 0.9, keys: ISLAND_TREES[island.style] ?? HOME_TREES })
      : jungle.random(rng, { scale: 0.5, keys: ['fern', 'bush', 'elephant'] });
    if (!item) continue;
    item.position.set(x, GROUND_Y - 0.04, z);
    root.add(item);
  }
  // 每座岛的漂浮微光
  const motes = new THREE.Group();
  const moteColor = new THREE.Color(island.accent);
  for (let i = 0; i < 22; i += 1) {
    const mote = glowSprite(island.accent, 0.15 + rng() * 0.2, 0.3 + rng() * 0.3);
    const angle = rng() * Math.PI * 2;
    const radius = 2 + rng() * (island.walkRadius - 2);
    mote.position.set(Math.cos(angle) * radius, GROUND_Y + 0.7 + rng() * 4, Math.sin(angle) * radius);
    mote.userData.phase = rng() * 10;
    motes.add(mote);
  }
  root.add(motes);
  addTick(motes, (t) => {
    motes.children.forEach((mote, index) => {
      mote.position.y = GROUND_Y + 0.6 + Math.sin(t * 0.35 + mote.userData.phase) * 0.7 + (index % 4) * 0.5;
      mote.material.opacity = 0.14 + Math.sin(t * 0.9 + mote.userData.phase) * 0.08;
    });
  });

  // 学科岛的岸线也交给热带环境包：棕榈、香蕉、号角树与海草。
  addTropicalShore({
    parent: root,
    island,
    rng,
    blockers,
    walkRadius: island.walkRadius,
    count: 5,
    withFoliage: true,
    withHut: false,
  });

  return {
    group: root,
    interactions,
    blockers,
    solid,
    navZones,
    buildZones,
    spawn: { x: state.player.x, z: state.player.z },
    titleFocus: new THREE.Vector3(0, 2.2, 0),
    titleRadius: 28,
  };
}

function createBambooCluster(seed = 1) {
  return createTree('bamboo', { leaf: '#6f9960' }, seed);
}

export function buildIsland({ island, state, seed, quality = 'high' }) {
  if (island.id === 'home') return createHomeIsland(island, state, seed ?? 33, quality);
  return createKnowledgeIsland(island, state, seed ?? (island.order * 31 + 51), quality);
}

export function createFarmPlotVisual(plot, state, island) {
  const greenhouse = state.hasBuilding('greenhouse');
  let crop = null;
  let growth = 0;
  if (plot.seed) {
    crop = plot.seed;
    const info = CROPS_BY_ID[crop];
    const growDays = Math.max(1, info.days - (greenhouse ? 1 : 0));
    const elapsed = Math.max(0, state.day - (plot.plantedDay ?? state.day));
    growth = clamp(elapsed / growDays, 0, 1);
  }
  return createFarmPlot(plot, crop, growth, island?.accent ?? '#e5c981');
}

export { GROUND_Y, createNpc };
