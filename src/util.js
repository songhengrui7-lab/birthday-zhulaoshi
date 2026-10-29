export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const MONO = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
export const SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

// Neon stroke: one glowing pass + a thin white core pass on the same path.
export function glow(ctx, path, o = {}) {
  const {
    color = '#2ee6ff',
    width = 2,
    blur = 16,
    core = true,
    coreAlpha = 0.7,
    alpha = 1,
    dash = null,
    fill = null,
  } = o;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (dash) ctx.setLineDash(dash);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  path(ctx);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.stroke();
  if (core) {
    ctx.shadowBlur = blur * 0.4;
    ctx.globalAlpha = clamp(alpha * coreAlpha, 0, 1);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.8, width * 0.32);
    ctx.stroke();
  }
  ctx.restore();
}

export function text(ctx, str, x, y, o = {}) {
  const {
    size = 16,
    color = '#dff3ff',
    alpha = 1,
    font = SANS,
    align = 'left',
    baseline = 'alphabetic',
    blur = 10,
    weight = 400,
  } = o;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function grid(ctx, W, H, o = {}) {
  const { spacing = 56, alpha = 0.14, color = '#12384a', scale = 1 } = o;
  const s = Math.max(12, spacing * scale);
  const cx = W / 2;
  const cy = H / 2;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -60; k <= 60; k++) {
    const x = cx + k * s;
    if (x > -1 && x < W + 1) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    const y = cy + k * s;
    if (y > -1 && y < H + 1) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// 直接写像素的粒子层：离屏 ImageData + Uint32 写入，再用 lighter 叠加出发光感。
// 比逐个 fillRect 快一个数量级，几万个光点也能跑满帧。
export function makeParticleLayer() {
  const canvas = document.createElement('canvas');
  let c2d = null;
  let img = null;
  let buf = null;
  let small = null;
  let sctx = null;
  return {
    W: 0,
    H: 0,
    resize(W, H) {
      this.W = W;
      this.H = H;
      canvas.width = W;
      canvas.height = H;
      c2d = canvas.getContext('2d');
      img = c2d.createImageData(W, H);
      buf = new Uint32Array(img.data.buffer);
    },
    clear() {
      if (buf) buf.fill(0);
    },
    plot(x, y, r, g, b, size) {
      const xi = x | 0;
      const yi = y | 0;
      if (xi < 0 || yi < 0 || xi >= this.W - 1 || yi >= this.H - 1) return;
      const c = (255 << 24) | (b << 16) | (g << 8) | r;
      const o = yi * this.W + xi;
      if (size === 1) {
        buf[o] = c;
        return;
      }
      buf[o] = c;
      buf[o + 1] = c;
      buf[o + this.W] = c;
      buf[o + this.W + 1] = c;
    },
    // bloom=true 时多叠一层 1/4 缩放再放大的软光晕，霓虹感靠它
    flush(ctx, bloom) {
      c2d.putImageData(img, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(canvas, 0, 0);
      if (bloom) {
        const bw = Math.max(1, (this.W / 4) | 0);
        const bh = Math.max(1, (this.H / 4) | 0);
        if (!small) {
          small = document.createElement('canvas');
          sctx = small.getContext('2d');
        }
        if (small.width !== bw || small.height !== bh) {
          small.width = bw;
          small.height = bh;
        }
        sctx.clearRect(0, 0, bw, bh);
        sctx.drawImage(canvas, 0, 0, bw, bh);
        ctx.globalAlpha = 0.55;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(small, 0, 0, this.W, this.H);
      }
      ctx.restore();
    },
  };
}

// Draw a polyline from an array of [x, y] pairs (or {x, y} objects).
export function polyline(ctx, pts, o = {}) {
  if (!pts || pts.length < 2) return;
  const get = Array.isArray(pts[0]) ? (p) => p : (p) => [p.x, p.y];
  glow(
    ctx,
    (c) => {
      const [x0, y0] = get(pts[0]);
      c.moveTo(x0, y0);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = get(pts[i]);
        c.lineTo(x, y);
      }
    },
    o
  );
}
