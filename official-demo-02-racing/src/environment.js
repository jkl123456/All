import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { canvasTexture, heightToNormal, makeCanvas, mulberry32, radialTexture } from './utils.js';
import { dirFrom, getTheme } from './themes.js';

const SUN_DIR = new THREE.Vector3(-0.55, 0.135, 0.825).normalize();

// 海岸线是全局的（海面、沙滩、滨海栏杆都用它）；海边主题会把它整体拉近赛道。
let coastShift = 0;
export function setCoastShift(shift) {
  coastShift = shift;
}
const COAST = (x) => 400 + 54 * Math.sin(x * 0.0022) + 24 * Math.sin(x * 0.0067 + 1.2) + coastShift;

function cloudCanvas(seed = 1) {
  const w = 1024, h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 48; i++) {
    const x = 120 + rng() * (w - 240);
    const y = 170 + rng() * 190;
    const rx = 60 + rng() * 170;
    const ry = 22 + rng() * 55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    const alpha = 0.035 + rng() * 0.07;
    g.addColorStop(0, `rgba(255,235,208,${alpha})`);
    g.addColorStop(0.55, `rgba(255,216,181,${alpha * 0.6})`);
    g.addColorStop(1, 'rgba(255,205,170,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 4; i++) {
    const x = 200 + i * 210;
    ctx.strokeStyle = 'rgba(255,225,197,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 220); ctx.lineTo(x + 260, 220); ctx.stroke();
  }
  return c;
}

function starCanvas() {
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(220,235,255,0.55)');
  g.addColorStop(1, 'rgba(180,205,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return c;
}

function mountainRidge(seed, color, distance, height, width = 5600) {
  const rng = mulberry32(seed);
  const segments = 70;
  const positions = [];
  const indices = [];
  const base = -1000;
  for (let i = 0; i <= segments; i++) {
    const x = -width / 2 + (width / segments) * i;
    const noise = Math.sin(i * 1.9 + seed) * 0.3 + Math.sin(i * 0.55 + seed * 2) * 0.45;
    const peak = height * (0.35 + 0.65 * Math.abs(noise)) * (0.7 + rng() * 0.3);
    const z = distance - 60 + Math.sin(i * 0.8 + seed) * 30;
    positions.push(x, base, z, x, peak, z);
    if (i < segments) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide });
  return new THREE.Mesh(g, mat);
}

export class Environment {
  constructor(renderer, scene, textures, themeId = 'city') {
    this.renderer = renderer;
    this.scene = scene;
    this.textures = textures;
    this.theme = getTheme(themeId);
    this.sunDir = dirFrom(this.theme.sun.az, this.theme.sun.el);
    this.lightDir = dirFrom(this.theme.light.az, this.theme.light.el);
    this.waterNormal = null;
    this.time = 0;
    this.clouds = [];
    this.buildSky();
    this.buildLights();
    this.buildDistantWorld();
    this.buildEnvironmentMap();
    this.applyTheme();
  }

  buildSky() {
    const theme = this.theme;
    const sky = new Sky();
    sky.scale.setScalar(12000);
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = theme.sky.turbidity;
    uniforms.rayleigh.value = theme.sky.rayleigh;
    uniforms.mieCoefficient.value = theme.sky.mie;
    uniforms.mieDirectionalG.value = theme.sky.mieG;
    uniforms.sunPosition.value.copy(this.sunDir);
    this.scene.add(sky);
    this.sky = sky;

    // A layered glow around the sun, kept just above the horizon.
    if (theme.glow) {
      const glowMat = new THREE.SpriteMaterial({
        map: this.textures.sunGlow,
        color: theme.glow.color,
        transparent: true,
        opacity: theme.glow.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        fog: false,
        toneMapped: false,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(this.sunDir).multiplyScalar(4200);
      glow.scale.set(1450, 1450, 1);
      this.scene.add(glow);
      this.sunGlow = glow;
    }

    // Wispy high clouds distributed around the horizon.
    const cloudTexture = canvasTexture(cloudCanvas(8), { anisotropy: 8 });
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTexture, color: i % 4 === 0 ? 0xffd1ac : 0xffe7d2,
        transparent: true, opacity: (0.18 + (i % 5) * 0.035) * theme.sky.cloud,
        depthWrite: false, fog: false,
        blending: THREE.NormalBlending,
      });
      const sp = new THREE.Sprite(mat);
      const angle = (i / 18) * Math.PI * 2 + 0.25;
      const radius = 3200 + (i % 4) * 650;
      sp.position.set(Math.cos(angle) * radius, 480 + (i % 4) * 130, Math.sin(angle) * radius);
      sp.scale.set(1600 + (i % 4) * 420, 350 + (i % 3) * 130, 1);
      this.scene.add(sp);
      this.clouds.push(sp);
    }

