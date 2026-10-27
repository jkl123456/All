import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp } from '../core/mathUtils.js';

const WALK_SPEED = 2.9;
const RUN_SPEED = 5.8;
/**
 * 动画驱动角色时的步速倍率：角色的实际移动速度 = 动作自然速度 × 倍率。
 * 1.0 时脚完全不打滑；稍微给一点余量，走起来才有精神。
 */
const WALK_PACE = 1.18;
const RUN_PACE = 1.15;
const PLAYER_HEIGHT = 1.78;
const RADIUS = 0.24;

/** 参与程序化动作的骨骼 */
const BONES = [
  'pelvis',
  'spine_01',
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  'clavicle_l',
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'clavicle_r',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'thigh_l',
  'calf_l',
  'foot_l',
  'ball_l',
  'thigh_r',
  'calf_r',
  'foot_r',
  'ball_r',
];

/** 静止站姿：手臂从 T-pose 放下，肘部微屈（真实值在 setupRig 里按姿势自动量） */
const ARM_DOWN = 1.33;

/**
 * 不同来源的模型骨骼命名不一样（Unreal 风格 thigh_l / Blender 风格 thigh.L），
 * 这里给出别名表，程序化动作就能套到任意一套 Humanoid 骨架上。
 */
const BONE_ALIASES = {
  pelvis: ['pelvis', 'hips', 'root_pelvis', 'Hips'],
  spine_01: ['spine_01', 'spine.01', 'spine_1', 'Abdomen', 'Spine'],
  spine_02: ['spine_02', 'spine.02', 'spine_2', 'Torso', 'Spine1'],
  spine_03: ['spine_03', 'spine.03', 'spine_3', 'Chest', 'Spine2'],
  neck_01: ['neck_01', 'neck', 'Neck'],
  Head: ['Head', 'head'],
  clavicle_l: ['clavicle_l', 'shoulder.L', 'shoulder_l', 'Shoulder.L', 'LeftShoulder'],
  upperarm_l: ['upperarm_l', 'upper_arm.L', 'upperarm.L', 'UpperArm.L', 'LeftArm'],
  lowerarm_l: ['lowerarm_l', 'forearm.L', 'lower_arm.L', 'LowerArm.L', 'LeftForeArm'],
  hand_l: ['hand_l', 'hand.L', 'Wrist.L', 'LeftHand'],
  clavicle_r: ['clavicle_r', 'shoulder.R', 'shoulder_r', 'Shoulder.R', 'RightShoulder'],
  upperarm_r: ['upperarm_r', 'upper_arm.R', 'upperarm.R', 'UpperArm.R', 'RightArm'],
  lowerarm_r: ['lowerarm_r', 'forearm.R', 'lower_arm.R', 'LowerArm.R', 'RightForeArm'],
  hand_r: ['hand_r', 'hand.R', 'Wrist.R', 'RightHand'],
  thigh_l: ['thigh_l', 'thigh.L', 'UpperLeg.L', 'LeftUpLeg'],
  calf_l: ['calf_l', 'shin.L', 'lowerleg.L', 'calf.L', 'LowerLeg.L', 'LeftLeg'],
  foot_l: ['foot_l', 'tarsal.L', 'foot.L', 'Foot.L', 'LeftFoot'],
  ball_l: ['ball_l', 'toe.L', 'PT.L', 'LeftToeBase'],
  thigh_r: ['thigh_r', 'thigh.R', 'UpperLeg.R', 'RightUpLeg'],
  calf_r: ['calf_r', 'shin.R', 'lowerleg.R', 'calf.R', 'LowerLeg.R', 'RightLeg'],
  foot_r: ['foot_r', 'tarsal.R', 'foot.R', 'Foot.R', 'RightFoot'],
  ball_r: ['ball_r', 'toe.R', 'PT.R', 'RightToeBase'],
};

const BUILT_ORDER = (clips, re) => clips.find((c) => re.test(c.name)) || null;

/**
 * 武器握持参数：武器模型的坐标轴（剑沿 +X、枪沿 +Y，原点在握把端），
 * 手骨（Wrist）的局部 +Y 指向手指方向，所以剑需要绕 Z 转 90° 才对上。
 */
/**
 * 武器握持参数（全部在"身体坐标系"里描述，+Y 上、+Z 前、+X 右）：
 *   grip  = 手应该抓在武器本地坐标的哪个点
 *   axis  = 武器某条本地轴希望指向身体坐标系的哪个方向；再给一个 up 向量定滚转
 *
 * 这样写的好处：不用靠手骨当前姿态试朝向，站立姿势下武器一定是对准的，
 * 之后手怎么摆，武器跟着手走。
 */
/**
 * 武器握持参数，全部写"手骨空间"里（这套骨架的手骨：+Y = 手指方向，
 * +Z = 手背朝外，+X = 拇指侧）：
 *   grip  = 手抓在武器本地坐标的哪一点
 *   basis = 武器自己的 X / Y / Z 轴分别指向手骨的哪个轴
 *
 * 用固定本地朝向而不是"世界朝向"，是为了让任意姿势下都握得对：
 * 手抬起来开枪时，枪自然跟着手腕走。
 */
