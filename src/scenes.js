import { createAct1 } from './act1.js';
import { createAct2 } from './act2.js';
import { createAct3 } from './act3.js';

// 幕一一镜到底 → 幕二照片墙 + 手势 → 幕三光点蛋糕 + 字幕
// 幕二把聚好的光球 export 出来，幕三 import 后接着用，保证不割裂。
export function createScenes(env) {
  return [createAct1(env), createAct2(env), createAct3(env)];
}
