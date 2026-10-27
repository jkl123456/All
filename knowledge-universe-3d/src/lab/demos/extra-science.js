/**
 * 扩充知识点的三维案例（理科 / 行业）
 * 每个函数都尽量用真实几何关系搭场景：可旋转、有动画、有标注。
 */
import {
  THREE,
  addArrow,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cone,
  cylinder,
  glyphPlane,
  material,
  ringLine,
  seeded,
  sphere,
  torus,
} from './helpers.js';

function floorPlate(group, color = '#7fb0ff', radius = 6.4) {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    material('#0a1220', { emissive: '#050b14', emissiveIntensity: 0.4, roughness: 0.85 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.9;
  group.add(disc);
  const ring = ringLine(radius * 0.92, color, 0.28, 96);
  ring.position.y = -1.88;
  group.add(ring);
  return disc;
}

function axisLine(group, from, to, color = '#7fb0ff', opacity = 0.4) {
  return addLine(group, [from, to], color, opacity);
}

/* -------------------------------- 勾股定理 -------------------------------- */
export function pythagoras() {
  const group = new THREE.Group();
  const accent = '#5B9DFF';
  const warm = '#FFD37A';

  const a = 3.0;
  const b = 4.0;
  const A = new THREE.Vector3(-b / 2, -a / 2 + 0.2, 0);
  const B = new THREE.Vector3(b / 2, -a / 2 + 0.2, 0);
  const C = new THREE.Vector3(-b / 2, a / 2 + 0.2, 0);
  const leg = (p, q, color) => {
    const dir = new THREE.Vector3().subVectors(q, p);
    const bar = box(dir.length(), 0.15, 0.15, color, { emissiveIntensity: 1.3 });
    bar.position.copy(p).add(q).multiplyScalar(0.5);
    bar.rotation.z = Math.atan2(dir.y, dir.x);
    group.add(bar);
  };
  leg(A, B, accent);
  leg(A, C, '#9B7BFF');
  leg(C, B, warm);

  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.Float32BufferAttribute([A.x, A.y, 0, B.x, B.y, 0, C.x, C.y, 0], 3));
  triGeo.computeVertexNormals();
  const triFill = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: '#1d3550', transparent: true, opacity: 0.98, side: THREE.DoubleSide }));
  triFill.position.z = -0.02;
  group.add(triFill);

  const square = (w, h, x, y, color, opacity = 0.2) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, 0);
    group.add(mesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    edges.position.set(x, y, 0);
    group.add(edges);
    return mesh;
  };
  square(a, a, A.x - a / 2, A.y + a / 2, '#9B7BFF');
  square(b, b, A.x + b / 2, A.y - b / 2, accent);
  const c = Math.hypot(a, b);
  const diag = new THREE.Group();
  const dx = B.x - C.x;
  const dy = B.y - C.y;
  const len = Math.hypot(dx, dy);
  let nx = -dy / len;
  let ny = dx / len;
  const toA = new THREE.Vector3(A.x - (B.x + C.x) / 2, A.y - (B.y + C.y) / 2, 0);
  if (nx * toA.x + ny * toA.y > 0) { nx = -nx; ny = -ny; }
  diag.position.set((B.x + C.x) / 2 + nx * (c / 2), (B.y + C.y) / 2 + ny * (c / 2), 0);
  diag.rotation.z = Math.atan2(dy, dx);
  const sq = square(c, c, 0, 0, warm, 0.16);
  diag.add(sq);
  group.add(diag);

  addLabel(group, 'a', [A.x - 0.55, A.y + a / 2, 0.14], { fontSize: 22, scale: 0.0046, color: '#c5b0ff' });
  addLabel(group, 'b', [A.x + b / 2, A.y - 0.55, 0.14], { fontSize: 22, scale: 0.0046, color: '#9fd0ff' });
  addLabel(group, 'c', [A.x + b / 2 + 0.5, A.y - a / 2 + 0.6, 0.14], { fontSize: 22, scale: 0.0046, color: '#ffe9bd' });
  addLabel(group, 'a²', [A.x - a / 2, A.y + a / 2, 0.1], { fontSize: 26, scale: 0.0055, color: '#c5b0ff' });
  addLabel(group, 'b²', [A.x + b / 2, A.y - b / 2, 0.1], { fontSize: 26, scale: 0.0055, color: '#9fd0ff' });
  addLabel(group, 'a² + b² = c²', [0, a / 2 + 1.4, 0], {
    fontSize: 30, scale: 0.006, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.5)', padding: 12,
  });

  group.scale.setScalar(0.9);
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: '#060b14', transparent: true, opacity: 0.72 })
  );
  back.position.set(0.5, 0.8, -0.45);
  group.add(back);
  return {
    group,
    view: { position: [0.4, 1.0, 18.4], target: [0.2, -0.4, 0] },
    autoRotate: false,
    update(time) {
      group.rotation.y = Math.sin(time * 0.18) * 0.06;
    },
  };
}

/* ------------------------------- 斐波那契 -------------------------------- */
export function fibonacci() {
  const group = new THREE.Group();
  const accent = '#5B9DFF';
  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = 260;
  const geo = new THREE.SphereGeometry(0.075, 8, 6);
  const mesh = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#8fc4ff', emissive: '#3f7ed8', emissiveIntensity: 0.7, roughness: 0.4 }),
    count
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i += 1) {
    const r = Math.sqrt(i) * 0.22;
    const a = i * golden;
    m.makeTranslation(Math.cos(a) * r, -1.4, Math.sin(a) * r);
    mesh.setMatrixAt(i, m);
  }
  group.add(mesh);

  const pts = [];
  for (let i = 0; i <= 300; i += 1) {
    const th = (i / 300) * Math.PI * 4.6;
    const r = 0.34 * Math.exp(0.306 * th);
    if (r > 4.6) break;
    pts.push(new THREE.Vector3(Math.cos(th) * r, -1.32, Math.sin(th) * r));
  }
  const spiral = addTube(group, pts, '#FFD37A', 0.022, 0.85);
  spiral.material.emissiveIntensity = 1.2;

  addLabel(group, '1 · 1 · 2 · 3 · 5 · 8 · 13', [0, 1.9, 0], {
    fontSize: 30, scale: 0.006, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.45)', padding: 12,
  });
  addLabel(group, '相邻之比 → φ ≈ 1.618', [0, 1.45, 0], { fontSize: 20, scale: 0.0048, color: 'rgba(190,214,245,0.85)' });

  return {
    group,
    view: { position: [0, 7.4, 9.2], target: [0, -1.2, 0] },
    autoRotateSpeed: 0.2,
    update(time) {
      mesh.rotation.y = time * 0.06;
      spiral.rotation.y = time * 0.06;
    },
  };
}

