import {
  THREE,
  addDashedLine,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cylinder,
  sphere,
} from './helpers.js';

function dynLine(parent, color, opacity = 0.55) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  parent.add(line);
  return line;
}

function setDynLine(line, a, b) {
  const attr = line.geometry.attributes.position;
  attr.setXYZ(0, a.x, a.y, a.z);
  attr.setXYZ(1, b.x, b.y, b.z);
  attr.needsUpdate = true;
}

export function colorWheel() {
  const group = new THREE.Group();
  const accent = '#FF6FC0';

  const wheel = new THREE.Group();
  wheel.position.y = 1.0;
  group.add(wheel);

  const segments = 12;
  const ringGeoStart = -Math.PI / 2;
  for (let i = 0; i < segments; i += 1) {
    const hue = i / segments;
    const thetaStart = ringGeoStart + (i / segments) * Math.PI * 2;
    const thetaLength = (Math.PI * 2) / segments - 0.018;
    const color = new THREE.Color().setHSL(hue, 0.92, 0.5);
    const geometry = new THREE.RingGeometry(1.7, 2.55, 48, 1, thetaStart, thetaLength);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        toneMapped: false,
        transparent: true,
        opacity: 0.88,
      })
    );
    wheel.add(mesh);
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.58, 48, 1, thetaStart, thetaLength),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false })
    );
    wheel.add(edge);
  }

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.018, 6, 160),
    new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.3, toneMapped: false })
  );
  wheel.add(outer);
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(1.66, 0.014, 6, 120),
    new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.25, toneMapped: false })
  );
  wheel.add(inner);

  const hub = cylinder(0.94, 0.94, 0.05, '#0a1320', {
    metalness: 0.3,
    roughness: 0.4,
    emissive: '#17283d',
    emissiveIntensity: 0.4,
  });
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.04;
  wheel.add(hub);
  for (let i = 0; i < 3; i += 1) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.22 + i * 0.16, 0.008, 5, 64),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / 3, 0.7, 0.65),
        transparent: true,
        opacity: 0.26,
        toneMapped: false,
      })
    );
    wheel.add(orbit);
  }
  addLabel(wheel, 'H / S / L', [0, 0.02, 0.2], {
    color: '#dff8ff',
    fontSize: 26,
    scale: 0.0062,
    letterSpacing: 2,
  });

  const colorNames = [
    { name: '红', hue: 0 },
    { name: '橙', hue: 0.083 },
    { name: '黄', hue: 0.17 },
    { name: '绿', hue: 0.333 },
    { name: '青', hue: 0.5 },
    { name: '蓝', hue: 0.667 },
    { name: '紫', hue: 0.833 },
  ];
  colorNames.forEach((c) => {
    const angle = ringGeoStart + c.hue * Math.PI * 2;
    addLabel(wheel, c.name, [Math.cos(angle) * 2.95, Math.sin(angle) * 2.95, 0.1], {
      color: new THREE.Color().setHSL(c.hue, 0.75, 0.68).getStyle(),
      fontSize: 22,
      scale: 0.0052,
    });
  });

  const beamPairs = [0, 1, 2, 3];
  const beams = beamPairs.map((i) => {
    const a = ringGeoStart + (i / segments) * Math.PI * 2;
    const b = ringGeoStart + ((i + 6) / segments) * Math.PI * 2;
    const line = addLine(
      wheel,
      [
        [Math.cos(a) * 1.62, Math.sin(a) * 1.62, 0.12],
        [Math.cos(b) * 1.62, Math.sin(b) * 1.62, 0.12],
      ],
      '#ffffff',
      0.16
    );
    return line;
  });

  const swatches = new THREE.Group();
  swatches.position.set(0, -2.15, 0);
  group.add(swatches);

  const cardData = [
    { title: '互补色', colors: ['#e4574f', '#3fa9a6'], x: -3.4 },
    { title: '邻近色', colors: ['#e4574f', '#e47c4f', '#e4b04f'], x: 0 },
    { title: '三角配色', colors: ['#e4574f', '#4fae6f', '#4f7fe4'], x: 3.4 },
  ];
  cardData.forEach((card) => {
    const panel = box(2.55, 1.45, 0.08, '#0b1524', {
      roughness: 0.5,
      metalness: 0.2,
      emissive: '#101f35',
      emissiveIntensity: 0.3,
    });
    panel.position.set(card.x, 0, 0);
    swatches.add(panel);
    addLabel(swatches, card.title, [card.x, 0.47, 0.1], {
      color: '#cfe3ff',
      fontSize: 22,
      scale: 0.0053,
      bg: 'rgba(4, 8, 16, 0.5)',
      padding: 6,
    });
    card.colors.forEach((color, i) => {
      const chip = box(0.52, 0.52, 0.05, color, {
        roughness: 0.3,
        metalness: 0.1,
        emissive: color,
        emissiveIntensity: 0.15,
      });
      chip.position.set(card.x - ((card.colors.length - 1) * 0.6) / 2 + i * 0.6, -0.12, 0.08);
      swatches.add(chip);
    });
  });

  addLabel(group, '色相环 · 12 色', [0, 4.45, 0], {
    color: accent,
    fontSize: 32,
    scale: 0.007,
    bg: 'rgba(12, 6, 12, 0.7)',
    border: 'rgba(255, 111, 192, 0.3)',
    padding: 10,
    glow: 16,
    glowColor: accent,
  });
  addLabel(group, '互补色对比最强 · 邻近色最柔和', [0, -3.5, 0.4], {
    color: 'rgba(210, 225, 245, 0.72)',
    fontSize: 24,
    scale: 0.0057,
  });

  addGlow(group, '#6a2a5c', 14, [0, 0.5, -5], 0.2);

  return {
    group,
    view: { position: [0, 1.8, 12.5], target: [0, 1.0, 0] },
    autoRotate: false,
    update(time) {
      wheel.rotation.z = Math.sin(time * 0.2) * 0.06;
      beams.forEach((beam, i) => {
        beam.material.opacity = 0.12 + Math.max(0, Math.sin(time * 0.9 - i * 0.9)) * 0.5;
      });
      swatches.children.forEach((child) => {
        if (child.isMesh && child.material.color && child.geometry.type === 'BoxGeometry') {
          child.rotation.y = Math.sin(time * 0.4) * 0.03;
        }
      });
    },
  };
}

