"use client";

import React, { useEffect, useState } from "react";
import { BOARD_LEN, SIZE } from "@/lib/gameLogic";

type Props = {
  board: number[];
  onClickCell: (i: number) => void;
  lastChanged?: Set<number>;
  lastPlaced?: number;
  disabled?: boolean;
  winningLine?: Set<number>;
};

const STROKE_ANIMATION = `
@keyframes hisei-stroke-draw {
  to {
    stroke-dashoffset: 0;
  }
}
`;
export const STROKE_DURATION_SEC = 0.34;
export const DEFAULT_STROKE_STEP_DELAY_SEC = 0.1;

export default function Board({ board, onClickCell, lastChanged, lastPlaced, disabled, winningLine }: Props) {
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

  const renderMark = (v: number, animateFrom: number | null, baseDelaySec = 0, stepDelaySec = DEFAULT_STROKE_STEP_DELAY_SEC) => {
    if (v === 0) return "";
    const strokes = [
      <path key="s1" pathLength={1} d="M26.75,23.79c3.12,0.63,6.35,0.5,9.5,0.22c11.81-1.03,25.77-2.56,39.75-3.29c2.84-0.15,5.56-0.03,8.38,0.31" />,
      <path key="s2" pathLength={1} d="M52.96,25.62c1.4,1.4,2.01,2.88,2.01,5.54c0,11.55-0.01,56.3-0.01,57.34" />,
      <path key="s3" pathLength={1} d="M56.36,53.48c7.14-0.48,15.52-1.36,21.92-1.84c1.59-0.12,2.47-0.02,3.6,0.16" />,
      <path key="s4" pathLength={1} d="M27.54,56.37c1.17,1.17,2.05,2.62,2.15,5.21c0.43,10.8,0.43,20.3,0.62,27.92" />,
      <path key="s5" pathLength={1} d="M14.25,90.04C18,91,21.38,91.23,25,91c14-0.88,39.23-2.07,58.63-2.39c3.36-0.06,6.77,0.32,10,1.37" />,
    ];
    const visible = strokes.slice(0, Math.min(v, 5));

    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
        <g
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          transform="translate(50 50) scale(0.94) translate(-50 -50) translate(-5 -3)"
        >
          {visible.map((stroke, idx) =>
            React.cloneElement(stroke, {
              style: animateFrom !== null && idx >= animateFrom
                ? {
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    animation: "hisei-stroke-draw 0.34s ease-in-out forwards",
                    animationDelay: `${baseDelaySec + (idx - animateFrom) * stepDelaySec}s`,
                  }
                : undefined,
            }),
          )}
        </g>
      </svg>
    );
  };

  return (
    <div style={{ width: "100%", overflowX: isMobile ? "auto" : "visible" }}>
      <style>{STROKE_ANIMATION}</style>
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
              const isWinningCell = winningLine?.has(i);
              const isPlaced = highlight && lastPlaced === i;
              const hasPlacedInChange = Boolean(lastChanged && lastPlaced !== undefined && lastChanged.has(lastPlaced));
              const placedValue = hasPlacedInChange && lastPlaced !== undefined ? board[lastPlaced] ?? 0 : 0;
              const placedStepDelaySec = placedValue === 2 ? STROKE_DURATION_SEC : DEFAULT_STROKE_STEP_DELAY_SEC;
              const placedAnimationEndSec = placedValue > 0
                ? (Math.min(placedValue, 5) - 1) * placedStepDelaySec + STROKE_DURATION_SEC
                : 0;
              const baseDelaySec = !isPlaced && hasPlacedInChange ? placedAnimationEndSec : 0;
              const stepDelaySec = isPlaced && v === 2 ? STROKE_DURATION_SEC : DEFAULT_STROKE_STEP_DELAY_SEC;
              const animateFrom = !highlight || v <= 0 ? null : isPlaced ? 0 : Math.max(0, v - 1);
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
                    background: isWinningCell ? "linear-gradient(135deg, #fff9e6 0%, #ffe8b3 100%)" : highlight ? "var(--highlight)" : "var(--cell)",
                    color: "var(--cell-ink)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.6), inset 0 1px 0 rgba(255,255,255,0.6)",
                    touchAction: "manipulation",
                  }}
                  aria-label={`cell-${i}`}
                  title={`index=${i}`}
                >
                  {renderMark(v, animateFrom, baseDelaySec, stepDelaySec)}
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