/* -------------------------------- 微积分 --------------------------------- */
export function calculus() {
  const group = new THREE.Group();
  const accent = '#5B9DFF';
  floorPlate(group, accent, 6.2);
  axisLine(group, [-5, -1.85, 0], [5, -1.85, 0], '#5c7fae');
  axisLine(group, [-4.6, -1.85, 0], [-4.6, 3.4, 0], '#5c7fae');

  const f = (x) => 0.28 * x * x - 1.6;
  const pts = [];
  for (let i = 0; i <= 90; i += 1) {
    const x = -4.2 + (i / 90) * 8.4;
    pts.push(new THREE.Vector3(x, f(x), 0));
  }
  addTube(group, pts, accent, 0.035, 0.95);

  const dot = sphere(0.16, '#fffdf4', { emissive: '#ffffff', emissiveIntensity: 1.2 });
  group.add(dot);
  const dotGlow = addGlow(group, accent, 1.8, [0, 0, 0], 0.5);
  const tangent = box(3.4, 0.03, 0.03, '#FFD37A', { emissiveIntensity: 1.2 });
  group.add(tangent);
  const secant = box(3.4, 0.02, 0.02, '#FF8E6B', { emissiveIntensity: 0.9 });
  secant.material.transparent = true;
  secant.material.opacity = 0.75;
  group.add(secant);
  const slope = addLabel(group, '切线斜率 = 导数', [0, 2.9, 0], {
    fontSize: 24, scale: 0.0052, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.45)', padding: 10,
  });

  return {
    group,
    view: { position: [0.5, 1.4, 10.5], target: [0, 0.2, 0] },
    autoRotate: false,
    update(time) {
      const x = Math.sin(time * 0.55) * 3.1;
      const y = f(x);
      dot.position.set(x, y, 0);
      dotGlow.position.set(x, y, 0);
      const k = 0.56 * x;
      const ang = Math.atan(k);
      tangent.position.set(x, y, 0);
      tangent.rotation.z = ang;
      const h = 1.1 + Math.sin(time * 0.9) * 0.55;
      const x2 = x + h;
      const k2 = (f(x2) - f(x)) / h;
      secant.position.set((x + x2) / 2, (f(x) + f(x2)) / 2, 0);
      secant.rotation.z = Math.atan(k2);
      slope.position.set(x, y + 0.7, 0);
    },
  };
}

/* --------------------------------- 杠杆 ---------------------------------- */
export function lever() {
  const group = new THREE.Group();
  const accent = '#9B7BFF';
  floorPlate(group, accent, 5.6);

  const pivot = cone(0.34, 1.2, '#33465f', { metalness: 0.5, roughness: 0.4 });
  pivot.position.set(0, -1.3, 0);
  group.add(pivot);
  const beam = new THREE.Group();
  beam.position.set(0, -0.62, 0);
  const bar = box(8.4, 0.18, 0.34, '#6b4f33', { roughness: 0.8, emissiveIntensity: 0.15 });
  beam.add(bar);
  group.add(beam);

  const weightA = box(0.9, 0.9, 0.9, '#FF8E6B', { emissiveIntensity: 0.5 });
  const weightB = box(0.6, 0.6, 0.6, '#6BE7FF', { emissiveIntensity: 0.5 });
  group.add(weightA, weightB);
  addLabel(group, 'F₁ · L₁', [-2.3, 1.5, 0], { fontSize: 22, scale: 0.005, color: '#ffb69c' });
  addLabel(group, 'F₂ · L₂', [2.3, 1.5, 0], { fontSize: 22, scale: 0.005, color: '#9fe9ff' });
  const formula = addLabel(group, 'F₁L₁ = F₂L₂', [0, 2.6, 0], {
    fontSize: 28, scale: 0.0058, color: '#ffe9bd', bg: 'rgba(6,11,20,0.8)', border: 'rgba(255,211,122,0.45)', padding: 11,
  });

  let tilt = 0;
  return {
    group,
    view: { position: [0, 2.4, 11.4], target: [0, -0.4, 0] },
    autoRotateSpeed: 0.22,
    update(time, dt) {
      const targetTilt = Math.sin(time * 0.6) * 0.13;
      tilt += (targetTilt - tilt) * Math.min(1, dt * 3);
      beam.rotation.z = tilt;
      const left = 1.6 + Math.sin(time * 0.5) * 1.4;
      const right = 1.0;
      weightA.position.set(-left * Math.cos(tilt), -0.62 + left * Math.sin(tilt) + 0.46, 0);
      weightB.position.set(right * Math.cos(tilt), -0.62 - right * Math.sin(tilt) + 0.32, 0);
      // 力矩平衡：左轻则更远
      void formula;
    },
  };
}

/* -------------------------------- 光的折射 -------------------------------- */
export function refraction() {
  const group = new THREE.Group();
  const water = box(7.4, 0.02, 6, '#5BE7FF', { transparent: true, opacity: 0.16, emissiveIntensity: 0.5 });
  water.position.y = -1.25;
  group.add(water);
  const body = box(7.4, 2.1, 6, '#2a9fd6', { transparent: true, opacity: 0.12, emissive: '#1d5f86', emissiveIntensity: 0.4 });
  body.position.y = -0.2;
  group.add(body);

  const n1 = 1;
  const n2 = 1.33;
  const theta1 = 0.78;
  const theta2 = Math.asin((n1 * Math.sin(theta1)) / n2);
  const surface = -1.25;
  const origin = new THREE.Vector3(0, surface, 0);
  const inStart = new THREE.Vector3(-Math.sin(theta1) * 4.2, surface + Math.cos(theta1) * 4.2, 0);
  addTube(group, [inStart, origin], '#FFD37A', 0.028, 0.95);
  const outEnd = new THREE.Vector3(Math.sin(theta2) * 3.0, surface - Math.cos(theta2) * 3.0, 0);
  addTube(group, [origin, outEnd], '#6BE7FF', 0.028, 0.95);
  addLine(group, [[0, 3.0, 0], [0, -3.2, 0]], '#9fb6d4', 0.28);
  addLine(group, [[-4.2, surface, 0], [4.2, surface, 0]], '#9fb6d4', 0.2);

  const photon = sphere(0.09, '#fffdf4', { emissive: '#ffffff', emissiveIntensity: 1.4 });
  group.add(photon);
  addLabel(group, 'θ₁', [-0.85, surface - 0.6, 0], { fontSize: 20, scale: 0.0048, color: '#ffe9bd' });
  addLabel(group, 'θ₂', [0.9, surface + 0.55, 0], { fontSize: 20, scale: 0.0048, color: '#9fe9ff' });
  addLabel(group, '空气 n₁ = 1.00', [-2.7, 3.0, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(200,220,245,0.85)' });
  addLabel(group, '水 n₂ = 1.33', [-2.7, -2.6, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(150,225,255,0.9)' });

  return {
    group,
    view: { position: [0, 0.8, 12.5], target: [0, 0.1, 0] },
    autoRotate: false,
    update(time) {
      const t = (time * 0.42) % 1;
      if (t < 0.5) {
        const u = t * 2;
        photon.position.set(
          inStart.x + (origin.x - inStart.x) * u,
          inStart.y + (origin.y - inStart.y) * u,
          0
        );
      } else {
        const u = (t - 0.5) * 2;
        photon.position.set(origin.x + (outEnd.x - origin.x) * u, origin.y + (outEnd.y - origin.y) * u, 0);
      }
    },
  };
}

/* --------------------------------- 溶解 ---------------------------------- */
export function dissolve() {
  const group = new THREE.Group();
  const accent = '#2FE0A8';
  const beaker = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.0, 3.6, 40, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: '#9fdcff', transparent: true, opacity: 0.14, roughness: 0.1, metalness: 0,
      side: THREE.DoubleSide, transmission: 0.4,
    })
  );
  beaker.position.y = -0.2;
  group.add(beaker);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(2.02, 1.96, 2.5, 40),
    new THREE.MeshPhysicalMaterial({ color: '#2a9fd6', transparent: true, opacity: 0.3, roughness: 0.2 })
  );
  water.position.y = -0.75;
  group.add(water);

  const cube = box(0.8, 0.8, 0.8, '#f4fbff', { transparent: true, opacity: 0.9, roughness: 0.4, emissive: '#bfe9ff', emissiveIntensity: 0.25 });
  cube.position.set(0, -1.2, 0);
  group.add(cube);

  const grains = makeGrain(80);
  group.add(grains);
  addLabel(group, '糖在水中分散成分子', [0, 2.0, 0], {
    fontSize: 22, scale: 0.005, color: 'rgba(210,240,255,0.9)',
  });

  return {
    group,
    view: { position: [0, 1.2, 9.2], target: [0, -0.2, 0] },
    autoRotateSpeed: 0.24,
    update(time, dt) {
      const cycle = (time * 0.16) % 1;
      const d = Math.min(1, cycle * 1.6);
      cube.scale.setScalar(Math.max(0.001, 1 - d));
      cube.rotation.y = time * 0.4;
      cube.material.opacity = 0.9 * (1 - d);
      const arr = grains.geometry.attributes.position.array;
      for (let i = 0; i < arr.length / 3; i += 1) {
        const r = ((i * 37) % 100) / 100;
        const a = i * 2.4 + time * 0.32;
        const radius = 0.2 + d * (0.5 + r * 1.5);
        arr[i * 3] = Math.cos(a) * radius * (0.5 + r);
        arr[i * 3 + 1] = -1.2 + Math.sin(time * 0.6 + i) * 0.4 + d * (r - 0.3) * 2.2;
        arr[i * 3 + 2] = Math.sin(a) * radius * (0.5 + r);
      }
      grains.geometry.attributes.position.needsUpdate = true;
      grains.material.opacity = 0.25 + d * 0.55;
      void dt;
    },
  };
}

