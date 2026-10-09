import React from "react";
import { DOSHA_DATA } from "../../services/jathagamDoshaData";

export const SAMPLE_ACTIVE_DOSHAS: Record<string, string | null> = {
  mars: "மிதமான தோஷம்",
  kalasarpa: null, // null / absent = not present for this user
  pitru: null,
  guruchandala: null,
};

const UI_TEXT = {
  ta: { doshaTitle: "தோஷ பரிசீலனை", remedyTitle: "பரிகாரங்கள்", noDosha: "தோஷம் இல்லை", goodStatus: "நல்ல நிலை" },
  en: { doshaTitle: "Dosha Analysis", remedyTitle: "Remedies", noDosha: "Not present", goodStatus: "Favourable" },
  hi: { doshaTitle: "दोष विश्लेषण", remedyTitle: "उपाय", noDosha: "अनुपस्थित", goodStatus: "शुभ स्थिति" },
};

export interface DoshaAnalysisCardsProps {
  lang?: 'ta' | 'en' | 'hi';
  activeDoshas?: Record<string, string | null>;
}

/** PAGE 1 component — dosha status cards */
export function DoshaAnalysisCards({ lang = "en", activeDoshas = SAMPLE_ACTIVE_DOSHAS }: DoshaAnalysisCardsProps) {
  const ui = UI_TEXT[lang] || UI_TEXT.en;
  return (
    <div>
      <h2 style={{ color: "#7a1f1f", fontSize: 18, marginBottom: 8 }}>{ui.doshaTitle}</h2>
      {(Object.keys(DOSHA_DATA) as Array<keyof typeof DOSHA_DATA>).map((key) => {
        const d = DOSHA_DATA[key];
        const severity = activeDoshas[key];
        return (
          <div key={key} style={{ borderLeft: "4px solid #7a1f1f", background: "#fffaf0", borderRadius: 4, padding: "8px 10px", marginBottom: 8 }}>
            <span style={{ color: "#7a1f1f", fontWeight: 700 }}>{d.name[lang] || d.name.en}</span>{" "}
            <span style={{ color: "#2d5a3d", fontWeight: 600, fontSize: 13 }}>{severity || ui.noDosha}</span>
            <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{d.symptoms[lang] || d.symptoms.en}</div>
          </div>
        );
      })}
    </div>
  );
}

export interface RemediesBlockProps {
  lang?: 'ta' | 'en' | 'hi';
  activeDoshas?: Record<string, string | null>;
}

/** PAGE 3 component — remedy text for only the ACTIVE doshas, at the bottom of the page */
export function RemediesBlock({ lang = "en", activeDoshas = SAMPLE_ACTIVE_DOSHAS }: RemediesBlockProps) {
  const ui = UI_TEXT[lang] || UI_TEXT.en;
  const activeKeys = (Object.keys(activeDoshas) as Array<keyof typeof DOSHA_DATA>).filter((k) => activeDoshas[k]);

  return (
    <div>
      <h2 style={{ color: "#7a1f1f", fontSize: 18, marginBottom: 8 }}>{ui.remedyTitle}</h2>
      {activeKeys.length === 0 && <p>{lang === "ta" ? "தற்போது குறிப்பிட்ட பரிகாரங்கள் தேவையில்லை." : lang === "hi" ? "फिलहाल किसी विशेष उपाय की आवश्यकता नहीं है।" : "No specific remedies needed at this time."}</p>}
      {activeKeys.map((key) => {
        const d = DOSHA_DATA[key];
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            <h3 style={{ color: "#7a1f1f", fontSize: 15 }}>{d.name[lang] || d.name.en}</h3>
            <ul style={{ paddingLeft: 20 }}>
              {(d.remedies[lang] || d.remedies.en).map((r, i) => (
                <li key={i} style={{ fontSize: 14, lineHeight: 1.6 }}>{r}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
