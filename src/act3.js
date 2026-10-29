import { TAU, clamp, lerp, easeInOut, easeOut, smooth, glow, text, grid, makeParticleLayer } from './util.js';
import { createBlow } from './blow.js';

const GRIDC = '#12384a';

// 亮度从高到低：最亮的光点去描边和火苗，最暗的去蛋糕胚
// blend 越高越"霓虹"，越低越保留照片本色
const REGIONS = [
  { id: 'edge', col: [205, 250, 255], blend: 0.9 },
  { id: 'cream', col: [223, 251, 255], blend: 0.82 },
  { id: 'flame', col: [255, 96, 200], blend: 0.92 },
  { id: 'candle', col: [46, 230, 255], blend: 0.88 },
  { id: 'plate', col: [76, 201, 240], blend: 0.6 },
  { id: 'body', col: [110, 59, 255], blend: 0.7, grad: [34, 211, 238] },
];

const FLAMES = [
  [260, 144],
  [300, 144],
  [340, 144],
];
const CANDLES = [260, 300, 340];

// 幕三：光点排成霓虹蛋糕 → 蜡烛摇曳 → 吹气灭烛 → 字幕浮现
export function createAct3(env) {
  const layer = makeParticleLayer();
  const blow = createBlow();
  let t = 0;
  let particles = [];
  let has = false;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let sparks = [];
  let smoke = [];
  let blownT = -1;
  let waitT = 0;

  function transform() {
    scale = Math.min(env.W * 0.5, env.H * 0.62) / 600;
    ox = env.W / 2 - 300 * scale;
    oy = env.H * 0.46 - 300 * scale;
  }

  const blown = () => blownT >= 0;

  function assign() {
    transform();
    const px = cakeMask(600);
    const N = particles.length;
    const pool = shuffle(px).slice(0, N);
    const groups = {};
    REGIONS.forEach((r) => (groups[r.id] = []));
    pool.forEach((p) => groups[p.reg].push(p));

    const sorted = particles.slice().sort((a, b) => lum(b) - lum(a));
    let k = 0;
    REGIONS.forEach((r) => {
      const list = groups[r.id];
      shuffle(list);
      list.forEach((tp) => {
        const p = sorted[k++];
        if (!p) return;
        bind(p, tp, r);
      });
    });
    const body = REGIONS[REGIONS.length - 1];
    while (k < sorted.length) {
      bind(sorted[k++], pool[(Math.random() * pool.length) | 0], body);
    }
    sparks = [];
    smoke = [];
  }

  function bind(p, tp, r) {
    p.tx = tp.x;
    p.ty = tp.y;
    p.reg = r.id;
    let c = r.col;
    if (r.grad) {
      const g = clamp((495 - tp.y) / 245, 0, 1);
      c = [lerp(r.col[0], r.grad[0], g), lerp(r.col[1], r.grad[1], g), lerp(r.col[2], r.grad[2], g)];
    }
    p.cr = lerp(p.r, c[0], r.blend);
    p.cg = lerp(p.g, c[1], r.blend);
    p.cb = lerp(p.b, c[2], r.blend);
    p.sx = p.x;
    p.sy = p.y;
    p.delay = Math.random() * 0.5;
    p.dur = 1.5 + Math.random() * 0.7;
    p.ph = Math.random() * TAU;
  }

  function doBlow() {
    if (blown()) return;
    blownT = t;
    this.blowDone = true;
    FLAMES.forEach((f, i) => {
      for (let n = 0; n < 22; n++) {
        smoke.push({
          x: ox + (f[0] + (Math.random() - 0.5) * 10) * scale,
          y: oy + (f[1] - 10) * scale,
          vx: (Math.random() - 0.5) * 10 * scale,
          vy: -(12 + Math.random() * 26) * scale,
          life: -i * 0.05 - Math.random() * 0.6,
          max: 1.6 + Math.random() * 1.4,
        });
      }
    });
  }

  return {
    label: '幕三',
    awaitClick: false,
    done: false,
    blowDone: false,

    import(payload) {
      if (!payload || !payload.particles || !payload.particles.length) return;
      particles = payload.particles;
      has = true;
      assign();
    },

    // 麦克风不可用时，点一下也能吹灭
    poke() {
      if (has && t > 2.4 && !blown()) doBlow.call(this);
    },

    update(dt) {
      t += dt;
      if (!has) return;
      transform();

      // 蛋糕成形后开始听吹气
      if (t > 2.4 && !blown()) {
        blow.update(dt);
        waitT += dt;
        if (blow.state.blowing) doBlow.call(this);
        else if (blow.state.failed && waitT > 18) doBlow.call(this);
      }

      const outP = blown() ? smooth(blownT, blownT + 0.45, t) : 0;
      const lvl = blown() ? 0 : blow.state.progress || 0;

      for (const p of particles) {
        const u = clamp((t - 0.2 - p.delay) / p.dur, 0, 1);
        const tx = ox + p.tx * scale;
        const ty = oy + p.ty * scale;
        if (u < 1) {
          const e = easeInOut(u);
          const w = (1 - u) * (1 - u);
          p.x = lerp(p.sx, tx, e) + Math.sin(p.ph + u * 6.5) * 80 * w;
          p.y = lerp(p.sy, ty, e) + Math.cos(p.ph + u * 6.5) * 80 * w;
        } else {
          const j = p.reg === 'flame' ? 3.4 : 1.1;
          // 火苗：摇曳幅度随麦克风音量变大（吹之前就能看出它在响应你）
          const sway = p.reg === 'flame' ? Math.sin(t * 1.7 + p.ph) * (3 + lvl * 26) : 0;
          p.x = tx + Math.sin(t * 2.1 + p.ph) * j + sway;
          p.y = ty + Math.cos(t * 1.7 + p.ph) * j - (p.reg === 'flame' ? outP * 12 : 0);
        }
      }

      // 火星（吹灭后停止）
      if (t > 2.4 && !blown()) {
        if (sparks.length < 60 && Math.random() < 0.5) {
          const f = FLAMES[(Math.random() * FLAMES.length) | 0];
          sparks.push({
            x: ox + (f[0] + (Math.random() - 0.5) * 12) * scale,
            y: oy + f[1] * scale,
            vx: (Math.random() - 0.5) * 16 * scale,
            vy: -(20 + Math.random() * 36) * scale,
            life: 0,
            max: 1.0 + Math.random() * 1.1,
          });
        }
      }
      for (const s of sparks) {
        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy *= 0.985;
      }
      sparks = sparks.filter((s) => s.life < s.max);

      // 吹灭后升起的青烟
      if (blown()) {
        for (const s of smoke) {
          s.life += dt;
          if (s.life < 0) continue;
          s.x += (s.vx + Math.sin(t * 1.5 + s.y * 0.02) * 8) * dt;
          s.y += s.vy * dt;
          s.vy *= 0.99;
        }
        smoke = smoke.filter((s) => s.life < s.max);
      }
    },

    draw(ctx) {
      const { W, H } = env;
      grid(ctx, W, H, { spacing: 72, alpha: 0.06, color: GRIDC, scale: 1 });
      if (!has) return;

      const oa = smooth(1.8, 2.8, t) * 0.14;
      if (oa > 0.005) outline(ctx, ox, oy, scale, oa);

      if (layer.W !== W || layer.H !== H) layer.resize(W, H);
      layer.clear();
      const outP = blown() ? smooth(blownT, blownT + 0.45, t) : 0;
      const flick = 0.8 + 0.28 * Math.sin(t * 9.5);
      for (const p of particles) {
        let f = 1;
        if (p.reg === 'flame') f = (flick + 0.16 * Math.sin(p.ph * 3 + t * 13)) * (1 - outP);
        if (f <= 0.01) continue;
        layer.plot(
          p.x,
          p.y,
          clamp(p.cr * f, 0, 255) | 0,
          clamp(p.cg * f, 0, 255) | 0,
          clamp(p.cb * f, 0, 255) | 0,
          1
        );
      }
      for (const s of sparks) {
        const a = 1 - s.life / s.max;
        layer.plot(s.x, s.y, (255 * a) | 0, (110 * a) | 0, (210 * a) | 0, 1);
      }
      for (const s of smoke) {
        if (s.life < 0) continue;
        const a = (1 - s.life / s.max) * 0.5;
        layer.plot(s.x, s.y, (120 * a) | 0, (140 * a) | 0, (170 * a) | 0, 1);
      }
      layer.flush(ctx, true);

      // 烛光晕
      const fa = smooth(2.4, 3.2, t) * (1 - outP);
      FLAMES.forEach((f, i) => {
        const x = ox + f[0] * scale;
        const y = oy + f[1] * scale;
        const pulse = 0.5 + 0.5 * Math.sin(t * 7 + i * 2);
        glow(ctx, (c) => c.arc(x, y, 15 + 6 * pulse, 0, TAU), {
          color: '#ff5cc8',
          width: 1,
          blur: 34,
          alpha: 0.45 * fa * (0.7 + 0.3 * pulse),
          core: false,
        });
      });

      // 吹气指引：蛋糕上方一条随音量增长的弧
      if (t > 2.6 && !blown()) {
        const cx = ox + 300 * scale;
        const cy = oy + 96 * scale;
        const lvl = clamp(blow.state.progress || 0, 0, 1);
        const ready = blow.state.ready;
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
        glow(ctx, (c) => c.arc(cx, cy, 30, Math.PI * 1.15, Math.PI * 1.85), {
          color: '#5f7a8c', width: 2, blur: 8, alpha: 0.3, core: false,
        });
        if (lvl > 0.01) {
          glow(ctx, (c) => c.arc(cx, cy, 30, Math.PI * 1.15, Math.PI * 1.15 + Math.PI * 0.7 * lvl), {
            color: '#2ee6ff', width: 3, blur: 16, alpha: 0.95,
          });
        }
        text(ctx, ready ? '吹 灭 蜡 烛' : '点 击 画 面 吹 灭 蜡 烛', cx, cy - 46, {
          size: 14,
          color: '#bff0ff',
          alpha: 0.45 + 0.3 * pulse,
          align: 'center',
        });
      }

      // 字幕：吹灭之后才出现
      if (blown()) drawSubtitle(ctx, t - blownT - 1.2);
    },
  };

  function drawSubtitle(ctx, lt) {
    if (lt <= 0) return;
    const { W, H } = env;
    const chars = ['祝', '朱', '老', '师', '生', '日', '快', '乐'];
    const size = clamp(Math.min(W * 0.052, H * 0.072), 24, 64);
    const gap = size * 1.16;
    const x0 = W / 2 - ((chars.length - 1) * gap) / 2;
    const y = H * 0.885;
    chars.forEach((ch, i) => {
      const a = smooth(i * 0.14, 0.7 + i * 0.14, lt);
      if (a <= 0.01) return;
      const dy = (1 - easeOut(a)) * 20;
      text(ctx, ch, x0 + i * gap, y + dy, {
        size,
        color: '#f2fbff',
        alpha: a,
        align: 'center',
        blur: 26,
      });
    });
  }
}

