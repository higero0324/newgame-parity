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

export function getFriendIdFromUserMetadata(metadata: unknown): string {
  const meta = (metadata ?? {}) as { friend_id?: unknown };
  if (typeof meta.friend_id !== "string") return "";
  return meta.friend_id.trim().toUpperCase();
}

function normalizeFriendId(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
}

function randomFriendId(): string {
  const part = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `HS${part.slice(0, 8)}`;
}

export async function ensureFriendIdForCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const current = normalizeFriendId(getFriendIdFromUserMetadata(data.user.user_metadata));
  if (current) return { ok: true as const, friendId: current };

  const nextId = randomFriendId();
  const { error: updateError } = await supabase.auth.updateUser({
    data: { friend_id: nextId },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };
  return { ok: true as const, friendId: nextId };
}

export async function syncCurrentUserPublicProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false as const, reason: error?.message ?? "not logged in" };
  }
  const user = data.user;
  const prefs = getProfilePrefsFromUserMetadata(user.user_metadata);
  const friendId = getFriendIdFromUserMetadata(user.user_metadata);
  if (!friendId) return { ok: false as const, reason: "friend_id is missing" };

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("icon_image_data_url, featured_match_ids, match_names")
    .eq("user_id", user.id)
    .maybeSingle();

  const existing = (existingProfile ?? {}) as {
    icon_image_data_url?: string;
    featured_match_ids?: string[];
    match_names?: Record<string, string>;
  };

  const payload = {
    user_id: user.id,
    friend_id: friendId,
    display_name: (user.user_metadata?.display_name as string | undefined) ?? "",
    status_message: (user.user_metadata?.status_message as string | undefined) ?? "",
    icon_text: prefs.iconText,
    icon_image_data_url: prefs.iconImageDataUrl || (existing.icon_image_data_url ?? ""),
    featured_match_ids: prefs.featuredIds.length > 0 ? prefs.featuredIds : (existing.featured_match_ids ?? []),
    match_names: Object.keys(prefs.matchNames).length > 0 ? prefs.matchNames : (existing.match_names ?? {}),
  };

  const { error: upsertError } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (upsertError) return { ok: false as const, reason: upsertError.message };
  return { ok: true as const };
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
  const synced = await syncCurrentUserPublicProfile();
  if (!synced.ok) return synced;
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
  const synced = await syncCurrentUserPublicProfile();
  if (!synced.ok) return synced;
  return { ok: true as const };
}

export async function saveIconTextToSupabase(iconText: string) {
  const { error } = await supabase.auth.updateUser({
    data: {
      icon_text: normalizeIconText(iconText),
    },
  });
  if (error) return { ok: false as const, reason: error.message };
  const synced = await syncCurrentUserPublicProfile();
  if (!synced.ok) return synced;
  return { ok: true as const };
}

export function normalizeAvatarImageDataUrl(iconImageDataUrl: string) {
  return normalizeIconImageDataUrl(iconImageDataUrl);
}

export async function loadIconImageDataUrlFromProfiles() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false as const, reason: authError?.message ?? "not logged in" };
  const { data, error } = await supabase
    .from("profiles")
    .select("icon_image_data_url")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return { ok: false as const, reason: error.message };
  const row = (data ?? {}) as { icon_image_data_url?: string };
  return { ok: true as const, iconImageDataUrl: normalizeIconImageDataUrl(row.icon_image_data_url ?? "") };
}

export async function saveIconImageDataUrlToProfiles(iconImageDataUrl: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false as const, reason: authError?.message ?? "not logged in" };
  const sanitized = normalizeIconImageDataUrl(iconImageDataUrl);
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: auth.user.id, icon_image_data_url: sanitized }, { onConflict: "user_id" });
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}
