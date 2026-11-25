"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ACCENT_THEMES,
  DEFAULT_CLAUDE_URL,
  getServerWorkspaceSnapshot,
  getWorkspaceSnapshot,
  slugifyTabId,
  subscribeWorkspace,
  updateWorkspace,
} from "@/lib/profiles";
import type { AccentColor, ClaudeTabProfile } from "@/lib/types";
import { AccountModal } from "./AccountModal";
import { ClaudeStarburst, ExternalLinkIcon } from "./Icons";
import { TopTabBar } from "./TopTabBar";

const ACCENT_CYCLE: AccentColor[] = [
  "terracotta",
  "sky",
  "emerald",
  "amber",
  "violet",
  "rose",
];

function useIsDesktopApp(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => Boolean(typeof window !== "undefined" && window.multiclaudeDesktop),
    () => false,
  );
}

function isPersistableTabUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (
      host.includes("accounts.google.") ||
      host.includes("appleid.apple.") ||
      host.includes("challenges.cloudflare.")
    ) {
      return false;
    }
    if (
      host.endsWith("claude.ai") &&
      (path.startsWith("/login") ||
        path.startsWith("/oauth") ||
        path.startsWith("/magic-link"))
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function MultiClaudeWorkspace() {
  const workspace = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );
  const isDesktop = useIsDesktopApp();
  const [topOffset, setTopOffset] = useState(55);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [modalState, setModalState] = useState<
    | { mode: "create"; tab: ClaudeTabProfile }
    | { mode: "edit"; tab: ClaudeTabProfile }
    | null
  >(null);

  const headerContainerRef = useRef<HTMLDivElement>(null);

  const activeTab =
    workspace.tabs.find((t) => t.id === workspace.activeTabId) ??
    workspace.tabs[0];

  useEffect(() => {
    const el = headerContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setTopOffset(Math.ceil(rect.height));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bridge = window.multiclaudeDesktop;
    if (!bridge) return;

    const unsubscribe = bridge.onTabStatus((status) => {
      if (typeof status.loading === "boolean") {
        setLoadingMap((prev) => ({
          ...prev,
          [status.tabId]: Boolean(status.loading),
        }));
      }
      if (status.url && isPersistableTabUrl(status.url)) {
        updateWorkspace((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) =>
            tab.id === status.tabId && tab.url !== status.url
              ? { ...tab, url: status.url || DEFAULT_CLAUDE_URL }
              : tab,
          ),
        }));
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const bridge = window.multiclaudeDesktop;
    if (!bridge) return;

    void bridge.syncTabs({
      tabs: workspace.tabs.map((t) => ({ id: t.id, url: t.url })),
      activeTabId: activeTab.id,
      topOffset,
      modalOpen: Boolean(modalState),
    });
  }, [workspace.tabs, activeTab.id, topOffset, modalState]);

  function handleOpenAddTab() {
    const existing = new Set(workspace.tabs.map((t) => t.id));
    let num = workspace.tabs.length + 1;
    let candidateId = `tab-${num}`;
    while (existing.has(candidateId)) {
      num += 1;
      candidateId = `tab-${num}`;
    }

    setModalState({
      mode: "create",
      tab: {
        id: candidateId,
        tabName: `Tab ${num}`,
        email: "",
        url: DEFAULT_CLAUDE_URL,
        accent: ACCENT_CYCLE[(num - 1) % ACCENT_CYCLE.length],
      },
    });
  }

  function handleSaveTab(updated: ClaudeTabProfile, previousId?: string) {
    const safeId = slugifyTabId(updated.id);
    const normalized: ClaudeTabProfile = { ...updated, id: safeId };

    updateWorkspace((prev) => {
      if (!previousId) {
        return {
          tabs: [...prev.tabs, normalized],
          activeTabId: normalized.id,
        };
      }

      return {
        tabs: prev.tabs.map((t) => (t.id === previousId ? normalized : t)),
        activeTabId:
          prev.activeTabId === previousId ? normalized.id : prev.activeTabId,
      };
    });

    if (previousId && previousId === normalized.id && window.multiclaudeDesktop) {
      void window.multiclaudeDesktop.navigateTab(normalized.id, normalized.url);
    }

    setModalState(null);
  }

  function handleDeleteTab(tabId: string) {
    updateWorkspace((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const remaining = prev.tabs.filter((t) => t.id !== tabId);
      return {
        tabs: remaining,
        activeTabId:
          prev.activeTabId === tabId ? remaining[0].id : prev.activeTabId,
      };
    });
    setModalState(null);
  }

  const activeTheme = ACCENT_THEMES[activeTab.accent];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#212120] text-[#eceae4]">
      <div ref={headerContainerRef}>
        <TopTabBar
          tabs={workspace.tabs}
          activeTabId={activeTab.id}
          loadingMap={loadingMap}
          isDesktop={isDesktop}
          onSelectTab={(tabId) =>
            updateWorkspace((prev) => ({ ...prev, activeTabId: tabId }))
          }
          onAddTab={handleOpenAddTab}
          onEditTab={(tab) => setModalState({ mode: "edit", tab })}
          onCloseTab={handleDeleteTab}
          onGoBack={() => void window.multiclaudeDesktop?.goBackTab(activeTab.id)}
          onReload={() => void window.multiclaudeDesktop?.reloadTab(activeTab.id)}
          onGoHome={() =>
            void window.multiclaudeDesktop?.navigateTab(
              activeTab.id,
              DEFAULT_CLAUDE_URL,
            )
          }
        />
      </div>

      {/* Each tab mounts its own distinct ID slot */}
      <main className="relative flex min-h-0 flex-1 flex-col bg-[#212120]">
        {workspace.tabs.map((tab) => {
          const isCurrent = tab.id === activeTab.id;
          return (
            <section
              key={tab.id}
              id={tab.id}
              data-tab-id={tab.id}
              data-email={tab.email}
              data-partition={`persist:${tab.id}`}
              data-url={tab.url}
              className={
                isCurrent
                  ? "flex flex-1 flex-col items-center justify-center p-6 text-center"
                  : "hidden"
              }
            >
              {isDesktop ? (
                <div className="space-y-2 text-xs text-[#9b9992]">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#2a2a28]">
                    <ClaudeStarburst className="h-5 w-5 animate-pulse text-[#d97757]" />
                  </div>
                  <p className="font-medium text-[#e6e4de]">
                    {tab.tabName} · {tab.email}
                  </p>
                  <p className="font-mono text-[11px]">
                    Loading {tab.url} in isolated session{" "}
                    <span className="text-[#d4d2cc]">persist:{tab.id}</span>
                  </p>
                </div>
              ) : (
                <div className="max-w-lg space-y-4 rounded-2xl border border-[#3a3a37] bg-[#292927] p-6 shadow-xl">
                  <div className="flex items-center justify-center gap-2">
                    <ClaudeStarburst className="h-6 w-6 text-[#d97757]" />
                    <span className="text-base font-semibold text-white">
                      {tab.tabName} · {tab.email}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-[#3f3f3c] bg-[#1e1e1c] px-3 py-1 font-mono text-xs text-[#cfcdc7]">
                    <span className={`h-2 w-2 rounded-full ${activeTheme.dot}`} />
                    <span>id: {tab.id}</span>
                    <span>·</span>
                    <span>persist:{tab.id}</span>
                  </div>

                  <p className="text-xs leading-relaxed text-[#b2b0a9]">
                    Regular web browsers block embedding{" "}
                    <code className="font-mono text-[#eceae4]">
                      https://claude.ai/new
                    </code>{" "}
                    (<code className="font-mono">X-Frame-Options: SAMEORIGIN</code>)
                    and share login cookies across tabs. Launch the desktop
                    shell so each tab runs in its own isolated browser session
                    for a separate email login:
                  </p>

                  <div className="rounded-xl border border-[#3e3e3b] bg-[#1b1b19] px-3.5 py-2.5 font-mono text-xs text-[#f1efe9]">
                    npm run desktop
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <a
                      href={tab.url || DEFAULT_CLAUDE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#d97757] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#c56547]"
                    >
                      <span>Open https://claude.ai/new</span>
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setModalState({ mode: "edit", tab })}
                      className="rounded-xl border border-[#444440] bg-[#30302e] px-3.5 py-2 text-xs font-medium text-[#e3e1db] transition hover:bg-[#3a3a37]"
                    >
                      Edit Tab ID / Email
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>

      {modalState && (
        <AccountModal
          mode={modalState.mode}
          initialTab={modalState.tab}
          existingIds={workspace.tabs.map((t) => t.id)}
          canDelete={workspace.tabs.length > 1}
          isDesktop={isDesktop}
          onClose={() => setModalState(null)}
          onSave={handleSaveTab}
          onDelete={handleDeleteTab}
          onClearSession={async (tabId) => {
            await window.multiclaudeDesktop?.clearPartition(tabId);
          }}
        />
      )}
    </div>
  );
}
