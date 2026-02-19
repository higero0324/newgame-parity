"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Board from "@/components/Board";
import ShoGlyph from "@/components/ShoGlyph";
import { applyMove, emptyBoard, getAllWinningLines, idx, ownerOf, SIZE, type Player } from "@/lib/gameLogic";
import { calculateAnimationDuration } from "@/lib/animationTiming";
import { findShogoCpuMove } from "@/lib/cpuPlayer";
import { supabase } from "@/lib/supabaseClient";
import { recordShogoMatchForCurrentUser } from "@/lib/achievements";

type Snapshot = {
  board: number[];
  turn: Player;
};

type LastMove = {
  changed: Array<{ i: number; from: number; to: number }>;
  placedPos: number;
};

const SHOGO_MAIN_TIME_MS = 10 * 60 * 1000;
const SHOGO_BYOYOMI_MS = 10 * 1000;
const CLOCK_TICK_MS = 100;

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

function splitShoPointUnits(score: number): number[] {
  const safe = Math.max(0, Math.floor(score));
  const full = Math.floor(safe / 5);
  const rem = safe % 5;
  const units = Array.from({ length: full }, () => 5);
  if (rem > 0) units.push(rem);
  return units;
}

function formatClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
  const [showDetails, setShowDetails] = useState(false);
  const [playerMainTimeMs, setPlayerMainTimeMs] = useState(SHOGO_MAIN_TIME_MS);
  const [byoyomiMs, setByoyomiMs] = useState<number | null>(null);
  const [scoreReveal, setScoreReveal] = useState<{
    open: boolean;
    winner: "player" | "cpu";
    gained: number;
    base: number;
    addedShown: number;
  }>({ open: false, winner: "player", gained: 0, base: 0, addedShown: 0 });
  const [matchFinishReveal, setMatchFinishReveal] = useState<{
    open: boolean;
    result: "win" | "lose";
    playerScore: number;
    cpuScore: number;
  }>({ open: false, result: "win", playerScore: 0, cpuScore: 0 });
  const lastMoveRef = useRef<LastMove | null>(null);
  const resultRecordedRef = useRef(false);
  const revealTimersRef = useRef<number[]>([]);

  const clearRevealTimers = () => {
    revealTimersRef.current.forEach(t => window.clearTimeout(t));
    revealTimersRef.current = [];
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await supabase.auth.getSession();
      if (!alive) return;
      if (loaded.error || !loaded.data.session?.user) {
        router.replace("/login");
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

  useEffect(() => {
    return () => {
      clearRevealTimers();
    };
  }, []);

  const canPlay = winner === null && current.turn === playerSide && !thinking;
  const inSuddenDeath = playerMainTimeMs <= 0;

  useEffect(() => {
    if (!canPlay || !playerSide || shogoMatchWinner) return;
    if (playerMainTimeMs <= 0) return;
    const timer = window.setInterval(() => {
      setPlayerMainTimeMs(prev => Math.max(0, prev - CLOCK_TICK_MS));
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [canPlay, playerSide, shogoMatchWinner, playerMainTimeMs]);

  useEffect(() => {
    if (!canPlay || !playerSide || shogoMatchWinner || playerMainTimeMs > 0) {
      setByoyomiMs(null);
      return;
    }
    setByoyomiMs(prev => (prev === null ? SHOGO_BYOYOMI_MS : prev));
  }, [canPlay, playerSide, shogoMatchWinner, playerMainTimeMs, current.turn]);

  useEffect(() => {
    if (!canPlay || !playerSide || shogoMatchWinner || playerMainTimeMs > 0 || byoyomiMs === null) return;
    const timer = window.setInterval(() => {
      setByoyomiMs(prev => (prev === null ? null : Math.max(0, prev - CLOCK_TICK_MS)));
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [canPlay, playerSide, shogoMatchWinner, playerMainTimeMs, byoyomiMs]);


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
        const pos = findShogoCpuMove(current.board, cpuSide);
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

  const placePlayerMove = (pos: number, fromTimeout = false) => {
    if (!canPlay || !playerSide) return false;
    const res = applyMove(current.board, pos, playerSide);
    if (!res.ok) {
      if (!fromTimeout) setMsg(res.reason);
      return false;
    }
    lastMoveRef.current = { changed: res.changed, placedPos: pos };
    const nextTurn: Player = playerSide === "p1" ? "p2" : "p1";
    setHistory(prev => [...prev, { board: res.newBoard, turn: nextTurn }]);
    setLastChanged(new Set(res.changed.map(x => x.i)));
    setLastPlaced(pos);
    setByoyomiMs(null);
    if (fromTimeout) {
      setMsg("秒読み時間切れのため、ランダムに着手しました。");
    } else {
      setMsg("");
    }
    if (res.winner) handleRoundWin(res.winner, res.newBoard);
    return true;
  };

  useEffect(() => {
    if (!canPlay || !playerSide || shogoMatchWinner) return;
    if (playerMainTimeMs > 0) return;
    if (byoyomiMs === null || byoyomiMs > 0) return;
    const legal = current.board
      .map((v, i) => (v === 0 ? i : -1))
      .filter(i => i >= 0)
      .filter(pos => applyMove(current.board, pos, playerSide).ok);
    if (legal.length === 0) return;
    const pos = legal[Math.floor(Math.random() * legal.length)];
    placePlayerMove(pos, true);
  }, [byoyomiMs, canPlay, current.board, playerMainTimeMs, playerSide, shogoMatchWinner]);

  if (!ready) {
    return <main style={{ padding: 24, textAlign: "center", color: "#666" }}>読み込み中...</main>;
  }

  const handleRoundWin = (roundWinner: Player, boardAfter: number[]) => {
    if (!playerSide) return;
    setWinner(roundWinner);
    const lines = getAllWinningLines(boardAfter);
    if (lines.length > 0) setWinningLine(new Set(lines));

    const linePoints = countWinningLinesForPlayer(boardAfter, roundWinner);
    const boardFilled = boardAfter.every(v => v !== 0);
    let evenCount = 0;
    let oddCount = 0;
    for (const v of boardAfter) {
      if (v % 2 === 0) evenCount += 1;
      else oddCount += 1;
    }
    const countWinner: Player = evenCount > oddCount ? "p1" : "p2";
    const countWinBonus = boardFilled && countWinner === roundWinner ? 1 : 0;
    const gained = Math.min(3, linePoints + countWinBonus);
    const playerWonRound = roundWinner === playerSide;

    clearRevealTimers();
    const baseScore = playerWonRound ? shogoScore.player : shogoScore.cpu;
    setScoreReveal({
      open: true,
      winner: playerWonRound ? "player" : "cpu",
      gained,
      base: baseScore,
      addedShown: 0,
    });
    for (let i = 1; i <= gained; i += 1) {
      const timer = window.setTimeout(() => {
        setScoreReveal(prev => ({ ...prev, addedShown: i }));
      }, 260 * i);
      revealTimersRef.current.push(timer);
    }
    const closeTimer = window.setTimeout(() => {
      setScoreReveal(prev => ({ ...prev, open: false }));
    }, Math.max(1200, 260 * gained + 900));
    revealTimersRef.current.push(closeTimer);

    const nextPlayerScore = shogoScore.player + (playerWonRound ? gained : 0);
    const nextCpuScore = shogoScore.cpu + (playerWonRound ? 0 : gained);
    setShogoScore({ player: nextPlayerScore, cpu: nextCpuScore });
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
      const finishTimer = window.setTimeout(() => {
        setMatchFinishReveal({
          open: true,
          result: playerWonMatch ? "win" : "lose",
          playerScore: nextPlayerScore,
          cpuScore: nextCpuScore,
        });
      }, Math.max(1200, 260 * gained + 900) + 160);
      revealTimersRef.current.push(finishTimer);
      return;
    }
    setMsg(`第${shogoRound}局: ${playerWonRound ? "あなた" : "CPU"}が${gained}点獲得`);
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
    clearRevealTimers();
    setScoreReveal({ open: false, winner: "player", gained: 0, base: 0, addedShown: 0 });
    setByoyomiMs(null);
    setMsg("");
  };

  const resetMatch = () => {
    const ok = window.confirm("再挑戦すると第1局からやり直しになります。よろしいですか？");
    if (!ok) return;
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
    setPlayerMainTimeMs(SHOGO_MAIN_TIME_MS);
    lastMoveRef.current = null;
    resultRecordedRef.current = false;
    clearRevealTimers();
    setScoreReveal({ open: false, winner: "player", gained: 0, base: 0, addedShown: 0 });
    setMatchFinishReveal({ open: false, result: "win", playerScore: 0, cpuScore: 0 });
    setByoyomiMs(null);
    setMsg("");
  };

  const backToShogoLobby = () => {
    clearRevealTimers();
    setScoreReveal({ open: false, winner: "player", gained: 0, base: 0, addedShown: 0 });
    setMatchFinishReveal({ open: false, result: "win", playerScore: 0, cpuScore: 0 });
    setPlayerMainTimeMs(SHOGO_MAIN_TIME_MS);
    setByoyomiMs(null);
    setPlayerSide(null);
  };

  const onClickCell = (pos: number) => {
    placePlayerMove(pos, false);
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
            一正を極めんとする季士は、ここを乗り越えよ。<br />
            毎局ランダムに2手置かれた状態から開始。<br />
            先に5点獲得で勝利。
          </div>
          <button type="button" onClick={() => setShowDetails(v => !v)} style={shogoDetailButtonStyle}>
            {showDetails ? "詳細を閉じる" : "詳細"}
          </button>
          {showDetails && (
            <section style={shogoDetailPanelStyle}>
              <div style={shogoDetailHeadingStyle}>正豪戦ルール詳細</div>
              <div style={shogoDetailLineStyle}>・毎局、盤面にランダムな2手（先手1手・後手1手）が置かれた状態で開始</div>
              <div style={shogoDetailLineStyle}>・1局ごとに先手後手が入れ替わる</div>
              <div style={shogoDetailLineStyle}>・先に5点獲得した側がマッチ勝利</div>
              <div style={shogoDetailLineStyle}>・一試合の持ち時間はあなた側のみ10分</div>
              <div style={shogoDetailLineStyle}>・持ち時間が0になると毎手10秒の秒読みへ移行</div>
              <div style={shogoDetailLineStyle}>・秒読みで時間切れになるとランダムに着手される</div>
              <div style={{ ...shogoDetailHeadingStyle, marginTop: 6 }}>得点方法一覧</div>
              <div style={shogoScoreListStyle}>
                <div style={shogoScoreListRowStyle}><span>一列揃える</span><b>+1点（列ごと）</b></div>
                <div style={shogoScoreListRowStyle}><span>盤面が全部埋まり、個数勝利</span><b>+1点</b></div>
                <div style={shogoScoreListRowStyle}><span>1局の最大得点</span><b>3点</b></div>
              </div>
            </section>
          )}
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
                  setPlayerMainTimeMs(SHOGO_MAIN_TIME_MS);
                  setByoyomiMs(null);
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
          <Link href="/" style={shogoBackLinkStyle}>ホームへ戻る</Link>
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
        <div style={clockPanelStyle}>
          <div style={clockMainRowStyle}>
            <span>持ち時間</span>
            <b style={clockMainValueStyle}>{formatClock(playerMainTimeMs)}</b>
          </div>
          <div style={clockTrackStyle}>
            <div
              style={{
                ...clockFillStyle,
                width: `${Math.max(0, Math.min(100, (playerMainTimeMs / SHOGO_MAIN_TIME_MS) * 100))}%`,
              }}
            />
          </div>
          {inSuddenDeath && (
            <div style={byoyomiRowStyle}>
              <span>秒読み</span>
              <b style={byoyomiValueStyle}>{Math.max(0, Math.ceil((byoyomiMs ?? SHOGO_BYOYOMI_MS) / 1000))}秒</b>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setShowDetails(v => !v)} style={shogoDetailButtonCompactStyle}>
          {showDetails ? "詳細を閉じる" : "詳細"}
        </button>
        {showDetails && (
          <section style={shogoDetailPanelStyle}>
            <div style={shogoDetailHeadingStyle}>正豪戦ルール詳細</div>
            <div style={shogoDetailLineStyle}>・毎局、盤面にランダムな2手（先手1手・後手1手）が置かれた状態で開始</div>
            <div style={shogoDetailLineStyle}>・1局ごとに先手後手が入れ替わる</div>
            <div style={shogoDetailLineStyle}>・先に5点獲得した側がマッチ勝利</div>
            <div style={shogoDetailLineStyle}>・一試合の持ち時間はあなた側のみ10分</div>
            <div style={shogoDetailLineStyle}>・持ち時間が0になると毎手10秒の秒読みへ移行</div>
            <div style={shogoDetailLineStyle}>・秒読みで時間切れになるとランダムに着手される</div>
            <div style={{ ...shogoDetailHeadingStyle, marginTop: 6 }}>得点方法一覧</div>
            <div style={shogoScoreListStyle}>
              <div style={shogoScoreListRowStyle}><span>一列揃える</span><b>+1点（列ごと）</b></div>
              <div style={shogoScoreListRowStyle}><span>盤面が全部埋まり、個数勝利</span><b>+1点</b></div>
              <div style={shogoScoreListRowStyle}><span>1局の最大得点</span><b>3点</b></div>
            </div>
          </section>
        )}
      </div>

      <div style={shogoActionRowStyle}>
        <div style={shogoStatusStyle}>
          {winner ? (winner === playerSide ? "あなたの勝ち" : "CPUの勝ち") : thinking ? "CPUが考え中..." : "あなたの手番"}
        </div>
        {shogoRoundEnded && !shogoMatchWinner && <button onClick={startNextRound} style={shogoButtonStyle}>次局へ</button>}
        <button onClick={resetMatch} style={shogoButtonStyle}>再挑戦</button>
        <button onClick={backToShogoLobby} style={shogoButtonStyle}>正豪の間へ戻る</button>
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

      {scoreReveal.open && (
        <div style={scoreRevealOverlayStyle} aria-live="polite">
          <div style={scoreRevealCardStyle}>
            <div style={scoreRevealTitleStyle}>
              {scoreReveal.winner === "player" ? "あなたの累計得点" : "CPUの累計得点"}
            </div>
            <div style={scoreRevealMarksStyle}>
              <span style={scoreRevealGlyphRowBaseStyle}>
                {splitShoPointUnits(scoreReveal.base).map((unit, i) => (
                  <span key={`base-${i}`} style={scoreRevealGlyphWrapStyle}>
                    <ShoGlyph value={unit} strokeColor="rgba(255,255,255,0.7)" />
                  </span>
                ))}
              </span>
              <span style={scoreRevealGlyphRowAddedStyle}>
                {splitShoPointUnits(scoreReveal.addedShown).map((unit, i) => (
                  <span key={`add-${i}`} style={scoreRevealGlyphWrapStyle}>
                    <ShoGlyph value={unit} strokeColor="#ffffff" />
                  </span>
                ))}
              </span>
            </div>
            <div style={scoreRevealSubStyle}>
              {toShoMarks(scoreReveal.base)} → {toShoMarks(scoreReveal.base + scoreReveal.addedShown)}（+{scoreReveal.gained}）
            </div>
          </div>
        </div>
      )}

      {matchFinishReveal.open && (
        <div
          style={{
            ...matchFinishOverlayStyle,
            background:
              matchFinishReveal.result === "win"
                ? "radial-gradient(circle at center, rgba(255,230,166,0.2) 0%, rgba(17,6,8,0.55) 72%)"
                : "radial-gradient(circle at center, rgba(140,170,255,0.12) 0%, rgba(6,10,18,0.62) 72%)",
          }}
          aria-live="polite"
        >
          <div
            style={{
              ...matchFinishCardStyle,
              borderColor: matchFinishReveal.result === "win" ? "rgba(248, 213, 142, 0.85)" : "rgba(164, 184, 240, 0.8)",
              background:
                matchFinishReveal.result === "win"
                  ? "linear-gradient(160deg, rgba(68,18,24,0.95) 0%, rgba(113,27,36,0.9) 55%, rgba(24,8,11,0.94) 100%)"
                  : "linear-gradient(160deg, rgba(20,28,56,0.95) 0%, rgba(30,44,88,0.9) 55%, rgba(10,16,35,0.94) 100%)",
            }}
          >
            <div style={matchFinishSubStyle}>最終結果</div>
            <div style={matchFinishTitleStyle}>
              {matchFinishReveal.result === "win" ? "勝 利" : "敗 北"}
            </div>
            <div style={matchFinishScoreStyle}>
              {matchFinishReveal.playerScore} - {matchFinishReveal.cpuScore}
            </div>
            <button
              type="button"
              style={matchFinishCloseStyle}
              onClick={() => setMatchFinishReveal(prev => ({ ...prev, open: false }))}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
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

const shogoDetailButtonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(248, 213, 142, 0.72)",
  background: "rgba(255, 230, 172, 0.12)",
  color: "#fff1d5",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const shogoDetailButtonCompactStyle: React.CSSProperties = {
  ...shogoDetailButtonStyle,
  justifySelf: "start",
  fontSize: 12,
  padding: "6px 10px",
};

const shogoDetailPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  borderRadius: 10,
  border: "1px solid rgba(248, 213, 142, 0.4)",
  background: "rgba(255, 233, 181, 0.1)",
  padding: "10px 12px",
};

const shogoDetailHeadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#ffe8bd",
};

const shogoDetailLineStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#f7e3bf",
  lineHeight: 1.5,
};

const shogoScoreListStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const shogoScoreListRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 12,
  color: "#fff1d5",
};

const clockPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  borderRadius: 10,
  border: "1px solid rgba(248, 213, 142, 0.34)",
  background: "rgba(255, 229, 170, 0.08)",
  padding: "8px 10px",
};

const clockMainRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: "#f7e3bf",
};

const clockMainValueStyle: React.CSSProperties = {
  fontSize: 18,
  letterSpacing: "0.06em",
  color: "#fff1d5",
  fontFamily: "var(--font-hisei-mono), monospace",
};

const clockTrackStyle: React.CSSProperties = {
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(255, 233, 182, 0.2)",
};

const clockFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #f6d68e 0%, #d88f2c 100%)",
  transition: "width 120ms linear",
};

const byoyomiRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: "#ffe8b9",
};

const byoyomiValueStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#ffd076",
  fontWeight: 900,
  textShadow: "0 0 10px rgba(255, 184, 72, 0.45)",
  fontFamily: "var(--font-hisei-mono), monospace",
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

const scoreRevealOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 85,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  background: "radial-gradient(circle at center, rgba(255, 219, 145, 0.12) 0%, rgba(15, 5, 7, 0.32) 70%)",
};

const scoreRevealCardStyle: React.CSSProperties = {
  minWidth: "min(86vw, 420px)",
  padding: "20px 22px",
  borderRadius: 16,
  border: "1px solid rgba(248, 213, 142, 0.82)",
  background: "linear-gradient(160deg, rgba(44,12,16,0.94) 0%, rgba(88,20,28,0.88) 52%, rgba(24,8,11,0.92) 100%)",
  boxShadow: "0 0 0 1px rgba(255,230,178,0.24), 0 22px 44px rgba(0,0,0,0.45)",
  display: "grid",
  gap: 6,
  justifyItems: "center",
};

const scoreRevealTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.06em",
  color: "#ffe6b8",
};

const scoreRevealMarksStyle: React.CSSProperties = {
  minHeight: 72,
  width: "100%",
  display: "grid",
  gap: 6,
};

const scoreRevealGlyphRowBaseStyle: React.CSSProperties = {
  minHeight: 36,
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  alignItems: "center",
  justifyContent: "center",
  opacity: 0.86,
};

const scoreRevealGlyphRowAddedStyle: React.CSSProperties = {
  minHeight: 36,
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  alignItems: "center",
  justifyContent: "center",
  filter: "drop-shadow(0 0 8px rgba(255, 237, 170, 0.92))",
};

const scoreRevealGlyphWrapStyle: React.CSSProperties = {
  width: 42,
  height: 42,
};

const scoreRevealSubStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#f9ddb0",
};

const matchFinishOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 92,
  display: "grid",
  placeItems: "center",
  padding: 16,
};

const matchFinishCardStyle: React.CSSProperties = {
  minWidth: "min(86vw, 420px)",
  padding: "20px 22px",
  borderRadius: 16,
  border: "1px solid",
  boxShadow: "0 0 0 1px rgba(255,240,210,0.2), 0 24px 52px rgba(0,0,0,0.5)",
  display: "grid",
  gap: 8,
  justifyItems: "center",
};

const matchFinishSubStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.08em",
  color: "#f5dfb6",
  opacity: 0.95,
};

const matchFinishTitleStyle: React.CSSProperties = {
  fontSize: 56,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: "0.12em",
  color: "#fff1d5",
  textShadow: "0 0 12px rgba(255, 220, 150, 0.45)",
  fontFamily: "var(--font-hisei-mincho-bold), var(--font-hisei-serif), serif",
};

const matchFinishScoreStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#ffe7bf",
};

const matchFinishCloseStyle: React.CSSProperties = {
  marginTop: 4,
  borderRadius: 10,
  border: "1px solid rgba(255, 225, 170, 0.7)",
  background: "rgba(255, 233, 185, 0.15)",
  color: "#fff1d5",
  padding: "7px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

