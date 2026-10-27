import * as THREE from 'three';
import { AI_DRIVERS, CARS, MODES, START_OFFSETS } from './config.js';
import { CarModel } from './car.js';
import { clamp, damp, wrapAngle, angleDiff } from './utils.js';

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const TEMP = new THREE.Vector3();
const TEMP2 = new THREE.Vector3();
const TEMP3 = new THREE.Vector3();
const TEMP4 = new THREE.Vector3();

class Racer {
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.shortName = opts.shortName;
    this.color = opts.color;
    this.isPlayer = opts.isPlayer;
    this.def = opts.def;
    this.car = opts.car;
    this.ai = opts.ai || null;
    this.slot = opts.slot;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.slip = 0;
    this.distanceAlong = 0;
    this.trackDistance = 0;
    this.trackIndex = 0;
    this.lateral = 0;
    this.lap = 1;
    this.lapsCompleted = 0;
    this.lapStartTime = 0;
    this.lastLap = null;
    this.bestLap = Infinity;
    this.lapTimes = [];
    this.raceTime = 0;
    this.finished = false;
    this.finishTime = null;
    this.finishPosition = null;
    this.nitro = 100;
    this.driftScore = 0;
    this.wallCooldown = 0;
    this.collisionCooldown = 0;
    this.impact = 0;
    this.gear = 'N';
    this.rpm = 0.1;
    this.offTrack = false;
    this.stopped = false;
    this.avgSpeed = 0;
    this.lastProgress = 0;
  }

  setPose(position, yaw) {
    this.position.copy(position);
    this.yaw = yaw;
    this.car.root.position.copy(position);
    this.car.root.rotation.y = yaw;
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.trackIndex = 0;
    this.lapTimes = [];
    this.bestLap = Infinity;
    this.lastLap = null;
    this.finished = false;
    this.finishTime = null;
    this.finishPosition = null;
    this.lapsCompleted = 0;
    this.lap = 1;
    this.lapStartTime = 0;
    this.driftScore = 0;
    this.nitro = 100;
    this.impact = 0;
  }
}

export class Race {
  constructor({ scene, track, effects, audio, mode = 'gp', carDef, paint, callbacks = {}, night = false }) {
    this.scene = scene;
    this.track = track;
    this.effects = effects;
    this.audio = audio;
    this.mode = MODES[mode] || MODES.gp;
    this.night = Boolean(night);
    this.callbacks = callbacks;
    this.time = 0;
    this.raceTime = 0;
    this.countdownTime = 0;
    this.phase = 'idle';
    this.paused = false;
    this.finishHold = 0;
    this.cameraShake = 0;
    this.rumble = 0;
    this.playerStartLights = 0;
    this.wentGreen = false;
    this.goHold = 0;
    this.lapNotify = 0;
    this.finishedCalled = false;
    this.player = null;
    this.racers = [];
    this.standings = [];
    this.skidTimer = 0;
    this.smokeTimer = 0;
    this.tempVector = new THREE.Vector3();
    this.tempVector2 = new THREE.Vector3();
    this.totalLength = track.totalLength;
    this.carDef = carDef;
    this.paint = paint;
    this.createRacers(carDef, paint);
    this.reset();
    this.phase = 'idle';
  }

  createRacers(carDef, paint) {
    const opponents = this.mode.opponents;
    // Player
    const playerCar = new CarModel(carDef, paint, {
      isPlayer: true, quality: 'high', number: carDef.model?.number, night: this.night,
    });
    this.scene.add(playerCar.root);
    const player = new Racer({
      id: 'player',
      name: 'YOU',
      shortName: 'YOU',
      color: paint,
      isPlayer: true,
      def: carDef,
      car: playerCar,
      slot: opponents ? 0 : 5,
    });
    this.player = player;
    this.racers.push(player);

    if (opponents) {
      AI_DRIVERS.forEach((driver, idx) => {
        const def = CARS.find((c) => c.id === driver.carId) || CARS[0];
        const car = new CarModel(def, driver.color, {
          isPlayer: false, quality: 'medium', number: driver.number, ai: true, night: this.night,
        });
        this.scene.add(car.root);
        const racer = new Racer({
          id: driver.id,
          name: driver.name,
          shortName: driver.short,
          color: driver.color,
          isPlayer: false,
          def,
          car,
          slot: idx + 1,
          ai: {
            skill: driver.skill,
            aggression: driver.aggression,
            seed: idx * 91.7 + 7.3,
            lineBias: (idx - 2) * 0.55,
            targetOffset: (idx % 2 ? 1.5 : -1.5),
            homeOffset: 0,
          },
        });
        racer.ai.homeOffset = (idx - 2) * 0.7 + (idx % 2 ? 1.2 : -1.2);
        this.racers.push(racer);
      });
    }
    this.player.slot = opponents ? 0 : 5;
  }

