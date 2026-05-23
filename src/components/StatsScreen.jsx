import { loadStats, resetStats } from "../store.js";
import { useState } from "react";

export default function StatsScreen({ onBack, T, lang }) {
  const [stats, setStats] = useState(loadStats);
  const dir = lang === "ar" ? "rtl" : "ltr";

  const handleReset = () => {
    resetStats();
    setStats(loadStats());
  };

  const hasData = stats.totalGames > 0;
  const greenPct = stats.totalGames > 0
    ? Math.round((stats.greenWins / stats.totalGames) * 100) : 0;
  const redPct   = stats.totalGames > 0
    ? Math.round((stats.redWins   / stats.totalGames) * 100) : 0;

  return (
    <div style={{ ...root, direction: dir }} className="scrollable">
      <div style={inner} className="fadeIn">

        {/* Header */}
        <div style={header}>
          <button style={backBtn} onClick={onBack}>{T("back")}</button>
          <h2 style={title}>📊 {T("stats")}</h2>
          <div style={{ width: 60 }} />
        </div>

        {!hasData ? (
          <div style={emptyBox}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div>
            <div style={{ color: "#555", fontSize: 14 }}>{T("noStats")}</div>
          </div>
        ) : (
          <>
            {/* Total Games */}
            <StatCard
              icon="🎮"
              label={T("totalGames")}
              value={stats.totalGames}
              accent="#6c5ce7"
            />

            {/* Bar chart */}
            <div style={chartCard}>
              <WinBar label={T("greenWinsLbl")} wins={stats.greenWins} pct={greenPct} color="#4caf50" />
              <WinBar label={T("redWinsLbl")}   wins={stats.redWins}   pct={redPct}   color="#f44336" />
            </div>

            {/* Best moves */}
            <StatCard
              icon="⚡"
              label={T("bestMoves")}
              value={stats.bestMoves !== null ? stats.bestMoves : "—"}
              accent="#ffd700"
            />
          </>
        )}

        {/* Reset */}
        <button style={resetBtn} onClick={handleReset}
          onPointerDown={e => e.currentTarget.style.transform = "scale(0.96)"}
          onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}>
          🗑️ {T("resetStats")}
        </button>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ ...card, borderColor: accent + "33" }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#666", fontSize: 12, marginBottom: 3 }}>{label}</div>
        <div style={{ color: accent, fontSize: 26, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

function WinBar({ label, wins, pct, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ color: "#aaa", fontSize: 12 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>{wins} ({pct}%)</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 99,
          transition: "width 0.6s ease",
          minWidth: pct > 0 ? 8 : 0,
        }} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const root = {
  minHeight: "100vh",
  background: "linear-gradient(160deg,#09090f 0%,#0f0f20 60%,#090f18 100%)",
  fontFamily: "'Cairo','Outfit',sans-serif",
  padding: "0 0 40px",
};
const inner = {
  maxWidth: 480,
  margin: "0 auto",
  padding: "16px 16px 0",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
};
const backBtn = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#888",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
};
const title = {
  color: "#ddd",
  fontSize: 18,
  fontWeight: 800,
  margin: 0,
};
const card = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid",
  borderRadius: 18,
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  gap: 16,
};
const chartCard = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  padding: "18px 20px",
};
const emptyBox = {
  background: "rgba(255,255,255,0.015)",
  borderRadius: 18,
  padding: "50px 20px",
  textAlign: "center",
};
const resetBtn = {
  background: "rgba(244,67,54,0.1)",
  border: "1px solid rgba(244,67,54,0.2)",
  color: "#f44336",
  borderRadius: 12,
  padding: "12px 0",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  transition: "transform 0.12s",
};
