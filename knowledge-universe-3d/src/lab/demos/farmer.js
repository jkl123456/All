import {
  THREE,
  addArrow,
  addGlow,
  addLabel,
  addLine,
  addRibbon,
  addTube,
  box,
  cone,
  cylinder,
  seeded,
  sphere,
  torus,
} from './helpers.js';

export function solarTerms() {
  const group = new THREE.Group();
  const gold = '#FFD37A';
  const cyan = '#5BE7FF';

  const sun = sphere(1.0, '#FFD37A', {
    emissive: '#FF9F45',
    emissiveIntensity: 1.1,
    roughness: 0.35,
    metalness: 0.05,
  });
  sun.position.y = 0.15;
  group.add(sun);
  addGlow(group, '#ffb45e', 7, [0, 0.15, 0], 0.34);

  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    addLine(
      group,
      [
        [Math.cos(a) * 1.55, 0.15 + Math.sin(a) * 1.55, 0],
        [Math.cos(a) * 2.15, 0.15 + Math.sin(a) * 2.15, 0],
      ],
      '#ffd9a0',
      0.22
    );
  }

  const radius = 7.4;
  const orbit = [];
  for (let i = 0; i <= 160; i += 1) {
    const a = (i / 160) * Math.PI * 2;
    orbit.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
  }
  addLine(group, orbit, '#8cc8ff', 0.32);

  const seasons = [
    { start: 0, length: Math.PI / 2, color: '#79E86B', name: '春' },
    { start: Math.PI / 2, length: Math.PI / 2, color: '#FFD37A', name: '夏' },
    { start: Math.PI, length: Math.PI / 2, color: '#FF9F45', name: '秋' },
    { start: Math.PI * 1.5, length: Math.PI / 2, color: '#5BE7FF', name: '冬' },
  ];
  seasons.forEach((season) => {
    const geo = new THREE.RingGeometry(radius - 0.09, radius + 0.09, 48, 1, season.start, season.length);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(season.color),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    group.add(mesh);
    const a = season.start + season.length / 2;
    addLabel(group, season.name, [Math.cos(a) * 8.65, 0.35, -Math.sin(a) * 8.65], {
      color: season.color,
      fontSize: 22,
      scale: 0.0053,
      bg: 'rgba(4, 8, 14, 0.55)',
      padding: 6,
    });
  });

  const termNames = [
    '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
    '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
    '立冬', '小雪', '大雪', '冬至', '小寒', '大寒',
  ];
  const major = new Set([0, 3, 6, 9, 12, 15, 18, 21]);
  termNames.forEach((name, i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * radius;
    const z = -Math.sin(a) * radius;
    const dot = sphere(major.has(i) ? 0.1 : 0.05, major.has(i) ? gold : '#96c8f0', {
      emissive: major.has(i) ? gold : cyan,
      emissiveIntensity: major.has(i) ? 1.4 : 0.6,
    });
    dot.position.set(x, 0.05, z);
    group.add(dot);
    if (major.has(i)) {
      addLabel(group, name, [Math.cos(a) * (radius + 1.0), 0.55, -Math.sin(a) * (radius + 1.0)], {
        color: '#ffe6b0',
        fontSize: 24,
        scale: 0.0056,
        bg: 'rgba(6, 8, 12, 0.68)',
        border: 'rgba(255, 211, 122, 0.22)',
        padding: 7,
      });
    }
  });

  const earthOrbit = new THREE.Group();
  group.add(earthOrbit);
  const earth = new THREE.Group();
  earth.position.set(radius, 0.1, 0);
  earthOrbit.add(earth);
  const earthSphere = sphere(0.5, '#2e86c8', {
    emissive: '#1c5a8e',
    emissiveIntensity: 0.7,
    roughness: 0.55,
    metalness: 0.15,
  });
  earth.add(earthSphere);
  const landMat = new THREE.MeshStandardMaterial({ color: '#4fae7c', roughness: 0.9 });
  const land = new THREE.Mesh(new THREE.SphereGeometry(0.505, 24, 16, 0.4, 1.1, 0.7, 0.6), landMat);
  earth.add(land);
  const axis = addLine(earth, [[0, -0.85, 0], [0, 0.85, 0]], '#9be8ff', 0.5);
  axis.rotation.z = 0.36;
  earth.rotation.y = 0.8;
  addGlow(earth, '#5be7ff', 2.6, [0, 0, 0], 0.32);
  addLabel(earth, '地球', [0, 1.05, 0], {
    color: '#dff8ff',
    fontSize: 20,
    scale: 0.0048,
  });

  const trail = [];
  for (let i = 0; i < 16; i += 1) {
    const dot = sphere(0.035, '#9fe8ff', { emissive: '#5be7ff', emissiveIntensity: 1.2, transparent: true });
    group.add(dot);
    trail.push(dot);
  }

  addLabel(group, '二十四节气 · 太阳的 24 个刻度', [0, 3.2, 0], {
    color: gold,
    fontSize: 30,
    scale: 0.0066,
    bg: 'rgba(12, 8, 4, 0.72)',
    border: 'rgba(255, 211, 122, 0.3)',
    padding: 10,
    glow: 15,
    glowColor: gold,
  });
  addLabel(group, '每 15° 一个节气 · 360° ÷ 24', [0, -8.6, 0], {
    color: 'rgba(180, 215, 245, 0.72)',
    fontSize: 23,
    scale: 0.0055,
  });
  addLabel(group, '太阳', [0, 2.3, 0], {
    color: '#ffe6a6',
    fontSize: 22,
    scale: 0.0051,
  });

  addGlow(group, '#243b5e', 24, [0, 0, -14], 0.18);

  return {
    group,
    view: { position: [0, 19.5, 15.8], target: [0, 0, 0] },
    autoRotate: true,
    autoRotateSpeed: 0.08,
    update(time) {
      const angle = time * 0.1;
      earthOrbit.rotation.y = angle;
      earth.rotation.y += 0.004;
      trail.forEach((dot, i) => {
        const a = angle - (i + 1) * 0.035;
        dot.position.set(Math.cos(a) * radius, 0.06, -Math.sin(a) * radius);
        dot.material.opacity = 0.55 * (1 - i / trail.length);
      });
      sun.scale.setScalar(1 + Math.sin(time * 1.2) * 0.02);
    },
  };
}