function makeGrain(count) {
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: new THREE.Color('#eaf8ff'), size: 0.08, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  points.frustumCulled = false;
  return points;
}

/* --------------------------------- 酸碱 ---------------------------------- */
export function ph() {
  const group = new THREE.Group();
  const beaker = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.6, 3.2, 36, 1, true),
    new THREE.MeshPhysicalMaterial({ color: '#a7d8f0', transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  beaker.position.y = -0.5;
  group.add(beaker);
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(1.58, 1.52, 2.0, 36),
    new THREE.MeshStandardMaterial({ color: '#FF6B5C', emissive: '#FF6B5C', emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
  );
  liquid.position.y = -1.0;
  group.add(liquid);

  const bar = new THREE.Group();
  bar.position.set(4.6, 0.4, -1.2);
  bar.rotation.y = -0.5;
  const colors = ['#FF4D4D', '#FF7A3D', '#FFB03D', '#E8D84D', '#8FE05A', '#4FD1C5', '#4F9BFF', '#7A6BFF'];
  colors.forEach((c, i) => {
    const seg = box(0.52, 2.6, 0.12, c, { emissiveIntensity: 0.55, transparent: true, opacity: 0.85 });
    seg.position.set((i - 3.5) * 0.56, 0, 0);
    bar.add(seg);
  });
  group.add(bar);
  const needle = box(0.06, 0.06, 0.9, '#fffdf4', { emissiveIntensity: 1.2 });
  needle.position.set(0, 1.6, 0.2);
  group.add(needle);
  addLabel(group, 'pH', [4.6, 2.35, -1.2], { fontSize: 26, scale: 0.0055, color: '#eaf6ff' });
  const readout = addLabel(group, 'pH 2 → 12', [0, 2.4, 0], {
    fontSize: 28, scale: 0.0058, color: '#ffe9bd', bg: 'rgba(6,11,20,0.82)', border: 'rgba(255,211,122,0.4)', padding: 10,
  });
  addLabel(group, 'H⁺ + OH⁻ → H₂O', [0, -2.35, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(190,240,225,0.85)' });

  const drops = [];
  for (let i = 0; i < 14; i += 1) {
    const d = sphere(0.06, '#bff6ff', { emissive: '#bff6ff', emissiveIntensity: 1.1, transparent: true, opacity: 0.8 });
    group.add(d);
    drops.push(d);
  }

  return {
    group,
    view: { position: [0, 1.4, 10.6], target: [1.2, 0, 0] },
    autoRotateSpeed: 0.2,
    update(time) {
      const phVal = 2 + (Math.sin(time * 0.32) * 0.5 + 0.5) * 10;
      const t = phVal / 14;
      const color = new THREE.Color().lerpColors(new THREE.Color('#FF6B5C'), new THREE.Color('#4F9BFF'), Math.min(1, t * 1.2));
      liquid.material.color.copy(color);
      liquid.material.emissive.copy(color);
      needle.position.x = -2.0 + (phVal / 14) * 4.0;
      drops.forEach((d, i) => {
        const u = (time * 0.5 + i * 0.11) % 1;
        d.position.set(Math.sin(i * 2.1) * 0.8, 1.5 - u * 3.1, Math.cos(i * 1.7) * 0.8);
        d.material.opacity = 0.2 + (1 - u) * 0.6;
      });
      void readout;
    },
  };
}

/* ------------------------------- 元素周期律 ------------------------------- */
export function periodic() {
  const group = new THREE.Group();
  const colors = ['#FF8E6B', '#FFD37A', '#6BE7FF', '#79E86B', '#B08BFF', '#9AA3B5'];
  const cells = [];
  const rand = seeded(19);
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 12; c += 1) {
      const cat = Math.floor(rand() * 6);
      const cell = box(0.62, 0.62, 0.14, colors[cat], {
        emissive: colors[cat], emissiveIntensity: 0.24, transparent: true, opacity: 0.7, roughness: 0.45,
      });
      cell.position.set((c - 5.5) * 0.72, (2.5 - r) * 0.72, 0);
      cell.userData = { r, c, cat };
      group.add(cell);
      cells.push(cell);
    }
  }
  addLabel(group, '7 周期 · 18 族', [0, 3.4, 0], {
    fontSize: 26, scale: 0.0056, color: '#eaf6ff', bg: 'rgba(6,11,20,0.8)', border: 'rgba(140,180,230,0.35)', padding: 10,
  });

  return {
    group,
    view: { position: [0, 0.8, 10.8], target: [0, 0.2, 0] },
    autoRotate: false,
    update(time) {
      const focus = Math.floor((time * 0.35) % 12);
      cells.forEach((cell) => {
        const on = cell.userData.c === focus;
        cell.material.emissiveIntensity = on ? 1.5 : 0.2;
        cell.scale.setScalar(on ? 1.14 : 1);
      });
      group.rotation.y = Math.sin(time * 0.2) * 0.16;
    },
  };
}

/* --------------------------------- 细胞 ---------------------------------- */
export function cell() {
  const group = new THREE.Group();
  const accent = '#79E86B';
  const membrane = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 40, 28),
    new THREE.MeshPhysicalMaterial({
      color: '#7ff0b8', transparent: true, opacity: 0.07, roughness: 0.25,
      side: THREE.DoubleSide, depthWrite: false, emissive: '#2a6b4a', emissiveIntensity: 0.25,
    })
  );
  group.add(membrane);
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.62, 2),
    new THREE.MeshBasicMaterial({ color: '#79E86B', wireframe: true, transparent: true, opacity: 0.12 })
  );
  group.add(wire);
  const nucleus = sphere(1.0, '#B08BFF', { emissive: '#B08BFF', emissiveIntensity: 0.65, transparent: true, opacity: 0.55, depthWrite: false });
  nucleus.position.set(0.45, 0.2, 0);
  group.add(nucleus);
  const nucleolus = sphere(0.3, '#d9c2ff', { emissive: '#d9c2ff', emissiveIntensity: 1.0 });
  nucleolus.position.set(0.62, 0.38, 0.2);
  group.add(nucleolus);

  const mitos = [];
  for (let i = 0; i < 7; i += 1) {
    const g = new THREE.Group();
    const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.5, 4, 10);
    const m = new THREE.Mesh(bodyGeo, material('#FFB86B', { emissive: '#FFB86B', emissiveIntensity: 0.45 }));
    g.add(m);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 18), material('#ffd9a0', { emissiveIntensity: 0.6 }));
    ridge.rotation.y = Math.PI / 2;
    g.add(ridge);
    const a = (i / 7) * Math.PI * 2;
    g.position.set(Math.cos(a) * 1.75, Math.sin(a) * 1.1, Math.sin(a * 1.7) * 1.35);
    g.rotation.z = a;
    group.add(g);
    mitos.push(g);
  }

  addLabel(group, '细胞膜', [-2.2, 2.0, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(190,255,190,0.9)' });
  addLabel(group, '细胞核', [1.5, 1.4, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(215,190,255,0.92)' });
  addLabel(group, '线粒体', [1.9, -1.7, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(255,210,160,0.9)' });

  return {
    group,
    view: { position: [0, 3.0, 13.6], target: [0, 0, 0] },
    autoRotateSpeed: 0.28,
    update(time) {
      wire.rotation.y = time * 0.1;
      membrane.scale.setScalar(1 + Math.sin(time * 1.1) * 0.012);
      mitos.forEach((g, i) => {
        g.position.y += Math.sin(time * 1.3 + i) * 0.0016;
      });
    },
  };
}

/* --------------------------------- 免疫 ---------------------------------- */
export function immune() {
  const group = new THREE.Group();
  const accent = '#79E86B';
  const virus = sphere(1.05, '#7a4b8f', { roughness: 0.6, emissive: '#4a2258', emissiveIntensity: 0.5 });
  group.add(virus);
  const spikes = [];
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const b = Math.sin(i * 1.7) * 0.9;
    const s = cone(0.09, 0.42, '#FF8E6B', { emissive: '#FF8E6B', emissiveIntensity: 0.4 });
    s.position.set(Math.cos(a) * 1.18, Math.sin(b) * 1.0, Math.sin(a) * 1.18);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.position.clone().normalize());
    group.add(s);
    spikes.push(s);
  }

  const antibodies = [];
  for (let i = 0; i < 3; i += 1) {
    const g = new THREE.Group();
    const stem = cylinder(0.07, 0.07, 0.62, '#6BE7FF', { emissive: '#6BE7FF', emissiveIntensity: 0.5 });
    stem.position.y = 0.31;
    g.add(stem);
    [-1, 1].forEach((dir) => {
      const arm = cylinder(0.055, 0.055, 0.5, '#6BE7FF', { emissive: '#6BE7FF', emissiveIntensity: 0.5 });
      arm.position.set(dir * 0.19, 0.72, 0);
      arm.rotation.z = dir * 0.62;
      g.add(arm);
    });
    g.rotation.z = Math.PI;
    g.rotation.x = i * 0.6;
    group.add(g);
    antibodies.push(g);
  }
  addLabel(group, '抗原', [0, 1.75, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(255,180,200,0.92)' });
  addLabel(group, '抗体', [2.2, 1.9, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(150,235,255,0.95)' });
  addLabel(group, '特异性结合', [0, -2.4, 0], { fontSize: 18, scale: 0.0044, color: 'rgba(200,240,220,0.8)' });

  return {
    group,
    view: { position: [0, 1.2, 8.8], target: [0, 0.3, 0] },
    autoRotateSpeed: 0.26,
    update(time) {
      virus.rotation.y = time * 0.14;
      spikes.forEach((s, i) => {
        s.position.set(
          Math.cos(i * 1.7 + time * 0.12) * 1.18,
          Math.sin(Math.sin(i * 1.7) * 0.9 + time * 0.1) * 1.0,
          Math.sin(i * 1.7 + time * 0.12) * 1.18
        );
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.position.clone().normalize());
      });
      antibodies.forEach((g, i) => {
        const a = time * 0.4 + i * 2.1;
        const r = 2.4 + Math.sin(time * 0.7 + i) * 0.28;
        g.position.set(Math.cos(a) * r, Math.sin(a * 0.8) * 1.1, Math.sin(a) * r);
        g.lookAt(0, 0, 0);
        g.rotateX(Math.PI / 2);
        g.rotation.z += Math.PI;
      });
      void accent;
    },
  };
}

/* --------------------------------- 四季 ---------------------------------- */
export function seasons() {
  const group = new THREE.Group();
  const sun = sphere(0.85, '#FFD37A', { emissive: '#FFD37A', emissiveIntensity: 1.4 });
  group.add(sun);
  addGlow(group, '#FFD37A', 7, [0, 0, 0], 0.35);
  const orbit = ringLine(5.2, '#5c7fae', 0.3, 120);
  orbit.rotation.x = Math.PI / 2;
  group.add(orbit);

  const earth = new THREE.Group();
  const globe = sphere(0.42, '#4F9BFF', { emissive: '#1d4f9e', emissiveIntensity: 0.5 });
  earth.add(globe);
  const land = sphere(0.43, '#79E86B', { transparent: true, opacity: 0.55, roughness: 0.8 });
  land.scale.set(0.72, 1, 0.9);
  earth.add(land);
  const axis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1.5, 6),
    new THREE.MeshBasicMaterial({ color: '#FFE9B8' })
  );
  earth.add(axis);
  axis.rotation.z = 0.41;
  group.add(earth);
  addLabel(group, '太阳', [0, 1.35, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(255,235,190,0.95)' });
  addLabel(group, '地轴倾角 23.5°', [0, -6.0, 0], {
    fontSize: 20, scale: 0.0046, color: 'rgba(190,215,245,0.85)',
  });

  return {
    group,
    view: { position: [0, 5.2, 10.4], target: [0, 0, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      const a = time * 0.28;
      earth.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
      earth.rotation.y = time * 0.4;
      const toSun = new THREE.Vector3(-earth.position.x, 0, -earth.position.z).normalize();
      land.position.set(toSun.x * -0.05, 0, toSun.z * -0.05);
    },
  };
}

/* --------------------------------- 洋流 ---------------------------------- */
export function ocean() {
  const group = new THREE.Group();
  const globe = sphere(2.5, '#123a5c', { emissive: '#0a2238', emissiveIntensity: 0.5, roughness: 0.6 });
  group.add(globe);
  const grid = new THREE.Mesh(
    new THREE.SphereGeometry(2.52, 32, 18),
    new THREE.MeshBasicMaterial({ color: '#4F9BFF', wireframe: true, transparent: true, opacity: 0.14 })
  );
  group.add(grid);

  const streams = [];
  for (let k = 0; k < 3; k += 1) {
    const pts = [];
    const lat = -0.9 + k * 0.9;
    for (let i = 0; i <= 60; i += 1) {
      const a = (i / 60) * Math.PI * 2;
      const r = 2.62;
      pts.push(new THREE.Vector3(Math.cos(a) * r * Math.cos(lat), Math.sin(lat) * r, Math.sin(a) * r * Math.cos(lat)));
    }
    const tube = addTube(group, pts, k === 1 ? '#FF8E6B' : '#6BE7FF', 0.035, 0.7);
    streams.push(tube);
  }
  const particles = makeGrain(90);
  group.add(particles);
  addLabel(group, '暖流', [2.9, 1.2, 0], { fontSize: 18, scale: 0.0042, color: 'rgba(255,180,150,0.95)' });
  addLabel(group, '寒流', [2.9, -1.2, 0], { fontSize: 18, scale: 0.0042, color: 'rgba(150,225,255,0.95)' });

  return {
    group,
    view: { position: [0, 1.8, 9.4], target: [0, 0, 0] },
    autoRotateSpeed: 0.3,
    update(time) {
      globe.rotation.y = time * 0.12;
      grid.rotation.y = time * 0.12;
      const arr = particles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length / 3; i += 1) {
        const a = i * 0.7 + time * 0.5;
        const lat = Math.sin(i * 1.3) * 1.1;
        arr[i * 3] = Math.cos(a) * 2.7;
        arr[i * 3 + 1] = lat;
        arr[i * 3 + 2] = Math.sin(a) * 2.7 * Math.cos(lat * 0.5);
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.material.opacity = 0.5;
      streams.forEach((s) => {
        s.rotation.y = time * 0.1;
      });
    },
  };
}

/* -------------------------------- 喀斯特 --------------------------------- */
export function karst() {
  const group = new THREE.Group();
  const rock = box(6.4, 3.8, 4.2, '#6d7a6a', { roughness: 0.95, emissive: '#1a241c', emissiveIntensity: 0.25 });
  rock.position.y = -0.2;
  group.add(rock);
  const cave = box(2.2, 1.5, 3.0, '#060a0c', { roughness: 1 });
  cave.position.set(0.8, -1.2, 0);
  group.add(cave);
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 3.02, 20, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#0a0f12', side: THREE.DoubleSide, roughness: 1 })
  );
  mouth.rotation.x = Math.PI / 2;
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0.8, -1.2, 1.5);
  group.add(mouth);

  const stalactites = [];
  for (let i = 0; i < 5; i += 1) {
    const c = cone(0.11, 0.7 + (i % 3) * 0.18, '#b9c7b3', { roughness: 0.9 });
    c.position.set(-0.1 + i * 0.42, 0.05, 0.9);
    c.rotation.x = Math.PI;
    group.add(c);
    stalactites.push(c);
    const d = cone(0.09, 0.4 + (i % 2) * 0.2, '#c8d3c0', { roughness: 0.9 });
    d.position.set(-0.05 + i * 0.42, -1.85, 0.9);
    group.add(d);
  }

  const drops = [];
  for (let i = 0; i < 8; i += 1) {
    const d = sphere(0.06, '#9fe9ff', { emissive: '#6BE7FF', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 });
    group.add(d);
    drops.push(d);
  }
  addLabel(group, '石灰岩', [-2.4, 1.6, 1.4], { fontSize: 20, scale: 0.0046, color: 'rgba(220,235,215,0.9)' });
  addLabel(group, '溶洞', [1.2, 0.4, 1.7], { fontSize: 18, scale: 0.0044, color: 'rgba(160,235,255,0.9)' });
  addLabel(group, 'CaCO₃ + CO₂ + H₂O ⇌ Ca(HCO₃)₂', [0, 2.5, 0], {
    fontSize: 20, scale: 0.0044, color: '#ffe9bd',
  });

  return {
    group,
    view: { position: [0.5, 1.2, 9.8], target: [0, -0.3, 0] },
    autoRotateSpeed: 0.2,
    update(time) {
      drops.forEach((d, i) => {
        const u = (time * 0.35 + i * 0.13) % 1;
        d.position.set(-0.05 + i * 0.28, -0.35 - u * 1.4, 0.9);
        d.material.opacity = 0.15 + (1 - u) * 0.7;
      });
      stalactites.forEach((c, i) => {
        c.scale.y = 1 + Math.sin(time * 0.6 + i) * 0.03;
      });
    },
  };
}

/* ------------------------------ 采光与朝向 ------------------------------- */
export function sunPath() {
  const group = new THREE.Group();
  const ground = box(12, 0.1, 8, '#141d22', { roughness: 0.9 });
  ground.position.y = -2;
  group.add(ground);

  const house = new THREE.Group();
  house.position.set(0, -2, 0);
  const body = box(4.2, 2.8, 3.2, '#2a3444', { roughness: 0.75, emissive: '#0e1620', emissiveIntensity: 0.4 });
  body.position.y = 1.4;
  house.add(body);
  const window = box(1.4, 1.0, 0.12, '#FFD37A', { emissive: '#FFD37A', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
  window.position.set(0, 1.6, 1.62);
  house.add(window);
  const eave = box(5.2, 0.16, 0.9, '#3c4a5c', { roughness: 0.6 });
  eave.position.set(0, 2.9, 1.9);
  house.add(eave);
  group.add(house);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3),
    new THREE.MeshBasicMaterial({ color: '#05080c', transparent: true, opacity: 0.55 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -1.94, 2.4);
  group.add(shadow);

  const sun = sphere(0.42, '#FFD37A', { emissive: '#FFD37A', emissiveIntensity: 1.5 });
  group.add(sun);
  addGlow(group, '#FFD37A', 5, [0, 0, 0], 0.3);
  const rayGroup = new THREE.Group();
  group.add(rayGroup);
  const rays = [];
  for (let i = 0; i < 4; i += 1) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 6), new THREE.MeshBasicMaterial({ color: '#FFE9B8', transparent: true, opacity: 0.22 }));
    rayGroup.add(l);
    rays.push(l);
  }
  addLabel(group, '冬至 · 低角度', [0, 4.4, 0], { fontSize: 20, scale: 0.0046, color: 'rgba(255,235,190,0.9)' });

  return {
    group,
    view: { position: [7.5, 2.6, 9.6], target: [0, 0.4, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      const a = -0.15 + (Math.sin(time * 0.22) * 0.5 + 0.5) * 1.5;
      const r = 8.2;
      sun.position.set(Math.cos(a) * r, Math.sin(a) * r + 0.4, 1.4);
      const len = 3 + (1 / Math.max(0.22, Math.sin(a))) * 0.9;
      shadow.scale.set(1, Math.min(2.4, len / 3), 1);
      shadow.position.z = 2.2 + Math.min(2.4, len / 3) * 0.9;
      rays.forEach((l, i) => {
        l.position.copy(sun.position).multiplyScalar(0.55);
        l.lookAt(0, 0.4, 1.6);
        l.position.set(sun.position.x * 0.6, sun.position.y * 0.6, 1.2 + i * 0.25);
      });
      void a;
    },
  };
}

/* ------------------------------- 气压与鱼汛 ------------------------------- */
export function barometer() {
  const group = new THREE.Group();
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.18, 40),
    material('#16202c', { emissive: '#0a1119', emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.4 })
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(-3.2, 0.8, 0);
  group.add(dial);
  const rimRing = torus(1.5, 0.05, '#8fb6dd', { emissive: '#6BE7FF', emissiveIntensity: 0.4 });
  rimRing.position.set(-3.2, 0.8, 0.1);
  group.add(rimRing);
  const needle = box(0.05, 1.1, 0.03, '#FF8E6B', { emissive: '#FF8E6B', emissiveIntensity: 1.1 });
  needle.position.set(-3.2, 1.3, 0.16);
  group.add(needle);
  addLabel(group, 'hPa', [-3.2, -1.1, 0.2], { fontSize: 18, scale: 0.0042, color: 'rgba(200,220,245,0.8)' });

  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 3.4, 3.2),
    new THREE.MeshPhysicalMaterial({ color: '#2a9fd6', transparent: true, opacity: 0.14, roughness: 0.2, side: THREE.DoubleSide })
  );
  tank.position.set(2.2, 0.2, 0);
  group.add(tank);
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 3.0, 3.0),
    new THREE.MeshStandardMaterial({ color: '#14506e', transparent: true, opacity: 0.42, emissive: '#0a2a3c', emissiveIntensity: 0.4 })
  );
  water.position.set(2.2, 0.1, 0);
  group.add(water);

  const fish = [];
  for (let i = 0; i < 4; i += 1) {
    const g = new THREE.Group();
    const body = cone(0.16, 0.62, '#9fe9ff', { emissive: '#6BE7FF', emissiveIntensity: 0.35 });
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const tail = cone(0.14, 0.3, '#7fd4ee');
    tail.rotation.z = -Math.PI / 2;
    tail.position.x = -0.42;
    g.add(tail);
    group.add(g);
    fish.push(g);
  }
  const bubbles = makeGrain(60);
  group.add(bubbles);

  return {
    group,
    view: { position: [0.5, 1.2, 10.2], target: [0.5, 0.2, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      const p = Math.sin(time * 0.3) * 0.5 + 0.5;
      needle.rotation.z = lerp(-0.9, 0.7, p);
      const arr = bubbles.geometry.attributes.position.array;
      for (let i = 0; i < arr.length / 3; i += 1) {
        const u = (time * (0.1 + p * 0.2) + i * 0.07) % 1;
        arr[i * 3] = 0.4 + ((i * 37) % 34) / 10;
        arr[i * 3 + 1] = -1.3 + u * 2.9;
        arr[i * 3 + 2] = -1.2 + ((i * 17) % 24) / 10;
      }
      bubbles.geometry.attributes.position.needsUpdate = true;
      bubbles.material.opacity = 0.15 + p * 0.55;
      fish.forEach((g, i) => {
        const depth = 0.3 + i * 0.16 - p * 0.3;
        g.position.set(2.2 + Math.sin(time * 0.7 + i) * 1.2, 1.0 - depth * 2.0, 0);
        g.scale.setScalar(0.9 + i * 0.05);
      });
    },
  };
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/* --------------------------------- 发酵 ---------------------------------- */
export function ferment() {
  const group = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 1.5, 0.8, 40, 1, true),
    material('#2a3644', { metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide })
  );
  bowl.position.y = -1.3;
  group.add(bowl);

  const dough = sphere(1.4, '#e8cfa6', { roughness: 0.9, emissive: '#6b5230', emissiveIntensity: 0.15 });
  dough.scale.set(1, 0.78, 1);
  dough.position.y = -0.6;
  group.add(dough);

  const bubbles = [];
  for (let i = 0; i < 18; i += 1) {
    const b = sphere(0.1, '#f7e9c8', { transparent: true, opacity: 0.35, roughness: 0.4 });
    group.add(b);
    bubbles.push(b);
  }
  addLabel(group, '酵母 → 酒精 + CO₂', [0, 2.1, 0], {
    fontSize: 22, scale: 0.005, color: '#ffe9bd',
  });
  addLabel(group, '气体被面筋网络困住', [0, 1.55, 0], { fontSize: 17, scale: 0.0042, color: 'rgba(200,220,245,0.75)' });

  return {
    group,
    view: { position: [0, 1.6, 8.6], target: [0, -0.4, 0] },
    autoRotateSpeed: 0.24,
    update(time) {
      const rise = 1 + (Math.sin(time * 0.35) * 0.5 + 0.5) * 0.5;
      dough.scale.set(rise, 0.78 * rise, rise);
      dough.position.y = -0.6 + (rise - 1) * 0.5;
      bubbles.forEach((b, i) => {
        const a = i * 2.3 + time * 0.2;
        const r = 0.5 + ((i * 13) % 8) / 10;
        b.position.set(Math.cos(a) * r * rise, -0.6 + Math.sin(i * 1.7 + time * 0.6) * 0.7 * rise, Math.sin(a) * r * rise * 0.7);
        b.scale.setScalar(0.6 + Math.abs(Math.sin(time * 1.4 + i)) * 0.8);
        b.material.opacity = 0.12 + Math.abs(Math.sin(time * 1.2 + i)) * 0.3;
      });
    },
  };
}

