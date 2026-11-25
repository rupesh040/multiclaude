export type AccentColor =
  | "terracotta"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "rose";

export interface ClaudeTabProfile {
  /** Unique tab ID mapped to Electron session partition `persist:<id>` */
  id: string;
  /** Display title in top tab bar (e.g. "Tab 1", "Tab 2", "Tab 3") */
  tabName: string;
  /** Account email label associated with this tab */
  email: string;
  /** Target URL loaded in this tab's isolated session */
  url: string;
  /** Visual accent color distinguishing this tab */
  accent: AccentColor;
}

export interface TabWorkspaceState {
  tabs: ClaudeTabProfile[];
  activeTabId: string;
}

export interface TabStatusEvent {
  tabId: string;
  loading?: boolean;
  url?: string;
  title?: string;
}

export interface MultiClaudeDesktopBridge {
  isElectron: boolean;
  syncTabs: (payload: {
    tabs: Array<{ id: string; url: string }>;
    activeTabId: string;
    topOffset: number;
    modalOpen: boolean;
  }) => Promise<{ ok: boolean }>;
  reloadTab: (tabId: string) => Promise<void>;
  goBackTab: (tabId: string) => Promise<void>;
  navigateTab: (tabId: string, url: string) => Promise<void>;
  clearPartition: (tabId: string) => Promise<{ ok: boolean }>;
  onTabStatus: (callback: (payload: TabStatusEvent) => void) => () => void;
}

declare global {
  interface Window {
    multiclaudeDesktop?: MultiClaudeDesktopBridge;
  }
}
