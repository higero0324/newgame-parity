import { supabase } from "@/lib/supabaseClient";
import { getPlayerRankStateFromMetadata } from "@/lib/playerRank";

type PresentKind = "kiseki";

export type PresentItem = {
  id: string;
  title: string;
  description: string;
  kind: PresentKind;
  amount: number;
  distributedAt: string;
};

const PRESENT_BOX_KEY = "present_box_items";
const PRESENT_FLAGS_KEY = "present_flags";
const WELCOME_PRESENT_ID = "welcome_thanks_20260218";
const WELCOME_PRESENT: PresentItem = {
  id: WELCOME_PRESENT_ID,
  title: "一正ご利用ありがとうございます",
  description: "サービス開始記念として季石をお届けします。",
  kind: "kiseki",
  amount: 2000,
  distributedAt: "2026-02-18 12:00 JST",
};

function normalizePresentArray(value: unknown): PresentItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(raw => {
      const item = raw as Partial<PresentItem>;
      if (
        typeof item?.id !== "string" ||
        typeof item?.title !== "string" ||
        typeof item?.description !== "string" ||
        typeof item?.kind !== "string" ||
        typeof item?.amount !== "number" ||
        typeof item?.distributedAt !== "string"
      ) {
        return null;
      }
      if (item.kind !== "kiseki") return null;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        kind: item.kind,
        amount: Math.max(0, Math.floor(item.amount)),
        distributedAt: item.distributedAt,
      } satisfies PresentItem;
    })
    .filter((x): x is PresentItem => Boolean(x));
}

function getPresentBoxFromMetadata(metadata: unknown): PresentItem[] {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const presents = normalizePresentArray(meta[PRESENT_BOX_KEY]);
  const seen = new Set<string>();
  const deduped: PresentItem[] = [];
  for (const p of presents) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
  }
  return deduped;
}

function getPresentFlagsFromMetadata(metadata: unknown): Record<string, boolean> {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const raw = meta[PRESENT_FLAGS_KEY];
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

export async function ensureWelcomePresentForCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const flags = getPresentFlagsFromMetadata(data.user.user_metadata);
  const currentPresents = getPresentBoxFromMetadata(data.user.user_metadata);
  if (flags[WELCOME_PRESENT_ID] || currentPresents.some(p => p.id === WELCOME_PRESENT_ID)) {
    return { ok: true as const, changed: false, presents: currentPresents };
  }

  const nextPresents = [WELCOME_PRESENT, ...currentPresents];
  const nextFlags = { ...flags, [WELCOME_PRESENT_ID]: true };
  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      [PRESENT_BOX_KEY]: nextPresents,
      [PRESENT_FLAGS_KEY]: nextFlags,
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };
  return { ok: true as const, changed: true, presents: nextPresents };
}

export async function loadPresentBoxForCurrentUser() {
  const ensured = await ensureWelcomePresentForCurrentUser();
  if (!ensured.ok) return ensured;
  return { ok: true as const, presents: ensured.presents };
}

export async function claimPresentForCurrentUser(presentId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const state = getPlayerRankStateFromMetadata(data.user.user_metadata);
  const presents = getPresentBoxFromMetadata(data.user.user_metadata);
  const target = presents.find(p => p.id === presentId);
  if (!target) return { ok: false as const, reason: "対象のプレゼントが見つかりません。" };

  const nextPresents = presents.filter(p => p.id !== presentId);
  const nextKiseki = state.kiseki + target.amount;

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      player_rank: state.rank,
      player_xp: state.xp,
      player_kiseki: nextKiseki,
      [PRESENT_BOX_KEY]: nextPresents,
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };

  return {
    ok: true as const,
    claimed: target,
    presents: nextPresents,
    kiseki: nextKiseki,
  };
}
