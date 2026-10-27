import { character } from './characterAssets.js';
import { RunnerPlayer } from './runnerPlayer.js';
import { ProceduralPlayer } from './proceduralPlayer.js';

/**
 * 主角入口。
 *
 * 默认使用从苔溪镇（xiǎozhèn）搬过来的 RunnerPlayer：同一套 Mixamo 骨骼、
 * 同一套走/跑/待机片段、同样的 2.9 / 5.8 米每秒速度与转向阻尼，
 * 所以「移动」和苔溪镇是同一份手感。
 *
 * 模型加载失败时退回原来的程序化角色，游戏不会因为一个 GLB 打不开就没了主角。
 */
export class Player {
  constructor({ groundY = 1.12, onFootstep = null } = {}) {
    this.groundY = groundY;
    this.onFootstep = onFootstep;
    if (character.ready && character.gltf) {
      this.mode = 'runner';
      this.impl = new RunnerPlayer(character.gltf, character.clips, { groundY });
      this.impl.root.name = 'player';
    } else {
      this.mode = 'procedural';
      this.impl = new ProceduralPlayer({ groundY, onFootstep });
    }
    this.root = this.impl.root;
    this.stepTimer = 0;
  }

  get facing() {
    return this.impl.facing;
  }

  get speed() {
    return this.impl.speed ?? Math.hypot(this.impl.velocity?.x ?? 0, this.impl.velocity?.z ?? 0);
  }

  update(dt, { moveX = 0, moveZ = 0, run = false, cameraYaw = 0, walkable = () => true, paused = false } = {}) {
    if (this.mode === 'runner') {
      this.impl.update(
        dt,
        {
          forward: paused ? 0 : moveZ,
          strafe: paused ? 0 : moveX,
          run,
        },
        cameraYaw,
        paused ? () => true : walkable,
      );
    } else {
      this.impl.update(dt, {
        moveX: paused ? 0 : moveX,
        moveZ: paused ? 0 : moveZ,
        run,
        cameraYaw,
        walkable: paused ? () => true : walkable,
        paused,
      });
    }

    // 脚步声：按实际速度给一个节拍，和苔溪镇走路的节奏一致
    if (this.onFootstep && this.mode === 'runner' && !paused) {
      const speed = Math.hypot(this.impl.velocity.x, this.impl.velocity.z);
      if (speed > 1.1) {
        this.stepTimer -= dt * (run ? 1.65 : 1.15);
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.42;
          this.onFootstep();
        }
      } else {
        this.stepTimer = 0;
      }
    }
  }

  getCameraTarget(out) {
    return this.impl.getCameraTarget(out);
  }

  setPosition(x, z, rotation) {
    this.impl.setPosition(x, z, rotation);
  }

  setVisible(visible) {
    this.impl.setVisible(visible);
  }

  /** 播放一次性动作（采集、跳跃等），模型没有对应片段时静默忽略 */
  playAction(name) {
    return this.impl.playAction?.(name) ?? false;
  }

  get spawn() {
    return this.root.position;
  }
}
