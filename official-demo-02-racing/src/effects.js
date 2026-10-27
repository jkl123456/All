import * as THREE from 'three';
import { clamp } from './utils.js';

const SMOKE_MAX = 380;
const SPARK_MAX = 140;
const FLAME_MAX = 220;
const SKID_MAX = 1400;

const smokeVertex = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const smokeFragment = `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a * 0.34);
  }
`;

const sparkVertex = `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const sparkFragment = `
  varying float vAlpha;
  uniform vec3 uColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.02, d) * vAlpha;
    gl_FragColor = vec4(uColor * (1.2 + a), a);
  }
`;

export class Effects {
  constructor(scene, camera, textures) {
    this.scene = scene;
    this.camera = camera;
    this.textures = textures;
    this.pixelRatio = Math.min(devicePixelRatio, 2);
    this.smoke = this.createPoints(SMOKE_MAX, smokeVertex, smokeFragment, new THREE.Color(0.55, 0.53, 0.5), THREE.NormalBlending);
    this.sparks = this.createPoints(SPARK_MAX, sparkVertex, sparkFragment, new THREE.Color(1.0, 0.36, 0.08), THREE.AdditiveBlending);
    this.smokeData = Array.from({ length: SMOKE_MAX }, () => ({ alive: false, life: 0, maxLife: 1, vel: new THREE.Vector3(), size: 1 }));
    this.sparkData = Array.from({ length: SPARK_MAX }, () => ({ alive: false, life: 0, maxLife: 1, vel: new THREE.Vector3(), size: 1 }));
    this.flames = this.createPoints(FLAME_MAX, sparkVertex, sparkFragment, new THREE.Color(0.5, 0.82, 1.0), THREE.AdditiveBlending);
    this.flameData = Array.from({ length: FLAME_MAX }, () => ({ alive: false, life: 0, maxLife: 1, vel: new THREE.Vector3() }));
    this.flameCursor = 0;
    this.smokeCursor = 0;
    this.sparkCursor = 0;
    this.skidCursor = 0;
    this.skidEmitTimer = 0;
    this.createSkids();
    this.resize();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  createPoints(max, vert, frag, color, blending) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(max), 1));
    geo.setDrawRange(0, max);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uColor: { value: color },
        uScale: { value: 800 },
      },
      transparent: true,
      depthWrite: false,
      blending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 4;
    this.scene.add(points);
    return points;
  }

  createSkids() {
    const geo = new THREE.PlaneGeometry(0.30, 0.76);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x070706,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
    const inst = new THREE.InstancedMesh(geo, mat, SKID_MAX);
    inst.frustumCulled = false;
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < SKID_MAX; i++) inst.setMatrixAt(i, zero);
    inst.instanceMatrix.needsUpdate = true;
    inst.renderOrder = 2;
    this.scene.add(inst);
    this.skids = inst;
    this.skidMatrix = new THREE.Matrix4();
  }

  resize() {
    const scale = (window.innerHeight * Math.min(devicePixelRatio, 2)) / (2 * Math.tan(THREE.MathUtils.degToRad(32)));
    if (this.smoke) this.smoke.material.uniforms.uScale.value = scale;
    if (this.sparks) this.sparks.material.uniforms.uScale.value = scale;
  }

  emitSmoke(position, velocity, size = 1.2, life = 1.2, colorIntensity = 1) {
    const i = this.smokeCursor++ % SMOKE_MAX;
    const p = this.smokeData[i];
    p.alive = true;
    p.life = 0;
    p.maxLife = life;
    p.vel.copy(velocity);
    p.size = size;
    const attr = this.smoke.geometry.attributes;
    attr.position.setXYZ(i, position.x, position.y + 0.1, position.z);
    attr.aSize.setX(i, size);
    attr.aAlpha.setX(i, 0.8 * colorIntensity);
    attr.position.needsUpdate = true;
    attr.aSize.needsUpdate = true;
    attr.aAlpha.needsUpdate = true;
    p.baseSize = size;
  }

  emitDriftSmoke(wheelWorld, carVelocity, intensity = 0.5) {
    const count = intensity > 0.55 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const pos = wheelWorld.clone();
      pos.x += (Math.random() - 0.5) * 0.35;
      pos.z += (Math.random() - 0.5) * 0.35;
      const vel = new THREE.Vector3(
        carVelocity.x * 0.08 + (Math.random() - 0.5) * 1.4,
        0.5 + Math.random() * 0.85,
        carVelocity.z * 0.08 + (Math.random() - 0.5) * 1.4,
      );
      this.emitSmoke(pos, vel, 0.65 + Math.random() * 0.9, 0.9 + Math.random() * 0.8, 0.8);
    }
  }

  addSkid(position, yaw, strength = 1) {
    const m = this.skidMatrix;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m.compose(
      new THREE.Vector3(position.x, 0.045, position.z),
      q,
      new THREE.Vector3(1, 1, 1 + strength * 0.25),
    );
    this.skids.setMatrixAt(this.skidCursor % SKID_MAX, m);
    this.skidCursor++;
    this.skids.instanceMatrix.needsUpdate = true;
  }

  addSkidPair(leftWorld, rightWorld, yaw, strength = 1) {
    this.addSkid(leftWorld, yaw, strength);
    this.addSkid(rightWorld, yaw, strength);
  }

  sparkBurst(position, normal = null, count = 16, force = 1) {
    for (let k = 0; k < count; k++) {
      const i = this.sparkCursor++ % SPARK_MAX;
      const p = this.sparkData[i];
      p.alive = true;
      p.life = 0;
      p.maxLife = 0.3 + Math.random() * 0.55;
      p.vel.set(
        (Math.random() - 0.5) * 6 * force,
        1.5 + Math.random() * 4 * force,
        (Math.random() - 0.5) * 6 * force,
      );
      if (normal) p.vel.addScaledVector(normal, 1.8 * force);
      p.size = 0.08 + Math.random() * 0.18;
      const attr = this.sparks.geometry.attributes;
      attr.position.setXYZ(i, position.x, position.y + 0.3, position.z);
      attr.aSize.setX(i, p.size);
      attr.aAlpha.setX(i, 1);
      attr.position.needsUpdate = true;
      attr.aSize.needsUpdate = true;
      attr.aAlpha.needsUpdate = true;
    }
  }

  /** 氮气尾焰：沿车尾反方向喷出的高速亮点，寿命很短，配合辉光很亮。 */
  emitBoost(position, forward, intensity = 1) {
    const count = 1 + Math.round(intensity);
    const attr = this.flames.geometry.attributes;
    for (let k = 0; k < count; k++) {
      const i = this.flameCursor++ % FLAME_MAX;
      const p = this.flameData[i];
      p.alive = true;
      p.life = 0;
      p.maxLife = 0.12 + Math.random() * 0.16;
      const spread = 1.4;
      p.vel.set(
        -forward.x * (9 + Math.random() * 9) + (Math.random() - 0.5) * spread,
        (Math.random() - 0.35) * 1.4,
        -forward.z * (9 + Math.random() * 9) + (Math.random() - 0.5) * spread,
      );
      attr.position.setXYZ(
        i,
        position.x + (Math.random() - 0.5) * 0.5,
        Math.max(0.12, position.y + (Math.random() - 0.5) * 0.18),
        position.z + (Math.random() - 0.5) * 0.5,
      );
      attr.aSize.setX(i, 0.16 + Math.random() * 0.22);
      attr.aAlpha.setX(i, 1);
    }
    attr.position.needsUpdate = true;
    attr.aSize.needsUpdate = true;
    attr.aAlpha.needsUpdate = true;
  }

  updateFlames(dt) {
    const attr = this.flames.geometry.attributes;
    let alive = false;
    for (let i = 0; i < FLAME_MAX; i++) {
      const p = this.flameData[i];
      if (!p.alive) continue;
      alive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        attr.aAlpha.setX(i, 0);
        continue;
      }
      const t = p.life / p.maxLife;
      attr.position.setXYZ(
        i,
        attr.position.getX(i) + p.vel.x * dt,
        Math.max(0.08, attr.position.getY(i) + p.vel.y * dt),
        attr.position.getZ(i) + p.vel.z * dt,
      );
      attr.aAlpha.setX(i, (1 - t) * (1 - t));
    }
    if (alive) {
      attr.position.needsUpdate = true;
      attr.aAlpha.needsUpdate = true;
    }
  }

  update(dt) {
    this.updateSmoke(dt);
    this.updateSparks(dt);
    this.updateFlames(dt);
  }

  updateSmoke(dt) {
    const attr = this.smoke.geometry.attributes;
    let alive = false;
    for (let i = 0; i < SMOKE_MAX; i++) {
      const p = this.smokeData[i];
      if (!p.alive) continue;
      alive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        attr.aAlpha.setX(i, 0);
        continue;
      }
      const t = p.life / p.maxLife;
      attr.position.setXYZ(
        i,
        attr.position.getX(i) + p.vel.x * dt,
        attr.position.getY(i) + p.vel.y * dt,
        attr.position.getZ(i) + p.vel.z * dt,
      );
      p.vel.multiplyScalar(1 - 0.9 * dt);
      p.vel.y += 0.08 * dt;
      attr.aSize.setX(i, p.baseSize + t * 4.8);
      attr.aAlpha.setX(i, (1 - t) * 0.8);
    }
    if (alive) {
      attr.position.needsUpdate = true;
      attr.aSize.needsUpdate = true;
      attr.aAlpha.needsUpdate = true;
    }
  }

  updateSparks(dt) {
    const attr = this.sparks.geometry.attributes;
    let alive = false;
    for (let i = 0; i < SPARK_MAX; i++) {
      const p = this.sparkData[i];
      if (!p.alive) continue;
      alive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.alive = false;
        attr.aAlpha.setX(i, 0);
        continue;
      }
      p.vel.y -= 9.8 * dt;
      attr.position.setXYZ(
        i,
        attr.position.getX(i) + p.vel.x * dt,
        Math.max(0.04, attr.position.getY(i) + p.vel.y * dt),
        attr.position.getZ(i) + p.vel.z * dt,
      );
      attr.aAlpha.setX(i, 1 - p.life / p.maxLife);
    }
    if (alive) {
      attr.position.needsUpdate = true;
      attr.aAlpha.needsUpdate = true;
    }
  }

  clear() {
    for (const p of this.smokeData) p.alive = false;
    for (const p of this.sparkData) p.alive = false;
    for (const p of this.flameData) p.alive = false;
    this.flames.geometry.attributes.aAlpha.array.fill(0);
    this.flames.geometry.attributes.aAlpha.needsUpdate = true;
    this.smoke.geometry.attributes.aAlpha.array.fill(0);
    this.smoke.geometry.attributes.aAlpha.needsUpdate = true;
    this.sparks.geometry.attributes.aAlpha.array.fill(0);
    this.sparks.geometry.attributes.aAlpha.needsUpdate = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < SKID_MAX; i++) this.skids.setMatrixAt(i, zero);
    this.skids.instanceMatrix.needsUpdate = true;
    this.skidCursor = 0;
  }
}
