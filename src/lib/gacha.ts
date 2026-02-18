import { supabase } from "@/lib/supabaseClient";
import { getPlayerRankStateFromMetadata } from "@/lib/playerRank";

export type GachaItemKind = "frame" | "template" | "title";
export type GachaTier = "rare" | "premium" | "odd";

export type GachaItemDef = {
  id: string;
  kind: GachaItemKind;
  name: string;
  tier: GachaTier;
};

export type GachaPullResult = {
  item: GachaItemDef;
  duplicated: boolean;
  refundKiseki: number;
};

export type OwnedGachaItems = {
  frameIds: string[];
  templateIds: string[];
  titleIds: string[];
};

const GACHA_COST_PER_PULL = 250;
const DUPLICATE_REFUND_BY_TIER: Record<GachaTier, number> = {
  odd: 10,
  premium: 50,
  rare: 250,
};

const RARE_FRAME: GachaItemDef = {
  id: "sakura_frame",
  kind: "frame",
  name: "桜雅フレーム",
  tier: "rare",
};

const PREMIUM_ITEMS: GachaItemDef[] = [
  { id: "glow_red_frame", kind: "frame", name: "紅光フレーム", tier: "premium" },
  { id: "glow_blue_frame", kind: "frame", name: "蒼光フレーム", tier: "premium" },
  { id: "glow_green_frame", kind: "frame", name: "翠光フレーム", tier: "premium" },
  { id: "gacha_template_kacho", kind: "template", name: "花鳥風月カード", tier: "premium" },
  { id: "gacha_template_suiboku", kind: "template", name: "水墨カード", tier: "premium" },
  { id: "gacha_template_kinran", kind: "template", name: "金襴カード", tier: "premium" },
];

const ODD_TITLES: GachaItemDef[] = [
  "焼き鳥好き",
  "マイペース",
  "朝は弱い",
  "お茶こぼし職人",
  "方向音痴",
  "寝落ち常習",
  "迷子の達人",
  "雨の日好き",
  "隠れ甘党",
  "石橋を叩く",
  "湯気ハンター",
  "猫背の王",
  "直感一本",
  "口癖はたぶん",
  "寄り道名人",
  "のんびり侍",
  "半分寝てる",
  "気まぐれ雲",
  "秒で忘れる",
  "無言の圧",
].map((name, i) => ({
  id: `odd_title_${i + 1}`,
  kind: "title",
  name,
  tier: "odd" as const,
}));

const ITEM_MAP = new Map<string, GachaItemDef>([
  [RARE_FRAME.id, RARE_FRAME],
  ...PREMIUM_ITEMS.map(x => [x.id, x] as const),
  ...ODD_TITLES.map(x => [x.id, x] as const),
]);

function normalizeStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value.filter(x => typeof x === "string") as string[] : [];
  return Array.from(new Set(arr));
}

export function getGachaCost(drawCount: number): number {
  return Math.max(1, Math.floor(drawCount)) * GACHA_COST_PER_PULL;
}

export function getAllGachaItems(): GachaItemDef[] {
  return [RARE_FRAME, ...PREMIUM_ITEMS, ...ODD_TITLES];
}

export function getGachaItemById(id: string): GachaItemDef | null {
  return ITEM_MAP.get(id) ?? null;
}

export function getOwnedGachaItemsFromMetadata(metadata: unknown): OwnedGachaItems {
  const meta = (metadata ?? {}) as Record<string, unknown>;
  return {
    frameIds: normalizeStringArray(meta.owned_gacha_frame_ids),
    templateIds: normalizeStringArray(meta.owned_gacha_template_ids),
    titleIds: normalizeStringArray(meta.owned_gacha_title_ids),
  };
}

function drawOne(): GachaItemDef {
  const roll = Math.random() * 100;
  if (roll < 1.5) return RARE_FRAME;
  if (roll < 20) return PREMIUM_ITEMS[Math.floor(Math.random() * PREMIUM_ITEMS.length)];
  return ODD_TITLES[Math.floor(Math.random() * ODD_TITLES.length)];
}

function getDuplicateRefundByTier(tier: GachaTier): number {
  return DUPLICATE_REFUND_BY_TIER[tier] ?? 0;
}

export async function pullGachaForCurrentUser(drawCount: number) {
  const count = Math.max(1, Math.floor(drawCount));
  const cost = getGachaCost(count);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, reason: error?.message ?? "not logged in" };

  const rankState = getPlayerRankStateFromMetadata(data.user.user_metadata);
  if (rankState.kiseki < cost) {
    return { ok: false as const, reason: `季石が不足しています（必要: ${cost}）` };
  }

  const owned = getOwnedGachaItemsFromMetadata(data.user.user_metadata);
  const rewards = Array.from({ length: count }, () => drawOne());
  const nextOwnedFrames = new Set(owned.frameIds);
  const nextOwnedTemplates = new Set(owned.templateIds);
  const nextOwnedTitles = new Set(owned.titleIds);

  const newlyObtainedIds: string[] = [];
  const pullResults: GachaPullResult[] = [];
  let refundTotal = 0;
  for (const item of rewards) {
    let duplicated = false;
    if (item.kind === "frame") {
      duplicated = nextOwnedFrames.has(item.id);
      if (!duplicated) {
        nextOwnedFrames.add(item.id);
        newlyObtainedIds.push(item.id);
      }
    } else if (item.kind === "template") {
      duplicated = nextOwnedTemplates.has(item.id);
      if (!duplicated) {
        nextOwnedTemplates.add(item.id);
        newlyObtainedIds.push(item.id);
      }
    } else {
      duplicated = nextOwnedTitles.has(item.id);
      if (!duplicated) {
        nextOwnedTitles.add(item.id);
        newlyObtainedIds.push(item.id);
      }
    }
    const refundKiseki = duplicated ? getDuplicateRefundByTier(item.tier) : 0;
    refundTotal += refundKiseki;
    pullResults.push({ item, duplicated, refundKiseki });
  }

  const remainingKiseki = rankState.kiseki - cost + refundTotal;

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      player_rank: rankState.rank,
      player_xp: rankState.xp,
      player_kiseki: remainingKiseki,
      owned_gacha_frame_ids: Array.from(nextOwnedFrames),
      owned_gacha_template_ids: Array.from(nextOwnedTemplates),
      owned_gacha_title_ids: Array.from(nextOwnedTitles),
    },
  });
  if (updateError) return { ok: false as const, reason: updateError.message };

  return {
    ok: true as const,
    rewards,
    pullResults,
    newlyObtainedIds,
    cost,
    refundTotal,
    remainingKiseki,
    owned: {
      frameIds: Array.from(nextOwnedFrames),
      templateIds: Array.from(nextOwnedTemplates),
      titleIds: Array.from(nextOwnedTitles),
    },
  };
}
