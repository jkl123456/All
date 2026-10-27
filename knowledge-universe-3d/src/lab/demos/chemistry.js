import {
  THREE,
  addArrow,
  addDashedLine,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  makeGlowTexture,
  ringLine,
  seeded,
  sphere,
  torus,
} from './helpers.js';

function atom(parent, radius, color, position, options = {}) {
  const sphereMesh = sphere(radius, color, {
    roughness: 0.34,
    metalness: 0.14,
    emissive: options.emissive ?? color,
    emissiveIntensity: options.emissiveIntensity ?? 0.32,
  });
  sphereMesh.position.set(...position);
  parent.add(sphereMesh);
  if (options.glow) addGlow(parent, color, radius * 4.2, position, 0.34);
  return sphereMesh;
}

function bondBetween(parent, from, to, color = '#b7c7dc', radius = 0.055) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const dir = end.clone().sub(start);
  const mesh = cylinder(radius, radius, dir.length(), color, {
    metalness: 0.35,
    roughness: 0.35,
    emissive: color,
    emissiveIntensity: 0.2,
  });
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(mesh);
  return mesh;
}

export function molecule() {
  const group = new THREE.Group();
  const green = '#2FE0A8';
  const oxygenColor = '#ff6b6b';
  const hydrogenColor = '#e6f4ff';

  const moleculeGroup = new THREE.Group();
  moleculeGroup.rotation.z = 0.04;
  group.add(moleculeGroup);

  const bondLength = 1.32;
  const halfAngle = THREE.MathUtils.degToRad(104.5 / 2);
  const h1 = [Math.sin(halfAngle) * bondLength, Math.cos(halfAngle) * bondLength, 0];
  const h2 = [-Math.sin(halfAngle) * bondLength, Math.cos(halfAngle) * bondLength, 0];

  const cloudO = sphere(1.0, '#ff6b6b', {
    transparent: true,
    opacity: 0.07,
    emissive: '#ff8c8c',
    emissiveIntensity: 0.35,
    roughness: 1,
  });
  moleculeGroup.add(cloudO);

  const o = atom(moleculeGroup, 0.72, oxygenColor, [0, 0, 0], { glow: true });
  const hA = atom(moleculeGroup, 0.38, hydrogenColor, h1, { emissiveIntensity: 0.25 });
  const hB = atom(moleculeGroup, 0.38, hydrogenColor, h2, { emissiveIntensity: 0.25 });
  bondBetween(moleculeGroup, [0, 0, 0], h1);
  bondBetween(moleculeGroup, [0, 0, 0], h2);

  const lonePairColor = '#7fd8ff';
  const loneA = addGlow(moleculeGroup, lonePairColor, 0.65, [-0.34, -0.86, 0.2], 0.55);
  const loneB = addGlow(moleculeGroup, lonePairColor, 0.65, [0.34, -0.86, 0.2], 0.55);
  addLabel(moleculeGroup, '孤对电子', [-1.35, -1.22, 0], {
    color: 'rgba(127, 216, 255, 0.85)',
    fontSize: 22,
    scale: 0.0056,
  });

  addLabel(moleculeGroup, 'O', [0, 1.0, 0], { color: '#ff9a9a', fontSize: 34, scale: 0.0072 });
  addLabel(moleculeGroup, 'H', [h1[0] + 0.18, h1[1] + 0.28, 0], {
    color: hydrogenColor,
    fontSize: 30,
    scale: 0.0068,
  });
  addLabel(moleculeGroup, 'H', [h2[0] - 0.18, h2[1] + 0.28, 0], {
    color: hydrogenColor,
    fontSize: 30,
    scale: 0.0068,
  });

  const arc = [];
  for (let i = 0; i <= 36; i += 1) {
    const a = -Math.PI / 2 - halfAngle + (i / 36) * halfAngle * 2;
    arc.push([Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0]);
  }
  addLine(moleculeGroup, arc, green, 0.55);
  addLabel(moleculeGroup, '104.5°', [0, 1.9, 0], {
    color: green,
    fontSize: 28,
    scale: 0.0064,
    bg: 'rgba(4, 8, 16, 0.6)',
    border: 'rgba(47, 224, 168, 0.28)',
    padding: 8,
  });

  const neighbor = new THREE.Group();
  neighbor.position.set(3.4, -0.9, -2.6);
  neighbor.scale.setScalar(0.55);
  const o2 = atom(neighbor, 0.72, oxygenColor, [0, 0, 0], { glow: true });
  const h3 = [Math.sin(halfAngle) * bondLength, Math.cos(halfAngle) * bondLength, 0];
  const h4 = [-Math.sin(halfAngle) * bondLength, Math.cos(halfAngle) * bondLength, 0];
  atom(neighbor, 0.38, hydrogenColor, h3, {});
  atom(neighbor, 0.38, hydrogenColor, h4, {});
  bondBetween(neighbor, [0, 0, 0], h3);
  bondBetween(neighbor, [0, 0, 0], h4);
  group.add(neighbor);

  addDashedLine(group, [h1, [1.38, 1.0, -1.2], [3.05, 0.2, -2.2]], '#8fe8ff', 0.5, 0.16, 0.12);
  addLabel(group, '氢键', [2.05, 1.1, -1.25], {
    color: '#8fe8ff',
    fontSize: 24,
    scale: 0.0058,
    bg: 'rgba(4, 8, 16, 0.6)',
    padding: 7,
  });

  addLabel(group, '极性分子 · 高沸点 · 表面张力', [0, -2.9, 0], {
    color: 'rgba(170, 210, 245, 0.8)',
    fontSize: 25,
    scale: 0.006,
  });
  addLabel(group, 'H₂O', [0, 3.0, 0], {
    color: '#9fffe1',
    fontSize: 40,
    scale: 0.0078,
    letterSpacing: 2,
    glow: 16,
    glowColor: green,
  });

  addGlow(group, '#0d4f6e', 11, [0, 0, -3], 0.22);

  const particles = [];
  for (let i = 0; i < 26; i += 1) {
    const p = addGlow(group, '#7fe9ff', 0.14, [(Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, -2.5], 0.2);
    particles.push({ sprite: p, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.4 });
  }

  return {
    group,
    view: { position: [0.4, 1.6, 10.5], target: [0.6, 0.3, 0] },
    autoRotateSpeed: 0.22,
    update(time, dt) {
      moleculeGroup.rotation.y = Math.sin(time * 0.35) * 0.34;
      moleculeGroup.rotation.x = Math.sin(time * 0.24) * 0.08;
      loneA.material.opacity = 0.42 + Math.sin(time * 2.1) * 0.16;
      loneB.material.opacity = 0.42 + Math.sin(time * 2.1 + 1.5) * 0.16;
      neighbor.rotation.y = time * 0.18;
      particles.forEach((p, i) => {
        p.sprite.position.y += dt * p.speed * 0.32;
        p.sprite.position.x += Math.sin(time + p.phase) * dt * 0.06;
        if (p.sprite.position.y > 3.2) p.sprite.position.y = -3.2;
        p.sprite.material.opacity = 0.1 + (Math.sin(time * 1.4 + p.phase) * 0.5 + 0.5) * 0.22;
      });
      o.material.emissiveIntensity = 0.3 + Math.sin(time * 1.5) * 0.06;
    },
  };
}

export function combustion() {
  const group = new THREE.Group();
  const blue = '#58c8ff';
  const green = '#2FE0A8';

  const stove = box(6.2, 0.42, 4.2, '#111c2c', {
    metalness: 0.55,
    roughness: 0.38,
    emissive: '#0b1520',
    emissiveIntensity: 0.25,
  });
  stove.position.y = -0.22;
  group.add(stove);

  const ring = torus(0.78, 0.07, '#26374c', { metalness: 0.7, roughness: 0.3 });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  const innerRing = torus(0.44, 0.035, '#3b5068', { metalness: 0.65, roughness: 0.35 });
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.03;
  group.add(innerRing);

  const flames = [];
  const rand = seeded(711);
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 0.36 + rand() * 0.38;
    const flameGroup = new THREE.Group();
    flameGroup.position.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
    const outer = cone(0.12, 0.75, blue, {
      transparent: true,
      opacity: 0.42,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    outer.material.blending = THREE.AdditiveBlending;
    outer.material.depthWrite = false;
    outer.position.y = 0.32;
    const inner = cone(0.06, 0.45, '#d9f8ff', {
      transparent: true,
      opacity: 0.6,
      emissiveIntensity: 2.2,
    });
    inner.material.blending = THREE.AdditiveBlending;
    inner.material.depthWrite = false;
    inner.position.y = 0.24;
    flameGroup.add(outer, inner);
    group.add(flameGroup);
    flames.push({ group: flameGroup, outer, inner, phase: rand() * Math.PI * 2, rate: 0.7 + rand() * 0.8 });
  }
  addGlow(group, blue, 4.8, [0, 0.55, 0], 0.32);

  const ch4 = new THREE.Group();
  ch4.position.set(-2.35, 3.1, 0.4);
  atom(ch4, 0.28, '#6a7688', [0, 0, 0], { glow: true });
  const tetra = [
    [0.55, 0.42, 0],
    [-0.55, 0.42, 0],
    [0, -0.42, 0.55],
    [0, -0.42, -0.55],
  ];
  tetra.forEach((p) => {
    atom(ch4, 0.15, '#e9f3ff', p, {});
    bondBetween(ch4, [0, 0, 0], p, '#9fb0c6', 0.035);
  });
  addLabel(ch4, 'CH₄', [0, 0.92, 0], { color: '#cfe0f5', fontSize: 27, scale: 0.0062 });
  group.add(ch4);

  const o2a = new THREE.Group();
  o2a.position.set(-0.1, 3.85, -0.6);
  atom(o2a, 0.24, '#ff6b6b', [-0.32, 0, 0], { glow: true });
  atom(o2a, 0.24, '#ff6b6b', [0.32, 0, 0], {});
  bondBetween(o2a, [-0.32, 0, 0], [0.32, 0, 0], '#e19a9a', 0.04);
  addLabel(o2a, 'O₂', [0, 0.66, 0], { color: '#ffb0b0', fontSize: 25, scale: 0.0058 });
  group.add(o2a);

  const o2b = new THREE.Group();
  o2b.position.set(0.65, 2.65, 1.0);
  atom(o2b, 0.2, '#ff6b6b', [-0.26, 0, 0], {});
  atom(o2b, 0.2, '#ff6b6b', [0.26, 0, 0], {});
  bondBetween(o2b, [-0.26, 0, 0], [0.26, 0, 0], '#e19a9a', 0.035);
  addLabel(o2b, 'O₂', [0, 0.55, 0], { color: '#ffb0b0', fontSize: 23, scale: 0.0055 });
  group.add(o2b);

  const productA = new THREE.Group();
  productA.position.set(2.9, 3.45, 0);
  atom(productA, 0.28, '#6a7688', [0, 0, 0], { glow: true });
  atom(productA, 0.22, '#ff6b6b', [-0.55, 0, 0], {});
  atom(productA, 0.22, '#ff6b6b', [0.55, 0, 0], {});
  bondBetween(productA, [0, 0, 0], [-0.55, 0, 0], '#c99b9b', 0.035);
  bondBetween(productA, [0, 0, 0], [0.55, 0, 0], '#c99b9b', 0.035);
  addLabel(productA, 'CO₂', [0, 0.8, 0], { color: '#cfe0f5', fontSize: 25, scale: 0.0058 });
  group.add(productA);

  const productB = new THREE.Group();
  productB.position.set(2.7, 2.45, 1.0);
  atom(productB, 0.28, '#ff6b6b', [0, 0, 0], { glow: true });
  atom(productB, 0.16, '#e9f3ff', [0.5, 0.26, 0], {});
  atom(productB, 0.16, '#e9f3ff', [-0.5, 0.26, 0], {});
  bondBetween(productB, [0, 0, 0], [0.5, 0.26, 0], '#d3b6b6', 0.03);
  bondBetween(productB, [0, 0, 0], [-0.5, 0.26, 0], '#d3b6b6', 0.03);
  addLabel(productB, 'H₂O', [0, 0.72, 0], { color: '#9fffe1', fontSize: 25, scale: 0.0058 });
  group.add(productB);

  addLabel(group, 'CH₄ + 2O₂ → CO₂ + 2H₂O', [0.35, 5.15, 0], {
    color: '#b9f3ff',
    fontSize: 31,
    scale: 0.007,
    bg: 'rgba(4, 10, 18, 0.7)',
    border: 'rgba(88, 200, 255, 0.35)',
    padding: 11,
    glow: 14,
    glowColor: blue,
  });
  addLabel(group, '充分燃烧 · 蓝焰高温', [0, 1.65, 1.9], {
    color: '#89e5ff',
    fontSize: 26,
    scale: 0.0062,
  });
  addLabel(group, '氧气不足会产生有毒的 CO', [0, -1.35, 2.3], {
    color: 'rgba(255, 170, 130, 0.78)',
    fontSize: 23,
    scale: 0.0056,
  });

  return {
    group,
    view: { position: [7.2, 5.6, 11.2], target: [0.2, 2.3, 0] },
    autoRotateSpeed: 0.2,
    update(time) {
      flames.forEach((f) => {
        const pulse = 0.82 + Math.sin(time * 8 * f.rate + f.phase) * 0.2;
        f.outer.scale.set(1, pulse, 1);
        f.inner.scale.set(1, pulse * 1.05, 1);
        f.group.position.y = 0.05 + Math.sin(time * 5 + f.phase) * 0.03;
        f.outer.material.opacity = 0.32 + Math.sin(time * 7 + f.phase) * 0.1;
      });
      ch4.position.y = 3.1 + Math.sin(time * 1.2) * 0.08;
      o2a.position.y = 3.85 + Math.sin(time * 1.35 + 1) * 0.08;
      o2b.position.y = 2.65 + Math.cos(time * 1.1) * 0.07;
      productA.position.y = 3.45 + Math.sin(time * 1.15 + 2) * 0.07;
      productB.position.y = 2.45 + Math.cos(time * 1.25) * 0.07;
    },
  };
}

export function crystal() {
  const group = new THREE.Group();
  const ice = '#bdefff';
  const accent = '#6fe6ff';

  const flake = new THREE.Group();
  group.add(flake);

  const iceMaterial = {
    transparent: true,
    opacity: 0.7,
    emissive: accent,
    emissiveIntensity: 0.55,
    roughness: 0.14,
    metalness: 0.28,
    depthWrite: false,
  };

  const center = meshHex(0.62, 0.08, iceMaterial);
  center.rotation.x = Math.PI / 2;
  flake.add(center);

  const addArm = (angle, length, radius, thickness, offset = 0, opacity = 0.8) => {
    const arm = box(length, thickness, thickness, ice, {
      ...iceMaterial,
      opacity,
      transparent: true,
      depthWrite: false,
    });
    arm.position.set(Math.cos(angle) * (offset + length / 2), Math.sin(angle) * (offset + length / 2), 0);
    arm.rotation.z = angle;
    flake.add(arm);
    return arm;
  };

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    addArm(angle, 2.55, 0.03, 0.045, 0.52, 0.82);

    for (const branch of [
      { at: 1.05, len: 0.75, tilt: Math.PI / 3 },
      { at: 1.75, len: 0.52, tilt: -Math.PI / 3 },
      { at: 2.28, len: 0.32, tilt: Math.PI / 3 },
    ]) {
      const bx = Math.cos(angle) * (0.52 + branch.at);
      const by = Math.sin(angle) * (0.52 + branch.at);
      for (const sign of [1, -1]) {
        const bAngle = angle + branch.tilt * sign;
        const branchMesh = box(branch.len, 0.032, 0.032, ice, {
          ...iceMaterial,
          opacity: 0.65,
          transparent: true,
          depthWrite: false,
        });
        branchMesh.position.set(
          bx + Math.cos(bAngle) * branch.len * 0.5 * 0.72,
          by + Math.sin(bAngle) * branch.len * 0.5 * 0.72,
          0
        );
        branchMesh.rotation.z = bAngle;
        flake.add(branchMesh);
      }
    }

    const tip = meshHex(0.18, 0.05, { ...iceMaterial, opacity: 0.9 });
    tip.rotation.x = Math.PI / 2;
    tip.position.set(Math.cos(angle) * 3.1, Math.sin(angle) * 3.1, 0);
    flake.add(tip);
  }

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const ray = addLine(flake, [[0, 0, 0], [Math.cos(angle) * 3.3, Math.sin(angle) * 3.3, 0]], accent, 0.12);
    ray.renderOrder = 1;
  }

  const sparkleCount = 90;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  const rand = seeded(88);
  for (let i = 0; i < sparkleCount; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 1 + rand() * 4.5;
    sparklePositions.set([Math.cos(a) * r, Math.sin(a) * r, (rand() - 0.5) * 3], i * 3);
  }
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  const sparkles = new THREE.Points(
    sparkleGeo,
    new THREE.PointsMaterial({
      color: '#d8f8ff',
      size: 0.07,
      transparent: true,
      opacity: 0.7,
      map: makeGlowTexture('#d8f8ff'),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  group.add(sparkles);

  addLabel(group, '六重对称', [0, 4.05, 0], {
    color: accent,
    fontSize: 34,
    scale: 0.0074,
    bg: 'rgba(4, 10, 18, 0.7)',
    border: 'rgba(111, 230, 255, 0.32)',
    padding: 11,
  });
  addLabel(group, '六方冰晶 · 水分子骨架', [0, -3.85, 0], {
    color: '#cfeaff',
    fontSize: 27,
    scale: 0.0063,
  });
  addLabel(group, '温度与湿度决定最终形态', [0, -4.5, 0], {
    color: 'rgba(150, 195, 235, 0.7)',
    fontSize: 22,
    scale: 0.0055,
  });

  addGlow(group, '#2e7fa8', 12, [0, 0, -4], 0.24);
  group.rotation.z = 0.12;

  return {
    group,
    view: { position: [0, 2.8, 11.5], target: [0, 0, 0] },
    autoRotateSpeed: 0.36,
    update(time, dt) {
      const grow = Math.min(1, 0.45 + time * 0.42);
      flake.scale.setScalar(grow);
      flake.rotation.y = time * 0.12;
      flake.rotation.z = 0.12 + Math.sin(time * 0.27) * 0.03;
      sparkles.rotation.z = -time * 0.05;
      sparkles.material.opacity = 0.45 + Math.sin(time * 1.6) * 0.22;
    },
  };
}

function meshHex(radius, height, options = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.color ?? '#bdefff'),
    emissive: new THREE.Color(options.emissive ?? '#6fe6ff'),
    emissiveIntensity: options.emissiveIntensity ?? 0.55,
    roughness: options.roughness ?? 0.14,
    metalness: options.metalness ?? 0.28,
    transparent: options.transparent ?? true,
    opacity: options.opacity ?? 0.7,
    depthWrite: options.depthWrite ?? false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}
