import { supabase } from "@/lib/supabaseClient";

const FEATURED_CLIPS_LIMIT = 3;

export type ClipPrefs = {
  starredIds: string[];
  featuredIds: string[];
};

function normalizeIds(value: unknown, limit?: number): string[] {
  const arr = Array.isArray(value) ? value.filter(x => typeof x === "string") : [];
  const unique = Array.from(new Set(arr));
  if (typeof limit === "number") return unique.slice(0, limit);
  return unique;
}

function normalizeMatchNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const next: Record<string, string> = {};
  for (const [id, name] of entries) {
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (trimmed) next[id] = trimmed;
  }
  return next;
}

function normalizeIconText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2);
}

function normalizeIconImageDataUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/")) return "";
  if (trimmed.length > 350_000) return "";
  return trimmed;
}

export type ProfilePrefs = {
  starredIds: string[];
  featuredIds: string[];
  matchNames: Record<string, string>;
  iconText: string;
  iconImageDataUrl: string;
};

export function getProfilePrefsFromUserMetadata(metadata: unknown): ProfilePrefs {
  const meta = (metadata ?? {}) as {
    starred_match_ids?: unknown;
    featured_match_ids?: unknown;
    match_names?: unknown;
    icon_text?: unknown;
    icon_image_data_url?: unknown;
  };
  return {
    starredIds: normalizeIds(meta.starred_match_ids),
    featuredIds: normalizeIds(meta.featured_match_ids, FEATURED_CLIPS_LIMIT),
    matchNames: normalizeMatchNames(meta.match_names),
    iconText: normalizeIconText(meta.icon_text),
    iconImageDataUrl: normalizeIconImageDataUrl(meta.icon_image_data_url),
  };
}

export function getClipPrefsFromUserMetadata(metadata: unknown): ClipPrefs {
  const prefs = getProfilePrefsFromUserMetadata(metadata);
  return { starredIds: prefs.starredIds, featuredIds: prefs.featuredIds };
}

export async function saveClipPrefsToSupabase(args: {
  starredIds: string[];
  featuredIds: string[];
}) {
  const { error } = await supabase.auth.updateUser({
    data: {
      starred_match_ids: normalizeIds(args.starredIds),
      featured_match_ids: normalizeIds(args.featuredIds, FEATURED_CLIPS_LIMIT),
    },
  });
  if (error) {
    return { ok: false as const, reason: error.message };
  }
  return { ok: true as const };
}

export function getFeaturedMatchIdsFromMetadata(metadata: unknown): string[] {
  return getClipPrefsFromUserMetadata(metadata).featuredIds;
}

export function getMatchNamesFromUserMetadata(metadata: unknown): Record<string, string> {
  return getProfilePrefsFromUserMetadata(metadata).matchNames;
}

export async function saveMatchNamesToSupabase(matchNames: Record<string, string>) {
  const { error } = await supabase.auth.updateUser({
    data: {
      match_names: normalizeMatchNames(matchNames),
    },
  });
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function saveIconTextToSupabase(iconText: string) {
  const { error } = await supabase.auth.updateUser({
    data: {
      icon_text: normalizeIconText(iconText),
    },
  });
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export function normalizeAvatarImageDataUrl(iconImageDataUrl: string) {
  return normalizeIconImageDataUrl(iconImageDataUrl);
}
