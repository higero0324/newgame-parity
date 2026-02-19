"use client";

import React, { useEffect, useState } from "react";
import { BOARD_LEN, SIZE } from "@/lib/gameLogic";
import ShoGlyph, { SHO_STROKE_ANIMATION_CSS } from "@/components/ShoGlyph";

type Props = {
  board: number[];
  onClickCell: (i: number) => void;
  lastChanged?: Set<number>;
  lastPlaced?: number;
  disabled?: boolean;
  winningLine?: Set<number>;
};

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

  // On mobile, shrink cells according to viewport width before horizontal scrolling is needed.
  const gridCell = isMobile ? "clamp(36px, calc((100vw - 96px) / 5), 52px)" : "min(64px, 12vw)";
  const gap = isMobile ? "4px" : "min(8px, 2vw)";
  const pad = isMobile ? "8px" : "min(10px, 2.5vw)";

  return (
    <div style={{ width: "100%", overflowX: "auto", overflowY: "visible" }}>
      <style>{SHO_STROKE_ANIMATION_CSS}</style>
      <div
        style={{
          display: "grid",
          gap: isMobile ? "4px" : "min(6px, 1.6vw)",
          justifyItems: "center",
          width: "fit-content",
          margin: "0 auto",
          paddingInline: isMobile ? 4 : 0,
          minWidth: "fit-content",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE}, ${gridCell})`,
            gap,
            width: "fit-content",
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
                  <ShoGlyph
                    value={v}
                    animateFrom={animateFrom}
                    baseDelaySec={baseDelaySec}
                    stepDelaySec={stepDelaySec}
                  />
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
