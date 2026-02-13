import { supabase } from "@/lib/supabaseClient";
import { ensureFriendIdForCurrentUser, getFriendIdFromUserMetadata } from "@/lib/profilePrefs";

export type AchievementCpuLevel = "easy" | "medium" | "hard" | "extreme";
export type TitleRarity = "bronze" | "silver" | "gold" | "obsidian";

export type AchievementStats = {
  cpu_wins: Record<AchievementCpuLevel, number>;
  total_cpu_wins: number;
  saved_matches: number;
};

export type TitleDef = {
  id: string;
  name: string;
  rarity: TitleRarity;
  description: string;
};

type AchievementDef = {
  id: string;
  name: string;
  description: string;
  title_id: string;
  target: (stats: AchievementStats) => number;
};

export type AchievementProgress = {
  id: string;
  name: string;
  description: string;
  title: TitleDef;
  done: boolean;
  claimed: boolean;
  progress: number;
  target: number;
};

type ProfileAchievementRow = {
  friend_id?: unknown;
  achievement_stats?: unknown;
  unlocked_title_ids?: unknown;
  equipped_title_ids?: unknown;
};

const EMPTY_STATS: AchievementStats = {
  cpu_wins: { easy: 0, medium: 0, hard: 0, extreme: 0 },
  total_cpu_wins: 0,
  saved_matches: 0,
};

const TITLE_DEFS: TitleDef[] = [
  { id: "rookie_winner", name: "桜咲く", rarity: "bronze", description: "手を戻さずCPU戦で1勝" },
  { id: "easy_hunter", name: "若葉の季士", rarity: "bronze", description: "手を戻さず初級に5勝" },
  { id: "medium_breaker", name: "火もまた涼し", rarity: "silver", description: "手を戻さず中級に5勝" },
  { id: "hard_striker", name: "秋の静けさ", rarity: "gold", description: "手を戻さず上級に3勝" },
  { id: "hard_master", name: "紅一点", rarity: "gold", description: "手を戻さず上級に10勝" },
  { id: "extreme_slayer", name: "雪化粧", rarity: "gold", description: "手を戻さず極級に1勝" },
  { id: "extreme_emperor", name: "夜と雪月花", rarity: "obsidian", description: "手を戻さず極級に5勝" },
  { id: "cpu_veteran", name: "日々研鑽", rarity: "silver", description: "手を戻さずCPU戦で通算30勝" },
  { id: "cpu_legend", name: "百戦錬磨", rarity: "obsidian", description: "手を戻さずCPU戦で通算100勝" },
  { id: "record_keeper", name: "初心な思い出", rarity: "bronze", description: "季譜を1件保存" },
  { id: "archive_lord", name: "辿る旅路", rarity: "silver", description: "季譜を10件保存" },
];

const TITLE_MAP = new Map(TITLE_DEFS.map(x => [x.id, x]));

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: "cpu_first_win", name: "春の訪れ", description: "手を戻さずCPU戦で1勝", title_id: "rookie_winner", target: () => 1 },
  { id: "easy_5", name: "花の便り", description: "手を戻さず初級に5勝", title_id: "easy_hunter", target: () => 5 },
  { id: "medium_5", name: "氷菓も溶ける頃", description: "手を戻さず中級に5勝", title_id: "medium_breaker", target: () => 5 },
  { id: "hard_3", name: "枯れ葉も風情", description: "手を戻さず上級に3勝", title_id: "hard_striker", target: () => 3 },
  { id: "hard_10", name: "紅に染まる河川", description: "手を戻さず上級に10勝", title_id: "hard_master", target: () => 10 },
  { id: "extreme_1", name: "まるで銀世界", description: "手を戻さず極級に1勝", title_id: "extreme_slayer", target: () => 1 },
  { id: "extreme_5", name: "雪月花", description: "手を戻さず極級に5勝", title_id: "extreme_emperor", target: () => 5 },
  { id: "cpu_total_30", name: "研鑽", description: "手を戻さずCPU戦で通算30勝", title_id: "cpu_veteran", target: () => 30 },
  { id: "cpu_total_100", name: "百戦錬磨", description: "手を戻さずCPU戦で通算100勝", title_id: "cpu_legend", target: () => 100 },
  { id: "saved_10", name: "文箱の若芽", description: "季譜を1件保存", title_id: "record_keeper", target: () => 1 },
  { id: "saved_30", name: "一冊を綴る", description: "季譜を10件保存", title_id: "archive_lord", target: () => 10 },
];

function normalizeStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value.filter(x => typeof x === "string") as string[] : [];
  return Array.from(new Set(arr));
}

function normalizeStats(value: unknown): AchievementStats {
  const raw = (value ?? {}) as {
    cpu_wins?: unknown;
    total_cpu_wins?: unknown;
    saved_matches?: unknown;
  };
  const wins = (raw.cpu_wins ?? {}) as Record<string, unknown>;
  const easy = Number.isFinite(Number(wins.easy)) ? Math.max(0, Number(wins.easy)) : 0;
  const medium = Number.isFinite(Number(wins.medium)) ? Math.max(0, Number(wins.medium)) : 0;
  const hard = Number.isFinite(Number(wins.hard)) ? Math.max(0, Number(wins.hard)) : 0;
  const extreme = Number.isFinite(Number(wins.extreme)) ? Math.max(0, Number(wins.extreme)) : 0;
  const totalFromWins = easy + medium + hard + extreme;
  const totalRaw = Number.isFinite(Number(raw.total_cpu_wins)) ? Math.max(0, Number(raw.total_cpu_wins)) : 0;
  const saved = Number.isFinite(Number(raw.saved_matches)) ? Math.max(0, Number(raw.saved_matches)) : 0;
  return {
    cpu_wins: { easy, medium, hard, extreme },
    total_cpu_wins: Math.max(totalRaw, totalFromWins),
    saved_matches: saved,
  };
}

function achievementCurrentValue(def: AchievementDef, stats: AchievementStats): number {
  switch (def.id) {
    case "cpu_first_win":
      return stats.total_cpu_wins;
    case "easy_5":
      return stats.cpu_wins.easy;
    case "medium_5":
      return stats.cpu_wins.medium;
    case "hard_3":
      return stats.cpu_wins.hard;
    case "hard_10":
      return stats.cpu_wins.hard;
    case "extreme_1":
      return stats.cpu_wins.extreme;
    case "extreme_5":
      return stats.cpu_wins.extreme;
    case "cpu_total_30":
      return stats.total_cpu_wins;
    case "cpu_total_100":
      return stats.total_cpu_wins;
    case "saved_10":
      return stats.saved_matches;
    case "saved_30":
      return stats.saved_matches;
    default:
      return 0;
  }
}

function achievedTitleIds(stats: AchievementStats): string[] {
  const ids: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    const target = def.target(stats);
    const current = achievementCurrentValue(def, stats);
    if (current >= target) ids.push(def.title_id);
  }
  return ids;
}

function clampEquipped(unlocked: string[], equipped: string[]): string[] {
  const unlockedSet = new Set(unlocked);
  return equipped.filter(id => unlockedSet.has(id)).slice(0, 2);
}

async function getCurrentUserAndFriendId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };
  let friendId = getFriendIdFromUserMetadata(data.user.user_metadata);
  if (!friendId) {
    const ensured = await ensureFriendIdForCurrentUser();
    if (!ensured.ok) return ensured;
    friendId = ensured.friendId;
  }
  return { ok: true as const, userId: data.user.id, friendId };
}

async function loadRowForCurrentUser() {
  const auth = await getCurrentUserAndFriendId();
  if (!auth.ok) return auth;
  const { data, error } = await supabase
    .from("profiles")
    .select("friend_id, achievement_stats, unlocked_title_ids, equipped_title_ids")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, auth, row: (data ?? {}) as ProfileAchievementRow };
}

export function getTitleById(id: string): TitleDef | null {
  return TITLE_MAP.get(id) ?? null;
}

export function getAllTitles(): TitleDef[] {
  return TITLE_DEFS.slice();
}

export function buildAchievementProgress(stats: AchievementStats, unlockedTitleIds: string[]): AchievementProgress[] {
  const unlockedSet = new Set(unlockedTitleIds);
  return ACHIEVEMENT_DEFS.map(def => {
    const title = TITLE_MAP.get(def.title_id);
    if (!title) {
      throw new Error(`Unknown title id: ${def.title_id}`);
    }
    const target = def.target(stats);
    const current = achievementCurrentValue(def, stats);
    const done = current >= target;
    const claimed = unlockedSet.has(def.title_id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      title,
      done,
      claimed,
      progress: Math.min(current, target),
      target,
    };
  });
}

