import {
  THREE,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  makeCanvasLabelTexture,
  sphere,
  addGlow,
  ringLine,
  seeded,
  createDiceTexture,
} from './helpers.js';

export function projectile() {
  const group = new THREE.Group();
  const accent = '#5B9DFF';
  const orange = '#FF9147';

  const court = box(15, 0.08, 8.5, '#101d31', { emissiveIntensity: 0.18, roughness: 0.8 });
  court.position.y = -0.05;
  group.add(court);

  const lineColor = '#6ea0dc';
  for (let i = -3; i <= 3; i += 1) {
    addLine(group, [[-7.2, 0.02, i], [7.2, 0.02, i]], lineColor, 0.16);
    addLine(group, [[i * 2, 0.02, -4.1], [i * 2, 0.02, 4.1]], lineColor, 0.12);
  }

  const backboard = box(0.08, 1.12, 1.85, '#cfe8ff', {
    transparent: true,
    opacity: 0.16,
    emissive: '#9fd8ff',
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  backboard.position.set(6.62, 3.64, 0);
  group.add(backboard);

  addLine(
    group,
    [
      [6.57, 3.08, -0.925],
      [6.57, 3.08, 0.925],
      [6.57, 4.2, 0.925],
      [6.57, 4.2, -0.925],
      [6.57, 3.08, -0.925],
    ],
    '#bfe6ff',
    0.75
  );

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.024, 8, 48),
    new THREE.MeshBasicMaterial({ color: orange, toneMapped: false })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(6.36, 3.06, 0);
  group.add(rim);

  const support = cylinder(0.07, 0.09, 3.4, '#35465a', { metalness: 0.55, roughness: 0.4 });
  support.position.set(6.82, 1.7, 0);
  group.add(support);
  const supportBase = box(1.4, 0.14, 2.0, '#233043', { metalness: 0.4, roughness: 0.55 });
  supportBase.position.set(6.82, 0.02, 0);
  group.add(supportBase);

  addLine(group, [[4.6, 0.025, -1.25], [6.6, 0.025, -1.25], [6.6, 0.025, 1.25], [4.6, 0.025, 1.25], [4.6, 0.025, -1.25]], '#e0804a', 0.35);
  const keyArc = [];
  for (let i = 0; i <= 30; i += 1) {
    const a = (i / 30) * Math.PI * 2;
    keyArc.push([4.6 + Math.cos(a) * 1.25, 0.025, Math.sin(a) * 1.25]);
  }
  addLine(group, keyArc, '#e0804a', 0.25);

  const player = new THREE.Group();
  player.position.set(-6.35, 0, 0);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.52, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#1d2c42', roughness: 0.8 })
  );
  torso.position.y = 1.2;
  const head = sphere(0.16, '#d6a178', { roughness: 0.8 });
  head.position.y = 1.72;
  const arm = cylinder(0.055, 0.055, 0.62, '#d6a178', { roughness: 0.8 });
  arm.position.set(0.25, 1.6, 0);
  arm.rotation.z = -1.05;
  const jersey = box(0.34, 0.44, 0.25, '#e0713f', { roughness: 0.8 });
  jersey.position.y = 1.16;
  const legL = cylinder(0.065, 0.065, 0.82, '#24334a', { roughness: 0.8 });
  legL.position.set(-0.09, 0.42, 0.06);
  const legR = legL.clone();
  legR.position.z = -0.06;
  player.add(torso, head, arm, jersey, legL, legR);
  player.rotation.y = 0.02;
  group.add(player);
  addLabel(group, '出手点', [-6.3, 3.15, 0], {
    color: '#ffbe83',
    fontSize: 23,
    scale: 0.0058,
  });

  const netMaterial = new THREE.LineBasicMaterial({
    color: 0xc8dcf2,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const top = new THREE.Vector3(6.36 + Math.cos(a) * 0.27, 3.05, Math.sin(a) * 0.27);
    const bottom = new THREE.Vector3(6.36 + Math.cos(a) * 0.16, 2.56, Math.sin(a) * 0.16);
    const geom = new THREE.BufferGeometry().setFromPoints([top, bottom]);
    group.add(new THREE.Line(geom, netMaterial));
  }

  const g = 9.8;
  const angle = THREE.MathUtils.degToRad(52);
  const x0 = -6.1;
  const y0 = 1.85;
  const xEnd = 6.36;
  const yEnd = 3.06;
  const dx = xEnd - x0;
  const dy = yEnd - y0;
  const v2 = (g * dx * dx) / (2 * Math.cos(angle) ** 2 * (dx * Math.tan(angle) - dy));
  const v = Math.sqrt(v2);
  const vx = v * Math.cos(angle);
  const vy = v * Math.sin(angle);
  const duration = dx / vx;

  const path = [];
  let apex = null;
  for (let i = 0; i <= 70; i += 1) {
    const t = (i / 70) * duration;
    const p = new THREE.Vector3(x0 + vx * t, y0 + vy * t - 0.5 * g * t * t, 0);
    path.push(p);
    if (!apex || p.y > apex.y) apex = p;
  }
  addTube(group, path, accent, 0.016, 0.55);

  for (let i = 3; i < path.length - 2; i += 7) {
    const dot = sphere(0.035, '#bfe4ff', { emissiveIntensity: 1.2 });
    dot.position.copy(path[i]);
    group.add(dot);
  }

  const ball = sphere(0.14, orange, { emissive: '#ff6b2c', emissiveIntensity: 0.55, roughness: 0.5 });
  ball.position.set(x0, y0, 0);
  group.add(ball);
  addGlow(group, orange, 0.7, [x0, y0, 0], 0.3);

  const apexMark = sphere(0.05, '#ffffff', { emissiveIntensity: 1.5 });
  apexMark.position.copy(apex);
  group.add(apexMark);

  addLabel(group, '最高点', [apex.x, apex.y + 0.42, 0], {
    fontSize: 28,
    scale: 0.0065,
    color: '#cfe8ff',
    bg: 'rgba(4, 8, 16, 0.72)',
    border: 'rgba(91, 157, 255, 0.4)',
  });
  addLabel(group, '出手角 52°', [x0 + 0.9, y0 + 0.68, 0], {
    fontSize: 30,
    scale: 0.0068,
    color: '#9bc8ff',
  });
  addLabel(group, '篮筐', [6.36, 2.35, 0], {
    fontSize: 28,
    scale: 0.0065,
    color: '#ffb27a',
  });

  const floorCurve = path.map((p) => new THREE.Vector3(p.x, 0.015, p.z));
  addLine(group, floorCurve, accent, 0.14);

  return {
    group,
    view: { position: [0.5, 5.6, 14.5], target: [0.8, 2.4, 0] },
    autoRotate: false,
    update(time) {
      const loop = (time * 0.92) % (duration + 1.45);
      if (loop <= duration) {
        const t = loop;
        ball.visible = true;
        ball.position.set(x0 + vx * t, y0 + vy * t - 0.5 * g * t * t, 0);
        ball.rotation.z -= 0.055;
        ball.rotation.x += 0.03;
      } else {
        ball.visible = false;
      }
      apexMark.scale.setScalar(1 + Math.sin(time * 3.2) * 0.18);
    },
  };
}

export function golden() {
  const group = new THREE.Group();
  const gold = '#FFD37A';

  const width = 8.2;
  const height = width / 1.618;

  const frameMat = new THREE.MeshBasicMaterial({
    color: gold,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
  });
  const edge = 0.035;
  const rectFrame = (x, y, w, h, opacity = 0.7) => {
    const mat = frameMat.clone();
    mat.opacity = opacity;
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, edge, edge * 2), mat);
    top.position.set(x + w / 2, y + h, 0);
    const bottom = top.clone();
    bottom.position.y = y;
    const left = new THREE.Mesh(new THREE.BoxGeometry(edge, h, edge * 2), mat);
    left.position.set(x, y + h / 2, 0);
    const right = left.clone();
    right.position.x = x + w;
    g.add(top, bottom, left, right);
    return g;
  };

  let x = -width / 2;
  let y = -height / 2;
  let w = width;
  let h = height;
  const squares = [];
  for (let i = 0; i < 7; i += 1) {
    if (i % 4 === 0) {
      squares.push({ x, y, w: h, h, side: 'left' });
      x += h;
      w -= h;
    } else if (i % 4 === 1) {
      squares.push({ x, y, w, h: w, side: 'bottom' });
      y += w;
      h -= w;
    } else if (i % 4 === 2) {
      squares.push({ x: x + w - h, y, w: h, h, side: 'right' });
      w -= h;
    } else {
      squares.push({ x, y: y + h - w, w, h: w, side: 'top' });
      h -= w;
    }
  }

  group.add(rectFrame(-width / 2, -height / 2, width, height, 0.9));
  squares.forEach((s, i) => {
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#2c3f68' : '#1b2a47',
        transparent: true,
        opacity: 0.18 + (i % 3) * 0.04,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    fill.position.set(s.x + s.w / 2, s.y + s.h / 2, -0.01 - i * 0.006);
    group.add(fill);
    if (i > 0) group.add(rectFrame(s.x, s.y, s.w, s.h, 0.18 + i * 0.05));
  });

  const spiral = [];
  const center = new THREE.Vector3(0.55, -0.2, 0.04);
  for (let i = 0; i <= 220; i += 1) {
    const theta = (i / 220) * Math.PI * 4.4;
    const r = 0.038 * Math.exp(0.30635 * theta);
    spiral.push(new THREE.Vector3(center.x + Math.cos(theta) * r, center.y + Math.sin(theta) * r, 0.04));
  }
  addTube(group, spiral, gold, 0.022, 0.95);
  const spiralTip = sphere(0.07, '#fff4cf', { emissiveIntensity: 1.6 });
  spiralTip.position.copy(spiral[spiral.length - 1]);
  group.add(spiralTip);

  addLabel(group, '1.618', [0, height / 2 + 0.48, 0], {
    color: gold,
    fontSize: 34,
    scale: 0.0075,
    letterSpacing: 2,
  });
  addLabel(group, '1', [-width / 2 - 0.42, 0, 0], {
    color: 'rgba(255, 211, 122, 0.7)',
    fontSize: 26,
    scale: 0.007,
  });
  addLabel(group, '黄金矩形', [0, -height / 2 - 0.52, 0], {
    color: '#d9e6ff',
    fontSize: 30,
    scale: 0.0068,
    bg: 'rgba(4, 8, 16, 0.6)',
    border: 'rgba(255, 211, 122, 0.3)',
    padding: 10,
  });

  const seedCount = 260;
  const seedPositions = new Float32Array(seedCount * 3);
  for (let i = 0; i < seedCount; i += 1) {
    const angle = i * THREE.MathUtils.degToRad(137.5077);
    const r = 0.31 * Math.sqrt(i);
    seedPositions[i * 3] = Math.cos(angle) * r + 4.4;
    seedPositions[i * 3 + 1] = Math.sin(angle) * r - 0.6;
    seedPositions[i * 3 + 2] = -2.2;
  }
  const seedGeo = new THREE.BufferGeometry();
  seedGeo.setAttribute('position', new THREE.BufferAttribute(seedPositions, 3));
  const seeds = new THREE.Points(
    seedGeo,
    new THREE.PointsMaterial({
      color: gold,
      size: 0.06,
      transparent: true,
      opacity: 0.52,
      map: null,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
  );
  group.add(seeds);
  addLabel(group, '黄金角 137.5°', [4.5, -2.25, 0], {
    color: 'rgba(255, 211, 122, 0.7)',
    fontSize: 25,
    scale: 0.0062,
  });

  addGlow(group, '#b88b3d', 8, [0, 0, -2.5], 0.16);
  group.rotation.y = -0.08;

  return {
    group,
    view: { position: [0.5, 0.6, 14.5], target: [0.9, 0, 0] },
    autoRotate: false,
    update(time) {
      group.rotation.y = -0.08 + Math.sin(time * 0.35) * 0.045;
      spiralTip.scale.setScalar(1 + Math.sin(time * 2.4) * 0.2);
      seeds.material.opacity = 0.4 + Math.sin(time * 0.8) * 0.12;
    },
  };
}

export function probability() {
  const group = new THREE.Group();
  const accent = '#5B9DFF';
  const gold = '#FFD37A';
  const rand = seeded(9527);

  const floor = box(14, 0.08, 9, '#0b1628', { emissiveIntensity: 0.15, roughness: 0.85 });
  floor.position.set(0, -0.05, -0.4);
  group.add(floor);

  const faces = [3, 4, 1, 6, 2, 5];
  const makeDie = (x, z, rot) => {
    const materials = faces.map((value) =>
      new THREE.MeshStandardMaterial({
        map: createDiceTexture(value, '#f1f7ff', '#132034'),
        roughness: 0.52,
        emissive: '#cfd9e8',
        emissiveIntensity: 0.08,
      })
    );
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), materials);
    die.position.set(x, 0.48, z);
    die.rotation.set(rot, rot * 1.7, rot * 0.6);
    group.add(die);
    return die;
  };

  const dieA = makeDie(1.55, 1.9, 0.2);
  const dieB = makeDie(3.05, 1.15, 0.7);
  addLabel(group, '2d6', [2.3, 1.7, 2.5], {
    color: gold,
    fontSize: 34,
    scale: 0.0072,
    bg: 'rgba(6, 10, 20, 0.65)',
    border: 'rgba(255, 211, 122, 0.28)',
    padding: 10,
  });

  const counts = new Array(13).fill(0);
  const totals = new Array(13).fill(0);
  const weights = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
  for (let value = 2; value <= 12; value += 1) {
    totals[value] = weights[value] * 48;
    counts[value] = totals[value];
  }
  const barGroup = new THREE.Group();
  barGroup.position.set(-0.35, 0, -2.9);
  group.add(barGroup);
  const bars = [];
  const maxHeight = 2.75;
  for (let value = 2; value <= 12; value += 1) {
    const x = (value - 7) * 0.62;
    const h = 0.06;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, h, 0.38),
      new THREE.MeshStandardMaterial({
        color: value === 7 ? gold : accent,
        emissive: value === 7 ? gold : accent,
        emissiveIntensity: value === 7 ? 0.75 : 0.32,
        roughness: 0.38,
        transparent: true,
        opacity: 0.92,
      })
    );
    bar.position.set(x, h / 2, 0);
    barGroup.add(bar);
    bars.push({ value, bar, x, h });
    if (value === 2 || value === 7 || value === 12) {
      addLabel(group, String(value), [-0.35 + x, 0.28, -3.25], {
        color: 'rgba(190, 215, 245, 0.78)',
        fontSize: 23,
        scale: 0.006,
      });
    }
  }

  addLabel(group, '大量重复试验：频率趋近概率', [-0.2, 4.9, -2.6], {
    color: '#cfe3ff',
    fontSize: 27,
    scale: 0.0063,
  });

  const p7 = addLabel(group, 'P(7) = 6 / 36 ≈ 16.7%', [-0.2, 4.3, -2.4], {
    color: gold,
    fontSize: 31,
    scale: 0.0068,
    bg: 'rgba(5, 10, 18, 0.7)',
    border: 'rgba(255, 211, 122, 0.35)',
    padding: 10,
    glow: 14,
    glowColor: gold,
  });

  addLabel(group, '掷两颗骰子，点数之和的分布', [0.8, 0.35, 3.0], {
    color: 'rgba(190, 215, 245, 0.72)',
    fontSize: 25,
    scale: 0.006,
  });

  let rollTimer = 0;
  let phase = 'idle';
  let tumbling = 0;
  const startRoll = () => {
    phase = 'rolling';
    tumbling = 0;
    const a = Math.ceil(rand() * 6);
    const b = Math.ceil(rand() * 6);
    dieA.userData.result = a;
    dieB.userData.result = b;
    counts[a + b] += 1;
    totals[a + b] += 1;
  };
  startRoll();

  return {
    group,
    view: { position: [1.4, 5.8, 12.4], target: [0.4, 1.5, -0.6] },
    autoRotate: false,
    update(time, dt) {
      rollTimer += dt;
      if (phase === 'idle' && rollTimer > 0.85) {
        rollTimer = 0;
        startRoll();
      }
      if (phase === 'rolling') {
        tumbling += dt;
        dieA.rotation.x += dt * 10;
        dieA.rotation.y += dt * 7;
        dieB.rotation.x += dt * 8;
        dieB.rotation.z += dt * 11;
        dieA.position.y = 0.48 + Math.abs(Math.sin(tumbling * 9)) * 0.24;
        dieB.position.y = 0.48 + Math.abs(Math.cos(tumbling * 8)) * 0.2;
        if (tumbling > 0.75) {
          phase = 'idle';
          dieA.position.y = 0.48;
          dieB.position.y = 0.48;
          dieA.rotation.set(0.4, 0.6, 0.1);
          dieB.rotation.set(-0.2, 1.1, 0.3);
        }
      }
      const max = Math.max(1, ...totals.slice(2));
      for (const item of bars) {
        const target = Math.max(0.06, (totals[item.value] / max) * maxHeight);
        item.h += (target - item.h) * Math.min(1, dt * 4.5);
        item.bar.scale.y = item.h / 0.06;
        item.bar.position.y = item.h / 2;
      }
      p7.material.opacity = 0.75 + Math.sin(time * 2) * 0.22;
    },
  };
}
