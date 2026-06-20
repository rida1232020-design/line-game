import { useState, useEffect } from "react";
import { SKINS, claimDailyReward, unlockSkin, selectSkin, addCoins } from "../store.js";
import { Sounds } from "../sounds.js";

export default function RewardsScreen({ onBack, T, lang, stats, onUpdateStats, sound }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [msg, setMsg] = useState({ text: "", isError: false });
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [canClaim, setCanClaim] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Play click helper
  const playClick = () => {
    if (sound) Sounds.click();
  };

  // Play success helper
  const playSuccess = () => {
    if (sound) Sounds.win();
  };

  // Update Daily Claim countdown
  useEffect(() => {
    const checkClaimStatus = () => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const lastClaim = stats.lastDailyClaim || 0;
      const diff = now - lastClaim;

      if (diff >= oneDay) {
        setCanClaim(true);
        setTimeLeftStr("");
      } else {
        setCanClaim(false);
        const rem = oneDay - diff;
        const hrs = Math.floor(rem / (3600 * 1000));
        const mins = Math.floor((rem % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((rem % (60 * 1000)) / 1000);
        
        const pad = (n) => String(n).padStart(2, "0");
        setTimeLeftStr(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
      }
    };

    checkClaimStatus();
    const timer = setInterval(checkClaimStatus, 1000);
    return () => clearInterval(timer);
  }, [stats.lastDailyClaim]);

  // Alert message automatic clear
  useEffect(() => {
    if (msg.text) {
      const t = setTimeout(() => setMsg({ text: "", isError: false }), 4000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  const handleClaimDaily = () => {
    playClick();
    if (!canClaim) return;
    const res = claimDailyReward();
    if (res.success) {
      onUpdateStats(res.stats);
      playSuccess();
      setMsg({ text: `+50 💎 ${T("unlockSuccess") ? "Claimed" : "Claimed"}`, isError: false });
    }
  };

  const handleUnlock = (skinId, price) => {
    playClick();
    const res = unlockSkin(skinId, price);
    if (res.success) {
      onUpdateStats(res.stats);
      playSuccess();
      setMsg({ text: T("unlockSuccess"), isError: false });
    } else {
      setMsg({ text: T("notEnoughCoins"), isError: true });
    }
  };

  const handleSelect = (skinId) => {
    playClick();
    const res = selectSkin(skinId);
    if (res) {
      onUpdateStats(res);
    }
  };

  // ── Pi Network Payment Flow ────────────────────────────────────────────────
  const handleBuyGemsWithPi = async () => {
    playClick();
    
    // Check if running inside Pi Browser environment
    if (!window.Pi) {
      console.warn("Pi SDK not detected. Simulating Sandbox developer purchase...");
      setIsPurchasing(true);
      
      setTimeout(() => {
        const res = addCoins(250);
        onUpdateStats(res);
        playSuccess();
        setMsg({ text: `💎 +250 ${T("unlockSuccess")}`, isError: false });
        setIsPurchasing(false);
      }, 1500);
      return;
    }

    setIsPurchasing(true);
    try {
      const paymentData = {
        amount: 0.1, // 0.1 Pi
        memo: "Purchase 250 Gems - Goal Rush Line Game",
        metadata: { gemsAmount: 250 },
      };

      const callbacks = {
        onReadyForServerApproval: async (paymentId) => {
          console.log("Ready for server approval. PaymentId:", paymentId);
          
          // Request secure Edge Function to sign and approve payment
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pi-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ action: "approve", paymentId })
          });
          
          if (!response.ok) {
            throw new Error("Backend payment approval failed.");
          }
          console.log("Payment approved successfully on backend.");
        },
        
        onReadyForServerCompletion: async (paymentId, txid) => {
          console.log("Ready for server completion. PaymentId:", paymentId, "TxId:", txid);
          
          // Request secure Edge Function to submit completion to blockchain
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pi-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ action: "complete", paymentId, txid })
          });
          
          if (!response.ok) {
            throw new Error("Backend payment completion failed.");
          }
          console.log("Payment completed successfully on backend.");
          
          // Credit balance locally
          const res = addCoins(250);
          onUpdateStats(res);
          playSuccess();
          setMsg({ text: `💎 +250 ${T("unlockSuccess")}`, isError: false });
          setIsPurchasing(false);
        },
        
        onCancel: (paymentId) => {
          console.log("Payment cancelled. PaymentId:", paymentId);
          setMsg({ text: lang === "ar" ? "تم إلغاء عملية الدفع." : "Payment cancelled.", isError: true });
          setIsPurchasing(false);
        },
        
        onError: (error, payment) => {
          console.error("Payment error:", error, payment);
          setMsg({ text: (lang === "ar" ? "فشلت عملية الدفع: " : "Payment failed: ") + (error.message || "Error"), isError: true });
          setIsPurchasing(false);
        }
      };

      // Trigger native SDK dialog
      window.Pi.createPayment(paymentData, callbacks);
      
    } catch (err) {
      console.error("Payment setup failed:", err);
      setMsg({ text: lang === "ar" ? "فشل بدء الدفع." : "Payment initialization failed.", isError: true });
      setIsPurchasing(false);
    }
  };

  const currentCoins = stats.coins || 0;
  const unlockedSkins = stats.unlockedSkins || ["classic"];
  const activeSkin = stats.activeSkin || "classic";

  return (
    <div style={{ ...root, direction: dir }} className="scrollable">
      <div style={inner} className="fadeIn">
        
        {/* Header */}
        <div style={header}>
          <button style={backBtn} onClick={() => { playClick(); onBack(); }}>{T("back")}</button>
          <h2 style={title}>{T("rewardsStore")}</h2>
          <div style={{ width: 60 }} />
        </div>

        {/* Feedback Message */}
        {msg.text && (
          <div style={{
            ...alertBanner,
            background: msg.isError ? "rgba(244,67,54,0.15)" : "rgba(76,175,80,0.15)",
            borderColor: msg.isError ? "rgba(244,67,54,0.3)" : "rgba(76,175,80,0.3)",
            color: msg.isError ? "#ff8a80" : "#a5d6a7"
          }}>
            {msg.text}
          </div>
        )}

        {/* Gems Balance Card */}
        <div style={balanceCard}>
          <span style={{ fontSize: 38 }}>💎</span>
          <div>
            <div style={balanceLbl}>{T("yourCoins")}</div>
            <div style={balanceVal}>{currentCoins}</div>
          </div>
        </div>

        {/* Daily Reward Card */}
        <div style={dailyCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={dailyTitle}>🎁 {T("dailyReward")}</div>
              <div style={dailyBonus}>+50 Gems 💎</div>
            </div>
            {canClaim ? (
              <button style={claimBtn} onClick={handleClaimDaily} className="pulse-btn">
                {T("claim")}
              </button>
            ) : (
              <div style={countdownBox}>
                <span style={countdownLbl}>{T("nextClaim")}</span>
                <span style={countdownTime}>{timeLeftStr}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pi Network Gems Purchase Section */}
        <div style={dailyCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={dailyTitle}>💎 {T("buyGems")}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 3, lineHeight: 1.4 }}>
                {T("gemsPkgDesc")}
              </div>
            </div>
            <button
              style={buyWithPiBtn(isPurchasing)}
              onClick={handleBuyGemsWithPi}
              disabled={isPurchasing}
              className={isPurchasing ? "" : "pulse-btn"}
            >
              {isPurchasing ? T("processing") : T("buyWithPi")}
            </button>
          </div>
        </div>

        {/* Skins Title */}
        <h3 style={sectionTitle}>🎨 {T("skins")}</h3>

        {/* Skins Grid */}
        <div style={skinsGrid}>
          {SKINS.map(skin => {
            const isUnlocked = unlockedSkins.includes(skin.id);
            const isActive = activeSkin === skin.id;
            
            return (
              <div key={skin.id} style={{
                ...skinCard,
                borderColor: isActive ? "rgba(255, 215, 0, 0.4)" : "rgba(255, 255, 255, 0.08)",
                background: isActive ? "rgba(255, 215, 0, 0.03)" : "rgba(255, 255, 255, 0.02)"
              }}>
                <div style={skinHeader}>
                  <span style={skinName}>{T(skin.nameKey)}</span>
                  <span style={skinEmoji}>{skin.emoji}</span>
                </div>
                
                {/* Visual Preview */}
                <SkinPreview skin={skin} />

                {/* Actions */}
                <div style={{ marginTop: 12 }}>
                  {isActive ? (
                    <button style={selectedBtn} disabled>
                      ✓ {T("used")}
                    </button>
                  ) : isUnlocked ? (
                    <button style={useBtn} onClick={() => handleSelect(skin.id)}>
                      {T("use")}
                    </button>
                  ) : (
                    <button style={buyBtn(currentCoins >= skin.price)} onClick={() => handleUnlock(skin.id, skin.price)}>
                      💎 {skin.price} {T("buy")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Sub-component for Skin Preview ──────────────────────────────────────────
function SkinPreview({ skin }) {
  const gNormal = skin.green.normal;
  const rNormal = skin.red.normal;
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "14px 0" }}>
      {/* Green Piece Preview */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: `radial-gradient(circle at 33% 28%, ${gNormal[0]}, ${gNormal[1]})`,
        border: `2.5px solid ${skin.green.accent}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 14px rgba(0,0,0,0.4)",
        position: "relative"
      }}>
        <div style={{
          position: "absolute",
          top: 5,
          left: 5,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.3)"
        }} />
        {skin.id !== "classic" && (
          <span style={{ fontSize: 16, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
            {skin.green.emoji}
          </span>
        )}
      </div>

      {/* Red Piece Preview */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: `radial-gradient(circle at 33% 28%, ${rNormal[0]}, ${rNormal[1]})`,
        border: `2.5px solid ${skin.red.accent}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 14px rgba(0,0,0,0.4)",
        position: "relative"
      }}>
        <div style={{
          position: "absolute",
          top: 5,
          left: 5,
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.3)"
        }} />
        {skin.id !== "classic" && (
          <span style={{ fontSize: 16, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
            {skin.red.emoji}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const root = {
  minHeight: "100vh",
  background: "linear-gradient(160deg,#07070d 0%,#0e0e1c 60%,#070d15 100%)",
  fontFamily: "'Cairo','Outfit',sans-serif",
  padding: "0 0 50px",
  color: "#fff",
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
  color: "#aaa",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  transition: "all 0.2s"
};

const title = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 800,
  margin: 0,
};

const balanceCard = {
  background: "rgba(255, 215, 0, 0.04)",
  border: "1px solid rgba(255, 215, 0, 0.15)",
  borderRadius: 20,
  padding: "20px 24px",
  display: "flex",
  alignItems: "center",
  gap: 20,
  boxShadow: "0 10px 30px rgba(255,215,0,0.02)"
};

const balanceLbl = {
  color: "#888",
  fontSize: 12,
  marginBottom: 2
};

const balanceVal = {
  color: "#ffd700",
  fontSize: 32,
  fontWeight: 900,
  textShadow: "0 0 15px rgba(255,215,0,0.3)"
};

const alertBanner = {
  border: "1px solid",
  borderRadius: 12,
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
  animation: "fadeIn 0.2s ease"
};

const dailyCard = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 20,
  padding: "20px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
};

const dailyTitle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#eee"
};

const dailyBonus = {
  fontSize: 18,
  fontWeight: 900,
  color: "#4caf50",
  marginTop: 3,
  textShadow: "0 0 10px rgba(76,175,80,0.2)"
};

const claimBtn = {
  background: "linear-gradient(135deg, #4caf50, #2e7d32)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "10px 22px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 4px 15px rgba(76,175,80,0.3)",
  fontFamily: "'Cairo',sans-serif",
  transition: "transform 0.1s"
};

const countdownBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end"
};

const countdownLbl = {
  fontSize: 10,
  color: "#666"
};

const countdownTime = {
  fontSize: 16,
  fontWeight: 700,
  color: "#ff9800",
  fontFamily: "monospace",
  marginTop: 2
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: 800,
  color: "#ccc",
  margin: "10px 0 2px"
};

const skinsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
};

const skinCard = {
  border: "1px solid",
  borderRadius: 20,
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
  transition: "all 0.3s ease"
};

const skinHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const skinName = {
  fontSize: 14,
  fontWeight: 700,
  color: "#eee"
};

const skinEmoji = {
  fontSize: 18
};

const selectedBtn = {
  width: "100%",
  padding: "10px 0",
  borderRadius: 12,
  border: "1px solid rgba(255, 215, 0, 0.3)",
  background: "rgba(255, 215, 0, 0.1)",
  color: "#ffd700",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "'Cairo',sans-serif",
};

const useBtn = {
  width: "100%",
  padding: "10px 0",
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.05)",
  color: "#eee",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Cairo',sans-serif",
  transition: "background 0.2s"
};

const buyBtn = (canAfford) => ({
  width: "100%",
  padding: "10px 0",
  borderRadius: 12,
  border: "none",
  background: canAfford
    ? "linear-gradient(135deg, #1565c0, #0d47a1)"
    : "rgba(255,255,255,0.05)",
  color: canAfford ? "#fff" : "#666",
  fontSize: 13,
  fontWeight: 700,
  cursor: canAfford ? "pointer" : "default",
  fontFamily: "'Cairo',sans-serif",
  boxShadow: canAfford ? "0 4px 15px rgba(21,101,192,0.3)" : "none",
  transition: "all 0.2s",
  opacity: canAfford ? 1 : 0.6
});

const buyWithPiBtn = (loading) => ({
  background: "linear-gradient(135deg, #ffd700, #ff8f00)",
  color: "#050508",
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  fontSize: 13,
  fontWeight: 800,
  cursor: loading ? "default" : "pointer",
  boxShadow: "0 4px 15px rgba(255,215,0,0.3)",
  fontFamily: "'Cairo',sans-serif",
  transition: "all 0.2s",
  opacity: loading ? 0.6 : 1,
  minWidth: 120
});
