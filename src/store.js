// ── Persistent Store (localStorage) ─────────────────────────────────────────
const SETTINGS_KEY = "goalrush_settings";
const STATS_KEY    = "goalrush_stats";

// ── Default values ───────────────────────────────────────────────────────────
const defaultSettings = {
  lang:       "en",     // "ar" | "en"
  sound:      true,     // boolean
  difficulty: "medium", // "easy" | "medium" | "hard"
};

const defaultStats = {
  totalGames:  0,
  greenWins:   0,
  redWins:     0,
  bestMoves:   null,  // lowest move count on a win
  coins:       0,
  unlockedSkins: ["classic"],
  activeSkin:  "classic",
  lastDailyClaim: 0,
  entryTickets: 0,
  unusedTicketIds: [],
};

// ── Skins Configuration ──────────────────────────────────────────────────────
export const SKINS = [
  {
    id: "classic",
    nameKey: "skinClassic",
    price: 0,
    emoji: "🟢🔴",
    green: {
      normal: ["#69bb6e", "#1a4a1a"],
      selected: ["#c8e6c9", "#1b5e20"],
      win: ["#a5d6a7", "#2e7d32"],
      accent: "#4caf50",
      emoji: "🟢"
    },
    red: {
      normal: ["#ef5350", "#5a0000"],
      selected: ["#ffcdd2", "#7f0000"],
      win: ["#ef9a9a", "#b71c1c"],
      accent: "#f44336",
      emoji: "🔴"
    }
  },
  {
    id: "gold",
    nameKey: "skinGold",
    price: 2500,
    emoji: "👑💎",
    green: {
      normal: ["#ffd700", "#e6c200"], // Golden
      selected: ["#fff59d", "#f57f17"],
      win: ["#fffde7", "#ffb300"],
      accent: "#ffd700",
      emoji: "👑"
    },
    red: {
      normal: ["#0288d1", "#01579b"], // Sapphire Blue
      selected: ["#b3e5fc", "#00b0ff"],
      win: ["#e1f5fe", "#29b6f6"],
      accent: "#0288d1",
      emoji: "💎"
    }
  },
  {
    id: "cyber",
    nameKey: "skinCyber",
    price: 4000,
    emoji: "🔮👾",
    green: {
      normal: ["#ea80fc", "#4a148c"], // Cyber Purple
      selected: ["#f8bbd0", "#8e24aa"],
      win: ["#fce4ec", "#d81b60"],
      accent: "#ea80fc",
      emoji: "🔮"
    },
    red: {
      normal: ["#00e5ff", "#006064"], // Cyber Cyan
      selected: ["#e0f7fa", "#00b8d4"],
      win: ["#e0f7fa", "#00acc1"],
      accent: "#00e5ff",
      emoji: "👾"
    }
  },
  {
    id: "soccer",
    nameKey: "skinSoccer",
    price: 6000,
    emoji: "⚽🏆",
    green: {
      normal: ["#ffffff", "#7f7f7f"], // Soccer ball white-gray
      selected: ["#ffffff", "#bbbbbb"],
      win: ["#ffffff", "#999999"],
      accent: "#ffffff",
      emoji: "⚽"
    },
    red: {
      normal: ["#ff9100", "#ff3d00"], // Flame soccer ball
      selected: ["#ffea00", "#ff3d00"],
      win: ["#ffff00", "#ff3d00"],
      accent: "#ff3d00",
      emoji: "🏆"
    }
  }
];

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
  const current = loadStats();
  saveStats({
    ...defaultStats,
    coins: current.coins ?? 0,
    unlockedSkins: current.unlockedSkins ?? ["classic"],
    activeSkin: current.activeSkin ?? "classic",
    lastDailyClaim: current.lastDailyClaim ?? 0,
  });
}

// ── Rewards ──────────────────────────────────────────────────────────────────
export function addCoins(amount) {
  const stats = loadStats();
  stats.coins = (stats.coins || 0) + amount;
  saveStats(stats);
  return stats;
}

export function unlockSkin(skinId, price) {
  const stats = loadStats();
  const coins = stats.coins || 0;
  const unlocked = stats.unlockedSkins || ["classic"];
  if (coins >= price && !unlocked.includes(skinId)) {
    stats.coins = coins - price;
    stats.unlockedSkins = [...unlocked, skinId];
    stats.activeSkin = skinId;
    saveStats(stats);
    return { success: true, stats };
  }
  return { success: false, stats };
}

export function selectSkin(skinId) {
  const stats = loadStats();
  const unlocked = stats.unlockedSkins || ["classic"];
  if (unlocked.includes(skinId)) {
    stats.activeSkin = skinId;
    saveStats(stats);
    return stats;
  }
  return null;
}

export function claimDailyReward() {
  const stats = loadStats();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const lastClaim = stats.lastDailyClaim || 0;
  if (now - lastClaim >= oneDay) {
    stats.coins = (stats.coins || 0) + 50;
    stats.lastDailyClaim = now;
    saveStats(stats);
    return { success: true, amount: 50, stats };
  }
  return { success: false, stats };
}

// ── Match Tickets Management ──────────────────────────────────────────────────
export function addTickets(amount, paymentId) {
  const stats = loadStats();
  stats.entryTickets = (stats.entryTickets || 0) + amount;
  if (paymentId) {
    stats.unusedTicketIds = [...(stats.unusedTicketIds || []), paymentId];
  }
  saveStats(stats);
  return stats;
}

export function consumeTicket() {
  const stats = loadStats();
  const unused = stats.unusedTicketIds || [];
  const ticketId = unused.length > 0 ? unused.shift() : null;
  stats.entryTickets = Math.max(0, (stats.entryTickets || 0) - 1);
  stats.unusedTicketIds = unused;
  saveStats(stats);
  return { success: true, ticketId, stats };
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
