import { TAU, clamp, lerp, easeOut, easeInOut, smooth, glow, text, grid, polyline, SANS } from './util.js';

const CY = '#2ee6ff'; // 自行车 / 摆线
const AM = '#ffb020'; // 羽毛球 / 抛物线
const RD = '#ff5470'; // 中国象棋 / 朱红
const GRIDC = '#12384a';

// 一镜到底：坐标系 → 摆线自行车 → 抛物线羽毛球 → 中国象棋马步 → 收束
// 场景之间没有切换，每一幕的结束画面直接长成下一幕。
export function createAct1(env) {
  let t = 0;
  let trail = [];
  let flight = [];
  let camX = 0;
  let frozen = false;
  let detachPt = null;

  const DONE = 29.8;
  const T = {
    axes: 0.4,
    bikeStart: 2.0,
    detach: 9.6, // 轮缘描点脱离车轮
    impact: 10.6, // 被球拍击中
    shot1: 10.75, // 60°
    shot2: 12.55, // 30°
    shot3: 14.35, // 45°
    FL: 1.7,
    board: 16.25, // 棋盘从落点的涟漪里长出来
    slide: 17.6, // 羽毛球滑向棋盘
    slideEnd: 19.2,
    moves: 19.9,
    leg: 22.3, // 蹩马腿
    collapse: 25.8,
    flash: 28.4,
  };

  const shots = [
    { deg: 60, t0: T.shot1 },
    { deg: 30, t0: T.shot2 },
    { deg: 45, t0: T.shot3 },
  ];

  const geom = () => {
    const W = env.W;
    const H = env.H;
    return {
      W,
      H,
      gy: H * 0.76,
      r: clamp(H * 0.075, 30, 58),
      XR: W * 0.87, // 击球点
      R: W * 0.58, // v0² / g
      scale: clamp(H / 900, 0.8, 1.3),
    };
  };

  return {
    label: '幕一',
    awaitClick: false,
    done: false,

    update(dt) {
      t += dt;
      const { gy, r, W, XR } = geom();
      const tb = Math.max(0, t - T.bikeStart) * 2.7;
      const ay = gy - r;
      const axW = W * 0.14 + r * tb;

      if (!frozen) {
        camX = -Math.max(0, axW - W * 0.55);
        if (t >= T.detach) {
          frozen = true;
          detachPt = {
            x: axW - r * Math.sin(tb) + camX,
            y: ay + r * Math.cos(tb),
          };
        }
      }
      if (t >= T.bikeStart && t < 13.4) {
        trail.push([axW - r * Math.sin(tb), ay + r * Math.cos(tb)]);
        if (trail.length > 3000) trail.shift();
      }
      if (t >= T.detach && t <= T.impact && detachPt) {
        const u = clamp((t - T.detach) / (T.impact - T.detach), 0, 1);
        const A = detachPt;
        const B = { x: XR, y: gy - 50 * geom().scale };
        const C = { x: (A.x + B.x) / 2, y: Math.min(A.y, B.y) - env.H * 0.22 };
        const x = (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * C.x + u * u * B.x;
        const y = (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * C.y + u * u * B.y;
        flight.push([x, y]);
      }
      if (t >= DONE) this.done = true;
    },

    draw(ctx) {
      const { W, H, gy, r, XR, R, scale } = geom();
      const fadeAll = 1 - smooth(T.collapse + 0.6, T.flash + 0.6, t);

      grid(ctx, W, H, { spacing: 72, alpha: 0.07 * fadeAll, color: GRIDC, scale: 1 });

      /* ---------- 1. 坐标系（开场） ---------- */
      const axisA = smooth(0.4, 1.4, t) * (1 - smooth(2.0, 2.9, t)) * fadeAll;
      if (axisA > 0.01) {
        const cx = W / 2;
        const cy = H * 0.44;
        const len = W * 0.3 * easeOut(clamp((t - 0.4) / 0.9, 0, 1));
        const vy = len * 0.5;
        glow(
          ctx,
          (c) => {
            c.moveTo(cx - len, cy);
            c.lineTo(cx + len, cy);
            c.moveTo(cx, cy - vy);
            c.lineTo(cx, cy + vy);
          },
          { color: CY, width: 1.4, blur: 14, alpha: 0.9 * axisA }
        );
        glow(
          ctx,
          (c) => {
            c.moveTo(cx + len, cy);
            c.lineTo(cx + len - 13, cy - 6);
            c.moveTo(cx + len, cy);
            c.lineTo(cx + len - 13, cy + 6);
            c.moveTo(cx, cy - vy);
            c.lineTo(cx - 6, cy - vy + 13);
            c.moveTo(cx, cy - vy);
            c.lineTo(cx + 6, cy - vy + 13);
          },
          { color: CY, width: 1.4, blur: 10, alpha: 0.9 * axisA, core: false }
        );
      }

      /* ---------- 地面（自行车与羽毛球共用） ---------- */
      const groundA = (smooth(1.8, 2.6, t) * (1 - smooth(T.board + 0.1, T.board + 1.5, t))) * fadeAll;
      if (groundA > 0.01) {
        glow(
          ctx,
          (c) => {
            c.moveTo(0, gy);
            c.lineTo(W, gy);
          },
          { color: '#1b5f7a', width: 1.4, blur: 8, alpha: 0.85 * groundA, core: false }
        );
      }

      /* ---------- 2. 摆线 · 自行车 ---------- */
      const bikeA = (1 - smooth(10.9, 13.2, t)) * smooth(2.0, 2.6, t) * fadeAll;
      if (bikeA > 0.01) {
        const tb = Math.max(0, t - T.bikeStart) * 2.7;
        const L = r * 3.15;
        const ay = gy - r;
        const axW = W * 0.14 + r * tb;
        ctx.save();
        ctx.translate(camX, 0);
        if (trail.length > 2) {
          polyline(ctx, trail, { color: CY, width: 2.2, blur: 18, alpha: 0.5 * bikeA });
          polyline(ctx, trail.slice(-90), { color: CY, width: 3, blur: 26, alpha: bikeA, coreAlpha: 0.9 });
        }
        drawBike(ctx, axW, ay, r, L, tb, bikeA);
        if (t < T.detach) {
          const px = axW - r * Math.sin(tb);
          const py = ay + r * Math.cos(tb);
          glow(ctx, (c) => { c.moveTo(axW, ay); c.lineTo(px, py); }, {
            color: AM, width: 1.2, blur: 10, alpha: 0.7 * bikeA, dash: [4, 5],
          });
          glow(ctx, (c) => c.arc(px, py, 4.6, 0, TAU), {
            color: AM, width: 2, blur: 22, alpha: bikeA, fill: '#ffd489',
          });
        }
        ctx.restore();
      }

      /* ---------- 3. 描点脱离 → 飞向球拍 ---------- */
      if (t >= T.detach && t <= T.impact + 0.15) {
        const u = clamp((t - T.detach) / (T.impact - T.detach), 0, 1);
        const A = detachPt;
        const B = { x: XR, y: gy - 50 * scale };
        const C = { x: (A.x + B.x) / 2, y: Math.min(A.y, B.y) - H * 0.22 };
        const dx = 2 * (1 - u) * (C.x - A.x) + 2 * u * (B.x - C.x);
        const dy = 2 * (1 - u) * (C.y - A.y) + 2 * u * (B.y - C.y);
        if (flight.length > 1) {
          polyline(ctx, flight, { color: AM, width: 2, blur: 16, alpha: 0.45 });
        }
        if (u < 1) drawShuttle(ctx, A.x, A.y, Math.atan2(dy, dx), 1, scale);
      }

      /* ---------- 4. 抛物线 · 羽毛球 ---------- */
      const ballPhase = 1 - smooth(T.board + 0.1, T.board + 1.6, t);
      if (ballPhase > 0.01 && t > T.impact) {
        const racketA = smooth(9.9, 10.6, t) * ballPhase * fadeAll;
        // 球拍
        let swing = 0;
        shots.forEach((s, i) => {
          const u = clamp((t - s.t0) / T.FL, 0, 1);
          if (i === 0 && (t - s.t0) / T.FL < 0.35 && t - s.t0 > 0) swing = 1 - clamp((t - s.t0) / 0.35, 0, 1);
        });
        drawRacket(ctx, XR + 52 * scale, gy - 8, -0.5 - swing * 0.5, racketA * scale);

        shots.forEach((s, i) => {
          const th = (s.deg * Math.PI) / 180;
          const u = clamp((t - s.t0) / T.FL, 0, 1);
          if (u <= 0) return;
          const range = R * Math.sin(2 * th);
          const h = (R * Math.pow(Math.sin(th), 2)) / 2;
          const pt = (uu) => [XR - range * uu, gy - 4 * h * uu * (1 - uu)];

          const pts = [];
          for (let k = 0; k <= 90; k++) pts.push(pt((u * k) / 90));
          polyline(ctx, pts, { color: AM, width: 2, blur: 16, alpha: 0.5 * ballPhase * fadeAll });
          if (u < 1) {
            polyline(ctx, pts.slice(-18), { color: AM, width: 3, blur: 26, alpha: ballPhase * fadeAll, coreAlpha: 0.9 });
          }
          // 最高点十字
          if (u > 0.5) {
            const [mx, my] = pt(0.5);
            const ap = smooth(0.5, 0.8, u) * ballPhase * fadeAll;
            glow(ctx, (c) => { c.moveTo(mx, my - 7); c.lineTo(mx, my + 7); c.moveTo(mx - 7, my); c.lineTo(mx + 7, my); }, {
              color: '#ffe9bd', width: 1.2, blur: 10, alpha: 0.7 * ap, core: false,
            });
          }
          // 击球光环
          const burst = 1 - clamp((t - s.t0) / 0.45, 0, 1);
          if (burst > 0) {
            glow(ctx, (c) => c.arc(XR, gy - 50 * scale, 12 + 46 * (1 - burst), 0, TAU), {
              color: '#fff3d6', width: 2, blur: 20, alpha: 0.7 * burst, core: false,
            });
          }
          // 落地的球：下一球落地后，前一球淡出
          if (u >= 1) {
            const landT = s.t0 + T.FL;
            const next = i < shots.length - 1 ? 1 - smooth(shots[i + 1].t0 + T.FL, shots[i + 1].t0 + T.FL + 0.7, t) : 1;
            const morphFade = i === shots.length - 1 ? 1 - smooth(T.slide, T.slide + 0.9, t) : 1;
            const a = next * morphFade * ballPhase * fadeAll;
            if (a > 0.01) drawShuttle(ctx, XR - range, gy, 1.15, a, scale);
            // 落点涟漪（最后一球触发棋盘）
            if (i === shots.length - 1) {
              const rip = 1 - clamp((t - landT) / 1.1, 0, 1);
              if (rip > 0) {
                for (let k = 0; k < 3; k++) {
                  const rr = (1 - rip) * (140 + k * 90);
                  glow(ctx, (c) => c.arc(XR - range, gy, rr, 0, TAU), {
                    color: '#ffe9bd', width: 1.4, blur: 14, alpha: 0.35 * rip * rip, core: false,
                  });
                }
              }
            }
          }
        });
      }

      /* ---------- 5. 中国象棋 · 马步 ---------- */
      const boardA = smooth(T.board, T.board + 1.4, t) * fadeAll;
      if (boardA > 0.01) {
        const s = clamp(Math.min((W * 0.4) / 8, (H * 0.6) / 9.55), 30, 72);
        const gap = s * 0.52;
        const boardW = 8 * s;
        const boardH = 9 * s + gap;
        const bx = W / 2 - boardW / 2;
        const by = H * 0.5 - boardH / 2 - H * 0.02;
        const px = (i) => bx + i * s;
        const py = (j) => by + j * s + (j > 4 ? gap : 0);
        const SRC = [4, 7];
        const MOVES = [
          [1, 2], [-1, 2], [1, -2], [-1, -2],
          [2, 1], [-2, 1], [2, -1], [-2, -1],
        ];

        // 收束：整块棋盘带着棋子一起收缩旋转
        const p = smooth(T.collapse, T.flash, t);
        const ccx = W / 2;
        const ccy = by + boardH / 2;
        ctx.save();
        ctx.translate(ccx, ccy);
        ctx.scale(1 - 0.96 * p, 1 - 0.96 * p);
        ctx.rotate(p * 0.6);
        ctx.translate(-ccx, -ccy);

        // 横线
        for (let j = 0; j < 10; j++) {
          const g = clamp((t - T.board - 0.1 - j * 0.05) / 0.5, 0, 1);
          if (g <= 0) continue;
          const y = py(j);
          const half = (boardW / 2) * g;
          glow(ctx, (c) => { c.moveTo(ccx - half, y); c.lineTo(ccx + half, y); }, {
            color: '#2b6f88', width: 1.1, blur: 6, alpha: 0.55 * boardA, core: false,
          });
        }
        // 竖线（楚河汉界处断开，最外侧贯通）
        for (let i = 0; i < 9; i++) {
          const g = clamp((t - T.board - 0.5 - i * 0.05) / 0.45, 0, 1);
          if (g <= 0) continue;
          const x = px(i);
          const segs = i === 0 || i === 8 ? [[py(0), py(9)]] : [[py(0), py(4)], [py(5), py(9)]];
          segs.forEach((sg) => {
            const y1 = sg[0];
            const y2 = lerp(sg[0], sg[1], g);
            glow(ctx, (c) => { c.moveTo(x, y1); c.lineTo(x, y2); }, {
              color: '#2b6f88', width: 1.1, blur: 6, alpha: 0.5 * boardA, core: false,
            });
          });
        }
        glow(ctx, (c) => c.rect(bx - 7, by - 7, boardW + 14, boardH + 14), {
          color: '#3d8ba8', width: 1.6, blur: 10, alpha: 0.7 * boardA * smooth(T.board + 0.9, T.board + 1.5, t),
        });
        text(ctx, '楚 河', px(1.6), py(4) + s * 0.62, {
          size: s * 0.32, color: '#8fb8cc', alpha: 0.7 * boardA, align: 'center',
        });
        text(ctx, '汉 界', px(6.4), py(4) + s * 0.62, {
          size: s * 0.32, color: '#8fb8cc', alpha: 0.7 * boardA, align: 'center',
        });

        // 羽毛球滑进棋盘 → 变成「马」
        const slideU = easeInOut(clamp((t - T.slide) / (T.slideEnd - T.slide), 0, 1));
        const fromX = XR - R; // 45° 落点
        const toX = px(SRC[0]);
        const toY = py(SRC[1]);
        const slideX = lerp(fromX, toX, slideU);
        const slideY = lerp(gy, toY, slideU) - Math.sin(slideU * Math.PI) * 60;
        if (slideU < 1) {
          drawShuttle(ctx, slideX, slideY, 1.15 + slideU * 2, (1 - smooth(0.5, 0.95, slideU)) * boardA, scale);
        }

        // 蹩马腿的兵
        const legA = smooth(T.leg, T.leg + 0.5, t) * boardA;
        const blockP = smooth(T.leg + 0.45, T.leg + 1.1, t);
        if (legA > 0.01) {
          glow(ctx, (c) => c.arc(px(4), py(6), s * 0.4, 0, TAU), {
            color: RD, width: 1.8, blur: 12, alpha: legA * 0.95, fill: 'rgba(12,6,10,0.9)',
          });
          text(ctx, '兵', px(4), py(6), {
            size: s * 0.42, color: '#ff90a6', alpha: legA, align: 'center', baseline: 'middle', font: SANS,
          });
        }

        // 马
        const mA = smooth(T.slideEnd - 0.6, T.slideEnd + 0.3, t) * boardA;
        if (mA > 0.01) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
          const sx = px(SRC[0]);
          const sy = py(SRC[1]);
          glow(ctx, (c) => c.arc(sx, sy, s * 0.44 + 3 * pulse, 0, TAU), {
            color: RD, width: 2.2, blur: 16 + 10 * pulse, alpha: mA,
          });
          glow(ctx, (c) => c.arc(sx, sy, s * 0.38, 0, TAU), {
            color: RD, width: 2, blur: 10, alpha: mA * 0.95, fill: 'rgba(14,7,11,0.95)',
          });
          text(ctx, '马', sx, sy, {
            size: s * 0.44, color: '#ff90a6', alpha: mA * smooth(T.slideEnd - 0.2, T.slideEnd + 0.5, t),
            align: 'center', baseline: 'middle', blur: 14, font: SANS,
          });
        }

        // 8 个落点
        MOVES.forEach((m, k) => {
          const ti = SRC[0] + m[0];
          const tj = SRC[1] + m[1];
          if (ti < 0 || ti > 8 || tj < 0 || tj > 9) return;
          const appear = clamp((t - T.moves - k * 0.16) / 0.6, 0, 1);
          if (appear <= 0) return;
          const mid = Math.abs(m[1]) === 2 ? [SRC[0], SRC[1] + m[1] / 2] : [SRC[0] + m[0] / 2, SRC[1]];
          const blocked = mid[0] === 4 && mid[1] === 6;
          const dead = blocked ? blockP : 0;
          const alive = 1 - dead;
          const mx = px(mid[0]);
          const my = py(mid[1]);
          const tx = px(ti);
          const ty = py(tj);
          const col = dead > 0 ? '#5b6470' : AM;

          const lp = clamp((t - T.moves - k * 0.16) / 0.45, 0, 1);
          glow(ctx, (c) => { c.moveTo(px(SRC[0]), py(SRC[1])); c.lineTo(lerp(px(SRC[0]), mx, lp), lerp(py(SRC[1]), my, lp)); }, {
            color: col, width: 1.4, blur: 10, alpha: (0.55 * alive + 0.3 * dead) * appear * boardA, core: false,
          });
          if (lp >= 1) {
            const lp2 = clamp((t - T.moves - 0.45 - k * 0.16) / 0.45, 0, 1);
            glow(ctx, (c) => { c.moveTo(mx, my); c.lineTo(lerp(mx, tx, lp2), lerp(my, ty, lp2)); }, {
              color: col, width: 1.4, blur: 10, alpha: (0.55 * alive + 0.3 * dead) * appear * boardA, core: false,
            });
          }
          const ring = smooth(0, 0.6, t - T.moves - 0.5 - k * 0.16);
          if (ring > 0) {
            glow(ctx, (c) => c.arc(tx, ty, s * 0.2 + s * 0.28 * (1 - ring), 0, TAU), {
              color: dead > 0 ? '#7d8590' : AM,
              width: 1.6,
              blur: 16,
              alpha: (0.9 * alive + 0.45 * dead) * ring * boardA,
              fill: dead > 0 ? null : 'rgba(255,176,32,0.14)',
            });
            if (dead > 0.05) {
              const d = s * 0.16;
              glow(ctx, (c) => {
                c.moveTo(tx - d, ty - d); c.lineTo(tx + d, ty + d);
                c.moveTo(tx + d, ty - d); c.lineTo(tx - d, ty + d);
              }, { color: '#ff7a90', width: 1.8, blur: 10, alpha: 0.85 * dead * boardA, core: false });
            }
          }
        });

        ctx.restore();
      }

      /* ---------- 6. 收束 → 幕二 ---------- */
      const fl = 1 - clamp((t - T.flash) / 1.0, 0, 1);
      if (fl > 0) {
        glow(ctx, (c) => c.arc(W / 2, H * 0.46, 8 + 260 * (1 - fl), 0, TAU), {
          color: '#ffffff', width: 2.5, blur: 30, alpha: 0.85 * fl, core: false,
        });
      }
      const hand = smooth(T.flash + 0.5, T.flash + 1.3, t);
      if (hand > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2);
        const cx = W / 2;
        const cy = H * 0.46;
        glow(ctx, (c) => c.arc(cx, cy, 54 + 10 * pulse, 0, TAU), {
          color: CY, width: 1.4, blur: 24, alpha: 0.5 * hand, core: false,
        });
        glow(ctx, (c) => c.arc(cx, cy + 130, 18 + 4 * pulse, 0, TAU), {
          color: CY, width: 1.2, blur: 18, alpha: 0.35 * hand, core: false,
        });
      }
    },
  };
}

