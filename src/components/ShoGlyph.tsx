"use client";

import React from "react";

export const SHO_STROKE_ANIMATION_NAME = "hisei-stroke-draw";
const SHO_STROKE_DURATION_SEC = 0.34;

const SHO_STROKE_PATHS = [
  <path key="s1" pathLength={1} d="M26.75,23.79c3.12,0.63,6.35,0.5,9.5,0.22c11.81-1.03,25.77-2.56,39.75-3.29c2.84-0.15,5.56-0.03,8.38,0.31" />,
  <path key="s2" pathLength={1} d="M52.96,25.62c1.4,1.4,2.01,2.88,2.01,5.54c0,11.55-0.01,56.3-0.01,57.34" />,
  <path key="s3" pathLength={1} d="M56.36,53.48c7.14-0.48,15.52-1.36,21.92-1.84c1.59-0.12,2.47-0.02,3.6,0.16" />,
  <path key="s4" pathLength={1} d="M27.54,56.37c1.17,1.17,2.05,2.62,2.15,5.21c0.43,10.8,0.43,20.3,0.62,27.92" />,
  <path key="s5" pathLength={1} d="M14.25,90.04C18,91,21.38,91.23,25,91c14-0.88,39.23-2.07,58.63-2.39c3.36-0.06,6.77,0.32,10,1.37" />,
];

type ShoGlyphProps = {
  value: number;
  animateFrom?: number | null;
  baseDelaySec?: number;
  stepDelaySec?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

export default function ShoGlyph({
  value,
  animateFrom = null,
  baseDelaySec = 0,
  stepDelaySec = 0.1,
  strokeColor = "currentColor",
  strokeWidth = 7,
}: ShoGlyphProps) {
  if (value <= 0) return null;
  const visible = SHO_STROKE_PATHS.slice(0, Math.min(value, 5));

  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
      <g
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(50 50) scale(0.94) translate(-50 -50) translate(-5 -3)"
      >
        {visible.map((stroke, idx) =>
          React.cloneElement(stroke, {
            style:
              animateFrom !== null && idx >= animateFrom
                ? {
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                    animation: `${SHO_STROKE_ANIMATION_NAME} ${SHO_STROKE_DURATION_SEC}s ease-in-out forwards`,
                    animationDelay: `${baseDelaySec + (idx - animateFrom) * stepDelaySec}s`,
                  }
                : undefined,
          }),
        )}
      </g>
    </svg>
  );
}

