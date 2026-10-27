import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SUBJECTS, CROSS_LINKS } from '../data/subjects.js';
import {
  clamp,
  damp,
  easeInOutCubic,
  glowSprite,
  makeStars,
  makeTextSprite,
  seeded,
  withAlpha,
} from '../lib/visuals.js';

const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const SPHERE_RADIUS = 18.5;

function computeHomePosition() {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 0.7) return new THREE.Vector3(0, 12.5, 106);
  if (aspect < 1.05) return new THREE.Vector3(0, 11, 82);
  return new THREE.Vector3(0, 10, 62);
}

export class GraphScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.focusId = null;
    this.filter = 'all';
    this.tierFocus = null;
    this.hovered = null;
    this.tween = null;
    this.pointers = new Map();
    this.hasEntered = false;
    this.paused = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#04060e');
    this.scene.fog = new THREE.FogExp2('#04060e', 0.0065);

    this.camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 400);
    this.home = computeHomePosition();
    this.camera.position.copy(this.home).multiplyScalar(1.3);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 150;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.72;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.24;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.42,
      0.55,
      0.9
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pickables = [];
    this.nodes = [];
    this.subjectNodes = new Map();
    this.pointNodes = new Map();
    this.edges = [];

    this.build();
    this.bindEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  build() {
    this.addEnvironment();
    this.addCore();
    this.layoutSubjects();
    this.addConnections();
  }

  addEnvironment() {
    this.scene.add(new THREE.AmbientLight(0x93a9ff, 1.35));

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(14, 22, 18);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x6d8cff, 1.4);
    rim.position.set(-18, -10, -14);
    this.scene.add(rim);

    const centerGlow = new THREE.PointLight(0x72c8ff, 55, 80, 1.8);
    centerGlow.position.set(0, 0, 6);
    this.scene.add(centerGlow);

    this.stars = makeStars(2300, 55, 160, '#a9c9ff', 0.55);
    this.scene.add(this.stars);

    const nebulas = [
      { color: '#1b5c9e', pos: [-62, 22, -88], size: 120, opacity: 0.17 },
      { color: '#5c3b9e', pos: [70, -18, -92], size: 110, opacity: 0.14 },
      { color: '#0a6d7a', pos: [-52, -36, 58], size: 90, opacity: 0.1 },
    ];
    for (const n of nebulas) {
      const sprite = glowSprite(n.color, n.size, n.opacity);
      sprite.position.set(...n.pos);
      sprite.material.depthTest = false;
      sprite.renderOrder = -2;
      this.scene.add(sprite);
    }

    const grid = new THREE.GridHelper(105, 34, 0x21456b, 0x122740);
    grid.position.y = -21;
    grid.material.transparent = true;
    grid.material.opacity = 0.14;
    grid.material.depthWrite = false;
    this.scene.add(grid);
  }

  addCore() {
    this.core = new THREE.Group();
    this.scene.add(this.core);

    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 2),
      new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.88, toneMapped: false })
    );
    this.core.add(inner);
    this.coreInner = inner;

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x73d9ff,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    this.core.add(wire);
    this.coreWire = wire;

    const halo = glowSprite('#6be7ff', 14, 0.2);
    halo.material.depthTest = false;
    this.core.add(halo);

    const ringGeo = new THREE.TorusGeometry(5.1, 0.008, 6, 160);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7ee7ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const ringA = new THREE.Mesh(ringGeo, ringMat);
    ringA.rotation.x = Math.PI / 2.35;
    const ringB = new THREE.Mesh(ringGeo, ringMat.clone());
    ringB.rotation.x = Math.PI / 2.35;
    ringB.rotation.y = Math.PI / 2.8;
    ringB.material.opacity = 0.14;
    this.core.add(ringA, ringB);
    this.coreRings = [ringA, ringB];

    const label = makeTextSprite('KNOWLEDGE CORE', {
      color: '#a9e8ff',
      fontSize: 28,
      weight: 400,
      font: '"Cascadia Code", Consolas, monospace',
      scale: 0.009,
      opacity: 0.5,
      letterSpacing: 4,
    });
    label.position.set(0, -4.6, 0);
    this.core.add(label);
  }

  layoutSubjects() {
    const count = SUBJECTS.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const rand = seeded(481516);

    SUBJECTS.forEach((subject, index) => {
      const y = 1 - (index / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * goldenAngle + 0.35;
      const position = new THREE.Vector3(
        Math.cos(theta) * radius,
        y * 0.88,
        Math.sin(theta) * radius
      ).multiplyScalar(SPHERE_RADIUS);
      position.x += (rand() - 0.5) * 1.2;
      position.y += (rand() - 0.5) * 1.4;
      position.z += (rand() - 0.5) * 1.2;

      this.addSubject(subject, position, index);
      this.addCluster(subject, position, index);
    });
  }

  addSubject(subject, position, index) {
    const color = new THREE.Color(subject.color);
    const group = new THREE.Group();
    group.position.copy(position);
    this.scene.add(group);

    const size = subject.kind === 'academic' ? 1.06 : 0.94;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 1),
      new THREE.MeshStandardMaterial({
        color: color.clone().lerp(new THREE.Color('#ffffff'), 0.2),
        emissive: color,
        emissiveIntensity: 0.95,
        roughness: 0.32,
        metalness: 0.44,
        flatShading: true,
        transparent: true,
      })
    );
    group.add(mesh);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * 1.5, 0),
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    group.add(shell);

    const glow = glowSprite(subject.color, size * 4.2, 0.4);
    group.add(glow);

    const labelColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.45).getStyle();
    const label = makeTextSprite(subject.name, {
      color: labelColor,
      fontSize: 48,
      weight: 600,
      scale: 0.0175,
      bg: 'rgba(3, 8, 17, 0.8)',
      border: withAlpha(subject.color, 0.5),
      padding: 16,
      radius: 13,
      glow: 20,
      glowColor: subject.color,
      letterSpacing: 3,
    });
    const isBottomPole = position.y < -12;
    const extraLift = subject.id === 'chemistry' ? 1.05 : 0;
    if (isBottomPole) {
      label.position.set(2.4, 0.15, 0);
    } else {
      label.position.set(0, size + 1.65 + extraLift, 0);
    }
    group.add(label);

    const enLabel = makeTextSprite(subject.en, {
      color: withAlpha(subject.color, 0.8),
      fontSize: 19,
      weight: 400,
      scale: 0.0105,
      font: '"Cascadia Code", Consolas, monospace',
      letterSpacing: 3,
      opacity: 0.8,
    });
    enLabel.position.set(isBottomPole ? 2.4 : 0, isBottomPole ? -0.5 : size + 0.82 + extraLift, 0);
    group.add(enLabel);

    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.6, 12, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    group.add(pick);

    const node = {
      type: 'subject',
      data: subject,
      group,
      mesh,
      shell,
      glow,
      label,
      enLabel,
      pick,
      color,
      baseScale: 1,
      phase: index * 1.7,
      targetScale: 1,
      currentScale: 1,
      targetOpacity: 1,
      currentOpacity: 1,
      targetEmissive: 1.25,
      currentEmissive: 1.25,
      targetGlow: 0.68,
      currentGlow: 0.68,
      visible: true,
    };

    mesh.userData.node = node;
    pick.userData.node = node;
    this.subjectNodes.set(subject.id, node);
    this.nodes.push(node);
    this.pickables.push(pick);
  }

  addCluster(subject, hubPosition, subjectIndex) {
    const rand = seeded(1000 + subjectIndex * 71);
    const normal = hubPosition.clone().normalize();
    const up = Math.abs(normal.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

    subject.points.forEach((point, pointIndex) => {
      const angle = (pointIndex / subject.points.length) * Math.PI * 2 + subjectIndex * 0.9;
      const distance = 4.1 + rand() * 1.4;
      const position = hubPosition
        .clone()
        .add(tangent.clone().multiplyScalar(Math.cos(angle) * distance))
        .add(bitangent.clone().multiplyScalar(Math.sin(angle) * distance * 0.82))
        .add(normal.clone().multiplyScalar(0.5 + rand() * 0.8));

      this.addPoint(subject, point, position, angle, pointIndex);
    });
  }

  addPoint(subject, point, position, angle, index) {
    const color = new THREE.Color(subject.color).lerp(new THREE.Color('#ffffff'), 0.22);
    const group = new THREE.Group();
    group.position.copy(position);
    this.scene.add(group);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(subject.color),
        emissiveIntensity: 1.5,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true,
      })
    );
    group.add(mesh);

    const glow = glowSprite(subject.color, 1.6, 0.46);
    group.add(glow);

    const label = makeTextSprite(point.title, {
      color: '#eaf8ff',
      fontSize: 32,
      weight: 450,
      scale: 0.011,
      bg: 'rgba(3, 7, 15, 0.86)',
      border: withAlpha(subject.color, 0.4),
      padding: 11,
      radius: 9,
      opacity: 0,
    });
    label.position.set(0, 0.8, 0);
    group.add(label);

    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 10, 10),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    group.add(pick);

    const node = {
      type: 'point',
      data: { ...point, subjectId: subject.id, subject },
      group,
      mesh,
      glow,
      label,
      pick,
      color: new THREE.Color(subject.color),
      baseScale: 1,
      phase: angle + index,
      targetScale: 1,
      currentScale: 1,
      targetOpacity: 0.62,
      currentOpacity: 0.62,
      targetEmissive: 1,
      currentEmissive: 1.5,
      targetGlow: 0.36,
      currentGlow: 0.62,
      targetLabel: 0,
      currentLabel: 0,
      visible: true,
      parent: subject.id,
    };

    mesh.userData.node = node;
    pick.userData.node = node;
    this.pointNodes.set(point.id, node);
    this.nodes.push(node);
    this.pickables.push(pick);

    const edge = this.makeChildEdge(subject, position);
    this.edges.push({ ...edge, type: 'child', subjectId: subject.id, pointId: point.id, line: edge.line });
  }

  makeChildEdge(subject, pointPosition) {
    const hub = this.subjectNodes.get(subject.id).group.position;
    const normal = hub.clone().normalize();
    const mid = hub.clone().add(pointPosition).multiplyScalar(0.5).add(normal.clone().multiplyScalar(0.6));
    const curve = new THREE.QuadraticBezierCurve3(hub.clone(), mid, pointPosition.clone());
    const points = curve.getPoints(26);
    const positions = new Float32Array(points.length * 3);
    const base = new THREE.Color(subject.color);
    const colors = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3);
      colors.set([base.r, base.g, base.b], i * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 2;
    this.scene.add(line);
    return { line, baseOpacity: 0.26 };
  }

  addConnections() {
    const rand = seeded(7321);
    CROSS_LINKS.forEach(([a, b], index) => {
      const nodeA = this.subjectNodes.get(a);
      const nodeB = this.subjectNodes.get(b);
      if (!nodeA || !nodeB) return;
      const start = nodeA.group.position.clone();
      const end = nodeB.group.position.clone();
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const length = start.distanceTo(end);
      mid.normalize().multiplyScalar(Math.max(length * 0.78, 12));
      mid.y += (rand() - 0.5) * 4;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const points = curve.getPoints(42);
      const positions = new Float32Array(points.length * 3);
      const colors = new Float32Array(points.length * 3);
      const colorA = new THREE.Color(nodeA.data.color);
      const colorB = new THREE.Color(nodeB.data.color);
      const temp = new THREE.Color();
      points.forEach((p, i) => {
        positions.set([p.x, p.y, p.z], i * 3);
        temp.copy(colorA).lerp(colorB, i / (points.length - 1));
        colors.set([temp.r, temp.g, temp.b], i * 3);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 1;
      this.scene.add(line);

      const pulse = glowSprite(index % 3 === 0 ? '#ffffff' : nodeA.data.color, 0.85, 0.7);
      pulse.material.depthWrite = false;
      this.scene.add(pulse);

      this.edges.push({
        type: 'cross',
        a,
        b,
        line,
        baseOpacity: 0.09,
        curve,
        pulse,
        offset: rand(),
      });
    });
  }

  bindEvents() {
    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointerClient = { x: event.clientX, y: event.clientY };
      this.checkHover();
    };

    this.onPointerDown = (event) => {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.dragStart = { x: event.clientX, y: event.clientY };
    };

    this.onPointerUp = (event) => {
      this.pointers.delete(event.pointerId);
      if (!this.dragStart) return;
      const dist = Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y);
      this.dragStart = null;
      if (dist > 7) return;
      this.checkHover();
      if (this.hovered) {
        if (this.hovered.type === 'subject') {
          this.callbacks.onPickSubject?.(this.hovered.data);
          this.setFocus(this.hovered.data.id);
        } else {
          this.callbacks.onPickPoint?.(this.hovered.data);
        }
      } else {
        this.callbacks.onEmpty?.();
      }
    };

    this.onPointerLeave = () => {
      this.hovered = null;
      this.callbacks.onHover?.(null, null);
      this.canvas.style.cursor = 'grab';
    };

    this.onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.composer.setSize(w, h);
      const previous = this.home.clone();
      this.home = computeHomePosition();
      if (!this.focusId && !this.tween && previous.distanceTo(this.home) > 0.5) {
        this.camera.position.copy(this.home);
        this.controls.target.copy(HOME_TARGET);
        this.controls.update();
      }
    };

    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('resize', this.onResize);
  }

  checkHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates = this.pickables.filter((obj) => obj.userData.node?.visible);
    const hits = this.raycaster.intersectObjects(candidates, false);
    const node = hits[0]?.object.userData.node || null;
    if (node !== this.hovered) {
      this.hovered = node;
      this.canvas.style.cursor = node ? 'pointer' : 'grab';
      this.callbacks.onHover?.(node, this.pointerClient, this.hovered?.type === 'subject' ? this.hovered.data : null);
    }
    if (node && this.pointerClient) {
      this.callbacks.onHoverPosition?.(this.pointerClient);
    }
  }

  setFocus(subjectId) {
    this.focusId = subjectId || null;
    const node = this.subjectNodes.get(subjectId);
    if (!node) {
      this.resetView();
      return;
    }
    const pos = node.group.position.clone();
    const dir = pos.clone().normalize();
    const distance = window.innerWidth < 700 ? 40 : 29;
    const destination = pos.clone().add(dir.multiplyScalar(distance));
    destination.y += window.innerWidth < 700 ? 4 : 2.5;
    this.flyTo(destination, pos, 1.15);
  }

  flyTo(position, target, duration = 1) {
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      t: 0,
      duration,
    };
  }

  resetView() {
    this.focusId = null;
    this.home = computeHomePosition();
    this.flyTo(this.home, HOME_TARGET, 1.2);
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = enabled ? 0.24 : 0;
  }

  /** 段位聚焦：只让某一段位的知识点亮起来，其余退到背景里 */
  setTierFocus(level) {
    this.tierFocus = level || null;
    this.hovered = null;
    this.callbacks.onHover?.(null, null);
    const subject = this.tierFocus
      ? SUBJECTS.find((s) => s.points.some((p) => p.tier === this.tierFocus))
      : null;
    if (subject) {
      const pos = this.subjectNodes.get(subject.id)?.group.position;
      if (pos && !this.focusId) {
        const dir = pos.clone().normalize();
        const distance = window.innerWidth < 700 ? 42 : 34;
        this.flyTo(pos.clone().add(dir.multiplyScalar(distance)).setY(pos.y + 6), new THREE.Vector3(pos.x, pos.y, pos.z), 1.4);
      }
    }
  }

  setFilter(kind) {    this.filter = kind;
    for (const subject of SUBJECTS) {
      const visible = kind === 'all' || subject.kind === kind;
      const node = this.subjectNodes.get(subject.id);
      if (!node) continue;
      node.visible = visible;
      node.group.visible = visible;
      if (!visible && this.focusId === subject.id) this.focusId = null;
    }
    for (const pointNode of this.pointNodes.values()) {
      const visible = kind === 'all' || pointNode.data.subject.kind === kind;
      pointNode.visible = visible;
      pointNode.group.visible = visible;
    }
    for (const edge of this.edges) {
      if (edge.type === 'child') {
        const subject = this.subjectNodes.get(edge.subjectId);
        edge.line.visible = subject?.visible ?? true;
      } else {
        const a = this.subjectNodes.get(edge.a);
        const b = this.subjectNodes.get(edge.b);
        const visible = (a?.visible ?? true) && (b?.visible ?? true);
        edge.line.visible = visible;
        if (edge.pulse) edge.pulse.visible = visible;
      }
    }
    this.hovered = null;
    this.callbacks.onHover?.(null, null);
  }

  updateNodeVisibility(dt) {
    const focus = this.focusId;
    const hoverSubjectId = this.hovered
      ? this.hovered.type === 'subject'
        ? this.hovered.data.id
        : this.hovered.parent
      : null;

    for (const node of this.nodes) {
      if (!node.visible) continue;
      const isSubject = node.type === 'subject';
      const subjectId = isSubject ? node.data.id : node.parent;
      let opacity = 1;
      let emissive = 0.95;
      let glow = 0.46;
      let labelOpacity = 1;
      let scale = 1;

      if (isSubject) {
        if (focus) {
          if (subjectId === focus) {
            opacity = 1;
            emissive = 1.3;
            glow = 0.5;
            labelOpacity = 1;
            scale = 1.08;
          } else {
            opacity = 0.09;
            emissive = 0.12;
            glow = 0.015;
            labelOpacity = 0.06;
            scale = 0.92;
          }
        } else {
          opacity = 1;
          emissive = 0.95;
          glow = 0.46;
          labelOpacity = 1;
          scale = 1;
        }
        if (this.hovered === node) {
          scale *= 1.14;
          glow = Math.max(glow, 0.7);
          emissive = Math.max(emissive, 1.4);
        }
      } else {
        const focused = focus === subjectId;
        const hovered = this.hovered === node;
        const inHoverSubject = !focus && hoverSubjectId === subjectId;
        if (focus) {
          if (focused) {
            opacity = 1;
            emissive = 1.35;
            glow = 0.5;
            labelOpacity = 0.92;
            scale = hovered ? 1.3 : 1;
          } else {
            opacity = 0.14;
            emissive = 0.16;
            glow = 0.03;
            labelOpacity = 0;
            scale = 0.9;
          }
        } else {
          opacity = 0.62;
          emissive = 1.05;
          glow = 0.36;
          labelOpacity = hovered || inHoverSubject ? 0.95 : 0;
          scale = hovered ? 1.3 : inHoverSubject ? 1.1 : 1;
        }
        if (hovered) {
          glow = 0.65;
          emissive = 1.55;
        }
      }

      if (this.tierFocus && !focus) {
        if (isSubject) {
          const has = (node.data.points || []).some((p) => p.tier === this.tierFocus);
          opacity = has ? 0.95 : 0.3;
          emissive = has ? 1.15 : 0.4;
          glow = has ? 0.45 : 0.08;
          labelOpacity = has ? 1 : 0.22;
          scale = has ? 1.02 : 0.94;
        } else {
          const inTier = node.data.tier === this.tierFocus;
          opacity = inTier ? 1 : 0.06;
          emissive = inTier ? 1.25 : 0.08;
          glow = inTier ? 0.55 : 0.01;
          labelOpacity = inTier ? (this.hovered === node ? 0.98 : 0.52) : 0;
          scale = inTier ? (this.hovered === node ? 1.35 : 1.12) : 0.82;
        }
      }

      node.currentOpacity = damp(node.currentOpacity, opacity, 6, dt);
      node.currentEmissive = damp(node.currentEmissive, emissive, 6, dt);
      node.currentGlow = damp(node.currentGlow, glow, 6, dt);
      node.currentScale = damp(node.currentScale, scale, 7, dt);
      node.currentLabel = damp(node.currentLabel ?? 1, labelOpacity, 8, dt);

      node.mesh.material.opacity = node.currentOpacity;
      node.mesh.material.emissiveIntensity = node.currentEmissive;
      node.mesh.scale.setScalar(node.currentScale);
      if (node.shell) {
        node.shell.material.opacity = 0.1 + node.currentOpacity * 0.22;
      }
      node.glow.material.opacity = node.currentGlow;
      node.label.material.opacity = node.currentLabel;
      node.label.visible = node.currentLabel > 0.01;
      if (node.enLabel) {
        node.enLabel.material.opacity = node.currentLabel * 0.65;
        node.enLabel.visible = node.currentLabel > 0.05;
      }
    }

    for (const edge of this.edges) {
      if (!edge.line.visible) continue;
      if (edge.type === 'child') {
        let target = focus ? (edge.subjectId === focus ? 0.5 : 0.025) : 0.24;
        if (this.hovered?.type === 'point' && this.hovered.data.id === edge.pointId) target = 0.9;
        edge.line.material.opacity = damp(edge.line.material.opacity, target, 6, dt);
      } else {
        let target = focus ? (edge.a === focus || edge.b === focus ? 0.2 : 0.015) : 0.085;
        edge.line.material.opacity = damp(edge.line.material.opacity, target, 6, dt);
        if (edge.pulse) {
          edge.pulse.material.opacity = edge.line.material.opacity * 1.8;
          if (this.time > 0) {
            const u = (this.time * 0.045 + edge.offset) % 1;
            edge.pulse.position.copy(edge.curve.getPointAt(u));
          }
        }
      }
    }
  }

  setPaused(paused) {
    this.paused = paused;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) return;
    this.time += dt;

    if (this.tween) {
      this.tween.t += dt / this.tween.duration;
      const k = easeInOutCubic(clamp(this.tween.t, 0, 1));
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k);
      if (this.tween.t >= 1) this.tween = null;
    }

    this.controls.update();
    this.updateNodeVisibility(dt);

    this.core.rotation.y += dt * 0.16;
    this.core.rotation.x = Math.sin(this.time * 0.22) * 0.1;
    this.coreWire.rotation.y -= dt * 0.08;
    this.coreWire.rotation.z += dt * 0.04;
    this.coreInner.scale.setScalar(1 + Math.sin(this.time * 1.7) * 0.035);
    this.coreRings[0].rotation.z += dt * 0.08;
    this.coreRings[1].rotation.z -= dt * 0.06;
    this.stars.rotation.y += dt * 0.0035;

    this.composer.render();
  }

  enter() {
    if (this.hasEntered) return;
    this.hasEntered = true;
    this.home = computeHomePosition();
    this.flyTo(this.home, HOME_TARGET, 1.6);
  }
}
