import {
  THREE,
  addGlow,
  addLabel,
  addLine,
  addTube,
  box,
  cylinder,
  sphere,
  addDashedLine,
} from './helpers.js';

export function preposition() {
  const group = new THREE.Group();
  const amber = '#FFC94D';

  const floor = box(10, 0.1, 8, '#101a2b', { roughness: 0.85, emissive: '#0b1626', emissiveIntensity: 0.2 });
  floor.position.y = -2.1;
  group.add(floor);

  const table = new THREE.Group();
  const top = box(4.6, 0.2, 2.8, '#8a6844', {
    roughness: 0.55,
    metalness: 0.05,
    emissive: '#3a2917',
    emissiveIntensity: 0.18,
  });
  top.position.y = 1.5;
  table.add(top);
  for (const x of [-2.0, 2.0]) {
    for (const z of [-1.1, 1.1]) {
      const leg = box(0.16, 1.5, 0.16, '#6f5236', { roughness: 0.6 });
      leg.position.set(x, 0.75, z);
      table.add(leg);
    }
  }
  group.add(table);

  const boxGroup = new THREE.Group();
  const boxPosition = new THREE.Vector3(0, 2.19, 0);
  boxGroup.position.copy(boxPosition);
  const glass = box(1.2, 1.2, 1.2, '#8fdcff', {
    transparent: true,
    opacity: 0.16,
    roughness: 0.1,
    metalness: 0.3,
    emissive: '#2a9dc8',
    emissiveIntensity: 0.3,
    depthWrite: false,
  });
  boxGroup.add(glass);
  const boxEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 1.2, 1.2)),
    new THREE.LineBasicMaterial({
      color: new THREE.Color(amber),
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
    })
  );
  boxGroup.add(boxEdges);
  addLabel(boxGroup, 'box', [0, 0.94, 0], { color: amber, fontSize: 24, scale: 0.0058 });
  group.add(boxGroup);

  const ball = sphere(0.26, '#FF9F45', {
    roughness: 0.4,
    metalness: 0.2,
    emissive: '#ff7a2a',
    emissiveIntensity: 0.55,
  });
  ball.position.set(0, 2.19, 0);
  group.add(ball);
  addGlow(group, '#FF9F45', 1.15, [0, 2.19, 0], 0.22);

  addLabel(group, 'table', [-2.1, 1.86, 0.7], {
    color: 'rgba(230, 210, 180, 0.72)',
    fontSize: 22,
    scale: 0.0054,
  });

  const states = [
    { position: [0, 2.19, 0], word: 'in', sentence: 'The ball is in the box.', cn: '球在盒子里。' },
    { position: [0, 2.98, 0], word: 'on', sentence: 'The ball is on the box.', cn: '球在盒子上面。' },
    { position: [1.2, 0.42, 0.9], word: 'under', sentence: 'The ball is under the table.', cn: '球在桌子下面。' },
    { position: [0, 2.19, -1.05], word: 'behind', sentence: 'The ball is behind the box.', cn: '球在盒子后面。' },
  ];

  const sentenceLabels = states.map((state, index) => {
    const label = addLabel(
      group,
      `${state.sentence}\n${state.cn}`,
      [0, 4.75 + (index % 2) * 0.01, 0],
      {
        color: '#f2f8ff',
        fontSize: 34,
        scale: 0.008,
        bg: 'rgba(5, 10, 20, 0.78)',
        border: 'rgba(255, 201, 77, 0.32)',
        padding: 14,
        glow: 12,
        glowColor: amber,
        opacity: index === 0 ? 1 : 0,
      }
    );
    label.material.opacity = index === 0 ? 1 : 0;
    return label;
  });

  addLabel(group, '方位介词：空间关系', [0, 3.7, -1.5], {
    color: 'rgba(190, 215, 245, 0.65)',
    fontSize: 24,
    scale: 0.0058,
  });

  let lastIndex = 0;
  return {
    group,
    view: { position: [6.2, 4.2, 9.6], target: [0, 1.5, 0] },
    autoRotate: false,
    update(time, dt) {
      const index = Math.floor(time / 2.8) % states.length;
      if (index !== lastIndex) lastIndex = index;
      const target = new THREE.Vector3(...states[index].position);
      ball.position.lerp(target, Math.min(1, dt * 4.2));
      sentenceLabels.forEach((label, i) => {
        const targetOpacity = i === index ? 1 : 0;
        label.material.opacity += (targetOpacity - label.material.opacity) * Math.min(1, dt * 8);
        label.visible = label.material.opacity > 0.02;
      });
      boxEdges.material.opacity = 0.35 + Math.sin(time * 1.6) * 0.12;
    },
  };
}

