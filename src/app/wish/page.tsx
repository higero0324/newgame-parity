"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import sakuraIcon from "@/app/sakura.png";
import kisekiIcon from "@/app/kiseki.png";
import { loadPlayerRankStateForCurrentUser } from "@/lib/playerRank";
import { getGachaCost, pullGachaForCurrentUser, type GachaItemDef } from "@/lib/gacha";

const RATES = [
  { label: "レアアイコンフレーム", rate: "3%" },
  { label: "光フレーム / おしゃれカード", rate: "17%" },
  { label: "変な称号", rate: "80%" },
];

export default function WishPage() {
  const [kiseki, setKiseki] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<GachaItemDef[]>([]);
  const [newlyObtained, setNewlyObtained] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    (async () => {
      const loaded = await loadPlayerRankStateForCurrentUser();
      if (!loaded.ok) {
        setStatus(`読み込みに失敗しました。詳細: ${loaded.reason}`);
        setLoading(false);
        return;
      }
      setKiseki(loaded.state.kiseki);
      setLoading(false);
    })();
  }, []);

  const draw = async (count: 1 | 10) => {
    if (drawing) return;
    setDrawing(true);
    setStatus("");
    const res = await pullGachaForCurrentUser(count);
    setDrawing(false);
    if (!res.ok) {
      setStatus(res.reason);
      return;
    }
    setResults(res.rewards);
    setNewlyObtained(new Set(res.newlyObtainedIds));
    setKiseki(res.remainingKiseki);
    setStatus(`祈願完了（-${res.cost} 季石）`);
  };

  const canSingle = !drawing && kiseki >= getGachaCost(1);
  const canTen = !drawing && kiseki >= getGachaCost(10);

  const resultColumns = useMemo(() => (results.length >= 10 ? "repeat(5, minmax(0, 1fr))" : "repeat(auto-fit, minmax(120px, 1fr))"), [results.length]);

  return (
    <main style={{ padding: "clamp(12px, 4vw, 24px)", display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>祈願</h1>

      <section style={sectionStyle}>
        <div style={topStatusRowStyle}>
          <div style={kisekiBoxStyle}>
            <Image src={kisekiIcon} alt="季石" width={20} height={20} />
            <strong style={{ fontSize: 22 }}>{kiseki}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#6a5338" }}>1回: 250季石</div>
        </div>
        <div style={rateWrapStyle}>
          {RATES.map(r => (
            <div key={r.label} style={rateRowStyle}>
              <span>{r.label}</span>
              <b>{r.rate}</b>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" style={drawButtonStyle} onClick={() => draw(1)} disabled={!canSingle || loading}>
            単発祈願
          </button>
          <button type="button" style={drawButtonStyle} onClick={() => draw(10)} disabled={!canTen || loading}>
            十連祈願
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>祈願結果</h2>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: resultColumns }}>
            {results.map((item, i) => (
              <div key={`${item.id}-${i}`} style={{ ...resultSlotStyle, ...(item.tier === "rare" ? rareSlotStyle : null) }}>
                <div style={resultPreviewWrapStyle}>{renderItemPreview(item)}</div>
                <div style={{ fontSize: 12, fontWeight: 800, textAlign: "center", lineHeight: 1.3 }}>{item.name}</div>
                {newlyObtained.has(item.id) && <div style={newBadgeStyle}>NEW</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {status && <div style={sectionStyle}>{status}</div>}
    </main>
  );
}

function renderItemPreview(item: GachaItemDef) {
  if (item.kind === "frame") {
    if (item.id === "sakura_frame") {
      return (
        <div style={framePreviewBaseStyle}>
          <div style={sakuraFramePreviewStyle}>
            <Image src={sakuraIcon} alt="桜フレーム" fill sizes="40px" style={{ objectFit: "cover", opacity: 0.32, borderRadius: "50%" }} />
          </div>
        </div>
      );
    }
    const color = item.id === "glow_red_frame" ? "#dd3e46" : item.id === "glow_blue_frame" ? "#3f8cff" : "#2da46f";
    return <div style={{ ...framePreviewBaseStyle, borderColor: color, boxShadow: `0 0 12px ${color}` }} />;
  }

  if (item.kind === "template") {
    return <div style={{ ...templatePreviewStyle, ...(item.id === "gacha_template_kacho" ? kachoStyle : item.id === "gacha_template_suiboku" ? suibokuStyle : kinranStyle) }} />;
  }

  return <div style={titlePreviewStyle}>称号</div>;
}

const sectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid rgba(95, 65, 34, 0.35)",
  borderRadius: 14,
  background: "linear-gradient(180deg, rgba(255,251,244,0.88) 0%, rgba(250,236,208,0.78) 100%)",
  boxSizing: "border-box",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.5), 0 10px 20px rgba(50, 28, 12, 0.12)",
};

const topStatusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const kisekiBoxStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid #a57b3d",
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
};

const rateWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  border: "1px solid rgba(90, 60, 30, 0.28)",
  borderRadius: 10,
  padding: 8,
  background: "rgba(255,255,255,0.62)",
};

const rateRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  color: "#553b20",
};

const drawButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #6b4a23",
  background: "linear-gradient(180deg, #fff3d1 0%, #dfb553 100%)",
  color: "#3a270f",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(107, 74, 35, 0.38), 0 6px 14px rgba(40, 20, 8, 0.2)",
};

