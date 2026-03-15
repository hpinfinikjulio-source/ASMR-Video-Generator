// generator.js
// Minimal implementation providing the exported functions used by app.js
// - createMixerUI builds a simple UI to add/remove clips to tracks
// - previewMix returns a silent audio Blob of requested duration (stubs mixing quickly)
// - exportVideo records the provided canvas for duration seconds and downloads a webm
// - drawPerson draws the provided portrait asset and a simple "pile of triggers" on the desk

export function createMixerUI({ clips, clipListEl, trackContainer }) {
  const state = {
    clips,
    tracks: [],
    masterVol: 1,
  };

  // populate clip list
  clipListEl.innerHTML = "";
  clips.forEach((c) => {
    const el = document.createElement("div");
    el.className = "clip";
    el.innerHTML = `<div>${c.name}</div>`;
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      const track = { id: `${c.id}-${Date.now()}`, clip: c, vol: 1 };
      state.tracks.push(track);
      renderTracks();
    });
    el.appendChild(addBtn);
    clipListEl.appendChild(el);
  });

  function renderTracks() {
    trackContainer.innerHTML = "";
    state.tracks.forEach((t, idx) => {
      const row = document.createElement("div");
      row.className = "track-item";
      row.innerHTML = `<div style="min-width:140px">${t.clip.name}</div>`;
      const vol = document.createElement("input");
      vol.type = "range";
      vol.min = 0; vol.max = 1; vol.step = 0.01; vol.value = t.vol;
      vol.addEventListener("input", (e) => (t.vol = Number(e.target.value)));
      const rem = document.createElement("button");
      rem.textContent = "Remove";
      rem.addEventListener("click", () => {
        state.tracks.splice(idx, 1);
        renderTracks();
      });
      row.appendChild(vol);
      row.appendChild(rem);
      trackContainer.appendChild(row);
    });
  }

  renderTracks();
  return state;
}

// create a silent WAV blob durationSeconds long (simple PCM 44.1kHz mono)
function createSilentWav(durationSeconds, sampleRate = 44100) {
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, totalSamples * 2, true);

  // silence already zeroed
  return new Blob([view], { type: "audio/wav" });
}

// previewMix returns a Blob of audio (stubbed as silent WAV) for quick preview
export async function previewMix(state, { duration = 10 } = {}) {
  // In a full implementation we'd mix selected clips; this is a fast stub
  return createSilentWav(duration);
}

// exportVideo records the canvas for `duration` seconds and downloads a webm
export async function exportVideo(state, { duration = 10, canvas, bgColor = "#000" } = {}) {
  if (!canvas || typeof canvas.captureStream !== "function") {
    throw new Error("Canvas captureStream not available in this environment.");
  }

  return new Promise((resolve, reject) => {
    try {
      // ensure canvas background rendered as requested at time of capture
      const originalFill = canvas.style.background;
      canvas.style.background = bgColor;

      const stream = canvas.captureStream(30);
      // create an audio track: silent oscillator to avoid some players dropping audio track
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      // silent gain node
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      gain.connect(dest);
      const osc = audioCtx.createOscillator();
      osc.frequency.value = 0;
      osc.connect(gain);
      osc.start();

      // merge canvas stream and silent audio track
      const tracks = [...stream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const mixed = new MediaStream(tracks);

      const recorder = new MediaRecorder(mixed, { mimeType: "video/webm;codecs=vp9,opus" });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        // cleanup
        osc.stop();
        audioCtx.close();
        canvas.style.background = originalFill;
        // download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "export.webm";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        resolve(blob);
      };

      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, duration * 1000);
    } catch (err) {
      reject(err);
    }
  });
}

// drawPerson draws the portrait and a pile of triggers on a desk area
export async function drawPerson(ctx, canvas, t, actions = {}) {
  // clear already handled by caller; draw background elements here
  const W = canvas.width;
  const H = canvas.height;

  // draw portrait image centered-left
  const img = await loadImage("./download (26).jpeg").catch(() => null);
  if (img) {
    const drawW = Math.min(W * 0.45, img.width);
    const drawH = (img.height / img.width) * drawW;
    const x = 40;
    const y = 40;
    ctx.drawImage(img, x, y, drawW, drawH);
  } else {
    // fallback: simple head shape
    ctx.fillStyle = "#c6e9e6";
    ctx.fillRect(40, 40, W * 0.35, H * 0.6);
  }

  // desk area (bottom area)
  const deskY = H * 0.72;
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, deskY, W, H - deskY);

  // draw a simple pile of triggers on the desk to the right of the person
  const pileX = W * 0.55;
  const pileY = deskY - 20;
  const itemW = 36;
  let offset = 0;

  const triggerItems = [
    { key: "sponge", color: "#e6b89c" },
    { key: "brush", color: "#c4c4c4" },
    { key: "glass", color: "#bfe6ff" },
    { key: "tapping", color: "#d3a6ff" },
    { key: "micbrush", color: "#fff0b3" },
    { key: "pages", color: "#fff" },
  ];

  // if user requested specific actions, add highlight for those
  triggerItems.forEach((it, i) => {
    const x = pileX + offset;
    const y = pileY - (i * 6);
    ctx.save();
    ctx.translate(x, y);
    // simple rounded rect item
    roundRect(ctx, 0, 0, itemW, itemW * 0.7, 6);
    ctx.fillStyle = it.color;
    ctx.fill();
    // border
    ctx.strokeStyle = actions[it.key] ? "#ffd54f" : "rgba(0,0,0,0.12)";
    ctx.lineWidth = actions[it.key] ? 3 : 1;
    ctx.stroke();
    ctx.restore();
    offset += itemW * 0.62;
  });

  // small glow if transient actions present
  if (Object.values(actions).some(Boolean)) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.ellipse(pileX + 60, pileY - 10, 140, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // helper draw utils
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}