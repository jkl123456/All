import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSpeed: { value: 0 },
    uBoost: { value: 0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uBoost;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      float aberration = (0.00055 + uSpeed * 0.0013 + uBoost * 0.0016);
      vec2 dir = centered * aberration;
      vec4 base = texture2D(tDiffuse, vUv);
      float r = texture2D(tDiffuse, vUv + dir).r;
      float b = texture2D(tDiffuse, vUv - dir).b;
      vec3 color = vec3(r, base.g, b);

      // Subtle golden/teal grade to unify sky and shaded city streets.
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color += vec3(0.010, 0.004, -0.007) * (1.0 - lum);
      color = mix(vec3(lum), color, 1.08);
      color = mix(color, color * vec3(1.03, 1.015, 0.97), 0.55);

      // Lens vignette.
      float vignette = smoothstep(0.92, 0.28, dist + uSpeed * 0.02);
      color *= mix(0.82, 1.0, vignette);

      // Fine sensor grain, stronger in the shadows.
      float grain = hash(vUv * uResolution + fract(uTime) * 91.7) - 0.5;
      color += grain * (0.016 + 0.012 * (1.0 - lum));

      // Gentle vignette tint at the frame edge.
      color = mix(color, color * vec3(0.92, 0.91, 0.89), smoothstep(0.55, 1.0, dist));

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

/** 不同赛道主题的泛光强度：白天亮场景要收着，夜里要靠灯笼发光。 */
const BLOOM_MOODS = {
  city: { strength: 1.0, threshold: 0.82, radius: 0.62 },
  harbor: { strength: 0.95, threshold: 0.84, radius: 0.6 },
  port: { strength: 0.9, threshold: 0.86, radius: 0.6 },
  coast: { strength: 0.6, threshold: 0.98, radius: 0.55 },
  forest: { strength: 0.5, threshold: 1.05, radius: 0.52 },
  valley: { strength: 0.7, threshold: 0.94, radius: 0.58 },
  market: { strength: 1.6, threshold: 0.62, radius: 0.7 },
};

export class PostFX {
  constructor(renderer, scene, camera, quality = 'high') {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      samples: 2,
    });
    this.target = target;
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(1);
    this.composer.setSize(size.x, size.y);
    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.62, 0.82);
    this.outputPass = new OutputPass();
    this.gradePass = new ShaderPass(FinalGradeShader);
    this.gradePass.uniforms.uResolution.value.set(size.x, size.y);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.gradePass);
    this.gradePass.renderToScreen = true;
    this.time = 0;
    this.speed = 0;
    this.boost = 0;
    this.setQuality(quality);
  }

  setQuality(quality) {
    this.quality = quality;
    this.applyBloom();
  }

  /** 换成某条赛道的主题（决定泛光强弱）。 */
  setMood(mood) {
    this.mood = mood;
    this.applyBloom();
  }

  applyBloom() {
    if (!this.bloomPass) return;
    const quality = this.quality;
    const mood = BLOOM_MOODS[this.mood] || BLOOM_MOODS.city;
    const base = quality === 'high' ? 1 : quality === 'medium' ? 0.76 : 0.5;
    this.bloomPass.enabled = quality !== 'low';
    this.bloomPass.strength = 0.42 * mood.strength * base;
    this.bloomPass.threshold = mood.threshold;
    this.bloomPass.radius = quality === 'high' ? mood.radius : mood.radius * 0.8;
  }

  setSize(width, height, pixelRatio) {
    const renderer = this.renderer;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);
    this.gradePass.uniforms.uResolution.value.set(size.x, size.y);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt, speedKph = 0, boosting = false) {
    this.time += dt;
    this.speed = speedKph / 350;
    this.boost = boosting ? 1 : this.boost * Math.exp(-dt * 5);
    this.gradePass.uniforms.uTime.value = this.time;
    this.gradePass.uniforms.uSpeed.value = this.speed * 0.8;
    this.gradePass.uniforms.uBoost.value = this.boost;
  }

  render() {
    this.composer.render();
  }
}
