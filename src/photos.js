const EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

// 读取 photos/ 里的全部图片；读不到就用数学主题占位卡顶上。
export async function loadPhotos(dir = 'photos/') {
  // 单文件版：照片已经内嵌成 data URL
  if (window.__PHOTOS__ && window.__PHOTOS__.length) {
    const inlined = [];
    await Promise.all(
      window.__PHOTOS__.map(async (src) => {
        try {
          inlined.push({ img: await loadImage(src), src: 'inline' });
        } catch (e) {
          /* ignore */
        }
      })
    );
    if (inlined.length) return inlined;
  }
  let files = await listJson(dir); // 静态托管优先读清单（很多服务器不给目录索引）
  if (!files.length) files = await listFolder(dir);
  const loaded = [];
  await Promise.all(
    files.map(async (url) => {
      try {
        const img = await loadImage(url);
        loaded.push({ img, src: url });
      } catch (e) {
        /* 单张失败不影响整体 */
      }
    })
  );
  if (loaded.length) return loaded;
  return placeholders(12);
}

async function listFolder(dir) {
  try {
    const r = await fetch(dir);
    if (!r.ok) return [];
    const ct = r.headers.get('content-type') || '';
    if (!/html/i.test(ct)) return [];
    const html = await r.text();
    const out = new Set();
    const re = /href="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      let name = decodeURIComponent(m[1]).split('?')[0];
      name = name.replace(/^\.\//, '').split('/').pop();
      if (EXT.test(name)) out.add(dir + name);
    }
    return [...out].sort();
  } catch (e) {
    return [];
  }
}

async function listJson(dir) {
  try {
    const r = await fetch(dir + 'photos.json');
    if (!r.ok) return [];
    const j = await r.json();
    return (j.photos || j).map((n) => dir + n);
  } catch (e) {
    return [];
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/* ---------------------------------- 占位卡：数学主题的卡片，随时可替换 */
function placeholders(n) {
  const hues = [190, 40, 340, 268, 160, 22, 212, 300];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 240;
    const g = c.getContext('2d');
    const h = hues[i % hues.length];
    g.fillStyle = `hsl(${h} 42% 11%)`;
    g.fillRect(0, 0, 320, 240);
    g.strokeStyle = `hsl(${h} 92% 64%)`;
    g.fillStyle = `hsl(${h} 92% 64%)`;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.shadowColor = `hsl(${h} 92% 64%)`;
    g.shadowBlur = 10;

    switch (i % 6) {
      case 0: // 摆线
        g.beginPath();
        for (let a = 0; a < 3; a++) {
          const x0 = 40 + a * 90;
          for (let k = 0; k <= 30; k++) {
            const th = (k / 30) * Math.PI * 2;
            const x = x0 + 14 * (th - Math.sin(th));
            const y = 150 - 14 * (1 - Math.cos(th));
            k === 0 && a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
        }
        g.stroke();
        break;
      case 1: // 抛物线族
        for (let a = 0; a < 3; a++) {
          g.beginPath();
          const hi = 40 + a * 30;
          for (let k = 0; k <= 30; k++) {
            const u = k / 30;
            const x = 40 + u * 240;
            const y = 170 - 4 * hi * u * (1 - u);
            k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.stroke();
        }
        break;
      case 2: // 马步八边形
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.beginPath();
          g.arc(160 + 70 * Math.cos(a), 120 + 70 * Math.sin(a), 5, 0, Math.PI * 2);
          g.fill();
        }
        g.beginPath();
        g.arc(160, 120, 70, 0, Math.PI * 2);
        g.stroke();
        break;
      case 3: // 正弦叠加
        for (let a = 0; a < 3; a++) {
          g.beginPath();
          for (let k = 0; k <= 60; k++) {
            const x = 30 + (k / 60) * 260;
            const y = 120 + Math.sin((k / 60) * Math.PI * 2 * (a + 1)) * (34 - a * 8);
            k === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
          }
          g.stroke();
        }
        break;
      case 4: // 棋盘格点
        for (let a = 0; a <= 6; a++) {
          g.beginPath();
          g.moveTo(60 + a * 33, 60);
          g.lineTo(60 + a * 33, 180);
          g.moveTo(60, 60 + a * 20);
          g.lineTo(258, 60 + a * 20);
          g.stroke();
        }
        break;
      default: // 同心圆
        for (let a = 1; a <= 6; a++) {
          g.beginPath();
          g.arc(160, 120, a * 16, 0, Math.PI * 2);
          g.stroke();
        }
    }
    // 角标
    g.shadowBlur = 0;
    g.globalAlpha = 0.55;
    g.font = '500 13px "PingFang SC", sans-serif';
    g.fillText(String(i + 1).padStart(2, '0'), 18, 226);
    out.push({ img: c, src: 'placeholder-' + i });
  }
  return out;
}
