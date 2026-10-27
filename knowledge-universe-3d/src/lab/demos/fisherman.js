import {
  THREE,
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

function createFish(color = '#cfe3ee') {
  const fish = new THREE.Group();
  const body = sphere(0.17, color, {
    emissive: '#7fc8e0',
    emissiveIntensity: 0.25,
    roughness: 0.45,
    metalness: 0.3,
  });
  body.scale.set(1.55, 0.65, 0.55);
  const tail = cone(0.13, 0.28, color, {
    emissive: '#7fc8e0',
    emissiveIntensity: 0.2,
    roughness: 0.5,
    flatShading: true,
  });
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -0.29;
  tail.scale.z = 0.6;
  const fin = cone(0.06, 0.18, color, { roughness: 0.5 });
  fin.position.set(0.02, 0.13, 0);
  fin.rotation.z = -0.2;
  fish.add(body, tail, fin);
  return fish;
}

export function sonar() {
  const group = new THREE.Group();
  const cyan = '#5BE7FF';

  const water = box(24, 9, 14, '#0d4c66', {
    transparent: true,
    opacity: 0.055,
    roughness: 0.15,
    metalness: 0.2,
    depthWrite: false,
  });
  water.position.y = -4.5;
  group.add(water);

  const surfaceGeo = new THREE.PlaneGeometry(24, 14, 40, 24);
  const surface = new THREE.Mesh(
    surfaceGeo,
    new THREE.MeshStandardMaterial({
      color: '#1d7b9c',
      transparent: true,
      opacity: 0.24,
      roughness: 0.18,
      metalness: 0.5,
      emissive: '#0b3a4e',
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0;
  group.add(surface);
  const surfaceBase = surfaceGeo.attributes.position.array.slice();

  const seabed = box(24, 0.4, 14, '#3d3b2f', {
    roughness: 0.95,
    emissive: '#1a1811',
    emissiveIntensity: 0.3,
  });
  seabed.position.y = -8.8;
  group.add(seabed);
  for (let i = 0; i < 7; i += 1) {
    const rock = sphere(0.5 + (i % 3) * 0.3, '#4b4a3d', { roughness: 1, flatShading: true });
    rock.scale.y = 0.5;
    rock.position.set(-7 + i * 2.3, -8.4, -3 + (i % 2) * 2.5);
    group.add(rock);
  }
  addLabel(group, '海底', [-6.0, -8.05, 3.8], {
    color: 'rgba(210, 200, 175, 0.65)',
    fontSize: 21,
    scale: 0.0051,
  });

  const boat = new THREE.Group();
  boat.position.set(-0.5, 0.25, 0);
  const hull = box(4.3, 0.62, 1.5, '#6f879a', {
    metalness: 0.45,
    roughness: 0.42,
    emissive: '#31485c',
    emissiveIntensity: 0.2,
  });
  const bow = cone(0.74, 1.2, '#6f879a', { metalness: 0.45, roughness: 0.42 });
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(2.65, 0, 0);
  bow.scale.z = 1.1;
  const cabin = box(1.5, 0.9, 1.1, '#eef4fa', { roughness: 0.5, metalness: 0.15 });
  cabin.position.set(-0.7, 0.76, 0);
  const roof = box(1.7, 0.1, 1.3, '#7d9bb2', { metalness: 0.4 });
  roof.position.set(-0.7, 1.26, 0);
  const mast = cylinder(0.03, 0.04, 1.7, '#b9cedf', { metalness: 0.6 });
  mast.position.set(0.55, 1.6, 0);
  boat.add(hull, bow, cabin, roof, mast);
  group.add(boat);
  addLabel(group, '渔船', [-0.5, 2.65, 0], {
    color: '#dff4ff',
    fontSize: 25,
    scale: 0.0058,
  });
  addGlow(group, '#dff4ff', 1.4, [0.55, 2.45, 0], 0.5);

  const transducer = cylinder(0.28, 0.34, 0.35, '#6f879c', { metalness: 0.6, roughness: 0.35 });
  transducer.position.set(0.3, -0.4, 0);
  group.add(transducer);
  addGlow(group, cyan, 1.3, [0.3, -0.55, 0], 0.5);

  const waveRings = [];
  for (let i = 0; i < 3; i += 1) {
    const ring = ringLine(1.0, cyan, 0.16, 96, 0);
    ring.position.set(0.3, -0.55, 0);
    ring.scale.z = 0.78;
    group.add(ring);
    waveRings.push({ ring, offset: i / 3 });
  }



  const fishGroup = new THREE.Group();
  fishGroup.position.set(6.0, -3.4, 0.5);
  group.add(fishGroup);
  const fishList = [];
  const rand = seeded(812);
  for (let i = 0; i < 9; i += 1) {
    const fish = createFish(i % 3 === 0 ? '#e8f4ff' : '#bcd9e8');
    fish.position.set((rand() - 0.5) * 2.6, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.8);
    fish.rotation.y = (rand() - 0.5) * 0.4;
    fish.scale.setScalar(0.7 + rand() * 0.35);
    fishGroup.add(fish);
    fishList.push({ fish, phase: rand() * 6, baseY: fish.position.y, baseX: fish.position.x, baseZ: fish.position.z });
  }
  addLabel(group, '鱼群', [6.0, -1.85, 0.5], {
    color: '#dff4ff',
    fontSize: 24,
    scale: 0.0056,
    bg: 'rgba(4, 12, 18, 0.65)',
    padding: 7,
  });

  const echoCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(6.0, -3.4, 0.5),
    new THREE.Vector3(3.2, -1.6, 0.4),
    new THREE.Vector3(0.3, -0.55, 0)
  );
  const echo = sphere(0.1, '#ffffff', { emissive: '#ffffff', emissiveIntensity: 2 });
  group.add(echo);
  addLabel(group, '回声', [3.4, -1.15, 0.7], {
    color: cyan,
    fontSize: 21,
    scale: 0.005,
  });

  const screenTexture = createCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#040c0e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(91, 231, 255, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.92, i * 100, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i += 1) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.92);
      ctx.lineTo(w / 2 + Math.cos(a) * 460, h * 0.92 + Math.sin(a) * 460);
      ctx.strokeStyle = 'rgba(91, 231, 255, 0.14)';
      ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(w / 2, h * 0.92, 20, w / 2, h * 0.92, 330);
    gradient.addColorStop(0, 'rgba(91, 231, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(91, 231, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(126, 240, 176, 0.85)';
    for (let i = 0; i < 8; i += 1) {
      const a = Math.PI * 1.15 + (i / 8) * Math.PI * 0.7;
      const r = 150 + (i % 3) * 65;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * r, h * 0.92 + Math.sin(a) * r, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#9fe8ff';
    ctx.font = '500 30px "Cascadia Code", Consolas, monospace';
    ctx.fillText('DEPTH 24.6 m', 28, 44);
    ctx.fillStyle = 'rgba(126, 240, 176, 0.9)';
    ctx.fillText('FISH SCHOOL', 28, 84);
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 3.0),
    new THREE.MeshBasicMaterial({ map: screenTexture, transparent: true, toneMapped: false })
  );
  screen.scale.setScalar(0.8);
  screen.position.set(5.7, 1.65, 3.9);
  screen.rotation.y = -0.32;
  group.add(screen);
  const screenFrame = box(2.7, 2.7, 0.14, '#0a1c28', { metalness: 0.5, roughness: 0.4 });
  screenFrame.position.set(5.7, 1.65, 3.82);
  screenFrame.rotation.y = -0.32;
  group.add(screenFrame);
  addLabel(group, '探鱼仪', [5.7, 0.1, 3.9], {
    color: cyan,
    fontSize: 22,
    scale: 0.0052,
    bg: 'rgba(4, 10, 16, 0.7)',
    border: 'rgba(91, 231, 255, 0.26)',
    padding: 6,
  });

  addLabel(group, 's = v · t / 2（v ≈ 1500 m/s）', [0.3, -7.1, 4.8], {
    color: 'rgba(180, 215, 240, 0.75)',
    fontSize: 24,
    scale: 0.0056,
    bg: 'rgba(4, 8, 14, 0.6)',
    padding: 8,
  });

  addGlow(group, '#0d3f56', 18, [0, -2, -7], 0.24);

  return {
    group,
    view: { position: [10.4, 3.2, 13.2], target: [1.2, -1.0, 0] },
    autoRotateSpeed: 0.12,
    update(time, dt) {
      const positions = surfaceGeo.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = surfaceBase[i];
        const y = surfaceBase[i + 1];
        positions[i + 2] = Math.sin(x * 0.7 + time * 1.2) * 0.04 + Math.cos(y * 0.9 + time * 0.9) * 0.03;
      }
      surfaceGeo.attributes.position.needsUpdate = true;
      boat.position.y = 0.25 + Math.sin(time * 0.8) * 0.06;
      boat.rotation.z = Math.sin(time * 0.55) * 0.01;

      fishGroup.position.x = 6.0 + Math.sin(time * 0.3) * 0.4;
      fishGroup.position.y = -3.4 + Math.sin(time * 0.65) * 0.18;
      fishList.forEach((f) => {
        f.fish.position.y = f.baseY + Math.sin(time * 1.2 + f.phase) * 0.12;
        f.fish.position.x = f.baseX + Math.cos(time * 0.9 + f.phase) * 0.12;
        f.fish.rotation.z = Math.sin(time * 2 + f.phase) * 0.1;
      });

      const cycle = (time * 0.28) % 1;
      waveRings.forEach((w) => {
        const u = (cycle + w.offset) % 1;
        const scale = 0.4 + u * 5.6;
        w.ring.scale.set(scale, 1, scale * 0.78);
        const line = w.ring.children[0];
        if (line?.material) line.material.opacity = Math.sin(Math.PI * u) * 0.28;
      });
      const echoPhase = Math.max(0, (cycle - 0.62) / 0.38);
      echo.position.copy(echoCurve.getPointAt(echoPhase));
      echo.material.opacity = echoPhase > 0 && echoPhase < 1 ? Math.sin(Math.PI * echoPhase) : 0;
      echo.scale.setScalar(1 + Math.sin(echoPhase * Math.PI) * 0.6);
      fishList.forEach((f) => {
        const glow = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (cycle - 0.5) / 0.4))));
        f.fish.children[0].material.emissiveIntensity = 0.2 + glow * 0.8;
      });
    },
  };
}
