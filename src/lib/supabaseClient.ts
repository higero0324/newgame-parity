import { createClient } from "@supabase/supabase-js";

type LooseSupabaseClient = ReturnType<typeof createClient<any, "public", any>>;

let supabaseInstance: LooseSupabaseClient | null = null;
const memoryStorage = new Map<string, string>();
let resolvedStorageMode: "local" | "memory" | null = null;

function resolveStorageMode(): "local" | "memory" {
  if (resolvedStorageMode) return resolvedStorageMode;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const probeKey = "__hisei_storage_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      resolvedStorageMode = "local";
      return resolvedStorageMode;
    }
  } catch {
    // Safari private mode / storage restriction
  }
  resolvedStorageMode = "memory";
  return resolvedStorageMode;
}

const safeBrowserStorage = {
  getItem: (key: string) => {
    const mode = resolveStorageMode();
    if (mode === "local" && typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    const mode = resolveStorageMode();
    if (mode === "local" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    memoryStorage.set(key, value);
  },
  removeItem: (key: string) => {
    const mode = resolveStorageMode();
    if (mode === "local" && typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    memoryStorage.delete(key);
  },
};

export function getSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const invalidUrl = !url || !/^https?:\/\//.test(url) || url.includes("YOUR_");
  const invalidAnon = !anon || anon.includes("YOUR_");
  if (invalidUrl || invalidAnon) {
    console.warn("Supabase credentials not configured. Authentication features will not work.");
    const notConfiguredError = { message: "Supabase is not configured." };
    const mockQuery = {
      select: () => mockQuery,
      order: () => mockQuery,
      limit: async () => ({ data: null, error: notConfiguredError }),
      insert: () => mockQuery,
      single: async () => ({ data: null, error: notConfiguredError }),
    };
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: notConfiguredError }),
        getSession: async () => ({ data: { session: null }, error: notConfiguredError }),
        signInWithPassword: async () => ({ data: { user: null }, error: notConfiguredError }),
        signUp: async () => ({ data: { user: null }, error: notConfiguredError }),
        signOut: async () => ({ error: notConfiguredError }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => mockQuery,
    } as unknown as LooseSupabaseClient;
  }

  supabaseInstance = createClient<any, "public", any>(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeBrowserStorage,
    },
  });
  return supabaseInstance;
}

// For backward compatibility, create a lazy proxy
export const supabase = new Proxy({} as LooseSupabaseClient, {
  get: (_target, prop: string | symbol) => {
    return getSupabase()[prop as keyof LooseSupabaseClient];
  },
});