/* --------------------------------- 乳化 ---------------------------------- */
export function emulsion() {
  const group = new THREE.Group();
  const tank = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 4, 4.2),
    new THREE.MeshPhysicalMaterial({ color: '#3fb8d6', transparent: true, opacity: 0.1, roughness: 0.15, side: THREE.DoubleSide })
  );
  group.add(tank);
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 3.6, 4.0),
    new THREE.MeshStandardMaterial({ color: '#1a6a86', transparent: true, opacity: 0.2, emissive: '#0c3344', emissiveIntensity: 0.4 })
  );
  group.add(water);

  const drops = [];
  const rand = seeded(73);
  for (let i = 0; i < 16; i += 1) {
    const g = new THREE.Group();
    const oil = sphere(0.28 + rand() * 0.14, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.3, roughness: 0.3 });
    g.add(oil);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.42 + rand() * 0.1, 16, 10),
      new THREE.MeshBasicMaterial({ color: '#6BE7FF', wireframe: true, transparent: true, opacity: 0.35 })
    );
    g.add(shell);
    const a = rand() * Math.PI * 2;
    const r = 0.4 + rand() * 2.4;
    g.position.set(Math.cos(a) * r, (rand() - 0.5) * 2.6, Math.sin(a) * r * 0.7);
    group.add(g);
    drops.push({ g, a, r, y: (rand() - 0.5) * 2.6, speed: 0.2 + rand() * 0.3 });
  }
  addLabel(group, '油 + 水 + 乳化剂 → 乳浊液', [0, 2.6, 0], {
    fontSize: 22, scale: 0.005, color: '#eaf6ff',
  });
  addLabel(group, '卵磷脂：一头亲水，一头亲油', [0, -2.6, 0], { fontSize: 17, scale: 0.0042, color: 'rgba(200,220,245,0.75)' });

  return {
    group,
    view: { position: [0, 1.4, 9.6], target: [0, 0, 0] },
    autoRotateSpeed: 0.2,
    update(time) {
      drops.forEach((d) => {
        const a = d.a + time * d.speed;
        d.g.position.set(Math.cos(a) * d.r, d.y + Math.sin(time * 0.8 + d.a) * 0.2, Math.sin(a) * d.r * 0.7);
        d.g.rotation.y = time * 0.3;
      });
    },
  };
}

