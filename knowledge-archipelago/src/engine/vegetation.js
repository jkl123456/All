import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';
import { getGrassBladeTexture, getContactShadowTexture } from './textures.js';

/**
 * 地表植被层。
 *
 * 用 InstancedMesh 铺草与野花：一次 draw call 就能有上千株草，
 * 顶点着色器里加一点风，画面立刻从「塑料模型」变成「有风的海岛」。
 */

const windUniform = { value: 0 };

export function updateVegetationTime(elapsed) {
  windUniform.value = elapsed;
}

function bladeGeometry(planes = 3) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const width = 0.5;
  for (let i = 0; i < planes; i += 1) {
    const angle = (i / planes) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = i * 4;
    const corners = [
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, 1],
      [-width / 2, 1],
    ];
    corners.forEach(([x, y], index) => {
      positions.push(x * cos, y, x * sin);
      normals.push(0, 1, 0);
      uvs.push(index === 0 || index === 3 ? 0 : 1, y);
    });
    // 正反两面都排一遍，材质就能用 FrontSide —— 法线不会因为背面翻转而变黑
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function withWind(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nattribute float aWindPhase;\nvarying float vWindPhase;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float windPhase = 0.0;
        #ifdef USE_INSTANCING
          windPhase = instanceMatrix[3][0] * 0.55 + instanceMatrix[3][2] * 0.82;
        #endif
        float bladeHeight = clamp(position.y, 0.0, 1.0);
        float gust = sin(uWindTime * 1.35 + windPhase) * 0.6 + sin(uWindTime * 2.9 + windPhase * 1.7) * 0.22;
        transformed.x += gust * bladeHeight * bladeHeight * 0.17;
        transformed.z += gust * bladeHeight * bladeHeight * 0.1;
        vWindPhase = windPhase;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWindPhase;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= 0.9 + sin(vWindPhase * 3.7) * 0.08;`,
      );
  };
  return material;
}

/**
 * 在一片圆形地形上铺草、野花与碎石。
 * @returns {{ group: THREE.Group, update: Function }}
 */
export function createGroundCover({
  radius,
  yAt,
  seed = 1,
  palette = {},
  quality = 'high',
  grassCount,
  flowerCount,
  pebbleCount,
  innerRatio = 0.92,
  clearAt = null,
}) {
  const group = new THREE.Group();
  group.name = 'ground-cover';
  const rng = mulberry32(seed * 13 + 7);
  const grassPalette = palette.grass
    ? [palette.grass, palette.grassDeep ?? palette.grass, palette.grassAccent ?? '#93b06f']
    : ['#6f9a64', '#5d8858', '#88a96a'];

  const budget = quality === 'low' ? 0.35 : quality === 'medium' ? 0.62 : 1;
  const grassTotal = Math.round((grassCount ?? 2600) * budget);
  const flowerTotal = Math.round((flowerCount ?? 170) * budget);
  const pebbleTotal = Math.round((pebbleCount ?? 90) * budget);

  const blade = bladeGeometry(3);
  const bladeMap = getGrassBladeTexture();

  if (grassTotal > 0) {
    const perColor = Math.ceil(grassTotal / grassPalette.length);
    grassPalette.forEach((color, colorIndex) => {
      const material = withWind(new THREE.MeshStandardMaterial({
        color,
        map: bladeMap,
        alphaTest: 0.28,
        side: THREE.FrontSide,
        roughness: 1,
        metalness: 0,
        transparent: false,
      }));
      const instanced = new THREE.InstancedMesh(blade, material, perColor);
      instanced.name = `grass-${colorIndex}`;
      instanced.castShadow = false;
      instanced.receiveShadow = false;
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const position = new THREE.Vector3();
      let placed = 0;
      let guard = 0;
      while (placed < perColor && guard < perColor * 8) {
        guard += 1;
        const angle = rng() * Math.PI * 2;
        const ratio = Math.pow(rng(), 0.62) * innerRatio;
        // 成片生长：用角度噪声做出草地与裸土的斑块
        const patch = Math.sin(angle * 4.1 + seed) * 0.5 + Math.cos(ratio * 9.3 - seed) * 0.5;
        if (patch < -0.34 && rng() > 0.3) continue;
        const x = Math.cos(angle) * radius * ratio;
        const z = Math.sin(angle) * radius * ratio;
        // 营地与主路留白，别把可交互的东西埋进草里
        if (Math.hypot(x, z) < 3.4 && rng() > 0.18) continue;
        if (Math.abs(x) < 1.5 && z > 1.5 && z < 14 && rng() > 0.2) continue;
        // 石板广场与主街上不长草
        if (clearAt && clearAt(x, z)) continue;
        const y = yAt(ratio, angle);
        const height = 0.22 + rng() * 0.26;
        position.set(x, y - 0.02, z);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
        scale.set(0.72 + rng() * 0.4, height, 0.72 + rng() * 0.4);
        matrix.compose(position, quaternion, scale);
        instanced.setMatrixAt(placed, matrix);
        placed += 1;
      }
      instanced.count = placed;
      instanced.instanceMatrix.needsUpdate = true;
      group.add(instanced);
    });
  }

  if (flowerTotal > 0) {
    const flowerColors = ['#e8a9ae', '#eccf84', '#b9b4dd', '#e6e0cc', '#e6b374'];
    const flowerGeometry = new THREE.IcosahedronGeometry(0.045, 0);
    flowerColors.forEach((color, colorIndex) => {
      const count = Math.ceil(flowerTotal / flowerColors.length);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: color, emissiveIntensity: 0.08 });
      const instanced = new THREE.InstancedMesh(flowerGeometry, material, count);
      instanced.castShadow = false;
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const position = new THREE.Vector3();
      let placed = 0;
      let guard = 0;
      while (placed < count && guard < count * 8) {
        guard += 1;
        const angle = rng() * Math.PI * 2;
        const ratio = Math.sqrt(rng()) * innerRatio * 0.95;
        const patch = Math.sin(angle * 5.3 + seed * 2) * 0.5 + Math.cos(ratio * 7.7) * 0.5;
        if (patch < 0.15) continue;
        const clusterAngle = rng() * Math.PI * 2;
        const clusterRadius = rng() * 0.65;
        const flowerX = Math.cos(angle) * radius * ratio + Math.cos(clusterAngle) * clusterRadius;
        const flowerZ = Math.sin(angle) * radius * ratio + Math.sin(clusterAngle) * clusterRadius;
        if (clearAt && clearAt(flowerX, flowerZ)) continue;
        position.set(
          flowerX,
          yAt(ratio, angle) + 0.24 + rng() * 0.12,
          flowerZ,
        );
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
        scale.set(1, 0.6, 1).multiplyScalar(0.6 + rng() * 0.55);
        matrix.compose(position, quaternion, scale);
        instanced.setMatrixAt(placed, matrix);
        placed += 1;
      }
      instanced.count = placed;
      instanced.instanceMatrix.needsUpdate = true;
      group.add(instanced);
    });
  }

  if (pebbleTotal > 0) {
    const pebbleGeometry = new THREE.DodecahedronGeometry(0.13, 0);
    const material = new THREE.MeshStandardMaterial({ color: '#9a9a8e', roughness: 0.95 });
    const instanced = new THREE.InstancedMesh(pebbleGeometry, material, pebbleTotal);
    instanced.castShadow = false;
    instanced.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (let i = 0; i < pebbleTotal; i += 1) {
      const angle = rng() * Math.PI * 2;
      const ratio = 0.35 + rng() * 0.55;
      position.set(Math.cos(angle) * radius * ratio, yAt(ratio, angle) + 0.02, Math.sin(angle) * radius * ratio);
      quaternion.setFromEuler(new THREE.Euler(rng(), rng() * 3, rng()));
      scale.set(0.7 + rng(), 0.4 + rng() * 0.4, 0.7 + rng());
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(i, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
  }

  return {
    group,
    update: () => {},
  };
}

/** 一片贴地的软阴影，让建筑/大树不再像悬空摆放。 */
export function createGroundShadow(radius = 1.2, opacity = 0.42) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.035;
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** 会绕圈的小蝴蝶，给草地上加一点生命感。 */
export function createButterflies({ count = 6, radius = 6, center = new THREE.Vector3(), seed = 3 } = {}) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const colors = ['#f7e6a8', '#f2c1a0', '#dfe9f5'];
  for (let i = 0; i < count; i += 1) {
    const butterfly = new THREE.Group();
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: colors[i % colors.length],
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: colors[i % colors.length],
      emissiveIntensity: 0.18,
    });
    const left = new THREE.Mesh(new THREE.CircleGeometry(0.11, 6), wingMaterial);
    left.position.x = -0.09;
    left.rotation.y = 0.4;
    const right = new THREE.Mesh(new THREE.CircleGeometry(0.11, 6), wingMaterial);
    right.position.x = 0.09;
    right.rotation.y = -0.4;
    butterfly.add(left, right);
    butterfly.userData = {
      center: center.clone().add(new THREE.Vector3((rng() - 0.5) * radius * 1.6, 1.1 + rng() * 1.5, (rng() - 0.5) * radius * 1.6)),
      orbit: 0.8 + rng() * 2.6,
      speed: 0.5 + rng() * 0.7,
      phase: rng() * Math.PI * 2,
      left,
      right,
    };
    group.add(butterfly);
  }
  group.userData.tick = (time) => {
    group.children.forEach((butterfly) => {
      const data = butterfly.userData;
      const angle = time * data.speed + data.phase;
      butterfly.position.set(
        data.center.x + Math.cos(angle) * data.orbit,
        data.center.y + Math.sin(angle * 1.7) * 0.35,
        data.center.z + Math.sin(angle * 0.8) * data.orbit,
      );
      butterfly.rotation.y = -angle * 0.8;
      const flap = Math.sin(time * 14 + data.phase) * 0.9;
      data.left.rotation.z = flap;
      data.right.rotation.z = -flap;
    });
  };
  return group;
}