export function timeline() {
  const group = new THREE.Group();
  const amber = '#FFC94D';
  const pastColor = '#8FA6C4';
  const futureColor = '#6BE7FF';

  const railY = 1.25;
  addTube(group, [[-5.2, railY, 0], [5.2, railY, 0]], amber, 0.018, 0.4);

  for (let x = -5; x <= 5; x += 0.5) {
    const major = Math.abs(x % 1) < 0.01;
    addLine(
      group,
      [
        [x, railY - (major ? 0.16 : 0.08), 0],
        [x, railY + (major ? 0.16 : 0.08), 0],
      ],
      amber,
      major ? 0.3 : 0.14
    );
  }

  const markers = [
    { x: -2.7, label: 'PAST', cn: '过去', color: pastColor },
    { x: 0, label: 'NOW', cn: '现在', color: amber },
    { x: 2.7, label: 'FUTURE', cn: '将来', color: futureColor },
  ];
  markers.forEach((m) => {
    const node = sphere(0.11, m.color, { emissive: m.color, emissiveIntensity: 1.6 });
    node.position.set(m.x, railY, 0);
    group.add(node);
    addGlow(group, m.color, 0.9, [m.x, railY, 0], 0.45);
    addLabel(group, m.label, [m.x, 0.72, 0], {
      color: m.color,
      fontSize: 25,
      scale: 0.0062,
      bg: 'rgba(4, 8, 16, 0.6)',
      padding: 7,
    });
    addLabel(group, m.cn, [m.x, 0.28, 0], {
      color: 'rgba(180, 205, 235, 0.6)',
      fontSize: 21,
      scale: 0.0054,
    });
  });

  addDashedLine(group, [[0, 0.5, 0], [0, 5.45, 0]], amber, 0.4, 0.18, 0.13);

  const examples = [
    {
      x: -3.4,
      y: 2.45,
      width: 1.5,
      color: pastColor,
      title: '一般过去时',
      sentence: 'I lived here for ten years.',
      cn: '我曾经在这里住了十年。',
    },
    {
      x: -2.35,
      y: 3.95,
      width: 4.7,
      color: amber,
      title: '现在完成时',
      sentence: 'I have lived here for ten years.',
      cn: '我在这里已经住了十年（还会继续住）。',
    },
    {
      x: 2.55,
      y: 2.45,
      width: 1.5,
      color: futureColor,
      title: '一般将来时',
      sentence: 'I will live here next year.',
      cn: '明年我会住在这里。',
    },
  ];

  examples.forEach((ex) => {
    addTube(
      group,
      [
        [ex.x - ex.width / 2, ex.y - 0.9, 0],
        [ex.x + ex.width / 2, ex.y - 0.9, 0],
      ],
      ex.color,
      0.028,
      0.55
    );
    addLabel(group, ex.title, [ex.x, ex.y + 0.55, 0.3], {
      color: ex.color,
      fontSize: 23,
      scale: 0.0056,
      bg: 'rgba(4, 8, 16, 0.62)',
      border: 'rgba(255, 201, 77, 0.28)',
      padding: 7,
    });
    addLabel(group, ex.sentence, [ex.x, ex.y + 0.08, 0.3], {
      color: '#e8f2ff',
      fontSize: 28,
      scale: 0.0066,
    });
    addLabel(group, ex.cn, [ex.x, ex.y - 0.45, 0.3], {
      color: 'rgba(165, 195, 230, 0.68)',
      fontSize: 21,
      scale: 0.0053,
    });
  });

  addLabel(group, '完成体：把过去的动作与现在连起来', [0.2, 5.25, 0], {
    color: amber,
    fontSize: 28,
    scale: 0.0065,
    bg: 'rgba(5, 10, 16, 0.62)',
    border: 'rgba(255, 201, 77, 0.28)',
    padding: 9,
  });

  const torch = addGlow(group, amber, 1.5, [-5, railY, 0], 0.75);
  const span = addGlow(group, amber, 1.1, [-4.7, 3.4, 0], 0.4);

  return {
    group,
    view: { position: [0, 3.6, 14.6], target: [0, 2.4, 0] },
    autoRotate: false,
    update(time) {
      const x = -5.2 + ((time * 0.8) % 10.4);
      torch.position.x = x;
      torch.material.opacity = 0.55 + Math.sin(time * 3) * 0.2;
      span.position.x = -4.7 + ((time * 0.45) % 4.7);
      span.material.opacity = 0.2 + Math.sin(time * 2.2) * 0.1;
    },
  };
}