/* --------------------------------- 轮作 ---------------------------------- */
export function rotation() {
  const group = new THREE.Group();
  const ring = ringLine(3.6, '#8FD14F', 0.25, 80);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.5;
  group.add(ring);

  const plots = [];
  const crops = [
    { color: '#FFD37A', name: '玉米', build: (g) => { for (let i = 0; i < 5; i += 1) { const c = cone(0.12, 1.5, '#d9b25a', { emissive: '#7a5a1a', emissiveIntensity: 0.2 }); c.position.set((i - 2) * 0.34, 0.75, 0); g.add(c); } } },
    { color: '#79E86B', name: '大豆', build: (g) => { for (let i = 0; i < 6; i += 1) { const s = sphere(0.16, '#79E86B', { emissive: '#2f6b2a', emissiveIntensity: 0.3 }); s.position.set(Math.sin(i) * 0.7, 0.5 + (i % 3) * 0.18, Math.cos(i) * 0.4); g.add(s); } } },
    { color: '#8FD1F5', name: '小麦', build: (g) => { for (let i = 0; i < 7; i += 1) { const c = cone(0.06, 0.9, '#cfe3a0'); c.position.set((i - 3) * 0.24, 0.45, Math.sin(i) * 0.2); g.add(c); } } },
  ];

  crops.forEach((crop, i) => {
    const a = (i / 3) * Math.PI * 2;
    const plot = new THREE.Group();
    plot.position.set(Math.cos(a) * 3.4, -1.5, Math.sin(a) * 3.4);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.16, 24),
      material('#2c2318', { roughness: 1, emissive: '#150f08', emissiveIntensity: 0.2 })
    );
    plot.add(soil);
    crop.build(plot);
    group.add(plot);
    addLabel(group, crop.name, [Math.cos(a) * 3.4, -0.2, Math.sin(a) * 3.4], {
      fontSize: 20, scale: 0.0046, color: crop.color,
    });
    plots.push(plot);
  });

  const pointer = new THREE.Group();
  const needle = box(0.06, 0.06, 2.2, '#fffdf4', { emissiveIntensity: 1 });
  needle.position.z = 1.1;
  pointer.add(needle);
  pointer.position.y = -1.2;
  group.add(pointer);
  addLabel(group, '豆科固氮 → 下一季少施氮肥', [0, 2.4, 0], {
    fontSize: 20, scale: 0.0046, color: '#eaf6ff',
  });

  return {
    group,
    view: { position: [0, 4.4, 9.4], target: [0, -0.8, 0] },
    autoRotate: false,
    update(time) {
      pointer.rotation.y = time * 0.32;
      plots.forEach((p, i) => {
        p.position.y = -1.5 + Math.sin(time * 0.8 + i) * 0.04;
      });
    },
  };
}

