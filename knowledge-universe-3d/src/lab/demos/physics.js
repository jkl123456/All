import {
  THREE,
  addArrow,
  addDashedLine,
  addGlow,
  addLabel,
  addLine,
  addTube,
  addBeam,
  box,
  cone,
  cylinder,
  ringLine,
  sphere,
  torus,
} from './helpers.js';

export function pendulum() {
  const group = new THREE.Group();
  const brass = '#D9B877';
  const steel = '#93a8c6';

  const base = box(6.4, 0.22, 2.6, '#182235', { metalness: 0.6, roughness: 0.35 });
  base.position.y = 0;
  group.add(base);
  const postL = cylinder(0.09, 0.12, 5.2, steel, { metalness: 0.7, roughness: 0.28 });
  postL.position.set(-2.75, 2.6, 0);
  const postR = postL.clone();
  postR.position.x = 2.75;
  const beam = box(5.8, 0.14, 0.2, brass, { metalness: 0.7, roughness: 0.3 });
  beam.position.y = 5.12;
  group.add(postL, postR, beam);

  const L = 3.55;
  const pivot = new THREE.Group();
  pivot.position.set(0, 5.02, 0);
  group.add(pivot);

  const rod = cylinder(0.025, 0.025, L, '#cdd9e8', { metalness: 0.8, roughness: 0.2 });
  rod.position.y = -L / 2;
  pivot.add(rod);

  const bob = sphere(0.36, '#d8ad5a', {
    metalness: 0.85,
    roughness: 0.18,
    emissive: '#7d5720',
    emissiveIntensity: 0.45,
  });
  bob.position.y = -L;
  pivot.add(bob);
  addGlow(pivot, brass, 2.2, [0, -L, 0], 0.28);

  const trail = [];
  for (let i = 0; i <= 60; i += 1) {
    const a = -0.48 + (i / 60) * 0.96;
    trail.push(new THREE.Vector3(Math.sin(a) * L, 5.02 - Math.cos(a) * L, 0));
  }
  addTube(group, trail, brass, 0.007, 0.22);

  const clock = new THREE.Group();
  clock.position.set(0, 3.05, -1.25);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 64),
    new THREE.MeshBasicMaterial({ color: 0x08111e, transparent: true, opacity: 0.82, toneMapped: false })
  );
  clock.add(face);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.37, 0.018, 6, 90),
    new THREE.MeshBasicMaterial({ color: brass, transparent: true, opacity: 0.6, toneMapped: false })
  );
  clock.add(rim);
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    const r1 = i % 5 === 0 ? 1.13 : 1.24;
    const r2 = 1.31;
    addLine(
      clock,
      [
        [Math.cos(a) * r1, Math.sin(a) * r1, 0.01],
        [Math.cos(a) * r2, Math.sin(a) * r2, 0.01],
      ],
      brass,
      i % 5 === 0 ? 0.5 : 0.2
    );
  }
  const hand = box(0.018, 1.0, 0.012, '#e8f4ff', { emissiveIntensity: 1.2 });
  hand.position.set(0, 0.5, 0.03);
  hand.geometry.translate(0, 0.5, 0);
  clock.add(hand);
  addLabel(clock, '摆钟 · 1656', [0, -1.78, 0], {
    color: 'rgba(220, 235, 255, 0.7)',
    fontSize: 26,
    scale: 0.0062,
  });
  group.add(clock);

  addLabel(group, 'L = 3.55 m', [-0.32, 3.2, 0.5], {
    color: brass,
    fontSize: 26,
    scale: 0.0062,
    bg: 'rgba(4, 8, 16, 0.62)',
    border: 'rgba(217, 184, 119, 0.3)',
    padding: 8,
  });
  addLabel(group, 'T = 2π√(L/g) ≈ 3.78 s', [0, 0.72, 2.2], {
    color: '#cfe6ff',
    fontSize: 30,
    scale: 0.0068,
  });
  addLabel(group, '等时性：与摆球质量无关', [0, -0.12, 2.2], {
    color: 'rgba(160, 190, 230, 0.7)',
    fontSize: 23,
    scale: 0.0058,
  });

  return {
    group,
    view: { position: [0.8, 3.4, 11.8], target: [0, 2.5, 0] },
    autoRotate: false,
    update(time) {
      const T = 2 * Math.PI * Math.sqrt(L / 9.8);
      const angle = 0.46 * Math.sin((time / T) * Math.PI * 2);
      pivot.rotation.z = angle;
      hand.rotation.z = -time * 0.7;
      bob.material.emissiveIntensity = 0.42 + Math.abs(Math.sin((time / T) * Math.PI)) * 0.18;
    },
  };
}

