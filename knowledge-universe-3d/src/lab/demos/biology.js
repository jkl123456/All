import {
  THREE,
  addDashedLine,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  ringLine,
  seeded,
  sphere,
} from './helpers.js';

export function photosynthesis() {
  const group = new THREE.Group();
  const green = '#79E86B';
  const cyan = '#6BE7FF';

  const leafGroup = new THREE.Group();
  leafGroup.position.set(0.2, 0.2, 0);
  leafGroup.rotation.set(0.05, -0.38, 0.28);
  group.add(leafGroup);

  const shape = new THREE.Shape();
  shape.moveTo(0, -3.25);
  shape.bezierCurveTo(1.75, -2.1, 2.15, 1.35, 0, 3.25);
  shape.bezierCurveTo(-2.15, 1.35, -1.75, -2.1, 0, -3.25);

  const leafGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    bevelSegments: 2,
    curveSegments: 36,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: '#2f9e57',
    emissive: '#1f6f3b',
    emissiveIntensity: 0.5,
    roughness: 0.48,
    metalness: 0.08,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
  leafGroup.add(leaf);

  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(shape.getPoints(80).map((p) => new THREE.Vector3(p.x, p.y, 0.19))),
    new THREE.LineBasicMaterial({
      color: new THREE.Color('#9affb8'),
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
    })
  );
  leafGroup.add(outline);

  addTube(leafGroup, [[0, -3.1, 0.22], [0, 3.05, 0.22]], '#a8ffc4', 0.022, 0.55);
  for (let i = 0; i < 7; i += 1) {
    const y = -2.25 + i * 0.7;
    const width = 1.55 * Math.sin(Math.PI * ((y + 3.25) / 6.5));
    for (const sign of [-1, 1]) {
      addTube(
        leafGroup,
        [
          [0, y, 0.22],
          [width * 0.42 * sign, y + 0.28, 0.22],
          [width * 0.8 * sign, y + 0.48, 0.22],
        ],
        '#a8ffc4',
        0.012,
        0.5
      );
    }
  }

  const chloroplasts = [];
  for (let i = 0; i < 4; i += 1) {
    const cl = sphere(0.22, '#8dff8a', {
      transparent: true,
      opacity: 0.85,
      emissive: '#59e06b',
      emissiveIntensity: 0.75,
      roughness: 0.4,
      segments: 18,
      rings: 12,
    });
    cl.scale.set(1.75, 0.72, 0.34);
    cl.position.set(-0.55 + (i % 2) * 1.1, -1.2 + Math.floor(i / 2) * 1.55, 0.28);
    leafGroup.add(cl);
    chloroplasts.push(cl);
  }
  addLabel(leafGroup, '叶绿体', [-1.55, 0.65, 0.45], {
    color: '#b9ffb0',
    fontSize: 24,
    scale: 0.0058,
    bg: 'rgba(4, 10, 8, 0.65)',
    border: 'rgba(121, 232, 107, 0.28)',
    padding: 7,
  });

  const glucose = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 6),
    new THREE.MeshBasicMaterial({
      color: '#ffe08a',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
  glucose.position.set(0.92, -0.15, 0.32);
  leafGroup.add(glucose);
  addLabel(leafGroup, '葡萄糖', [1.65, -0.15, 0.4], {
    color: '#ffe6a6',
    fontSize: 22,
    scale: 0.0055,
  });

  const sun = sphere(0.72, '#FFE08A', {
    emissive: '#ffd45e',
    emissiveIntensity: 1.6,
    roughness: 0.3,
  });
  sun.position.set(-5.2, 3.9, -1.8);
  group.add(sun);
  addGlow(group, '#ffd45e', 7.5, sun.position, 0.55);
  addLabel(group, '光能', [-5.2, 5.0, -1.8], {
    color: '#ffe6a6',
    fontSize: 28,
    scale: 0.0064,
  });

  const sunRays = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const ray = addLine(
      group,
      [
        [sun.position.x + Math.cos(angle) * 0.95, sun.position.y + Math.sin(angle) * 0.95, sun.position.z],
        [sun.position.x + Math.cos(angle) * 1.5, sun.position.y + Math.sin(angle) * 1.5, sun.position.z],
      ],
      '#ffe6a6',
      0.5
    );
    sunRays.push(ray);
  }

  for (let i = 0; i < 4; i += 1) {
    addDashedLine(
      group,
      [
        [-4.5 + i * 0.3, 3.45 - i * 0.2, -1.55],
        [-2.0 + i * 0.35, 1.7 - i * 0.28, 0.5],
      ],
      '#ffe6a6',
      0.34,
      0.18,
      0.16
    );
  }

  const co2Curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(4.5, 1.9, 1.0),
    new THREE.Vector3(2.4, 1.4, 1.6),
    new THREE.Vector3(0.7, 0.1, 0.5)
  );
  const co2 = [];
  for (let i = 0; i < 5; i += 1) {
    const dot = sphere(0.09, '#ff9b8f', { emissive: '#ff7a6b', emissiveIntensity: 1.2 });
    group.add(dot);
    co2.push({ dot, offset: i / 5 });
  }
  addLabel(group, 'CO₂', [4.65, 2.25, 1.0], {
    color: '#ffb0a6',
    fontSize: 27,
    scale: 0.0062,
  });

  const h2o = [];
  for (let i = 0; i < 5; i += 1) {
    const dot = sphere(0.07, '#7fdcff', { emissive: '#5bc8ff', emissiveIntensity: 1.1 });
    group.add(dot);
    h2o.push({ dot, offset: i / 5 });
  }
  const stem = cylinder(0.07, 0.1, 1.4, '#4f8a4b', { roughness: 0.7 });
  stem.position.set(0.2, -3.9, 0);
  group.add(stem);
  addLabel(group, 'H₂O', [0.8, -3.9, 0.4], {
    color: '#9fe8ff',
    fontSize: 27,
    scale: 0.0062,
  });

  const o2 = [];
  const rand = seeded(19);
  for (let i = 0; i < 8; i += 1) {
    const bubble = sphere(0.07 + rand() * 0.04, '#d8f8ff', {
      transparent: true,
      opacity: 0.7,
      emissive: '#a8ecff',
      emissiveIntensity: 1.2,
    });
    group.add(bubble);
    o2.push({
      bubble,
      x: -1.8 + rand() * 3.6,
      z: -0.4 + rand() * 1.3,
      phase: rand() * Math.PI * 2,
      speed: 0.35 + rand() * 0.4,
    });
  }
  addLabel(group, 'O₂', [-2.7, 2.9, 0.8], {
    color: '#bdf4ff',
    fontSize: 30,
    scale: 0.0066,
  });

  addLabel(group, '6CO₂ + 6H₂O —光/叶绿体→ C₆H₁₂O₆ + 6O₂', [0.4, -5.1, 0], {
    color: '#b9f7c5',
    fontSize: 29,
    scale: 0.0066,
    bg: 'rgba(4, 10, 8, 0.72)',
    border: 'rgba(121, 232, 107, 0.3)',
    padding: 11,
    glow: 14,
    glowColor: green,
  });
  addLabel(group, '光能 → 化学能', [3.0, -4.35, 0.6], {
    color: 'rgba(150, 220, 175, 0.75)',
    fontSize: 23,
    scale: 0.0057,
  });

  addGlow(group, '#1a5c3a', 12, [0, 0, -4], 0.2);

  return {
    group,
    view: { position: [7.6, 4.7, 12.8], target: [0, -0.2, 0] },
    autoRotateSpeed: 0.18,
    update(time, dt) {
      leafGroup.rotation.y = -0.38 + Math.sin(time * 0.22) * 0.1;
      chloroplasts.forEach((cl, i) => {
        cl.material.emissiveIntensity = 0.65 + Math.sin(time * 1.8 + i) * 0.16;
      });
      sunRays.forEach((ray, i) => {
        ray.material.opacity = 0.3 + Math.sin(time * 2 + i) * 0.14;
      });
      co2.forEach((p) => {
        const u = (time * 0.13 + p.offset) % 1;
        p.dot.position.copy(co2Curve.getPointAt(u));
        p.dot.material.opacity = Math.sin(Math.PI * u) * 0.9;
      });
      h2o.forEach((p) => {
        const u = (time * 0.2 + p.offset) % 1;
        p.dot.position.set(0.2 + Math.sin(u * Math.PI * 2) * 0.06, -3.2 + u * 3.6, 0.2);
        p.dot.material.opacity = Math.sin(Math.PI * u) * 0.85;
      });
      o2.forEach((p) => {
        const u = (time * p.speed * 0.22 + p.phase) % 1;
        p.bubble.position.set(p.x + Math.sin(u * 6 + p.phase) * 0.25, 1.0 + u * 3.8, p.z);
        p.bubble.material.opacity = Math.sin(Math.PI * u) * 0.75;
      });
      glucose.material.opacity = 0.55 + Math.sin(time * 2.4) * 0.2;
    },
  };
}