/* -------------------------------- 哈希表 --------------------------------- */
export function hash() {
  const group = new THREE.Group();
  const buckets = [];
  for (let i = 0; i < 8; i += 1) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 2.6, 0.78),
      new THREE.MeshBasicMaterial({ color: '#6BE7FF', wireframe: true, transparent: true, opacity: 0.28 })
    );
    g.add(shell);
    const floor = box(0.78, 0.06, 0.78, '#173042', { emissiveIntensity: 0.3 });
    floor.position.y = -1.3;
    g.add(floor);
    g.position.set((i - 3.5) * 1.0, -0.4, 0);
    group.add(g);
    buckets.push(g);
  }
  const keys = [];
  const labels = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank'];
  labels.forEach((k, i) => {
    const key = box(0.5, 0.22, 0.3, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.2 });
    group.add(key);
    keys.push({ mesh: key, name: k, hash: [...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) % 8, slot: i });
  });
  addLabel(group, 'index = hash(key) mod 8', [0, 2.4, 0], {
    fontSize: 22, scale: 0.005, color: '#ffe9bd',
  });
  addLabel(group, '冲突 → 链地址法', [0, -2.6, 0], { fontSize: 16, scale: 0.004, color: 'rgba(200,220,245,0.7)' });

  const slotsUsed = {};
  return {
    group,
    view: { position: [0, 1.2, 9.4], target: [0, -0.2, 0] },
    autoRotateSpeed: 0.18,
    update(time) {
      slotsUsed[''] = 0;
      const counts = {};
      keys.forEach((k, i) => {
        const t = (time * 0.32 + i * 0.14) % 1;
        const targetX = (k.hash - 3.5) * 1.0;
        const idx = (counts[k.hash] = (counts[k.hash] || 0) + 1) - 1;
        const targetY = 1.5 - idx * 0.3 - t * 2.4;
        k.mesh.position.set(targetX, Math.max(-1.05, targetY), 0);
        k.mesh.rotation.y = Math.sin(time + i) * 0.2;
      });
    },
  };
}

