"use client";

import React, { useEffect, useState } from "react";
import { BOARD_LEN, SIZE } from "@/lib/gameLogic";

type Props = {
  board: number[];
  onClickCell: (i: number) => void;
  lastChanged?: Set<number>;
  disabled?: boolean;
};

export default function Board({ board, onClickCell, lastChanged, disabled }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const topLabels = ["一", "二", "三", "四", "五"];
  const sideLabels = ["春", "夏", "秋", "冬", "廻"];

  // Desktop values are preserved. Mobile overrides are applied below.
  const gridCell = isMobile ? "52px" : "min(64px, 12vw)";
  const gap = isMobile ? "4px" : "min(8px, 2vw)";
  const pad = isMobile ? "8px" : "min(10px, 2.5vw)";

  const renderMark = (v: number) => {
    if (v === 0) return "";
    const strokes = [
      <path key="s1" d="M20 20 H80" />,
      <path key="s2" d="M50 20 V80" />,
      <path key="s3" d="M54 46 H74" />,
      <path key="s4" d="M32 48 V80" />,
      <path key="s5" d="M16 82 H84" />,
    ];
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {strokes.slice(0, Math.min(v, 5))}
        </g>
      </svg>
    );
  };

  return (
    <div style={{ width: "100%", overflowX: isMobile ? "auto" : "visible" }}>
      <div style={{ display: "grid", gap: isMobile ? "4px" : "min(6px, 1.6vw)", justifyItems: "center", width: "fit-content", margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE}, ${gridCell})`,
            gap,
            width: "fit-content",
            transform: isMobile ? "translateX(-2px)" : "translateX(-6px)",
          }}
        >
          {[...topLabels].reverse().map(label => (
            <div
              key={label}
              style={{
                textAlign: "center",
                fontWeight: 700,
                fontSize: isMobile ? 14 : "clamp(14px, 2.8vw, 18px)",
                color: "var(--ink)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${SIZE}, ${gridCell})`,
              gap,
              userSelect: "none",
              padding: pad,
              borderRadius: 14,
              border: "2px solid var(--line)",
              background: "linear-gradient(180deg, #f5deb9 0%, #e8c89a 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
              width: "fit-content",
              margin: "0 auto",
            }}
          >
            {Array.from({ length: BOARD_LEN }, (_, i) => {
              const v = board[i];
              const highlight = lastChanged?.has(i);
              return (
                <button
                  key={i}
                  onClick={() => onClickCell(i)}
                  disabled={disabled}
                  style={{
                    width: gridCell,
                    height: gridCell,
                    borderRadius: 10,
                    border: "2px solid var(--line)",
                    fontSize: isMobile ? 18 : "clamp(16px, 3vw, 22px)",
                    fontWeight: 700,
                    background: highlight ? "var(--highlight)" : "var(--cell)",
                    color: "var(--cell-ink)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.6)",
                    touchAction: "manipulation",
                  }}
                  aria-label={`cell-${i}`}
                  title={`index=${i}`}
                >
                  {renderMark(v)}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${SIZE}, ${gridCell})`,
              gap,
              alignItems: "center",
              transform: isMobile ? "translateY(2px)" : "translateY(6px)",
            }}
          >
            {sideLabels.map(label => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: isMobile ? 14 : "clamp(14px, 2.8vw, 18px)",
                  color: "var(--ink)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
