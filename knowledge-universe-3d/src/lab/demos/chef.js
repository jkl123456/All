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
  seeded,
  sphere,
  torus,
} from './helpers.js';

export function maillard() {
  const group = new THREE.Group();
  const warm = '#FF9F45';

  const counter = box(9.4, 0.25, 6.8, '#4a3523', {
    roughness: 0.9,
    emissive: '#211509',
    emissiveIntensity: 0.18,
  });
  counter.position.y = -0.95;
  group.add(counter);

  const stove = box(7.6, 0.5, 5.8, '#1a2430', {
    metalness: 0.5,
    roughness: 0.4,
    emissive: '#0c1520',
    emissiveIntensity: 0.3,
  });
  stove.position.y = -0.55;
  group.add(stove);
  const burner = torus(1.1, 0.07, '#4d5c70', { metalness: 0.7, roughness: 0.3 });
  burner.rotation.x = Math.PI / 2;
  burner.position.y = -0.25;
  group.add(burner);
  addGlow(group, '#ff8a3d', 5.5, [0, -0.1, 0], 0.42);

  const flames = [];
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    const flame = cone(0.09, 0.55, '#ff9a45', {
      transparent: true,
      opacity: 0.4,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    flame.material.blending = THREE.AdditiveBlending;
    flame.material.depthWrite = false;
    flame.position.set(Math.cos(a) * 1.55, -0.38, Math.sin(a) * 1.55);
    group.add(flame);
    flames.push({ flame, phase: i * 0.7 });
  }

  const warmLight = new THREE.PointLight(0xffa05a, 8, 10, 2);
  warmLight.position.set(0, 2.6, 1.5);
  group.add(warmLight);

  const pan = new THREE.Group();
  const panBody = cylinder(2.65, 2.25, 0.32, '#3d2b20', {
    metalness: 0.28,
    roughness: 0.66,
    emissive: '#24140b',
    emissiveIntensity: 0.28,
  });
  panBody.position.y = 0.1;
  pan.add(panBody);
  const panInner = cylinder(2.38, 2.38, 0.06, '#4a3527', { metalness: 0.24, roughness: 0.62 });
  panInner.position.y = 0.25;
  pan.add(panInner);
  const oil = cylinder(2.25, 2.25, 0.03, '#8a5a25', {
    transparent: true,
    opacity: 0.24,
    roughness: 0.15,
    metalness: 0.3,
    emissive: '#5a350f',
    emissiveIntensity: 0.35,
  });
  oil.position.y = 0.29;
  pan.add(oil);
  const handle = box(2.5, 0.16, 0.42, '#20262f', { metalness: 0.6, roughness: 0.3 });
  handle.position.set(3.4, 0.2, 0);
  pan.add(handle);
  group.add(pan);

  const steakMaterial = new THREE.MeshStandardMaterial({
    color: '#a8422f',
    roughness: 0.86,
    metalness: 0.02,
    emissive: '#4a170c',
    emissiveIntensity: 0.24,
  });
  const steak = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.03, 0.34, 40), steakMaterial);
  steak.scale.set(1.28, 1, 0.82);
  steak.position.set(-0.2, 0.47, 0);
  group.add(steak);

  const fatRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.055, 8, 48),
    new THREE.MeshStandardMaterial({
      color: '#d8c09b',
      roughness: 0.75,
      emissive: '#5a452c',
      emissiveIntensity: 0.2,
    })
  );
  fatRim.rotation.x = Math.PI / 2;
  fatRim.scale.set(1.28, 0.82, 1);
  fatRim.position.set(-0.2, 0.62, 0);
  group.add(fatRim);

  const pepper = [];
  for (let i = 0; i < 14; i += 1) {
    const speck = sphere(0.018, '#24140c', { roughness: 0.9 });
    const a = i * 2.4;
    speck.position.set(-0.2 + Math.cos(a) * (0.25 + (i % 4) * 0.18), 0.645, Math.sin(a) * (0.2 + (i % 3) * 0.15));
    group.add(speck);
    pepper.push(speck);
  }

  const rosemary = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const sprig = cylinder(0.012, 0.02, 0.75, '#4f7a3e', { roughness: 0.8 });
    sprig.rotation.z = Math.PI / 2.2 + i * 0.15;
    sprig.position.set(1.15 + i * 0.1, 0.42, 0.72 - i * 0.12);
    rosemary.add(sprig);
  }
  group.add(rosemary);
  for (let i = 0; i < 3; i += 1) {
    const garlic = sphere(0.09, '#efe4cf', { roughness: 0.7 });
    garlic.position.set(1.45 + i * 0.22, 0.35, -0.62 + i * 0.1);
    group.add(garlic);
  }

  const searLines = [];
  for (let i = 0; i < 4; i += 1) {
    const line = box(1.8, 0.02, 0.055, '#3b1c10', {
      transparent: true,
      opacity: 0,
      roughness: 0.7,
      emissive: '#160804',
      emissiveIntensity: 0.5,
    });
    line.position.set(-0.2, 0.675, -0.48 + i * 0.32);
    line.rotation.y = 0.16;
    group.add(line);
    searLines.push(line);
  }

  const butter = box(0.32, 0.12, 0.25, '#ffe29a', {
    roughness: 0.4,
    emissive: '#d9a341',
    emissiveIntensity: 0.4,
  });
  butter.position.set(1.05, 0.36, -0.82);
  group.add(butter);




  const tempGauge = new THREE.Group();
  tempGauge.position.set(3.35, 1.15, -1.9);
  const dial = cylinder(0.58, 0.58, 0.12, '#17222e', { metalness: 0.45, roughness: 0.4 });
  dial.rotation.x = Math.PI / 2;
  tempGauge.add(dial);
  const dialRing = torus(0.58, 0.022, '#ff9f45', { emissiveIntensity: 0.7 });
  dialRing.position.z = 0.06;
  tempGauge.add(dialRing);
  const needle = box(0.035, 0.43, 0.02, '#ff8a3d', {
    emissive: '#ff6a1f',
    emissiveIntensity: 1.2,
    roughness: 0.4,
  });
  needle.position.set(0, 0.12, 0.1);
  needle.rotation.z = -0.8;
  tempGauge.add(needle);
  const dialDot = sphere(0.045, '#ffd9a0', { emissive: '#ffb45e', emissiveIntensity: 1.4 });
  dialDot.position.z = 0.12;
  tempGauge.add(dialDot);
  addLabel(tempGauge, '180℃', [0, 0.92, 0.12], {
    color: '#ffd9a0',
    fontSize: 27,
    scale: 0.006,
    glow: 14,
    glowColor: '#ff9f45',
  });
  addLabel(tempGauge, '锅温', [0, -0.9, 0.12], {
    color: 'rgba(235, 200, 165, 0.7)',
    fontSize: 21,
    scale: 0.0052,
  });
  tempGauge.rotation.y = -0.15;
  group.add(tempGauge);



  const heatParticles = [];
  const rand = seeded(331);
  for (let i = 0; i < 32; i += 1) {
    const p = sphere(0.03, '#ffb35e', {
      emissive: '#ff8a3d',
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.7,
    });
    const a = rand() * Math.PI * 2;
    const r = 0.5 + rand() * 1.9;
    p.position.set(Math.cos(a) * r, 0.2 + rand() * 0.2, Math.sin(a) * r);
    group.add(p);
    heatParticles.push({ mesh: p, phase: rand() * 6, speed: 0.4 + rand() * 0.7, r, a });
  }

  const aroma = [];
  for (let i = 0; i < 12; i += 1) {
    const p = sphere(0.055, '#ffe1a3', {
      emissive: '#ffcf6b',
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.6,
    });
    p.position.set(-1.2 + rand() * 2.2, 0.7 + rand() * 0.2, -0.6 + rand() * 1.2);
    group.add(p);
    aroma.push({ mesh: p, phase: rand() * 6, speed: 0.25 + rand() * 0.3, x: p.position.x, z: p.position.z });
  }

  const cookStart = new THREE.Color('#b04a37');
  const cookEnd = new THREE.Color('#6f351d');

  return {
    group,
    view: { position: [5.8, 5.4, 8.8], target: [0, 0.7, 0] },
    autoRotateSpeed: 0.14,
    update(time) {
      const cook = Math.max(0.25, Math.min(1, 0.58 + Math.min(0.24, time * 0.02) + Math.sin(time * 0.45) * 0.07));
      steakMaterial.color.copy(cookStart).lerp(cookEnd, cook);
      steakMaterial.emissiveIntensity = 0.2 + cook * 0.3;
      pepper.forEach((speck) => {
        speck.visible = cook > 0.15;
        speck.material.opacity = Math.min(1, cook * 1.4);
      });
      flames.forEach((f) => {
        f.flame.scale.y = 0.8 + Math.sin(time * 8 + f.phase) * 0.22;
        f.flame.material.opacity = 0.28 + Math.sin(time * 6 + f.phase) * 0.12;
      });
      warmLight.intensity = 11 + Math.sin(time * 4) * 2;
      steak.material.emissiveIntensity = 0.2 + cook * 0.35;
      searLines.forEach((line, i) => {
        line.material.opacity = cook * (0.72 + i * 0.04);
      });
      butter.scale.setScalar(1 - cook * 0.6);
      heatParticles.forEach((p) => {
        p.mesh.position.y += (0.004 + cook * 0.006) * p.speed;
        p.mesh.position.x = Math.cos(p.a + time * 0.4) * p.r;
        p.mesh.position.z = Math.sin(p.a + time * 0.4) * p.r;
        if (p.mesh.position.y > 1.3) p.mesh.position.y = 0.3;
        p.mesh.material.opacity = 0.3 + Math.sin(time * 2 + p.phase) * 0.2;
      });
      aroma.forEach((p) => {
        p.mesh.position.y += 0.008 * p.speed;
        p.mesh.position.x = p.x + Math.sin(time * 1.2 + p.phase) * 0.12;
        p.mesh.position.z = p.z + Math.cos(time * 1.1 + p.phase) * 0.1;
        if (p.mesh.position.y > 3.2) p.mesh.position.y = 0.7;
        p.mesh.material.opacity = cook * 0.6 * (0.5 + Math.sin(time * 2 + p.phase) * 0.3);
      });
      tempGauge.rotation.y = -0.15 + Math.sin(time * 0.3) * 0.05;
      needle.rotation.z = -0.8 + Math.sin(time * 0.6) * 0.05;
    },
  };
}

