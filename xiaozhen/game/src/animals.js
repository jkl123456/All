import * as THREE from 'three';
import { cloneSkinned } from './skin-clone.js';
import { clamp, damp, dampAngle, mulberry32, range } from './utils.js';

/**
 * 动物的外观与习性。
 * height 是缩放后的站立高度（米），walk/gallop 是这两种步态的自然速度，
 * 用来把动画播放速度与实际位移对齐，避免"脚在打滑"。
 */
const SPECIES = [
  { file: 'deer', label: '梅花鹿', height: 1.55, walk: 1.5, gallop: 6.2, shy: 9, radius: 0.45, min: 2, max: 5 },
  { file: 'fox', label: '赤狐', height: 0.55, walk: 1.15, gallop: 4.8, shy: 7, radius: 0.28, min: 2, max: 5 },
  { file: 'donkey', label: '小毛驴', height: 1.35, walk: 1.0, gallop: 3.4, shy: 3.5, radius: 0.5, min: 2, max: 4 },
  { file: 'cow', label: '花牛', height: 1.45, walk: 0.85, gallop: 2.8, shy: 2.5, radius: 0.6, min: 2, max: 4 },
  { file: 'alpaca', label: '羊驼', height: 1.05, walk: 0.95, gallop: 3.0, shy: 3, radius: 0.38, min: 2, max: 4 },
  { file: 'shibainu', label: '柴犬', height: 0.5, walk: 1.2, gallop: 4.4, shy: 0, radius: 0.26, min: 2, max: 4 },
];

/** 活动范围：整个镇子（含镇外雨林边缘），避开建筑与树干 */
const ROAM = 33;

function randomSpot(rng, town, radius) {
  for (let i = 0; i < 80; i++) {
    const x = (rng() * 2 - 1) * ROAM;
    const z = (rng() * 2 - 1) * ROAM;
    if (!town.isBlocked(x, z, radius + 0.8)) return { x, z };
  }
  return { x: (rng() * 2 - 1) * ROAM, z: (rng() * 2 - 1) * ROAM };
}

export async function loadAnimalAssets(loader, onProgress) {
  const assets = {};
  let done = 0;
  for (const spec of SPECIES) {
    const gltf = await loader.loadAsync(`./assets/animals/${spec.file}.glb`);
    assets[spec.file] = gltf;
    done++;
    onProgress?.(done / SPECIES.length, spec.label);
  }
  return assets;
}

class Animal {
  constructor(scene, spec, gltf, rng, town) {
    this.spec = spec;
    this.rng = rng;

    const model = cloneSkinned(gltf.scene);
    // 按目标身高缩放，并把脚底对齐到地面
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = spec.height / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);
    model.position.y -= box.min.y * scale;