export function irrigation() {
  const group = new THREE.Group();
  const waterColor = '#3FB6E4';
  const accent = '#5BE7FF';

  const addTank = (x, height = 3.4) => {
    const tank = new THREE.Group();
    tank.position.set(x, 0, 0);
    const glass = box(2.6, height, 2.6, '#9dd8ff', {
      transparent: true,
      opacity: 0.1,
      roughness: 0.1,
      metalness: 0.35,
      depthWrite: false,
    });
    tank.add(glass);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, height, 2.6)),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(accent),
        transparent: true,
        opacity: 0.3,
        toneMapped: false,
      })
    );
    tank.add(edges);
    const water = box(2.35, 1.6, 2.35, waterColor, {
      transparent: true,
      opacity: 0.5,
      roughness: 0.15,
      metalness: 0.2,
      emissive: '#1b6f8e',
      emissiveIntensity: 0.35,
      depthWrite: false,
    });
    water.position.y = -height / 2 + 0.8;
    tank.add(water);
    group.add(tank);
    return { tank, water, height };
  };

  const left = addTank(-3.2, 3.6);
  const right = addTank(3.2, 3.6);

  const pipe = cylinder(0.28, 0.28, 5.6, '#9dd8ff', {
    transparent: true,
    opacity: 0.18,
    roughness: 0.1,
    metalness: 0.3,
    depthWrite: false,
  });
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = -1.25;
  group.add(pipe);
  const pipeWater = cylinder(0.2, 0.2, 5.5, waterColor, {
    transparent: true,
    opacity: 0.45,
    roughness: 0.15,
    emissive: '#1b6f8e',
    emissiveIntensity: 0.35,
    depthWrite: false,
  });
  pipeWater.rotation.z = Math.PI / 2;
  pipeWater.position.y = -1.25;
  group.add(pipeWater);

  const base = box(8.2, 0.25, 3.8, '#22364b', {
    roughness: 0.6,
    metalness: 0.25,
    emissive: '#0e1d2c',
    emissiveIntensity: 0.3,
  });
  base.position.y = -1.92;
  group.add(base);

  const field = new THREE.Group();
  field.position.set(3.3, -1.72, 2.7);
  const soil = box(3.6, 0.2, 2.4, '#5e4a2f', { roughness: 0.95 });
  field.add(soil);
  const channel = box(0.55, 0.06, 2.4, waterColor, {
    transparent: true,
    opacity: 0.5,
    emissive: '#1b6f8e',
    emissiveIntensity: 0.3,
  });
  channel.position.x = -1.45;
  field.add(channel);
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      const crop = cone(0.09, 0.4, '#8fce5c', {
        roughness: 0.8,
        emissive: '#3f7d2a',
        emissiveIntensity: 0.3,
      });
      crop.position.set(-0.9 + i * 0.65, 0.29, -0.85 + j * 0.43);
      field.add(crop);
    }
  }
  group.add(field);

  const drops = [];
  const rand = seeded(63);
  for (let i = 0; i < 12; i += 1) {
    const drop = sphere(0.045, '#bff4ff', {
      emissive: '#5be7ff',
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.7,
    });
    drop.position.set(-5.5 + rand() * 11, -1.25, (rand() - 0.5) * 0.3);
    group.add(drop);
    drops.push({ drop, offset: rand(), dir: i % 2 === 0 ? 1 : -1 });
  }

  addLabel(group, '连通器 · 液面相平', [0, 4.75, 0], {
    color: accent,
    fontSize: 31,
    scale: 0.0068,
    bg: 'rgba(4, 10, 16, 0.72)',
    border: 'rgba(91, 231, 255, 0.3)',
    padding: 10,
    glow: 15,
    glowColor: accent,
  });
  addLabel(group, 'p = ρgh', [0, 1.9, 0.4], {
    color: '#dff8ff',
    fontSize: 26,
    scale: 0.006,
  });
  addLabel(group, '同种液体静止时，两侧液面高度相同', [0, -2.75, 1.8], {
    color: 'rgba(175, 215, 245, 0.72)',
    fontSize: 22,
    scale: 0.0053,
  });
  addLabel(group, '灌溉渠道', [5.6, -0.6, 2.7], {
    color: '#a8f5b0',
    fontSize: 21,
    scale: 0.0051,
    bg: 'rgba(4, 10, 8, 0.55)',
    padding: 6,
  });
  addLine(group, [[5.2, -0.75, 2.6], [4.2, -1.5, 3.0]], '#a8f5b0', 0.3);

  addGlow(group, '#1e4f68', 14, [0, 0, -4], 0.22);

  return {
    group,
    view: { position: [7.4, 4.4, 11.4], target: [0, 0.5, 0] },
    autoRotateSpeed: 0.12,
    update(time, dt) {
      const level = 1.7 + Math.sin(time * 0.65) * 0.22;
      [left, right].forEach((tank) => {
        tank.water.scale.y = level / 1.6;
        tank.water.position.y = -tank.height / 2 + level / 2;
      });
      pipeWater.material.opacity = 0.35 + Math.sin(time * 0.8) * 0.08;
      drops.forEach((d) => {
        const u = (time * 0.18 + d.offset) % 1;
        const x = d.dir > 0 ? -3.2 + u * 6.4 : 3.2 - u * 6.4;
        d.drop.position.set(x, -1.25 + Math.sin(u * Math.PI * 4) * 0.05, 0);
        d.drop.material.opacity = Math.sin(Math.PI * u) * 0.7;
      });
    },
  };
}
