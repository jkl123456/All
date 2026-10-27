import * as THREE from 'three';
import {
  BUILDINGS_BY_ID,
  EXPANSIONS_BY_ID,
  ISLAND_MAP,
} from '../data/gameData.js';
import { clamp, damp, lerp, mulberry32, smoothstep } from '../core/utils.js';
import { Player } from './Player.js';
import {
  createBoat,
  createCloud,
  createDock,
  createTree,
  getGlowTexture,
  glyphSprite,
  glowSprite,
  disposeObject,
  material,
  mesh,
  createHalo,
  setGhostAppearance,
  animateCharacter,
} from './modelKit.js';
import { buildingInteraction, createBuilding } from './buildingFactory.js';
import { GROUND_Y, buildIsland, createFarmPlotVisual } from './islandFactory.js';
import { createPostFX } from './postfx.js';
import { updateVegetationTime } from './vegetation.js';

const TMP_VEC = new THREE.Vector3();
const TMP_VEC2 = new THREE.Vector3();
const TMP_COLOR = new THREE.Color();
const TMP_COLOR2 = new THREE.Color();

const DAY_SKY = {
  dayTop: new THREE.Color('#4b8fa6'),
  dayHorizon: new THREE.Color('#d7e6da'),
  nightTop: new THREE.Color('#06141e'),
  nightHorizon: new THREE.Color('#152c38'),
  golden: new THREE.Color('#f0bd94'),
  sunDay: new THREE.Color('#fff4d5'),
  sunWarm: new THREE.Color('#ffc78f'),
  deepDay: new THREE.Color('#245c61'),
  shallowDay: new THREE.Color('#63ada3'),
  deepNight: new THREE.Color('#071b24'),
  shallowNight: new THREE.Color('#0e3038'),
};

function smoothRange(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return smoothstep(t);
}

export class World {
  constructor(container, handlers = {}) {
    this.container = container;
    this.handlers = handlers;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#b6d2c8', 0.0031);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
    this.camera.position.set(0, 20, 38);
    this.renderer = null;
    this.failed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.02;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.domElement.setAttribute('aria-label', '知屿三维世界');
      this.renderer.domElement.id = 'world-canvas';
      container.appendChild(this.renderer.domElement);
    } catch (error) {
      console.error('[知屿] WebGL 初始化失败。', error);
      this.failed = true;
      handlers.onFatal?.('无法启动 3D 世界。请确认浏览器支持 WebGL 并启用了硬件加速。');
      return;
    }

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.timeMinutes = 6 * 60 + 30;
    this.titleMode = false;
    this.buildMode = false;
    this.uiPaused = false;
    this.gameplayEnabled = false;
    this.pointerDown = false;
    this.pointerDragged = false;
    this.lastPointer = { x: 0, y: 0 };
    this.pointerNDC = new THREE.Vector2(0, 0);
    this.pointerInside = false;
    this.titleAngle = 0.3;
    this.cameraOrbit = { yaw: 0, pitch: 0.3, distance: 6.6 };
    this.cameraTarget = new THREE.Vector3(0, 2.2, 3);
    this.desiredCamera = new THREE.Vector3();
    this.currentIsland = null;
    this.currentState = null;
    this.islandGroup = new THREE.Group();
    this.islandGroup.name = 'island';
    this.scene.add(this.islandGroup);
    this.interactions = [];
    this.interactionMap = new Map();
    this.markers = [];
    this.animated = [];
    this.npcActors = [];
    this.fireflies = [];
    this.particles = [];
    this.tweens = [];
    this.blockers = [];
    this.walkZones = [];
    this.buildZones = [];
    this.ghost = null;
    this.ghostMeshes = [];
    this.ghostType = null;
    this.ghostRotation = 0;
    this.ghostValid = true;
    this.buildPoint = new THREE.Vector3(0, GROUND_Y, 4);
    this.raycaster = new THREE.Raycaster();
    this.hoverTarget = null;
    this.lastTimeSync = 0;
    this.environmentTimer = 0;
    this.nearestInteraction = null;
    this.daylight = 1;
    this.nightFactor = 0;
    this.quality = 'high';
    this.isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.resizeObserver = null;
    this.removeListeners = [];

    this.setupLights();
    this.setupEnvironment();
    this.setupSky();
    this.setupWater();
    this.setupAtmosphere();
    this.setupPlayer();
    this.bindEvents();
    this.resize();
    this.postfx = createPostFX(this.renderer, this.scene, this.camera, { strength: 0.3 });
    this.postfx.setEnabled(!this.isCoarsePointer && this.quality === 'high');
    this.updateEnvironment(this.timeMinutes);
    this.animate = this.animate.bind(this);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  setupLights() {
    this.hemisphere = new THREE.HemisphereLight('#d9eee9', '#5d6b53', 1.0);
    this.scene.add(this.hemisphere);
    this.moonLight = new THREE.DirectionalLight('#9bb6d6', 0.24);
    this.moonLight.position.set(-20, 30, -15);
    this.scene.add(this.moonLight);
    this.sunLight = new THREE.DirectionalLight('#fff0d1', 2.3);
    this.sunLight.position.set(28, 42, 18);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 120;
    this.sunLight.shadow.bias = -0.00045;
    this.sunLight.shadow.normalBias = 0.018;
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.ambient = new THREE.AmbientLight('#fff3da', 0.18);
    this.scene.add(this.ambient);
    // 逆光补光：让阴影中的树冠和崖壁保留颜色，不会变成一整片黑。
    this.fillLight = new THREE.DirectionalLight('#b8d9d2', 0.42);
    this.fillLight.position.set(-26, 18, -22);
    this.scene.add(this.fillLight);
  }

