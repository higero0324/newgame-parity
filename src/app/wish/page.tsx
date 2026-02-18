"use client";

import React, { useMemo, useRef, useState } from "react";
import Image from "next/image";
import sakuraIcon from "@/app/sakura.png";
import { loadPlayerRankStateForCurrentUser } from "@/lib/playerRank";
import {
  getAllGachaItems,
  getGachaCost,
  getGachaItemById,
  pullGachaForCurrentUser,
  type GachaItemDef,
type GachaPullResult,
} from "@/lib/gacha";
import HomeTopStatusBar from "@/components/HomeTopStatusBar";

const RATES = [
  { label: "★★★", description: "レアアイコンフレーム", rate: 1.5 },
  { label: "★★", description: "光フレーム / おしゃれカード", rate: 13.5 },
  { label: "★", description: "変な称号", rate: 85 },
];

const TIER_ORDER: Record<GachaItemDef["tier"], number> = {
  odd: 0,
  premium: 1,
  rare: 2,
};

export default function WishPage() {
  const [rank, setRank] = useState(1);
  const [xp, setXp] = useState(0);
  const [kiseki, setKiseki] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<GachaPullResult[]>([]);
  const [showRates, setShowRates] = useState(false);
  const [opening, setOpening] = useState(false);
  const [rareCutIn, setRareCutIn] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const revealTimerRef = useRef<number | null>(null);

  const clearRevealTimer = () => {
    if (revealTimerRef.current !== null) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

  React.useEffect(() => {
    (async () => {
      const loaded = await loadPlayerRankStateForCurrentUser();
      if (!loaded.ok) {
        setStatus(`読み込みに失敗しました。詳細: ${loaded.reason}`);
        setLoading(false);
        return;
      }
      setRank(loaded.state.rank);
      setXp(loaded.state.xp);
      setKiseki(loaded.state.kiseki);
      setLoading(false);
    })();
  }, []);

  React.useEffect(() => {
    return () => {
      clearRevealTimer();
    };
  }, []);

  const draw = async (count: 1 | 10) => {
    if (drawing) return;
    const cost = getGachaCost(count);
    const ok = window.confirm(`季石を${cost}個消費しますがよろしいですか？`);
    if (!ok) return;
    clearRevealTimer();
    setResults([]);
    setRevealCount(0);
    setOpening(true);
    setRareCutIn(false);
    setDrawing(true);
    setStatus("祈願中...");
    const res = await pullGachaForCurrentUser(count);
    if (!res.ok) {
      setDrawing(false);
      setOpening(false);
      setStatus(res.reason);
      return;
    }
    setKiseki(res.remainingKiseki);
    const pulled = [...res.pullResults].sort((a, b) => TIER_ORDER[a.item.tier] - TIER_ORDER[b.item.tier]);
    const hasRare = pulled.some(x => x.item.tier === "rare");
    await sleep(700);
    setOpening(false);
    if (hasRare) {
      setRareCutIn(true);
      await sleep(900);
      setRareCutIn(false);
    }

    setResults(pulled);
    setRevealCount(Math.min(1, pulled.length));
    if (pulled.length > 1) {
      revealTimerRef.current = window.setInterval(() => {
        setRevealCount(prev => {
          const next = prev + 1;
          if (next >= pulled.length) {
            clearRevealTimer();
            return pulled.length;
          }
          return next;
        });
      }, 110);
    }

    setDrawing(false);
    setStatus(`祈願完了（消費 ${res.cost} 季石 / 返還 ${res.refundTotal} 季石）`);
  };

  const canSingle = !drawing && kiseki >= getGachaCost(1);
  const canTen = !drawing && kiseki >= getGachaCost(10);
  const allItems = useMemo(() => getAllGachaItems(), []);
  const spotlightItems = useMemo(
    () =>
      ["sakura_frame", "glow_blue_frame", "gacha_template_kinran"]
        .map(id => getGachaItemById(id))
        .filter((item): item is GachaItemDef => Boolean(item)),
    [],
  );
  const perItemRateMap = useMemo(() => {
    const totalByTier: Record<string, number> = { rare: 0, premium: 0, odd: 0 };
    for (const item of allItems) totalByTier[item.tier] = (totalByTier[item.tier] ?? 0) + 1;
    const tierRate: Record<string, number> = { rare: 1.5, premium: 13.5, odd: 85 };
    const map = new Map<string, number>();
    for (const item of allItems) {
      const denom = totalByTier[item.tier] || 1;
      map.set(item.id, tierRate[item.tier] / denom);
    }
    return map;
  }, [allItems]);

  const resultColumns = useMemo(
    () => (results.length >= 10 ? "repeat(5, minmax(0, 1fr))" : "repeat(auto-fit, minmax(120px, 1fr))"),
    [results.length],
  );

  return (
    <main
      style={{
        margin: "calc(56px + env(safe-area-inset-top)) auto 24px",
        padding: "clamp(12px, 4vw, 24px)",
        display: "grid",
        gap: 12,
        justifyItems: "center",
      }}
    >
      <HomeTopStatusBar rank={rank} xp={xp} kiseki={kiseki} />
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>祈願</h1>

      <section style={spotlightSectionStyle}>
        <div style={spotlightHeaderStyle}>
          <span style={spotlightEyebrowStyle}>注目祈願</span>
        </div>
        <div style={spotlightGridStyle}>
          {spotlightItems.map(item => (
            <div key={item.id} style={spotlightCardStyle}>
              <div style={spotlightGlowStyle} />
              <div style={spotlightPreviewWrapStyle}>{renderItemPreview(item)}</div>
              <div style={spotlightNameStyle}>{item.name}</div>
              <div style={spotlightTierStyle}>{item.tier === "rare" ? "★★★ ピックアップ" : "★★ 注目景品"}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ fontSize: 12, color: "#6a5338", textAlign: "right" }}>1回: 250季石</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" style={drawButtonStyle} onClick={() => draw(1)} disabled={!canSingle || loading}>
            1回祈願
          </button>
          <button type="button" style={drawButtonStyle} onClick={() => draw(10)} disabled={!canTen || loading}>
            10回祈願
          </button>
          <button type="button" style={detailButtonStyle} onClick={() => setShowRates(v => !v)}>
            {showRates ? "詳細を閉じる" : "詳細"}
          </button>
        </div>

        {showRates && (
          <div style={ratePanelStyle}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>抽象的な確率分布</div>
            <div style={rateWrapStyle}>
              {RATES.map(r => (
                <div key={r.label} style={rateRowStyle}>
                  <span>{r.label}（{r.description}）</span>
                  <b>{r.rate}%</b>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 800, fontSize: 14 }}>具体的な確率分布</div>
            <div style={detailGridStyle}>
              {allItems.map(item => (
                <div key={item.id} style={detailRowStyle}>
                  <span>{item.name}</span>
                  <b>{(perItemRateMap.get(item.id) ?? 0).toFixed(3)}%</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {(results.length > 0 || opening || rareCutIn) && (
        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>祈願結果</h2>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: resultColumns }}>
            {results.map((result, i) => (
              i < revealCount ? (
                <div
                  key={`${result.item.id}-${i}`}
                  style={{ ...resultSlotStyle, ...(result.item.tier === "rare" ? rareSlotStyle : null) }}
                >
                  <div style={resultPreviewWrapStyle}>{renderItemPreview(result.item)}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, textAlign: "center", lineHeight: 1.3 }}>{result.item.name}</div>
                  {!result.duplicated && <div style={newBadgeStyle}>NEW</div>}
                  {result.duplicated && <div style={dupBadgeStyle}>DUP +{result.refundKiseki}</div>}
                </div>
              ) : (
                <div key={`back-${i}`} style={resultBackSlotStyle}>
                  <div style={resultBackCoreStyle}>?</div>
                </div>
              )
            ))}
          </div>
        </section>
      )}

      {status && <div style={sectionStyle}>{status}</div>}

      {opening && (
        <div style={openingOverlayStyle}>
          <div style={openingCardStyle}>
            <div style={openingPulseStyle} />
            <div style={{ fontSize: 28, fontWeight: 900 }}>祈願中...</div>
            <div style={{ fontSize: 13, opacity: 0.92 }}>静かに光が満ちていく</div>
          </div>
        </div>
      )}

      {rareCutIn && (
        <div style={rareOverlayStyle}>
          <div style={rareCardStyle}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", opacity: 0.92 }}>SPECIAL</div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>★★★ 出現</div>
          </div>
        </div>
      )}
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

const spotlightSectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  display: "grid",
  gap: 10,
  padding: 14,
  border: "1px solid rgba(95, 65, 34, 0.35)",
  borderRadius: 16,
  background:
    "radial-gradient(circle at 15% 20%, rgba(255,228,168,0.35) 0%, rgba(255,228,168,0) 40%), radial-gradient(circle at 85% 0%, rgba(255,189,214,0.25) 0%, rgba(255,189,214,0) 38%), linear-gradient(170deg, rgba(255,250,240,0.94) 0%, rgba(246,224,179,0.86) 100%)",
  boxSizing: "border-box",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.58), 0 14px 26px rgba(50, 28, 12, 0.14)",
};

const spotlightHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const spotlightEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#6f4c23",
  letterSpacing: "0.08em",
  fontWeight: 800,
};

const spotlightTitleStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#43290f",
  lineHeight: 1.2,
};

const spotlightGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const spotlightCardStyle: React.CSSProperties = {
  position: "relative",
  display: "grid",
  justifyItems: "center",
  gap: 6,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(130, 90, 38, 0.35)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,241,214,0.9) 100%)",
  boxShadow: "0 6px 14px rgba(54, 29, 10, 0.16)",
  overflow: "hidden",
};

const spotlightGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: -16,
  width: 90,
  height: 50,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(255,223,145,0.65) 0%, rgba(255,223,145,0) 70%)",
  pointerEvents: "none",
};

const spotlightPreviewWrapStyle: React.CSSProperties = {
  minHeight: 64,
  width: "100%",
  display: "grid",
  placeItems: "center",
};

const spotlightNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#412a12",
  textAlign: "center",
  lineHeight: 1.25,
};

const spotlightTierStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#7c5325",
  borderRadius: 999,
  border: "1px solid rgba(138, 92, 37, 0.38)",
  background: "rgba(255,247,226,0.92)",
  padding: "2px 8px",
};

const drawButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #6b4a23",
  background: "linear-gradient(180deg, #fff3d1 0%, #dfb553 100%)",
  color: "#3a270f",
  fontWeight: 900,
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  cursor: "pointer",
  boxShadow: "0 2px 0 rgba(107, 74, 35, 0.38), 0 6px 14px rgba(40, 20, 8, 0.2)",
};

const detailButtonStyle: React.CSSProperties = {
  ...drawButtonStyle,
  background: "linear-gradient(180deg, #f8f0df 0%, #d8bf8e 100%)",
};

const ratePanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  border: "1px solid rgba(90, 60, 30, 0.32)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.74)",
  padding: 10,
};

const rateWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  border: "1px solid rgba(90, 60, 30, 0.18)",
  borderRadius: 10,
  padding: 8,
  background: "rgba(255,255,255,0.58)",
};

const rateRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  color: "#553b20",
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  border: "1px solid rgba(90, 60, 30, 0.18)",
  borderRadius: 10,
  padding: 8,
  background: "rgba(255,255,255,0.58)",
  maxHeight: 240,
  overflow: "auto",
};

const detailRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "#553b20",
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

const dupBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  borderRadius: 999,
  border: "1px solid #8f611d",
  background: "#fff0a8",
  color: "#6a430f",
  fontSize: 10,
  fontWeight: 900,
  padding: "1px 6px",
};

const resultBackSlotStyle: React.CSSProperties = {
  ...resultSlotStyle,
  background: "linear-gradient(145deg, rgba(90,67,47,0.94) 0%, rgba(49,33,21,0.94) 100%)",
  borderColor: "rgba(244, 205, 122, 0.28)",
  boxShadow: "inset 0 0 0 1px rgba(255, 227, 165, 0.25)",
  placeItems: "center",
};

const resultBackCoreStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 28,
  color: "rgba(255, 235, 186, 0.95)",
  border: "1px solid rgba(255, 221, 146, 0.4)",
  boxShadow: "0 0 20px rgba(255, 218, 133, 0.22)",
};

const openingOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 70,
  display: "grid",
  placeItems: "center",
  background: "rgba(26, 15, 8, 0.45)",
  backdropFilter: "blur(1.5px)",
  pointerEvents: "none",
};

const openingCardStyle: React.CSSProperties = {
  position: "relative",
  minWidth: 220,
  padding: "20px 28px",
  borderRadius: 16,
  border: "1px solid rgba(255, 226, 158, 0.65)",
  color: "#fff7e1",
  textAlign: "center",
  background: "linear-gradient(180deg, rgba(116,76,31,0.96) 0%, rgba(73,45,16,0.96) 100%)",
  boxShadow: "0 18px 40px rgba(19, 10, 4, 0.45)",
  overflow: "hidden",
};

const openingPulseStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: -24,
  transform: "translateX(-50%)",
  width: 180,
  height: 70,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(255,220,146,0.7) 0%, rgba(255,220,146,0) 70%)",
};

const rareOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 72,
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at center, rgba(255,230,173,0.24) 0%, rgba(26, 12, 4, 0.64) 72%)",
  pointerEvents: "none",
};

const rareCardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255, 214, 126, 0.85)",
  padding: "16px 24px",
  color: "#fff4d1",
  textAlign: "center",
  background: "linear-gradient(145deg, rgba(148,92,33,0.96) 0%, rgba(83,45,12,0.96) 100%)",
  boxShadow: "0 0 0 1px rgba(255, 241, 192, 0.32), 0 0 42px rgba(255, 208, 98, 0.36)",
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
