/**
 * 复制带蒙皮的模型（three 的 SkeletonUtils.clone 精简版）。
 * 直接 clone() 会让副本共用原骨骼，导致所有实例动作一致，
 * 这里把骨骼与 skeleton 一起重建，让每只动物各有独立的 AnimationMixer。
 */

function parallelTraverse(a, b, callback) {
  callback(a, b);
  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}

export function cloneSkinned(source) {
  const clone = source.clone(true);
  const sourceLookup = new Map();
  const cloneLookup = new Map();

  parallelTraverse(source, clone, (srcNode, clonedNode) => {
    sourceLookup.set(clonedNode, srcNode);
    cloneLookup.set(srcNode, clonedNode);
  });

  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const srcMesh = sourceLookup.get(node);
    if (!srcMesh || !srcMesh.skeleton) return;
    node.bindMatrix.copy(srcMesh.bindMatrix);
    node.bindMode = srcMesh.bindMode;
    node.skeleton = srcMesh.skeleton.clone();
    node.skeleton.bones = srcMesh.skeleton.bones.map((bone) => cloneLookup.get(bone) || bone);
    node.bind(node.skeleton, node.bindMatrix);
    node.frustumCulled = false;
  });

  return clone;
}
