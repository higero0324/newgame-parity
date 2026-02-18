import { supabase } from "@/lib/supabaseClient";

export type CpuRankLevel = "easy" | "medium" | "hard" | "extreme";

export type PlayerRankState = {
  rank: number;
  xp: number;
  kiseki: number;
};

const MIN_RANK = 1;
const MAX_RANK = 99;
const BASE_REQUIRED_XP = 1000;
const REQUIRED_XP_STEP = 2000;
const STEP_LEVEL = 10;
const LEVEL_UP_KISEKI_REWARD = 300;

export function getRequiredXpForNextRank(rank: number): number {
  const safe = Math.min(Math.max(Math.floor(rank), MIN_RANK), MAX_RANK);
  const step = Math.floor((safe - 1) / STEP_LEVEL);
  return BASE_REQUIRED_XP + step * REQUIRED_XP_STEP;
}

export function getLevelUpKisekiReward(): number {
  return LEVEL_UP_KISEKI_REWARD;
}

export function getXpForCpuWin(level: CpuRankLevel): number {
  if (level === "easy") return 100;
  if (level === "medium") return 150;
  if (level === "hard") return 300;
  return 400;
}

function normalizeNonNegativeInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function normalizeRank(value: unknown) {
  const n = normalizeNonNegativeInt(value, MIN_RANK);
  return Math.min(Math.max(n, MIN_RANK), MAX_RANK);
}

function normalizeState(metadata: unknown): PlayerRankState {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const rank = normalizeRank(meta.player_rank);
  const xp = normalizeNonNegativeInt(meta.player_xp, 0);
  const kiseki = normalizeNonNegativeInt(meta.player_kiseki, 0);
  return { rank, xp, kiseki };
}

export async function loadPlayerRankStateForCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };
  return { ok: true as const, state: normalizeState(data.user.user_metadata) };
}

export async function grantCpuWinXpForCurrentUser(level: CpuRankLevel, userWon: boolean, noUndoUsed = true) {
  if (!userWon || !noUndoUsed) {
    return { ok: true as const, gainedXp: 0, levelUps: 0, state: null as PlayerRankState | null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const gainedXp = getXpForCpuWin(level);
  let { rank, xp, kiseki } = normalizeState(data.user.user_metadata);
  let levelUps = 0;
  xp += gainedXp;

  while (rank < MAX_RANK) {
    const required = getRequiredXpForNextRank(rank);
    if (xp < required) break;
    xp -= required;
    rank += 1;
    levelUps += 1;
    kiseki += LEVEL_UP_KISEKI_REWARD;
  }

  if (rank >= MAX_RANK) {
    rank = MAX_RANK;
    xp = 0;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      player_rank: rank,
      player_xp: xp,
      player_kiseki: kiseki,
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };
  return { ok: true as const, gainedXp, levelUps, state: { rank, xp, kiseki } };
}