export function dna() {
  const group = new THREE.Group();
  const cyan = '#5BE7FF';
  const magenta = '#FF6FC0';

  const turns = 3.4;
  const steps = 150;
  const height = 7.6;
  const radius = 1.45;
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const y = -height / 2 + t * height;
    left.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
    right.push([Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius]);
  }

  addTube(group, left, cyan, 0.045, 0.8);
  addTube(group, right, magenta, 0.045, 0.8);

  const rungs = [];
  const baseColors = [
    ['#5BE7FF', '#FF6FC0'],
    ['#FFD37A', '#79E86B'],
  ];
  for (let i = 8; i < steps - 4; i += 9) {
    const a = new THREE.Vector3(...left[i]);
    const b = new THREE.Vector3(...right[i]);
    const pair = baseColors[(i / 9) % 2 === 0 ? 0 : 1];
    const rung = cylinder(0.034, 0.034, a.distanceTo(b), pair[0], {
      emissive: pair[0],
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.85,
    });
    rung.position.copy(a).add(b).multiplyScalar(0.5);
    rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    group.add(rung);
    rungs.push(rung);

    const rungIndex = (i - 8) / 9;
    if (rungIndex % 2 === 0) {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      addLabel(group, rungIndex % 4 === 0 ? 'A—T' : 'C—G', [mid.x, mid.y + 0.02, mid.z], {
        color: rungIndex % 4 === 0 ? '#c9f8ff' : '#ffe5b0',
        fontSize: 19,
        scale: 0.0047,
        opacity: 0.8,
      });
    }
  }

  for (let i = 0; i <= steps; i += 8) {
    const dotL = sphere(0.066, cyan, { emissive: cyan, emissiveIntensity: 1.4 });
    dotL.position.set(...left[i]);
    group.add(dotL);
    const dotR = sphere(0.066, magenta, { emissive: magenta, emissiveIntensity: 1.4 });
    dotR.position.set(...right[i]);
    group.add(dotR);
  }

  const letters = [
    { char: 'A', color: '#5BE7FF', pos: [-3.4, 2.65, 0.4] },
    { char: 'T', color: '#FF6FC0', pos: [-3.6, 1.55, 0.2] },
    { char: 'C', color: '#FFD37A', pos: [3.4, 2.15, 0.3] },
    { char: 'G', color: '#79E86B', pos: [3.6, 1.05, 0.1] },
  ];
  letters.forEach((l) => {
    addLabel(group, l.char, l.pos, {
      color: l.color,
      fontSize: 40,
      scale: 0.0074,
      glow: 12,
      glowColor: l.color,
    });
  });

  addLabel(group, 'A—T · C—G 互补配对', [0, 4.85, 0], {
    color: '#d9f7ff',
    fontSize: 29,
    scale: 0.0066,
    bg: 'rgba(5, 10, 18, 0.7)',
    border: 'rgba(91, 231, 255, 0.3)',
    padding: 10,
  });
  addLabel(group, '磷酸—脱氧核糖骨架', [-2.45, -4.35, 0], {
    color: 'rgba(155, 235, 255, 0.75)',
    fontSize: 23,
    scale: 0.0057,
  });
  addLabel(group, '人类基因组约 30 亿个碱基对', [0, -4.95, 0], {
    color: 'rgba(190, 215, 240, 0.7)',
    fontSize: 22,
    scale: 0.0054,
  });

  addGlow(group, '#2e4fa0', 9, [0, 0, -3], 0.22);

  return {
    group,
    view: { position: [0.2, 1.2, 13.2], target: [0, 0, 0] },
    autoRotate: true,
    autoRotateSpeed: 0.32,
    update(time) {
      group.rotation.y = time * 0.18;
      rungs.forEach((rung, i) => {
        rung.material.emissiveIntensity = 0.5 + Math.sin(time * 2 + i * 0.4) * 0.3;
      });
    },
  };
}

