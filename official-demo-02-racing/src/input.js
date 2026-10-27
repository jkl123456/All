import { clamp, damp } from './utils.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'drift',
  ShiftLeft: 'nitro', ShiftRight: 'nitro',
  KeyC: 'camera',
  PageUp: 'pitchUp',
  PageDown: 'pitchDown',
  KeyR: 'reset',
  Escape: 'pause',
  KeyM: 'mute',
  KeyP: 'photo',
  Enter: 'enter',
};

// 标准映射（Xbox 布局）：0=A 1=B 2=X 3=Y 4=LB 5=RB 6=LT 7=RT 9=Start 12-15=方向键
const PAD = {
  nitro: 0,
  drift: 1,
  reset: 2,
  camera: 3,
  pause: 9,
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.touches = new Set();
    this.pressed = new Set();
    this.active = false;
    this.steer = 0;
    this.steerTarget = 0;
    this.gamepadIndex = null;
    this.padConnected = false;
    this.padId = '';
    this.padSteer = 0;
    this.padThrottle = 0;
    this.padBrake = 0;
    this.padPitch = 0;
    this.padPrev = [];
    // 可调参数（由设置面板写入）
    this.steerSensitivity = 1;
    this.deadzone = 0.12;
    this.invertStick = false;
    this.rumbleEnabled = true;
    // 摇杆轴：部分手柄 X 在 axes[0]，部分在 axes[2]
    this.padAxis = null;
    this.callbacks = {};
    this.bind();
  }

  on(action, fn) {
    (this.callbacks[action] ||= []).push(fn);
  }

  emit(action, payload) {
    for (const fn of this.callbacks[action] || []) fn(payload);
  }

  setTuning({ sensitivity, deadzone, invertStick, rumble } = {}) {
    if (sensitivity !== undefined) this.steerSensitivity = clamp(sensitivity, 0.3, 1.3);
    if (deadzone !== undefined) this.deadzone = clamp(deadzone, 0.02, 0.35);
    if (invertStick !== undefined) this.invertStick = Boolean(invertStick);
    if (rumble !== undefined) this.rumbleEnabled = Boolean(rumble);
  }

  /** 手柄震动（毫秒级一次性），浏览器不支持时静默忽略。 */
  rumble(strength = 0.5, duration = 90) {
    if (!this.rumbleEnabled || this.gamepadIndex === null) return;
    const pads = navigator.getGamepads?.() || [];
    const gp = pads[this.gamepadIndex];
    const act = gp?.vibrationActuator;
    if (!act?.playEffect) return;
    try {
      act.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: clamp(strength * 0.7, 0, 1),
        strongMagnitude: clamp(strength, 0, 1),
      });
    } catch { /* 部分浏览器/设备不支持 */ }
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(action);
      this.emit(action);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touches.clear();
      this.steerTarget = 0;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys.clear();
        this.touches.clear();
      }
    });

    document.querySelectorAll('[data-touch]').forEach((btn) => {
      const action = btn.dataset.touch;
      const down = (e) => {
        e.preventDefault();
        this.touches.add(action);
        btn.classList.add('is-down');
        this.pressed.add(action);
        this.emit(action);
      };
      const up = (e) => {
        e.preventDefault();
        this.touches.delete(action);
        btn.classList.remove('is-down');
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.padConnected = true;
      this.padId = e.gamepad.id;
      this.emit('gamepad', { connected: true, id: e.gamepad.id });
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.padConnected = false;
        this.padId = '';
        this.padSteer = 0;
        this.padThrottle = 0;
        this.padBrake = 0;
        this.emit('gamepad', { connected: false, id: '' });
      }
    });
  }

  /** 每帧轮询手柄：模拟量转向 + 扳机油门/刹车 + 按键事件。 */
  pollGamepad() {
    if (!navigator.getGamepads) return;
    let gp = this.gamepadIndex !== null ? navigator.getGamepads()[this.gamepadIndex] : null;
    if (!gp) {
      const all = navigator.getGamepads();
      for (const p of all) {
        if (p && p.connected) { gp = p; break; }
      }
      if (!gp) {
        if (this.padConnected) {
          this.padConnected = false;
          this.gamepadIndex = null;
          this.emit('gamepad', { connected: false, id: '' });
        }
        this.padSteer = 0;
        this.padThrottle = 0;
        this.padBrake = 0;
        return;
      }
      this.gamepadIndex = gp.index;
      this.padConnected = true;
      this.padId = gp.id;
      this.emit('gamepad', { connected: true, id: gp.id });
    }

    // 左摇杆 X：默认 axes[0]，静止时若 axes[2] 有值说明是另一套映射
    let ax = gp.axes[this.padAxis ?? 0] ?? 0;
    if (this.padAxis === null && Math.abs(ax) < 0.03) {
      const alt = gp.axes[2] ?? 0;
      if (Math.abs(alt) > 0.2) {
        ax = alt;
        this.padAxis = 2;
      }
    }
    if (this.invertStick) ax = -ax;
    const dz = this.deadzone;
    const mag = Math.abs(ax);
    this.padSteer = mag > dz ? Math.sign(ax) * ((mag - dz) / (1 - dz)) : 0;

    // 方向键补一个数字量转向（很多手柄习惯十字键）
    const dpadLeft = Boolean(gp.buttons[14]?.pressed);
    const dpadRight = Boolean(gp.buttons[15]?.pressed);
    if (dpadLeft) this.padSteer = -1;
    else if (dpadRight) this.padSteer = 1;

    this.padThrottle = clamp(Math.max(gp.buttons[7]?.value || 0, gp.buttons[12]?.pressed ? 1 : 0), 0, 1);
    this.padBrake = clamp(Math.max(gp.buttons[6]?.value || 0, gp.buttons[13]?.pressed ? 1 : 0), 0, 1);
    this.padPitch = clamp((gp.buttons[5]?.pressed ? 1 : 0) - (gp.buttons[4]?.pressed ? 1 : 0), -1, 1);

    for (const [action, index] of Object.entries(PAD)) {
      const down = Boolean(gp.buttons[index]?.pressed);
      if (down && !this.padPrev[index]) {
        this.pressed.add(action);
        this.emit(action);
      }
      this.padPrev[index] = down;
    }
  }

  setActive(active) {
    this.active = active;
    if (!active) {
      this.keys.clear();
      this.touches.clear();
      this.steerTarget = 0;
    }
  }

  consumePressed(action) {
    if (this.pressed.has(action)) {
      this.pressed.delete(action);
      return true;
    }
    return false;
  }

  update(dt) {
    this.pollGamepad();

    let left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touches.has('left');
    let right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touches.has('right');
    let throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touches.has('throttle') ? 1 : 0;
    let brake = this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touches.has('brake') ? 1 : 0;
    let drift = this.keys.has('Space') || this.touches.has('drift');
    let nitro = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touches.has('nitro');

    throttle = Math.max(throttle, this.padThrottle);
    brake = Math.max(brake, this.padBrake);
    drift = drift || Boolean(this.padPrev[PAD.drift]);
    nitro = nitro || Boolean(this.padPrev[PAD.nitro]);

    // 键盘/触屏是数字量，手柄是模拟量；有摇杆输入时优先摇杆
    let target = (left ? 1 : 0) - (right ? 1 : 0);
    // 摇杆右推是 +ax，但正 steer 在画面上是向左，所以这里要取反
    if (Math.abs(this.padSteer) > 0.02) target = -this.padSteer;
    // 车头朝 +Z，正转向在追尾视角里是向左，所以 A/左 = 正值
    // 灵敏度同时作用于「打角幅度」和「回正速度」：
    // 只乘幅度的话，滑杆超过 100 就会被 clamp 吃掉，整段无效；
    // 加上响应速度后，低灵敏是顺滑慢打，高灵敏是锐利快打，全程都能感觉到差别。
    const sens = this.steerSensitivity;
    const gain = Math.min(1, sens);
    this.steerTarget = clamp(target * gain, -1, 1);
    // 100 以上幅度已经打满，继续拉高就改成「打角更快」，否则上半天滑杆毫无手感
    const rate = 6.5 * (sens <= 1 ? clamp(sens, 0.5, 1) : 1 + (sens - 1) * 3);
    const followRate = Math.abs(this.padSteer) > 0.02 ? rate * 1.8 : this.steerTarget === 0 ? 9 * gain : rate;
    this.steer = damp(this.steer, this.steerTarget, followRate, dt);
    this.throttle = clamp(throttle, 0, 1);
    this.brake = clamp(brake, 0, 1);
    this.drift = drift;
    this.nitro = nitro;

    // 视角俯仰：PageUp/PageDown 或手柄 LB/RB
    const pitchUp = this.keys.has('PageUp') ? 1 : 0;
    const pitchDown = this.keys.has('PageDown') ? 1 : 0;
    this.pitch = clamp(pitchUp - pitchDown + (this.padPitch || 0), -1, 1);
  }

  get input() {
    return {
      throttle: this.throttle,
      brake: this.brake,
      steer: this.steer,
      steerTarget: this.steerTarget,
      drift: this.drift,
      nitro: this.nitro,
      pitch: this.pitch || 0,
    };
  }

  endFrame() {
    this.pressed.clear();
  }
}