    model.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.receiveShadow = false;
        obj.frustumCulled = false;
        if (obj.material) {
          obj.material = obj.material.clone();
          obj.material.roughness = 0.86;
          obj.material.metalness = 0;
        }
      }
    });

    this.root = new THREE.Group();
    this.root.add(model);
    scene.add(this.root);

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      action.setEffectiveWeight(0);
      action.play();
      this.actions[clip.name] = action;
    }
    if (this.actions.Idle) this.actions.Idle.setEffectiveWeight(1);

    const spawn = randomSpot(rng, town, spec.radius);
    this.position = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.target = this.position.clone();
    this.heading = rng() * Math.PI * 2;
    this.speed = 0;
    this.desired = 0;
    this.state = 'idle';
    this.timer = range(rng, 0.5, 4);
    this.fleeTime = 0;
    this.walkW = 0;
    this.runW = 0;
    this.radius = spec.radius;

    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
  }

  /* ---------------- AI ---------------- */

  update(dt, player, town, visible, animate) {
    const rng = this.rng;
    this.timer -= dt;

    const dx = player.x - this.position.x;
    const dz = player.z - this.position.z;
    const playerDist = Math.hypot(dx, dz);

    // 受惊逃跑
    if (this.spec.shy > 0 && playerDist < this.spec.shy && this.fleeTime <= 0) {
      this.fleeTime = range(rng, 1.4, 2.6);
      this.state = 'flee';
      const away = Math.atan2(-dx, -dz);
      this.target.set(
        clamp(this.position.x + Math.sin(away) * 16, -ROAM, ROAM),
        0,
        clamp(this.position.z + Math.cos(away) * 16, -ROAM, ROAM)
      );
    }

    if (this.fleeTime > 0) {
      this.fleeTime -= dt;
      this.desired = this.spec.gallop * 0.9;
      if (this.fleeTime <= 0) {
        this.state = 'idle';
        this.timer = range(rng, 1, 3);
        this.target.copy(this.position);
      }
    } else if (this.state === 'idle') {
      this.desired = 0;
      if (this.timer <= 0) {
        const spot = randomSpot(rng, town, this.spec.radius);
        this.target.set(spot.x, 0, spot.z);
        // 偶尔小跑一段（柴犬尤其活跃）
        const runChance = this.spec.file === 'shibainu' ? 0.55 : 0.22;
        this.state = rng() < runChance ? 'run' : 'walk';
        this.desired = this.state === 'run' ? this.spec.gallop * 0.7 : this.spec.walk;
        this.timer = range(rng, 3, 8);
      }
    } else {
      const toX = this.target.x - this.position.x;
      const toZ = this.target.z - this.position.z;
      if (Math.hypot(toX, toZ) < 1.2 || this.timer <= 0) {
        this.state = 'idle';
        this.timer = range(rng, 2.5, 7);
        this.desired = 0;
      }
    }

    this.speed = damp(this.speed, this.desired, this.state === 'idle' ? 4 : 1.6, dt);

    if (this.speed > 0.05) {
      const toX = this.target.x - this.position.x;
      const toZ = this.target.z - this.position.z;
      if (Math.hypot(toX, toZ) > 0.05) {
        const want = Math.atan2(toX, toZ);
        this.heading = dampAngle(this.heading, want, 3.2, dt);
      }
      const step = this.speed * dt;
      const nx = this.position.x + Math.sin(this.heading) * step;
      const nz = this.position.z + Math.cos(this.heading) * step;
      if (!town.isBlocked(nx, nz, this.radius)) {
        this.position.x = nx;
        this.position.z = nz;
      } else {
        // 撞到东西就换个方向
        this.target.set(
          clamp(this.position.x + range(rng, -8, 8), -33, 33),
          0,
          clamp(this.position.z + range(rng, -8, 8), -33, 33)
        );
        this.speed *= 0.4;
      }
      const b = town.bounds;
      this.position.x = clamp(this.position.x, b.minX + 1, b.maxX - 1);
      this.position.z = clamp(this.position.z, b.minZ + 1, b.maxZ - 1);
    }

    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;

    // 动画权重：idle / walk / gallop 三段过渡
    const moving = clamp(this.speed / (this.spec.walk * 0.75), 0, 1);
    const runRatio = clamp((this.speed - this.spec.walk) / (this.spec.gallop - this.spec.walk), 0, 1);
    this.walkW = damp(this.walkW, moving * (1 - runRatio), 9, dt);
    this.runW = damp(this.runW, moving * runRatio, 9, dt);
    const idleW = Math.max(0, 1 - this.walkW - this.runW);

    if (this.actions.Idle) this.actions.Idle.setEffectiveWeight(idleW);
    if (this.actions.Walk) {
      this.actions.Walk.setEffectiveWeight(this.walkW);
      this.actions.Walk.timeScale = clamp(this.speed / this.spec.walk, 0.6, 1.9);
    }
    if (this.actions.Gallop) {
      this.actions.Gallop.setEffectiveWeight(this.runW);
      this.actions.Gallop.timeScale = clamp(this.speed / this.spec.gallop, 0.7, 1.7);
    }

    if (animate) this.mixer.update(dt);
    this.root.visible = visible;
  }
}

export class Herd {
  constructor(scene, assets, quality, town) {
    this.town = town;
    this.viewRange = quality.animalView || 50;
    this.rng = mulberry32(553311);
    this.animals = [];
    // 每种动物都放出来，数量 2~5 只随机，活动范围覆盖整个区域
    for (const spec of SPECIES) {
      const gltf = assets[spec.file];
      if (!gltf) continue;
      const count = spec.min + Math.floor(this.rng() * (spec.max - spec.min + 1));
      for (let i = 0; i < count; i++) {
        this.animals.push(new Animal(scene, spec, gltf, this.rng, town));
      }
    }
    this.focus = new THREE.Vector3();
  }

  update(dt, playerPos) {
    this.focus.copy(playerPos);
    for (const animal of this.animals) {
      const d = animal.position.distanceTo(playerPos);
      animal.update(dt, playerPos, this.town, d < this.viewRange, d < this.viewRange * 0.75);
    }
  }

  /** 最近的一只动物，用于 HUD 提示 */
  nearest(pos) {
    let best = null;
    let bestD = Infinity;
    for (const a of this.animals) {
      const d = a.position.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = { animal: a, distance: d };
      }
    }
    return best;
  }
}