/* ------------------------------- 并发与锁 -------------------------------- */
export function mutex() {
  const group = new THREE.Group();
  const counter = box(2.6, 1.5, 0.3, '#101b2b', { emissive: '#0a1522', emissiveIntensity: 0.5 });
  counter.position.set(0, 0.6, -1.2);
  group.add(counter);
  const lock = new THREE.Group();
  const body = box(1.1, 0.9, 0.4, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.5 });
  lock.add(body);
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.07, 8, 20, Math.PI),
    material('#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.6 })
  );
  shackle.position.y = 0.45;
  lock.add(shackle);
  lock.position.set(0, 1.9, 0);
  group.add(lock);

  const threads = [];
  [-1, 1].forEach((dir, i) => {
    const g = new THREE.Group();
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 1.0, 4, 12);
    const mesh = new THREE.Mesh(bodyGeo, material(i === 0 ? '#6BE7FF' : '#FF8E6B', { emissive: i === 0 ? '#6BE7FF' : '#FF8E6B', emissiveIntensity: 0.5 }));
    g.add(mesh);
    g.position.set(dir * 2.4, 0.8, 0.4);
    group.add(g);
    threads.push({ g, dir });
  });
  addLabel(group, '线程 A', [-2.4, 1.9, 0.4], { fontSize: 18, scale: 0.0042, color: 'rgba(150,235,255,0.95)' });
  addLabel(group, '线程 B', [2.4, 1.9, 0.4], { fontSize: 18, scale: 0.0042, color: 'rgba(255,180,150,0.95)' });
  addLabel(group, '临界区', [0, 0.9, 0.4], { fontSize: 18, scale: 0.0042, color: 'rgba(255,235,190,0.9)' });
  addLabel(group, 'lock → 临界区 → unlock', [0, 2.9, 0], { fontSize: 20, scale: 0.0046, color: '#eaf6ff' });

  return {
    group,
    view: { position: [0, 1.6, 9.2], target: [0, 0.4, 0] },
    autoRotateSpeed: 0.14,
    update(time) {
      const t = (time * 0.25) % 2;
      lock.rotation.y = time * 0.3;
      threads.forEach((th, i) => {
        const active = (i === 0 && t < 1) || (i === 1 && t >= 1);
        const target = active ? 0.9 : 2.4;
        th.g.position.x += (th.dir * target - th.g.position.x) * 0.05;
        th.g.material = th.g.material;
        th.g.children[0].material.emissiveIntensity = active ? 1.1 : 0.3;
      });
    },
  };
}