const WEAPON_GRIP = {
  // 剑：本地 X 是刃向（X=0 剑尖、0.66~0.95 握把），让刃朝"手骨 -Y"= 顺着前臂向上；
  //     刀面法线（本地 Y）朝手背，于是刀身贴着手侧立，不会横切进腿里
  sword: {
    grip: [0.80, 0, 0],
    basis: [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  },
  // 枪：本地 -Z 是枪管。这里有两套轴向，因为两段动画的手腕滚转差了 90°：
  //   basis     —— 持枪跑（Pistol Run 重定向片段）：跑起来手朝前，枪管顺着手指前方
  //   basisIdle —— 持枪待机（Idle_Gun 原生片段）：手腕转了个角度，枪管顺着手掌前方
  gun: {
    grip: [0, -0.01, -0.05],
    // 两段动画的手腕滚转不一致，所以"跑"和"待机"各给一套（实测反解出来的）
    basis: [[-0.073, 0.476, -0.876], [0.715, -0.588, -0.379], [-0.695, -0.654, -0.298]],
    basisIdle: [[-0.018, 0.266, -0.964], [0.384, -0.888, -0.252], [-0.923, -0.375, -0.086]],
  },
};

/** 由三个"武器轴在手骨空间里的指向"构造本地四元数 */
function gripQuaternion(basis) {
  const x = new THREE.Vector3(...basis[0]).normalize();
  const y = new THREE.Vector3(...basis[1]).normalize();
  const z = new THREE.Vector3(...basis[2]).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

const WORLD_X = new THREE.Vector3(1, 0, 0);
const WORLD_Y = new THREE.Vector3(0, 1, 0);
const WORLD_Z = new THREE.Vector3(0, 0, 1);

function makePose() {
  const pose = {};
  for (const name of BONES) pose[name] = [0, 0, 0];
  return pose;
}

export class RunnerPlayer {
  constructor(gltf, clips = null, { groundY = 0 } = {}) {
    this.model = gltf.scene;
    // 该角色模型本身面朝 +Z，与游戏内的朝向约定一致
    this.model.rotation.y = 0;
    this.model.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });

    this.groundY = groundY;
    this.root = new THREE.Group();
    this.root.add(this.model);

    this.position = new THREE.Vector3(0, 0, 8.5);
    this.velocity = new THREE.Vector3();
    this.heading = Math.PI;
    this.radius = RADIUS;

    this.phase = 0;
    this.cadence = 0;
    this.move = 0;
    this.time = 0;
    this.bob = 0;
    this.turnRate = 0;
    this.lean = 0;

    this.bodyQ = new THREE.Quaternion();
    this.bodyInv = new THREE.Quaternion();
    this.mixer = null;
    this.actions = {};
    this.animW = 0;
    this.locomotion = null;
    this.clipIdle = null;
    this.clipWalk = null;
    this.clipRun = null;
    this.clipPistol = null;
    this.action = null;       // 正在/刚播完的一次性动作
    this.actionPlaying = false;
    this.actionW = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.onGround = true;
    this.crouchTarget = 0;
    this.crouchW = 0;
    this.crouchDrop = 0;
    this.weapons = null;
    this.weapon = null;
    this.weaponKind = null;
    this.clipMode = false;
    this.walkSpeed = WALK_SPEED;
    this.runSpeed = RUN_SPEED;
    this.clipDriven = false;
    this._gait = makePose();
    this._idle = makePose();
    this._posed = makePose();

    this.setupRig();
    // 骨骼名字不是这套 Humanoid 命名（pelvis/thigh_l…）时，说明角色自带动画，
    // 走「动画驱动」分支，程序化动作完全不参与。
    this.clipMode = !this.rig.pelvis;
    // 先把模型缩放到统一身高：动作里的根位移是模型本地单位，
    // 换算成世界米数要靠这个缩放，所以必须赶在 setupClips 前面
    this.fitModel(PLAYER_HEIGHT);
    if (clips && clips.length) this.setupClips(clips);
    this.armDown = this.clipMode ? ARM_DOWN : this.measureArmDown('l');
    this.armDownR = this.clipMode ? ARM_DOWN : this.measureArmDown('r');
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld(true);
  }

  setupRig() {
    this.rig = {};
    this.model.updateWorldMatrix(true, true);

    for (const name of BONES) {
      let bone = this.findBone(name, ...(BONE_ALIASES[name] || []));
      if (!bone) continue;
      const parent = bone.parent;
      const parentRest = new THREE.Quaternion();
      parent.getWorldQuaternion(parentRest);
      const parentRestInv = parentRest.clone().invert();
      this.rig[name] = {
        bone,
        parent,
        rest: bone.quaternion.clone(),
        restParentInv: parentRestInv.clone(),
        // 静止姿态下把身体轴映射进父级空间
        restAx: WORLD_X.clone().applyQuaternion(parentRestInv).normalize(),
        restAy: WORLD_Y.clone().applyQuaternion(parentRestInv).normalize(),
        restAz: WORLD_Z.clone().applyQuaternion(parentRestInv).normalize(),
        pw: new THREE.Quaternion(),
        delta: new THREE.Quaternion(),
        ax: new THREE.Vector3(),
        ay: new THREE.Vector3(),
        az: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        q2: new THREE.Quaternion(),
        target: new THREE.Quaternion(),
        prevQ: null,
      };
    }

    // 记录"手骨相对于身体"的绑定姿态朝向，装备武器时用它把身体坐标系的
    // 目标朝向换算成手骨的本地四元数
    this.handBindRel = null;
    const handBone = this.rig.hand_r?.bone || this.rig.hand_l?.bone;
    if (handBone) {
      const bodyQ = new THREE.Quaternion();
      this.root.getWorldQuaternion(bodyQ);
      const handQ = new THREE.Quaternion();
      handBone.getWorldQuaternion(handQ);
      this.handBindRel = bodyQ.invert().multiply(handQ).normalize();
    }
  }

  /**
   * 找骨骼：glTF 里 three 会把 "upper_arm.L" 里的点去掉变成 "upper_armL"，
   * 所以每个候选名都要同时试原始写法与 sanitize 之后的写法。
   */
  findBone(...names) {
    // Mixamo 的骨骼叫 mixamorig:Hips / mixamorig:Spine，不同导出器还会带
    // 空格、点号或前缀大小写差异，所以统一把名字压成「小写字母数字」再比。
    if (!this._boneMap) {
      this._boneMap = new Map();
      const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig/, '');
      this.model.traverse((object) => {
        if (!object.name) return;
        const key = normalize(object.name);
        if (!this._boneMap.has(key)) this._boneMap.set(key, object);
      });
    }
    for (const raw of names) {
      if (!raw) continue;
      const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig/, '');
      const hit = this._boneMap.get(key);
      if (hit) return hit;
    }
    return null;
  }

  /**
   * 量一下静止姿势里手臂与"竖直向下"的夹角：
   * T-pose 需要转 ~80°，A-pose 只要几度，这样同一套程序化动作就能适配两种模型。
   */
  measureArmDown(side = 'l') {
    const up = this.rig[`upperarm_${side}`];
    const hand = this.rig[`hand_${side}`];
    if (!up || !hand) return ARM_DOWN;
    this.model.updateWorldMatrix(true, true);
    this.root.getWorldQuaternion(this.bodyQ);
    this.bodyInv.copy(this.bodyQ).invert();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    up.bone.getWorldPosition(a);
    hand.bone.getWorldPosition(b);
    const dir = b.sub(a).applyQuaternion(this.bodyInv).normalize();
    const horizontal = Math.hypot(dir.x, dir.z);
    const angle = Math.atan2(horizontal, -dir.y);
    return clamp(angle - 0.1, 0, 1.5);
  }

  /**
   * 骨骼动画图层。
   * 服装包本身不含动画，但 Universal Animation Library 的片段可以 1:1 套到这套
   * Humanoid 骨骼上（骨骼命名完全一致）。把片段丢进 assets/character/clips.json，
   * 走动时会自动接管腿脚，站立时再交回程序化动作。
   */
  setupClips(clips) {
    this.mixer = new THREE.AnimationMixer(this.model);
    const built = [];
    for (const c of clips) {
      if (c instanceof THREE.AnimationClip || Array.isArray(c.tracks)) {
        built.push(c);
        continue;
      }
      // clips.json 形式（外部动画库 / 重定向转出来的）
      const tracks = [];
      for (const [bone, flat] of Object.entries(c.tracks)) {
        const arr = new Float32Array(flat.length);
        arr.set(flat);
        tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, c.times, arr));
      }
      for (const [bone, flat] of Object.entries(c.translation || {})) {
        const arr = new Float32Array(flat.length);
        arr.set(flat);
        tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, c.times, arr));
      }
      const clip = new THREE.AnimationClip(c.name, c.duration, tracks);
      clip.userData = { naturalSpeed: c.naturalSpeed };
      built.push(clip);
    }

    for (const clip of built) {
      const action = this.mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(0);
      this.actions[clip.name] = action;
    }

    const pick = (re) => BUILT_ORDER(built, re);
    const findAction = (re) => {
      const clip = pick(re);
      return clip ? this.actions[clip.name] : null;
    };

    this.mixer.addEventListener('finished', (e) => {
      if (this.action && e.action === this.action) this.actionPlaying = false;
    });

    // 持枪时要做分层：腿保留原生走跑，上半身换成持枪动作。
    // 这里把原生片段里"下半身轨道"单独抽出来做一份，避免两段动画抢同一根骨头。
    this.legActions = {};
    const LEG_BONE = /^(Hips|UpperLeg|LowerLeg|Foot|PT)/;
    const makeLegs = (action) => {
      if (!action) return null;
      const clip = action.getClip();
      const tracks = clip.tracks.filter((t) => LEG_BONE.test(t.name.split('.')[0]));
      if (!tracks.length) return null;
      const legs = new THREE.AnimationClip(`${clip.name}__legs`, clip.duration, tracks);
      const legsAction = this.mixer.clipAction(legs);
      legsAction.play();
      legsAction.setEffectiveWeight(0);
      return legsAction;
    };

    this.clipIdle = findAction(/^idle|idle_neutral|stand|breathe/i);
    this.clipWalk = findAction(/walk/i);
    this.clipRun = findAction(/^run$|^run[_ ]?fwd|jog|sprint/i) || this.clipWalk;
    // 持枪上半身（Pistol Run.fbx 重定向，只保留手臂/躯干轨道）
    this.clipPistol = findAction(/pistol/i);
    if (this.clipPistol) {
      // 原生持枪跑是整段的，这里只留上半身轨道，腿交回原生走跑
      const base = this.clipPistol.getClip();
      const UPPER_ONLY = /(Spine|Neck|Head|Shoulder|Arm|Hand)/;
      const tracks = base.tracks.filter((tr) => UPPER_ONLY.test(tr.name.split('.')[0]));
      if (tracks.length) {
        this.clipPistol.stop();
        const upper = new THREE.AnimationClip('PistolUpper', base.duration, tracks);
        upper.userData = base.userData;
        const act = this.mixer.clipAction(upper);
        act.play();
        act.setEffectiveWeight(0);
        this.actions.PistolUpper = act;
        this.clipPistol = act;
      }
    }

    this.legActions.walk = makeLegs(this.clipWalk);
    this.legActions.run = this.clipRun === this.clipWalk ? this.legActions.walk : makeLegs(this.clipRun);
    if (this.clipIdle) this.clipIdle.setEffectiveWeight(1);
    if (this.clipWalk) this.clipWalk.setEffectiveWeight(0);
    if (this.clipRun && this.clipRun !== this.clipWalk) this.clipRun.setEffectiveWeight(0);

    // 有走路片段就以动画为准；位移速度按片段的自然步速推算，脚才不会打滑
    this.clipDriven = !!(this.clipIdle || this.clipWalk);
    const walkClip = built.find((c) => /walk/i.test(c.name));
    const runClip = built.find((c) => /^run|jog|sprint/i.test(c.name));

    // 动作的自然地面速度 = 被抹平的根位移 × 模型缩放 ÷ 片段时长
    const naturalOf = (clip, fallback) => {
      if (!clip) return fallback;
      const drift = clip.userData?.rootDrift ?? 0;
      const scaled = (drift * (this.model.scale.x || 1)) / (clip.duration || 1);
      return scaled > 0.4 ? scaled : (clip.userData?.naturalSpeed || fallback);
    };
    this.naturalWalk = naturalOf(walkClip, 1.55);
    this.naturalRun = naturalOf(runClip, 3.7);
    this.walkSpeed = clamp(this.naturalWalk * WALK_PACE, 1.2, 3.2);
    this.runSpeed = clamp(this.naturalRun * RUN_PACE, this.walkSpeed * 1.7, 8);
  }

  /**
   * 在"当前动画姿势"之上再叠一个身体轴旋转，用于蹲下这类没有对应片段的姿态。
   * 和 rotateBone 的区别：那个是从静止姿势重算，这个是乘到动画结果上。
   */
  overlayBone(name, x = 0, y = 0, z = 0) {
    const e = this.rig[name];
    if (!e) return;

    // 有些片段没给某根骨骼打关键帧（导出时被优化掉了），混合器就不会写它，
    // 叠加旋转会一帧帧累加。这里检测"这一帧混合器有没有动它"，没动就恢复静止值。
    if (!e.prevQ) e.prevQ = new THREE.Quaternion().copy(e.bone.quaternion);
    // prevQ 存的是"上一帧结束时（含叠加）"的值，所以这一帧如果没变，说明混合器没写它
    if (e.bone.quaternion.equals(e.prevQ)) e.bone.quaternion.copy(e.rest);

    e.parent.getWorldQuaternion(e.pw);
    e.delta.copy(e.pw).premultiply(this.bodyInv).premultiply(e.restParentInv).invert();
    e.ax.copy(e.restAx).applyQuaternion(e.delta);
    e.ay.copy(e.restAy).applyQuaternion(e.delta);
    e.az.copy(e.restAz).applyQuaternion(e.delta);

    e.q.setFromAxisAngle(e.az, z);
    if (x !== 0) {
      e.q2.setFromAxisAngle(e.ax, x);
      e.q.premultiply(e.q2);
    }
    if (y !== 0) {
      e.q2.setFromAxisAngle(e.ay, y);
      e.q.premultiply(e.q2);
    }
    e.bone.quaternion.premultiply(e.q);
    e.prevQ.copy(e.bone.quaternion);
  }

  /** 蹲下：没有蹲姿片段，用腿/胯/脊柱的叠加姿态模拟 */
  setCrouch(on) {
    this.crouchTarget = on ? 1 : 0;
  }

  applyCrouch(dt) {
    this.crouchW = damp(this.crouchW, this.crouchTarget, 11, dt);
    const c = this.crouchW;
    if (c < 0.004) {
      this.crouchDrop = 0;
      return;
    }
    // 深蹲的关节分配：大腿接近水平、小腿竖直、脚掌回正贴地。
    // 之前小腿给到 1.45 会把膝盖掰到身后，脚就朝后翻过去了。
    this.overlayBone('thigh_l', -1.25 * c);
    this.overlayBone('thigh_r', -1.25 * c);
    this.overlayBone('calf_l', 0.9 * c);
    this.overlayBone('calf_r', 0.9 * c);
    this.overlayBone('foot_l', 0.35 * c);
    this.overlayBone('foot_r', 0.35 * c);
    this.overlayBone('pelvis', 0.16 * c);
    this.overlayBone('spine_01', 0.2 * c);
    this.overlayBone('spine_02', 0.12 * c);
    this.overlayBone('neck_01', -0.22 * c);
    this.crouchDrop = -0.32 * c;
  }

  /**
   * 掌心在"手骨本地坐标"里的位置。
   * 手骨原点在手腕，本地 +Y 指向手指；握把要落在指根稍前一点（拳心），
   * 不能直接用手骨原点，否则武器会浮在手腕外面。
   */
  palmLocal(out = new THREE.Vector3()) {
    const hand = this.rig.hand_r?.bone || this.rig.hand_l?.bone;
    if (!hand) return out.set(0, 0.05, 0);
    this.model.updateMatrixWorld(true);
    const wrist = new THREE.Vector3();
    hand.getWorldPosition(wrist);
    const base = new THREE.Vector3();
    const finger = this.findBone('Index1.R', 'Middle1.R', 'Index1.L', 'Middle1.L',
      'RightHandIndex1', 'RightHandMiddle1', 'LeftHandIndex1', 'LeftHandMiddle1');
    if (finger) {
      finger.getWorldPosition(base);
      wrist.lerp(base, 1.45);   // 从手腕往指根再走 45%，落在拳心
    }
    return hand.worldToLocal(wrist);
  }

  /**
   * 装备武器：把模型挂到右手骨上。武器的尺寸在模型本地空间，
   * 所以要按模型缩放反向补偿一次。
   */
  equip(kind) {
    if (!this.weapons) return false;
    if (this.weapon) {
      this.weapon.parent?.remove(this.weapon);
      this.weapon = null;
    }
    this.weaponKind = null;
    if (!kind) {
      this.syncIdleClip();
      return true;
    }
    const src = this.weapons[kind];
    if (!src) return false;

    const hand = this.rig.hand_r?.bone || this.rig.hand_l?.bone;
    if (!hand) return false;

    const mesh = src.clone(true);
    // 武器要按"手骨的世界缩放"反向补偿：Mixamo 的骨架根节点带 0.01 缩放，
    // 只按 model.scale 补偿会让枪变成 1cm 大小。
    this.model.updateMatrixWorld(true);
    const handScale = new THREE.Vector3();
    hand.getWorldScale(handScale);
    const s = handScale.x ? 1 / handScale.x : 1;
    mesh.scale.setScalar(s);
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });

    const grip = WEAPON_GRIP[kind] || {};
    const g = grip.grip || [0, 0, 0];
    // 让武器本地的 grip 点正好落在 holder 原点（= 掌心）
    mesh.position.set(-g[0] * s, -g[1] * s, -g[2] * s);

    const holder = new THREE.Group();
    holder.position.copy(this.palmLocal());
    holder.add(mesh);
    this.gripMoveQ = gripQuaternion(grip.basis || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    this.gripIdleQ = gripQuaternion(grip.basisIdle || grip.basis || [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    holder.quaternion.copy(this.gripIdleQ);
    hand.add(holder);

    this.weapon = holder;
    this.weaponKind = kind;
    this.syncIdleClip();
    return true;
  }

  /** 站立与移动时手腕滚转不同，握持轴跟着混合，枪才不会一直歪着 */
  updateWeaponGrip() {
    if (!this.weapon || !this.gripMoveQ) return;
    this.weapon.quaternion.copy(this.gripIdleQ).slerp(this.gripMoveQ, clamp(this.move, 0, 1));
  }

  /** 持械时用对应的待机姿势（剑/枪） */
  syncIdleClip() {
    const map = { sword: 'Idle_Sword', gun: 'Idle_Gun' };
    const want = this.weaponKind ? map[this.weaponKind] : null;
    const next = (want && this.actions[want]) || this.actions.Idle || this.clipIdle;
    if (next === this.clipIdle) return;
    if (this.clipIdle) this.clipIdle.setEffectiveWeight(0);
    this.clipIdle = next;
    this.clipIdle.setEffectiveWeight(1);
  }

  /** 播放一次性动作（出拳/挥剑/翻滚/挥手…），结束后自动回到走跑 */
  playAction(name) {
    const action = this.actions[name];
    if (!action || !this.mixer) return false;
    if (this.action && this.action !== action) {
      this.action.stop();
      this.action.setEffectiveWeight(0);
    }
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(0);
    action.play();
    this.action = action;
    this.actionPlaying = true;
    this.actionW = Math.max(this.actionW, 0.001);
    return true;
  }

  /** 主动中断当前动作（例如开始走路时） */
  stopAction() {
    if (!this.action) return;
    this.actionPlaying = false;
  }

  /** 跳跃：动画库里没有跳跃片段，这里用位移 + 重力实现 */
  jump(power = 5.2) {
    if (!this.onGround) return false;
    this.vy = power;
    this.onGround = false;
    return true;
  }

  /** 把模型缩放到统一身高、脚底贴地（不同来源的模型单位差别很大） */
  fitModel(targetHeight) {
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = targetHeight / Math.max(size.y, 0.001);
    this.model.scale.setScalar(scale);
    this.model.position.y -= box.min.y * scale;
    this.modelHeight = targetHeight;
  }

  /**
   * 绕"身体轴"旋转骨骼：x 前后摆、y 扭身、z 张开/收拢。
   *
   * 关键点：轴不能只在初始化时算一次。肩部把手臂放下(绕 Z 大角度旋转)之后，
   * 若手肘仍按初始轴弯曲，弯曲方向会跟着歪成"翅膀"；同理父级任意摆动都会让
   * 子关节的轴向漂移。这里每帧用父级当前朝向相对静止姿态的增量(delta)把轴
   * 修正回去，等价于"始终绕身体坐标系里的 X/Y/Z 转"。
   */
  rotateBone(name, x = 0, y = 0, z = 0) {
    const e = this.rig[name];
    if (!e) return;

    e.parent.getWorldQuaternion(e.pw);
    // delta = P0⁻¹ · B⁻¹ · P_now  (B = 角色朝向，P0 = 父级静止世界朝向)
    e.delta.copy(e.pw).premultiply(this.bodyInv).premultiply(e.restParentInv).invert();

    e.ax.copy(e.restAx).applyQuaternion(e.delta);
    e.ay.copy(e.restAy).applyQuaternion(e.delta);
    e.az.copy(e.restAz).applyQuaternion(e.delta);

    e.q.setFromAxisAngle(e.az, z);
    if (x !== 0) {
      e.q2.setFromAxisAngle(e.ax, x);
      e.q.premultiply(e.q2);
    }
    if (y !== 0) {
      e.q2.setFromAxisAngle(e.ay, y);
      e.q.premultiply(e.q2);
    }
    e.target.copy(e.rest).premultiply(e.q);
  }

  /* ---------------- 每帧更新 ---------------- */

  update(dt, input, cameraYaw, walkable = () => true) {
    this.time += dt;

    const wish = new THREE.Vector3();
    if (input.dirX !== undefined) {
      wish.set(input.dirX, 0, input.dirZ);
    } else {
      const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
      wish.addScaledVector(forward, input.forward).addScaledVector(right, input.strafe);
    }
    const hasInput = wish.lengthSq() > 0.0001;
    if (hasInput) wish.normalize();

    const maxSpeed = (input.run ? this.runSpeed : this.walkSpeed) *
      (input.speedScale ?? 1) * (1 - this.crouchW * 0.55);
    const target = wish.multiplyScalar(hasInput ? maxSpeed : 0);
    const lambda = hasInput ? 9 : 11;
    this.velocity.x = damp(this.velocity.x, target.x, lambda, dt);
    this.velocity.z = damp(this.velocity.z, target.z, lambda, dt);

    if (this.velocity.lengthSq() < 0.0004) this.velocity.set(0, 0, 0);

    // 位移与碰撞
    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;
    // 碰撞交给岛屿的 walkable（岸线 + 建筑足迹），分成两轴求解，撞墙时能贴着滑
    if (stepX !== 0 && walkable(this.position.x + stepX, this.position.z)) {
      this.position.x += stepX;
    } else {
      this.velocity.x *= 0.2;
    }
    if (stepZ !== 0 && walkable(this.position.x, this.position.z + stepZ)) {
      this.position.z += stepZ;
    } else {
      this.velocity.z *= 0.2;
    }

    // 跳跃积分
    if (!this.onGround) {
      this.vy -= 15.5 * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.25) {
      const want = Math.atan2(this.velocity.x, this.velocity.z);
      const before = this.heading;
      this.heading = dampAngle(this.heading, want, 11, dt);
      let delta = this.heading - before;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      this.turnRate = damp(this.turnRate, delta / Math.max(dt, 0.001), 8, dt);
    } else {
      this.turnRate = damp(this.turnRate, 0, 8, dt);
    }

    this.animate(dt, speed);

    this.root.position.set(this.position.x, this.groundY + this.bob + this.jumpY + this.crouchDrop, this.position.z);
    this.root.rotation.y = this.heading;
  }

  hits(x, z, town) {
    const r = this.radius;
    for (const c of town.colliders) {
      if (c.height != null && c.height < 0.4) continue;
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  /* ---------------- 关节驱动的行走/奔跑 ---------------- */

  /**
   * 步频由实际速度推导，脚才不会打滑；
   * 走/跑之间用速度比例连续过渡，而不是两个独立动作硬切。
   */
  animate(dt, speed) {
    const t = this.time;

    if (this.clipMode || this.clipDriven) {
      this.animateWithClips(dt, speed);
      return;
    }

    const run = clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
    const moving = speed > 0.12;
    this.move = damp(this.move, moving ? 1 : 0, 7.5, dt);

    // 一个步幅 ≈ 步长 = 0.55 + 0.19 * 速度；一个完整周期 = 两步
    const stepLength = 0.55 + 0.19 * speed;
    const targetCadence = speed > 0.12 ? speed / (2 * stepLength) : 0;
    this.cadence = damp(this.cadence, targetCadence, 6, dt);
    this.phase += dt * Math.PI * 2 * this.cadence;
    if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;

    const p = this.phase;
    const c = Math.cos(p);
    const s = Math.sin(p);
    const phase = this._gait;
    const idle = this._idle;

    /* ---- 行走/奔跑姿态 ---- */
    const swing = 0.42 + 0.32 * run;        // 髋关节前后摆幅
    const flex = 0.9 + 0.55 * run;          // 膝关节屈曲幅度
    const lean = 0.05 + 0.26 * run;         // 躯干前倾

    const thighL = -swing * c;
    const thighR = swing * c;
    const kneeL = flex * (Math.pow(Math.max(0, Math.sin(p - Math.PI)), 1.25) +
      0.2 * Math.pow(Math.max(0, Math.sin(2 * p)), 3));
    const kneeR = flex * (Math.pow(Math.max(0, Math.sin(p)), 1.25) +
      0.2 * Math.pow(Math.max(0, Math.sin(2 * p + Math.PI)), 3));
    const footL = -(thighL * 0.55 + kneeL * 0.45) + 0.1 * Math.sin(2 * p);
    const footR = -(thighR * 0.55 + kneeR * 0.45) - 0.1 * Math.sin(2 * p);
    const ballL = 0.5 * Math.max(0, Math.sin(p - 0.55 * Math.PI));
    const ballR = 0.5 * Math.max(0, -Math.sin(p - 0.55 * Math.PI));

    phase.thigh_l[0] = thighL;
    phase.thigh_r[0] = thighR;
    phase.calf_l[0] = kneeL;
    phase.calf_r[0] = kneeR;
    phase.foot_l[0] = footL;
    phase.foot_r[0] = footR;
    phase.ball_l[0] = ballL;
    phase.ball_r[0] = ballR;
    // 双腿轻微内收，避免走成直线外八
    phase.thigh_l[2] = -0.03;
    phase.thigh_r[2] = 0.03;

    // 骨盆：左右扭髋 + 摆动腿一侧下沉 + 微前倾
    const pelvisYaw = 0.13 * c;
    const pelvisRoll = -0.07 * s;
    phase.pelvis[0] = 0.02 + 0.03 * run;
    phase.pelvis[1] = pelvisYaw;
    phase.pelvis[2] = pelvisRoll;

    // 脊柱反向扭转，并随转向倾斜
    const turn = clamp(this.turnRate * 0.09, -0.22, 0.22);
    phase.spine_01[0] = lean * 0.45;
    phase.spine_01[1] = -0.35 * pelvisYaw;
    phase.spine_01[2] = -0.4 * pelvisRoll - turn;
    phase.spine_02[0] = lean * 0.35;
    phase.spine_02[1] = -0.35 * pelvisYaw;
    phase.spine_02[2] = -0.3 * pelvisRoll - turn * 0.6;
    phase.spine_03[0] = lean * 0.2;
    phase.spine_03[1] = -0.15 * pelvisYaw;
    phase.spine_03[2] = -0.15 * pelvisRoll;
    phase.neck_01[0] = -lean * 0.55;
    phase.neck_01[1] = -0.3 * pelvisYaw;
    phase.Head[0] = -lean * 0.4;
    phase.Head[1] = -0.25 * pelvisYaw;
    phase.Head[2] = 0.12 * pelvisRoll;

    // 手臂与腿反相；跑起来肘部收紧、摆手加大
    const armAmp = 0.3 + 0.42 * run;
    const armLag = Math.cos(p - 0.35);
    const elbowBase = 0.34 + 0.62 * run;
    phase.clavicle_l[0] = -0.05 * c;
    phase.clavicle_r[0] = 0.05 * c;
    phase.upperarm_l[0] = armAmp * c;
    phase.upperarm_r[0] = -armAmp * c;
    phase.upperarm_l[2] = -(this.armDown - 0.14 * run);
    phase.upperarm_r[2] = this.armDownR - 0.14 * run;
    phase.lowerarm_l[0] = -(elbowBase + 0.34 * Math.max(0, -armLag));
    phase.lowerarm_r[0] = -(elbowBase + 0.34 * Math.max(0, armLag));
    phase.lowerarm_l[2] = -0.08;
    phase.lowerarm_r[2] = 0.08;
    phase.hand_l[0] = -0.12 - 0.1 * run;
    phase.hand_r[0] = -0.12 - 0.1 * run;

    /* ---- 站立姿态：呼吸 + 重心微移 ---- */
    const breathe = Math.sin(t * 1.5) * 0.022;
    const shift = Math.sin(t * 0.52) * 0.032;
    const glance = Math.sin(t * 0.31) * 0.1;

    idle.pelvis[0] = 0.015;
    idle.pelvis[1] = 0;
    idle.pelvis[2] = shift * 0.7;
    idle.spine_01[0] = 0.02;
    idle.spine_01[1] = 0;
    idle.spine_01[2] = -shift * 0.45;
    idle.spine_02[0] = breathe;
    idle.spine_02[2] = -shift * 0.3;
    idle.spine_03[0] = breathe * 0.65;
    idle.neck_01[0] = -breathe * 0.8;
    idle.neck_01[1] = glance * 0.35;
    idle.Head[0] = -0.02 + Math.sin(t * 0.9) * 0.012;
    idle.Head[1] = glance * 0.75;
    idle.clavicle_l[0] = 0;
    idle.clavicle_r[0] = 0;
    idle.upperarm_l[0] = 0.04 + breathe * 0.6;
    idle.upperarm_r[0] = 0.04 + breathe * 0.6;
    idle.upperarm_l[2] = -this.armDown;
    idle.upperarm_r[2] = this.armDownR;
    idle.lowerarm_l[0] = -0.30 - Math.abs(breathe) * 0.6;
    idle.lowerarm_r[0] = -0.30 - Math.abs(breathe) * 0.6;
    idle.lowerarm_l[2] = -0.08;
    idle.lowerarm_r[2] = 0.08;
    idle.hand_l[0] = -0.1;
    idle.hand_r[0] = -0.1;
    idle.thigh_l[0] = 0.02;
    idle.thigh_r[0] = 0.02;
    idle.calf_l[0] = 0.06;
    idle.calf_r[0] = 0.06;
    idle.foot_l[0] = -0.04;
    idle.foot_r[0] = -0.04;
    idle.ball_l[0] = 0;
    idle.ball_r[0] = 0;

    // 骨骼动画图层：动起来时交给真实片段，停下再交回程序化动作
    const wantAnim = this.locomotion && speed > 0.35 ? 1 : 0;
    this.animW = damp(this.animW, wantAnim, 6, dt);
    if (this.locomotion && this.animW > 0.004) {
      const action = this.locomotion.action;
      action.setEffectiveWeight(this.animW);
      action.timeScale = clamp(speed / this.locomotion.naturalSpeed, 0.55, 1.7);
      this.mixer.update(dt);
    }

    // 混合并写入骨骼
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldQuaternion(this.bodyQ);
    this.bodyInv.copy(this.bodyQ).invert();
    const w = this.move;
    const animW = this.animW;
    for (const name of BONES) {
      const e = this.rig[name];
      if (!e) continue;
      const g = phase[name];
      const i = idle[name];
      this.rotateBone(
        name,
        lerp(i[0], g[0], w),
        lerp(i[1], g[1], w),
        lerp(i[2], g[2], w)
      );
      if (animW > 0.004) e.bone.quaternion.slerp(e.target, 1 - animW);
      else e.bone.quaternion.copy(e.target);
    }

    // 身体起伏：支撑腿垂直时最高，一个周期两次
    const bobAmp = 0.026 + 0.062 * run;
    const bobPhase = 2 * p + run * Math.PI;
    const targetBob = w * (1 - Math.cos(bobPhase)) * 0.5 * bobAmp +
      (1 - w) * Math.sin(t * 1.5) * 0.006;
    this.bob = damp(this.bob, targetBob, 18, dt);
  }

  /** 用角色自带的骨骼动画驱动（idle ⇄ walk 交叉淡入） */
  animateWithClips(dt, speed) {
    const moving = clamp(speed / (this.walkSpeed * 0.55), 0, 1);
    this.move = damp(this.move, moving, 8, dt);

    // 一边播放动作一边跑起来时提前收招，操作才跟手
    if (this.actionPlaying && speed > this.walkSpeed * 0.9) this.actionPlaying = false;

    // 一次性动作压过走跑；播完后把它的权重降到 0 再 stop，
    // 否则 clampWhenFinished 会让它一直以权重 1 定在最后一帧，和走跑各占一半。
    this.actionW = damp(this.actionW, this.actionPlaying ? 1 : 0, 13, dt);
    if (this.action) {
      if (!this.actionPlaying && this.actionW < 0.012) {
        this.action.setEffectiveWeight(0);
        this.action.stop();
        this.action = null;
        this.actionW = 0;
      } else {
        this.action.setEffectiveWeight(this.actionW);
      }
    } else {
      this.actionW = 0;
    }
    const loco = 1 - this.actionW;

    // 走 → 跑之间按速度连续过渡
    const runRatio = clamp((speed - this.walkSpeed * 1.05) /
      Math.max(0.001, this.runSpeed - this.walkSpeed * 1.05), 0, 1);

    // 持枪时：腿用原生走跑的"下半身"副本，上半身用持枪动作叠上去
    const gunMode = this.weaponKind === 'gun' && this.clipPistol;
    const walkA = (gunMode && this.legActions.walk) || this.clipWalk;
    const runA = (gunMode && this.legActions.run) || this.clipRun;

    // 持枪时整段原生走跑要让位，否则会和分层副本各占一半
    if (gunMode) {
      if (this.clipWalk) this.clipWalk.setEffectiveWeight(0);
      if (this.clipRun && this.clipRun !== this.clipWalk) this.clipRun.setEffectiveWeight(0);
    }

    if (this.clipPistol) {
      this.clipPistol.setEffectiveWeight(gunMode ? this.move * loco : 0);
      const natural = this.clipPistol.getClip().userData?.naturalSpeed || 3.6;
      this.clipPistol.timeScale = clamp(speed / natural, 0.45, 1.7);
    }

    if (this.clipIdle) this.clipIdle.setEffectiveWeight((1 - this.move) * loco);
    if (walkA) {
      walkA.setEffectiveWeight(this.move * (1 - runRatio) * loco);
      // 按动作自己的自然步速调速，而不是按角色的最高速度，
      // 否则人走得比动作快，脚就会在地上滑
      walkA.timeScale = clamp(speed / (this.naturalWalk || this.walkSpeed), 0.55, 1.35);
    }
    if (runA && runA !== walkA) {
      runA.setEffectiveWeight(this.move * runRatio * loco);
      runA.timeScale = clamp(speed / (this.naturalRun || this.runSpeed), 0.55, 1.35);
      // 走跑交替时把相位对齐，否则两段动作各走各的，接缝处腿会抽一下
      if (walkA.getEffectiveWeight() > 0.01) {
        const walkDuration = walkA.getClip().duration || 1;
        const runDuration = runA.getClip().duration || 1;
        const phase = (((walkA.time % walkDuration) + walkDuration) % walkDuration) / walkDuration;
        runA.time = phase * runDuration;
      }
    }
    if (this.mixer) this.mixer.update(dt);
    this.applyCrouch(dt);
    this.updateWeaponGrip();
    this.bob = 0;
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  /* ---------------- 给「知屿」World 用的适配层 ---------------- */

  get facing() {
    return this.heading;
  }

  setPosition(x, z, rotation = this.heading) {
    this.teleport(x, z, rotation);
  }

  teleport(x, z, rotation = this.heading) {
    this.position.x = x;
    this.position.z = z;
    this.heading = rotation;
    this.velocity.set(0, 0, 0);
    this.root.position.set(x, this.groundY, z);
    this.root.rotation.y = rotation;
    if (this.mixer) this.mixer.update(0.001);
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  getCameraTarget(out = new THREE.Vector3()) {
    out.copy(this.root.position);
    out.y += 1.45;
    out.x -= Math.sin(this.heading) * 0.25;
    out.z -= Math.cos(this.heading) * 0.25;
    return out;
  }
}