  reset() {
    this.racers.forEach((r, index) => {
      const slot = r.isPlayer ? (this.mode.opponents ? 0 : 5) : index;
      const offset = this.mode.opponents ? START_OFFSETS[slot] : -8;
      const lateral = this.mode.opponents ? (slot % 2 === 0 ? -2.25 : 2.25) : 0;
      const pose = this.track.getPoseAt(offset);
      const pos = pose.position.clone().addScaledVector(pose.right, lateral);
      r.setPose(pos, pose.yaw);
      r.slot = slot;
      r.distanceAlong = offset;
      r.trackDistance = this.track.wrapDistance(offset);
      r.trackIndex = this.track.nearest(pos.x, pos.z).index;
      r.lateral = lateral;
      r.car.root.position.copy(pos);
      r.car.root.rotation.y = pose.yaw;
      r.car.root.visible = true;
      r.ai && (r.ai.targetOffset = lateral + (index % 2 ? 1.2 : -1.2));
    });
    this.time = 0;
    this.raceTime = 0;
    this.countdownTime = 0;
    this.phase = 'idle';
    this.finishHold = 0;
    this.finishedCalled = false;
    this.cameraShake = 0;
    this.rumble = 0;
    this.wentGreen = false;
    this.goHold = 0;
    this.standings = this.racers.map((r) => ({
      name: r.name, shortName: r.shortName, color: r.color, isPlayer: r.isPlayer,
    }));
    this.effects?.clear();
    this.track.setStartLights('off');
    this.player.car.root.visible = true;
    this.racers.forEach((r) => {
      r.car.root.visible = true;
      r.lap = 1;
    });
  }

  begin() {
    this.reset();
    this.paused = false;
    this.phase = 'countdown';
    this.countdownTime = 0;
    this.countdownStage = '';
    this.track.setStartLights('off');
    this.emitCountdown('ready', 0, 'READY', false);
  }

  emitCountdown(label, lights, display, go) {
    this.callbacks.onCountdown?.({ label, lights, display, go });
    this.playerStartLights = lights;
    if (!go) this.track.setStartLights(lights > 0 ? 'red' : 'off', lights);
    else this.track.setStartLights('go');
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.callbacks.onPause?.();
  }

