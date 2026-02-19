"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Board from "@/components/Board";
import { applyMove, emptyBoard, getAllWinningLines, idx, ownerOf, SIZE, type Player } from "@/lib/gameLogic";
import { calculateAnimationDuration } from "@/lib/animationTiming";
import { findCpuMove } from "@/lib/cpuPlayer";
import { loadAchievementStateForCurrentUser, recordShogoMatchForCurrentUser, SETSUGEKKA_TITLE_ID } from "@/lib/achievements";

type Snapshot = {
  board: number[];
  turn: Player;
};

type LastMove = {
  changed: Array<{ i: number; from: number; to: number }>;
  placedPos: number;
};

function countWinningLinesForPlayer(board: number[], player: Player): number {
  let count = 0;
  for (let r = 0; r < SIZE; r += 1) {
    const values = Array.from({ length: SIZE }, (_, c) => board[idx(r, c)]);
    if (values.every(v => ownerOf(v) === player)) count += 1;
  }
  for (let c = 0; c < SIZE; c += 1) {
    const values = Array.from({ length: SIZE }, (_, r) => board[idx(r, c)]);
    if (values.every(v => ownerOf(v) === player)) count += 1;
  }
  const d1 = Array.from({ length: SIZE }, (_, i) => board[idx(i, i)]);
  const d2 = Array.from({ length: SIZE }, (_, i) => board[idx(i, SIZE - 1 - i)]);
  if (d1.every(v => ownerOf(v) === player)) count += 1;
  if (d2.every(v => ownerOf(v) === player)) count += 1;
  return count;
}

function toShoMarks(score: number): string {
  const safe = Math.max(0, Math.floor(score));
  const full = Math.floor(safe / 5);
  const rem = safe % 5;
  return `${"正".repeat(full)}${["", "一", "二", "三", "四"][rem]}`;
}

function createShogoRoundStartState(): {
  history: Snapshot[];
  lastChanged: Set<number>;
  lastPlaced: number | undefined;
} {
  const pickRandomLegalMove = (board: number[], player: Player) => {
    const legal = Array.from({ length: board.length }, (_, i) => i).filter(pos => applyMove(board, pos, player).ok);
    if (legal.length === 0) return null;
    return legal[Math.floor(Math.random() * legal.length)];
  };

  const board0 = emptyBoard();
  const p1Pos = pickRandomLegalMove(board0, "p1");
  if (p1Pos === null) return { history: [{ board: board0, turn: "p1" }], lastChanged: new Set(), lastPlaced: undefined };

  const p1Res = applyMove(board0, p1Pos, "p1");
  if (!p1Res.ok) return { history: [{ board: board0, turn: "p1" }], lastChanged: new Set(), lastPlaced: undefined };

  const p2Pos = pickRandomLegalMove(p1Res.newBoard, "p2");
  if (p2Pos === null) {
    return {
      history: [{ board: p1Res.newBoard, turn: "p2" }],
      lastChanged: new Set(p1Res.changed.map(x => x.i)),
      lastPlaced: p1Pos,
    };
  }

  const p2Res = applyMove(p1Res.newBoard, p2Pos, "p2");
  if (!p2Res.ok) {
    return {
      history: [{ board: p1Res.newBoard, turn: "p2" }],
      lastChanged: new Set(p1Res.changed.map(x => x.i)),
      lastPlaced: p1Pos,
    };
  }

  return {
    history: [{ board: p2Res.newBoard, turn: "p1" }],
    lastChanged: new Set(p2Res.changed.map(x => x.i)),
    lastPlaced: p2Pos,
  };
}

