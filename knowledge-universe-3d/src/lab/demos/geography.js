import {
  THREE,
  addArrow,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  createCanvasTexture,
  cylinder,
  ringLine,
  seeded,
  sphere,
} from './helpers.js';

export function earthLayers() {
  const group = new THREE.Group();
  const cyan = '#35C8F5';
  const orange = '#FF9F45';

  const earth = new THREE.Group();
  group.add(earth);

  const wireMaterial = (color, opacity) =>
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      wireframe: true,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });

  const innerCore = sphere(0.95, '#FFD37A', {
    emissive: '#FF9F45',
    emissiveIntensity: 1.2,
    roughness: 0.3,
    metalness: 0.2,
  });
  earth.add(innerCore);
  addGlow(earth, '#ffb45e', 4.6, [0, 0, 0], 0.55);

  const outerCore = sphere(1.55, '#FF8A45', {
    emissive: '#d9571f',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.4,
    roughness: 0.45,
    depthWrite: false,
  });
  earth.add(outerCore);

  const mantleOuter = sphere(2.85, '#d46a45', {
    transparent: true,
    opacity: 0.09,
    roughness: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  earth.add(mantleOuter);
  const mantleWire = sphere(2.86, '#ff9b70', {
    transparent: true,
    opacity: 0.07,
    roughness: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mantleWire.material.wireframe = true;
  earth.add(mantleWire);

  const crust = sphere(3.04, '#4eac83', {
    transparent: true,
    opacity: 0.16,
    roughness: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  earth.add(crust);
  const crustWire = sphere(3.05, '#7ee8c2', {
    transparent: true,
    opacity: 0.12,
    roughness: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  crustWire.material.wireframe = true;
  earth.add(crustWire);



  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(3.55, 32, 20), wireMaterial(cyan, 0.06));
  earth.add(atmosphere);
  const atmosphereRing = ringLine(3.55, cyan, 0.12, 120, 0);
  atmosphereRing.position.y = 0;
  earth.add(atmosphereRing);

  for (let i = 1; i <= 3; i += 1) {
    const ring = ringLine(3.1, cyan, 0.1, 100, 0);
    ring.position.y = -1.5 + i * 0.75;
    earth.add(ring);
  }

  addLabel(group, '地核', [3.9, -2.45, 0.3], {
    color: '#ffd08a',
    fontSize: 30,
    scale: 0.0068,
    bg: 'rgba(8, 6, 4, 0.72)',
    border: 'rgba(255, 159, 69, 0.32)',
    padding: 9,
  });
  addLine(group, [[3.4, -2.35, 0.2], [0.7, -0.55, 0.5]], '#ffb45e', 0.35);
  addLabel(group, '温度可达 5000℃', [3.9, -3.05, 0.3], {
    color: 'rgba(230, 185, 140, 0.72)',
    fontSize: 20,
    scale: 0.0052,
  });

  addLabel(group, '地幔', [4.4, -0.25, 0.4], {
    color: '#ffad85',
    fontSize: 29,
    scale: 0.0066,
    bg: 'rgba(10, 6, 5, 0.7)',
    border: 'rgba(212, 106, 69, 0.32)',
    padding: 9,
  });
  addLine(group, [[3.8, -0.2, 0.2], [2.3, -0.05, 0.9]], '#e08b64', 0.35);

  addLabel(group, '地壳', [3.9, 2.5, 0.2], {
    color: '#8ff5cd',
    fontSize: 29,
    scale: 0.0066,
    bg: 'rgba(4, 10, 8, 0.7)',
    border: 'rgba(78, 172, 131, 0.32)',
    padding: 9,
  });
  addLine(group, [[3.4, 2.35, 0.2], [2.25, 1.8, 1.1]], '#7ee8c2', 0.35);
  addLabel(group, '平均厚度约 17 km', [3.9, 1.85, 0.2], {
    color: 'rgba(150, 225, 195, 0.72)',
    fontSize: 20,
    scale: 0.0052,
  });

  addLabel(group, '大气圈', [-4.1, 3.1, -0.6], {
    color: '#9be8ff',
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(4, 10, 16, 0.65)',
    border: 'rgba(53, 200, 245, 0.28)',
    padding: 8,
  });
  addLine(group, [[-3.2, 2.9, -0.4], [-1.4, 2.35, 0.7]], cyan, 0.3);

  addLabel(group, '地球圈层：内部 + 外部', [0, -4.35, 0.4], {
    color: '#d9f2ff',
    fontSize: 27,
    scale: 0.0063,
    bg: 'rgba(4, 8, 16, 0.66)',
    padding: 9,
  });

  addGlow(group, '#1a4e78', 13, [0, 0, -5], 0.22);

  return {
    group,
    view: { position: [7.2, 4.6, 12.5], target: [0, 0, 0] },
    autoRotateSpeed: 0.24,
    update(time) {
      innerCore.scale.setScalar(1 + Math.sin(time * 1.6) * 0.025);
      outerCore.material.opacity = 0.35 + Math.sin(time * 1.1) * 0.06;
      atmosphere.material.opacity = 0.05 + Math.sin(time * 0.7) * 0.02;
      atmosphereRing.rotation.y = time * 0.1;
    },
  };
}

export function monsoon() {
  const group = new THREE.Group();
  const cyan = '#35C8F5';
  const green = '#79E86B';

  const globe = new THREE.Group();
  group.add(globe);

  const ocean = sphere(2.75, '#0d3f68', {
    emissive: '#0a2c4b',
    emissiveIntensity: 0.55,
    roughness: 0.45,
    metalness: 0.25,
  });
  globe.add(ocean);

  const mapTexture = createCanvasTexture(1024, 512, (ctx, w, h) => {
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, h);
    oceanGradient.addColorStop(0, '#092a44');
    oceanGradient.addColorStop(0.5, '#0d4668');
    oceanGradient.addColorStop(1, '#071f33');
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, w, h);

    const rand = seeded(202406);
    ctx.fillStyle = 'rgba(100, 200, 235, 0.05)';
    for (let i = 0; i < 140; i += 1) {
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 2 + rand() * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawLand = (draw, fill, stroke) => {
      ctx.beginPath();
      draw();
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 4;
      ctx.stroke();
    };

    drawLand(
      () => {
        ctx.moveTo(300, 92);
        ctx.bezierCurveTo(365, 74, 430, 96, 485, 118);
        ctx.bezierCurveTo(520, 134, 510, 178, 485, 206);
        ctx.bezierCurveTo(462, 232, 454, 282, 430, 318);
        ctx.bezierCurveTo(410, 344, 384, 322, 378, 292);
        ctx.bezierCurveTo(358, 300, 338, 284, 344, 258);
        ctx.bezierCurveTo(314, 246, 292, 214, 304, 182);
        ctx.bezierCurveTo(276, 160, 278, 120, 300, 92);
      },
      '#3c8d60',
      'rgba(157, 235, 193, 0.45)'
    );
    drawLand(
      () => {
        ctx.moveTo(427, 302);
        ctx.bezierCurveTo(455, 316, 476, 348, 466, 399);
        ctx.bezierCurveTo(458, 437, 424, 452, 402, 424);
        ctx.bezierCurveTo(382, 396, 390, 336, 427, 302);
      },
      '#357f58',
      'rgba(157, 235, 193, 0.4)'
    );
    drawLand(
      () => {
        ctx.moveTo(258, 136);
        ctx.bezierCurveTo(280, 126, 316, 130, 328, 154);
        ctx.bezierCurveTo(336, 174, 322, 199, 300, 210);
        ctx.bezierCurveTo(279, 220, 252, 203, 249, 180);
        ctx.bezierCurveTo(246, 162, 243, 146, 258, 136);
      },
      '#438e63',
      'rgba(167, 240, 200, 0.4)'
    );
    drawLand(
      () => {
        ctx.moveTo(497, 332);
        ctx.bezierCurveTo(532, 326, 566, 344, 570, 369);
        ctx.bezierCurveTo(573, 394, 536, 410, 505, 402);
        ctx.bezierCurveTo(479, 394, 470, 360, 497, 332);
      },
      '#397f57',
      'rgba(157, 235, 193, 0.4)'
    );
    drawLand(
      () => {
        ctx.moveTo(770, 152);
        ctx.bezierCurveTo(816, 132, 878, 146, 900, 196);
        ctx.bezierCurveTo(918, 240, 890, 304, 856, 358);
        ctx.bezierCurveTo(828, 402, 786, 390, 778, 344);
        ctx.bezierCurveTo(766, 288, 746, 208, 770, 152);
      },
      '#3b855b',
      'rgba(157, 235, 193, 0.4)'
    );
    drawLand(
      () => {
        ctx.moveTo(342, 54);
        ctx.bezierCurveTo(390, 40, 462, 52, 494, 80);
        ctx.bezierCurveTo(450, 92, 378, 84, 342, 54);
      },
      'rgba(226, 245, 250, 0.78)',
      'rgba(255, 255, 255, 0.35)'
    );
    drawLand(
      () => {
        ctx.moveTo(376, 470);
        ctx.bezierCurveTo(452, 486, 548, 480, 610, 462);
        ctx.bezierCurveTo(560, 512, 430, 514, 376, 470);
      },
      'rgba(226, 245, 250, 0.72)',
      'rgba(255, 255, 255, 0.3)'
    );

    ctx.strokeStyle = 'rgba(22, 90, 58, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(320 + i * 18, 140 + i * 12);
      ctx.bezierCurveTo(380 + i * 8, 130 + i * 16, 420 - i * 8, 190 + i * 12, 430 + i * 6, 250 + i * 10);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(132, 210, 232, 0.32)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(700 + i * 20, 100);
      ctx.bezierCurveTo(760 + i * 12, 170, 720 + i * 20, 240, 800 + i * 15, 320);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(116, 205, 161, 0.7)';
    for (const [x, y, r] of [[520, 300, 5], [544, 330, 4], [584, 350, 6], [342, 342, 4], [612, 380, 5], [650, 250, 4]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ocean.material.map = mapTexture;
  ocean.material.color.set('#ffffff');
  ocean.material.emissive.set('#0a2c4b');
  ocean.material.emissiveIntensity = 0.16;
  ocean.material.roughness = 0.82;
  ocean.material.metalness = 0.08;
  ocean.material.needsUpdate = true;

  const grid = new THREE.Mesh(
    new THREE.SphereGeometry(2.79, 36, 22),
    new THREE.MeshBasicMaterial({
      color: cyan,
      wireframe: true,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      toneMapped: false,
    })
  );
  globe.add(grid);
  globe.rotation.y = 0.2;

  addLabel(group, '陆地', [1.2, 1.95, 1.55], {
    color: '#c9ffdd',
    fontSize: 24,
    scale: 0.0058,
    bg: 'rgba(4, 10, 8, 0.66)',
    padding: 7,
  });
  addLabel(group, '海洋', [3.5, 0.15, 0.3], {
    color: '#9fdcff',
    fontSize: 26,
    scale: 0.0062,
    bg: 'rgba(4, 10, 18, 0.6)',
    padding: 7,
  });

  const sun = addGlow(group, '#ffd36b', 3.8, [8.2, 5.0, -3.6], 0.16);
  addLabel(group, '夏季 · 陆地升温快', [5.4, 4.3, 0.9], {
    color: '#ffe6a6',
    fontSize: 24,
    scale: 0.0058,
  });

  const windCurves = [
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3.6, 0.4, 2.4),
      new THREE.Vector3(2.1, 1.9, 2.5),
      new THREE.Vector3(0.5, 2.2, 1.6)
    ),
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3.9, -0.4, 1.2),
      new THREE.Vector3(2.5, 1.2, 1.9),
      new THREE.Vector3(0.7, 1.8, 1.2)
    ),
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(3.4, 0.9, 2.7),
      new THREE.Vector3(1.8, 2.4, 2.5),
      new THREE.Vector3(-0.1, 2.6, 1.5)
    ),
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(4.2, -1.0, 1.9),
      new THREE.Vector3(2.8, -0.1, 2.2),
      new THREE.Vector3(1.24, 0.55, 1.6)
    ),
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(4.0, 1.7, 2.1),
      new THREE.Vector3(2.6, 2.7, 2.3),
      new THREE.Vector3(0.8, 2.9, 1.4)
    ),
  ];
  windCurves.forEach((curve, i) => {
    addTube(group, curve.getPoints(30), cyan, 0.017, 0.4);
    addArrow(
      group,
      curve.getPoint(0.62).toArray(),
      curve.getPoint(0.84).toArray(),
      i % 2 === 1 ? '#9fffe1' : cyan,
      { headLength: 0.4, headRadius: 0.12, radius: 0.026, opacity: 0.95 }
    );
  });

  addLabel(group, '东南季风：海洋 → 陆地', [1.7, 3.5, 1.2], {
    color: cyan,
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(4, 10, 18, 0.7)',
    border: 'rgba(53, 200, 245, 0.3)',
    padding: 9,
  });
  addLabel(group, '水汽遇山地抬升 → 降水', [0.6, -2.9, 1.8], {
    color: 'rgba(170, 220, 245, 0.75)',
    fontSize: 22,
    scale: 0.0055,
  });

  const clouds = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 20, 14),
      new THREE.MeshBasicMaterial({
        color: 0xe8f8ff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        toneMapped: false,
      })
    );
    cloud.scale.set(1.9, 0.65, 1.1);
    cloud.position.set(0.0 + i * 0.6, 3.0 + (i % 2) * 0.28, 0.5 + i * 0.18);
    clouds.add(cloud);
  }
  group.add(clouds);

  const rain = [];
  for (let i = 0; i < 50; i += 1) {
    const drop = cylinder(0.009, 0.009, 0.2, '#9fe8ff', {
      transparent: true,
      opacity: 0.7,
      emissive: '#5be7ff',
      emissiveIntensity: 0.7,
    });
    const x = -0.2 + Math.random() * 2.0;
    const z = 0.4 + Math.random() * 1.2;
    drop.position.set(x, 0.8 + Math.random() * 2.0, z);
    group.add(drop);
    rain.push({ mesh: drop, speed: 1.1 + Math.random() * 1.4, reset: 0.8 + Math.random() * 2.0 });
  }

  const windDots = [];
  for (let i = 0; i < 20; i += 1) {
    const dot = addGlow(group, '#bff4ff', 0.22, [0, 0, 0], 0.55);
    windDots.push({ dot, offset: Math.random(), curve: windCurves[i % windCurves.length] });
  }

  return {
    group,
    view: { position: [8.4, 4.8, 13.2], target: [0.2, 0.5, 0] },
    autoRotateSpeed: 0.2,
    update(time, dt) {
      globe.rotation.y = 0.2 + Math.sin(time * 0.12) * 0.1;
      clouds.children.forEach((cloud, i) => {
        cloud.position.y = 2.9 + (i % 2) * 0.3 + Math.sin(time * 0.7 + i) * 0.09;
      });
      rain.forEach((r) => {
        r.mesh.position.y -= dt * r.speed;
        if (r.mesh.position.y < 1.8) r.mesh.position.y = r.reset + 2.0;
      });
      windDots.forEach((p) => {
        const u = (time * 0.19 + p.offset) % 1;
        p.dot.position.copy(p.curve.getPointAt(u));
        p.dot.material.opacity = Math.sin(Math.PI * u) * 0.8;
      });
      sun.material.opacity = 0.2 + Math.sin(time * 1.1) * 0.06;
    },
  };
}

