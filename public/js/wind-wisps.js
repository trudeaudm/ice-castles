/* Delicate wind ribbons. Each wisp draws only a short trail of where it has
   just been, so a curl reads as a hook traveling with the wind. */

const WIND_WISP_DEFAULTS = {
  direction: 0,
  speed: 1,
  density: 1,
  color: '#f4fbff',
  opacity: 0.8,
  trail: 1,
  spiral: 0.25,
  paused: null,
};

function createWindWisps(canvas, settings) {
  const opts = { ...WIND_WISP_DEFAULTS, ...settings };
  const ctx = canvas.getContext('2d');
  let wisps = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = 0;
  let running = false;
  let gustIn = 2 + Math.random() * 3;

  function cssSize() {
    const rect = canvas.getBoundingClientRect();
    return {
      w: rect.width || canvas.clientWidth || 0,
      h: rect.height || canvas.clientHeight || 0,
    };
  }

  function layout() {
    const { w, h } = cssSize();
    if (w < 2 || h < 2) return false;
    const next = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * next);
    const bh = Math.round(h * next);
    if (canvas.width !== bw || canvas.height !== bh || dpr !== next) {
      canvas.width = bw;
      canvas.height = bh;
      dpr = next;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = w;
    height = h;
    return true;
  }

  function poolSize() {
    const mobile = (width || window.innerWidth) < 700;
    const base = mobile ? 5 : 8;
    const cap = mobile ? 6 : 11;
    return Math.max(3, Math.min(cap, Math.round(base * opts.density)));
  }

  function makeCurl() {
    const turns = 0.5 + Math.random();
    const radius = 22 + Math.random() * 16;
    return {
      at: 0.2 + Math.random() * 0.42,
      span: radius * (1.7 + Math.random() * 0.7),
      turns,
      radius,
      dir: Math.random() < 0.5 ? -1 : 1,
    };
  }

  function seed(w, offscreenSpan, placed) {
    w.speed = (70 + Math.random() * 55) * opts.speed;
    w.drift = 5 + Math.random() * 14;
    w.freq = 0.006 + Math.random() * 0.008;
    w.phase = Math.random() * Math.PI * 2;
    w.trail = (110 + Math.random() * 70) * opts.trail;
    w.thick = 2.1 + Math.random() * 1.4;
    w.alpha = (0.72 + Math.random() * 0.24) * opts.opacity;
    w.y = 28 + Math.random() * Math.max(40, height - 56);
    w.curl = Math.random() < opts.spiral ? makeCurl() : null;
    w.s = placed
      ? -w.trail * 0.15 + Math.random() * Math.max(120, width * 0.9)
      : -w.trail - Math.random() * offscreenSpan;
  }

  function ensurePool() {
    if (!width || !height) return;
    const n = poolSize();
    if (wisps.length > n) wisps.length = n;
    while (wisps.length < n) {
      const w = {};
      seed(w, 80, true);
      wisps.push(w);
    }
  }

  function sample(w, s) {
    const fx = Math.cos(opts.direction);
    const fy = Math.sin(opts.direction);
    let along = s;
    let across = w.drift * Math.sin(s * w.freq + w.phase);
    const curl = w.curl;
    if (curl && width) {
      const u = (s - curl.at * width) / curl.span;
      if (u > 0 && u < 1) {
        const theta = u * curl.turns * Math.PI * 2;
        const env = Math.sin(Math.PI * u);
        along += env * curl.radius * Math.sin(theta);
        across += env * curl.radius * (1 - Math.cos(theta)) * curl.dir;
      }
    }
    return {
      x: along * fx - across * fy,
      y: w.y + along * fy + across * fx,
    };
  }

  function lifeFade(w) {
    const enter = Math.min(1, Math.max(0, (w.s + w.trail * 0.15) / 80));
    const exitStart = width * 0.72;
    const exit = w.s < exitStart ? 1 : Math.max(0, 1 - (w.s - exitStart) / (width * 0.34 + 36));
    return enter * exit;
  }

  function clusterGust() {
    const waiting = wisps.filter((w) => w.s < -w.trail * 0.25);
    if (waiting.length < 2) return;
    const y = height * (0.18 + Math.random() * 0.64);
    const pace = (70 + Math.random() * 24) * opts.speed;
    waiting.slice(0, 3).forEach((w, i) => {
      w.y = y + (i - 1) * (14 + Math.random() * 12);
      w.s = -w.trail - i * (22 + Math.random() * 18);
      w.speed = pace * (0.94 + Math.random() * 0.1);
      if (Math.random() > 0.35) w.curl = null;
    });
  }

  function step(dt) {
    const limit = width + 70;
    for (const w of wisps) {
      w.s += w.speed * dt;
      if (w.s > limit) seed(w, w.speed * (0.25 + Math.random() * 0.9));
    }
    gustIn -= dt;
    if (gustIn <= 0) {
      clusterGust();
      gustIn = 5.5 + Math.random() * 5;
    }
  }

  function rgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    const a = Math.max(0, Math.min(1, alpha));
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }

  function drawWisp(w) {
    const fade = lifeFade(w);
    if (fade < 0.03) return;
    const steps = 18;
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      pts.push(sample(w, w.s - w.trail * (1 - i / steps)));
    }
    const edge = [];
    for (let i = 0; i <= steps; i += 1) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(steps, i + 1)];
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const t = i / steps;
      const taper = Math.min(1, t / 0.2);
      const half = (0.35 + w.thick * taper) * 0.5;
      edge.push({
        lx: pts[i].x - dy * half,
        ly: pts[i].y + dx * half,
        rx: pts[i].x + dy * half,
        ry: pts[i].y - dx * half,
      });
    }
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const a = fade * w.alpha * (0.22 + 0.78 * t);
      if (a < 0.02) continue;
      const p = edge[i - 1];
      const q = edge[i];
      ctx.beginPath();
      ctx.moveTo(p.lx, p.ly);
      ctx.lineTo(q.lx, q.ly);
      ctx.lineTo(q.rx, q.ry);
      ctx.lineTo(p.rx, p.ry);
      ctx.closePath();
      const lead = t > 0.8;
      const y = (pts[i].y + pts[i - 1].y) * 0.5;
      const body = y > height * 0.4 ? '#5b9ab8' : (y > height * 0.18 ? '#d7eef8' : opts.color);
      ctx.fillStyle = rgba(lead ? '#ffffff' : body, lead ? Math.min(0.95, a * 1.12) : a);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const w of wisps) drawWisp(w);
  }

  function isPaused() {
    if (document.hidden) return true;
    return typeof opts.paused === 'function' && opts.paused();
  }

  function frame(now) {
    if (!running) {
      raf = 0;
      return;
    }
    if (document.hidden) {
      raf = 0;
      return;
    }
    raf = window.requestAnimationFrame(frame);
    if (typeof opts.paused === 'function' && opts.paused()) {
      last = 0;
      return;
    }
    if (!layout()) return;
    if (!wisps.length) ensurePool();
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    draw();
  }

  function resume() {
    if (!running || raf || isPaused()) return;
    last = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      return;
    }
    resume();
  }

  function start() {
    if (running) return api;
    running = true;
    if (layout()) ensurePool();
    document.addEventListener('visibilitychange', onVisibility);
    raf = window.requestAnimationFrame(frame);
    return api;
  }

  function stop() {
    running = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    document.removeEventListener('visibilitychange', onVisibility);
    wisps = [];
  }

  function set(partial) {
    Object.assign(opts, partial);
    if (width) ensurePool();
  }

  const api = { start, stop, set, resize: layout, settings: opts };
  return api;
}
