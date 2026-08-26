// ===== $SHELLTACIO =====

const CONFIG = {
  CA: "", // paste the mint address here once the token is live — stats + copy buttons wire up automatically
  CHART_URL: "", // e.g. https://dexscreener.com/solana/<pair>
  BUY_URL: "", // e.g. https://pump.fun/<mint> or a jupiter swap link
  X_URL: "",
  TELEGRAM_URL: "",
};

document.addEventListener("DOMContentLoaded", () => {
  wireLinks();
  wireNav();
  wireCopyButtons();
  wireShellPoke();
  startEarPhysics();
  wireSound();
  spawnFlies();
  loadStats();
});

// ---------- links / CA ----------
function wireLinks() {
  const caText = CONFIG.CA || "COMING SOON — NOT MINTED YET";
  document.querySelectorAll("#caValue, #footerCaValue").forEach((el) => {
    el.textContent = caText;
  });

  const buy = CONFIG.BUY_URL || "#";
  const chart = CONFIG.CHART_URL || "#";
  const x = CONFIG.X_URL || "#";
  const tg = CONFIG.TELEGRAM_URL || "#";

  const buyBtn = document.getElementById("buyBtn");
  const chartBtn = document.getElementById("chartBtn");
  const xBtn = document.getElementById("xBtn");
  const footerX = document.getElementById("footerX");
  const footerTg = document.getElementById("footerTg");
  const footerChart = document.getElementById("footerChart");

  [buyBtn].forEach((el) => (el.href = buy));
  [chartBtn, footerChart].forEach((el) => (el.href = chart));
  [xBtn, footerX].forEach((el) => (el.href = x));
  [footerTg].forEach((el) => (el.href = tg));

  if (!CONFIG.BUY_URL) buyBtn.addEventListener("click", (e) => e.preventDefault());
  if (!CONFIG.CHART_URL) [chartBtn, footerChart].forEach((el) => el.addEventListener("click", (e) => e.preventDefault()));
  if (!CONFIG.X_URL) [xBtn, footerX].forEach((el) => el.addEventListener("click", (e) => e.preventDefault()));
  if (!CONFIG.TELEGRAM_URL) footerTg.addEventListener("click", (e) => e.preventDefault());
}

function wireCopyButtons() {
  const pairs = [
    ["caCopy", "caValue"],
    ["footerCaCopy", "footerCaValue"],
  ];
  pairs.forEach(([btnId, valId]) => {
    const btn = document.getElementById(btnId);
    const val = document.getElementById(valId);
    btn.addEventListener("click", async () => {
      if (!CONFIG.CA) return;
      try {
        await navigator.clipboard.writeText(CONFIG.CA);
        const original = btn.textContent;
        btn.textContent = "copied!";
        setTimeout(() => (btn.textContent = original), 1400);
      } catch (e) {
        /* clipboard unavailable, ignore */
      }
    });
  });
}

// ---------- nav ----------
function wireNav() {
  const hamburger = document.getElementById("hamburger");
  const links = document.getElementById("navLinks");
  hamburger.addEventListener("click", () => links.classList.toggle("open"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("open"))
  );
}

// ---------- shell poke ----------
let pokeCount = 0;
function wireShellPoke() {
  const frame = document.getElementById("mascotFrame");
  const counter = document.getElementById("crackCounter");
  let flashTimeout = null;

  function poke() {
    frame.classList.add("flash");
    clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => frame.classList.remove("flash"), 150);

    playSnap();
    kickEars();

    pokeCount++;
    counter.textContent = `poked ${pokeCount} time${pokeCount === 1 ? "" : "s"} today`;
  }

  frame.addEventListener("click", poke);
  frame.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      poke();
    }
  });
}

// ---------- shell ear physics — spring-driven, so the chatter never repeats ----------
// Each ear is a damped spring chasing a slowly drifting "idle sway" target built from
// a few layered sine waves (different frequencies/phases per ear so they never sync up),
// plus occasional short amplitude "bursts" for a nervous chatter. A click adds a velocity
// impulse to both ears in opposite directions — the spring naturally overshoots and rings
// down, which reads as a much more physical "snap" than a fixed CSS keyframe ever could.
const EAR_STIFFNESS = 145;
const EAR_DAMPING = 10.5;