export function wordTree() {
  const group = new THREE.Group();
  const amber = '#FFC94D';

  const root = new THREE.Vector3(0, -1.25, 0);
  const rootNode = sphere(0.36, amber, { emissive: amber, emissiveIntensity: 1.3, roughness: 0.3 });
  rootNode.position.copy(root);
  group.add(rootNode);
  addGlow(group, amber, 2.6, root, 0.55);
  addLabel(group, 'spect', [0, -0.28, 0.3], {
    color: amber,
    fontSize: 44,
    scale: 0.008,
    glow: 16,
    glowColor: amber,
    letterSpacing: 2,
  });
  addLabel(group, '看', [0, -0.82, 0.3], {
    color: 'rgba(255, 211, 122, 0.75)',
    fontSize: 25,
    scale: 0.006,
  });

  const branches = [
    { word: 'inspect', cn: '向内看 → 检查', pos: [-4.25, 1.45, 0.7], tag: 'in- 向内', color: '#FFD37A' },
    { word: 'respect', cn: '回头看 → 尊重', pos: [-3.5, 3.3, -0.6], tag: 're- 回', color: '#FFB454' },
    { word: 'spectator', cn: '看的人 → 观众', pos: [0, 4.0, 0.9], tag: '-or 人', color: '#FF9F45' },
    { word: 'perspective', cn: '看穿 → 视角', pos: [3.6, 3.2, -0.5], tag: 'per- 穿过', color: '#FFD37A' },
    { word: 'spectacle', cn: '被看之物 → 景象', pos: [4.45, 1.3, 0.6], tag: '-acle 名词', color: '#FFB454' },
  ];

  const pulses = [];
  branches.forEach((branch, index) => {
    const end = new THREE.Vector3(...branch.pos);
    const mid = root.clone().add(end).multiplyScalar(0.5);
    mid.y += 0.55;
    const curve = new THREE.QuadraticBezierCurve3(root, mid, end);
    addTube(group, curve.getPoints(30), branch.color, 0.018, 0.5);

    const node = sphere(0.18, branch.color, { emissive: branch.color, emissiveIntensity: 1.4 });
    node.position.copy(end);
    group.add(node);
    addGlow(group, branch.color, 1.3, end, 0.4);

    addLabel(group, branch.word, [end.x, end.y + 0.65, end.z + 0.1], {
      color: '#f7fbff',
      fontSize: 30,
      scale: 0.0068,
      bg: 'rgba(5, 10, 18, 0.72)',
      border: 'rgba(255, 201, 77, 0.28)',
      padding: 9,
      glow: 10,
      glowColor: branch.color,
    });
    addLabel(group, branch.cn, [end.x, end.y + 0.03, end.z + 0.2], {
      color: 'rgba(190, 215, 240, 0.76)',
      fontSize: 21,
      scale: 0.0054,
    });
    addLabel(group, branch.tag, [end.x, end.y - 0.53, end.z + 0.2], {
      color: branch.color,
      fontSize: 20,
      scale: 0.005,
    });

    const pulse = sphere(0.075, '#fff6dd', { emissive: '#ffffff', emissiveIntensity: 2 });
    group.add(pulse);
    pulses.push({ pulse, curve, offset: index * 0.17 });
  });

  addLabel(group, '词根 + 前缀 + 后缀', [0, -2.55, 0.2], {
    color: 'rgba(210, 230, 250, 0.72)',
    fontSize: 27,
    scale: 0.0062,
    bg: 'rgba(5, 10, 18, 0.6)',
    border: 'rgba(255, 201, 77, 0.25)',
    padding: 9,
  });

  return {
    group,
    view: { position: [0, 1.3, 14.2], target: [0, 1.2, 0] },
    autoRotate: true,
    autoRotateSpeed: 0.16,
    update(time) {
      rootNode.scale.setScalar(1 + Math.sin(time * 2.2) * 0.05);
      pulses.forEach((p) => {
        const u = (time * 0.28 + p.offset) % 1;
        p.pulse.position.copy(p.curve.getPointAt(u));
        p.pulse.material.emissiveIntensity = 1.4 + Math.sin(time * 4 + p.offset * 6) * 0.6;
      });
    },
  };
}