function buildWater(group, width = 12, depth = 8, top = 0, wave = true) {
  const body = box(width, 3.2, depth, '#1b6fa0', {
    transparent: true,
    opacity: 0.14,
    roughness: 0.15,
    metalness: 0.25,
    emissive: '#0d4d72',
    emissiveIntensity: 0.22,
    depthWrite: false,
  });
  body.position.y = top - 1.6;
  group.add(body);

  const surfaceGeo = new THREE.PlaneGeometry(width, depth, 40, 26);
  const surface = new THREE.Mesh(
    surfaceGeo,
    new THREE.MeshStandardMaterial({
      color: '#2b9cc9',
      transparent: true,
      opacity: 0.38,
      roughness: 0.18,
      metalness: 0.55,
      emissive: '#0d4f6e',
      emissiveIntensity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = top;
  group.add(surface);

  const basePositions = surfaceGeo.attributes.position.array.slice();
  return {
    surface,
    animate(t) {
      if (!wave) return;
      const positions = surfaceGeo.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = basePositions[i];
        const y = basePositions[i + 1];
        positions[i + 2] = Math.sin(x * 1.4 + t * 1.5) * 0.045 + Math.cos(y * 1.7 + t * 1.1) * 0.035;
      }
      surfaceGeo.attributes.position.needsUpdate = true;
    },
  };
}

function shipModel() {
  const ship = new THREE.Group();
  const hullMat = { metalness: 0.55, roughness: 0.42, emissive: '#24374d', emissiveIntensity: 0.15 };
  const hull = box(5.4, 0.85, 2.1, '#b7c4d4', hullMat);
  hull.position.y = 0.05;
  ship.add(hull);

  const bow = cone(0.95, 1.5, '#b7c4d4', hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(3.35, 0.05, 0);
  bow.scale.z = 1.1;
  ship.add(bow);

  const deck = box(5.2, 0.1, 1.9, '#647a91', { roughness: 0.7 });
  deck.position.y = 0.52;
  ship.add(deck);

  const cabin = box(1.25, 0.95, 1.45, '#e7edf5', { metalness: 0.2, roughness: 0.55 });
  cabin.position.set(-1.7, 1.0, 0);
  ship.add(cabin);
  const bridge = box(0.72, 0.55, 1.2, '#9fb3c8', { roughness: 0.4 });
  bridge.position.set(-1.62, 1.76, 0);
  ship.add(bridge);

  const containerColors = ['#e0663f', '#2f8fc4', '#e8b64b', '#3fa97b'];
  for (let i = 0; i < 4; i += 1) {
    const c = box(0.95, 0.48, 0.62, containerColors[i], { roughness: 0.62 });
    c.position.set(0.35 + (i % 2) * 0.1, 0.83 + Math.floor(i / 2) * 0.5, -0.42 + (i % 2) * 0.84);
    ship.add(c);
  }

  const mast = cylinder(0.035, 0.045, 1.5, '#dbe6f2', { metalness: 0.6 });
  mast.position.set(0.7, 1.95, 0);
  ship.add(mast);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xe0663f, side: THREE.DoubleSide, toneMapped: false })
  );
  flag.position.set(0.98, 2.45, 0);
  ship.add(flag);

  const underwater = box(4.7, 0.55, 1.85, '#2e8fb8', {
    transparent: true,
    opacity: 0.2,
    emissive: '#45b8dd',
    emissiveIntensity: 0.45,
    depthWrite: false,
  });
  underwater.position.y = -0.38;
  ship.add(underwater);

  return ship;
}