export function heat() {
  const group = new THREE.Group();
  const cyan = '#5BE7FF';
  const orange = '#FF9F45';

  const stove = box(6.2, 0.45, 5, '#141d2a', {
    metalness: 0.5,
    roughness: 0.4,
    emissive: '#0a111a',
    emissiveIntensity: 0.3,
  });
  stove.position.y = -1.65;
  group.add(stove);
  const ring = torus(1.8, 0.08, '#3c4d62', { metalness: 0.7, roughness: 0.3 });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.36;
  group.add(ring);

  const flames = [];
  const rand = seeded(47);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const r = 0.5 + rand() * 0.85;
    const flame = cone(0.12, 0.9, '#5bbcff', {
      transparent: true,
      opacity: 0.45,
      emissiveIntensity: 1.2,
    });
    flame.material.blending = THREE.AdditiveBlending;
    flame.material.depthWrite = false;
    flame.position.set(Math.cos(a) * r, -1.5, Math.sin(a) * r);
    group.add(flame);
    flames.push({ flame, phase: rand() * 6, rate: 0.7 + rand() * 0.8 });
  }
  addGlow(group, '#ff8a3d', 6, [0, -0.7, 0], 0.28);

  const pot = new THREE.Group();
  const potWall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 1.9, 2.7, 40, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#35404f',
      metalness: 0.75,
      roughness: 0.28,
      transparent: true,
      opacity: 0.44,
      side: THREE.DoubleSide,
      emissive: '#141e2b',
      emissiveIntensity: 0.25,
      depthWrite: false,
    })
  );
  potWall.position.y = 0.0;
  pot.add(potWall);
  const bottom = cylinder(1.9, 1.9, 0.18, '#2c3542', { metalness: 0.7, roughness: 0.3 });
  bottom.position.y = -1.35;
  pot.add(bottom);
  const rim = torus(2.11, 0.045, '#7f96ad', { metalness: 0.6, roughness: 0.25 });
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.36;
  pot.add(rim);

  const water = cylinder(1.82, 1.82, 1.75, '#2b8fb0', {
    transparent: true,
    opacity: 0.3,
    roughness: 0.15,
    metalness: 0.3,
    emissive: '#155b73',
    emissiveIntensity: 0.3,
    depthWrite: false,
  });
  water.position.y = 0.42;
  pot.add(water);

  const spoon = new THREE.Group();
  const stick = cylinder(0.055, 0.07, 2.1, '#91643b', { roughness: 0.85 });
  stick.position.y = 1.15;
  stick.rotation.z = 0.5;
  const bowl = sphere(0.3, '#a8794c', { roughness: 0.8 });
  bowl.scale.set(1, 0.35, 1);
  bowl.position.set(-0.5, 2.05, 0.1);
  spoon.add(stick, bowl);
  spoon.position.z = -0.3;
  pot.add(spoon);
  group.add(pot);

  const convCount = 70;
  const convPositions = new Float32Array(convCount * 3);
  const convData = [];
  for (let i = 0; i < convCount; i += 1) {
    convData.push({
      angle: rand() * Math.PI * 2,
      radius: 0.35 + rand() * 1.25,
      y: -0.65 + rand() * 1.55,
      speed: 0.4 + rand() * 0.7,
      phase: rand() * 6,
    });
    convPositions.set([0, 0, 0], i * 3);
  }
  const convGeo = new THREE.BufferGeometry();
  convGeo.setAttribute('position', new THREE.BufferAttribute(convPositions, 3));
  const convection = new THREE.Points(
    convGeo,
    new THREE.PointsMaterial({
      color: new THREE.Color('#8fe8ff'),
      size: 0.06,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  convection.frustumCulled = false;
  pot.add(convection);

  const steam = [];
  for (let i = 0; i < 16; i += 1) {
    const puff = sphere(0.07, '#dff4ff', {
      transparent: true,
      opacity: 0.18,
      roughness: 1,
      depthWrite: false,
    });
    puff.position.set(-1.0 + rand() * 2, 1.5 + rand() * 0.4, -0.8 + rand() * 1.6);
    pot.add(puff);
    steam.push({ puff, phase: rand() * 6, speed: 0.2 + rand() * 0.25 });
  }

  addArrowArrow(group, [-2.7, -0.6, 0.6], [-1.6, 0.7, 0.6], orange);
  addLabel(group, '辐射', [-3.4, -0.2, 0.6], { color: orange, fontSize: 25, scale: 0.0058 });
  addLine(group, [[1.9, 0.5, 0.2], [1.9, -0.25, 0.2], [1.5, -0.9, 0.2]], orange, 0.4);
  addLabel(group, '传导', [2.5, -0.25, 0.3], { color: orange, fontSize: 25, scale: 0.0058 });

  addDashedLine(group, [[0.2, 0.3, 0.5], [0.8, 1.2, 0.8], [0.4, 2.3, 0.5], [-0.5, 2.9, 0.2]], cyan, 0.4, 0.16, 0.1);
  addLabel(group, '对流', [1.2, 2.3, 0.8], { color: cyan, fontSize: 25, scale: 0.0058 });

  addLabel(group, '热传导 · 对流 · 辐射', [0, 4.3, 0], {
    color: '#dfeeff',
    fontSize: 31,
    scale: 0.0068,
    bg: 'rgba(5, 10, 16, 0.72)',
    border: 'rgba(255, 159, 69, 0.28)',
    padding: 10,
    glow: 14,
    glowColor: orange,
  });
  addLabel(group, '金属锅导热快 → 爆炒', [-3.1, 3.2, 0.5], {
    color: 'rgba(235, 210, 170, 0.72)',
    fontSize: 21,
    scale: 0.0053,
  });
  addLabel(group, '砂锅导热慢 → 慢炖', [3.1, 3.2, 0.5], {
    color: 'rgba(180, 210, 235, 0.72)',
    fontSize: 21,
    scale: 0.0053,
  });
  addLabel(group, 'Q = k·A·ΔT·t / d', [0, -2.65, 2.6], {
    color: 'rgba(170, 205, 235, 0.72)',
    fontSize: 23,
    scale: 0.0055,
  });

  addGlow(group, '#19404f', 15, [0, 1, -5], 0.22);

  return {
    group,
    view: { position: [6.6, 4.8, 10.8], target: [0, 0.6, 0] },
    autoRotateSpeed: 0.18,
    update(time, dt) {
      flames.forEach((f) => {
        const p = 0.75 + Math.sin(time * 8 * f.rate + f.phase) * 0.23;
        f.flame.scale.y = p;
        f.flame.material.opacity = 0.32 + Math.sin(time * 6 + f.phase) * 0.12;
      });
      const positions = convGeo.attributes.position.array;
      convData.forEach((d, i) => {
        d.angle += dt * d.speed;
        const yy = d.y + Math.sin(time * 0.9 + d.phase) * 0.2;
        positions[i * 3] = Math.cos(d.angle) * d.radius * (1 - Math.abs(yy) * 0.08);
        positions[i * 3 + 1] = yy;
        positions[i * 3 + 2] = Math.sin(d.angle) * d.radius;
      });
      convGeo.attributes.position.needsUpdate = true;
      steam.forEach((s) => {
        s.puff.position.y += dt * s.speed;
        s.puff.position.x += Math.sin(time * 0.7 + s.phase) * dt * 0.08;
        if (s.puff.position.y > 4.4) s.puff.position.y = 1.45;
        s.puff.material.opacity = 0.07 + Math.sin(time + s.phase) * 0.04;
      });
      water.material.opacity = 0.27 + Math.sin(time * 1.1) * 0.03;
    },
  };
}

function addArrowArrow(parent, from, to, color) {
  const arrow = new THREE.Group();
  const dir = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
  const length = dir.length();
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.75,
    toneMapped: false,
    depthWrite: false,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, length * 0.7, 6), material);
  shaft.position.y = length * 0.35;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), material);
  head.position.y = length * 0.8;
  arrow.add(shaft, head);
  arrow.position.copy(new THREE.Vector3(...from));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(arrow);
}

