import * as THREE from 'three';
import { createCharacter, animateCharacter, glowSprite } from './modelKit.js';

export class ProceduralPlayer {
  constructor({ groundY = 1.12, onFootstep } = {}) {
    this.groundY = groundY;
    this.onFootstep = onFootstep;
    this.root = createCharacter({
      robe: '#3f7469',
      robeDark: '#2b554d',
      trim: '#e7c47e',
      skin: '#e7bfa0',
      hair: '#4c392c',
      scarf: '#e2bd77',
      backpack: true,
    });
    this.root.name = 'player';
    this.root.scale.setScalar(1.06);
    this.rig = this.root.userData.rig;
    this.velocity = new THREE.Vector2();
    this.speed = 0;
    this.elapsed = 0;
    this.footstepTimer = 0;
    this.facing = Math.PI;
    this.targetFacing = Math.PI;
    this.root.rotation.y = Math.PI;
    this.spawn = new THREE.Vector3(0, groundY, 2.0);

    // 玩家身边的小萤灵：既是视觉焦点，也是“知识还在流动”的暗示。
    const companion = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.075, 1),
      new THREE.MeshBasicMaterial({ color: '#ffe7a1', transparent: true, opacity: 0.95 }),
    );
    orb.castShadow = false;
    const glow = glowSprite('#ffe3a1', 0.62, 0.55);
    companion.add(orb, glow);
    companion.position.set(0.58, 1.55, -0.2);
    this.root.add(companion);
    this.companion = companion;
    this.companionPhase = 0.4;

    this.setPosition(0, 2.0, Math.PI);
  }

  get position() {
    return this.root.position;
  }

  setPosition(x, z, rotation = this.root.rotation.y) {
    this.spawn.set(x, this.groundY, z);
    this.root.position.set(x, this.groundY, z);
    this.root.rotation.y = rotation;
    this.facing = rotation;
    this.targetFacing = rotation;
    this.velocity.set(0, 0);
    this.speed = 0;
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  update(dt, { moveX = 0, moveZ = 0, run = false, cameraYaw = 0, walkable = () => true, paused = false }) {
    this.elapsed += dt;
    if (paused) {
      animateCharacter(this.root, this.elapsed, 0);
      this.updateCompanion(dt);
      return;
    }
    let inputX = moveX;
    let inputZ = moveZ;
    if (Math.abs(inputX) + Math.abs(inputZ) > 1.15) {
      const length = Math.hypot(inputX, inputZ);
      inputX /= length;
      inputZ /= length;
    }
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let dx = forwardX * inputZ + rightX * inputX;
    let dz = forwardZ * inputZ + rightZ * inputX;
    const inputLength = Math.hypot(dx, dz);
    const moving = inputLength > 0.06;
    const targetSpeed = moving ? (run ? 6.4 : 4.1) : 0;
    if (moving) {
      dx /= Math.max(1, inputLength);
      dz /= Math.max(1, inputLength);
      this.targetFacing = Math.atan2(dx, dz);
    }
    const smoothSpeed = THREE.MathUtils.damp(this.speed, targetSpeed, moving ? 10 : 14, dt);
    this.speed = smoothSpeed;
    if (moving) {
      const stepX = dx * this.speed * dt;
      const stepZ = dz * this.speed * dt;
      const pos = this.root.position;
      let nextX = pos.x + stepX;
      let nextZ = pos.z;
      if (walkable(nextX, nextZ)) {
        pos.x = nextX;
      } else {
        const partialX = dx * this.speed * dt * 0.35;
        if (walkable(pos.x + partialX, pos.z)) pos.x += partialX;
      }
      nextX = pos.x;
      nextZ = pos.z + stepZ;
      if (walkable(nextX, nextZ)) {
        pos.z = nextZ;
      } else {
        const partialZ = dz * this.speed * dt * 0.35;
        if (walkable(pos.x, pos.z + partialZ)) pos.z += partialZ;
      }
      this.footstepTimer -= dt;
      if (this.speed > 2.4 && this.footstepTimer <= 0) {
        this.footstepTimer = run ? 0.22 : 0.34;
        this.onFootstep?.();
      }
    }
    this.facing = dampAngle(this.facing, this.targetFacing, 12, dt);
    this.root.rotation.y = this.facing;
    this.root.position.y = this.groundY;
    animateCharacter(this.root, this.elapsed, this.speed);
    this.updateCompanion(dt);
  }

  updateCompanion(dt) {
    this.companionPhase += dt * 1.2;
    const targetX = 0.5 + Math.sin(this.companionPhase * 0.7) * 0.18;
    const targetY = 1.55 + Math.sin(this.companionPhase * 1.4) * 0.13;
    this.companion.position.x = THREE.MathUtils.damp(this.companion.position.x, targetX, 4, dt);
    this.companion.position.y = THREE.MathUtils.damp(this.companion.position.y, targetY, 4, dt);
    this.companion.rotation.y += dt * 0.8;
    this.companion.children[0].rotation.x += dt * 1.4;
    this.companion.children[1].material.opacity = 0.4 + Math.sin(this.companionPhase * 2) * 0.15;
  }

  getCameraTarget(out = new THREE.Vector3()) {
    out.copy(this.root.position);
    out.y += 1.45;
    out.x -= Math.sin(this.facing) * 0.25;
    out.z -= Math.cos(this.facing) * 0.25;
    return out;
  }
}

function dampAngle(current, target, lambda, dt) {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * (1 - Math.exp(-lambda * dt));
}
