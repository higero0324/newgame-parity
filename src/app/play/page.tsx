"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Board from "@/components/Board";
import { applyMove, emptyBoard, type Player } from "@/lib/gameLogic";
import { saveMatchToSupabase, type MoveRecord } from "@/lib/saveMatch";

type Snapshot = {
  board: number[];
  turn: Player;
};

export default function PlayPage() {
  const [history, setHistory] = useState<Snapshot[]>([{ board: emptyBoard(), turn: "p1" }]);
  const current = history[history.length - 1];

  const [lastChanged, setLastChanged] = useState<Set<number>>(new Set());
  const [winner, setWinner] = useState<Player | null>(null);

  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const turnLabel = current.turn === "p1" ? "先手（2/4）" : "後手（1/3/5）";

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
    setMsg("");

    const ply = moves.length + 1;
    setMoves(prev => [
      ...prev,
      {
        ply,
        player: current.turn,
        pos,
        diff: res.changed,
        board_after: res.newBoard,
      },
    ]);

    if (res.winner) {
      setWinner(res.winner);
      setMsg(res.winner === "p1" ? "先手の勝ち！" : "後手の勝ち！");
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    if (winner) setWinner(null);
    setHistory(prev => prev.slice(0, -1));
    setMoves(prev => prev.slice(0, -1));
    setLastChanged(new Set());
    setMsg("");
  };

  const reset = () => {
    setWinner(null);
    setHistory([{ board: emptyBoard(), turn: "p1" }]);
    setMoves([]);
    setLastChanged(new Set());
    setMsg("");
  };

  const save = async () => {
    if (!winner) {
      setMsg("勝敗が決まってから保存できます。");
      return;
    }
    setSaving(true);
    const res = await saveMatchToSupabase({
      winner,
      final_board: current.board,
      moves,
    });
    setSaving(false);
    setMsg(res.ok ? `保存しました（棋譜ID: ${res.matchId}）` : "保存に失敗しました。");
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 16, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>一正（ホットシート対戦）</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            padding: "6px 12px",
            borderRadius: 999,
            border: "2px solid var(--line)",
            background: winner
              ? "linear-gradient(180deg, #f9ecd4 0%, #e8c89a 100%)"
              : current.turn === "p1"
                ? "rgba(70, 110, 160, 0.18)"
                : "rgba(160, 80, 60, 0.18)",
          }}
        >
          {winner
            ? `勝者: ${winner === "p1" ? "先手" : "後手"}`
            : `手番: ${current.turn === "p1" ? "先手（2/4）" : "後手（1/3/5）"}`}
        </div>
        <Link href="/" style={btnStyle}>
          ホームへ戻る
        </Link>
        <button onClick={undo} disabled={history.length <= 1} style={btnStyle}>
          1手戻す
        </button>
        <button onClick={reset} style={btnStyle}>
          リセット
        </button>
        <button onClick={save} disabled={!winner || saving} style={btnStyle}>
          {saving ? "保存中…" : "棋譜を保存（ログイン時のみ）"}
        </button>
      </div>

      {msg && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 720 }}>
          {msg}
        </div>
      )}

      <Board board={current.board} onClickCell={onClickCell} lastChanged={lastChanged} disabled={!canPlay} />

      <details style={{ width: "100%", maxWidth: 720 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>棋譜（手順）</summary>
        <ol>
          {moves.map(m => (
            <li key={m.ply}>
              {m.ply}. {m.player === "p1" ? "先手" : "後手"} 置き: {m.pos}
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
