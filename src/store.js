// ── Persistent Store (localStorage) ─────────────────────────────────────────
const SETTINGS_KEY = "goalrush_settings";
const STATS_KEY    = "goalrush_stats";

// ── Default values ───────────────────────────────────────────────────────────
const defaultSettings = {
  lang:       "ar",     // "ar" | "en"
  sound:      true,     // boolean
  difficulty: "medium", // "easy" | "medium" | "hard"
};

const defaultStats = {
  totalGames:  0,
  greenWins:   0,
  redWins:     0,
  bestMoves:   null,  // lowest move count on a win
};

// ── Settings ─────────────────────────────────────────────────────────────────
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch (_) {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

// ── Stats ────────────────────────────────────────────────────────────────────
export function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : { ...defaultStats };
  } catch (_) {
    return { ...defaultStats };
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (_) {}
}

export function recordWin(winner, moveCount) {
  const stats = loadStats();
  stats.totalGames += 1;
  if (winner === "green") stats.greenWins += 1;
  else                    stats.redWins   += 1;
  if (stats.bestMoves === null || moveCount < stats.bestMoves) {
    stats.bestMoves = moveCount;
  }
  saveStats(stats);
  return stats;
}

export function resetStats() {
  saveStats({ ...defaultStats });
}

// ── Difficulty → AI depth ────────────────────────────────────────────────────
export function difficultyToDepth(difficulty) {
  switch (difficulty) {
    case "easy":   return 1;
    case "hard":   return 6;
    case "medium":
    default:       return 4;
  }
}
