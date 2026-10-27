import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * 主角：Erika Archer（Quaternius「Ultimate Fantasy RTS」里的弓箭手）。
 *
 * 模型来自 mox/Erika Archer.fbx，动作来自 mox/ren 的五个 FBX：
 *   Standing Idle     → Idle
 *   Standard Walk     → Walk
 *   Running           → Run
 *   Jumping           → Jump
 *   Gathering Objects → Gather
 *
 * 两边的骨骼都是 Mixamo 命名（mixamorig:Hips…），动作可以直接套在主角上，
 * 不需要重定向。FBX 里那 19MB 的模型与贴图在转换时已经剥掉，
 * 每个动作文件只剩几十 KB。
 */
const BASE = '/models/character';
const ANIM_BASE = '/models/anims';

const ANIM_FILES = [
  { file: 'idle.glb', name: 'Idle' },
  { file: 'walk.glb', name: 'Walk' },
  { file: 'run.glb', name: 'Run' },
  { file: 'jump.glb', name: 'Jump' },
  { file: 'gather.glb', name: 'Gather' },
];

/**
 * 这套动作是「带位移」的：一段走路里 Hips 会自己往前挪 1.8 米。
 * 而角色的位置由代码驱动，两股前进叠在一起，人就会一段一段地窜出去再弹回来，
 * 看着就像帧被按了快进。所以在载入时把 Hips 的水平位移按平，只留上下起伏，
 * 同时把被抹掉的那段距离反过来算成这段动作的「自然地面速度」——
 * 身体走了多远 ÷ 片段时长，就是这段动作本该配的移动速度。
 */
function flattenRootMotion(clip) {
  let drift = 0;
  const duration = clip.duration || 1;
  const stride = 3;

  clip.tracks.forEach((track) => {
    if (!/\.position$/.test(track.name)) return;
    if (!/Hips|Root/i.test(track.name.split('.')[0])) return;
    const values = track.values;
    if (values.length < stride * 2) return;
    const size = track.getValueSize?.() ?? stride;
    const baseX = values[0];
    const baseZ = values[2];
    let farZ = baseZ;
    for (let i = 0; i < values.length; i += size) {
      if (Math.abs(values[i + 2] - baseZ) > Math.abs(farZ - baseZ)) farZ = values[i + 2];
    }
    drift = Math.max(drift, Math.abs(farZ - baseZ));
    for (let i = 0; i < values.length; i += size) {
      values[i] = baseX;
      values[i + 2] = baseZ;
    }
  });

  clip.userData = { ...clip.userData, rootDrift: drift, duration };
  return clip;
}

class CharacterLibrary {
  constructor() {
    this.loader = null;
    this.gltf = null;
    this.clips = [];
    this.ready = false;
    this.promise = null;
    this.failed = false;
  }

  async preload(onProgress) {
    if (this.promise) return this.promise;
    this.promise = (async () => {
      try {
        if (!this.loader) this.loader = new GLTFLoader();
        const gltf = await this.loader.loadAsync(`${BASE}/erika.glb`);
        const root = gltf.scene;
        root.traverse((object) => {
          if (!object.isMesh && !object.isSkinnedMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((mat) => {
            if (!mat) return;
            mat.envMapIntensity = 0.6;
            mat.roughness = Math.min(1, (mat.roughness ?? 0.8) + 0.05);
            mat.metalness = 0;
            if (mat.map) {
              mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.map.anisotropy = 4;
            }
            if (mat.transparent && (mat.opacity ?? 1) < 0.6) mat.alphaTest = 0.3;
          });
        });

        // 主角自带的 take 是空片段，动作全部来自 mox/ren
        const clips = [];
        await Promise.all(ANIM_FILES.map(async (entry) => {
          try {
            const animGltf = await this.loader.loadAsync(`${ANIM_BASE}/${entry.file}`);
            const clip = animGltf.animations?.[0];
            if (!clip || clip.duration < 0.1) return;
            clip.name = entry.name;
            flattenRootMotion(clip);
            clips.push(clip);
          } catch (error) {
            console.warn(`[知屿] 动作 ${entry.name} 未能载入。`, error);
          }
        }));

        // 自然步速（模型本地单位），换算成世界单位要乘上模型缩放，由角色侧再算
        clips.forEach((clip) => {
          const speed = clip.userData.rootDrift / (clip.duration || 1);
          console.info(
            `[知屿] 动作 ${clip.name}: ${clip.duration.toFixed(2)}s，`
            + `根位移 ${clip.userData.rootDrift.toFixed(2)}，自然速度 ${speed.toFixed(2)} m/s`,
          );
        });

        this.clips = clips;
        this.gltf = gltf;
        this.ready = true;
        onProgress?.(1, 1, 'erika');
      } catch (error) {
        this.failed = true;
        console.warn('[知屿] 主角模型未能载入，将回退到程序化角色。', error);
      }
      return this;
    })();
    return this.promise;
  }
}

export const character = new CharacterLibrary();

export async function preloadCharacterAssets(onProgress) {
  return character.preload(onProgress);
}
