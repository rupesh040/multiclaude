"use client";

import { ACCENT_THEMES } from "@/lib/profiles";
import type { ClaudeTabProfile } from "@/lib/types";
import {
  ArrowLeftIcon,
  HomeIcon,
  PlusIcon,
  RefreshIcon,
  SlidersIcon,
  XIcon,
} from "./Icons";

interface TopTabBarProps {
  tabs: ClaudeTabProfile[];
  activeTabId: string;
  loadingMap: Record<string, boolean>;
  isDesktop: boolean;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onEditTab: (tab: ClaudeTabProfile) => void;
  onCloseTab: (tabId: string) => void;
  onGoBack: () => void;
  onReload: () => void;
  onGoHome: () => void;
}

export function TopTabBar({
  tabs,
  activeTabId,
  loadingMap,
  isDesktop,
  onSelectTab,
  onAddTab,
  onEditTab,
  onCloseTab,
  onGoBack,
  onReload,
  onGoHome,
}: TopTabBarProps) {
  return (
    <header className="flex items-center gap-2 border-b border-[#2c2c2a] bg-[#212120] px-2.5 py-2">
      {/* Compact Browser Navigation Controls */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!isDesktop}
          title="Back in active tab"
          className="flex h-9 w-8 items-center justify-center rounded-lg text-[#9b9992] transition hover:bg-[#2d2d2b] hover:text-white disabled:opacity-35"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onReload}
          disabled={!isDesktop}
          title="Reload active tab"
          className="flex h-9 w-8 items-center justify-center rounded-lg text-[#9b9992] transition hover:bg-[#2d2d2b] hover:text-white disabled:opacity-35"
        >
          <RefreshIcon
            className={`h-3.5 w-3.5 ${loadingMap[activeTabId] ? "animate-spin text-[#d97757]" : ""}`}
          />
        </button>
        <button
          type="button"
          onClick={onGoHome}
          disabled={!isDesktop}
          title="Load https://claude.ai/new in active tab"
          className="flex h-9 w-8 items-center justify-center rounded-lg text-[#9b9992] transition hover:bg-[#2d2d2b] hover:text-white disabled:opacity-35"
        >
          <HomeIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal Isolated Account Tabs */}
      <div
        role="tablist"
        aria-label="Isolated Claude account tabs"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isLoading = Boolean(loadingMap[tab.id]);
          const theme = ACCENT_THEMES[tab.accent];

          return (
            <div
              key={tab.id}
              id={`tab-trigger-${tab.id}`}
              data-tab-id={tab.id}
              data-email={tab.email}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => onEditTab(tab)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectTab(tab.id);
                }
              }}
              className={`group relative flex h-[38px] min-w-[190px] flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg px-3.5 transition select-none ${
                isActive
                  ? "border border-[#464642] bg-[#30302e] text-[#f3f2ee]"
                  : "border border-transparent bg-[#292927] text-[#cfcdc7] hover:bg-[#2e2e2c]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${theme.dot} ${
                    isLoading ? "animate-pulse" : ""
                  }`}
                />
                <span className="shrink-0 text-[12.5px] font-semibold text-white">
                  {tab.tabName}
                </span>
                <span className="truncate text-[12px] text-[#86847e]">
                  {tab.email}
                </span>
              </div>

              <div
                className="flex shrink-0 items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  title={`Isolated session partition: persist:${tab.id}`}
                  className={`hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex ${
                    isActive
                      ? "bg-[#222220] text-[#b4b2ac]"
                      : "bg-[#222220]/70 text-[#7d7b75]"
                  }`}
                >
                  #{tab.id}
                </span>

                <button
                  type="button"
                  onClick={() => onEditTab(tab)}
                  title={`Edit ${tab.tabName} (#${tab.id})`}
                  className="rounded p-1 text-[#83817b] opacity-0 transition group-hover:opacity-100 hover:bg-[#3c3c39] hover:text-white focus:opacity-100"
                >
                  <SlidersIcon className="h-3 w-3" />
                </button>

                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onCloseTab(tab.id)}
                    title={`Close ${tab.tabName}`}
                    className="rounded p-1 text-[#83817b] opacity-0 transition group-hover:opacity-100 hover:bg-[#3c3c39] hover:text-white focus:opacity-100"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Tab */}
      <button
        type="button"
        onClick={onAddTab}
        title="Add a new Claude tab with separate login session"
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-[#2a2a28] text-[#a09e98] transition hover:bg-[#353532] hover:text-white"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </header>
  );
}