export function plates() {
  const group = new THREE.Group();
  const cyan = '#35C8F5';
  const orange = '#FF9F45';

  const mantle = box(14, 3.4, 7, '#2a1a19', {
    roughness: 0.95,
    emissive: '#3a1b11',
    emissiveIntensity: 0.3,
  });
  mantle.position.set(0, -1.8, 0);
  group.add(mantle);

  const magma = box(1.2, 1.1, 4.2, '#FF7A45', {
    transparent: true,
    opacity: 0.4,
    emissive: '#FF5A1F',
    emissiveIntensity: 1.3,
    roughness: 0.4,
  });
  magma.position.set(0.2, -1.6, 0);
  group.add(magma);
  addGlow(group, '#FF5A1F', 5, [0.2, -1.1, 0], 0.34);

  const plateMat = '#5c6f7d';
  const indian = box(6.4, 0.7, 5.2, plateMat, {
    roughness: 0.75,
    metalness: 0.15,
    emissive: '#26333d',
    emissiveIntensity: 0.25,
  });
  indian.position.set(-3.2, -0.3, 0);
  indian.rotation.z = -0.045;
  group.add(indian);

  const eurasian = box(6.4, 0.85, 5.4, '#6f8494', {
    roughness: 0.7,
    metalness: 0.18,
    emissive: '#2a3945',
    emissiveIntensity: 0.28,
  });
  eurasian.position.set(3.0, 0.0, 0);
  eurasian.rotation.z = 0.03;
  group.add(eurasian);

  for (let i = 0; i < 4; i += 1) {
    addLine(
      group,
      [
        [-6.2 + i * 0.2, -0.75 + i * 0.12, 2.62],
        [-1.2 + i * 0.2, -0.4 + i * 0.12, 2.62],
      ],
      '#9fb4c4',
      0.24
    );
    addLine(
      group,
      [
        [0.4 - i * 0.1, -0.4 + i * 0.14, 2.72],
        [6.0 - i * 0.1, -0.2 + i * 0.14, 2.72],
      ],
      '#9fb4c4',
      0.24
    );
  }

  const mountains = new THREE.Group();
  const peaks = [
    { x: -0.6, z: 0.8, h: 2.6, r: 1.25 },
    { x: 0.7, z: 0.2, h: 2.2, r: 1.05 },
    { x: -0.1, z: -0.8, h: 1.7, r: 0.85 },
    { x: 1.6, z: 1.4, h: 1.45, r: 0.8 },
    { x: -1.4, z: 1.6, h: 1.4, r: 0.75 },
    { x: 1.3, z: -1.3, h: 1.2, r: 0.7 },
  ];
  peaks.forEach((peak) => {
    const mountain = cone(peak.r, peak.h, '#8b8175', {
      roughness: 0.9,
      flatShading: true,
      emissive: '#3b342c',
      emissiveIntensity: 0.3,
    });
    mountain.position.set(peak.x, peak.h / 2 + 0.32, peak.z);
    mountains.add(mountain);
    const snow = cone(peak.r * 0.42, peak.h * 0.3, '#eef7ff', {
      roughness: 0.8,
      emissive: '#a8d3e8',
      emissiveIntensity: 0.25,
    });
    snow.position.set(peak.x, peak.h + 0.32 - peak.h * 0.15, peak.z);
    mountains.add(snow);
  });
  group.add(mountains);

  addArrow(group, [-4.8, 1.45, 2.1], [-1.85, 1.45, 2.1], cyan, { headLength: 0.28 });
  addArrow(group, [4.8, 1.45, 2.1], [1.85, 1.45, 2.1], orange, { headLength: 0.28 });
  addLabel(group, '印度板块 · 5 cm/年', [-4.6, 2.05, 2.1], {
    color: '#9fdcff',
    fontSize: 24,
    scale: 0.0058,
  });
  addLabel(group, '欧亚板块', [4.2, 2.05, 2.1], {
    color: '#ffcc96',
    fontSize: 24,
    scale: 0.0058,
  });
  addLabel(group, '喜马拉雅山脉', [0.2, 3.65, 0], {
    color: '#e8f4ff',
    fontSize: 28,
    scale: 0.0064,
    bg: 'rgba(5, 9, 15, 0.7)',
    border: 'rgba(53, 200, 245, 0.28)',
    padding: 9,
  });
  addLabel(group, '消亡边界 · 碰撞挤压', [0.1, -0.95, 3.7], {
    color: cyan,
    fontSize: 23,
    scale: 0.0056,
    bg: 'rgba(5, 9, 15, 0.66)',
    padding: 8,
  });
  addLabel(group, '地幔', [-5.2, -2.7, 3.5], {
    color: 'rgba(200, 160, 140, 0.65)',
    fontSize: 20,
    scale: 0.0051,
  });

  const quakes = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = ringLine(1.0, i === 0 ? '#ffd37a' : '#ff9f45', 0.3, 64, 0);
    ring.position.set(0.1, 0.36, 2.2);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    quakes.push({ ring, offset: i / 3 });
  }

  return {
    group,
    view: { position: [9.8, 5.2, 13.2], target: [0, 0.4, 0] },
    autoRotate: false,
    update(time) {
      mountains.position.y = Math.sin(time * 0.7) * 0.03;
      magma.material.opacity = 0.32 + Math.sin(time * 1.8) * 0.1;
      quakes.forEach((q) => {
        const u = (time * 0.28 + q.offset) % 1;
        q.ring.scale.setScalar(0.3 + u * 2.4);
        const line = q.ring.children[0];
        if (line?.material) line.material.opacity = (1 - u) * 0.35;
      });
    },
  };
}

