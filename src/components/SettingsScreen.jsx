import { saveSettings } from "../store.js";

const DIFFICULTIES = ["easy", "medium", "hard"];
const LANGS        = ["ar", "en"];

export default function SettingsScreen({ settings, onUpdate, onBack, T }) {
  const { lang, sound, difficulty } = settings;
  const dir = lang === "ar" ? "rtl" : "ltr";

  function update(key, val) {
    const next = { ...settings, [key]: val };
    onUpdate(next);
    saveSettings(next);
  }

  return (
    <div style={{ ...root, direction: dir }} className="scrollable">
      <div style={inner} className="fadeIn">

        {/* Header */}
        <div style={header}>
          <button style={backBtn} onClick={onBack}>{T("back")}</button>
          <h2 style={title}>⚙️ {T("settings")}</h2>
          <div style={{ width: 60 }} />
        </div>

        {/* Language */}
        <Section label={`🌐 ${T("language")}`}>
          <ToggleGroup
            options={LANGS.map(l => ({ value: l, label: l === "ar" ? "🇮🇶 العربية" : "🇬🇧 English" }))}
            selected={lang}
            onSelect={v => update("lang", v)}
          />
        </Section>

        {/* Sound */}
        <Section label={`🔊 ${T("sound")}`}>
          <ToggleGroup
            options={[
              { value: "on",  label: `✅ ${T("on")}`  },
              { value: "off", label: `❌ ${T("off")}` },
            ]}
            selected={sound ? "on" : "off"}
            onSelect={v => update("sound", v === "on")}
          />
        </Section>

        {/* Difficulty */}
        <Section label={`🤖 ${T("difficulty")}`}>
          <ToggleGroup
            options={DIFFICULTIES.map(d => ({
              value: d,
              label: d === "easy"   ? `🟢 ${T("easy")}`
                   : d === "medium" ? `🟡 ${T("medium")}`
                   :                  `🔴 ${T("hard")}`,
            }))}
            selected={difficulty}
            onSelect={v => update("difficulty", v)}
          />
        </Section>

        {/* Info box */}
        <div style={infoBox}>
          <div style={{ color: "#888", fontSize: 12, lineHeight: 1.7 }}>
            {T("difficulty") === "AI Difficulty"
              ? "🟢 Easy: AI plays randomly  •  🟡 Medium: Balanced AI  •  🔴 Hard: Near-perfect AI"
              : "🟢 سهل: الذكاء الاصطناعي عشوائي  •  🟡 متوسط: متوازن  •  🔴 صعب: ذكاء اصطناعي كامل"}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={section}>
      <div style={sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

function ToggleGroup({ options, selected, onSelect }) {
  return (
    <div style={toggleRow}>
      {options.map(opt => (
        <button
          key={opt.value}
          style={{
            ...toggleBtn,
            background: selected === opt.value
              ? "rgba(255,255,255,0.14)"
              : "rgba(255,255,255,0.03)",
            color: selected === opt.value ? "#fff" : "#666",
            border: selected === opt.value
              ? "1px solid rgba(255,255,255,0.22)"
              : "1px solid rgba(255,255,255,0.07)",
            fontWeight: selected === opt.value ? 700 : 400,
          }}
          onClick={() => onSelect(opt.value)}
          onPointerDown={e => e.currentTarget.style.transform = "scale(0.96)"}
          onPointerUp={e => e.currentTarget.style.transform = "scale(1)"}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
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
  gap: 18,
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
  transition: "transform 0.12s",
};
const title = {
  color: "#ddd",
  fontSize: 18,
  fontWeight: 800,
  margin: 0,
};
const section = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  padding: "16px 16px 18px",
};
const sectionLabel = {
  color: "#aaa",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 12,
  letterSpacing: 0.3,
};
const toggleRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};
const toggleBtn = {
  flex: 1,
  minWidth: 80,
  padding: "10px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "'Cairo',sans-serif",
  transition: "all 0.18s",
  textAlign: "center",
};
const infoBox = {
  background: "rgba(255,255,255,0.015)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 14,
  padding: "14px 16px",
};
