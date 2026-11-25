import type {
  AccentColor,
  ClaudeTabProfile,
  TabWorkspaceState,
} from "./types";

export const DEFAULT_CLAUDE_URL = "https://claude.ai/new";
export const STORAGE_KEY = "multiclaude.webtabs.v3";

export const ACCENT_THEMES: Record<
  AccentColor,
  {
    name: string;
    dot: string;
    badge: string;
  }
> = {
  terracotta: {
    name: "Terracotta",
    dot: "bg-[#d97757]",
    badge: "bg-[#d97757]/15 text-[#f09d81] border-[#d97757]/35",
  },
  sky: {
    name: "Sky",
    dot: "bg-sky-400",
    badge: "bg-sky-400/15 text-sky-300 border-sky-400/35",
  },
  emerald: {
    name: "Emerald",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/15 text-emerald-300 border-emerald-400/35",
  },
  amber: {
    name: "Amber",
    dot: "bg-amber-400",
    badge: "bg-amber-400/15 text-amber-300 border-amber-400/35",
  },
  violet: {
    name: "Violet",
    dot: "bg-violet-400",
    badge: "bg-violet-400/15 text-violet-300 border-violet-400/35",
  },
  rose: {
    name: "Rose",
    dot: "bg-rose-400",
    badge: "bg-rose-400/15 text-rose-300 border-rose-400/35",
  },
};

export const DEFAULT_TABS: ClaudeTabProfile[] = [
  {
    id: "tab-1",
    tabName: "Tab 1",
    email: "rupeshkw35@gmail.com",
    url: DEFAULT_CLAUDE_URL,
    accent: "terracotta",
  },
  {
    id: "tab-2",
    tabName: "Tab 2",
    email: "rupeshkw3@gmail.com",
    url: DEFAULT_CLAUDE_URL,
    accent: "sky",
  },
  {
    id: "tab-3",
    tabName: "Tab 3",
    email: "rupeshkw040@gmail.com",
    url: DEFAULT_CLAUDE_URL,
    accent: "emerald",
  },
];

export function createInitialWorkspaceState(): TabWorkspaceState {
  return {
    tabs: DEFAULT_TABS,
    activeTabId: DEFAULT_TABS[0].id,
  };
}

export function slugifyTabId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "tab-1";
}

export function loadWorkspaceState(): TabWorkspaceState {
  if (typeof window === "undefined") {
    return createInitialWorkspaceState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialWorkspaceState();
    const parsed = JSON.parse(raw) as Partial<TabWorkspaceState>;
    const tabs =
      Array.isArray(parsed.tabs) && parsed.tabs.length > 0
        ? parsed.tabs
        : DEFAULT_TABS;
    const validIds = new Set(tabs.map((t) => t.id));
    const activeTabId =
      parsed.activeTabId && validIds.has(parsed.activeTabId)
        ? parsed.activeTabId
        : tabs[0].id;
    return { tabs, activeTabId };
  } catch {
    return createInitialWorkspaceState();
  }
}

export function saveWorkspaceState(state: TabWorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

const SERVER_SNAPSHOT: TabWorkspaceState = createInitialWorkspaceState();
let clientSnapshot: TabWorkspaceState | null = null;
const listeners = new Set<() => void>();

function handleStorageEvent(event: StorageEvent) {
  if (event.key && event.key !== STORAGE_KEY) return;
  clientSnapshot = loadWorkspaceState();
  listeners.forEach((l) => l());
}

export function getServerWorkspaceSnapshot(): TabWorkspaceState {
  return SERVER_SNAPSHOT;
}

export function getWorkspaceSnapshot(): TabWorkspaceState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (clientSnapshot === null) {
    clientSnapshot = loadWorkspaceState();
  }
  return clientSnapshot;
}

export function subscribeWorkspace(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", handleStorageEvent);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", handleStorageEvent);
    }
  };
}

export function updateWorkspace(
  updater: TabWorkspaceState | ((prev: TabWorkspaceState) => TabWorkspaceState),
): void {
  const prev = getWorkspaceSnapshot();
  const next = typeof updater === "function" ? updater(prev) : updater;
  clientSnapshot = next;
  saveWorkspaceState(next);
  listeners.forEach((l) => l());
}
