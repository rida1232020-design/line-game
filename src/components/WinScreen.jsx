import Confetti from "./Confetti.jsx";

// ── Win / Game Over Screen ───────────────────────────────────────────────────
export default function WinScreen({ winner, mode, aiColor, moveCount, onRestart, onMenu, lang, T }) {
  const isHuman   = !aiColor;
  const playerWon = aiColor && winner !== aiColor; // human beat AI
  const aiWon     = aiColor && winner === aiColor; // AI beat human

  const winnerColor = winner === "green" ? "#4caf50" : "#f44336";
  const winnerGlow  = winner === "green"
    ? "0 0 60px rgba(76,175,80,0.5)"
    : "0 0 60px rgba(244,67,54,0.5)";

  let headline, sub;
  if (isHuman) {
    headline = winner === "green" ? T("greenWins") : T("redWins");
    sub      = `${moveCount} ${T("movesInGame")}`;
  } else if (playerWon) {
    headline = T("youWin");
    sub      = `${moveCount} ${T("movesInGame")}`;
  } else {
    headline = T("aiWins");
    sub      = `${moveCount} ${T("movesInGame")}`;
  }

  const stars = playerWon
    ? 3
    : isHuman
    ? 2
    : 1;

  // Share result
  const handleShare = () => {
    const text = `🎮 ${T("appName")} — ${headline} (${sub})`;
    if (navigator.share) {
      navigator.share({ title: T("appName"), text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  return (
    <>
      <Confetti active={!aiWon} />
      <div style={overlay}>
        <div style={card} className="fadeInScale">
          {/* Glow ring */}
          <div style={{ ...glowRing, boxShadow: winnerGlow, borderColor: winnerColor }} />

          {/* Stars */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
            {[1, 2, 3].map(i => (
              <span
                key={i}
                className="starPop"
                style={{
                  fontSize: 32,
                  opacity: i <= stars ? 1 : 0.18,
                  animation: i <= stars ? `starPop 0.45s ${i * 0.12}s cubic-bezier(.34,1.56,.64,1) both` : "none",
                  display: "inline-block",
                }}
              >
                ⭐
              </span>
            ))}
          </div>

          {/* Piece emoji */}
          <div style={{ fontSize: 56, marginBottom: 6, lineHeight: 1 }}>
            {winner === "green" ? "🟢" : "🔴"}
          </div>

          {/* Headline */}
          <h2 className="shimmerText" style={{
            fontSize: "clamp(22px,6vw,32px)",
            fontWeight: 900,
            margin: "0 0 6px",
            fontFamily: "'Cairo','Outfit',sans-serif",
            textAlign: "center",
            background: `linear-gradient(90deg, ${winnerColor}, #fff, ${winnerColor})`,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            {headline}
          </h2>

          {/* Move count */}
          <div style={{ color: "#888", fontSize: 13, marginBottom: 22, fontFamily: "'Cairo',sans-serif" }}>
            {sub}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <button style={btnPrimary(winnerColor)} onClick={onRestart}
              onPointerDown={e => e.currentTarget.style.transform = "scale(0.96)"}
              onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}>
              🔄 {T("playAgain")}
            </button>
            <button style={btnShare} onClick={handleShare}>
              📤 {T("share")}
            </button>
            <button style={btnSecondary} onClick={onMenu}
              onPointerDown={e => e.currentTarget.style.transform = "scale(0.96)"}
              onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}>
              🏠 {T("backMenu")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(6px)",
  padding: "20px",
};

const card = {
  background: "linear-gradient(145deg,#141428,#1e1e38)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 28,
  padding: "32px 28px 28px",
  maxWidth: 380,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
  boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
  fontFamily: "'Cairo','Outfit',sans-serif",
};

const glowRing = {
  position: "absolute",
  inset: -2,
  borderRadius: 30,
  border: "2px solid transparent",
  pointerEvents: "none",
  transition: "all 0.4s",
};

const btnPrimary = (color) => ({
  width: "100%",
  padding: "13px 0",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(135deg, ${color}cc, ${color})`,
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  boxShadow: `0 4px 20px ${color}44`,
  transition: "transform 0.12s",
});

const btnShare = {
  width: "100%",
  padding: "11px 0",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#ccc",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  transition: "transform 0.12s",
};

const btnSecondary = {
  width: "100%",
  padding: "11px 0",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
  color: "#666",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  transition: "transform 0.12s",
};
