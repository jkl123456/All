import { golden, probability, projectile } from './math.js';
import { buoyancy, induction, pendulum, tide } from './physics.js';
import { combustion, crystal, molecule } from './chemistry.js';
import { preposition, timeline, wordTree } from './english.js';
import { dna, foodchain, photosynthesis } from './biology.js';
import { earthLayers, monsoon, plates, terrace } from './geography.js';
import { dujiangyan, printing, silkroad } from './history.js';
import { couplet, hanzi, poetry } from './chinese.js';
import { binaryTree, hanoi, network } from './programmer.js';
import { bezier, colorWheel, layoutGrid } from './designer.js';
import { dough, heat, maillard } from './chef.js';
import { arch, towerWind, truss } from './architect.js';
import { sonar } from './fisherman.js';
import { irrigation, solarTerms } from './farmer.js';
import {
  barometer,
  calculus,
  cell,
  compiler,
  contrast,
  dissolve,
  emulsion,
  ferment,
  fibonacci,
  hash,
  immune,
  karst,
  lever,
  mutex,
  ocean,
  periodic,
  ph,
  pythagoras,
  refraction,
  rotation,
  seasons,
  sunPath,
  typescale,
} from './extra-science.js';
import { canal, classical, kezhou, metaphor, moonlight, reform, stump, tower, voyage } from './extra-humanities.js';
import { anshi, battery, pavilionModel } from './extra-topics.js';
import * as THREE from 'three';
import { addGlow, addLabel, sphere } from './helpers.js';

const BUILDERS = {
  projectile,
  golden,
  probability,
  pendulum,
  buoyancy,
  induction,
  tide,
  molecule,
  combustion,
  crystal,
  preposition,
  timeline,
  wordTree,
  photosynthesis,
  dna,
  foodchain,
  earthLayers,
  monsoon,
  plates,
  terrace,
  dujiangyan,
  silkroad,
  printing,
  poetry,
  couplet,
  hanzi,
  binaryTree,
  hanoi,
  network,
  colorWheel,
  layoutGrid,
  bezier,
  maillard,
  heat,
  dough,
  arch,
  truss,
  towerWind,
  sonar,
  solarTerms,
  irrigation,
  pythagoras,
  fibonacci,
  calculus,
  lever,
  refraction,
  dissolve,
  ph,
  periodic,
  cell,
  immune,
  seasons,
  ocean,
  karst,
  voyage,
  canal,
  reform,
  hash,
  mutex,
  compiler,
  contrast,
  typescale,
  ferment,
  emulsion,
  sunPath,
  barometer,
  rotation,
  moonlight,
  tower,
  stump,
  kezhou,
  metaphor,
  classical,
  battery,
  anshi,
  pavilionModel,
};

function fallback(point) {
  const group = new THREE.Group();
  const color = point.subject?.color || '#6BE7FF';
  const core = sphere(1.1, color, { emissive: color, emissiveIntensity: 1.2, roughness: 0.3 });
  group.add(core);
  addGlow(group, color, 6, [0, 0, 0], 0.5);
  addLabel(group, point.title, [0, 2.1, 0], {
    color: '#eaf8ff',
    fontSize: 34,
    scale: 0.0074,
    bg: 'rgba(4, 10, 18, 0.72)',
    border: 'rgba(107, 231, 255, 0.3)',
    padding: 10,
  });
  return {
    group,
    view: { position: [0, 1, 8], target: [0, 0, 0] },
    update(time) {
      core.rotation.y = time * 0.3;
      core.rotation.x = time * 0.15;
    },
  };
}

export function buildDemo(point) {
  const type = point?.demo?.type;
  const builder = BUILDERS[type];
  if (!builder) return fallback(point);
  try {
    const result = builder({ point, subject: point.subject });
    if (!result || !result.group) return fallback(point);
    return result;
  } catch (error) {
    console.error(`[demo:${type}]`, error);
    return fallback(point);
  }
}