  /**
   * 用程序生成一张环境贴图：天空在上、草地在下、太阳是一颗亮球。
   * 有了 IBL，金属、玻璃和屋顶才会有细腻的高光，而不是像塑料片。
   */
  setupEnvironment() {
    if (this.isCoarsePointer) return;
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const skySphere = new THREE.Mesh(
        new THREE.SphereGeometry(60, 24, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: {
            uTop: { value: new THREE.Color('#6fa6bb') },
            uBottom: { value: new THREE.Color('#4d6b4d') },
            uSun: { value: new THREE.Color('#fff3d0') },
          },
          vertexShader: `
            varying vec3 vDir;
            void main() {
              vDir = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 uTop;
            uniform vec3 uBottom;
            uniform vec3 uSun;
            varying vec3 vDir;
            void main() {
              float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
              vec3 color = mix(uBottom, uTop, pow(h, 0.7));
              float sun = pow(max(dot(vDir, normalize(vec3(0.55, 0.62, 0.25))), 0.0), 220.0);
              color += uSun * sun * 8.0;
              gl_FragColor = vec4(color, 1.0);
            }
          `,
        }),
      );
      envScene.add(skySphere);
      const target = pmrem.fromScene(envScene, 0.02);
      this.scene.environment = target.texture;
      this.scene.environmentIntensity = 0.45;
      skySphere.geometry.dispose();
      skySphere.material.dispose();
      pmrem.dispose();
    } catch (error) {
      console.warn('[知屿] 环境贴图生成失败，继续使用普通光照。', error);
    }
  }

  setupSky() {
    const skyGeometry = new THREE.SphereGeometry(320, 32, 18);
    this.skyUniforms = {
      uTop: { value: new THREE.Color('#4b8fa6') },
      uHorizon: { value: new THREE.Color('#d7e6da') },
      uSunColor: { value: new THREE.Color('#fff1cf') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
      uDaylight: { value: 1 },
      uTime: { value: 0 },
    };
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uDaylight;
        uniform float uTime;
        varying vec3 vDirection;

        void main() {
          vec3 dir = normalize(vDirection);
          float h = clamp(dir.y, -1.0, 1.0);
          float gradient = pow(smoothstep(-0.06, 0.78, h), 0.82);
          vec3 color = mix(uHorizon, uTop, gradient);
          float sunAmount = max(dot(dir, normalize(uSunDir)), 0.0);
          color += uSunColor * pow(sunAmount, 700.0) * 2.4;
          color += uSunColor * pow(sunAmount, 12.0) * (0.1 * uDaylight + 0.02);
          float band = sin((dir.y + uTime * 0.0012) * 55.0) * 0.0035;
          color += band * (0.25 + uDaylight * 0.6);
          if (h < -0.02) {
            color = mix(color, uHorizon * 0.72, smoothstep(-0.02, -0.45, h));
          }
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);

    // 星野
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    const starSeeds = mulberry32(8801);
    for (let i = 0; i < starCount; i += 1) {
      const theta = starSeeds() * Math.PI * 2;
      const phi = Math.acos(starSeeds() * 0.96);
      const radius = 280;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = Math.cos(phi) * radius * 0.92 + 15;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: '#f6edd0',
      size: 0.85,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    this.stars.renderOrder = -90;
    this.scene.add(this.stars);

    // 日轮与月轮
    const sunGlow = glowSprite('#ffe8ae', 46, 0.32);
    const sunCore = glowSprite('#fff6d6', 15, 0.9);
    this.sunSprite = new THREE.Group();
    this.sunSprite.add(sunGlow, sunCore);
    this.scene.add(this.sunSprite);
    const moonGlow = glowSprite('#b5d2ef', 22, 0.24);
    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#e7eef8', fog: false }),
    );
    this.moonSprite = new THREE.Group();
    this.moonSprite.add(moonGlow, moonCore);
    this.scene.add(this.moonSprite);
  }

  setupWater() {
    const geo = new THREE.PlaneGeometry(460, 460, 120, 120);
    this.waterUniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#245c61') },
      uShallow: { value: new THREE.Color('#63ada3') },
      uHorizon: { value: new THREE.Color('#d7e6da') },
      uSkyTop: { value: new THREE.Color('#4b8fa6') },
      uSunColor: { value: new THREE.Color('#fff0c3') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3) },
      uDaylight: { value: 1 },
      uDeepNight: { value: DAY_SKY.deepNight.clone() },
      uShallowNight: { value: DAY_SKY.shallowNight.clone() },
      // x, z, 半径, 强度
      uShoreA: { value: new THREE.Vector4(0, 0, 20, 1) },
      uShoreB: { value: new THREE.Vector4(0, 0, 0, 0) },
    };
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: false,
      depthWrite: true,
      side: THREE.FrontSide,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vWave;
        varying float vDepthFade;
        varying float vRipple;

        void main() {
          vec3 p = position;
          float phaseA = p.x * 0.22 + uTime * 0.62;
          float phaseB = p.y * 0.31 - uTime * 0.43;
          float phaseC = (p.x + p.y) * 0.46 + uTime * 0.9;
          float phaseD = p.x * 1.35 - p.y * 0.72 + uTime * 1.7;
          float phaseE = p.x * -0.83 + p.y * 1.12 + uTime * 1.3;
          float wave = sin(phaseA) * 0.12 + sin(phaseB) * 0.085 + sin(phaseC) * 0.045
                     + sin(phaseD) * 0.026 + sin(phaseE) * 0.021;
          p.z += wave;
          float dhdx = cos(phaseA) * 0.12 * 0.22 + cos(phaseC) * 0.045 * 0.46
                     + cos(phaseD) * 0.026 * 1.35 + cos(phaseE) * 0.021 * -0.83;
          float dhdy = cos(phaseB) * 0.085 * 0.31 + cos(phaseC) * 0.045 * 0.46
                     + cos(phaseD) * 0.026 * -0.72 + cos(phaseE) * 0.021 * 1.12;
          vec3 localNormal = normalize(vec3(-dhdx, -dhdy, 1.0));
          vNormal = normalize(normalMatrix * localNormal);
          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorld = world.xyz;
          vWave = wave;
          vRipple = sin(phaseD) * 0.5 + sin(phaseE) * 0.5;
          vec4 view = viewMatrix * world;
          vDepthFade = smoothstep(-0.02, 0.32, wave);
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uHorizon;
        uniform vec3 uSkyTop;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uDaylight;
        uniform vec3 uDeepNight;
        uniform vec3 uShallowNight;
        uniform vec4 uShoreA;
        uniform vec4 uShoreB;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vWave;
        varying float vDepthFade;
        varying float vRipple;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        // 一段海岸线的浪花
        float shoreFoam(vec4 circle, vec3 world) {
          if (circle.w <= 0.001) return 0.0;
          vec2 delta = world.xz - circle.xy;
          float dist = length(delta);
          float edge = dist - circle.z;
          // 只在岛外一圈出现
          float ring = smoothstep(3.4, 0.25, abs(edge));
          float bands = 0.55 + 0.45 * sin(dist * 2.6 - uTime * 1.9 + sin(world.x * 0.7) * 1.1);
          float wash = 0.5 + 0.5 * sin(dist * 5.1 - uTime * 3.2);
          return ring * (0.28 + bands * 0.5) * (0.45 + wash * 0.55) * circle.w;
        }

        void main() {
          vec3 deep = mix(uDeepNight, uDeep, uDaylight);
          vec3 shallow = mix(uShallowNight, uShallow, uDaylight);
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(cameraPosition - vWorld);

          float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
          float crest = smoothstep(0.1, 0.2, vWave);
          vec3 base = mix(deep, shallow, smoothstep(0.1, 0.9, vDepthFade) * 0.5 + 0.16);
          base = mix(base, shallow * 1.16, crest * 0.22 * uDaylight);

          // 天空反射：越贴近水面法线越亮
          vec3 skyReflection = mix(uHorizon, uSkyTop, clamp(reflect(-viewDir, normal).y * 0.7 + 0.35, 0.0, 1.0));
          base = mix(base, skyReflection, fresnel * (0.46 + 0.24 * uDaylight));

          // 细碎波光
          vec2 sparkleUV = floor(vWorld.xz * 3.1 + uTime * 0.22);
          float sparklePattern = hash21(sparkleUV);
          vec3 reflected = reflect(-normalize(uSunDir), normal);
          float sunSpec = pow(max(dot(reflected, viewDir), 0.0), 160.0) * (2.6 * uDaylight);
          float glint = step(0.9945, sparklePattern) * pow(max(dot(reflected, viewDir), 0.0), 14.0) * 2.8 * uDaylight;
          base += uSunColor * (sunSpec + glint);

          // 近岸浅滩 + 白浪
          float foam = shoreFoam(uShoreA, vWorld) + shoreFoam(uShoreB, vWorld);
          foam = clamp(foam, 0.0, 1.0) * (0.55 + 0.45 * uDaylight);
          base = mix(base, uSunColor * 1.08, foam * 0.7);

          float dist = length(cameraPosition - vWorld);
          float fogFactor = 1.0 - exp(-pow(dist * 0.0062, 2.0));
          fogFactor = clamp(fogFactor, 0.0, 0.95);
          base = mix(base, uHorizon, fogFactor);

          gl_FragColor = vec4(base, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.water = new THREE.Mesh(geo, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.17;
    this.water.receiveShadow = false;
    this.water.renderOrder = -1;
    this.scene.add(this.water);
  }

  setupAtmosphere() {
    this.clouds = [];
    const cloudSeeds = mulberry32(8134);
    for (let i = 0; i < 9; i += 1) {
      const cloud = createCloud(1.2 + cloudSeeds() * 1.6);
      const angle = cloudSeeds() * Math.PI * 2;
      const radius = 38 + cloudSeeds() * 85;
      cloud.position.set(Math.cos(angle) * radius, 26 + cloudSeeds() * 23, Math.sin(angle) * radius);
      cloud.rotation.y = cloudSeeds() * 6;
      cloud.scale.x *= 1.3 + cloudSeeds() * 0.7;
      cloud.userData.drift = 0.2 + cloudSeeds() * 0.4;
      cloud.userData.baseX = cloud.position.x;
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }

    // 远方的邻岛剪影，给海面一个可呼吸的纵深。
    this.farIslands = new THREE.Group();
    const farSeeds = mulberry32(712);
    for (let i = 0; i < 7; i += 1) {
      const far = new THREE.Group();
      const angle = (i / 7) * Math.PI * 2 + farSeeds() * 0.4;
      const distance = 82 + farSeeds() * 36;
      const radius = 4 + farSeeds() * 7;
      const base = mesh(far, new THREE.CylinderGeometry(radius * 0.8, radius * 1.35, 4.2, 7), material('#5d7168', { roughness: 1 }), [0, 0.5, 0]);
      base.castShadow = false;
      base.receiveShadow = false;
      mesh(far, new THREE.CylinderGeometry(radius * 0.9, radius, 1.1, 7), material('#7d9b7a', { roughness: 1 }), [0, 2.6, 0]);
      for (let j = 0; j < 3; j += 1) {
        const tree = createTree(j % 2 ? 'pine' : 'broadleaf', { leaf: '#678a67' }, 200 + i * 5 + j);
        tree.position.set((farSeeds() - 0.5) * radius, 3.05, (farSeeds() - 0.5) * radius);
        tree.scale.setScalar(0.55 + farSeeds() * 0.4);
        far.add(tree);
      }
      far.position.set(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
      far.rotation.y = farSeeds() * Math.PI;
      this.farIslands.add(far);
    }
    this.scene.add(this.farIslands);

    // 海鸟
    this.birds = [];
    for (let i = 0; i < 4; i += 1) {
      const bird = new THREE.Group();
      const mat = new THREE.LineBasicMaterial({ color: '#3f514e', transparent: true, opacity: 0.6, fog: true });
      const points = new Float32Array([-0.6, 0, 0, 0, 0.2, 0.12, 0.6, 0, 0]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
      const line = new THREE.Line(geometry, mat);
      bird.add(line);
      bird.scale.setScalar(1 + i * 0.2);
      bird.userData = { radius: 17 + i * 5, speed: 0.04 + i * 0.009, y: 13 + i * 2.2, phase: i * 1.8 };
      this.scene.add(bird);
      this.birds.push(bird);
    }

    this.ambientGroup = new THREE.Group();
    this.scene.add(this.ambientGroup);
  }

  setupPlayer() {
    this.player = new Player({
      groundY: GROUND_Y,
      onFootstep: () => this.handlers.onFootstep?.(),
    });
    this.scene.add(this.player.root);
    this.playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshBasicMaterial({ color: '#1a2d26', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.renderOrder = 2;
    this.scene.add(this.playerShadow);
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    const onPointerDown = (event) => {
      if (!this.gameplayEnabled || event.button !== 0) return;
      this.pointerDown = true;
      this.pointerDragged = false;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture?.(event.pointerId);
      canvas.classList.add('is-dragging');
    };
    const onPointerMove = (event) => {
      this.updatePointer(event);
      if (this.pointerDown) {
        const dx = event.clientX - this.lastPointer.x;
        const dy = event.clientY - this.lastPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 2.5) this.pointerDragged = true;
        if (this.pointerDragged) {
          this.cameraOrbit.yaw -= dx * 0.006;
          this.cameraOrbit.pitch = clamp(this.cameraOrbit.pitch + dy * 0.0042, -0.1, 1.05);
        }
        this.lastPointer = { x: event.clientX, y: event.clientY };
      }
      if (this.buildMode) this.updateBuildFromPointer();
      this.updateHover();
    };
    const onPointerUp = (event) => {
      if (!this.pointerDown) return;
      this.pointerDown = false;
      canvas.classList.remove('is-dragging');
      this.updatePointer(event);
      try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
      if (this.pointerDragged) return;
      if (this.buildMode) {
        // 触屏没有 hover；必须在抬手时按点击位置刷新一次预览，否则会放在旧位置。
        this.updateBuildFromPointer();
        this.attemptPlaceBuilding();
      } else {
        this.attemptClickInteract();
      }
    };
    const onPointerLeave = () => {
      this.pointerInside = false;
      this.hoverTarget = null;
      canvas.style.cursor = 'grab';
    };
    const onWheel = (event) => {
      if (!this.gameplayEnabled) return;
      event.preventDefault();
      this.cameraOrbit.distance = clamp(this.cameraOrbit.distance + event.deltaY * 0.006, 2.6, 16);
    };
    const onContextMenu = (event) => event.preventDefault();
    const onKeyDown = (event) => {
      if (!this.gameplayEnabled) return;
      if (this.isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (!this.uiPaused && !this.buildMode) {
          event.preventDefault();
          this.keys.add(key);
        }
      }
      if (key === 'shift') this.keys.add('shift');
      if (key === 'e' && !event.repeat && !this.uiPaused) {
        event.preventDefault();
        this.interactNearest();
      }
    };
    const onKeyUp = (event) => {
      this.keys.delete(event.key.toLowerCase());
    };
    const onBlur = () => this.keys.clear();
    const onVisibility = () => {
      if (document.hidden) this.keys.clear();
    };
    const onResize = () => this.resize();
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    this.keys = new Set();
    this.removeListeners.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    });
    this.joystick = { active: false, x: 0, z: 0 };
  }

  isTypingTarget(target) {
    return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  }

  resize() {
    if (!this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const dpr = this.renderer.getPixelRatio();
    this.postfx?.setSize(Math.floor(width * dpr), Math.floor(height * dpr));
  }

  updatePointer(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointerInside = true;
  }

  setQuality(quality) {
    this.quality = quality;
    if (!this.renderer) return;
    if (quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
    }
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.postfx?.setEnabled(quality === 'high' && !this.isCoarsePointer);
    this.postfx?.setStrength(quality === 'high' ? 0.3 : 0.2);
  }

  setTimeOfDay(minutes) {
    this.timeMinutes = ((minutes % 1440) + 1440) % 1440;
  }

  setTitleMode(enabled) {
    this.titleMode = enabled;
    this.player.setVisible(!enabled);
    this.playerShadow.visible = !enabled;
    if (enabled) {
      this.gameplayEnabled = false;
      this.setBuildMode(false);
      this.hideInteractionPrompt?.();
    }
  }

  beginGameplay() {
    this.titleMode = false;
    this.gameplayEnabled = true;
    this.player.setVisible(true);
    this.playerShadow.visible = true;
    this.snapCamera();
  }

  snapCamera() {
    this.cameraTarget.copy(this.player.getCameraTarget(TMP_VEC));
    const { yaw, pitch, distance } = this.cameraOrbit;
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(yaw) * distance * Math.cos(pitch),
      this.cameraTarget.y + Math.sin(pitch) * distance,
      this.cameraTarget.z + Math.cos(yaw) * distance * Math.cos(pitch),
    );
    this.camera.lookAt(this.cameraTarget);
  }

  setUiPaused(paused) {
    this.uiPaused = paused;
    if (paused) this.keys.clear();
  }

  setInputEnabled(enabled) {
    this.gameplayEnabled = enabled;
    if (!enabled) this.keys.clear();
  }

  setJoystick(x, z, active = true) {
    this.joystick = { x, z, active };
  }

  get currentInteractions() {
    return this.interactions;
  }

  loadIsland(islandId, state, options = {}) {
    const island = ISLAND_MAP[islandId] ?? ISLAND_MAP.home;
    const previousPlayer = { x: this.player.root.position.x, z: this.player.root.position.z };
    const preserve = Boolean(options.preservePlayer);
    this.teardownIsland();
    this.currentIsland = island;
    this.currentState = state;
    const result = buildIsland({ island, state, seed: island.order * 37 + 71, quality: state?.settings?.quality ?? this.quality });
    this.islandGroup = new THREE.Group();
    this.islandGroup.name = `island-${islandId}`;
    this.islandGroup.add(result.group);
    this.scene.add(this.islandGroup);
    this.walkZones = result.navZones;
    this.buildZones = result.buildZones;
    this.blockers = result.blockers;
    this.solidBlockers = result.solid ?? [];
    this.titleFocus = result.titleFocus ?? new THREE.Vector3(0, 2, 0);
    this.titleRadius = result.titleRadius ?? 32;
    this.interactions = [];
    this.interactionMap.clear();
    this.npcActors = [];
    this.markers = [];
    this.fireflies = [];
    result.interactions.forEach((interaction) => this.registerInteraction(interaction));
    result.group.traverse((object) => {
      if (object.userData?.tick) this.animated.push(object);
    });
    this.setupIslandAmbience(island, result.group);

    let spawn = result.spawn;
    if (options.spawn) spawn = options.spawn;
    if (preserve) spawn = previousPlayer;
    if (!this.isWalkable(spawn.x, spawn.z)) {
      const saved = state?.player;
      if (saved && this.isWalkable(saved.x, saved.z)) spawn = { x: saved.x, z: saved.z };
      else spawn = { x: 0, z: 2.0 };
    }
    this.player.setPosition(spawn.x, spawn.z, Math.PI);
    // 苔溪镇的取景：贴着肩膀的第三人称，距离 6.6，俯角 0.3
    if (island.id === 'home') {
      this.cameraOrbit.yaw = 0.12;
      this.cameraOrbit.pitch = 0.3;
      this.cameraOrbit.distance = 6.6;
    } else {
      this.cameraOrbit.yaw = 0.5;
      this.cameraOrbit.pitch = 0.3;
      this.cameraOrbit.distance = 6.6;
    }
    this.playerShadow.position.set(spawn.x, GROUND_Y + 0.025, spawn.z);
    if (this.titleMode) {
      this.positionTitleCamera();
    } else {
      this.snapCamera();
    }
    this.updateWaterPalette(island);
    this.updateEnvironment(this.timeMinutes);
    this.environmentTimer = 0;
    return { spawn, island: result };
  }

  teardownIsland() {
    if (this.islandGroup) {
      // 标记贴图是每座岛独有的，随岛一起释放；资源微光使用共享的辉光贴图。
      this.markers.forEach((marker) => {
        if (marker.userData?.uniqueTexture) marker.material?.map?.dispose?.();
        marker.material?.dispose?.();
      });
      this.islandGroup.traverse((object) => {
        if (object.userData?.tick) object.userData.tick = null;
      });
      this.islandGroup.children.forEach((child) => {
        disposeObject(child);
      });
      this.islandGroup.removeFromParent();
    }
    // 清空每岛生成的微光精灵，避免跨岛累积。
    if (this.ambientGroup) {
      while (this.ambientGroup.children.length) {
        const child = this.ambientGroup.children.pop();
        child.material?.dispose?.();
      }
    }
    this.interactions = [];
    this.interactionMap.clear();
    this.markers = [];
    this.animated = [];
    this.npcActors = [];
    this.fireflies = [];
    this.blockers = [];
    this.solidBlockers = [];
    this.walkZones = [];
    this.buildZones = [];
    this.buildMode = false;
    this.ghost = null;
    this.ghostMeshes = [];
    this.buildZoneGroup = null;
  }

  registerInteraction(interaction) {
    if (!interaction?.object) return;
    interaction.id = interaction.id ?? `interaction-${this.interactions.length}`;
    interaction.disabled = false;
    interaction.object.userData.interactionId = interaction.id;
    this.interactions.push(interaction);
    this.interactionMap.set(interaction.id, interaction);
    if (interaction.glyph) {
      const marker = glyphSprite(interaction.glyph, interaction.markerColor ?? '#e5ca8d', 0.8);
      marker.userData.interactionId = interaction.id;
      marker.userData.phase = Math.random() * Math.PI * 2;
      marker.userData.uniqueTexture = true;
      marker.renderOrder = 10;
      this.islandGroup.add(marker);
      interaction.marker = marker;
      this.markers.push(marker);
    } else if (interaction.kind === 'gather') {
      // 可采集资源不挂大标签，只在树冠/岩缝上点一枚会呼吸的微光。
      const marker = glowSprite(interaction.markerColor ?? '#dfe3b1', 0.34, 0.24);
      marker.userData.interactionId = interaction.id;
      marker.userData.phase = Math.random() * Math.PI * 2;
      marker.userData.gatherGlow = true;
      this.islandGroup.add(marker);
      interaction.marker = marker;
      this.markers.push(marker);
    }
    if (interaction.object.userData?.rig) {
      const isWanderer = Boolean(interaction.data?.wander);
      this.npcActors.push({
        interaction,
        character: interaction.object,
        wander: isWanderer,
        base: { x: interaction.object.position.x, z: interaction.object.position.z },
        target: { x: interaction.object.position.x, z: interaction.object.position.z },
        wait: 1.5 + Math.random() * 4,
        speed: 0,
        facing: interaction.object.rotation.y,
        phase: Math.random() * 10,
      });
      if (!isWanderer) {
        interaction.object.userData.facePlayer = true;
      }
    }
  }

  setupIslandAmbience(island, group) {
    const rng = mulberry32(island.order * 13 + 5);
    const fireflyCount = island.id === 'home' ? 26 : 20;
    for (let i = 0; i < fireflyCount; i += 1) {
      const sprite = glowSprite(i % 3 === 0 ? '#ffe6a2' : island.accent, 0.17 + rng() * 0.18, 0.42);
      const angle = rng() * Math.PI * 2;
      const radius = rng() * island.walkRadius * 0.9;
      sprite.position.set(Math.cos(angle) * radius, GROUND_Y + 0.5 + rng() * 2.4, Math.sin(angle) * radius);
      sprite.userData.phase = rng() * 10;
      sprite.userData.baseY = sprite.position.y;
      sprite.userData.radius = radius;
      sprite.userData.angle = angle;
      this.ambientGroup.add(sprite);
      this.fireflies.push(sprite);
    }
    // 每座岛一只缓慢绕岛的舟影，作为远景细节。
    if (island.id !== 'home') {
      const boat = createBoat(island.accent);
      boat.scale.setScalar(0.75);
      boat.position.set(-island.radius * 0.72, 0.25, island.radius * 0.8);
      boat.rotation.y = -0.6;
      this.islandGroup.add(boat);
      boat.userData.tick = (time) => {
        boat.position.x = -island.radius * 0.72 + Math.sin(time * 0.08) * 3;
        boat.position.z = island.radius * 0.8 + Math.cos(time * 0.08) * 2;
        boat.rotation.z = Math.sin(time * 0.6) * 0.02;
      };
      this.animated.push(boat);
    }
  }

  updateWaterPalette(island) {
    if (!this.waterUniforms) return;
    const palette = island?.palette ?? {};
    const marine = new THREE.Color(palette.marine ?? '#245c61');
    const shallow = new THREE.Color(palette.grass ?? '#63ada3').lerp(new THREE.Color('#70c4b5'), 0.5);
    this.waterUniforms.uDeep.value.copy(marine);
    this.waterUniforms.uShallow.value.copy(shallow);
    this.updateShoreCircles(island);
  }

  updateShoreCircles(island) {
    if (!this.waterUniforms) return;
    const baseRadius = island?.radius ?? 20;
    this.waterUniforms.uShoreA.value.set(0, 0, baseRadius, 1);
    const expansions = this.currentState?.expansions ?? [];
    const first = expansions[0] ? EXPANSIONS_BY_ID?.[expansions[0]] : null;
    if (first) {
      this.waterUniforms.uShoreB.value.set(first.center.x, first.center.z, first.radius, 1);
    } else {
      this.waterUniforms.uShoreB.value.set(0, 0, 0, 0);
    }
  }

  positionTitleCamera() {
    const center = this.titleFocus ?? new THREE.Vector3(0, 2, 0);
    const radius = this.titleRadius ?? 32;
    const angle = this.titleAngle;
    this.camera.position.set(
      center.x + Math.sin(angle) * radius,
      center.y + 13.5 + Math.sin(this.elapsed * 0.09) * 1.2,
      center.z + Math.cos(angle) * radius,
    );
    this.camera.lookAt(center.x, center.y + 0.6, center.z);
    this.cameraTarget.copy(center);
  }

  updateTitleCamera(dt) {
    this.titleAngle += dt * 0.035;
    this.positionTitleCamera();
  }

  updateFollowCamera(dt) {
    this.cameraTarget.lerp(this.player.getCameraTarget(TMP_VEC), 1 - Math.exp(-5.5 * dt));
    const { yaw, pitch } = this.cameraOrbit;
    let distance = this.cameraOrbit.distance;
    // 镜头不穿墙：沿「目标点 → 机位」取样，撞到房子就把机位收回来（苔溪镇同款处理）
    if (this.solidBlockers?.length) {
      const dirX = Math.sin(yaw) * Math.cos(pitch);
      const dirZ = Math.cos(yaw) * Math.cos(pitch);
      const steps = 16;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const px = this.cameraTarget.x + dirX * distance * t;
        const pz = this.cameraTarget.z + dirZ * distance * t;
        let blocked = false;
        for (const blocker of this.solidBlockers) {
          if (Math.hypot(px - blocker.x, pz - blocker.z) < blocker.radius * 0.9) {
            blocked = true;
            break;
          }
        }
        if (blocked) {
          distance = Math.max(2.2, distance * ((i - 1) / steps));
          break;
        }
      }
    }
    const targetPos = TMP_VEC2.set(
      this.cameraTarget.x + Math.sin(yaw) * distance * Math.cos(pitch),
      this.cameraTarget.y + Math.sin(pitch) * distance,
      this.cameraTarget.z + Math.cos(yaw) * distance * Math.cos(pitch),
    );
    const minHeight = GROUND_Y + 1.0;
    if (targetPos.y < minHeight) targetPos.y = minHeight;
    this.camera.position.lerp(targetPos, 1 - Math.exp(-4.8 * dt));
    this.camera.lookAt(this.cameraTarget);
  }

  getMovementInput() {
    if (this.buildMode || this.uiPaused) return { moveX: 0, moveZ: 0, run: false };
    let x = 0;
    let z = 0;
    if (this.joystick.active) {
      x = this.joystick.x;
      z = this.joystick.z;
    } else {
      if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
      if (this.keys.has('w') || this.keys.has('arrowup')) z += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) z -= 1;
    }
    return {
      moveX: x,
      moveZ: z,
      run: this.keys.has('shift'),
    };
  }

  isWalkable(x, z) {
    let inside = false;
    for (const zone of this.walkZones) {
      if (zone.type === 'circle' && Math.hypot(x - zone.x, z - zone.z) <= zone.r) {
        inside = true;
        break;
      }
      if (zone.type === 'rect' && x >= zone.x1 && x <= zone.x2 && z >= zone.z1 && z <= zone.z2) {
        inside = true;
        break;
      }
    }
    if (!inside) return false;
    // 村子的房子与学问碑是实心的。允许从里面往外走，避免卡在墙里出不来。
    if (!this.solidBlockers?.length) return true;
    const px = this.player?.root.position.x ?? x;
    const pz = this.player?.root.position.z ?? z;
    for (const blocker of this.solidBlockers) {
      const insideNext = Math.hypot(x - blocker.x, z - blocker.z) < blocker.radius;
      if (!insideNext) continue;
      const insideNow = Math.hypot(px - blocker.x, pz - blocker.z) < blocker.radius;
      if (!insideNow) return false;
    }
    return true;
  }

  animate() {
    if (!this.renderer) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.045);
    this.elapsed += dt;
    this.timeAccumulator = (this.timeAccumulator ?? 0) + dt;
    if (this.titleMode) {
      this.updateTitleCamera(dt);
    } else if (this.gameplayEnabled) {
      this.updateFollowCamera(dt);
    }
    if (this.player) {
      const input = this.getMovementInput();
      const paused = !this.gameplayEnabled || this.titleMode || this.uiPaused || this.buildMode;
      this.player.update(dt, {
        ...input,
        cameraYaw: this.cameraOrbit.yaw,
        walkable: (x, z) => this.isWalkable(x, z),
        paused,
      });
      this.playerShadow.position.set(this.player.root.position.x, GROUND_Y + 0.02, this.player.root.position.z);
      this.playerShadow.material.opacity = 0.17 + this.daylight * 0.08;
    }
    this.updateNpcs(dt);
    this.updateMarkers();
    this.updateAnimated(dt);
    this.updateFireflies(dt);
    this.updateParticles(dt);
    this.updateTweens(dt);
    this.updateAtmosphere(dt);
    this.updateEnvironmentIfNeeded(dt);
    this.updateNearest();
    this.handlers.onFrame?.(dt);
    if (this.waterUniforms) this.waterUniforms.uTime.value = this.elapsed;
    if (this.skyUniforms) this.skyUniforms.uTime.value = this.elapsed;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.stars.rotation.y += dt * 0.0014;
    updateVegetationTime(this.elapsed);
    if (this.postfx) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  updateNpcs(dt) {
    const now = this.elapsed;
    for (const actor of this.npcActors) {
      const character = actor.character;
      if (!character?.userData?.rig) continue;
      if (actor.wander && !this.uiPaused && !this.buildMode) {
        if (actor.wait > 0) {
          actor.wait -= dt;
          actor.speed = damp(actor.speed, 0, 8, dt);
          const dx = this.player.root.position.x - character.position.x;
          const dz = this.player.root.position.z - character.position.z;
          if (Math.hypot(dx, dz) < 4.5) {
            const target = Math.atan2(dx, dz);
            actor.facing = dampAngle(actor.facing, target, 2.5, dt);
            character.rotation.y = actor.facing;
          }
        } else {
          const dx = actor.target.x - character.position.x;
          const dz = actor.target.z - character.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.25) {
            actor.wait = 2.5 + Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.0 + Math.random() * 3.2;
            const nx = actor.base.x + Math.cos(angle) * radius;
            const nz = actor.base.z + Math.sin(angle) * radius;
            if (this.isWalkable(nx, nz) && Math.hypot(nx - this.player.root.position.x, nz - this.player.root.position.z) > 1.3) {
              actor.target = { x: nx, z: nz };
            }
            actor.speed = damp(actor.speed, 0, 8, dt);
          } else {
            const speedTarget = 1.05;
            actor.speed = damp(actor.speed, speedTarget, 5, dt);
            const stepX = (dx / dist) * actor.speed * dt;
            const stepZ = (dz / dist) * actor.speed * dt;
            const nextX = character.position.x + stepX;
            const nextZ = character.position.z + stepZ;
            if (this.isWalkable(nextX, nextZ)) {
              character.position.x = nextX;
              character.position.z = nextZ;
            } else {
              actor.wait = 1;
            }
            const target = Math.atan2(dx, dz);
            actor.facing = dampAngle(actor.facing, target, 6, dt);
            character.rotation.y = actor.facing;
          }
        }
      } else {
        actor.speed = damp(actor.speed, 0, 8, dt);
        if (!actor.wander) {
          const dx = this.player.root.position.x - character.position.x;
          const dz = this.player.root.position.z - character.position.z;
          if (Math.hypot(dx, dz) < 5.5 && !this.titleMode) {
            actor.facing = dampAngle(actor.facing, Math.atan2(dx, dz), 1.8, dt);
            character.rotation.y = actor.facing;
          }
        }
      }
      animateCharacter(character, now + actor.phase, actor.speed);
    }
  }

  updateMarkers() {
    for (const marker of this.markers) {
      const interaction = this.interactionMap.get(marker.userData.interactionId);
      if (!interaction || interaction.disabled || !interaction.object?.visible) {
        marker.visible = false;
        continue;
      }
      marker.visible = true;
      interaction.object.getWorldPosition(TMP_VEC);
      if (marker.userData.gatherGlow) {
        const top = interaction.markerHeight ? Math.min(interaction.markerHeight * 0.5, 1.7) : 1.1;
        marker.position.set(
          TMP_VEC.x,
          TMP_VEC.y + top + Math.sin(this.elapsed * 1.3 + marker.userData.phase) * 0.12,
          TMP_VEC.z,
        );
        marker.material.opacity = 0.14 + Math.sin(this.elapsed * 1.1 + marker.userData.phase) * 0.06;
        marker.scale.setScalar(0.26 + Math.sin(this.elapsed * 1.4 + marker.userData.phase) * 0.03);
        continue;
      }
      const height = interaction.markerHeight ?? 2.8;
      marker.position.set(
        TMP_VEC.x,
        TMP_VEC.y + height + Math.sin(this.elapsed * 1.6 + marker.userData.phase) * 0.11,
        TMP_VEC.z,
      );
      marker.material.opacity = 0.8 + Math.sin(this.elapsed * 1.3 + marker.userData.phase) * 0.14;
      const scale = 0.8 + Math.sin(this.elapsed * 1.1 + marker.userData.phase) * 0.025;
      marker.scale.set(scale, scale, 1);
    }
  }

  updateAnimated(dt) {
    for (const object of this.animated) {
      if (!object.userData.tick) continue;
      object.userData.tick(this.elapsed, dt, this.nightFactor);
    }
  }

  updateFireflies(dt) {
    if (!this.fireflies) return;
    const opacityBase = this.nightFactor * 0.55;
    this.fireflies.forEach((sprite, index) => {
      sprite.material.opacity = Math.max(0, opacityBase + Math.sin(this.elapsed * 0.8 + sprite.userData.phase) * 0.12);
      sprite.visible = this.nightFactor > 0.12;
      const angle = sprite.userData.angle + Math.sin(this.elapsed * 0.08 + index) * 0.2;
      sprite.position.x = Math.cos(angle) * sprite.userData.radius;
      sprite.position.z = Math.sin(angle) * sprite.userData.radius;
      sprite.position.y = sprite.userData.baseY + Math.sin(this.elapsed * 0.9 + sprite.userData.phase) * 0.3;
    });
  }

  updateAtmosphere(dt) {
    this.clouds.forEach((cloud) => {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 130) cloud.position.x = -130;
    });
    this.birds.forEach((bird) => {
      const data = bird.userData;
      const angle = this.elapsed * data.speed + data.phase;
      bird.position.set(Math.cos(angle) * data.radius, data.y + Math.sin(angle * 2) * 0.8, Math.sin(angle) * data.radius);
      bird.rotation.y = -angle - Math.PI / 2;
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const system = this.particles[i];
      system.age += dt;
      const positions = system.points.geometry.attributes.position.array;
      for (let p = 0; p < system.velocities.length / 3; p += 1) {
        system.velocities[p * 3 + 1] -= 3.4 * dt;
        positions[p * 3] += system.velocities[p * 3] * dt;
        positions[p * 3 + 1] += system.velocities[p * 3 + 1] * dt;
        positions[p * 3 + 2] += system.velocities[p * 3 + 2] * dt;
      }
      system.points.geometry.attributes.position.needsUpdate = true;
      system.points.material.opacity = Math.max(0, 1 - system.age / system.life);
      if (system.age >= system.life) {
        system.points.material.dispose();
        system.points.geometry.dispose();
        system.points.removeFromParent();
        this.particles.splice(i, 1);
      }
    }
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const tween = this.tweens[i];
      tween.age += dt;
      const progress = clamp(tween.age / tween.duration, 0, 1);
      if (tween.update) {
        tween.update(progress);
      } else {
        const eased = 1 - Math.pow(1 - progress, 3);
        tween.object.scale.setScalar(Math.max(0.001, 1 - eased));
        tween.object.position.y = tween.startY - eased * 0.3;
        tween.object.rotation.y += dt * 2.4;
      }
      if (progress >= 1) {
        tween.object.visible = false;
        this.tweens.splice(i, 1);
      }
    }
  }

  updateEnvironmentIfNeeded(dt) {
    this.environmentTimer += dt;
    if (this.environmentTimer < 0.25) return;
    this.environmentTimer = 0;
    this.updateEnvironment(this.timeMinutes);
  }

  updateEnvironment(minutes) {
    if (!this.skyUniforms) return;
    const angle = ((minutes - 360) / 720) * Math.PI;
    const sunHeight = Math.sin(angle);
    const daylight = smoothRange(-0.12, 0.24, sunHeight);
    const golden = clamp(1 - Math.abs(sunHeight) * 2.6, 0, 1) * smoothRange(-0.25, 0.08, sunHeight);
    this.daylight = daylight;
    this.nightFactor = 1 - daylight;
    const sunDir = TMP_VEC.set(Math.cos(angle) * 0.78, Math.max(sunHeight, -0.6), 0.28).normalize().clone();
    this.sunDirection = sunDir;
    this.skyUniforms.uSunDir.value.copy(sunDir);
    const dayTop = DAY_SKY.dayTop;
    const dayHorizon = DAY_SKY.dayHorizon;
    TMP_COLOR.copy(DAY_SKY.nightTop).lerp(dayTop, daylight);
    TMP_COLOR2.copy(DAY_SKY.nightHorizon).lerp(dayHorizon, daylight);
    TMP_COLOR2.lerp(DAY_SKY.golden, golden * 0.58);
    this.skyUniforms.uTop.value.copy(TMP_COLOR);
    this.skyUniforms.uHorizon.value.copy(TMP_COLOR2);
    this.skyUniforms.uDaylight.value = daylight;
    this.skyUniforms.uSunColor.value.copy(DAY_SKY.sunWarm).lerp(DAY_SKY.sunDay, clamp(sunHeight * 1.6, 0, 1));
    this.waterUniforms.uSunDir.value.copy(sunDir);
    this.waterUniforms.uSunColor.value.copy(this.skyUniforms.uSunColor.value);
    this.waterUniforms.uHorizon.value.copy(TMP_COLOR2);
    this.waterUniforms.uDaylight.value = daylight;
    this.scene.fog.color.copy(TMP_COLOR2).lerp(TMP_COLOR, 0.28);
    this.starMaterial.opacity = Math.pow(this.nightFactor, 1.6) * 0.9;
    this.stars.visible = this.nightFactor > 0.02;

    this.sunLight.position.copy(sunDir).multiplyScalar(55).add(new THREE.Vector3(0, 5, 0));
    this.sunLight.target.position.set(this.player?.root.position.x ?? 0, 0, this.player?.root.position.z ?? 0);
    this.sunLight.intensity = 0.05 + daylight * 2.3;
    this.sunLight.color.copy(DAY_SKY.sunWarm).lerp(DAY_SKY.sunDay, clamp(sunHeight * 1.3 + 0.25, 0, 1));
    this.hemisphere.intensity = 0.13 + daylight * 0.5;
    this.hemisphere.color.copy(TMP_COLOR).lerp(new THREE.Color('#ffffff'), 0.42);
    this.hemisphere.groundColor.set(daylight > 0.2 ? '#60745c' : '#263638');
    this.ambient.intensity = 0.08 + daylight * 0.15;
    this.fillLight.intensity = 0.2 + daylight * 0.26;
    this.fillLight.color.set(daylight > 0.25 ? '#bfe0d8' : '#7f9fb5');
    this.moonLight.intensity = this.nightFactor * 0.32;
    this.renderer.toneMappingExposure = 0.94 + daylight * 0.1;

    const sunPos = TMP_VEC.copy(sunDir).multiplyScalar(250).add(this.camera.position);
    this.sunSprite.position.copy(sunPos);
    this.sunSprite.visible = sunHeight > -0.16;
    this.sunSprite.children[0].material.opacity = 0.2 + daylight * 0.24;
    this.sunSprite.children[1].material.opacity = 0.5 + daylight * 0.4;
    const moonDir = TMP_VEC2.copy(sunDir).multiplyScalar(-1);
    this.moonSprite.position.copy(moonDir.multiplyScalar(240)).add(this.camera.position);
    this.moonSprite.visible = this.nightFactor > 0.15;
    this.moonSprite.children[0].material.opacity = 0.18 * this.nightFactor;
    this.moonSprite.children[1].material.color.set('#dfeaf6');
    this.skyUniforms.uTime.value = this.elapsed;
    this.sunSprite.position.y = Math.max(this.sunSprite.position.y, this.camera.position.y - 35);
  }

  updateHover() {
    if (!this.gameplayEnabled || this.buildMode) {
      if (this.renderer) this.renderer.domElement.style.cursor = this.buildMode ? 'crosshair' : 'default';
      return;
    }
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const roots = [
      ...this.interactions.filter((interaction) => !interaction.disabled && interaction.object).map((interaction) => interaction.object),
      ...this.markers.filter((marker) => marker.visible),
    ];
    const hits = this.raycaster.intersectObjects(roots, true);
    let found = null;
    if (hits.length) {
      let object = hits[0].object;
      while (object && !object.userData?.interactionId) object = object.parent;
      if (object?.userData?.interactionId) found = this.interactionMap.get(object.userData.interactionId);
    }
    this.hoverTarget = found;
    if (this.renderer) this.renderer.domElement.style.cursor = found ? 'pointer' : 'grab';
  }

  updateNearest() {
    if (!this.gameplayEnabled || this.buildMode || this.uiPaused || this.titleMode) {
      this.nearestInteraction = null;
      return;
    }
    let nearest = null;
    let nearestDistance = Infinity;
    const px = this.player.root.position.x;
    const pz = this.player.root.position.z;
    for (const interaction of this.interactions) {
      if (interaction.disabled || !interaction.object?.visible) continue;
      interaction.object.getWorldPosition(TMP_VEC);
      const distance = Math.hypot(TMP_VEC.x - px, TMP_VEC.z - pz);
      const range = interaction.range ?? 3.2;
      if (distance <= range && distance < nearestDistance) {
        nearest = interaction;
        nearestDistance = distance;
      }
    }
    this.nearestInteraction = nearest;
  }

  getNearestInteraction() {
    return this.nearestInteraction;
  }

  interactNearest() {
    const nearest = this.nearestInteraction ?? this.getNearestInteraction();
    if (!nearest) {
      this.handlers.onEmptyInteract?.();
      return;
    }
    this.handlers.onInteract?.(nearest);
  }

  attemptClickInteract() {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const roots = [
      ...this.interactions.filter((interaction) => !interaction.disabled && interaction.object?.visible).map((interaction) => interaction.object),
      ...this.markers.filter((marker) => marker.visible),
    ];
    const hits = this.raycaster.intersectObjects(roots, true);
    if (!hits.length) return;
    let object = hits[0].object;
    while (object && !object.userData?.interactionId) object = object.parent;
    if (!object?.userData?.interactionId) return;
    const interaction = this.interactionMap.get(object.userData.interactionId);
    if (!interaction) return;
    interaction.object.getWorldPosition(TMP_VEC);
    const distance = Math.hypot(TMP_VEC.x - this.player.root.position.x, TMP_VEC.z - this.player.root.position.z);
    if (distance <= (interaction.range ?? 3.2) + 0.7) {
      this.handlers.onInteract?.(interaction);
    } else {
      this.handlers.onMessage?.('再走近一些，才能看清它。');
    }
  }

  disableInteraction(id) {
    const interaction = this.interactionMap.get(id);
    if (!interaction) return;
    interaction.disabled = true;
    if (interaction.marker) interaction.marker.visible = false;
  }

  gatherEffect(interaction) {
    if (!interaction?.object) return;
    // 采集动作：mox/ren 里的 Gathering Objects
    this.player?.playAction?.('Gather');
    this.disableInteraction(interaction.id);
    const object = interaction.object;
    object.getWorldPosition(TMP_VEC);
    const pos = TMP_VEC.clone();
    pos.y += 0.5;
    this.spawnBurst(pos, interaction.markerColor ?? '#e8cf96', 22, 1.2);
    this.tweens.push({
      object,
      age: 0,
      duration: 0.42,
      startY: object.position.y,
    });
  }

  spawnBurst(position, color = '#f4d48e', count = 20, strength = 1) {
    if (!this.renderer) return;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.6 + Math.random() * 1.4) * strength;
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = 1.2 + Math.random() * 2.2;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.19,
      map: getGlowTexture(),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, mat);
    points.frustumCulled = false;
    this.islandGroup.add(points);
    this.particles.push({ points, velocities, age: 0, life: 1.2 });
  }

  spawnRing(position, color = '#efd694') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = GROUND_Y + 0.06;
    this.islandGroup.add(ring);
    this.tweens.push({ object: ring, age: 0, duration: 0.8, startY: ring.position.y, isRing: true });
    // 环形需要缩放而非模型 shrink；把 tween 标记覆盖为自定义更新。
    const tween = this.tweens[this.tweens.length - 1];
    tween.update = (progress) => {
      ring.scale.setScalar(1 + progress * 4);
      ring.material.opacity = (1 - progress) * 0.75;
    };
    tween.update(0);
  }

  setBuildMode(enabled) {
    if (!enabled) {
      this.buildMode = false;
      this.setBuildZonesVisible(false);
      this.removeGhost();
      if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
      return;
    }
    this.buildMode = true;
    this.keys.clear();
    this.setBuildZonesVisible(true);
    if (this.renderer) this.renderer.domElement.style.cursor = 'crosshair';
    if (!this.ghost) {
      // 默认放在玩家前方，方便直接看到建造预览。
      const forward = TMP_VEC.set(-Math.sin(this.player.facing), 0, -Math.cos(this.player.facing)).multiplyScalar(4.4);
      this.buildPoint.set(
        this.player.root.position.x + forward.x,
        GROUND_Y,
        this.player.root.position.z + forward.z,
      );
    }
  }

  setBuildType(type, tier) {
    this.buildMode = true;
    this.setBuildZonesVisible(true);
    const firstSelection = !this.ghost;
    this.removeGhost();
    this.ghostType = type;
    this.ghostRotation = 0;
    const building = BUILDINGS_BY_ID[type];
    if (!building) return;
    // 第一次打开建造时，不要故意把预览塞进帐篷或树上；就近找一块能落脚的空地。
    if (firstSelection && !this.isPlacementValid(this.buildPoint.x, this.buildPoint.z, type)) {
      const candidate = this.findNearbyBuildPoint(type);
      if (candidate) this.buildPoint.set(candidate.x, GROUND_Y, candidate.z);
    }
    if (this.isPlacementValid(this.buildPoint.x, this.buildPoint.z, type) === false && firstSelection) {
      const angles = [0, -0.6, 0.6, -1.2, 1.2, Math.PI, -2.2, 2.2];
      for (const radius of [5.5, 7, 8.5]) {
        for (const angle of angles) {
          const x = this.player.root.position.x + Math.sin(angle) * radius;
          const z = this.player.root.position.z - Math.cos(angle) * radius;
          if (this.isPlacementValid(x, z, type)) {
            this.buildPoint.set(x, GROUND_Y, z);
            break;
          }
        }
        if (this.isPlacementValid(this.buildPoint.x, this.buildPoint.z, type)) break;
      }
    }
    const ghost = createBuilding(type, tier ?? 1, {
      ghost: true,
      modelKey: building.model,
      modelHeight: building.modelHeight,
      modelWidth: building.modelWidth,
    });
    ghost.position.copy(this.buildPoint).setY(GROUND_Y);
    setGhostAppearance(ghost, true);
    ghost.rotation.y = this.ghostRotation;
    this.islandGroup.add(ghost);
    this.ghost = ghost;
    this.ghostMeshes = [];
    ghost.traverse((child) => {
      if (child.isMesh) this.ghostMeshes.push(child);
    });
    this.ghostValid = null;
    this.updateGhostValidity();
    if (this.renderer) this.renderer.domElement.style.cursor = 'crosshair';
  }

  findNearbyBuildPoint(type) {
    for (const radius of [9, 7.2, 11, 5.6, 12.8]) {
      for (let step = 0; step < 20; step += 1) {
        const angle = (step / 20) * Math.PI * 2;
        const x = this.player.root.position.x + Math.sin(angle) * radius;
        const z = this.player.root.position.z - Math.cos(angle) * radius;
        if (this.isPlacementValid(x, z, type)) return { x, z };
      }
    }
    return null;
  }

  removeGhost() {
    if (!this.ghost) return;
    disposeObject(this.ghost);
    this.ghost.removeFromParent();
    this.ghost = null;
    this.ghostMeshes = [];
    this.ghostType = null;
  }

  setBuildZonesVisible(visible) {
    if (!visible) {
      if (this.buildZoneGroup) {
        this.buildZoneGroup.visible = false;
      }
      return;
    }
    if (!this.buildZoneGroup) {
      this.buildZoneGroup = new THREE.Group();
      this.buildZoneGroup.name = 'build-zone-lines';
      const mat = new THREE.MeshBasicMaterial({ color: '#e7cf95', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      this.buildZones.forEach((zone) => {
        if (zone.type !== 'circle') return;
        const ring = new THREE.Mesh(new THREE.RingGeometry(zone.r - 0.16, zone.r, 64), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(zone.x, GROUND_Y + 0.055, zone.z);
        this.buildZoneGroup.add(ring);
      });
      this.islandGroup.add(this.buildZoneGroup);
    }
    // 重建，防止换岛后旧环残留数据
    if (this.buildZoneGroup.parent !== this.islandGroup) this.islandGroup.add(this.buildZoneGroup);
    this.buildZoneGroup.visible = true;
  }

  rotateBuildGhost() {
    if (!this.ghost) return;
    this.ghostRotation += Math.PI / 2;
    this.ghost.rotation.y = this.ghostRotation;
  }

  updateBuildFromPointer() {
    if (!this.buildMode) return;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);
    const hit = this.raycaster.ray.intersectPlane(plane, TMP_VEC);
    if (!hit) return;
    const snappedX = Math.round(hit.x * 2) / 2;
    const snappedZ = Math.round(hit.z * 2) / 2;
    this.buildPoint.set(snappedX, GROUND_Y, snappedZ);
    if (this.ghost) {
      this.ghost.position.copy(this.buildPoint);
      this.updateGhostValidity();
    }
  }

  updateGhostValidity() {
    if (!this.ghost) return;
    const valid = this.isPlacementValid(this.buildPoint.x, this.buildPoint.z, this.ghostType);
    if (valid !== this.ghostValid) {
      this.ghostValid = valid;
      this.ghostMeshes?.forEach((meshObject) => {
        const materials = Array.isArray(meshObject.material) ? meshObject.material : [meshObject.material];
        materials.forEach((mat) => {
          if (mat?.emissive) mat.emissive.set(valid ? '#5aa88f' : '#d36e61');
        });
      });
      const ring = this.ghost.getObjectByName('ghost-ring');
      if (ring) {
        ring.traverse((child) => {
          if (child.isMesh && child.material) child.material.color.set(valid ? '#7fe4c4' : '#e17b6a');
        });
      }
      this.handlers.onBuildHover?.({ valid, x: this.buildPoint.x, z: this.buildPoint.z });
    }
    return valid;
  }

  isPlacementValid(x, z, type) {
    const definition = BUILDINGS_BY_ID[type];
    if (!definition) return false;
    let inside = false;
    for (const zone of this.buildZones) {
      if (zone.type === 'circle' && Math.hypot(x - zone.x, z - zone.z) <= zone.r - definition.radius * 0.28) {
        inside = true;
        break;
      }
    }
    if (!inside) return false;
    if (Math.hypot(x - this.player.root.position.x, z - this.player.root.position.z) < 2.15) return false;
    for (const blocker of this.blockers) {
      const minDist = definition.radius * 0.58 + blocker.radius * 0.82;
      if (Math.hypot(x - blocker.x, z - blocker.z) < minDist) return false;
    }
    return true;
  }

  attemptPlaceBuilding() {
    if (!this.buildMode || !this.ghostType) return;
    if (!this.isPlacementValid(this.buildPoint.x, this.buildPoint.z, this.ghostType)) {
      this.handlers.onMessage?.('这里放不下。试试更开阔的地方。');
      return;
    }
    this.handlers.onPlaceBuilding?.({
      type: this.ghostType,
      x: this.buildPoint.x,
      z: this.buildPoint.z,
      rotation: this.ghostRotation,
    });
  }

  addPlacedBuilding(buildingData) {
    if (!this.currentIsland) return;
    const definition = BUILDINGS_BY_ID[buildingData.type];
    if (!definition) return;
    const state = this.currentState;
    const tier = state?.getRank?.().tier ?? 1;
    const model = createBuilding(buildingData.type, tier, {
      modelKey: definition.model,
      modelHeight: definition.modelHeight,
      modelWidth: definition.modelWidth,
      shadowRadius: (definition.radius ?? 2.4) * 0.92,
    });
    model.position.set(buildingData.x, GROUND_Y, buildingData.z);
    model.rotation.y = buildingData.rotation ?? 0;
    this.islandGroup.add(model);
    model.traverse((object) => {
      if (object.userData?.tick) this.animated.push(object);
    });
    const meta = buildingInteraction(buildingData.type);
    const interaction = {
      id: `built-${buildingData.uid}`,
      kind: 'building',
      object: model,
      position: { x: buildingData.x, z: buildingData.z },
      label: meta.label,
      prompt: meta.prompt,
      action: meta.action,
      glyph: meta.glyph,
      markerColor: this.currentIsland.accent,
      markerHeight: buildingData.type === 'lighthouse' ? 6.4 : buildingData.type === 'observatory' ? 5.2 : 3.3,
      range: Math.max(3.1, definition.radius + 1.1),
      data: { buildingId: buildingData.uid, buildingType: buildingData.type },
    };
    this.registerInteraction(interaction);
    this.blockers.push({ x: buildingData.x, z: buildingData.z, radius: definition.radius * 0.9, type: 'building' });
    this.spawnBurst(new THREE.Vector3(buildingData.x, GROUND_Y + 0.3, buildingData.z), this.currentIsland.accent, 30, 1.6);
    this.spawnRing(new THREE.Vector3(buildingData.x, GROUND_Y, buildingData.z), this.currentIsland.accent);
    this.updateGhostValidity();
  }

  refreshFarmPlot(plotId, state) {
    const interaction = this.interactions.find((item) => item.kind === 'farm' && item.data?.plotId === plotId);
    if (!interaction) return;
    const plot = state.plots.find((item) => item.id === plotId);
    if (!plot) return;
    const oldObject = interaction.object;
    const newObject = createFarmPlotVisual(plot, state, this.currentIsland);
    this.islandGroup.add(newObject);
    disposeObject(oldObject);
    interaction.object = newObject;
    newObject.userData.interactionId = interaction.id;
    interaction.label = plot.seed ? '查看田垄' : '种下种子';
    interaction.object.getWorldPosition(TMP_VEC);
    this.spawnBurst(new THREE.Vector3(plot.x, GROUND_Y + 0.4, plot.z), '#d7c187', 14, 0.8);
  }

  setupMobileJoystick(element) {
    if (!element) return;
    const knob = element.querySelector('.joystick-knob');
    let pointerId = null;
    const rectFor = () => element.getBoundingClientRect();
    const updateFromEvent = (event) => {
      const rect = rectFor();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event.clientX - cx) / (rect.width / 2);
      const dy = (event.clientY - cy) / (rect.height / 2);
      const length = Math.hypot(dx, dy);
      const scale = length > 1 ? 1 / length : 1;
      const x = dx * scale;
      const y = -dy * scale;
      if (knob) knob.style.transform = `translate(${x * 32}px, ${-y * 32}px)`;
      this.setJoystick(x, y, true);
    };
    const down = (event) => {
      pointerId = event.pointerId;
      element.setPointerCapture?.(pointerId);
      updateFromEvent(event);
      event.preventDefault();
    };
    const move = (event) => {
      if (pointerId !== event.pointerId) return;
      updateFromEvent(event);
      event.preventDefault();
    };
    const up = (event) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      this.setJoystick(0, 0, false);
      if (knob) knob.style.transform = 'translate(0, 0)';
      event.preventDefault();
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  }

  getMinimapData() {
    return {
      island: this.currentIsland,
      player: {
        x: this.player.root.position.x,
        z: this.player.root.position.z,
        rotation: this.player.root.rotation.y,
      },
      radius: this.currentIsland?.walkRadius ?? 16,
      interactions: this.interactions.map((interaction) => {
        interaction.object.getWorldPosition(TMP_VEC);
        return {
          id: interaction.id,
          kind: interaction.kind,
          action: interaction.action,
          label: interaction.label,
          glyph: interaction.glyph,
          x: TMP_VEC.x,
          z: TMP_VEC.z,
          disabled: interaction.disabled,
        };
      }),
      buildZones: [...this.buildZones],
      expansions: this.currentState?.expansions ?? [],
    };
  }

  getCurrentInteractionAtPlayer() {
    return this.nearestInteraction;
  }

  teardown() {
    cancelAnimationFrame(this.animationFrame);
    this.removeListeners.forEach((fn) => fn());
    this.teardownIsland();
    this.renderer?.dispose();
  }
}

function dampAngle(current, target, lambda, dt) {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-lambda * dt));
}
