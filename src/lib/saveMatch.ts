import { supabase } from "@/lib/supabaseClient";
import type { Player } from "@/lib/gameLogic";

export type MoveRecord = {
  ply: number;
  player: Player;
  pos: number;
  diff: Array<{ i: number; from: number; to: number }>;
  board_after: number[];
};

function mapSaveError(message: string): string {
  if (message.includes("Could not find the table") && message.includes("public.matches")) {
    return "保存に失敗しました。Supabase に public.matches テーブルがありません。";
  }
  if (message.includes("Could not find the table") && message.includes("public.moves")) {
    return "保存に失敗しました。Supabase に public.moves テーブルがありません。";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "保存に失敗しました。RLS ポリシーで INSERT が許可されていません。";
  }
  return `保存に失敗しました。詳細: ${message}`;
}

export async function saveMatchToSupabase(args: {
  winner: Player;
  final_board: number[];
  moves: MoveRecord[];
  protectedMatchIds?: string[];
}) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { ok: false as const, reason: mapSaveError(authError.message) };
  }
  const user = auth.user;
  if (!user) {
    return { ok: false as const, reason: "未ログインのため保存できません。" };
  }

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({
      user_id: user.id,
      winner: args.winner,
      final_board: args.final_board,
      moves_count: args.moves.length,
    })
    .select()
    .single();

  if (matchErr) {
    return { ok: false as const, reason: mapSaveError(matchErr.message) };
  }

  const payload = args.moves.map(m => ({
    match_id: match.id,
    ply: m.ply,
    player: m.player,
    pos: m.pos,
    diff: m.diff,
    board_after: m.board_after,
  }));

  const { error: movesErr } = await supabase.from("moves").insert(payload);
  if (movesErr) {
    return { ok: false as const, reason: mapSaveError(movesErr.message) };
  }

  // Keep at most 30 records per user.
  // Delete oldest non-favorite matches first (favorites are protected).
  let warning = "";
  const { data: allMatches, error: listErr } = await supabase
    .from("matches")
    .select("id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!listErr && allMatches) {
    const MAX_MATCHES = 30;
    const overflow = allMatches.length - MAX_MATCHES;
    if (overflow > 0) {
      const protectedSet = new Set(args.protectedMatchIds ?? []);
      const deletableIds = (allMatches as Array<{ id: string; created_at: string }>)
        .map((m: { id: string }) => m.id)
        .filter(id => !protectedSet.has(id))
        .slice(0, overflow);

      if (deletableIds.length > 0) {
        const { error: deleteErr } = await supabase
          .from("matches")
          .delete()
          .in("id", deletableIds)
          .eq("user_id", user.id);
        if (deleteErr) {
          warning = `保存は完了しましたが、自動整理に失敗しました。詳細: ${deleteErr.message}`;
        }
      }

      if (deletableIds.length < overflow) {
        warning = "お気に入り保護により、30件を超える棋譜が残っています。";
      }
    }
  } else if (listErr) {
    warning = `保存は完了しましたが、件数整理に失敗しました。詳細: ${listErr.message}`;
  }

  return { ok: true as const, matchId: match.id, warning };
}