function buoyModel() {
  const buoy = new THREE.Group();
  const body = cylinder(0.34, 0.48, 1.1, '#e2603f', {
    metalness: 0.25,
    roughness: 0.4,
    emissive: '#7a2410',
    emissiveIntensity: 0.25,
  });
  body.position.y = 0.3;
  buoy.add(body);

  const band = cylinder(0.36, 0.37, 0.18, '#f4f0e6', { roughness: 0.5 });
  band.position.y = 0.58;
  buoy.add(band);

  const neck = cylinder(0.12, 0.2, 0.55, '#1d3346', { metalness: 0.6 });
  neck.position.y = 1.0;
  buoy.add(neck);

  const light = sphere(0.16, '#ffe6a3', { emissive: '#ffd36b', emissiveIntensity: 1.2 });
  light.position.y = 1.34;
  buoy.add(light);
  addGlow(buoy, '#ffd36b', 1.1, [0, 1.34, 0], 0.35);

  return buoy;
}

export function buoyancy({ point }) {
  const group = new THREE.Group();
  const mode = point?.demo?.config?.mode || 'ship';
  const accent = '#5BDFFF';

  const water = buildWater(group, mode === 'buoy' ? 30 : 20, mode === 'buoy' ? 22 : 14, 0, true);

  if (mode === 'buoy') {
    const buoy = buoyModel();
    buoy.position.set(0, 0.1, 0);
    buoy.scale.setScalar(1.35);
    group.add(buoy);

    addGlow(group, '#ffd9a0', 7, [-7, 4.2, -9], 0.26);
    const horizon = box(36, 0.06, 0.5, '#2c6b86', {
      transparent: true,
      opacity: 0.22,
      emissive: '#1b4f66',
      emissiveIntensity: 0.3,
    });
    horizon.position.set(0, 0.02, -10.5);
    group.add(horizon);

    const waveRings = [];
    for (let i = 0; i < 4; i += 1) {
      const ring = ringLine(1.0, '#8fe8ff', 0.16, 80, 0);
      ring.position.y = 0.025;
      ring.scale.z = 0.72;
      group.add(ring);
      waveRings.push({ ring, offset: i * 0.24 });
    }
    const wakeLines = [];
    for (let i = 0; i < 3; i += 1) {
      addLine(group, [[-12, 0.03, -4 + i * 3], [12, 0.03, -4 + i * 3]], '#4f9fbb', 0.08);
      wakeLines.push(i);
    }

    const anchorPoint = new THREE.Vector3(0, -2.15, 0);
    const chain = [];
    for (let i = 0; i <= 8; i += 1) {
      const t = i / 8;
      chain.push(new THREE.Vector3(Math.sin(t * Math.PI * 2) * 0.1, -0.75 - t * 1.35, Math.cos(t * Math.PI * 2) * 0.1));
    }
    addTube(buoy, chain, '#8fa7bd', 0.02, 0.6);

    const anchor = new THREE.Group();
    const shank = cylinder(0.03, 0.04, 0.5, '#8fa7bd', { metalness: 0.7 });
    shank.rotation.z = Math.PI / 2;
    anchor.add(shank);
    const arm = torus(0.26, 0.035, '#8fa7bd', { metalness: 0.7 });
    arm.rotation.x = Math.PI / 2;
    arm.position.x = 0.22;
    anchor.add(arm);
    anchor.position.set(0, -2.2, 0);
    group.add(anchor);

    addArrow(group, [0, 1.0, 0], [0, 3.05, 0], accent, { headLength: 0.24 });
    addArrow(group, [0, 1.0, 0], [0, -0.85, 0], '#FF9F45', { headLength: 0.22 });
    addLabel(group, 'F浮', [0.55, 2.45, 0], { color: accent, fontSize: 30, scale: 0.007 });
    addLabel(group, 'G', [0.55, -0.42, 0], { color: '#FF9F45', fontSize: 30, scale: 0.007 });
    addLabel(group, '漂浮时 F浮 = G', [2.2, -1.65, 0.7], {
      color: '#cfe6ff',
      fontSize: 25,
      scale: 0.006,
      bg: 'rgba(4, 8, 16, 0.62)',
      padding: 8,
    });
    addLabel(group, '锚链固定位置', [2.15, -0.95, 0.7], {
      color: 'rgba(190, 215, 240, 0.8)',
      fontSize: 22,
      scale: 0.0056,
    });

    return {
      group,
      view: { position: [5.2, 3.0, 9.6], target: [0, 0.1, 0] },
      update(time) {
        water.animate(time);
        buoy.position.y = 0.1 + Math.sin(time * 1.4) * 0.11;
        buoy.rotation.z = Math.sin(time * 1.1) * 0.045;
        buoy.rotation.x = Math.cos(time * 1.3) * 0.03;
        waveRings.forEach((item) => {
          const u = (time * 0.24 + item.offset) % 1;
          item.ring.scale.set(0.3 + u * 2.4, 0.3 + u * 2.4, 0.72);
          const line = item.ring.children[0];
          if (line?.material) line.material.opacity = (1 - u) * 0.2;
        });
      },
    };
  }

  const ship = shipModel();
  ship.position.set(-0.3, 0.28, 0);
  group.add(ship);

  const wake = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const r = 2.8 + i * 1.2;
    const ring = ringLine(r, accent, 0.12 - i * 0.025, 80, 0);
    ring.position.y = 0.02;
    ring.scale.z = 0.55;
    wake.add(ring);
  }
  group.add(wake);

  addArrow(group, [-0.3, 1.1, 0], [-0.3, 3.4, 0], accent, { headLength: 0.3 });
  addArrow(group, [-0.3, 1.1, 0], [-0.3, -1.15, 0], '#FF9F45', { headLength: 0.26 });
  addLabel(group, 'F浮 = ρ液·g·V排', [0.4, 2.9, 0], {
    color: accent,
    fontSize: 29,
    scale: 0.0068,
    bg: 'rgba(4, 8, 16, 0.62)',
    border: 'rgba(91, 223, 255, 0.3)',
    padding: 9,
  });
  addLabel(group, 'G', [0.5, -0.55, 0], { color: '#FF9F45', fontSize: 30, scale: 0.007 });
  addLabel(group, '空心船体排开大量海水', [0, -2.35, 2.3], {
    color: 'rgba(180, 210, 240, 0.8)',
    fontSize: 25,
    scale: 0.006,
  });
  addLabel(group, '20 万吨矿砂船', [-0.3, 3.7, -2.3], {
    color: '#d9e9ff',
    fontSize: 27,
    scale: 0.0062,
  });

  return {
    group,
    view: { position: [7.2, 4.4, 12.0], target: [0, 0.6, 0] },
    update(time) {
      water.animate(time);
      ship.position.y = 0.28 + Math.sin(time * 0.9) * 0.055;
      ship.rotation.z = Math.sin(time * 0.7) * 0.012;
      ship.rotation.x = Math.cos(time * 0.8) * 0.008;
      wake.children.forEach((ring, i) => {
        const phase = (time * 0.22 + i * 0.33) % 1;
        ring.scale.setScalar(0.6 + phase * 0.9);
        const line = ring.children[0];
        if (line?.material) line.material.opacity = (1 - phase) * 0.12;
      });
    },
  };
}