  update(dt, input) {
    if (this.paused || this.phase === 'idle') return;
    this.time += dt;
    const clamped = Math.min(dt, 0.05);
    if (this.phase === 'countdown') {
      this.updateCountdown(clamped);
      this.updateVisualOnly(dt, input);
      return;
    }
    if (this.phase === 'finishing') {
      this.finishHold -= dt;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2);
      this.updateCarVisuals(dt);
      if (this.finishHold <= 0 && !this.finishedCalled) {
        this.finishedCalled = true;
        this.phase = 'finished';
        this.standings = this.buildClassification();
        this.callbacks.onFinish?.(this.buildResults());
      }
      return;
    }
    if (this.phase === 'finished') {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2);
      return;
    }
    if (this.phase !== 'running' && this.phase !== 'free') return;

    if (this.goHold > 0) {
      this.goHold -= dt;
      if (this.goHold <= 0) this.track.setStartLights('off');
    }
    const steps = Math.min(4, Math.ceil(clamped / 0.014));
    const step = clamped / steps;
    for (let i = 0; i < steps; i++) {
      this.updateStep(step, input);
      if (this.phase !== 'running' && this.phase !== 'free') break;
    }
    this.updateCarVisuals(dt);
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.2);
    this.rumble = damp(this.rumble, this.player.offTrack ? 1 : 0, 8, dt);
    if (this.phase === 'running' && !this.mode.opponents) {
      // nothing extra: time attack still uses the same lap pipeline
    }
    this.handlePlayerEffects(dt);
  }

  updateCountdown(dt) {
    this.countdownTime += dt;
    const t = this.countdownTime;
    let stage = 'ready';
    if (t >= 3.35) stage = 'go';
    else if (t >= 2.75) stage = '1';
    else if (t >= 2.15) stage = '2';
    else if (t >= 1.55) stage = '3';
    else if (t >= 0.85) stage = 'ready';
    if (stage === this.countdownStage) return;
    this.countdownStage = stage;
    if (stage === 'go') {
      this.phase = 'running';
      this.raceTime = 0;
      this.racers.forEach((r) => { r.lapStartTime = 0; });
      this.emitCountdown('go', 0, 'GO', true);
      this.goHold = 2.1;
      this.callbacks.onGo?.();
    } else if (stage === 'ready') {
      this.emitCountdown('ready', 0, 'READY', false);
    } else {
      const lights = stage === '3' ? 2 : stage === '2' ? 4 : 5;
      this.emitCountdown(stage, lights, stage, false);
      this.callbacks.onCountdownBeep?.(stage);
    }
  }

  updateVisualOnly(dt, input) {
    // Engine revs and suspension movement during the countdown.
    this.player.throttle = input?.throttle ?? 0;
    this.player.brake = input?.brake ?? 0;
    this.player.steer = input?.steer ?? 0;
    this.player.rpm = 0.11 + this.player.throttle * 0.55 + Math.sin(this.time * 7) * 0.01;
    this.player.gear = 'N';
    this.player.car.updateVisual(dt, {
      speed: 0, steer: this.player.steer, braking: this.player.brake > 0.2,
      throttle: this.player.throttle, yawRate: 0, slip: 0,
    });
  }

  updateStep(dt, input) {
    this.raceTime += dt;
    const player = this.player;
    const playerControls = {
      throttle: this.phase === 'free' || this.phase === 'running' ? input.throttle : 0,
      brake: input.brake,
      steer: input.steer,
      drift: input.drift,
      nitro: input.nitro,
    };
    if (!player.finished) {
      this.stepVehicle(player, playerControls, dt);
      this.updateProgress(player);
      this.checkLap(player);
    }
    // AI
    if (this.mode.opponents) {
      for (const r of this.racers) {
        if (r.isPlayer) continue;
        const controls = this.aiControls(r, dt);
        this.stepVehicle(r, controls, dt);
        this.updateProgress(r);
        if (!r.finished) this.checkLap(r);
      }
    }
    this.resolveCarCollisions();
    this.resolveCarCollisions();
    // ensure barriers after car contact
    for (const r of this.racers) this.applyBarrierConstraint(r, true);

    if (this.mode.opponents) {
      for (const r of this.racers) {
        if (r.isPlayer) continue;
        if (!r.finished && r.distanceAlong >= this.mode.laps * this.totalLength) {
          r.finished = true;
          r.finishTime = this.raceTime;
        }
      }
    }

    if (player) {
      if (this.phase === 'running' && this.mode.laps > 0 && player.distanceAlong >= this.mode.laps * this.totalLength) {
        this.finishPlayer();
      }
    }
  }

  stepVehicle(r, controls, dt) {
    const phys = r.def.physics;
    const maxSpeed = phys.maxSpeed;
    const drifting = !!controls.drift;
    const nitroActive = !!controls.nitro && r.nitro > 0.5 && r.forwardSpeed > 2;
    r.boosting = nitroActive;
    const nitroMax = maxSpeed * phys.nitro;

    let forward = FORWARD.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
    let right = RIGHT.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
    const currentVf = r.velocity.dot(forward);
    const currentAbs = Math.abs(currentVf);
    const speedFrac = clamp(currentAbs / maxSpeed, 0, 1.2);
    const steeringAuthority = clamp(currentAbs / (currentAbs + 7), 0, 1);
    const speedReduction = 1 - 0.40 * Math.min(1, speedFrac) * Math.min(1, speedFrac);
    const direction = currentVf < -0.8 ? -1 : 1;
    let yawRate = controls.steer * phys.steer * steeringAuthority * speedReduction * direction;
    if (drifting) yawRate *= 1.16;
    if (r.offTrack) yawRate *= 0.8;
    if (Math.abs(currentVf) > 1) {
      r.yaw = wrapAngle(r.yaw + yawRate * dt);
    }
    r.yawRate = yawRate;
    forward.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
    right.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));

    // Re-project the old velocity onto the newly rotated chassis axes. The
    // lateral component created here is what produces natural slip and drift.
    let vf = r.velocity.dot(forward);
    let vr = r.velocity.dot(right);

    let accel = 0;
    if (controls.throttle > 0) {
      let throttle = controls.throttle;
      if (drifting) throttle *= 0.82;
      accel += phys.accel * 0.54 * throttle * (1 - Math.pow(clamp(vf / maxSpeed, 0, 1), 1.65));
    }
    if (nitroActive) {
      accel += 9.0 * Math.min(1, r.nitro / 12);
      r.nitro = Math.max(0, r.nitro - dt * 30);
    }
    if (controls.brake > 0) {
      if (vf > 0.8) accel -= phys.brake * 0.56 * controls.brake;
      else accel -= 4.4 * controls.brake;
    }
    if (drifting) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.4 * dt);
    }
    const rollingDrag = 0.35 + Math.abs(vf) * 0.012;
    vf += (accel - Math.sign(vf) * rollingDrag) * dt;
    if (!controls.throttle && !controls.brake && !nitroActive) {
      vf = damp(vf, 0, 0.32, dt);
    }
    if (vf < -13) vf = -13;
    const cap = nitroActive ? nitroMax : maxSpeed;
    if (vf > cap) vf = damp(vf, cap, 2.2, dt);

    // Lateral grip. Handbrake breaks the rear away; the player can hold a slide.
    r.offTrack = Math.abs(r.lateral) > this.track.width / 2 - 0.35;
    let grip = drifting ? phys.driftGrip : phys.grip;
    if (r.offTrack) grip *= 0.66;
    if (r.offTrack) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.8 * dt);
    vr *= Math.exp(-grip * dt);
    vf -= Math.sign(vf) * Math.abs(vr) * 0.012 * dt;

    r.steer = controls.steer;
    r.throttle = controls.throttle;
    r.brake = controls.brake;
    r.forwardSpeed = vf;
    r.lateralSpeed = vr;
    r.velocity.set(forward.x * vf + right.x * vr, 0, forward.z * vf + right.z * vr);
    r.position.addScaledVector(r.velocity, dt);
    r.speed = Math.hypot(r.velocity.x, r.velocity.z);
    r.slip = clamp(Math.abs(vr) / (Math.abs(vf) + 4.5) * 1.75, 0, 1);
    if (drifting && Math.abs(vf) > 4) r.slip = Math.max(r.slip, 0.35);
    r.driftScore += Math.max(0, r.slip - 0.22) * r.speed * dt * 3.3;
    if (drifting && r.speed > 5) {
      r.nitro = Math.min(100, r.nitro + dt * (2.5 + r.slip * 12));
    } else if (r.speed > 15 && r.slip < 0.1) {
      r.nitro = Math.min(100, r.nitro + dt * 0.7);
    }
    r.impact = damp(r.impact, 0, 5, dt);
    this.applyBarrierConstraint(r, false, dt);
  }

  updateProgress(r) {
    const near = this.track.nearest(r.position.x, r.position.z, r.trackIndex, 90);
    const L = this.totalLength;
    let delta = near.sample.distance - r.trackDistance;
    if (delta > L / 2) delta -= L;
    if (delta < -L / 2) delta += L;
    r.distanceAlong += delta;
    r.trackDistance = near.sample.distance;
    r.trackIndex = near.index;
    r.lateral = near.lateral;
    r.avgSpeed = r.speed;
  }

  checkLap(r) {
    if (this.mode.laps === 0) return;
    const completed = Math.floor(Math.max(0, r.distanceAlong) / this.totalLength);
    if (completed <= r.lapsCompleted) return;
    while (r.lapsCompleted < completed) {
      r.lapsCompleted++;
      const lapTime = this.raceTime - r.lapStartTime;
      r.lapStartTime = this.raceTime;
      r.lastLap = lapTime;
      r.lapTimes.push(lapTime);
      r.bestLap = Math.min(r.bestLap, lapTime);
      if (r.lapsCompleted < this.mode.laps) {
        r.lap = r.lapsCompleted + 1;
      } else {
        r.lap = this.mode.laps;
      }
      if (r.isPlayer) {
        this.callbacks.onLap?.({
          lap: r.lapsCompleted,
          time: lapTime,
          totalLaps: this.mode.laps,
          best: r.bestLap === lapTime,
        });
      }
    }
  }

  aiControls(r, dt) {
    const ai = r.ai;
    const speed = Math.max(0, r.forwardSpeed);
    const look = 11 + Math.min(speed, 90) * 0.44;
    const targetDistance = r.distanceAlong + look;
    const pose = this.track.getPoseAt(targetDistance);
    // overtaking / separation
    let targetOffset = ai.homeOffset * 0.55 + Math.sin(r.distanceAlong * 0.012 + ai.seed) * 0.7;
    let nearestAhead = null;
    let nearestGap = Infinity;
    for (const other of this.racers) {
      if (other === r) continue;
      const gap = other.distanceAlong - r.distanceAlong;
      const sideGap = other.lateral - r.lateral;
      if (gap > 0 && gap < 17 && Math.abs(sideGap) < 3.3) {
        if (gap < nearestGap) { nearestGap = gap; nearestAhead = other; }
      }
      if (gap > -2 && gap < 6 && Math.abs(sideGap) < 3.2) {
        targetOffset += (sideGap > 0 ? -1 : 1) * (6 - Math.max(0, gap)) * 0.16;
      }
    }
    if (nearestAhead) {
      const side = r.lateral >= nearestAhead.lateral ? 1 : -1;
      if (nearestGap > 5.5) targetOffset = clamp(nearestAhead.lateral + side * 3.2, -5.9, 5.9);
      else targetOffset = clamp(nearestAhead.lateral - side * 2.5, -5.9, 5.9);
    }
    ai.targetOffset = damp(ai.targetOffset, clamp(targetOffset, -5.9, 5.9), 1.8, dt);
    const target = pose.position.clone().addScaledVector(pose.right, ai.targetOffset);
    const desiredYaw = Math.atan2(target.x - r.position.x, target.z - r.position.z);
    let steer = clamp(angleDiff(desiredYaw, r.yaw) * 2.2, -1, 1);

    const scanAhead = 45 + speed * 1.65;
    const maxCurv = this.maxCurvatureAhead(r.trackIndex, scanAhead);
    const cornerSpeed = maxCurv > 0.0004 ? Math.sqrt(16.5 / maxCurv) : 999;
    const rubber = this.player ? clamp((this.player.distanceAlong - r.distanceAlong) / 260, -0.025, 0.045) : 0;
    const targetSpeed = Math.min(
      r.def.physics.maxSpeed * (0.80 + ai.skill * 0.115 + rubber),
      cornerSpeed * (0.92 + ai.skill * 0.07),
    );
    let throttle = speed < targetSpeed ? 1 : 0;
    let brake = 0;
    if (speed > targetSpeed * 1.08) { throttle = 0; brake = 1; }
    else if (speed > targetSpeed) throttle = 0.2;
    if (nearestAhead && nearestGap < 5.8) {
      throttle = 0;
      brake = Math.max(brake, 0.55);
    }
    if (r.finished) {
      throttle = 0;
      brake = 0.3;
      steer *= 0.7;
    }

    // Rare anti-stuck recovery, keeps the field from locking up after a pileup.
    if (this.phase === 'running' && speed < 1.2 && !r.finished) {
      r.stuckTimer = (r.stuckTimer || 0) + dt;
      if (r.stuckTimer > 2.2) {
        const rescue = this.track.getPoseAt(r.distanceAlong);
        r.position.copy(rescue.position).addScaledVector(rescue.right, ai.homeOffset * 0.4);
        r.yaw = rescue.yaw;
        r.velocity.set(Math.sin(r.yaw) * 6, 0, Math.cos(r.yaw) * 6);
        r.forwardSpeed = 6;
        r.trackIndex = rescue.index;
        r.trackDistance = rescue.distance;
        r.stuckTimer = 0;
        r.car.root.position.copy(r.position);
        r.car.root.rotation.y = r.yaw;
      }
    } else {
      r.stuckTimer = 0;
    }

    if (r.offTrack) steer = clamp(steer + pose.curvature * 1.5, -1, 1);
    return {
      throttle, brake, steer, drift: false, nitro: false,
    };
  }

  maxCurvatureAhead(index, distance) {
    const samples = this.track.samples;
    let max = 0;
    let traveled = 0;
    let i = index;
    const n = samples.length;
    const segment = this.totalLength / n;
    while (traveled < distance) {
      const c = Math.abs(samples[i].curvature);
      if (c > max) max = c;
      traveled += segment;
      i = (i + 1) % n;
      if (traveled > this.totalLength) break;
    }
    return max;
  }

  applyBarrierConstraint(r, final = false, dt = 0.016) {
    const near = this.track.nearest(r.position.x, r.position.z, r.trackIndex, 45);
    const limit = this.track.width / 2 + 0.15;
    const sign = Math.sign(near.lateral) || 1;
    if (Math.abs(near.lateral) > limit) {
      const push = Math.abs(near.lateral) - limit;
      r.position.addScaledVector(near.sample.right, -sign * (push + 0.01));
      r.position.y = 0;
      const outward = near.sample.right.clone().multiplyScalar(sign);
      const outwardSpeed = r.velocity.dot(outward);
      if (outwardSpeed > 0.05) {
        r.velocity.addScaledVector(outward, -1.06 * outwardSpeed);
        const hitStrength = clamp(outwardSpeed / 12, 0.04, 1.3);
        if (outwardSpeed > 1.2) {
          r.velocity.multiplyScalar(1 - Math.min(0.12, outwardSpeed * 0.008));
        }
        if (r.wallCooldown <= 0 && outwardSpeed > 1.4) {
          r.wallCooldown = 0.35;
          r.cameraShake = r.isPlayer ? hitStrength : 0;
          if (r.isPlayer) {
            this.cameraShake = Math.max(this.cameraShake, hitStrength);
            this.callbacks.onImpact?.(hitStrength);
            this.audio?.hit(hitStrength);
            const point = near.sample.position.clone().addScaledVector(near.sample.right, sign * (this.track.width / 2 + 0.6));
            this.effects?.sparkBurst(point, outward.clone().negate(), Math.round(8 + hitStrength * 18), 0.6 + hitStrength);
          }
        }
      }
      r.forwardSpeed = r.velocity.dot(new THREE.Vector3(Math.sin(r.yaw), 0, Math.cos(r.yaw)));
      r.lateralSpeed = 0;
      // Nudge the nose parallel to the wall, strongest on a heavy impact.
      const tangentYaw = Math.atan2(near.sample.tangent.x, near.sample.tangent.z);
      const diff = angleDiff(r.yaw, tangentYaw);
      r.yaw = wrapAngle(r.yaw - diff * clamp(0.02 + Math.abs(outwardSpeed || 0) * 0.02, 0, 0.2));
      r.car.root.rotation.y = r.yaw;
      r.trackIndex = near.index;
      r.lateral = sign * limit;
    }
    if (r.wallCooldown > 0) r.wallCooldown -= dt;
    if (final) {
      r.car.root.position.copy(r.position);
      r.car.root.rotation.y = r.yaw;
    }
  }

  resolveCarCollisions() {
    const n = this.racers.length;
    const offsets = [-1.05, 1.05];
    for (let i = 0; i < n; i++) {
      const a = this.racers[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.racers[j];
        let hit = null;
        for (const oa of offsets) {
          for (const ob of offsets) {
            const pa = TEMP.set(a.position.x + Math.sin(a.yaw) * oa, 0, a.position.z + Math.cos(a.yaw) * oa);
            const pb = TEMP2.set(b.position.x + Math.sin(b.yaw) * ob, 0, b.position.z + Math.cos(b.yaw) * ob);
            const dx = pb.x - pa.x, dz = pb.z - pa.z;
            const d2 = dx * dx + dz * dz;
            const minD = 1.86;
            if (d2 < minD * minD) {
              hit = { dx, dz, dist: Math.sqrt(d2) || 0.001, minD, pa: pa.clone(), pb: pb.clone() };
              break;
            }
          }
          if (hit) break;
        }
        if (!hit) continue;
        const nx = hit.dx / hit.dist;
        const nz = hit.dz / hit.dist;
        const overlap = hit.minD - hit.dist;
        a.position.x -= nx * overlap * 0.62;
        a.position.z -= nz * overlap * 0.62;
        b.position.x += nx * overlap * 0.62;
        b.position.z += nz * overlap * 0.62;
        const rel = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
        if (rel < 0) {
          const impulse = -rel * 0.5;
          a.velocity.x -= nx * impulse;
          a.velocity.z -= nz * impulse;
          b.velocity.x += nx * impulse;
          b.velocity.z += nz * impulse;
        }
        a.velocity.multiplyScalar(0.988);
        b.velocity.multiplyScalar(0.988);
        const strength = clamp((overlap * 3 + Math.abs(rel)) / 12, 0.05, 1);
        if (a.isPlayer || b.isPlayer) {
          this.cameraShake = Math.max(this.cameraShake, strength * 0.9);
          this.callbacks.onImpact?.(strength * 0.65);
          if (this.player.impact < 0.25) this.audio?.hit(strength * 0.75);
          this.effects?.sparkBurst(TEMP.set((a.position.x + b.position.x) / 2, 0.6, (a.position.z + b.position.z) / 2), null, 5, 0.4);
          this.player.impact = Math.max(this.player.impact, 0.03);
        }
        a.car.root.position.copy(a.position);
        b.car.root.position.copy(b.position);
        const aDir = Math.sign(Math.sin(a.yaw) * nz - Math.cos(a.yaw) * nx) || 1;
        const bDir = Math.sign(Math.sin(b.yaw) * nz - Math.cos(b.yaw) * nx) || 1;
        a.yaw += aDir * overlap * 0.012;
        b.yaw -= bDir * overlap * 0.012;
        a.car.root.rotation.y = a.yaw;
        b.car.root.rotation.y = b.yaw;
      }
    }
  }

  handlePlayerEffects(dt) {
    const p = this.player;
    if (!p) return;
    this.smokeTimer -= dt;
    this.skidTimer -= dt;
    const rearLeft = p.car.root.localToWorld(TEMP.set(-0.81, 0.035, -1.35));
    const rearRight = p.car.root.localToWorld(TEMP2.set(0.81, 0.035, -1.35));
    if (p.boosting && p.speed > 6) {
      const fwd = TEMP3.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      const tail = TEMP4.set(p.position.x - fwd.x * 2.3, 0.42, p.position.z - fwd.z * 2.3);
      this.effects?.emitBoost(tail, fwd, 1);
    }
    if (p.slip > 0.28 && p.speed > 5) {
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.035;
        this.effects?.emitDriftSmoke(rearLeft, p.velocity, p.slip);
        this.effects?.emitDriftSmoke(rearRight, p.velocity, p.slip);
      }
      if (this.skidTimer <= 0) {
        this.skidTimer = 0.085;
        this.effects?.addSkidPair(rearLeft, rearRight, p.yaw, Math.min(1, p.slip));
      }
    }
  }

  updateCarVisuals(dt) {
    for (const r of this.racers) {
      r.car.root.position.copy(r.position);
      r.car.root.rotation.y = r.yaw;
      r.car.updateVisual(dt, {
        speed: r.speed,
        steer: r.steer,
        braking: r.brake > 0.2,
        throttle: r.throttle,
        yawRate: r.yawRate,
        slip: r.slip,
        impact: r.impact,
        boost: r.boosting ? 1 : 0,
      });
    }
    this.updateRpm();
  }

  updateRpm() {
    const p = this.player;
    if (!p) return;
    const kph = p.speed * 3.6 * Math.sign(p.forwardSpeed || 1);
    const absKph = Math.abs(kph);
    const thresholds = [0, 55, 92, 132, 174, 218, 266, 999];
    let gear = 'N';
    let rpm = 0.12;
    if (p.forwardSpeed < -0.4) {
      gear = 'R';
      rpm = clamp(0.2 + absKph / 40 * 0.4, 0, 0.65);
    } else if (absKph < 1) {
      gear = 'N';
      rpm = 0.13 + p.throttle * 0.5;
    } else {
      let g = 1;
      for (let i = 1; i < thresholds.length - 1; i++) {
        if (absKph >= thresholds[i]) g = i + 1;
      }
      const lo = thresholds[g - 1];
      const hi = thresholds[g];
      rpm = clamp(0.22 + ((absKph - lo) / (hi - lo)) * 0.72 + p.throttle * 0.05, 0.15, 1);
      gear = String(g);
    }
    p.gear = gear;
    p.rpm = rpm;
  }

  finishPlayer() {
    if (this.phase !== 'running') return;
    this.player.finished = true;
    this.player.finishTime = this.raceTime;
    this.phase = 'finishing';
    this.finishHold = 1.55;
    this.callbacks.onPlayerFinish?.();
    this.track.setStartLights('off');
    this.audio?.beep(880, 0.3, 0.1);
  }

  getPlayerRank() {
    const finished = this.racers.filter((r) => r.finished && r.finishTime !== null);
    const unfinished = this.racers.filter((r) => !r.finished).sort((a, b) => b.distanceAlong - a.distanceAlong);
    finished.sort((a, b) => a.finishTime - b.finishTime);
    const order = [...finished, ...unfinished];
    return order.indexOf(this.player) + 1;
  }

  buildClassification() {
    const finished = this.racers.filter((r) => r.finished && r.finishTime !== null)
      .sort((a, b) => a.finishTime - b.finishTime);
    const unfinished = this.racers.filter((r) => !r.finished)
      .sort((a, b) => b.distanceAlong - a.distanceAlong);
    const order = [...finished, ...unfinished];
    const winnerTime = finished[0]?.finishTime ?? this.raceTime;
    return order.map((r, idx) => {
      r.finishPosition = idx + 1;
      let gap = 0;
      if (idx === 0) gap = 0;
      else if (r.finished && r.finishTime != null) gap = r.finishTime - winnerTime;
      else gap = ((r.finishedDistance ?? (this.mode.laps * this.totalLength)) - r.distanceAlong) === 0
        ? 0
        : ((this.mode.laps * this.totalLength) - r.distanceAlong) / Math.max(8, r.avgSpeed || 30);
      return {
        position: idx + 1,
        id: r.id,
        name: r.name,
        shortName: r.shortName,
        color: r.color,
        isPlayer: r.isPlayer,
        def: r.def,
        time: r.finished ? r.finishTime : null,
        gap,
        bestLap: r.bestLap,
        lastLap: r.lastLap,
        finished: r.finished,
        distance: r.distanceAlong,
      };
    });
  }

  buildResults() {
    const classification = this.buildClassification();
    const playerEntry = classification.find((c) => c.isPlayer);
    const winner = classification[0];
    return {
      mode: this.mode,
      position: playerEntry?.position ?? 1,
      totalTime: this.player.finishTime ?? this.raceTime,
      bestLap: this.player.bestLap,
      lapTimes: [...this.player.lapTimes],
      classification,
      winner,
      totalRacers: this.racers.length,
    };
  }

  getHudState() {
    const p = this.player;
    const kph = Math.round(p.speed * 3.6);
    const rank = this.getPlayerRank();
    const currentLap = Math.min(this.mode.laps || 1, Math.max(1, Math.floor(Math.max(0, p.distanceAlong) / this.totalLength) + 1));
    const lapElapsed = this.phase === 'finished' || this.phase === 'finishing'
      ? (p.lastLap ?? 0)
      : Math.max(0, this.raceTime - p.lapStartTime);
    return {
      phase: this.phase,
      mode: this.mode.id,
      position: rank,
      totalRacers: this.mode.opponents ? this.racers.length : 1,
      lap: this.mode.laps ? currentLap : 0,
      totalLaps: this.mode.laps,
      raceTime: this.raceTime,
      lapTime: lapElapsed,
      lastLap: p.lastLap,
      bestLap: p.bestLap,
      speed: kph,
      gear: p.gear,
      rpm: p.rpm,
      nitro: p.nitro,
      driftScore: p.driftScore,
      throttle: p.throttle,
      slip: p.slip,
      offTrack: p.offTrack,
      standings: this.getStandings(),
      cameraShake: this.cameraShake,
      free: !this.mode.laps,
    };
  }

  getStandings() {
    const finished = this.racers.filter((r) => r.finished && r.finishTime !== null)
      .sort((a, b) => a.finishTime - b.finishTime);
    const unfinished = this.racers.filter((r) => !r.finished)
      .sort((a, b) => b.distanceAlong - a.distanceAlong);
    const order = [...finished, ...unfinished];
    const leader = order[0];
    return order.map((r, i) => {
      let gap = 0;
      if (i > 0) {
        if (r.finished && leader?.finished) gap = r.finishTime - leader.finishTime;
        else gap = (leader.distanceAlong - r.distanceAlong) / Math.max(18, leader.speed || 30);
      }
      return {
        position: i + 1,
        id: r.id,
        name: r.shortName,
        color: r.color,
        isPlayer: r.isPlayer,
        gap,
        finished: r.finished,
      };
    });
  }

  getMinimapCars() {
    return this.racers.map((r) => ({
      x: r.position.x,
      z: r.position.z,
      color: r.color,
      isPlayer: r.isPlayer,
      yaw: r.yaw,
    }));
  }

  resetPlayerToTrack() {
    if (!this.player || (this.phase !== 'running' && this.phase !== 'free')) return;
    const p = this.player;
    const near = this.track.nearest(p.position.x, p.position.z, p.trackIndex, 200);
    const s = near.sample;
    const pos = s.position.clone().addScaledVector(s.right, clamp(near.lateral, -5, 5));
    p.position.copy(pos);
    p.yaw = Math.atan2(s.tangent.x, s.tangent.z);
    p.velocity.set(0, 0, 0);
    p.forwardSpeed = 0;
    p.lateralSpeed = 0;
    p.speed = 0;
    p.trackIndex = near.index;
    p.trackDistance = s.distance;
    p.lateral = near.lateral;
    p.car.root.position.copy(pos);
    p.car.root.rotation.y = p.yaw;
    this.effects?.clear();
    this.cameraShake = 0;
  }

  get cameraFocus() {
    return this.player?.position ?? new THREE.Vector3();
  }

  get cameraYaw() {
    return this.player?.yaw ?? 0;
  }

  get playerSpeed() {
    return this.player?.speed ?? 0;
  }

  dispose() {
    for (const r of this.racers) {
      this.scene.remove(r.car.root);
      // geometry/material disposal is intentionally omitted here: shared wheel
      // geometry is reused by the menu showroom and by future races.
    }
    this.racers = [];
    this.player = null;
  }
}
