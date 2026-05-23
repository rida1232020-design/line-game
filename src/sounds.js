// ── Sound Engine (Web Audio API — no external files needed) ──────────────────
let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function playTone({ freq = 440, type = "sine", duration = 0.12, gain = 0.18, decay = 0.08 } = {}) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();
    osc.connect(gainNode);
    gainNode.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    gainNode.gain.setValueAtTime(gain, ac.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration + decay);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration + decay);
  } catch (_) {}
}

function playChord(freqs, options = {}) {
  freqs.forEach(f => playTone({ freq: f, ...options }));
}

// ── Public Sound API ─────────────────────────────────────────────────────────
export const Sounds = {
  // Selecting a piece
  select() {
    playTone({ freq: 660, type: "sine", duration: 0.06, gain: 0.12, decay: 0.04 });
  },

  // Moving a piece to a node
  move() {
    playTone({ freq: 440, type: "triangle", duration: 0.08, gain: 0.14, decay: 0.06 });
    setTimeout(() => playTone({ freq: 550, type: "triangle", duration: 0.06, gain: 0.1, decay: 0.04 }), 70);
  },

  // Clicking a button
  click() {
    playTone({ freq: 520, type: "sine", duration: 0.05, gain: 0.1, decay: 0.03 });
  },

  // Deselect / invalid move
  deselect() {
    playTone({ freq: 280, type: "sine", duration: 0.06, gain: 0.08, decay: 0.04 });
  },

  // Win fanfare — uplifting chord sequence
  win() {
    const times = [0, 100, 200, 340, 500, 680];
    const notes = [523, 659, 784, 1047, 784, 1047];
    times.forEach((t, i) => {
      setTimeout(() => {
        playTone({ freq: notes[i], type: "sine", duration: 0.18, gain: 0.22, decay: 0.15 });
        if (i === 5) {
          playChord([notes[i], notes[i] * 1.25], { type: "sine", duration: 0.4, gain: 0.15, decay: 0.3 });
        }
      }, t);
    });
  },

  // Lose sound — descending
  lose() {
    const times = [0, 130, 280];
    const notes = [440, 349, 262];
    times.forEach((t, i) => {
      setTimeout(() => {
        playTone({ freq: notes[i], type: "sawtooth", duration: 0.15, gain: 0.12, decay: 0.1 });
      }, t);
    });
  },

  // AI thinking start
  thinkStart() {
    playTone({ freq: 330, type: "sine", duration: 0.05, gain: 0.05, decay: 0.03 });
  },
};