export default function ShogoPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);
  const [playerSide, setPlayerSide] = useState<Player | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([{ board: emptyBoard(), turn: "p1" }]);
  const current = history[history.length - 1];
  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [lastPlaced, setLastPlaced] = useState<number | undefined>(undefined);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<Set<number>>(new Set());
  const [thinking, setThinking] = useState(false);
  const [msg, setMsg] = useState("");
  const [shogoScore, setShogoScore] = useState({ player: 0, cpu: 0 });
  const [shogoRound, setShogoRound] = useState(1);
  const [shogoRoundEnded, setShogoRoundEnded] = useState(false);
  const [shogoMatchWinner, setShogoMatchWinner] = useState<"player" | "cpu" | null>(null);
  const lastMoveRef = useRef<LastMove | null>(null);
  const resultRecordedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await loadAchievementStateForCurrentUser();
      if (!alive) return;
      if (!loaded.ok) {
        router.replace("/login");
        return;
      }
      const unlockedByAch = loaded.unlockedTitleIds.includes(SETSUGEKKA_TITLE_ID);
      const unlockedByDone = loaded.claimableTitleIds.includes(SETSUGEKKA_TITLE_ID);
      if (!unlockedByAch && !unlockedByDone) {
        window.alert("正豪戦は「雪月花」達成で開放されます。");
        router.replace("/achievements");
        return;
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!ready) {
    return <main style={{ padding: 24, textAlign: "center", color: "#666" }}>読み込み中...</main>;
  }

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
        const pos = findCpuMove(current.board, cpuSide, "hard");
        if (pos >= 0) {
          const res = applyMove(current.board, pos, cpuSide);
          if (res.ok) {
            lastMoveRef.current = { changed: res.changed, placedPos: pos };
            const nextTurn: Player = cpuSide === "p1" ? "p2" : "p1";
            setHistory(prev => [...prev, { board: res.newBoard, turn: nextTurn }]);
            setLastChanged(new Set(res.changed.map(x => x.i)));
            setLastPlaced(pos);
            if (res.winner) handleRoundWin(res.winner, res.newBoard);
          }
        }
        setThinking(false);
      }, delay);
    }
  }, [current, winner, thinking, playerSide, shogoRound, shogoMatchWinner]);

  const handleRoundWin = (roundWinner: Player, boardAfter: number[]) => {
    if (!playerSide) return;
    setWinner(roundWinner);
    const lines = getAllWinningLines(boardAfter);
    if (lines.length > 0) setWinningLine(new Set(lines));

    const linePoints = countWinningLinesForPlayer(boardAfter, roundWinner);
    const boardFilled = boardAfter.every(v => v !== 0);
    const countWinBonus = boardFilled && linePoints === 0 ? 1 : 0;
    const gained = Math.min(3, linePoints + countWinBonus);
    const playerWonRound = roundWinner === playerSide;

    let nextPlayerScore = 0;
    let nextCpuScore = 0;
    setShogoScore(prev => {
      nextPlayerScore = prev.player + (playerWonRound ? gained : 0);
      nextCpuScore = prev.cpu + (playerWonRound ? 0 : gained);
      return { player: nextPlayerScore, cpu: nextCpuScore };
    });
    setShogoRoundEnded(true);

    if (nextPlayerScore >= 5 || nextCpuScore >= 5) {
      const playerWonMatch = nextPlayerScore >= 5;
      setShogoMatchWinner(playerWonMatch ? "player" : "cpu");
      if (!resultRecordedRef.current) {
        resultRecordedRef.current = true;
        recordShogoMatchForCurrentUser(playerWonMatch).catch(() => {
          // ignore
        });
      }
      setMsg(
        playerWonMatch
          ? `正豪戦 勝利！ (最終 ${nextPlayerScore} - ${nextCpuScore})`
          : `正豪戦 敗北... (最終 ${nextPlayerScore} - ${nextCpuScore})`,
      );
      return;
    }
    setMsg(`第${shogoRound}局: ${playerWonRound ? "あなた" : "CPU"}が${gained}点獲得 (合計 ${nextPlayerScore} - ${nextCpuScore})`);
  };

  const startNextRound = () => {
    if (!playerSide || shogoMatchWinner) return;
    const nextPlayerSide: Player = playerSide === "p1" ? "p2" : "p1";
    const nextStart = createShogoRoundStartState();
    setPlayerSide(nextPlayerSide);
    setHistory(nextStart.history);
    setLastChanged(nextStart.lastChanged);
    setLastPlaced(nextStart.lastPlaced);
    setWinner(null);
    setWinningLine(new Set());
    setThinking(false);
    setShogoRoundEnded(false);
    setShogoRound(prev => prev + 1);
    lastMoveRef.current = null;
    resultRecordedRef.current = false;
    setMsg("");
  };

  const resetMatch = () => {
    const start = createShogoRoundStartState();
    setHistory(start.history);
    setLastChanged(start.lastChanged);
    setLastPlaced(start.lastPlaced);
    setWinner(null);
    setWinningLine(new Set());
    setThinking(false);
    setShogoScore({ player: 0, cpu: 0 });
    setShogoRound(1);
    setShogoRoundEnded(false);
    setShogoMatchWinner(null);
    lastMoveRef.current = null;
    resultRecordedRef.current = false;
    setMsg("");
  };

  const canPlay = winner === null && current.turn === playerSide && !thinking;

  const onClickCell = (pos: number) => {
    if (!canPlay || !playerSide) return;
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
    if (res.winner) handleRoundWin(res.winner, res.newBoard);
  };

  const sideLabels = {
    p1: "先手",
    p2: "後手",
  } satisfies Record<Player, string>;

  if (!playerSide) {
    return (
      <main style={shogoEntryMainStyle}>
        <div style={shogoBackdropGlowStyle} />
        <section style={shogoPanelStyle}>
          <h1 style={shogoTitleStyle}>正豪戦</h1>
          <p style={shogoSubtitleStyle}>極級++</p>
          <div style={shogoDescStyle}>
            CPUは上級相当。<br />
            毎局ランダム2手配置から開戦。<br />
            局ごとに先後交代、先に5点で勝利。
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
            {(Object.keys(sideLabels) as Player[]).map(side => (
              <button
                key={side}
                onClick={() => {
                  const start = createShogoRoundStartState();
                  setHistory(start.history);
                  setLastChanged(start.lastChanged);
                  setLastPlaced(start.lastPlaced);
                  setWinner(null);
                  setWinningLine(new Set());
                  setShogoScore({ player: 0, cpu: 0 });
                  setShogoRound(1);
                  setShogoRoundEnded(false);
                  setShogoMatchWinner(null);
                  setThinking(false);
                  lastMoveRef.current = null;
                  resultRecordedRef.current = false;
                  setMsg("");
                  setPlayerSide(side);
                }}
                style={shogoSideButtonStyle}
              >
                {sideLabels[side]}
              </button>
            ))}
          </div>
          <Link href="/" style={shogoBackLinkStyle}>← ホームへ戻る</Link>
        </section>
      </main>
    );
  }

  return (
    <main style={shogoBattleMainStyle}>
      <div style={shogoBattleBackdropStyle} />
      <h1 style={shogoBattleTitleStyle}>正豪戦</h1>
      <div style={shogoBattleMetaStyle}>難易度: 極級++ | あなた: {sideLabels[playerSide]}</div>

      <div style={shogoScoreCardStyle}>
        <div style={shogoRoundBadgeStyle}>第 {shogoRound} 局</div>
        <div style={shogoScoreRowStyle}><span>あなた</span><b>{toShoMarks(shogoScore.player)}</b><span>({shogoScore.player}点)</span></div>
        <div style={shogoScoreRowStyle}><span>CPU</span><b>{toShoMarks(shogoScore.cpu)}</b><span>({shogoScore.cpu}点)</span></div>
        <div style={{ fontSize: 12, opacity: 0.88 }}>先に5点獲得で勝利</div>
      </div>

      <div style={shogoActionRowStyle}>
        <div style={shogoStatusStyle}>
          {winner ? (winner === playerSide ? "あなたの勝ち！" : "CPUの勝ち！") : thinking ? "CPUが考え中..." : "あなたの手番"}
        </div>
        {shogoRoundEnded && !shogoMatchWinner && <button onClick={startNextRound} style={shogoButtonStyle}>次局へ</button>}
        <button onClick={resetMatch} style={shogoButtonStyle}>再挑戦</button>
        <Link href="/" style={shogoButtonStyle}>ホームへ戻る</Link>
      </div>

      {msg && <div style={shogoMessageStyle}>{msg}</div>}

      <Board
        board={current.board}
        onClickCell={onClickCell}
        lastChanged={lastChanged}
        lastPlaced={lastPlaced}
        disabled={!canPlay}
        winningLine={winningLine}
      />
    </main>
  );
}

const shogoEntryMainStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 20,
  position: "relative",
  overflow: "hidden",
  background: "radial-gradient(circle at 50% 20%, #6f0f18 0%, #2a090d 42%, #120406 100%)",
};

const shogoBackdropGlowStyle: React.CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background: "conic-gradient(from 0deg, rgba(244,205,122,0.16), rgba(255,255,255,0.02), rgba(244,205,122,0.2))",
  filter: "blur(34px)",
  animation: "spin 18s linear infinite",
};

const shogoPanelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  display: "grid",
  gap: 14,
  padding: "24px 20px",
  borderRadius: 14,
  border: "1px solid rgba(246, 213, 146, 0.65)",
  background: "linear-gradient(165deg, rgba(37, 12, 16, 0.9) 0%, rgba(68, 18, 22, 0.86) 45%, rgba(26, 8, 11, 0.92) 100%)",
  boxShadow: "0 24px 54px rgba(0,0,0,0.5), inset 0 0 24px rgba(248, 223, 164, 0.18)",
  color: "#f9ebd0",
  zIndex: 1,
};

const shogoTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 46,
  letterSpacing: "0.16em",
  textAlign: "center",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
  textShadow: "0 2px 18px rgba(244, 197, 111, 0.45)",
};

const shogoSubtitleStyle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  color: "#f2d7a2",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const shogoDescStyle: React.CSSProperties = {
  textAlign: "center",
  lineHeight: 1.6,
  color: "#f8e7c8",
  background: "rgba(255, 232, 183, 0.08)",
  border: "1px solid rgba(246, 213, 146, 0.35)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
};

const shogoSideButtonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(248, 213, 142, 0.75)",
  background: "linear-gradient(180deg, rgba(255,237,189,0.2) 0%, rgba(122,36,45,0.6) 100%)",
  color: "#fff3d5",
  fontWeight: 800,
  fontSize: 18,
  padding: "14px 10px",
  cursor: "pointer",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const shogoBackLinkStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  marginTop: 4,
  textDecoration: "none",
  color: "#f5ddb0",
  borderRadius: 10,
  border: "1px solid rgba(248, 213, 142, 0.52)",
  background: "rgba(255, 230, 172, 0.08)",
  padding: "10px 12px",
};

const shogoBattleMainStyle: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  padding: "18px 12px 24px",
  display: "grid",
  gap: 12,
  justifyItems: "center",
  background: "radial-gradient(circle at 50% 10%, #5d0d16 0%, #2a070b 45%, #120306 100%)",
};

const shogoBattleBackdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(120deg, rgba(255,215,125,0.06) 0%, rgba(255,255,255,0) 35%, rgba(255,215,125,0.08) 100%)",
};

const shogoBattleTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#fff1d5",
  fontSize: 36,
  letterSpacing: "0.14em",
  zIndex: 1,
  textShadow: "0 2px 20px rgba(255, 214, 134, 0.4)",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const shogoBattleMetaStyle: React.CSSProperties = {
  color: "#f6ddb0",
  fontSize: 14,
  zIndex: 1,
};

const shogoScoreCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  zIndex: 1,
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(248, 213, 142, 0.7)",
  background: "linear-gradient(180deg, rgba(44,12,16,0.86) 0%, rgba(26,8,11,0.92) 100%)",
  color: "#fff1d5",
  boxShadow: "0 12px 34px rgba(0,0,0,0.35)",
};

const shogoRoundBadgeStyle: React.CSSProperties = {
  justifySelf: "start",
  borderRadius: 999,
  border: "1px solid rgba(248, 213, 142, 0.8)",
  background: "rgba(255, 222, 159, 0.12)",
  padding: "4px 10px",
  fontWeight: 700,
};

const shogoScoreRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px 1fr auto",
  gap: 8,
  alignItems: "center",
};

const shogoActionRowStyle: React.CSSProperties = {
  zIndex: 1,
  width: "100%",
  maxWidth: 760,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
};

const shogoStatusStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(248, 213, 142, 0.72)",
  background: "rgba(255, 228, 168, 0.12)",
  color: "#fff0cf",
  fontWeight: 800,
};

const shogoButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(248, 213, 142, 0.72)",
  background: "linear-gradient(180deg, rgba(255,237,189,0.22) 0%, rgba(112, 30, 39, 0.62) 100%)",
  color: "#fff3d5",
  textDecoration: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const shogoMessageStyle: React.CSSProperties = {
  zIndex: 1,
  width: "100%",
  maxWidth: 760,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(248, 213, 142, 0.72)",
  background: "rgba(36, 11, 15, 0.86)",
  color: "#fff1d5",
};