export function foodchain() {
  const group = new THREE.Group();
  const green = '#79E86B';
  const amber = '#FFD37A';

  const tiers = [
    { radius: 4.2, y: 0.0, color: '#4f9e4a', label: '生产者 · 草', note: '固定太阳能 100%' },
    { radius: 3.35, y: 1.15, color: '#9fd67a', label: '初级消费者 · 兔', note: '获得约 10%~20%' },
    { radius: 2.5, y: 2.3, color: '#ffa45c', label: '次级消费者 · 狐', note: '获得约 10%~20%' },
    { radius: 1.65, y: 3.45, color: '#cfc2a2', label: '顶级消费者 · 鹰', note: '能量最少' },
  ];

  tiers.forEach((tier, i) => {
    const disc = cylinder(tier.radius, tier.radius + 0.16, 0.16, tier.color, {
      roughness: 0.72,
      emissive: tier.color,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    disc.position.y = tier.y;
    group.add(disc);

    const ring = ringLine(tier.radius + 0.02, tier.color, 0.3, 110, 0);
    ring.position.y = tier.y + 0.1;
    group.add(ring);

    addLabel(group, tier.label, [tier.radius + 1.45, tier.y + 0.42, 0], {
      color: '#dff3ff',
      fontSize: 25,
      scale: 0.0059,
      bg: 'rgba(5, 10, 18, 0.68)',
      border: 'rgba(130, 180, 220, 0.24)',
      padding: 8,
    });
    addLabel(group, tier.note, [tier.radius + 1.5, tier.y + 0.0, 0], {
      color: 'rgba(160, 195, 230, 0.65)',
      fontSize: 19,
      scale: 0.0049,
    });
  });

  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2;
    const blade = cone(0.05, 0.5 + (i % 3) * 0.14, '#7ed477', {
      emissive: '#2e7d3b',
      emissiveIntensity: 0.25,
      roughness: 0.7,
    });
    blade.position.set(Math.cos(angle) * (2.2 + (i % 5) * 0.32), 0.3, Math.sin(angle) * (2.2 + (i % 5) * 0.32));
    blade.rotation.z = Math.sin(angle) * 0.16;
    group.add(blade);
  }

  const rabbit = new THREE.Group();
  rabbit.position.set(2.55, 1.29, 1.15);
  rabbit.scale.setScalar(1.28);
  const rabbitMat = { roughness: 0.65, emissive: '#6c7d8f', emissiveIntensity: 0.12 };
  const rBody = sphere(0.3, '#d7e2ec', rabbitMat);
  rBody.scale.set(1.2, 0.85, 0.85);
  rBody.position.y = 0.28;
  const rHead = sphere(0.19, '#d7e2ec', rabbitMat);
  rHead.position.set(0.34, 0.52, 0);
  const earGeo = new THREE.CapsuleGeometry(0.045, 0.4, 4, 8);
  const earMat = new THREE.MeshStandardMaterial({ color: '#d7e2ec', roughness: 0.65 });
  const ear1 = new THREE.Mesh(earGeo, earMat);
  ear1.position.set(0.29, 0.86, 0.06);
  ear1.rotation.z = 0.18;
  const ear2 = ear1.clone();
  ear2.position.z = -0.06;
  ear2.rotation.z = 0.32;
  const tail = sphere(0.11, '#ffffff', rabbitMat);
  tail.position.set(-0.35, 0.35, 0);
  rabbit.add(rBody, rHead, ear1, ear2, tail);
  group.add(rabbit);

  const fox = new THREE.Group();
  fox.position.set(1.85, 2.44, 0.9);
  fox.scale.setScalar(1.32);
  const foxMat = { roughness: 0.6, emissive: '#b3561d', emissiveIntensity: 0.2 };
  const fBody = sphere(0.27, '#e88a45', foxMat);
  fBody.scale.set(1.45, 0.72, 0.75);
  fBody.position.y = 0.24;
  const fHead = sphere(0.17, '#f1a05a', foxMat);
  fHead.position.set(0.43, 0.4, 0);
  const fEar1 = cone(0.09, 0.24, '#e88a45', foxMat);
  fEar1.position.set(0.43, 0.62, 0.09);
  const fEar2 = fEar1.clone();
  fEar2.position.z = -0.09;
  const fTail = cone(0.12, 0.65, '#d97835', foxMat);
  fTail.position.set(-0.55, 0.32, 0);
  fTail.rotation.z = Math.PI / 2.2;
  fox.add(fBody, fHead, fEar1, fEar2, fTail);
  group.add(fox);

  const eagle = new THREE.Group();
  eagle.position.set(0.15, 3.59, 0);
  eagle.scale.setScalar(1.4);
  const eagleMat = { roughness: 0.55, emissive: '#4b3f2f', emissiveIntensity: 0.18 };
  const eBody = sphere(0.22, '#b69a72', eagleMat);
  eBody.scale.set(1.1, 1.25, 0.85);
  eBody.position.y = 0.3;
  const eHead = sphere(0.13, '#efe2c6', eagleMat);
  eHead.position.set(0.15, 0.58, 0);
  const wingMat = new THREE.MeshStandardMaterial({ color: '#8c7456', roughness: 0.55 });
  const wingGeo = new THREE.BoxGeometry(1.15, 0.06, 0.22);
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.45, 0.44, 0.2);
  wingL.rotation.y = 0.4;
  wingL.rotation.z = 0.2;
  const wingR = wingL.clone();
  wingR.position.z = -0.2;
  wingR.rotation.y = -0.4;
  wingR.rotation.z = -0.2;
  eagle.add(eBody, eHead, wingL, wingR);
  group.add(eagle);

  addLabel(group, '能量单向流动 · 逐级递减', [-0.2, 5.25, 0], {
    color: amber,
    fontSize: 29,
    scale: 0.0066,
    bg: 'rgba(5, 10, 18, 0.7)',
    border: 'rgba(255, 211, 122, 0.3)',
    padding: 10,
    glow: 12,
    glowColor: amber,
  });

  const energy = [];
  for (let i = 0; i < 14; i += 1) {
    const dot = sphere(0.055, '#ffe7a8', {
      emissive: '#ffd37a',
      emissiveIntensity: 1.4,
      transparent: true,
    });
    group.add(dot);
    energy.push({ dot, offset: i / 14, x: -1.6 + (i % 4) * 0.32, z: 1.15 + Math.floor(i / 4) * 0.22 });
  }

  const shell = new THREE.Mesh(
    new THREE.ConeGeometry(4.35, 4.0, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6bc7ff,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      toneMapped: false,
    })
  );
  shell.position.y = 2.05;
  group.add(shell);

  return {
    group,
    view: { position: [8.4, 6.2, 13.8], target: [0, 2.2, 0] },
    autoRotateSpeed: 0.22,
    update(time, dt) {
      rabbit.position.y = 1.29 + Math.sin(time * 1.4) * 0.06;
      fox.position.y = 2.44 + Math.cos(time * 1.2) * 0.05;
      eagle.position.y = 3.59 + Math.sin(time * 1.7 + 1) * 0.07;
      eagle.rotation.y = Math.sin(time * 0.4) * 0.2;
      energy.forEach((p) => {
        const u = (time * 0.18 + p.offset) % 1;
        p.dot.position.set(p.x, 0.4 + u * 4.1, p.z);
        p.dot.material.opacity = Math.sin(Math.PI * u) * 0.75;
      });
      shell.rotation.y = time * 0.08;
    },
  };
}
