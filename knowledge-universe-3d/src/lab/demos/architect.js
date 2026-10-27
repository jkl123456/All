import {
  THREE,
  addArrow,
  addBeam,
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
  torus,
} from './helpers.js';

export function arch() {
  const group = new THREE.Group();
  const stone = '#b7ad9c';
  const accent = '#5BE7FF';

  const waterGeo = new THREE.PlaneGeometry(30, 18, 40, 24);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: '#0b3a52',
      emissive: '#061e2b',
      emissiveIntensity: 0.22,
      roughness: 0.42,
      metalness: 0.22,
      transparent: true,
      opacity: 0.9,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.45;
  group.add(water);
  const waterBase = waterGeo.attributes.position.array.slice();

  const bankL = box(7, 1.1, 7, '#2f3c33', { roughness: 0.95, emissive: '#111b14', emissiveIntensity: 0.2 });
  bankL.position.set(-7.3, -0.55, 0);
  const bankR = bankL.clone();
  bankR.position.x = 7.3;
  group.add(bankL, bankR);

  const R = 5.42;
  const centerY = -3.02;
  const start = 0.588;
  const end = Math.PI - start;
  const count = 19;
  const archGroup = new THREE.Group();
  group.add(archGroup);

  for (let i = 0; i < count; i += 1) {
    const a1 = start + ((end - start) * i) / count;
    const a2 = start + ((end - start) * (i + 1)) / count;
    const mid = (a1 + a2) / 2;
    const x = Math.cos(mid) * R;
    const y = centerY + Math.sin(mid) * R;
    const arcLength = ((end - start) * R) / count;
    const stoneMesh = box(arcLength * 0.93, 0.52, 2.9, stone, {
      roughness: 0.88,
      metalness: 0.05,
      emissive: '#554c3c',
      emissiveIntensity: 0.12,
      flatShading: true,
    });
    stoneMesh.position.set(x, y, 0);
    stoneMesh.rotation.z = mid + Math.PI / 2;
    archGroup.add(stoneMesh);
  }

  const deck = box(11.6, 0.22, 3.3, '#8d8270', {
    roughness: 0.85,
    emissive: '#423a2c',
    emissiveIntensity: 0.16,
  });
  deck.position.set(0, 2.73, 0);
  group.add(deck);

  for (const z of [-1.55, 1.55]) {
    for (let i = 0; i < 16; i += 1) {
      const x = -5.4 + i * 0.72;
      const post = box(0.07, 0.42, 0.07, '#9b917f', { roughness: 0.8 });
      post.position.set(x, 2.98, z);
      group.add(post);
    }
    addLine(group, [[-5.6, 3.16, z], [5.6, 3.16, z]], '#b7ad9c', 0.5);
  }

  for (const x of [-2.4, 2.4]) {
    const smallArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.2, 8, 24, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#6e6a5f', roughness: 0.9, emissive: '#28241c', emissiveIntensity: 0.2 })
    );
    smallArch.position.set(x, 1.92, 1.62);
    group.add(smallArch);
  }

  const forceCurve = [];
  const arrowCurve = [];
  for (let i = 0; i <= 30; i += 1) {
    const a = start + ((end - start) * i) / 30;
    forceCurve.push(new THREE.Vector3(Math.cos(a) * R, centerY + Math.sin(a) * R, 1.52));
  }
  addTube(group, forceCurve, accent, 0.016, 0.32);
  for (let i = 1; i < 8; i += 1) {
    const idx = Math.floor((i / 8) * forceCurve.length);
    const p = forceCurve[idx];
    const next = forceCurve[Math.min(forceCurve.length - 1, idx + 2)];
    const dir = next.clone().sub(p).normalize();
    addArrow(group, p.clone().sub(dir.clone().multiplyScalar(0.5)).toArray(), p.clone().add(dir.clone().multiplyScalar(0.5)).toArray(), accent, {
      headLength: 0.18,
      radius: 0.012,
      opacity: 0.8,
    });
  }

  for (let i = -2; i <= 2; i += 1) {
    addArrow(group, [i * 1.8, 4.1, -1.55], [i * 1.8, 2.95, -1.55], '#FF9F45', {
      headLength: 0.22,
      radius: 0.016,
      opacity: 0.7,
    });
  }

  addLabel(group, '赵州桥 · 敞肩圆弧拱', [0, 5.65, 0], {
    color: '#ffe6b3',
    fontSize: 32,
    scale: 0.007,
    bg: 'rgba(9, 8, 5, 0.72)',
    border: 'rgba(232, 200, 145, 0.3)',
    padding: 10,
    glow: 14,
    glowColor: '#FFD37A',
  });
  addLabel(group, '压力沿拱轴传递', [0, -2.15, 2.6], {
    color: accent,
    fontSize: 26,
    scale: 0.006,
    bg: 'rgba(4, 10, 14, 0.66)',
    padding: 8,
  });
  addLabel(group, '主拱跨度 37.02 m', [-5.4, 2.1, 1.9], {
    color: 'rgba(230, 210, 170, 0.72)',
    fontSize: 21,
    scale: 0.0052,
  });
  addLabel(group, '敞肩小拱 · 减重泄洪', [4.4, 2.15, 1.9], {
    color: 'rgba(220, 200, 165, 0.7)',
    fontSize: 21,
    scale: 0.0052,
  });
  addLabel(group, '拱脚推力', [-4.9, 0.55, 1.7], {
    color: '#ffb570',
    fontSize: 20,
    scale: 0.005,
  });

  addGlow(group, '#2a4c5a', 18, [0, 0, -7], 0.2);

  return {
    group,
    view: { position: [9.6, 4.4, 12.2], target: [0, 1.6, 0] },
    autoRotateSpeed: 0.14,
    update(time) {
      const positions = waterGeo.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = waterBase[i];
        const y = waterBase[i + 1];
        positions[i + 2] = Math.sin(x * 0.6 + time * 0.9) * 0.025 + Math.cos(y * 0.8 + time * 0.6) * 0.02;
      }
      waterGeo.attributes.position.needsUpdate = true;
      archGroup.children.forEach((stoneMesh, i) => {
        stoneMesh.material.emissiveIntensity = 0.1 + Math.max(0, Math.sin(time * 1.4 - i * 0.4)) * 0.1;
      });
    },
  };
}