export function induction() {
  const group = new THREE.Group();
  const accent = '#5BDFFF';

  const hill = cylinder(5.4, 6.2, 0.5, '#14283a', {
    roughness: 0.9,
    emissive: '#0b2233',
    emissiveIntensity: 0.3,
  });
  hill.position.y = -0.25;
  hill.scale.z = 0.7;
  group.add(hill);

  const tower = cylinder(0.16, 0.34, 5.4, '#c7d9e7', {
    metalness: 0.45,
    roughness: 0.38,
    emissive: '#3b5d75',
    emissiveIntensity: 0.18,
  });
  tower.position.set(-2.6, 2.7, 0);
  group.add(tower);

  const nacelle = box(0.9, 0.5, 0.55, '#d8e6f1', { metalness: 0.3, roughness: 0.4 });
  nacelle.position.set(-2.1, 5.45, 0);
  group.add(nacelle);

  const hub = sphere(0.25, '#e9f4ff', { metalness: 0.5, emissive: '#7fd8ff', emissiveIntensity: 0.6 });
  hub.position.set(-1.62, 5.45, 0);
  group.add(hub);

  const rotor = new THREE.Group();
  rotor.position.copy(hub.position);
  const bladeMat = { metalness: 0.2, roughness: 0.4, emissive: '#3d8fae', emissiveIntensity: 0.2 };
  for (let i = 0; i < 3; i += 1) {
    const blade = box(0.16, 4.2, 0.3, '#e3edf7', bladeMat);
    blade.geometry.translate(0, 1.95, 0);
    blade.rotation.x = (i / 3) * Math.PI * 2;
    rotor.add(blade);
  }
  group.add(rotor);
  addGlow(group, accent, 3.2, [-1.62, 5.45, 0], 0.35);

  addLabel(group, '风能', [-7.2, 5.8, 0], { color: '#9fdcff', fontSize: 30, scale: 0.007 });
  addArrow(group, [-6.4, 5.4, 0], [-3.8, 5.4, 0], '#9fdcff', { headLength: 0.28, opacity: 0.55 });
  addLabel(group, '机械能', [-2.4, 6.7, 0], { color: '#FFD37A', fontSize: 26, scale: 0.0062 });
  addLabel(group, '电能', [3.6, 4.5, 0], { color: '#7ef0b0', fontSize: 28, scale: 0.0066 });

  const windCount = 110;
  const windPositions = new Float32Array(windCount * 3);
  const windData = [];
  for (let i = 0; i < windCount; i += 1) {
    const x = -8 + Math.random() * 8.5;
    const y = 1.4 + Math.random() * 5.6;
    const z = (Math.random() - 0.5) * 6;
    windPositions.set([x, y, z], i * 3);
    windData.push({ speed: 0.8 + Math.random() * 0.9 });
  }
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPositions, 3));
  const wind = new THREE.Points(
    windGeo,
    new THREE.PointsMaterial({
      color: 0xbfe9ff,
      size: 0.07,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  wind.frustumCulled = false;
  group.add(wind);

  const city = new THREE.Group();
  city.position.set(5.2, 0, -1.2);
  const buildingColors = ['#24405c', '#2b4b6a', '#1d3348', '#314f6b'];
  for (let i = 0; i < 6; i += 1) {
    const w = 0.7 + (i % 2) * 0.3;
    const h = 1.2 + ((i * 1.7) % 2.6);
    const d = 0.7;
    const bx = (i % 3) * 0.95 - 1.0;
    const bz = Math.floor(i / 3) * 1.0 - 0.5;
    const building = box(w, h, d, buildingColors[i % 4], {
      metalness: 0.3,
      roughness: 0.55,
      emissive: '#1a3247',
      emissiveIntensity: 0.4,
    });
    building.position.set(bx, h / 2, bz);
    city.add(building);
    for (let row = 0; row < Math.floor(h / 0.42); row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(0.12, 0.16),
          new THREE.MeshBasicMaterial({
            color: Math.random() > 0.4 ? '#ffd98d' : '#7fe9ff',
            transparent: true,
            opacity: 0.66,
            toneMapped: false,
          })
        );
        win.position.set(bx - 0.16 + col * 0.32, 0.28 + row * 0.4, bz + d / 2 + 0.005);
        city.add(win);
      }
    }
  }
  group.add(city);

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.6, 0.25, 0.3),
    new THREE.Vector3(-0.8, -0.15, 1.1),
    new THREE.Vector3(1.4, 0.1, 0.9),
    new THREE.Vector3(4.2, 0.1, 0.1),
  ]);
  const cable = addTube(group, cableCurve.getPoints(60), '#7ef0b0', 0.025, 0.65);
  const pulses = [];
  for (let i = 0; i < 3; i += 1) {
    const p = sphere(0.07, '#a4ffd0', { emissive: '#7ef0b0', emissiveIntensity: 2 });
    group.add(p);
    pulses.push({ mesh: p, offset: i / 3 });
  }

  addLabel(group, '叶片切割磁感线', [-2.6, 4.35, 1.6], {
    color: 'rgba(185, 220, 250, 0.75)',
    fontSize: 24,
    scale: 0.0058,
  });
  addLabel(group, 'E = −N·ΔΦ/Δt', [0.6, 4.1, 0], {
    color: '#9fdcff',
    fontSize: 24,
    scale: 0.0058,
  });

  return {
    group,
    view: { position: [10.2, 5.6, 8.8], target: [-0.3, 2.4, 0] },
    update(time, dt) {
      rotor.rotation.x += dt * 1.75;
      const positions = windGeo.attributes.position.array;
      for (let i = 0; i < windCount; i += 1) {
        positions[i * 3] += dt * windData[i].speed * 0.85;
        if (positions[i * 3] > 0.4) positions[i * 3] = -8;
      }
      windGeo.attributes.position.needsUpdate = true;
      pulses.forEach((p) => {
        const u = (time * 0.22 + p.offset) % 1;
        p.mesh.position.copy(cableCurve.getPointAt(u));
        p.mesh.material.emissiveIntensity = 1.5 + Math.sin(time * 4) * 0.5;
      });
      cable.material.opacity = 0.5 + Math.sin(time * 2.2) * 0.12;
    },
  };
}