/* -------------------------------- 编译原理 -------------------------------- */
export function compiler() {
  const group = new THREE.Group();
  const stages = ['源码', '词法', '语法树', '优化', '目标码'];
  const boxes = stages.map((name, i) => {
    const b = box(1.5, 1.0, 1.0, '#141f2e', { emissive: '#0d1725', emissiveIntensity: 0.5, roughness: 0.5 });
    b.position.set((i - 2) * 2.0, 0, 0);
    group.add(b);
    addLabel(group, name, [(i - 2) * 2.0, 0.85, 0], { fontSize: 17, scale: 0.004, color: 'rgba(190,215,245,0.9)' });
    return b;
  });

  const token = box(0.36, 0.2, 0.2, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.7 });
  group.add(token);

  const ast = new THREE.Group();
  const astNodes = [[0, 1.8, 0], [-0.8, 0.8, 0], [0.8, 0.8, 0], [-1.2, -0.1, 0], [-0.4, -0.1, 0], [0.4, -0.1, 0], [1.2, -0.1, 0]];
  astNodes.forEach(([x, y, z]) => {
    const s = sphere(0.14, '#6BE7FF', { emissive: '#6BE7FF', emissiveIntensity: 0.6 });
    s.position.set(x + 0.2, y + 3.2, z);
    ast.add(s);
  });
  const astEdges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  astEdges.forEach(([a, b]) => {
    const A = astNodes[a];
    const B = astNodes[b];
    addLine(ast, [[A[0] + 0.2, A[1] + 3.2, 0], [B[0] + 0.2, B[1] + 3.2, 0]], '#6BE7FF', 0.35);
  });
  group.add(ast);
  addLabel(group, '词法 → 语法 → 语义 → 优化 → 代码', [0, 4.6, 0], {
    fontSize: 20, scale: 0.0046, color: '#eaf6ff',
  });

  return {
    group,
    view: { position: [0, 2.2, 12.4], target: [0, 1.4, 0] },
    autoRotateSpeed: 0.14,
    update(time) {
      const u = (time * 0.3) % 1;
      token.position.set(-4 + u * 8, 0, 0.7);
      boxes.forEach((b, i) => {
        const on = Math.abs(b.position.x - token.position.x) < 1.1;
        b.material.emissiveIntensity = on ? 1.2 : 0.4;
      });
      ast.rotation.y = Math.sin(time * 0.3) * 0.2;
    },
  };
}

/* -------------------------------- 对比层级 -------------------------------- */
export function contrast() {
  const group = new THREE.Group();
  const panels = [];
  [[-2.9, 0.55, 'rgba(240,246,255,0.95)'], [0, 0.28, 'rgba(200,216,238,0.5)'], [2.9, 0.12, 'rgba(160,180,210,0.35)']].forEach(([x, scale, color], i) => {
    const g = new THREE.Group();
    const plate = box(2.5, 3.2, 0.12, '#0c1420', { emissive: '#0a1220', emissiveIntensity: 0.4 });
    g.add(plate);
    const title = addLabel(g, '标题', [0, 0.9, 0.12], { fontSize: 44 * scale + 14, scale: 0.0062, color: '#f4f8ff' });
    title.scale.multiplyScalar(0.8 + scale * 0.8);
    addLabel(g, '正文文字', [0, -0.3, 0.12], { fontSize: 18, scale: 0.0044, color: i === 0 ? '#bfd0e8' : i === 1 ? '#8fa2bd' : '#6c7d97' });
    g.position.set(x, 0.2, 0);
    group.add(g);
    panels.push(g);
  });
  addLabel(group, '层级 = 大小 × 粗细 × 明度', [0, 2.5, 0], {
    fontSize: 22, scale: 0.005, color: '#eaf6ff',
  });
  return {
    group,
    view: { position: [0, 0.6, 10.4], target: [0, 0.2, 0] },
    autoRotateSpeed: 0.16,
    update(time) {
      panels.forEach((p, i) => {
        p.position.y = 0.2 + Math.sin(time * 0.7 + i * 0.6) * 0.06;
      });
    },
  };
}

/* -------------------------------- 字距行高 -------------------------------- */
export function typescale() {
  const group = new THREE.Group();
  const page = box(6.4, 4.4, 0.12, '#0b1220', { emissive: '#080f1a', emissiveIntensity: 0.4 });
  page.position.set(0.6, 0.3, 0);
  group.add(page);
  const lines = [];
  for (let i = 0; i < 7; i += 1) {
    const l = box(5.2, 0.05, 0.02, i === 0 ? '#f4f8ff' : '#9fb3cf', { emissiveIntensity: 0.3 });
    l.position.set(0.6, 1.75 - i * 0.52, 0.08);
    group.add(l);
    lines.push(l);
  }
  const ruler = box(0.12, 4.2, 0.12, '#FFD37A', { emissive: '#FFB86B', emissiveIntensity: 0.4 });
  ruler.position.set(-3.1, 0.3, 0.1);
  group.add(ruler);
  const marks = [];
  for (let i = 0; i < 9; i += 1) {
    const m = box(0.4, 0.03, 0.03, '#FFD37A', { emissiveIntensity: 0.5 });
    m.position.set(-2.9, -1.75 + i * 0.5, 0.1);
    group.add(m);
    marks.push(m);
  }
  addLabel(group, 'line-height ≈ 1.5 × font-size', [0.6, -2.4, 0], {
    fontSize: 20, scale: 0.0046, color: '#eaf6ff',
  });
  return {
    group,
    view: { position: [0, 0.4, 10.2], target: [0, 0.3, 0] },
    autoRotateSpeed: 0.12,
    update(time) {
      const lh = 0.42 + (Math.sin(time * 0.3) * 0.5 + 0.5) * 0.32;
      lines.forEach((l, i) => {
        l.position.y = 1.75 - i * lh;
      });
      marks.forEach((m, i) => {
        m.position.y = -1.75 + i * (lh / 0.42) * 0.5;
      });
    },
  };
}