/* ------------------------------------------------------------ 工具函数 */
const lum = (p) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function rrPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function flamePath(g, x) {
  g.beginPath();
  g.moveTo(x, 118);
  g.bezierCurveTo(x + 9, 132, x + 7, 152, x, 158);
  g.bezierCurveTo(x - 7, 152, x - 9, 132, x, 118);
  g.closePath();
}

function cakeMask(S) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const C = {
    body: 'rgb(1,0,0)',
    cream: 'rgb(2,0,0)',
    candle: 'rgb(3,0,0)',
    flame: 'rgb(4,0,0)',
    plate: 'rgb(5,0,0)',
    edge: 'rgb(7,0,0)',
  };
  const fill = (style, fn) => {
    g.fillStyle = style;
    fn(g);
    g.fill();
  };
  fill(C.plate, (x) => {
    x.beginPath();
    x.ellipse(300, 498, 208, 20, 0, 0, TAU);
  });
  fill(C.body, (x) => rrPath(x, 180, 370, 240, 125, 6));
  fill(C.body, (x) => rrPath(x, 220, 250, 160, 118, 6));
  fill(C.cream, (x) => rrPath(x, 174, 350, 252, 20, 5));
  fill(C.cream, (x) => rrPath(x, 214, 240, 172, 16, 5));
  CANDLES.forEach((cx) => fill(C.candle, (x) => rrPath(x, cx - 4, 158, 8, 84, 3)));
  fill(C.flame, (x) => {
    FLAMES.forEach((f) => flamePath(x, f[0]));
  });

  g.strokeStyle = C.edge;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  rrPath(g, 180, 370, 240, 125, 6);
  g.stroke();
  rrPath(g, 220, 250, 160, 118, 6);
  g.stroke();
  rrPath(g, 174, 350, 252, 20, 5);
  g.stroke();
  rrPath(g, 214, 240, 172, 16, 5);
  g.stroke();
  g.beginPath();
  g.ellipse(300, 498, 208, 20, 0, 0, TAU);
  g.stroke();
  CANDLES.forEach((cx) => {
    rrPath(g, cx - 4, 158, 8, 84, 3);
    g.stroke();
    flamePath(g, cx);
    g.stroke();
  });

  const data = g.getImageData(0, 0, S, S).data;
  const code = { 1: 'body', 2: 'cream', 3: 'candle', 4: 'flame', 5: 'plate', 7: 'edge' };
  const px = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const o = (y * S + x) * 4;
      if (data[o + 3] < 128) continue;
      const id = code[data[o]];
      if (!id) continue;
      px.push({ x, y, reg: id });
    }
  }
  return px;
}

function outline(ctx, ox, oy, s, alpha) {
  const rect = (x, y, w, h, r) => {
    const ax = ox + x * s;
    const ay = oy + y * s;
    ctx.beginPath();
    ctx.moveTo(ax + r * s, ay);
    ctx.arcTo(ax + w * s, ay, ax + w * s, ay + h * s, r * s);
    ctx.arcTo(ax + w * s, ay + h * s, ax, ay + h * s, r * s);
    ctx.arcTo(ax, ay + h * s, ax, ay, r * s);
    ctx.arcTo(ax, ay, ax + w * s, ay, r * s);
    ctx.closePath();
  };
  [
    () => rect(180, 370, 240, 125, 6),
    () => rect(220, 250, 160, 118, 6),
    () => rect(174, 350, 252, 20, 5),
    () => rect(214, 240, 172, 16, 5),
  ].forEach((fn) => {
    fn();
    ctx.save();
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#9fe8ff';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  });
}
