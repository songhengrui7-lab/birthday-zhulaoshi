// 吹气检测：麦克风 RMS 能量 + 过零率（吹气是宽频噪声，说话不是）
// 灵敏度可用地址栏参数调整，例如 ?blow=0.010（越小越灵敏，默认 0.016）
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let BASE_THR = 0.016;
try {
  const q = new URLSearchParams(location.search).get('blow');
  if (q) BASE_THR = parseFloat(q) || BASE_THR;
} catch (e) {
  /* ignore */
}

export function createBlow() {
  const state = {
    ready: false,
    failed: false,
    level: 0, // 平滑后的音量，用于 UI 反馈
    blowing: false,
  };

  let actx = null;
  let analyser = null;
  let buf = null;
  let started = false;
  let hold = 0;
  let base = 0.004;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      if (actx.state === 'suspended') await actx.resume();
      const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      state.ready = true;
    } catch (e) {
      state.failed = true;
      console.warn('[blow] 麦克风不可用：', e);
    }
  }

  function update(dt) {
    if (!started) {
      started = true;
      start();
    }
    if (!state.ready) {
      state.level *= 0.9;
      return;
    }
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    let zc = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sum += v * v;
      if (i > 0 && (v >= 0) !== (buf[i - 1] >= 0)) zc++;
    }
    const rms = Math.sqrt(sum / buf.length);
    const zcr = zc / buf.length;
    state.level = state.level * 0.72 + rms * 0.28;

    // 底噪基线：涨得慢、落得快
    base = base + (rms - base) * (rms < base ? 0.08 : 0.0006);
    // 阈值：可用 ?blow=0.010 之类的参数现场微调（数值越小越灵敏）
    const thr = Math.max(BASE_THR, base * 1.8);
    const noisy = zcr > 0.1; // 噪声而非纯语音
    if (rms > thr && noisy) hold += dt;
    else hold = Math.max(0, hold - dt * 2.0);

    if (hold > 0.15) state.blowing = true;
    state.need = thr;
    state.progress = clamp((state.level - base) / Math.max(1e-5, thr * 2.2 - base), 0, 1);
  }

  return { state, update };
}
