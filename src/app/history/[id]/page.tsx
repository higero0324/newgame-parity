"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Board from "@/components/Board";
import { emptyBoard } from "@/lib/gameLogic";
import { supabase } from "@/lib/supabaseClient";

type MoveRow = {
  ply: number;
  player: "p1" | "p2";
  pos: number;
  diff: Array<{ i: number; from: number; to: number }>;
  board_after: number[];
};

type MatchRow = {
  id: string;
  user_id: string;
  winner: "p1" | "p2";
  moves_count: number;
  created_at: string;
};

function toReplayError(error: unknown): string {
  const e = error as { message?: string };
  return `再生データの取得に失敗しました。詳細: ${e?.message ?? "unknown error"}`;
}

export default function MatchReplayPage() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id;

  const [status, setStatus] = useState("読み込み中...");
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    if (!matchId) return;

    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) {
          setStatus(`認証確認に失敗しました。詳細: ${authError.message}`);
          return;
        }
        if (!auth.user) {
          setStatus("未ログインです。");
          return;
        }

        const { data: m, error: matchError } = await supabase
          .from("matches")
          .select("id, user_id, winner, moves_count, created_at")
          .eq("id", matchId)
          .single();

        if (matchError) {
          setStatus(toReplayError(matchError));
          return;
        }
        const matchOwnerId = (m as MatchRow).user_id;
        const isOwner = matchOwnerId === auth.user.id;
        if (!isOwner) {
          const low = auth.user.id < matchOwnerId ? auth.user.id : matchOwnerId;
          const high = auth.user.id < matchOwnerId ? matchOwnerId : auth.user.id;
          const { data: fr, error: frError } = await supabase
            .from("friendships")
            .select("user_low_id")
            .eq("user_low_id", low)
            .eq("user_high_id", high)
            .maybeSingle();
          if (frError) {
            setStatus(`閲覧権限の確認に失敗しました。詳細: ${frError.message}`);
            return;
          }
          if (!fr) {
            setStatus("この季譜はフレンドのみ閲覧できます。");
            return;
          }
        }

        const { data: mv, error: movesError } = await supabase
          .from("moves")
          .select("ply, player, pos, diff, board_after")
          .eq("match_id", matchId)
          .order("ply", { ascending: true });

        if (movesError) {
          setStatus(toReplayError(movesError));
          return;
        }

        const list = (mv ?? []) as MoveRow[];
        setMatch(m as MatchRow);
        setMoves(list);
        setPly(list.length);
        setStatus("");
      } catch (err) {
        setStatus(toReplayError(err));
      }
    })();
  }, [matchId]);

  const currentBoard = useMemo(() => {
    if (ply <= 0) return emptyBoard();
    return moves[ply - 1]?.board_after ?? emptyBoard();
  }, [moves, ply]);

  const currentChanged = useMemo(() => {
    if (ply <= 0) return new Set<number>();
    const d = moves[ply - 1]?.diff ?? [];
    return new Set(d.map(x => x.i));
  }, [moves, ply]);

  const currentMove = ply > 0 ? moves[ply - 1] : null;

  return (
    <main style={{ padding: 24, display: "grid", gap: 12, justifyItems: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>季譜リプレイ</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/?menu=learn" style={btnStyle}>学びへ戻る</Link>
        <Link href="/history" style={btnStyle}>一覧に戻る</Link>
      </div>

      {status && (
        <div style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)", width: "100%", maxWidth: 760 }}>
          {status}
        </div>
      )}

      {!status && match && (
        <>
          <div style={{ width: "100%", maxWidth: 760, padding: 12, border: "1px solid var(--line)", borderRadius: 12, background: "rgba(255,255,255,0.6)" }}>
            <div><b>対局日時:</b> {new Date(match.created_at).toLocaleString()}</div>
            <div><b>勝者:</b> {match.winner === "p1" ? "先手" : "後手"}</div>
            <div><b>手数:</b> {moves.length}</div>
            <div><b>現在手:</b> {ply} / {moves.length}</div>
            {currentMove && (
              <div><b>直近手:</b> {currentMove.ply}手目 {currentMove.player === "p1" ? "先手" : "後手"}</div>
            )}
          </div>

          <Board
            board={currentBoard}
            onClickCell={() => {}}
            lastChanged={currentChanged}
            lastPlaced={currentMove?.pos}
            disabled
          />

          <div style={{ width: "100%", maxWidth: 760, display: "grid", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={moves.length}
              value={ply}
              onChange={e => setPly(Number(e.target.value))}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button style={btnStyle} onClick={() => setPly(0)} disabled={ply === 0}>最初</button>
              <button style={btnStyle} onClick={() => setPly(v => Math.max(0, v - 1))} disabled={ply === 0}>前</button>
              <button style={btnStyle} onClick={() => setPly(v => Math.min(moves.length, v + 1))} disabled={ply === moves.length}>次</button>
              <button style={btnStyle} onClick={() => setPly(moves.length)} disabled={ply === moves.length}>最後</button>
            </div>
          </div>
        </>
      )}
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
