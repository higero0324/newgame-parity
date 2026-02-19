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
const LEVEL_UP_KISEKI_REWARD = 500;
const ACHIEVEMENT_KISEKI_REWARD = 250;
const ACHIEVEMENT_XP_REWARD = 500;
const ACHIEVEMENT_KISEKI_CLAIMED_KEY = "achievement_kiseki_claimed_title_ids";
const ACHIEVEMENT_XP_CLAIMED_KEY = "achievement_xp_claimed_title_ids";
const SHOGO_CONQUEROR_TITLE_ID = "shogo_conqueror";
const SHOGO_CONQUEROR_KISEKI_REWARD = 1000;
const SHOGO_WIN_XP_REWARD = 1500;

export function getRequiredXpForNextRank(rank: number): number {
  const safe = Math.min(Math.max(Math.floor(rank), MIN_RANK), MAX_RANK);
  const step = Math.floor((safe - 1) / STEP_LEVEL);
  return BASE_REQUIRED_XP + step * REQUIRED_XP_STEP;
}

export function getLevelUpKisekiReward(): number {
  return LEVEL_UP_KISEKI_REWARD;
}

export function getAchievementKisekiReward(titleId?: string): number {
  if (titleId === SHOGO_CONQUEROR_TITLE_ID) return SHOGO_CONQUEROR_KISEKI_REWARD;
  return ACHIEVEMENT_KISEKI_REWARD;
}

export function getAchievementXpReward(): number {
  return ACHIEVEMENT_XP_REWARD;
}

export function getXpForCpuWin(level: CpuRankLevel): number {
  if (level === "easy") return 100;
  if (level === "medium") return 150;
  if (level === "hard") return 300;
  return 400;
}

export function getXpForShogoWin(): number {
  return SHOGO_WIN_XP_REWARD;
}

function normalizeNonNegativeInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function normalizeStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value.filter(x => typeof x === "string") : [];
  return Array.from(new Set(arr as string[]));
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

export function getPlayerRankStateFromMetadata(metadata: unknown): PlayerRankState {
  return normalizeState(metadata);
}

export function getClaimedAchievementKisekiTitleIdsFromMetadata(metadata: unknown): string[] {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  return normalizeStringArray(meta[ACHIEVEMENT_KISEKI_CLAIMED_KEY]);
}

export function getClaimedAchievementXpTitleIdsFromMetadata(metadata: unknown): string[] {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  return normalizeStringArray(meta[ACHIEVEMENT_XP_CLAIMED_KEY]);
}

function applyXpGain(state: PlayerRankState, gainedXp: number) {
  let { rank, xp, kiseki } = state;
  let levelUps = 0;
  xp += Math.max(0, Math.floor(gainedXp));
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
  return { state: { rank, xp, kiseki }, levelUps };
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
  const applied = applyXpGain(normalizeState(data.user.user_metadata), gainedXp);
  const { rank, xp, kiseki } = applied.state;
  const { levelUps } = applied;

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

export async function grantShogoWinXpForCurrentUser(userWon: boolean) {
  if (!userWon) {
    return { ok: true as const, gainedXp: 0, levelUps: 0, state: null as PlayerRankState | null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const gainedXp = SHOGO_WIN_XP_REWARD;
  const applied = applyXpGain(normalizeState(data.user.user_metadata), gainedXp);
  const { rank, xp, kiseki } = applied.state;
  const { levelUps } = applied;

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

export async function grantAchievementKisekiForCurrentUser(titleId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const state = normalizeState(data.user.user_metadata);
  const claimed = getClaimedAchievementKisekiTitleIdsFromMetadata(data.user.user_metadata);
  if (claimed.includes(titleId)) {
    return { ok: true as const, granted: false, state };
  }

  const nextClaimed = [...claimed, titleId];
  const reward = getAchievementKisekiReward(titleId);
  const nextKiseki = state.kiseki + reward;
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      player_rank: state.rank,
      player_xp: state.xp,
      player_kiseki: nextKiseki,
      [ACHIEVEMENT_KISEKI_CLAIMED_KEY]: nextClaimed,
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };
  return { ok: true as const, granted: true, state: { rank: state.rank, xp: state.xp, kiseki: nextKiseki } };
}

export async function grantAchievementRewardsForCurrentUser(titleId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const baseState = normalizeState(data.user.user_metadata);
  const kisekiClaimed = getClaimedAchievementKisekiTitleIdsFromMetadata(data.user.user_metadata);
  const xpClaimed = getClaimedAchievementXpTitleIdsFromMetadata(data.user.user_metadata);

  const kisekiClaimedNow = !kisekiClaimed.includes(titleId);
  const xpClaimedNow = !xpClaimed.includes(titleId);

  const nextKisekiClaimed = kisekiClaimedNow ? [...kisekiClaimed, titleId] : kisekiClaimed;
  const nextXpClaimed = xpClaimedNow ? [...xpClaimed, titleId] : xpClaimed;
  const kisekiReward = getAchievementKisekiReward(titleId);
  const kisekiWithReward = baseState.kiseki + (kisekiClaimedNow ? kisekiReward : 0);
  const xpApplied = applyXpGain(
    { rank: baseState.rank, xp: baseState.xp, kiseki: kisekiWithReward },
    xpClaimedNow ? ACHIEVEMENT_XP_REWARD : 0,
  );
  const nextState = xpApplied.state;

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      player_rank: nextState.rank,
      player_xp: nextState.xp,
      player_kiseki: nextState.kiseki,
      [ACHIEVEMENT_KISEKI_CLAIMED_KEY]: nextKisekiClaimed,
      [ACHIEVEMENT_XP_CLAIMED_KEY]: nextXpClaimed,
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };

  return {
    ok: true as const,
    kisekiClaimedNow,
    xpClaimedNow,
    kisekiReward,
    xpReward: ACHIEVEMENT_XP_REWARD,
    levelUps: xpApplied.levelUps,
    state: nextState,
  };
}
