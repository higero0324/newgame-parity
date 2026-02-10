"use client";

import React from "react";
import { BOARD_LEN, SIZE } from "@/lib/gameLogic";

type Props = {
  board: number[];
  onClickCell: (i: number) => void;
  lastChanged?: Set<number>;
  disabled?: boolean;
};

export default function Board({ board, onClickCell, lastChanged, disabled }: Props) {
  const topLabels = ["一", "二", "三", "四", "五"];
  const sideLabels = ["春", "夏", "秋", "冬", "廻"];
  const renderMark = (v: number) => {
    if (v === 0) return "";
    const strokes = [
      <path key="s1" d="M20 20 H80" />,      // 1: 上の横
      <path key="s2" d="M50 20 V80" />,      // 2: 縦
      <path key="s3" d="M54 46 H74" />,      // 3: 中の横（右寄り・短め）
      <path key="s4" d="M32 48 V80" />,      // 4: 縦（左1/4付近・下半分）
      <path key="s5" d="M16 82 H84" />,      // 5: 下の横
    ];
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <g
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {strokes.slice(0, Math.min(v, 5))}
        </g>
      </svg>
    );
  };
  return (
    <div style={{ display: "grid", gap: "min(6px, 1.6vw)", justifyItems: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${SIZE}, min(64px, 12vw))`,
          gap: "min(8px, 2vw)",
          width: "fit-content",
          transform: "translateX(-6px)",
        }}
      >
        {[...topLabels].reverse().map(label => (
          <div
            key={label}
            style={{
              textAlign: "center",
              fontWeight: 700,
              fontSize: "clamp(14px, 2.8vw, 18px)",
              color: "var(--ink)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "min(8px, 2vw)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE}, min(64px, 12vw))`,
            gap: "min(8px, 2vw)",
            userSelect: "none",
            padding: "min(10px, 2.5vw)",
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
                  width: "min(64px, 12vw)",
                  height: "min(64px, 12vw)",
                  borderRadius: 10,
                  border: "2px solid var(--line)",
                  fontSize: "clamp(16px, 3vw, 22px)",
                  fontWeight: 700,
                  background: highlight ? "var(--highlight)" : "var(--cell)",
                  color: "var(--cell-ink)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.6)",
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
            gridTemplateRows: `repeat(${SIZE}, min(64px, 12vw))`,
            gap: "min(8px, 2vw)",
            alignItems: "center",
            transform: "translateY(6px)",
          }}
        >
          {sideLabels.map(label => (
            <div
              key={label}
              style={{
                textAlign: "center",
                fontWeight: 700,
                fontSize: "clamp(14px, 2.8vw, 18px)",
                color: "var(--ink)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