const resultSlotStyle: React.CSSProperties = {
  position: "relative",
  border: "1px solid rgba(90, 60, 30, 0.28)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.78)",
  aspectRatio: "1 / 1",
  padding: 8,
  display: "grid",
  alignContent: "space-between",
  justifyItems: "center",
  gap: 6,
};

const rareSlotStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,236,196,0.94) 0%, rgba(244,208,124,0.9) 100%)",
  boxShadow: "0 0 0 1px rgba(214, 169, 72, 0.7), 0 0 20px rgba(238, 191, 84, 0.45)",
};

const resultPreviewWrapStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  display: "grid",
  placeItems: "center",
};

const newBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  borderRadius: 999,
  border: "1px solid #8a571d",
  background: "#fff6d7",
  color: "#6d4318",
  fontSize: 10,
  fontWeight: 900,
  padding: "1px 6px",
};

const framePreviewBaseStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "3px solid #8f6337",
  background: "linear-gradient(180deg, #f8e9d3 0%, #e7c39a 100%)",
  position: "relative",
  overflow: "hidden",
};

const sakuraFramePreviewStyle: React.CSSProperties = {
  position: "absolute",
  inset: -1,
  borderRadius: "50%",
  border: "3px solid #d79db7",
  boxShadow: "0 0 0 1px rgba(106, 58, 74, 0.72), 0 0 12px rgba(237, 176, 205, 0.7)",
  overflow: "hidden",
};

const templatePreviewStyle: React.CSSProperties = {
  width: 60,
  height: 40,
  borderRadius: 7,
  border: "1px solid rgba(90, 60, 30, 0.35)",
  boxShadow: "0 2px 4px rgba(35, 20, 10, 0.18)",
};

const kachoStyle: React.CSSProperties = {
  background:
    "radial-gradient(circle at 85% 20%, rgba(255,176,194,0.26) 0%, rgba(255,176,194,0) 40%), linear-gradient(145deg, #fdf1e2 0%, #f7d9c4 52%, #efc1a6 100%)",
};

const suibokuStyle: React.CSSProperties = {
  background:
    "repeating-linear-gradient(18deg, rgba(40,40,40,0.18) 0px, rgba(40,40,40,0.18) 2px, rgba(240,240,240,0.9) 2px, rgba(240,240,240,0.9) 8px), linear-gradient(180deg, #f4f4f4 0%, #dedede 100%)",
};

const kinranStyle: React.CSSProperties = {
  background:
    "radial-gradient(circle at 10% 0%, rgba(255,238,187,0.35) 0%, rgba(255,238,187,0) 45%), linear-gradient(135deg, #4a1f09 0%, #7a3816 45%, #c99737 100%)",
};

const titlePreviewStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid #a57b3d",
  background: "linear-gradient(180deg, #fff4c7 0%, #e2b63f 100%)",
  color: "#4b3510",
  fontSize: 11,
  fontWeight: 800,
};