const earState = {
  left: { angle: 0, vel: 0, phase: Math.random() * 10, sign: -1, burstUntil: 0, nextBurst: 1.5 + Math.random() * 2.5 },
  right: { angle: 0, vel: 0, phase: Math.random() * 10 + 4, sign: 1, burstUntil: 0, nextBurst: 2.5 + Math.random() * 3 },
};

function earIdleTarget(state, t) {
  const sway =
    Math.sin(t * 0.5 + state.phase) * 1.1 +
    Math.sin(t * 1.25 + state.phase * 1.6) * 0.5 +
    Math.sin(t * 2.8 + state.phase * 0.4) * 0.22;
  const burstActive = t < state.burstUntil;
  const amp = burstActive ? 3 : 1;
  return sway * amp * state.sign;
}

function earUpdateSpring(state, target, dt) {
  const accel = -EAR_STIFFNESS * (state.angle - target) - EAR_DAMPING * state.vel;
  state.vel += accel * dt;
  state.angle += state.vel * dt;
}

function startEarPhysics() {
  const earLeftEl = document.getElementById("earLeft");
  const earRightEl = document.getElementById("earRight");
  if (!earLeftEl || !earRightEl) return;

  let last = performance.now();

  function step(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;

    [earState.left, earState.right].forEach((state) => {
      if (t > state.nextBurst && t > state.burstUntil) {
        state.burstUntil = t + 0.45 + Math.random() * 0.55;
        state.nextBurst = t + 4 + Math.random() * 7;
      }
    });

    earUpdateSpring(earState.left, earIdleTarget(earState.left, t), dt);
    earUpdateSpring(earState.right, earIdleTarget(earState.right, t), dt);

    earLeftEl.style.transform = `rotate(${earState.left.angle.toFixed(2)}deg)`;
    earRightEl.style.transform = `rotate(${earState.right.angle.toFixed(2)}deg)`;

    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function kickEars() {
  earState.left.vel -= 640;
  earState.right.vel += 640;
}

// ---------- sound (ambient buzz + snap click), off by default ----------
let audioCtx = null;
let soundOn = false;
let buzzNodes = [];

function wireSound() {
  const btn = document.getElementById("soundToggle");
  btn.addEventListener("click", () => {
    soundOn = !soundOn;
    btn.textContent = soundOn ? "🔊" : "🔇";
    if (soundOn) startBuzz();
    else stopBuzz();
  });
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function startBuzz() {
  const ctx = ensureAudio();
  if (!ctx) return;
  stopBuzz();
  const freqs = [182, 205, 168];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = "sawtooth";
    osc.frequency.value = f + Math.random() * 6;
    gain.gain.value = 0.012;
    osc.connect(gain);
    if (pan) {
      pan.pan.value = -0.6 + i * 0.6;
      gain.connect(pan);
      pan.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }
    osc.start();
    buzzNodes.push({ osc, gain, pan });
  });
}

function stopBuzz() {
  buzzNodes.forEach(({ osc }) => {
    try {
      osc.stop();
    } catch (e) {}
  });
  buzzNodes = [];
}

function playSnap() {
  if (!soundOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(420, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.09);
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.11);
}

// ---------- flies ----------
const FLY_SVG = `
<svg viewBox="0 0 16 12" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="wing wing-l" cx="6" cy="4" rx="4.5" ry="2.6" fill="rgba(20,20,20,0.28)"/>
  <ellipse class="wing wing-r" cx="10" cy="4" rx="4.5" ry="2.6" fill="rgba(20,20,20,0.28)"/>
  <ellipse cx="8" cy="6.5" rx="3.4" ry="2.6" fill="#161412"/>
  <circle cx="8" cy="4.4" r="1.7" fill="#161412"/>
</svg>`;

function spawnFlies() {
  const layer = document.getElementById("fliesLayer");
  const isMobile = window.innerWidth < 700;
  const count = isMobile ? 16 : 30;
  const flies = [];

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "fly";
    // size variance: a handful of "close" big flies, mostly smaller "far" ones —
    // reads as a much fuller swarm without every fly looking identical
    const scale = Math.random() < 0.25 ? 1.3 + Math.random() * 0.5 : 0.65 + Math.random() * 0.55;
    el.style.setProperty("--scale", scale.toFixed(2));
    el.innerHTML = FLY_SVG;
    layer.appendChild(el);
    flies.push(makeFly(el));
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(now - last, 60);
    last = now;
    flies.forEach((f) => f.step(dt));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function makeFly(el) {
  const vw = () => window.innerWidth;
  const vh = () => window.innerHeight + Math.max(document.body.scrollHeight - window.innerHeight, 0);

  let pos = { x: Math.random() * vw(), y: Math.random() * vh() };
  let target = pickTarget();
  let speed = 0.045 + Math.random() * 0.05; // px per ms
  let pauseUntil = 0;
  let angle = 0;

  function pickTarget() {
    // occasionally bias toward the hero mascot area near top of page
    const heroBias = Math.random() < 0.35;
    const heroEl = document.getElementById("mascotFrame");
    if (heroBias && heroEl) {
      const r = heroEl.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      return {
        x: r.left + r.width * (0.2 + Math.random() * 0.6),
        y: scrollY + r.top + r.height * (0.05 + Math.random() * 0.5),
      };
    }
    return { x: Math.random() * vw(), y: Math.random() * vh() };
  }

  function step(dt) {
    const now = performance.now();
    if (now < pauseUntil) {
      el.style.transform = `translate(${pos.x}px, ${pos.y - (window.scrollY || 0)}px) rotate(${angle}deg) scale(var(--scale, 1))`;
      return;
    }

    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 14) {
      if (Math.random() < 0.4) {
        pauseUntil = now + 300 + Math.random() * 900;
      }
      target = pickTarget();
    } else {
      const wob = Math.sin(now / 90 + pos.x) * 0.6;
      const nx = dx / dist;
      const ny = dy / dist;
      pos.x += (nx + wob * -ny) * speed * dt;
      pos.y += (ny + wob * nx) * speed * dt;
      angle = (Math.atan2(ny, nx) * 180) / Math.PI;
    }

    const screenY = pos.y - (window.scrollY || window.pageYOffset || 0);
    el.style.transform = `translate(${pos.x}px, ${screenY}px) rotate(${angle}deg) scale(var(--scale, 1))`;
  }

  return { step };
}

// ---------- live stats (Dexscreener) ----------
async function loadStats() {
  if (!CONFIG.CA) return; // placeholder note stays as-is until minted

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONFIG.CA}`);
    const data = await res.json();
    const pair = data && data.pairs && data.pairs[0];
    if (!pair) return;

    const fmt = (n, opts) =>
      typeof n === "number" ? n.toLocaleString(undefined, opts) : "—";

    document.getElementById("statPrice").textContent = pair.priceUsd
      ? `$${Number(pair.priceUsd).toFixed(6)}`
      : "—";
    document.getElementById("statMcap").textContent = pair.fdv
      ? `$${fmt(Math.round(pair.fdv))}`
      : "—";
    document.getElementById("statLiq").textContent = pair.liquidity && pair.liquidity.usd
      ? `$${fmt(Math.round(pair.liquidity.usd))}`
      : "—";
    document.getElementById("statChange").textContent = pair.priceChange && typeof pair.priceChange.h24 === "number"
      ? `${pair.priceChange.h24 > 0 ? "+" : ""}${pair.priceChange.h24.toFixed(1)}%`
      : "—";

    document.getElementById("sightingsNote").textContent =
      "He's been spotted. He's out of the bowl. Numbers update live from Dexscreener.";
  } catch (e) {
    document.getElementById("sightingsNote").textContent =
      "Sightings log is quiet right now. Check the chart directly.";
  }
}