export function tide() {
  const group = new THREE.Group();
  const blue = '#3D9DFF';
  const accent = '#5BE7FF';

  const earth = new THREE.Group();
  group.add(earth);

  const sphereEarth = sphere(1.5, '#164a7c', {
    emissive: '#0d2f52',
    emissiveIntensity: 0.75,
    roughness: 0.55,
    metalness: 0.18,
  });
  earth.add(sphereEarth);

  const landMaterial = new THREE.MeshStandardMaterial({
    color: '#2fae86',
    emissive: '#124f3d',
    emissiveIntensity: 0.35,
    roughness: 0.8,
  });
  const landA = new THREE.Mesh(new THREE.SphereGeometry(1.505, 36, 24, 0.5, 1.1, 0.7, 0.65), landMaterial);
  const landB = new THREE.Mesh(new THREE.SphereGeometry(1.505, 36, 24, 3.2, 1.0, 0.95, 0.6), landMaterial);
  const landC = new THREE.Mesh(new THREE.SphereGeometry(1.505, 36, 24, 4.6, 0.8, 0.5, 0.55), landMaterial);
  earth.add(landA, landB, landC);

  const grid = new THREE.Mesh(
    new THREE.SphereGeometry(1.53, 32, 18),
    new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      toneMapped: false,
    })
  );
  earth.add(grid);

  const bulge = new THREE.Group();
  const bulgeMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  for (const direction of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(1.36, 36, 24), bulgeMaterial.clone());
    lobe.scale.set(1.02, 0.94, 0.94);
    lobe.position.x = direction * 1.05;
    lobe.material.opacity = 0.075;
    bulge.add(lobe);
  }
  group.add(bulge);

  addLabel(group, '地球', [0, -2.35, 0], {
    color: '#9fdcff',
    fontSize: 26,
    scale: 0.0062,
  });
  addGlow(earth, accent, 5.2, [0, 0, 0], 0.18);

  const orbitLine = [];
  for (let i = 0; i <= 140; i += 1) {
    const a = (i / 140) * Math.PI * 2;
    orbitLine.push([Math.cos(a) * 5.4, 0.5 + Math.sin(a * 3) * 0.02, Math.sin(a) * 5.4]);
  }
  addLine(group, orbitLine, accent, 0.18);

  const moonOrbit = new THREE.Group();
  moonOrbit.position.y = 0.5;
  group.add(moonOrbit);
  const moon = sphere(0.44, '#dfe6ee', {
    emissive: '#7d8b9e',
    emissiveIntensity: 0.35,
    roughness: 0.85,
  });
  moon.position.set(5.4, 0, 0);
  moonOrbit.add(moon);
  const moonGlow = addGlow(moon, '#dfe6ee', 2.1, [0, 0, 0], 0.35);
  const moonLabel = addLabel(group, '月球', [5.4, 1.45, 0], {
    color: '#e8f2ff',
    fontSize: 26,
    scale: 0.0062,
  });

  const sun = addGlow(group, '#ffcf6b', 5.2, [10, 4.8, -10], 0.3);
  addLabel(group, '太阳', [9.8, 5.6, -10], {
    color: '#ffd98d',
    fontSize: 23,
    scale: 0.0056,
  });

  const gauge = new THREE.Group();
  gauge.position.set(4.3, -2.2, 2.5);
  gauge.scale.setScalar(0.85);
  const gaugePost = cylinder(0.06, 0.09, 4.2, '#8fa7bd', { metalness: 0.5 });
  gaugePost.position.y = 2.1;
  gauge.add(gaugePost);
  const gaugeBase = box(1.2, 0.16, 1.2, '#28405a', { roughness: 0.6 });
  gauge.add(gaugeBase);
  const tubeGlass = cylinder(0.28, 0.28, 3.2, '#a9dbef', {
    transparent: true,
    opacity: 0.14,
    roughness: 0.1,
    metalness: 0.2,
    depthWrite: false,
  });
  tubeGlass.position.y = 2.1;
  gauge.add(tubeGlass);
  const waterCol = cylinder(0.24, 0.24, 1.5, '#38b4d8', {
    transparent: true,
    opacity: 0.6,
    emissive: '#1b7f9c',
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  waterCol.position.y = 0.9;
  gauge.add(waterCol);
  addLabel(gauge, '潮位', [0, 4.1, 0], {
    color: accent,
    fontSize: 24,
    scale: 0.006,
  });
  group.add(gauge);

  const highLabel = addLabel(group, '高潮', [2.55, 0.2, 0.7], { color: accent, fontSize: 27, scale: 0.0062 });
  const lowLabel = addLabel(group, '低潮', [-2.55, 0.2, 0.7], {
    color: 'rgba(120, 180, 220, 0.7)',
    fontSize: 27,
    scale: 0.0062,
  });
  addLabel(group, '月球引潮力 · 周期约 12h25m', [0, -3.2, 2.6], {
    color: '#cfe6ff',
    fontSize: 27,
    scale: 0.0064,
  });

  return {
    group,
    view: { position: [7.2, 5.0, 11.4], target: [0, 0.2, 0] },
    autoRotateSpeed: 0.28,
    update(time, dt) {
      const angle = time * 0.22;
      moonOrbit.rotation.y = angle;
      moonLabel.position.set(Math.cos(angle) * 5.4, 1.55, -Math.sin(angle) * 5.4);
      sun.material.opacity = 0.26 + Math.sin(time * 1.2) * 0.06;
      bulge.rotation.y = angle;
      earth.rotation.y += dt * 0.16;
      highLabel.position.set(Math.cos(angle) * 2.35, 0.2, -Math.sin(angle) * 2.35);
      lowLabel.position.set(-Math.cos(angle) * 2.35, 0.2, Math.sin(angle) * 2.35);
      const level = 1.5 + Math.sin(time * 0.65) * 0.5;
      waterCol.scale.y = level / 1.5;
      waterCol.position.y = 0.5 + level / 2;
    },
  };
}
