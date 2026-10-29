import { TAU, clamp, lerp, easeOut, smooth, glow, text, grid, makeParticleLayer } from './util.js';
import { loadPhotos } from './photos.js';

const CY = '#2ee6ff';
const GRIDC = '#12384a';

// 幕二：照片墙。照片飘进来后会跟着鼠标躲开；点一下画面 → 碎成光点 → 幕三的蛋糕
export function createAct2(env) {
  let t = 0;
  let tiles = [];
  let phase = 'wait';
  let dissolveT = 0;
  let particles = [];
  let loading = false;
  let hintT = 0;

  const layer = makeParticleLayer();
  const pointer = { x: -1e5, y: -1e5, on: false };

  if (!window.__pointerBound2) {
    window.__pointerBound2 = true;
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.on = true;
    });
  }

  function build(list) {
    tiles = list.map((p, i) => ({
      img: p.img,
      i,
      x: env.W / 2,
      y: env.H * 0.2,
      vx: 0,
      vy: 0,
      rot: 0,
      jx: (Math.random() - 0.5) * 0.18,
      jy: (Math.random() - 0.5) * 0.18,
      jr: (Math.random() - 0.5) * 0.1,
      ph: Math.random() * TAU,
    }));
    phase = 'wall';
  }

  function layout(i) {
    const N = tiles.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(N * 1.5)));
    const rows = Math.max(1, Math.ceil(N / cols));
    const availW = env.W * 0.74;
    const availH = env.H * 0.62;
    const cw = clamp(Math.min(availW / cols, availH / rows / 0.75), 84, 226);
    const ch = cw * 0.75;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, N - row * cols);
    const x = env.W / 2 + (col - (inRow - 1) / 2) * cw * 1.14;
    const y = env.H * 0.48 + (row - (rows - 1) / 2) * ch * 1.16;
    return { cw, ch, x, y };
  }

  function startDissolve() {
    phase = 'dissolve';
    dissolveT = t;
    // 采样密度自适应：无论几张照片，总量稳定在 1.8 万左右（霓虹点阵要稀疏）
    const S = clamp(Math.round(Math.sqrt(18000 / Math.max(1, tiles.length))), 24, 96);
    const off = document.createElement('canvas');
    off.width = S;
    off.height = S;
    const g = off.getContext('2d');
    particles = [];
    tiles.forEach((tile) => {
      const L = layout(tile.i);
      const rect = coverRect(tile.img, L.cw / L.ch);
      g.clearRect(0, 0, S, S);
      g.drawImage(tile.img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, S, S);
      const data = g.getImageData(0, 0, S, S).data;
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const o = (j * S + i) * 4;
          if (data[o + 3] < 12) continue;
          const px = tile.x + (i / S - 0.5) * L.cw;
          const py = tile.y + (j / S - 0.5) * L.ch;
          const dx = px - tile.x;
          const dy = py - tile.y;
          const d = Math.hypot(dx, dy) || 1;
          const burst = 30 + Math.random() * 90;
          particles.push({
            sx: px,
            sy: py,
            x: px,
            y: py,
            bx: (dx / d) * burst,
            by: (dy / d) * burst,
            r: data[o],
            g: data[o + 1],
            b: data[o + 2],
            ph: Math.random() * TAU,
          });
        }
      }
    });
  }

  return {
    label: '幕二',
    awaitClick: true,
    done: false,

    poke() {
      if (phase === 'wall' && this.done) {
        startDissolve();
        this.awaitClick = false;
        this.done = false;
      }
    },

    export() {
      return { particles };
    },

    update(dt) {
      t += dt;

      if (!loading && !tiles.length) {
        loading = true;
        loadPhotos().then((list) => build(list));
      }

      if (phase === 'wall') {
        tiles.forEach((tile) => {
          const L = layout(tile.i);
          const tx = L.x + tile.jx * L.cw + Math.sin(t * 0.45 + tile.ph) * 9;
          const ty = L.y + tile.jy * L.ch + Math.cos(t * 0.38 + tile.ph) * 9;
          tile.vx += (tx - tile.x) * 8 * dt;
          tile.vy += (ty - tile.y) * 8 * dt;
          if (pointer.on) {
            const dx = tile.x - pointer.x;
            const dy = tile.y - pointer.y;
            const d = Math.hypot(dx, dy) || 1;
            const R = Math.max(150, L.cw * 0.95);
            if (d < R) {
              const f = (1 - d / R) * 1200;
              tile.vx += (dx / d) * f * dt;
              tile.vy += (dy / d) * f * dt;
            }
          }
          const damp = Math.exp(-2.4 * dt);
          tile.vx *= damp;
          tile.vy *= damp;
          tile.x += tile.vx * dt;
          tile.y += tile.vy * dt;
          tile.rot = tile.jr + Math.sin(t * 0.5 + tile.ph) * 0.02 + clamp(tile.vx * 0.0006, -0.16, 0.16);
        });

        // 全部照片入场完毕 → 等待点击
        const lastIn = 0.85 + (tiles.length - 1) * 0.16;
        if (tiles.length && t > lastIn) {
          this.done = true;
          hintT += dt;
        }
      }

      if (phase === 'dissolve') {
        const u = clamp((t - dissolveT) / 0.95, 0, 1);
        const e = easeOut(u);
        for (const p of particles) {
          p.x = p.sx + p.bx * e + Math.sin(p.ph) * 6 * e;
          p.y = p.sy + p.by * e - 16 * e;
        }
        if (t - dissolveT > 0.95) this.done = true;
      }
    },

    draw(ctx) {
      const { W, H } = env;
      const fade = phase === 'dissolve' ? 1 - smooth(0, 0.5, t - dissolveT) : 1;
      grid(ctx, W, H, { spacing: 72, alpha: 0.07 * fade, color: GRIDC, scale: 1 });

      // 照片
      if (phase !== 'dissolve' && tiles.length) {
        tiles.forEach((tile) => {
          const L = layout(tile.i);
          const ap = smooth(0.25 + tile.i * 0.16, 0.85 + tile.i * 0.16, t);
          if (ap <= 0.01) return;
          const sc = lerp(0.72, 1, easeOut(ap));
          drawPhoto(ctx, tile, L.cw * sc, L.ch * sc, ap * fade);
        });
      }

      // 粒子层
      if (phase === 'dissolve') {
        if (layer.W !== W || layer.H !== H) layer.resize(W, H);
        layer.clear();
        for (const p of particles) layer.plot(p.x, p.y, p.r, p.g, p.b, 1);
        layer.flush(ctx, true);
      }

      // 点击指引：底部呼吸光环
      if (phase === 'wall' && this.done) {
        canvasCursor(true);
        const a = smooth(0, 0.5, hintT);
        const breath = 0.5 + 0.5 * Math.sin(hintT * 2.4);
        const cx = W / 2;
        const cy = H * 0.9;
        glow(ctx, (c) => c.arc(cx, cy, 20 + 5 * breath, 0, TAU), {
          color: CY, width: 1.4, blur: 18, alpha: (0.35 + 0.35 * breath) * a, core: false,
        });
        glow(ctx, (c) => c.arc(cx, cy, 4.5, 0, TAU), {
          color: '#bff0ff', width: 1, blur: 14, alpha: 0.9 * a, fill: '#eafaff',
        });
        text(ctx, '点 击 画 面 · 让 照 片 变 成 蛋 糕', cx, cy + 44, {
          size: 15, color: '#bff0ff', alpha: (0.5 + 0.35 * breath) * a, align: 'center',
        });
      } else {
        canvasCursor(false);
      }
    },
  };

  function canvasCursor(on) {
    const el = document.getElementById('stage');
    if (!el) return;
    el.style.cursor = on ? 'pointer' : 'default';
  }
}

/* ------------------------------------------------------------ 工具函数 */
function coverRect(img, aspect) {
  const sa = img.width / img.height;
  if (sa > aspect) {
    const sw = img.height * aspect;
    return { sx: (img.width - sw) / 2, sy: 0, sw, sh: img.height };
  }
  const sh = img.width / aspect;
  return { sx: 0, sy: (img.height - sh) / 2, sw: img.width, sh };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPhoto(ctx, tile, w, h, alpha) {
  const { img, x, y, rot } = tile;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#080b12';
  rr(ctx, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 5);
  ctx.fill();
  ctx.restore();
  const rect = coverRect(img, w / h);
  ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, -w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.82)';
  ctx.lineWidth = 2;
  rr(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 4);
  ctx.stroke();
  ctx.restore();
}