export async function loadAchievementStateForCurrentUser() {
  const loaded = await loadRowForCurrentUser();
  if (!loaded.ok) return loaded;
  const stats = normalizeStats(loaded.row.achievement_stats);
  const unlocked = normalizeStringArray(loaded.row.unlocked_title_ids);
  const achieved = achievedTitleIds(stats);
  const claimableTitleIds = achieved.filter(id => !unlocked.includes(id));
  const equipped = clampEquipped(unlocked, normalizeStringArray(loaded.row.equipped_title_ids));
  return { ok: true as const, stats, unlockedTitleIds: unlocked, equippedTitleIds: equipped, claimableTitleIds };
}

export async function recordCpuWinForCurrentUser(level: AchievementCpuLevel, userWon: boolean, noUndoUsed = true) {
  if (!userWon) return { ok: true as const, unlockedNow: [] as string[] };
  if (!noUndoUsed) return { ok: true as const, unlockedNow: [] as string[] };
  const loaded = await loadRowForCurrentUser();
  if (!loaded.ok) return loaded;

  const stats = normalizeStats(loaded.row.achievement_stats);
  stats.cpu_wins[level] += 1;
  stats.total_cpu_wins = stats.cpu_wins.easy + stats.cpu_wins.medium + stats.cpu_wins.hard + stats.cpu_wins.extreme;

  const nowUnlocked = normalizeStringArray(loaded.row.unlocked_title_ids);
  const equipped = clampEquipped(nowUnlocked, normalizeStringArray(loaded.row.equipped_title_ids));

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: loaded.auth.userId,
      friend_id: loaded.auth.friendId,
      achievement_stats: stats,
      unlocked_title_ids: nowUnlocked,
      equipped_title_ids: equipped,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, unlockedNow: [] as string[] };
}

export async function recordSavedMatchForCurrentUser() {
  const loaded = await loadRowForCurrentUser();
  if (!loaded.ok) return loaded;
  const stats = normalizeStats(loaded.row.achievement_stats);
  stats.saved_matches += 1;

  const nowUnlocked = normalizeStringArray(loaded.row.unlocked_title_ids);
  const equipped = clampEquipped(nowUnlocked, normalizeStringArray(loaded.row.equipped_title_ids));

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: loaded.auth.userId,
      friend_id: loaded.auth.friendId,
      achievement_stats: stats,
      unlocked_title_ids: nowUnlocked,
      equipped_title_ids: equipped,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function saveEquippedTitlesForCurrentUser(equippedTitleIds: string[]) {
  const loaded = await loadRowForCurrentUser();
  if (!loaded.ok) return loaded;
  const stats = normalizeStats(loaded.row.achievement_stats);
  const unlocked = normalizeStringArray(loaded.row.unlocked_title_ids);
  const equipped = clampEquipped(unlocked, normalizeStringArray(equippedTitleIds));
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: loaded.auth.userId,
      friend_id: loaded.auth.friendId,
      equipped_title_ids: equipped,
      unlocked_title_ids: unlocked,
      achievement_stats: stats,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function claimTitleForCurrentUser(titleId: string) {
  const loaded = await loadRowForCurrentUser();
  if (!loaded.ok) return loaded;
  const stats = normalizeStats(loaded.row.achievement_stats);
  const achieved = achievedTitleIds(stats);
  if (!achieved.includes(titleId)) {
    return { ok: false as const, reason: "この称号はまだ達成条件を満たしていません。" };
  }

  const unlocked = normalizeStringArray(loaded.row.unlocked_title_ids);
  if (!unlocked.includes(titleId)) unlocked.push(titleId);
  const equipped = clampEquipped(unlocked, normalizeStringArray(loaded.row.equipped_title_ids));
  if (equipped.length < 2 && !equipped.includes(titleId)) equipped.push(titleId);

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: loaded.auth.userId,
      friend_id: loaded.auth.friendId,
      unlocked_title_ids: unlocked,
      equipped_title_ids: equipped,
      achievement_stats: stats,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}