export function layoutGrid() {
  const group = new THREE.Group();
  const accent = '#FF6FC0';

  const panel = box(7.4, 8.5, 0.14, '#0b1523', {
    roughness: 0.5,
    metalness: 0.2,
    emissive: '#0c1a2c',
    emissiveIntensity: 0.35,
  });
  panel.position.set(0, 1.55, 0);
  group.add(panel);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(7.4, 8.5, 0.14)),
    new THREE.LineBasicMaterial({
      color: new THREE.Color('#6fa8d8'),
      transparent: true,
      opacity: 0.32,
      toneMapped: false,
    })
  );
  border.position.copy(panel.position);
  group.add(border);

  const grid = new THREE.Group();
  grid.position.set(0, 1.55, 0.1);
  group.add(grid);

  const marginX = 0.55;
  const marginY = 0.55;
  const cols = 12;
  const gridW = 7.4 - marginX * 2;
  const gridH = 8.5 - marginY * 2;
  for (let i = 0; i <= cols; i += 1) {
    const x = -gridW / 2 + (i / cols) * gridW;
    const major = i % 3 === 0;
    addLine(grid, [[x, -gridH / 2, 0], [x, gridH / 2, 0]], major ? '#6fb6e8' : '#31536e', major ? 0.22 : 0.12);
  }
  for (let i = 0; i <= 16; i += 1) {
    const y = -gridH / 2 + (i / 16) * gridH;
    addLine(grid, [[-gridW / 2, y, 0], [gridW / 2, y, 0]], i % 4 === 0 ? '#6fb6e8' : '#31536e', i % 4 === 0 ? 0.2 : 0.09);
  }

  addLine(group, [[-3.15, 5.8, 0.14], [3.15, 5.8, 0.14]], accent, 0.7);
  addLabel(group, '12 栏网格', [0, 6.28, 0.2], {
    color: accent,
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(12, 6, 12, 0.7)',
    border: 'rgba(255, 111, 192, 0.3)',
    padding: 9,
  });

  const blocks = [];
  const hero = box(3.2, 2.35, 0.1, '#d95f9f', {
    roughness: 0.45,
    emissive: '#ff6fc0',
    emissiveIntensity: 0.35,
  });
  hero.position.set(-1.0, 3.15, 0.2);
  group.add(hero);
  blocks.push(hero);

  const headline = [];
  for (let i = 0; i < 3; i += 1) {
    const bar = box(i === 0 ? 2.0 : 2.8 - i * 0.4, 0.2, 0.06, '#dbe8f7', {
      emissive: '#93b7d8',
      emissiveIntensity: 0.25,
      roughness: 0.6,
    });
    bar.position.set(1.15, 4.6 - i * 0.55, 0.2);
    group.add(bar);
    headline.push(bar);
  }

  for (let i = 0; i < 5; i += 1) {
    const line = box(2.8, 0.055, 0.04, '#597a99', { transparent: true, opacity: 0.5, roughness: 0.8 });
    line.position.set(1.15, 2.55 - i * 0.26, 0.2);
    group.add(line);
  }

  const button = box(1.3, 0.36, 0.07, '#e8f4ff', {
    emissive: '#ade2ff',
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  button.position.set(1.15, 1.0, 0.2);
  group.add(button);

  const sideCard = box(2.2, 2.05, 0.08, '#18304a', {
    roughness: 0.5,
    emissive: '#2d6e99',
    emissiveIntensity: 0.25,
  });
  sideCard.position.set(0.85, 0.98, 0.16);
  group.add(sideCard);

  const caption = box(3.1, 0.05, 0.04, '#7ba6c6', { transparent: true, opacity: 0.5 });
  caption.position.set(-1.0, 1.65, 0.2);
  group.add(caption);
  for (let i = 0; i < 2; i += 1) {
    const textLine = box(2.4 - i * 0.5, 0.04, 0.04, '#4b6b86', { transparent: true, opacity: 0.45 });
    textLine.position.set(-1.35, 1.38 - i * 0.2, 0.2);
    group.add(textLine);
  }

  addLabel(group, '留白', [-3.1, 0.1, 0.2], {
    color: '#9fc9e8',
    fontSize: 22,
    scale: 0.0052,
    bg: 'rgba(4, 8, 16, 0.55)',
    padding: 6,
  });
  addLine(group, [[-2.85, 0.45, 0.14], [-2.3, 0.9, 0.14]], '#7fc6ef', 0.3);
  addLabel(group, '内容宽度 = 栏宽 × 栏数 + 槽宽 × (栏数−1)', [0, -2.95, 0.3], {
    color: 'rgba(195, 220, 240, 0.72)',
    fontSize: 22,
    scale: 0.0054,
  });
  addLabel(group, '8px 基准 · 节奏统一', [0, -3.5, 0.3], {
    color: 'rgba(150, 185, 225, 0.62)',
    fontSize: 20,
    scale: 0.005,
  });

  const scan = box(0.03, 8.1, 0.02, '#ff9bd1', {
    transparent: true,
    opacity: 0.5,
    emissive: '#ff6fc0',
    emissiveIntensity: 1.2,
  });
  scan.position.set(-3.1, 1.55, 0.3);
  group.add(scan);

  addGlow(group, '#4d1d43', 16, [0, 1.5, -5], 0.24);

  return {
    group,
    view: { position: [0, 1.7, 13.8], target: [0, 1.55, 0] },
    autoRotate: false,
    update(time) {
      const x = -3.1 + ((time * 0.45) % 6.2);
      scan.position.x = x;
      scan.material.opacity = 0.2 + Math.sin(time * 2.4) * 0.12;
      blocks[0].material.emissiveIntensity = 0.3 + Math.sin(time * 1.3) * 0.07;
      headline.forEach((bar, i) => {
        bar.position.z = 0.2 + Math.sin(time * 1.1 + i) * 0.015;
      });
    },
  };
}

export function bezier() {
  const group = new THREE.Group();
  const accent = '#FF6FC0';
  const violet = '#9B7BFF';

  const p0 = new THREE.Vector3(-4.7, -1.9, 0.2);
  const p1 = new THREE.Vector3(-2.0, 3.5, 1.2);
  const p2 = new THREE.Vector3(2.1, -3.4, -1.0);
  const p3 = new THREE.Vector3(4.7, 1.9, 0.3);
  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

  addTube(group, curve.getPoints(120), accent, 0.055, 0.88);
  addGlow(group, '#8d2e6b', 14, [0, 0, -4], 0.2);

  const handleLines = [
    addDashedLine(group, [p0, p1], '#6f8fb5', 0.36, 0.18, 0.13),
    addDashedLine(group, [p1, p2], '#6f8fb5', 0.24, 0.18, 0.13),
    addDashedLine(group, [p2, p3], '#6f8fb5', 0.36, 0.18, 0.13),
  ];

  const points = [p0, p1, p2, p3];
  const pointMeshes = points.map((p, i) => {
    const isControl = i === 1 || i === 2;
    const mesh = sphere(isControl ? 0.15 : 0.19, isControl ? violet : accent, {
      emissive: isControl ? violet : accent,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    });
    mesh.position.copy(p);
    group.add(mesh);
    addGlow(group, isControl ? violet : accent, isControl ? 1.5 : 2.0, p, 0.5);
    addLabel(group, `P${i}`, [p.x + 0.3, p.y + 0.3, p.z], {
      color: isControl ? '#c9baff' : '#ffc0e0',
      fontSize: 24,
      scale: 0.0055,
      bg: 'rgba(6, 8, 16, 0.65)',
      padding: 6,
    });
    return mesh;
  });

  const aPoint = sphere(0.11, '#9fe8ff', { emissive: '#6be7ff', emissiveIntensity: 1.5 });
  const bPoint = sphere(0.11, '#9fe8ff', { emissive: '#6be7ff', emissiveIntensity: 1.5 });
  const cPoint = sphere(0.11, '#9fe8ff', { emissive: '#6be7ff', emissiveIntensity: 1.5 });
  const dPoint = sphere(0.09, '#ffe6a6', { emissive: '#ffd37a', emissiveIntensity: 1.5 });
  const ePoint = sphere(0.09, '#ffe6a6', { emissive: '#ffd37a', emissiveIntensity: 1.5 });
  const fPoint = sphere(0.15, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 2.2 });
  group.add(aPoint, bPoint, cPoint, dPoint, ePoint, fPoint);
  const fGlow = addGlow(group, '#ffffff', 1.9, [0, 0, 0], 0.55);

  const dynA = dynLine(group, '#6be7ff', 0.5);
  const dynB = dynLine(group, '#6be7ff', 0.5);
  const dynD = dynLine(group, '#ffd37a', 0.4);

  addLabel(group, '三次贝塞尔曲线', [0, 5.3, 0.3], {
    color: accent,
    fontSize: 32,
    scale: 0.0069,
    bg: 'rgba(12, 6, 12, 0.7)',
    border: 'rgba(255, 111, 192, 0.3)',
    padding: 10,
  });
  addLabel(group, 'B(t) = (1−t)³P₀ + 3(1−t)²tP₁ + 3(1−t)t²P₂ + t³P₃', [0, -5.15, 0.4], {
    color: 'rgba(225, 205, 245, 0.8)',
    fontSize: 22,
    scale: 0.0054,
    bg: 'rgba(6, 8, 16, 0.55)',
    padding: 8,
  });
  addLabel(group, '控制点决定端点的切线方向', [0, -5.7, 0.4], {
    color: 'rgba(175, 190, 225, 0.64)',
    fontSize: 20,
    scale: 0.005,
  });

  return {
    group,
    view: { position: [0, 0.8, 13.2], target: [0, 0, 0] },
    autoRotate: false,
    update(time) {
      const t = (time * 0.16) % 1;
      const a = p0.clone().lerp(p1, t);
      const b = p1.clone().lerp(p2, t);
      const c = p2.clone().lerp(p3, t);
      const d = a.clone().lerp(b, t);
      const e = b.clone().lerp(c, t);
      const f = d.clone().lerp(e, t);
      aPoint.position.copy(a);
      bPoint.position.copy(b);
      cPoint.position.copy(c);
      dPoint.position.copy(d);
      ePoint.position.copy(e);
      fPoint.position.copy(f);
      fGlow.position.copy(f);
      fGlow.material.opacity = 0.35 + Math.sin(time * 4) * 0.12;
      setDynLine(dynA, a, b);
      setDynLine(dynB, b, c);
      setDynLine(dynD, d, e);
      fPoint.scale.setScalar(1 + Math.sin(time * 5) * 0.12);
      pointMeshes.forEach((mesh, i) => {
        mesh.position.copy(points[i]);
      });
      handleLines.forEach((line, i) => {
        line.material.opacity = 0.22 + Math.sin(time * 1.2 + i) * 0.08;
      });
    },
  };
}
