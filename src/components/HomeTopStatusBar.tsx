"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import kisekiIcon from "@/app/kiseki.png";
import { getLevelUpKisekiReward, getRequiredXpForNextRank } from "@/lib/playerRank";

type Props = {
  rank: number;
  xp: number;
  kiseki: number;
};

export default function HomeTopStatusBar(props: Props) {
  const [rankPopoverOpen, setRankPopoverOpen] = useState(false);
  const requiredXp = useMemo(() => getRequiredXpForNextRank(props.rank), [props.rank]);
  const xpToNext = useMemo(() => Math.max(0, requiredXp - props.xp), [requiredXp, props.xp]);
  const isMaxRank = props.rank >= 99;

  return (
    <section style={statusBarWrapStyle}>
      <button type="button" onClick={() => setRankPopoverOpen(prev => !prev)} style={{ ...statusItemRowStyle, ...statusRankItemStyle }}>
        <span style={statusRankLabelStyle}>ランク</span>
        <strong style={statusRankValueStyle}>{props.rank}</strong>
      </button>

      <div style={{ ...statusItemRowStyle, ...statusWideItemStyle, ...statusKisekiItemStyle }}>
        <span style={statusIconLabelStyle} aria-label="所持季石" title="所持季石">
          <Image src={kisekiIcon} alt="季石" width={28} height={28} />
        </span>
        <strong style={{ ...statusValueStyle, ...statusLongValueStyle }}>{props.kiseki}</strong>
      </div>

      {rankPopoverOpen && (
        <div style={rankPopoverStyle}>
          {isMaxRank ? (
            <div style={{ fontSize: 13 }}>ランク上限（99）に到達しています。</div>
          ) : (
            <>
              <div style={{ fontSize: 13 }}>次のランクまで: {xpToNext} EXP</div>
              <div style={{ fontSize: 13 }}>ランクアップ報酬: 季石 +{getLevelUpKisekiReward()}</div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const statusBarWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: "max(6px, env(safe-area-inset-top))",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 30,
  width: "calc(100% - 12px)",
  maxWidth: 760,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: 5,
  padding: "1px 4px",
  borderRadius: 14,
  borderTop: "1px solid rgba(120, 80, 40, 0.25)",
  border: "1px solid rgba(120, 80, 40, 0.22)",
  background: "linear-gradient(180deg, rgba(255,250,241,0.66) 0%, rgba(245,230,202,0.72) 100%)",
  backdropFilter: "blur(10px)",
  overflow: "visible",
};

const statusItemRowStyle: React.CSSProperties = {
  position: "relative",
  flex: "0 1 auto",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  padding: "5px 6px",
  marginTop: 0,
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,0.72)",
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.2)",
  minHeight: 30,
};

const statusRankItemStyle: React.CSSProperties = {
  cursor: "pointer",
  flex: "0 1 112px",
  minWidth: 82,
  justifyContent: "flex-start",
  gap: 10,
  border: "none",
  background: "transparent",
  boxShadow: "none",
  padding: "2px 2px",
};

const statusWideItemStyle: React.CSSProperties = {
  flex: "0 1 148px",
  minWidth: 126,
};

const statusKisekiItemStyle: React.CSSProperties = {
  justifyContent: "space-between",
  paddingLeft: 2,
  marginLeft: "auto",
};

const statusIconLabelStyle: React.CSSProperties = {
  minHeight: 16,
  display: "inline-grid",
  placeItems: "center",
  color: "#5b4d39",
  lineHeight: 1,
  fontSize: 16,
  whiteSpace: "nowrap",
};

const statusValueStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const statusLongValueStyle: React.CSSProperties = {
  minWidth: "6ch",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const statusRankLabelStyle: React.CSSProperties = {
  fontSize: 16,
  color: "#4b3a27",
  lineHeight: 1.2,
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const statusRankValueStyle: React.CSSProperties = {
  fontSize: 19,
  lineHeight: 1,
  color: "#2f2318",
  whiteSpace: "nowrap",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const rankPopoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 40,
  display: "grid",
  gap: 4,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(120, 80, 40, 0.35)",
  background: "rgba(255, 252, 245, 0.98)",
  boxShadow: "0 10px 24px rgba(40, 24, 12, 0.22)",
};

