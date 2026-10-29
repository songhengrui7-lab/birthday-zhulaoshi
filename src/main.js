import { TAU, glow, vignette } from './util.js';
import { createScenes } from './scenes.js';

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const bgm = document.getElementById('bgm');
const hbd = document.getElementById('hbd');
const env = { W: 0, H: 0, dpr: 1 };

let scenes = [];
let idx = 0;
let scene = null;
let fast = false;
let last = performance.now();

let audioStarted = false;
let melodyPlayed = false;
let hintT = 0;

const dust = Array.from({ length: 70 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.3 + 0.3,
  vy: -(Math.random() * 0.012 + 0.004),
  a: Math.random() * 0.4 + 0.1,
  p: Math.random() * TAU,
}));

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  env.dpr = dpr;
  env.W = window.innerWidth;
  env.H = window.innerHeight;
  canvas.width = Math.floor(env.W * dpr);
  canvas.height = Math.floor(env.H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function reset() {
  scenes = createScenes(env);
  idx = 0;
  scene = scenes[0];
}

/* --------------------------------------------------------------- 声音 */
function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  bgm.volume = 0;
  Promise.resolve(bgm.play())
    .then(() => {
      let v = 0;
      const timer = setInterval(() => {
        v += 0.02;
        bgm.volume = Math.min(0.45, v);
        if (v >= 0.45) clearInterval(timer);
      }, 60);
    })
    .catch(() => {
      audioStarted = false; // 被浏览器拦了，等下一次交互再试
    });
}

function playMelody() {
  if (melodyPlayed) return;
  melodyPlayed = true;
  let v = bgm.volume;
  const duck = setInterval(() => {
    v -= 0.03;
    bgm.volume = Math.max(0.12, v);
    if (v <= 0.12) clearInterval(duck);
  }, 60);
  hbd.volume = 0.7;
  Promise.resolve(hbd.play()).catch(() => {});
}

// 右上角的小喇叭：声音还没开时轻轻呼吸提示
function drawAudioHint(dt) {
  if (audioStarted) return;
  hintT += dt;
  const x = env.W - 44;
  const y = 44;
  const a = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(hintT * 2.2));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = '#9fd9ff';
  ctx.fillStyle = '#9fd9ff';
  ctx.lineWidth = 1.4;
  ctx.shadowColor = '#9fd9ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 4);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x + 1, y - 9);
  ctx.lineTo(x + 1, y + 9);
  ctx.lineTo(x - 4, y + 4);
  ctx.lineTo(x - 9, y + 4);
  ctx.closePath();
  ctx.fill();
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(x + 1, y, 5 + i * 5, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/* --------------------------------------------------------------- 主循环 */
function drawDust(dt) {
  const { W, H } = env;
  ctx.save();
  for (const d of dust) {
    d.y += d.vy * dt;
    if (d.y < -0.02) d.y = 1.02;
    const tw = 0.6 + 0.4 * Math.sin(performance.now() * 0.001 + d.p);
    ctx.globalAlpha = d.a * tw * 0.6;
    ctx.fillStyle = '#9fd9ff';
    ctx.beginPath();
    ctx.arc(d.x * W, d.y * H, d.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  ctx.setTransform(env.dpr, 0, 0, env.dpr, 0, 0);
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, env.W, env.H);

  drawDust(dt);
  scene.update(dt * (fast ? 8 : 1));
  scene.draw(ctx, env);
  drawAudioHint(dt);
  vignette(ctx, env.W, env.H);

  if (scene.blowDone && !melodyPlayed) playMelody();

  if (scene.done && !scene.awaitClick && idx < scenes.length - 1) {
    const payload = scene.export ? scene.export() : null;
    idx += 1;
    scene = scenes[idx];
    if (payload && scene.import) scene.import(payload);
  }

  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('pointerdown', () => {
  startAudio();
  if (scene && scene.poke) scene.poke();
});
window.addEventListener('keydown', (e) => {
  startAudio();
  if (e.key === 's' || e.key === 'S') fast = true;
  if (e.key === 'r' || e.key === 'R') reset();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 's' || e.key === 'S') fast = false;
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

resize();
reset();
startAudio();
requestAnimationFrame(frame);