export function truss() {
  const group = new THREE.Group();
  const steel = '#9fb6c9';
  const accent = '#5BE7FF';
  const warm = '#FF9F45';

  const bottom = [-5, -2.5, 0, 2.5, 5].map((x) => [x, 0, 0]);
  const top = [-3.75, -1.25, 1.25, 3.75].map((x) => [x, 2.2, 0]);
  const members = [];
  const memberColors = [];

  const addMember = (a, b, color, radius = 0.055) => {
    const beam = addBeam(group, a, b, radius, color, 0.9);
    members.push(beam);
    memberColors.push(color);
    return beam;
  };

  for (const z of [-1.35, 1.35]) {
    const shift = (p) => [p[0], p[1], z];
    for (let i = 0; i < bottom.length - 1; i += 1) addMember(shift(bottom[i]), shift(bottom[i + 1]), accent);
    for (let i = 0; i < top.length - 1; i += 1) addMember(shift(top[i]), shift(top[i + 1]), warm);
    addMember(shift(bottom[0]), shift(top[0]), warm);
    addMember(shift(bottom[1]), shift(top[0]), accent);
    addMember(shift(bottom[1]), shift(top[1]), warm);
    addMember(shift(bottom[2]), shift(top[1]), accent);
    addMember(shift(bottom[2]), shift(top[2]), warm);
    addMember(shift(bottom[3]), shift(top[2]), accent);
    addMember(shift(bottom[3]), shift(top[3]), warm);
    addMember(shift(bottom[4]), shift(top[3]), accent);
    addMember(shift(bottom[4]), shift(top[3]), warm);
  }

  for (let i = 0; i < top.length; i += 1) {
    addMember([top[i][0], top[i][1], -1.35], [top[i][0], top[i][1], 1.35], warm, 0.04);
  }
  for (let i = 0; i < bottom.length; i += 1) {
    addMember([bottom[i][0], bottom[i][1], -1.35], [bottom[i][0], bottom[i][1], 1.35], accent, 0.04);
  }

  const deck = box(10.2, 0.16, 3.2, '#34495c', {
    metalness: 0.45,
    roughness: 0.5,
    emissive: '#162e40',
    emissiveIntensity: 0.3,
  });
  deck.position.y = 0.1;
  group.add(deck);

  for (const z of [-1.35, 1.35]) {
    const rail = box(10.2, 0.05, 0.05, '#a9c9de', { metalness: 0.5, roughness: 0.4 });
    rail.position.set(0, 0.85, z);
    group.add(rail);
    for (let i = 0; i < 9; i += 1) {
      const post = box(0.04, 0.72, 0.04, '#7d9cb2', { metalness: 0.4 });
      post.position.set(-4.7 + i * 1.18, 0.48, z);
      group.add(post);
    }
  }

  const load = box(1.6, 0.55, 1.2, '#526b7f', { metalness: 0.3, roughness: 0.55 });
  load.position.set(0.2, 0.48, 0);
  group.add(load);
  addArrow(group, [0.2, 0.9, 0], [0.2, -0.8, 0], warm, { headLength: 0.24, radius: 0.02, opacity: 0.8 });
  addLabel(group, '荷载', [0.95, 0.8, 0], { color: '#ffbe83', fontSize: 21, scale: 0.0051 });

  addLabel(group, '桁架 · 三角形的稳定性', [0, 4.05, 0], {
    color: '#dff3ff',
    fontSize: 30,
    scale: 0.0067,
    bg: 'rgba(5, 10, 16, 0.72)',
    border: 'rgba(91, 231, 255, 0.28)',
    padding: 10,
  });
  addLabel(group, '拉力', [-4.0, -0.65, 2.1], { color: accent, fontSize: 24, scale: 0.0057 });
  addLabel(group, '压力', [4.0, -0.65, 2.1], { color: warm, fontSize: 24, scale: 0.0057 });
  addLabel(group, '边长确定 → 形状唯一', [0, -1.2, 2.3], {
    color: 'rgba(170, 205, 235, 0.68)',
    fontSize: 22,
    scale: 0.0053,
  });

  addGlow(group, '#2a4e63', 14, [0, 1, -6], 0.2);

  return {
    group,
    view: { position: [9.4, 4.6, 12.4], target: [0, 1.1, 0] },
    autoRotateSpeed: 0.18,
    update(time) {
      members.forEach((member, i) => {
        member.material.opacity = 0.55 + Math.max(0, Math.sin(time * 1.2 - i * 0.16)) * 0.35;
      });
      load.position.y = 0.48 + Math.sin(time * 1.1) * 0.03;
    },
  };
}