export function dough() {
  const group = new THREE.Group();
  const accent = '#FF9F45';

  const board = box(7.2, 0.3, 5.2, '#6b4a2c', {
    roughness: 0.82,
    emissive: '#2b190b',
    emissiveIntensity: 0.2,
  });
  board.position.y = -0.85;
  group.add(board);

  const flourMat = '#e8ddc4';
  const rand = seeded(77);
  for (let i = 0; i < 14; i += 1) {
    const flour = sphere(0.18 + rand() * 0.22, flourMat, {
      transparent: true,
      opacity: 0.16,
      roughness: 1,
      depthWrite: false,
    });
    flour.scale.y = 0.06;
    flour.position.set((rand() - 0.5) * 6.4, -0.68, (rand() - 0.5) * 4.6);
    group.add(flour);
  }

  const doughGroup = new THREE.Group();
  doughGroup.position.set(0, 0, 0);
  group.add(doughGroup);

  const dough = sphere(1.55, '#e6c89b', {
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
    opacity: 0.7,
    emissive: '#8d6234',
    emissiveIntensity: 0.18,
    depthWrite: false,
  });
  dough.scale.set(1.25, 0.78, 1.0);
  dough.position.y = 0.35;
  doughGroup.add(dough);

  const crust = new THREE.Mesh(
    new THREE.SphereGeometry(1.56, 32, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffe6bd,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      toneMapped: false,
    })
  );
  crust.scale.set(1.25, 0.78, 1.0);
  crust.position.y = 0.35;
  doughGroup.add(crust);

  const bubbles = [];
  for (let i = 0; i < 18; i += 1) {
    const bubble = sphere(0.09 + rand() * 0.12, '#fff2d5', {
      transparent: true,
      opacity: 0.22,
      roughness: 0.3,
      emissive: '#fff0d0',
      emissiveIntensity: 0.3,
      depthWrite: false,
    });
    const a = rand() * Math.PI * 2;
    const r = rand() * 1.2;
    bubble.position.set(Math.cos(a) * r, 0.1 + rand() * 0.9, Math.sin(a) * r * 0.7);
    doughGroup.add(bubble);
    bubbles.push({ bubble, phase: rand() * 6, speed: 0.2 + rand() * 0.3 });
  }

  const yeast = [];
  for (let i = 0; i < 8; i += 1) {
    const cell = sphere(0.055, '#ffd36b', {
      emissive: '#ffb02e',
      emissiveIntensity: 1.1,
      roughness: 0.4,
    });
    const a = rand() * Math.PI * 2;
    cell.position.set(Math.cos(a) * (0.3 + rand() * 1.0), 0.25 + rand() * 0.7, Math.sin(a) * (0.2 + rand() * 0.8));
    doughGroup.add(cell);
    yeast.push({ cell, phase: rand() * 6, speed: 0.15 + rand() * 0.2 });
  }

  const co2 = [];
  for (let i = 0; i < 7; i += 1) {
    const dot = sphere(0.07, '#bff4ff', {
      emissive: '#7fe9ff',
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.7,
    });
    dot.position.set((rand() - 0.5) * 2, 1.6 + rand() * 1.2, (rand() - 0.5) * 1.6);
    group.add(dot);
    co2.push({ dot, phase: rand() * 6, x: dot.position.x, z: dot.position.z });
  }

  const lamp = new THREE.Group();
  lamp.position.set(-3.3, 3.5, -1.7);
  const shade = cone(0.75, 0.55, '#c58d4c', { roughness: 0.5, metalness: 0.3 });
  shade.rotation.z = Math.PI;
  shade.position.y = 0.2;
  lamp.add(shade);
  const bulb = sphere(0.16, '#ffe9a8', { emissive: '#ffd36b', emissiveIntensity: 2.2 });
  bulb.position.y = -0.12;
  lamp.add(bulb);
  addGlow(lamp, '#ffd36b', 3.2, [0, -0.12, 0], 0.4);
  group.add(lamp);

  addLabel(group, '发酵 · 面包的气孔', [0, 4.55, 0], {
    color: accent,
    fontSize: 32,
    scale: 0.0069,
    bg: 'rgba(14, 8, 4, 0.72)',
    border: 'rgba(255, 159, 69, 0.3)',
    padding: 10,
    glow: 15,
    glowColor: accent,
  });
  addLabel(group, '酵母', [2.4, 1.1, 0.6], {
    color: '#ffe1a3',
    fontSize: 24,
    scale: 0.0056,
    bg: 'rgba(8, 6, 3, 0.66)',
    padding: 7,
  });
  addLabel(group, 'CO₂', [2.6, 2.8, 0.4], {
    color: '#bff4ff',
    fontSize: 25,
    scale: 0.0057,
    bg: 'rgba(4, 8, 14, 0.66)',
    padding: 7,
  });
  addLabel(group, '面筋网络', [-2.5, -0.15, 1.6], {
    color: 'rgba(230, 205, 175, 0.72)',
    fontSize: 22,
    scale: 0.0052,
  });
  addLabel(group, '25～28℃ 最适合发酵', [0, -1.55, 3.1], {
    color: 'rgba(235, 210, 175, 0.72)',
    fontSize: 23,
    scale: 0.0055,
  });

  addGlow(group, '#4d3218', 14, [0, 1, -4], 0.2);

  return {
    group,
    view: { position: [6.2, 4.2, 9.4], target: [0, 1.0, 0] },
    autoRotateSpeed: 0.16,
    update(time, dt) {
      const cycle = (time * 0.12) % 1;
      const rise = 0.78 + Math.min(1, cycle / 0.65) * 0.48;
      doughGroup.scale.set(1 + (rise - 1) * 0.2, rise, 1 + (rise - 1) * 0.2);
      bubbles.forEach((b) => {
        b.bubble.position.y = 0.15 + ((time * b.speed + b.phase) % 1.2);
        b.bubble.material.opacity = 0.1 + Math.sin(time * 1.8 + b.phase) * 0.1;
        b.bubble.scale.setScalar(1 + Math.sin(time * 2 + b.phase) * 0.15);
      });
      yeast.forEach((y) => {
        y.cell.position.y = 0.25 + Math.sin(time * y.speed * 2 + y.phase) * 0.18;
        y.cell.material.emissiveIntensity = 0.8 + Math.sin(time * 2.4 + y.phase) * 0.4;
      });
      co2.forEach((p) => {
        p.dot.position.y += dt * 0.3;
        p.dot.position.x = p.x + Math.sin(time * 1.1 + p.phase) * 0.18;
        p.dot.position.z = p.z + Math.cos(time * 0.9 + p.phase) * 0.12;
        if (p.dot.position.y > 3.8) p.dot.position.y = 1.5;
        p.dot.material.opacity = 0.3 + Math.sin(time * 1.6 + p.phase) * 0.2;
      });
      lamp.rotation.y = Math.sin(time * 0.4) * 0.05;
    },
  };
}
