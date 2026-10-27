import { registerEngines } from '../stage.js';
import { scene } from './scene.js';
import { textEngines } from './text.js';
import { visualEngines } from './visual.js';
import { systemEngines } from './system.js';
import { miscEngines } from './misc.js';
import { boardEngines } from './board.js';

export function installEngines() {
  registerEngines({
    scene,
    ...textEngines,
    ...visualEngines,
    ...systemEngines,
    ...miscEngines,
    ...boardEngines,
  });
}
