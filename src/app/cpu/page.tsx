"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import { applyMove, emptyBoard, getAllWinningLines, type Player } from "@/lib/gameLogic";
import { findCpuMove, type CpuLevel } from "@/lib/cpuPlayer";
import { calculateAnimationDuration } from "@/lib/animationTiming";

type Snapshot = {
  board: number[];
  turn: Player;
};

type LastMove = {
  changed: Array<{ i: number; from: number; to: number }>;
  placedPos: number;
};

export default function PlayCpuPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>("medium");
  const [playerSide, setPlayerSide] = useState<Player | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([{ board: emptyBoard(), turn: "p1" }]);
  const current = history[history.length - 1];

  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [lastPlaced, setLastPlaced] = useState<number | undefined>(undefined);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [thinking, setThinking] = useState(false);
  const lastMoveRef = useRef<LastMove | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!playerSide) return;
    const cpuSide: Player = playerSide === "p1" ? "p2" : "p1";
    if (current.turn === cpuSide && !winner && !thinking) {
      setThinking(true);
      
      const animDuration = lastMoveRef.current
        ? calculateAnimationDuration(lastMoveRef.current.changed, lastMoveRef.current.placedPos)
        : 0;
      
      const delay = Math.max(animDuration + 300, 600);
      
      setTimeout(() => {
        const pos = findCpuMove(current.board, cpuSide, cpuLevel);
        if (pos >= 0) {
          const res = applyMove(current.board, pos, cpuSide);
          if (res.ok) {
            lastMoveRef.current = { changed: res.changed, placedPos: pos };
            const nextTurn: Player = cpuSide === "p1" ? "p2" : "p1";
            setHistory(prev => [...prev, { board: res.newBoard, turn: nextTurn }]);
            setLastChanged(new Set(res.changed.map(x => x.i)));
            setLastPlaced(pos);
            if (res.winner) {
              setWinner(res.winner);
              setMsg(res.winner === playerSide ? "あなたの勝ち！" : "CPUの勝ち！");
              const lines = getAllWinningLines(res.newBoard);
              if (lines.length > 0) setWinningLine(new Set(lines));
            }
          }
        }
        setThinking(false);
      }, delay);
    }
  }, [current, winner, thinking, cpuLevel, playerSide]);

  const canPlay = winner === null && current.turn === playerSide && !thinking;

  const onClickCell = (pos: number) => {
    if (!canPlay) return;
    const res = applyMove(current.board, pos, playerSide);
    if (!res.ok) {
      setMsg(res.reason);
      return;
    }

    lastMoveRef.current = { changed: res.changed, placedPos: pos };
    const nextTurn: Player = playerSide === "p1" ? "p2" : "p1";
    setHistory(prev => [...prev, { board: res.newBoard, turn: nextTurn }]);
    setLastChanged(new Set(res.changed.map(x => x.i)));
    setLastPlaced(pos);
    setMsg("");

    if (res.winner) {
      setWinner(res.winner);
      setMsg(res.winner === playerSide ? "あなたの勝ち！" : "CPUの勝ち！");
      const lines = getAllWinningLines(res.newBoard);
      if (lines.length > 0) setWinningLine(new Set(lines));
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    if (winner) setWinner(null);
    const stepsBack = history.length > 2 && current.turn === playerSide ? 2 : 1;
    setHistory(prev => prev.slice(0, -stepsBack));
    setLastChanged(new Set());
    setLastPlaced(undefined);
    setWinningLine(new Set());
    setMsg("");
    setThinking(false);
    lastMoveRef.current = null;
  };

  const reset = () => {
    setWinner(null);
    setHistory([{ board: emptyBoard(), turn: "p1" }]);
    setLastChanged(new Set());
    setLastPlaced(undefined);
    setWinningLine(new Set());
    setMsg("");
    setThinking(false);
    lastMoveRef.current = null;
    setPlayerSide(null);
  };

  const levelLabels = {
    easy: "初級",
    medium: "中級",
    hard: "上級",
  };

  const sideLabels = {
    p1: "先手",
    p2: "後手",
  };

  const statusStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    padding: "6px 12px",
    borderRadius: 999,
    border: "2px solid var(--line)",
    textAlign: "center",
    background: winner
      ? "linear-gradient(180deg, #f9ecd4 0%, #e8c89a 100%)"
      : thinking
        ? "rgba(160, 80, 60, 0.18)"
        : "rgba(70, 110, 160, 0.18)",
  };

  if (playerSide === null) {
    return (
      <main style={{ padding: isMobile ? 12 : 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 32, background: "linear-gradient(180deg, #f5e6d3 0%, #e8d4b8 100%)" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 36, fontWeight: 900, marginBottom: 12, color: "#2c1810", fontFamily: "serif", letterSpacing: "0.1em" }}>一正</h1>
          <p style={{ fontSize: 14, color: "#5c4a3a", letterSpacing: "0.05em" }}>対局設定</p>
        </div>

        <div style={{ display: "grid", gap: 28, maxWidth: 500, width: "100%", padding: isMobile ? 20 : 40, background: "linear-gradient(180deg, #faf4e8 0%, #f0e6d2 100%)", borderRadius: 8, border: "3px solid #8b6f47", boxShadow: "0 8px 24px rgba(44, 24, 16, 0.3), inset 0 2px 4px rgba(255,255,255,0.5)" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ textAlign: "center", padding: "8px 0", borderBottom: "2px solid #8b6f47" }}>
              <span style={{ fontWeight: 900, fontSize: 18, color: "#2c1810", fontFamily: "serif", letterSpacing: "0.1em" }}>段位選択</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {(Object.keys(levelLabels) as CpuLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => setCpuLevel(level)}
                  style={{
                    padding: "20px 12px",
                    borderRadius: 4,
                    border: cpuLevel === level ? "3px solid #d4af37" : "2px solid #8b6f47",
                    background: cpuLevel === level
                      ? "linear-gradient(180deg, #f9f3e3 0%, #e8d4a0 100%)"
                      : "linear-gradient(180deg, #fdfbf5 0%, #f5ead0 100%)",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 16,
                    color: "#2c1810",
                    fontFamily: "serif",
                    boxShadow: cpuLevel === level 
                      ? "0 4px 12px rgba(212, 175, 55, 0.4), inset 0 1px 2px rgba(255,255,255,0.8)" 
                      : "0 2px 6px rgba(44, 24, 16, 0.2), inset 0 1px 2px rgba(255,255,255,0.6)",
                    transition: "all 0.2s",
                    letterSpacing: "0.05em",
                  }}
                >
                  {levelLabels[level]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 2, background: "#8b6f47", margin: "4px 0" }} />

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ textAlign: "center", padding: "8px 0", borderBottom: "2px solid #8b6f47" }}>
              <span style={{ fontWeight: 900, fontSize: 18, color: "#2c1810", fontFamily: "serif", letterSpacing: "0.1em" }}>手番選択</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {(Object.keys(sideLabels) as Player[]).map(side => (
                <button
                  key={side}
                  onClick={() => setPlayerSide(side)}
                  style={{
                    padding: "24px 20px",
                    borderRadius: 4,
                    border: "3px solid #8b6f47",
                    background: "linear-gradient(180deg, #fdfbf5 0%, #f0e6d2 100%)",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 20,
                    color: "#2c1810",
                    fontFamily: "serif",
                    boxShadow: "0 4px 12px rgba(44, 24, 16, 0.25), inset 0 1px 2px rgba(255,255,255,0.6)",
                    transition: "all 0.15s",
                    letterSpacing: "0.1em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(44, 24, 16, 0.35), inset 0 1px 2px rgba(255,255,255,0.6)";
                    e.currentTarget.style.background = "linear-gradient(180deg, #fff 0%, #f5ead0 100%)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(44, 24, 16, 0.25), inset 0 1px 2px rgba(255,255,255,0.6)";
                    e.currentTarget.style.background = "linear-gradient(180deg, #fdfbf5 0%, #f0e6d2 100%)";
                  }}
                >
                  {sideLabels[side]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Link 
          href="/" 
          style={{ 
            ...btnStyle, 
            textAlign: "center", 
            fontSize: 14, 
            padding: "10px 20px",
            fontFamily: "serif",
            letterSpacing: "0.05em",
            border: "2px solid #8b6f47",
            background: "linear-gradient(180deg, #fdfbf5 0%, #f0e6d2 100%)",
          }}
        >
          ← 戻る
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: isMobile ? 12 : 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>一正（CPU対戦）</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        <span style={{ fontWeight: 700 }}>難易度: {levelLabels[cpuLevel]}</span>
        <span style={{ fontWeight: 700 }}>| あなた: {sideLabels[playerSide]}</span>
      </div>

      {!isMobile && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={statusStyle}>
            {winner
              ? winner === playerSide ? "あなたの勝ち！" : "CPUの勝ち！"
              : thinking ? "CPUが考え中..." : "あなたの手番"}
          </div>
          <button onClick={undo} disabled={history.length <= 1} style={btnStyle}>1手戻す</button>
          <button onClick={reset} style={btnStyle}>リセット</button>
          <Link href="/" style={btnStyle}>ホームへ戻る</Link>
        </div>
      )}

      {isMobile && (
        <div style={{ width: "100%", maxWidth: 760, display: "grid", gap: 8 }}>
          <div style={statusStyle}>
            {winner
              ? winner === playerSide ? "あなたの勝ち！" : "CPUの勝ち！"
              : thinking ? "CPUが考え中..." : "あなたの手番"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={undo} disabled={history.length <= 1} style={btnStyle}>1手戻す</button>
            <button onClick={reset} style={btnStyle}>リセット</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <Link href="/" style={{ ...btnStyle, textAlign: "center" }}>ホームへ戻る</Link>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 760 }}>
          {msg}
        </div>
      )}

      <Board board={current.board} onClickCell={onClickCell} lastChanged={lastChanged} lastPlaced={lastPlaced} disabled={!canPlay} winningLine={winningLine} />
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "linear-gradient(180deg, #fff8ec 0%, #f1dfbf 100%)",
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--ink)",
  boxShadow: "0 2px 8px rgba(120, 80, 40, 0.15)",
  transition: "all 0.2s",
};
