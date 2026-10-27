import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildDemo } from './demos/index.js';
import { disposeObject, easeInOutCubic, makeFloorRing, makeStars, glowSprite, clamp } from '../lib/visuals.js';

const DEFAULT_VIEW = { position: [8.5, 6.2, 12.5], target: [0, 1.2, 0] };

export class LabScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.active = false;
    this.paused = false;
    this.autoRotate = true;
    this.time = 0;
    this.lastTime = performance.now();
    this.tween = null;
    this.currentPoint = null;
    this.demo = null;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03050c');
    this.scene.fog = new THREE.FogExp2('#03050c', 0.016);

    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 240);
    this.camera.position.set(...DEFAULT_VIEW.position);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...DEFAULT_VIEW.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.2;
    this.controls.maxDistance = 34;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.72;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.52, 0.88)
    );
    this.composer.addPass(new OutputPass());

    this.env = new THREE.Group();
    this.scene.add(this.env);
    this.demoRoot = new THREE.Group();
    this.scene.add(this.demoRoot);

    this.buildEnvironment();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  buildEnvironment() {
    this.scene.add(new THREE.AmbientLight(0x9fb4e8, 1.9));

    const key = new THREE.DirectionalLight(0xfff4e2, 2.25);
    key.position.set(9, 14, 10);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x6c8dff, 1.45);
    rim.position.set(-10, 4, -10);
    this.scene.add(rim);

    const fill = new THREE.PointLight(0x4fc8ff, 18, 40, 2);
    fill.position.set(0, 2, 6);
    this.scene.add(fill);

    this.stars = makeStars(900, 34, 95, '#9dbdf5', 0.5);
    this.env.add(this.stars);

    const halo = glowSprite('#1d5f9e', 80, 0.12);
    halo.position.set(-8, 8, -30);
    halo.material.depthTest = false;
    this.env.add(halo);

    const floorRing = makeFloorRing(7.2, '#5fb8dd', 0.13);
    floorRing.position.y = -2.2;
    this.env.add(floorRing);

    const grid = new THREE.GridHelper(32, 32, 0x1b3c5d, 0x0e2338);
    grid.position.y = -2.22;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    grid.material.depthWrite = false;
    this.env.add(grid);
    this.floorGrid = grid;
  }

  open(point) {
    this.clearDemo();
    this.currentPoint = point;
    this.active = true;
    this.paused = false;
    this.time = 0;
    this.lastTime = performance.now();
    this.tween = null;

    const view = buildDemo(point);
    this.demo = view;
    this.demoRoot.add(view.group);
    this.scene.fog.color.set(view.fogColor || '#03050c');
    this.scene.background.set(view.background || '#03050c');
    this.floorGrid.visible = view.showGrid !== false;
    this.env.visible = view.showEnvironment !== false;

    const cameraView = view.view || DEFAULT_VIEW;
    this.setView(cameraView);
    this.autoRotate = view.autoRotate !== false;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = view.autoRotateSpeed ?? 0.42;
    this.controls.minDistance = view.minDistance ?? 4.2;
    this.controls.maxDistance = view.maxDistance ?? 34;

    this.resize();
  }

  resolveView(view) {
    const target = new THREE.Vector3(...(view.target || DEFAULT_VIEW.target));
    const position = new THREE.Vector3(...(view.position || DEFAULT_VIEW.position));
    if (window.innerWidth < 700) {
      position.sub(target).multiplyScalar(1.32).add(target);
    }
    return { target, position };
  }

  setView(view) {
    const resolved = this.resolveView(view);
    this.controls.target.copy(resolved.target);
    this.camera.position.copy(resolved.position);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  clearDemo() {
    if (this.demo) {
      this.demoRoot.remove(this.demo.group);
      disposeObject(this.demo.group);
      this.demo = null;
    }
    while (this.demoRoot.children.length) {
      const child = this.demoRoot.children[0];
      this.demoRoot.remove(child);
      disposeObject(child);
    }
  }

  close() {
    this.active = false;
    this.clearDemo();
    this.currentPoint = null;
  }

  resetView() {
    if (!this.demo) return;
    const resolved = this.resolveView(this.demo.view || DEFAULT_VIEW);
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: resolved.position,
      fromTarget: this.controls.target.clone(),
      toTarget: resolved.target,
      t: 0,
      duration: 0.9,
    };
  }

  togglePause() {
    this.paused = !this.paused;
    this.controls.autoRotate = this.autoRotate && !this.paused;
    return this.paused;
  }

  toggleRotate() {
    this.autoRotate = !this.autoRotate;
    this.controls.autoRotate = this.autoRotate && !this.paused;
    return this.autoRotate;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
    this.composer.setSize(w, h);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.active) return;
    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, 0.05));
    this.lastTime = now;

    if (this.tween) {
      this.tween.t += dt / this.tween.duration;
      const k = easeInOutCubic(clamp(this.tween.t, 0, 1));
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, k);
      this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, k);
      if (this.tween.t >= 1) this.tween = null;
    }

    this.controls.update();
    if (!this.paused) {
      this.time += dt;
      if (this.demo?.update) this.demo.update(this.time, dt);
    }
    this.env.rotation.y += dt * 0.004;
    this.composer.render();
  }
}