export function terrace() {
  const group = new THREE.Group();
  const green = '#79E86B';
  const cyan = '#35C8F5';

  const tiers = 7;
  const terraceGroup = new THREE.Group();
  group.add(terraceGroup);

  for (let i = 0; i < tiers; i += 1) {
    const radius = 4.6 - i * 0.55;
    const y = i * 0.55;
    const land = cylinder(radius, radius + 0.04, 0.34, i % 2 === 0 ? '#4f8a4b' : '#477a45', {
      roughness: 0.9,
      emissive: '#1f4422',
      emissiveIntensity: 0.26,
    });
    land.position.set(Math.sin(i * 1.7) * 0.12, y, Math.cos(i * 1.3) * 0.1);
    terraceGroup.add(land);

    const water = cylinder(radius * 0.94, radius * 0.94, 0.035, '#2c7d6e', {
      transparent: true,
      opacity: 0.42,
      roughness: 0.5,
      metalness: 0.05,
      emissive: '#155247',
      emissiveIntensity: 0.1,
    });
    water.position.set(land.position.x, y + 0.19, land.position.z);
    terraceGroup.add(water);

    const contour = ringLine(radius * 0.99, cyan, 0.22, 100, 0);
    contour.position.y = y + 0.21;
    terraceGroup.add(contour);

    const plantCount = Math.max(7, Math.round(radius * 3.4));
    for (let j = 0; j < plantCount; j += 1) {
      const angle = (j / plantCount) * Math.PI * 2 + i * 0.4;
      const r = radius * (0.46 + (j % 3) * 0.15);
      const rice = cone(0.06, 0.38 + (j % 3) * 0.09, '#b7f07a', {
        roughness: 0.8,
        emissive: '#5a9c38',
        emissiveIntensity: 0.35,
      });
      rice.position.set(
        Math.cos(angle) * r + land.position.x,
        y + 0.38,
        Math.sin(angle) * r + land.position.z
      );
      rice.rotation.z = Math.sin(angle) * 0.12;
      terraceGroup.add(rice);
    }
  }

  const village = new THREE.Group();
  const houseSpots = [
    { x: 2.25, z: 1.1, angle: -0.35 },
    { x: 1.55, z: 2.15, angle: 0.4 },
    { x: 2.85, z: -0.35, angle: -1.1 },
  ];
  houseSpots.forEach((spot) => {
    const house = new THREE.Group();
    const walls = box(0.48, 0.32, 0.38, '#e6d7b8', { roughness: 0.8 });
    walls.position.y = 0.16;
    const roof = cone(0.4, 0.32, '#a95b43', { roughness: 0.8, flatShading: true });
    roof.position.y = 0.46;
    roof.rotation.y = Math.PI / 4;
    house.add(walls, roof);
    house.position.set(spot.x, 2.0, spot.z);
    house.rotation.y = spot.angle;
    village.add(house);
  });
  terraceGroup.add(village);

  const top = cone(1.3, 1.2, '#3d6b3e', { roughness: 0.9, flatShading: true });
  top.position.y = tiers * 0.55 + 0.35;
  terraceGroup.add(top);
  for (let i = 0; i < 5; i += 1) {
    const tree = cone(0.24, 0.95, '#2f7d4b', { roughness: 0.85, flatShading: true });
    const a = (i / 5) * Math.PI * 2;
    tree.position.set(Math.cos(a) * 0.7, tiers * 0.55 + 1.0, Math.sin(a) * 0.7);
    terraceGroup.add(tree);
  }

  addLabel(group, '等高线', [4.75, 2.9, 0.5], {
    color: cyan,
    fontSize: 24,
    scale: 0.0058,
    bg: 'rgba(4, 10, 16, 0.66)',
    border: 'rgba(53, 200, 245, 0.28)',
    padding: 8,
  });
  addLine(group, [[4.5, 2.85, 0.5], [3.2, 2.2, 0.9]], cyan, 0.3);

  addLabel(group, '哈尼梯田', [-4.5, 4.25, 0.4], {
    color: '#e6ffc9',
    fontSize: 28,
    scale: 0.0064,
    bg: 'rgba(4, 10, 8, 0.78)',
    border: 'rgba(121, 232, 107, 0.35)',
    padding: 9,
  });
  addLabel(group, '森林—村寨—梯田—水系', [0, -1.45, 4.4], {
    color: 'rgba(215, 245, 225, 0.85)',
    fontSize: 23,
    scale: 0.0056,
  });
  addLabel(group, '顺坡就势 · 保水保土', [0, -2.05, 4.4], {
    color: 'rgba(180, 215, 235, 0.78)',
    fontSize: 22,
    scale: 0.0053,
  });

  const rain = [];
  const rand = seeded(717);
  for (let i = 0; i < 80; i += 1) {
    const drop = sphere(0.018, '#bfefff', { emissive: '#8fe8ff', emissiveIntensity: 1.2 });
    drop.position.set((rand() - 0.5) * 13, rand() * 7, (rand() - 0.5) * 10);
    group.add(drop);
    rain.push({ mesh: drop, speed: 2.4 + rand() * 2.2 });
  }

  const mist = [];
  for (let i = 0; i < 6; i += 1) {
    const puff = sphere(0.8 + rand() * 0.4, '#dff4ff', {
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      roughness: 1,
    });
    puff.scale.y = 0.35;
    puff.position.set(-3 + rand() * 6, 1.2 + rand() * 2.4, -2.5 + rand() * 5);
    group.add(puff);
    mist.push({ puff, phase: rand() * 6 });
  }

  addGlow(group, '#2a6b45', 15, [0, 1.5, -4], 0.24);

  return {
    group,
    view: { position: [9.2, 6.4, 12.4], target: [0, 1.8, 0] },
    autoRotateSpeed: 0.2,
    update(time, dt) {
      terraceGroup.rotation.y = time * 0.05;
      rain.forEach((r) => {
        r.mesh.position.y -= dt * r.speed;
        if (r.mesh.position.y < 0.2) r.mesh.position.y = 6.5;
      });
      mist.forEach((m) => {
        m.puff.position.x += Math.sin(time * 0.2 + m.phase) * dt * 0.1;
        m.puff.material.opacity = 0.035 + Math.sin(time * 0.4 + m.phase) * 0.014;
      });
    },
  };
}