function drawBike(ctx, ax, ay, r, L, t, alpha) {
  if (alpha <= 0.01) return;
  const bx = ax + L;
  const bbx = ax + 0.36 * L;
  const bby = ay + 0.2 * r;
  const sx = ax - 0.06 * L;
  const sy = ay - 1.55 * r;
  const hx = bx - 0.05 * L;
  const hy = ay - 1.32 * r;

  const segs = [
    [ax, ay, bbx, bby],
    [ax, ay, sx, sy],
    [bbx, bby, sx, sy],
    [bbx, bby, hx, hy],
    [sx, sy, hx, hy],
    [hx, hy, bx, ay],
  ];
  const k = (t - 6) * 1.7;
  segs.forEach((s, i) => {
    const p = clamp((k - i * 0.55) / 1.1, 0, 1);
    if (p <= 0) return;
    glow(ctx, (c) => { c.moveTo(s[0], s[1]); c.lineTo(lerp(s[0], s[2], p), lerp(s[1], s[3], p)); }, {
      color: CY, width: 2.3, blur: 14, alpha: alpha * 0.95,
    });
  });

  const wFront = clamp((k - 3.2) / 1.0, 0, 1);
  glow(ctx, (c) => c.arc(ax, ay, r, 0, TAU), { color: CY, width: 2.2, blur: 14, alpha });
  if (wFront > 0) {
    glow(ctx, (c) => c.arc(bx, ay, r, 0, TAU), { color: CY, width: 2.2, blur: 14, alpha: alpha * wFront });
  }
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + t + (i * TAU) / 6;
    const ex = Math.cos(a);
    const ey = Math.sin(a);
    glow(ctx, (c) => {
      c.moveTo(ax, ay); c.lineTo(ax + r * 0.87 * ex, ay + r * 0.87 * ey);
      c.moveTo(bx, ay); c.lineTo(bx + r * 0.87 * ex, ay + r * 0.87 * ey);
    }, { color: CY, width: 1, blur: 6, alpha: 0.32 * alpha * (0.4 + 0.6 * wFront), core: false });
  }
  glow(ctx, (c) => { c.moveTo(hx - 17, hy + 5); c.lineTo(hx + 19, hy - 7); }, {
    color: CY, width: 2.6, blur: 12, alpha: alpha * clamp((k - 4) / 1, 0, 1),
  });
  glow(ctx, (c) => { c.moveTo(sx - 15, sy); c.lineTo(sx + 15, sy); }, {
    color: CY, width: 2.6, blur: 12, alpha: alpha * clamp((k - 3.4) / 1, 0, 1),
  });
  glow(ctx, (c) => c.arc(bbx, bby, r * 0.4, 0, TAU), {
    color: CY, width: 1.4, blur: 8, alpha: alpha * 0.85 * clamp((k - 3.8) / 1, 0, 1),
  });
  const ca = Math.PI / 2 + t;
  glow(ctx, (c) => { c.moveTo(bbx, bby); c.lineTo(bbx + r * 0.42 * Math.cos(ca), bby + r * 0.42 * Math.sin(ca)); }, {
    color: CY, width: 1.8, blur: 8, alpha: alpha * 0.7,
  });
}

