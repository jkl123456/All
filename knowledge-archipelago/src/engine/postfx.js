import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * 轻量后期：一点点泛光就够了。
 *
 * 灯笼、晶体、火堆的高光会溢出到空气里，画面立刻有「游戏感」，
 * 但强度必须克制，否则会变成廉价的霓虹滤镜。
 */
export function createPostFX(renderer, scene, camera, { strength = 0.28 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, size.x), Math.max(1, size.y)),
    strength,
    0.55,
    1.08,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const enabled = { value: true };

  return {
    composer,
    bloom,
    setSize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(width, height);
    },
    setEnabled(value) {
      enabled.value = Boolean(value);
    },
    setStrength(value) {
      bloom.strength = value;
    },
    get enabled() {
      return enabled.value;
    },
    render(delta) {
      if (!enabled.value) {
        renderer.render(scene, camera);
        return;
      }
      composer.render(delta);
    },
    dispose() {
      composer.dispose?.();
      target.dispose();
    },
  };
}
