import { createMixerUI, previewMix, exportVideo, drawPerson } from "./generator.js";

/* ...existing code... */
document.addEventListener("DOMContentLoaded", () => {
  const clipListEl = document.getElementById("clipList");
  const trackContainer = document.getElementById("trackContainer");
  const previewBtn = document.getElementById("previewBtn");
  const exportBtn = document.getElementById("exportBtn");
  const durationInput = document.getElementById("duration");
  const bgColorInput = document.getElementById("bgColor");
  const masterAudio = document.getElementById("masterAudio");
  const canvas = document.getElementById("vis");
  const masterVolEl = document.getElementById("masterVol");

  const clips = [
    { id: "brush", name: "Soft Brush", src: "soft_brush.mp3" },
    { id: "tapping", name: "Finger Tapping", src: "finger_tapping.mp3" },
    { id: "rain", name: "Gentle Rain", src: "gentle_rain.mp3" },
    { id: "waves", name: "Ocean Waves", src: "ocean_waves.mp3" },
    { id: "chimes", name: "Wind Chimes", src: "wind_chimes.mp3" },
    { id: "pages", name: "Page Turns", src: "page_turns.mp3" },
    { id: "crinkle", name: "Paper Crinkles", src: "paper_crinkles.mp3" },
    { id: "brown", name: "Brown Noise", src: "brown_noise.mp3" },
    { id: "whisper", name: "Soft Whispers", src: "whisper_loop.mp3" },
    { id: "keyboard", name: "Gentle Keyboard", src: "keyboard_soft.mp3" },
    { id: "scratch", name: "Scalp Scratching", src: "scalp_scratch.mp3" },
    { id: "glass", name: "Glass Taps", src: "glass_taps.mp3" },
    { id: "micbrush", name: "Mic Foam Brushing", src: "foam_mic_brush.mp3" },
    { id: "sponge", name: "Sponge Squeezes", src: "sponge_squeezes.mp3" }
  ];

  // transient triggers: {actionId: timestampExpires}
  const transient = {};
  const triggerListEl = document.getElementById("triggerList");

  // create trigger buttons (uses same clips list; maps certain clip ids to visual actions)
  const triggerMap = {
    brush: "brush",
    tapping: "tap",
    keyboard: "keyboard",
    glass: "glass",
    sponge: "sponge",
    micbrush: "micbrush",
    whisper: "whisper",
    pages: "pages",
    crinkle: "crinkle",
    waves: "rain",
    rain: "rain",
    chimes: "rain"
  };

  const audioCtxForTriggers = new (window.AudioContext || window.webkitAudioContext)();
  async function playTrigger(src) {
    try {
      const data = await fetch(src).then((r) => r.arrayBuffer());
      const buf = await audioCtxForTriggers.decodeAudioData(data);
      const s = audioCtxForTriggers.createBufferSource();
      const g = audioCtxForTriggers.createGain();
      g.gain.value = 0.9;
      s.buffer = buf;
      s.connect(g).connect(audioCtxForTriggers.destination);
      s.start();
    } catch (e) {
      console.warn("trigger play failed", e);
    }
  }

  clips.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "trigger-btn";
    btn.textContent = c.name;
    btn.addEventListener("click", () => {
      // play immediate
      playTrigger(c.src);
      // set transient visual flag for ~900ms
      const act = triggerMap[c.id] || c.id;
      transient[act] = performance.now() + 900;
      // brief button highlight
      btn.style.opacity = "0.7";
      setTimeout(() => (btn.style.opacity = ""), 220);
    });
    triggerListEl.appendChild(btn);
  });

  const state = createMixerUI({ clips, clipListEl, trackContainer });
  state.masterVol = Number(masterVolEl.value);
  masterVolEl.addEventListener("input", () => (state.masterVol = Number(masterVolEl.value)));
  // live canvas preview animation
  const ctx = canvas.getContext("2d"); let start = performance.now();
  function loop(now){ const t=(now-start)/1000; const bg=bgColorInput.value;
    ctx.fillStyle=bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    // merge persistent track-based actions and transient trigger actions
    const nowMs = performance.now();
    // prune expired transient flags
    Object.keys(transient).forEach(k => { if (transient[k] < nowMs) delete transient[k]; });
    const actions={
      brush: state.tracks.some(t=>t.clip.id==="brush"),
      tap: state.tracks.some(t=>t.clip.id==="tapping"),
      rain: state.tracks.some(t=>t.clip.id==="rain"),
      keyboard: state.tracks.some(t=>t.clip.id==="keyboard"),
      glass: state.tracks.some(t=>t.clip.id==="glass"),
      sponge: state.tracks.some(t=>t.clip.id==="sponge"),
      micbrush: state.tracks.some(t=>t.clip.id==="micbrush"),
      whisper: state.tracks.some(t=>t.clip.id==="whisper")
    };
    // overlay transient flags
    Object.keys(transient).forEach(k => actions[k] = true);
    drawPerson(ctx, canvas, t, actions); requestAnimationFrame(loop);
  } requestAnimationFrame(loop);

  previewBtn.addEventListener("click", async () => {
    previewBtn.disabled = true;
    try {
      const audioBlob = await previewMix(state, { duration: Number(durationInput.value) });
      masterAudio.src = URL.createObjectURL(audioBlob);
      masterAudio.play();
    } finally {
      previewBtn.disabled = false;
    }
  });

  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      const duration = Number(durationInput.value);
      const bg = bgColorInput.value;
      await exportVideo(state, { duration, canvas, bgColor: bg });
    } finally {
      exportBtn.disabled = false;
    }
  });
});
/* ...existing code... */