    // Night sky: stars + a moon disc.
    if (theme.stars > 0) {
      const count = 900;
      const positions = new Float32Array(count * 3);
      const rng = mulberry32(77);
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const y = 0.12 + rng() * 0.88;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        positions[i * 3] = Math.cos(a) * r * 6400;
        positions[i * 3 + 1] = y * 6400;
        positions[i * 3 + 2] = Math.sin(a) * r * 6400;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starTex = canvasTexture(starCanvas(), { srgb: false });
      const mat = new THREE.PointsMaterial({
        size: 26, map: starTex, transparent: true, opacity: theme.stars,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        toneMapped: false, color: 0xdfe9ff, sizeAttenuation: true,
      });
      const stars = new THREE.Points(geo, mat);
      this.scene.add(stars);
      this.stars = stars;

      const moonMat = new THREE.SpriteMaterial({
        map: canvasTexture(radialTexture(128, 'rgba(255,255,255,1)', 'rgba(230,240,255,0)'), { anisotropy: 4 }),
        color: 0xdfe9ff, transparent: true, opacity: 0.85,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
      });
      const moon = new THREE.Sprite(moonMat);
      moon.position.copy(dirFrom(-0.55, 0.62)).multiplyScalar(4600);
      moon.scale.set(520, 520, 1);
      this.scene.add(moon);
      this.moon = moon;
    }
  }

  buildLights() {
    const theme = this.theme;
    const hemi = new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(theme.light.color, theme.light.intensity);
    sun.position.copy(this.lightDir).multiplyScalar(260);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 700;
    sun.shadow.camera.left = -105;
    sun.shadow.camera.right = 105;
    sun.shadow.camera.top = 105;
    sun.shadow.camera.bottom = -105;
    sun.shadow.bias = -0.00022;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.sunTarget = new THREE.Vector3();

    const fill = new THREE.DirectionalLight(theme.fill.color, theme.fill.intensity);
    fill.position.set(120, 90, -160);
    this.scene.add(fill);
    this.fill = fill;

    // Warm low bounce from the ocean / pavement.
    const bounce = new THREE.DirectionalLight(theme.bounce.color, theme.bounce.intensity);
    bounce.position.set(10, -30, 200);
    this.scene.add(bounce);
    this.bounce = bounce;
  }

  buildDistantWorld() {
    const theme = this.theme;
    // Land mass. The coastline curves gently along the south of the circuit.
    const shape = new THREE.Shape();
    shape.moveTo(-4200, 4200);
    shape.lineTo(4200, 4200);
    for (let x = 4200; x >= -4200; x -= 40) {
      shape.lineTo(x, -COAST(x));
    }
    shape.closePath();
    const landGeo = new THREE.ShapeGeometry(shape);
    landGeo.rotateX(-Math.PI / 2);
    const landMat = new THREE.MeshStandardMaterial({
      color: theme.land.color, roughness: 0.98, metalness: 0,
    });
    if (!theme.land.flat) {
      const landTex = this.textures.concrete.clone();
      landTex.repeat.set(260, 260);
      landTex.needsUpdate = true;
      landMat.map = landTex;
    }
    const land = new THREE.Mesh(landGeo, landMat);
    // 非城市主题的草地/沙地由 Biome 铺在上面，这块大陆要再压下去一点
    land.position.y = theme.urban ? 0 : -0.16;
    land.receiveShadow = true;
    this.scene.add(land);
    this.land = land;

    // Beach strip along the waterline.
    const beachVerts = [];
    const beachUvs = [];
    const beachIndices = [];
    let vi = 0;
    for (let x = -4200; x <= 4200; x += 30) {
      const z = COAST(x);
      beachVerts.push(x, 0.03, z - 26, x, -0.28, z + 26);
      beachUvs.push(x * 0.02, 0, x * 0.02, 1);
      if (x < 4200) {
        beachIndices.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
      }
      vi += 2;
    }
    const beachGeo = new THREE.BufferGeometry();
    beachGeo.setAttribute('position', new THREE.Float32BufferAttribute(beachVerts, 3));
    beachGeo.setAttribute('uv', new THREE.Float32BufferAttribute(beachUvs, 2));
    beachGeo.setIndex(beachIndices);
    beachGeo.computeVertexNormals();
    const beachMat = new THREE.MeshStandardMaterial({ color: 0xc8ad84, roughness: 0.9 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.receiveShadow = true;
    this.scene.add(beach);
    this.beach = beach;

    // Ocean with a slow, procedural swell.
    const normalSource = makeCanvas(512, 512);
    const nctx = normalSource.getContext('2d');
    nctx.fillStyle = '#808080'; nctx.fillRect(0, 0, 512, 512);
    const rng = mulberry32(311);
    for (let i = 0; i < 140; i++) {
      nctx.fillStyle = `rgba(${155 + rng() * 60},${155 + rng() * 60},${155 + rng() * 60},0.22)`;
      nctx.beginPath();
      nctx.ellipse(rng() * 512, rng() * 512, 20 + rng() * 90, 2 + rng() * 9, rng() * Math.PI, 0, Math.PI * 2);
      nctx.fill();
    }
    this.waterNormal = canvasTexture(heightToNormal(normalSource, 0.55), { srgb: false, repeat: [90, 90] });
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: theme.water.color, roughness: 0.2, metalness: 0.15,
      normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.5, 0.5),
      envMapIntensity: 1.25, clearcoat: 0.35, clearcoatRoughness: 0.18,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000, 1, 1), waterMat);
    water.rotation.x = -Math.PI / 2;
    // 海面只比沙滩低一点点，低机位也能看到那条蓝线
    water.position.set(0, -0.34, 3800);
    water.receiveShadow = false;
    this.scene.add(water);
    this.water = water;

    // Sea wall / promenade edge.
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0a28f, roughness: 0.9 });
    const wallGeo = new THREE.BoxGeometry(4200, 1.3, 1.4);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(-150, 0.2, COAST(-150) - 2);
    this.scene.add(wall);
    this.seaWall = wall;

    const ridge1 = mountainRidge(21, theme.ridge.far, -2550, 360, 7200);
    const ridge2 = mountainRidge(27, theme.ridge.near, -2200, 220, 6500);
    this.scene.add(ridge1, ridge2);
    this.ridges = [ridge1, ridge2];

    // Tiny distant islands on the horizon.
    const islands = [];
    for (let i = 0; i < 4; i++) {
      const island = new THREE.Mesh(
        new THREE.SphereGeometry(80 + i * 35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: theme.ridge.far, fog: true }),
      );
      island.scale.set(4 + i, 0.24, 1.4);
      island.position.set(-1800 + i * 1150, -6, 2600 + i * 160);
      this.scene.add(island);
      islands.push(island);
    }
    this.islands = islands;
  }

  buildEnvironmentMap() {
    const theme = this.theme;
    const envScene = new THREE.Scene();
    const sky = new Sky();
    sky.scale.setScalar(10000);
    const u = sky.material.uniforms;
    u.turbidity.value = theme.sky.turbidity;
    u.rayleigh.value = theme.sky.rayleigh;
    u.mieCoefficient.value = theme.sky.mie;
    u.mieDirectionalG.value = theme.sky.mieG;
    u.sunPosition.value.copy(this.sunDir);
    envScene.add(sky);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10000, 10000),
      new THREE.MeshBasicMaterial({ color: theme.land.color, side: THREE.DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -40;
    envScene.add(ground);

    if (theme.glow) {
      const sunBall = new THREE.Mesh(
        new THREE.SphereGeometry(120, 16, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff0d0 }),
      );
      sunBall.position.copy(this.sunDir).multiplyScalar(4200);
      envScene.add(sunBall);
    } else {
      const moonBall = new THREE.Mesh(
        new THREE.SphereGeometry(180, 16, 8),
        new THREE.MeshBasicMaterial({ color: 0xdfe9ff }),
      );
      moonBall.position.copy(dirFrom(-0.55, 0.62)).multiplyScalar(4200);
      envScene.add(moonBall);
    }

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromScene(envScene, 0.03, 0.1, 15000);
    this.scene.environment = target.texture;
    pmrem.dispose();
  }

  applyTheme() {
    const theme = this.theme;
    this.scene.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);
    this.scene.environmentIntensity = theme.envIntensity;
    this.renderer.toneMappingExposure = theme.exposure;
    if (this.beach) this.beach.visible = theme.water.visible;
    if (this.water) {
      this.water.visible = theme.water.visible;
      this.water.material.color.set(theme.water.color);
    }
    if (this.seaWall) this.seaWall.visible = theme.water.visible;
    for (const island of this.islands || []) island.visible = theme.water.visible;
  }

  applyQuality(quality) {
    const high = quality === 'high';
    const medium = quality === 'medium';
    this.sun.castShadow = true;
    const size = high ? 2048 : medium ? 1024 : 512;
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.sun.shadow.radius = high ? 2.5 : 2;
    this.waterNormal.anisotropy = high ? 16 : 8;
  }

  update(dt, focus) {
    this.time += dt;
    if (this.waterNormal) {
      this.waterNormal.offset.x = this.time * 0.0035;
      this.waterNormal.offset.y = this.time * 0.0018;
    }
    if (focus) {
      this.sun.position.copy(focus).addScaledVector(this.lightDir, 240);
      this.sun.position.y += 80;
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
    }
  }
}

export { SUN_DIR, COAST };