function drawShuttle(ctx, x, y, ang, alpha, s = 1) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  glow(ctx, (c) => {
    c.moveTo(-3 * s, -3.4 * s);
    c.lineTo(-17 * s, -9 * s);
    c.lineTo(-17 * s, 9 * s);
    c.lineTo(-3 * s, 3.4 * s);
    c.closePath();
  }, { color: AM, width: 1.6, blur: 12, alpha: alpha * 0.95, fill: 'rgba(20,14,4,0.85)' });
  glow(ctx, (c) => c.arc(0, 0, 4.2 * s, 0, TAU), {
    color: '#fff6e2', width: 1.6, blur: 16, alpha, fill: '#ffd489',
  });
  glow(ctx, (c) => {
    c.moveTo(-6 * s, -5.6 * s); c.lineTo(-15 * s, -8.2 * s);
    c.moveTo(-6 * s, 5.6 * s); c.lineTo(-15 * s, 8.2 * s);
  }, { color: AM, width: 1, blur: 6, alpha: alpha * 0.6, core: false });
  ctx.restore();
}

function drawRacket(ctx, x, y, rot, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  glow(ctx, (c) => c.ellipse(0, -34, 19, 25, 0, 0, TAU), { color: CY, width: 1.8, blur: 10, alpha });
  glow(ctx, (c) => { c.moveTo(0, -12); c.lineTo(0, 16); c.moveTo(-7, 16); c.lineTo(7, 16); }, {
    color: CY, width: 2.4, blur: 10, alpha,
  });
  glow(ctx, (c) => c.ellipse(0, -34, 13, 18, 0, 0, TAU), {
    color: CY, width: 0.8, blur: 4, alpha: alpha * 0.4, core: false,
  });
  ctx.restore();
}