export function towerWind() {
  const group = new THREE.Group();
  const cyan = '#5BE7FF';
  const gold = '#FFD37A';

  const ground = box(14, 0.4, 14, '#101b28', {
    roughness: 0.8,
    metalness: 0.2,
    emissive: '#0a121c',
    emissiveIntensity: 0.3,
  });
  ground.position.y = -1.5;
  group.add(ground);

  const windowTexture = createCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0b1d2a';
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(223);
    for (let row = 0; row < 16; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        if (rand() > 0.42) {
          ctx.fillStyle = rand() > 0.3 ? 'rgba(255, 216, 143, 0.85)' : 'rgba(111, 224, 255, 0.7)';
          ctx.fillRect(8 + col * 20, 8 + row * 15, 12, 7);
        }
      }
    }
  });
  const facadeMaterial = new THREE.MeshStandardMaterial({
    map: windowTexture,
    emissiveMap: windowTexture,
    emissive: new THREE.Color('#8fd8ff'),
    emissiveIntensity: 0.55,
    color: '#7b95a9',
    roughness: 0.42,
    metalness: 0.55,
  });
  const capMaterial = new THREE.MeshStandardMaterial({
    color: '#1a3041',
    roughness: 0.5,
    metalness: 0.4,
    emissive: '#0f2230',
    emissiveIntensity: 0.3,
  });

  const tower = new THREE.Group();
  const floors = 21;
  for (let i = 0; i < floors; i += 1) {
    const t = i / (floors - 1);
    const width = 3.1 - t * 1.0;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.54, width * 0.92), [
      facadeMaterial,
      facadeMaterial,
      capMaterial,
      capMaterial,
      facadeMaterial,
      facadeMaterial,
    ]);
    floor.position.y = 0.3 + i * 0.55;
    floor.rotation.y = i * 0.035;
    tower.add(floor);
    if (i % 3 === 0) {
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(width, 0.04, width * 0.92)),
        new THREE.LineBasicMaterial({
          color: new THREE.Color(cyan),
          transparent: true,
          opacity: 0.22,
          toneMapped: false,
        })
      );
      edge.position.y = floor.position.y + 0.27;
      edge.rotation.y = floor.rotation.y;
      tower.add(edge);
    }
  }
  const crown = cylinder(0.1, 0.5, 1.0, '#2a4356', { metalness: 0.6, roughness: 0.35 });
  crown.position.y = 12.0;
  tower.add(crown);
  const antenna = cylinder(0.025, 0.04, 2.1, '#a6c6da', { metalness: 0.7, roughness: 0.25 });
  antenna.position.y = 13.0;
  tower.add(antenna);
  addGlow(tower, cyan, 4.5, [0, 13.5, 0], 0.3);
  group.add(tower);

  const damper = new THREE.Group();
  damper.position.set(0, 12.15, 0);
  const damperBall = sphere(0.32, gold, {
    metalness: 0.7,
    roughness: 0.25,
    emissive: '#a8792f',
    emissiveIntensity: 0.6,
  });
  damper.add(damperBall);
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.02, 5, 40),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(gold),
        transparent: true,
        opacity: 0.42,
        toneMapped: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = (i / 3) * Math.PI;
    damper.add(ring);
  }
  addLabel(damper, '阻尼器', [0, 0.9, 0], {
    color: gold,
    fontSize: 21,
    scale: 0.0051,
    bg: 'rgba(8, 7, 4, 0.62)',
    padding: 6,
  });
  group.add(damper);

  const city = [];
  const rand = seeded(512);
  for (let i = 0; i < 9; i += 1) {
    const h = 0.5 + rand() * 1.5;
    const b = box(0.5 + rand() * 0.6, h, 0.5 + rand() * 0.6, '#182c3e', {
      roughness: 0.6,
      metalness: 0.3,
      emissive: '#0f2233',
      emissiveIntensity: 0.35,
    });
    const angle = (i / 9) * Math.PI * 2;
    b.position.set(Math.cos(angle) * (4.5 + rand() * 1.6), -1.25 + h / 2, Math.sin(angle) * (4.5 + rand() * 1.6));
    group.add(b);
    city.push(b);
  }

  const windCount = 180;
  const windPositions = new Float32Array(windCount * 3);
  const windData = [];
  for (let i = 0; i < windCount; i += 1) {
    windPositions.set(
      [-10 + rand() * 9, -1 + rand() * 13, -7 + rand() * 14],
      i * 3
    );
    windData.push({ speed: 0.7 + rand() * 1.5, phase: rand() * 6 });
  }
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPositions, 3));
  const wind = new THREE.Points(
    windGeo,
    new THREE.PointsMaterial({
      color: 0x9fe8ff,
      size: 0.075,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  wind.frustumCulled = false;
  group.add(wind);

  const swirls = [];
  for (let i = 0; i < 4; i += 1) {
    const points = [];
    for (let j = 0; j <= 30; j += 1) {
      const t = j / 30;
      const angle = t * Math.PI * 2;
      points.push([
        Math.cos(angle) * (1.8 + i * 0.2) + 2.1,
        7.2 + i * 1.3 + Math.sin(angle) * 0.8,
        Math.sin(angle) * (1.8 + i * 0.2),
      ]);
    }
    const tube = addTube(group, points, cyan, 0.012, 0.2);
    swirls.push(tube);
  }

  addLabel(group, 'w = ½ · ρ · v²', [-4.0, 10.4, 1.8], {
    color: cyan,
    fontSize: 25,
    scale: 0.0058,
    bg: 'rgba(4, 10, 16, 0.66)',
    padding: 8,
  });
  addLabel(group, '涡激振动', [4.3, 8.8, 1.6], {
    color: '#ffb570',
    fontSize: 22,
    scale: 0.0053,
  });
  addLabel(group, '调谐质量阻尼器', [3.4, 12.8, 1.2], {
    color: gold,
    fontSize: 22,
    scale: 0.0053,
  });
  addLabel(group, '螺旋外形打散风涡', [-4.2, 4.8, 1.8], {
    color: 'rgba(170, 210, 235, 0.7)',
    fontSize: 21,
    scale: 0.0051,
  });

  addGlow(group, '#223f5e', 20, [0, 5, -10], 0.22);

  return {
    group,
    view: { position: [14, 9, 18], target: [0, 6.5, 0] },
    autoRotateSpeed: 0.12,
    update(time, dt) {
      const sway = Math.sin(time * 0.8) * 0.006;
      tower.rotation.z = sway;
      tower.rotation.x = Math.cos(time * 0.65) * 0.004;
      damperBall.position.x = -sway * 55;
      damperBall.position.z = Math.cos(time * 0.65) * 0.18;
      damper.rotation.z = -sway * 0.5;
      const positions = windGeo.attributes.position.array;
      for (let i = 0; i < windCount; i += 1) {
        positions[i * 3] += dt * windData[i].speed * 1.5;
        positions[i * 3 + 1] += Math.sin(time * 1.2 + windData[i].phase) * dt * 0.05;
        if (positions[i * 3] > 2.0) positions[i * 3] = -10;
      }
      windGeo.attributes.position.needsUpdate = true;
      swirls.forEach((tube, i) => {
        tube.material.opacity = 0.1 + Math.max(0, Math.sin(time * 1.3 - i)) * 0.16;
      });
      city.forEach((b, i) => {
        b.material.emissiveIntensity = 0.3 + Math.sin(time * 0.8 + i) * 0.1;
      });
    },
  };
}
