"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import { applyMove, emptyBoard, getAllWinningLines, type Player } from "@/lib/gameLogic";
import { saveMatchToSupabase, type MoveRecord } from "@/lib/saveMatch";
import { supabase } from "@/lib/supabaseClient";
import { loadCurrentProfilePrefsFromProfiles } from "@/lib/profilePrefs";

type Snapshot = {
  board: number[];
  turn: Player;
};

const ROW_LABELS = ["春", "夏", "秋", "冬", "廻"] as const;
const COL_LABELS_LEFT_TO_RIGHT = ["五", "四", "三", "二", "一"] as const;

function posToLabel(pos: number): string {
  const row = Math.floor(pos / 5);
  const col = pos % 5;
  const rowLabel = ROW_LABELS[row] ?? "?";
  const colLabel = COL_LABELS_LEFT_TO_RIGHT[col] ?? "?";
  return `${colLabel}${rowLabel}`;
}

export default function PlayPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([{ board: emptyBoard(), turn: "p1" }]);
  const current = history[history.length - 1];

  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [lastPlaced, setLastPlaced] = useState<number | undefined>(undefined);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winningLine, setWinningLine] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const canPlay = winner === null;

  const onClickCell = (pos: number) => {
    if (!canPlay) return;
    const res = applyMove(current.board, pos, current.turn);
    if (!res.ok) {
      setMsg(res.reason);
      return;
    }

    const nextTurn: Player = current.turn === "p1" ? "p2" : "p1";
    setHistory(prev => [...prev, { board: res.newBoard, turn: nextTurn }]);
    setLastChanged(new Set(res.changed.map(x => x.i)));
    setLastPlaced(pos);
    setMsg("");

    const ply = moves.length + 1;
    setMoves(prev => [...prev, { ply, player: current.turn, pos, diff: res.changed, board_after: res.newBoard }]);

    if (res.winner) {
      setWinner(res.winner);
      setMsg(res.winner === "p1" ? "先手の勝ち！" : "後手の勝ち！");
      const lines = getAllWinningLines(res.newBoard);
      if (lines.length > 0) setWinningLine(new Set(lines));
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    if (winner) setWinner(null);
    setHistory(prev => prev.slice(0, -1));
    setMoves(prev => prev.slice(0, -1));
    setLastChanged(new Set());
    setLastPlaced(undefined);
    setWinningLine(new Set());
    setMsg("");
  };

  const reset = () => {
    setWinner(null);
    setHistory([{ board: emptyBoard(), turn: "p1" }]);
    setMoves([]);
    setLastChanged(new Set());
    setLastPlaced(undefined);
    setWinningLine(new Set());
    setMsg("");
  };

  const save = async () => {
    if (!winner) {
      setMsg("勝敗が決まってから保存できます。");
      return;
    }

    setSaving(true);
    const protectedIdsSet = new Set<string>();
    try {
      const loaded = await loadCurrentProfilePrefsFromProfiles();
      if (loaded.ok) {
        for (const id of loaded.prefs.starredIds) protectedIdsSet.add(id);
        for (const id of loaded.prefs.featuredIds) protectedIdsSet.add(id);
      }
    } catch {
      // ignore auth / metadata fetch errors
    }

    const res = await saveMatchToSupabase({
      winner,
      final_board: current.board,
      moves,
      protectedMatchIds: Array.from(protectedIdsSet),
    });
    setSaving(false);

    if (!res.ok) {
      setMsg(res.reason);
      return;
    }
    setMsg(res.warning ? `保存しました（棋譜ID: ${res.matchId}）。${res.warning}` : `保存しました（棋譜ID: ${res.matchId}）`);
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
      : current.turn === "p1"
        ? "rgba(70, 110, 160, 0.18)"
        : "rgba(160, 80, 60, 0.18)",
  };

  return (
    <main style={{ padding: isMobile ? 12 : 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>一正（ホットシート対戦）</h1>

      {!isMobile && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={statusStyle}>
            {winner
              ? `勝者: ${winner === "p1" ? "先手" : "後手"}`
              : `手番: ${current.turn === "p1" ? "先手（2/4）" : "後手（1/3/5）"}`}
          </div>
          <button onClick={undo} disabled={history.length <= 1} style={btnStyle}>1手戻す</button>
          <button onClick={save} disabled={!winner || saving} style={btnStyle}>
            {saving ? "保存中..." : "棋譜を保存"}
          </button>
          <button onClick={reset} style={btnStyle}>リセット</button>
          <Link href="/" style={btnStyle}>ホームへ戻る</Link>
        </div>
      )}

      {isMobile && (
        <div style={{ width: "100%", maxWidth: 760, display: "grid", gap: 8 }}>
          <div style={statusStyle}>
            {winner
              ? `勝者: ${winner === "p1" ? "先手" : "後手"}`
              : `手番: ${current.turn === "p1" ? "先手（2/4）" : "後手（1/3/5）"}`}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={undo} disabled={history.length <= 1} style={btnStyle}>1手戻す</button>
            <button onClick={save} disabled={!winner || saving} style={btnStyle}>
              {saving ? "保存中..." : "棋譜を保存"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={reset} style={btnStyle}>リセット</button>
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

      <details style={{ width: "100%", maxWidth: 760 }} open={!isMobile ? undefined : false}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>棋譜（手順）</summary>
        <ol>
          {moves.map(m => (
            <li key={m.ply}>
              {m.ply}. {m.player === "p1" ? "先手" : "後手"} 置き: {posToLabel(m.pos)}
            </li>
          ))}
        </ol>
      </details>
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
  boxShadow: "0 2px 0 rgba(120, 80, 40, 0.25)",
};
