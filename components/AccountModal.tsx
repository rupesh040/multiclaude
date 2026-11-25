"use client";

import { useState } from "react";
import {
  ACCENT_THEMES,
  DEFAULT_CLAUDE_URL,
  slugifyTabId,
} from "@/lib/profiles";
import type { AccentColor, ClaudeTabProfile } from "@/lib/types";
import { RefreshIcon, TrashIcon, XIcon } from "./Icons";

interface AccountModalProps {
  mode: "create" | "edit";
  initialTab: ClaudeTabProfile;
  existingIds: string[];
  canDelete: boolean;
  isDesktop: boolean;
  onClose: () => void;
  onSave: (updated: ClaudeTabProfile, previousId?: string) => void;
  onDelete?: (tabId: string) => void;
  onClearSession?: (tabId: string) => Promise<void>;
}

const ACCENT_KEYS = Object.keys(ACCENT_THEMES) as AccentColor[];

export function AccountModal({
  mode,
  initialTab,
  existingIds,
  canDelete,
  isDesktop,
  onClose,
  onSave,
  onDelete,
  onClearSession,
}: AccountModalProps) {
  const [tabName, setTabName] = useState(initialTab.tabName);
  const [tabId, setTabId] = useState(initialTab.id);
  const [idEdited, setIdEdited] = useState(mode === "edit");
  const [email, setEmail] = useState(initialTab.email);
  const [url, setUrl] = useState(initialTab.url || DEFAULT_CLAUDE_URL);
  const [accent, setAccent] = useState<AccentColor>(initialTab.accent);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedId = slugifyTabId(tabId);
    const cleanedEmail = email.trim();
    const cleanedName = tabName.trim() || cleanedId;

    if (!cleanedEmail) {
      setError("Please enter an email label for this tab.");
      return;
    }

    const conflict = existingIds.some(
      (id) => id === cleanedId && (mode === "create" || id !== initialTab.id),
    );
    if (conflict) {
      setError(
        `Tab ID "${cleanedId}" is already in use. Each tab must have a unique ID for separate login cookies.`,
      );
      return;
    }

    onSave(
      {
        id: cleanedId,
        tabName: cleanedName,
        email: cleanedEmail,
        url: url.trim() || DEFAULT_CLAUDE_URL,
        accent,
      },
      mode === "edit" ? initialTab.id : undefined,
    );
  }

  async function handleClearCookies() {
    if (!onClearSession) return;
    setClearing(true);
    try {
      await onClearSession(initialTab.id);
      onClose();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#3e3e3a] bg-[#262624] p-5 text-[#eceae4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#373734] pb-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              {mode === "create"
                ? "Add New Tab"
                : `${initialTab.tabName} · #${initialTab.id}`}
            </h2>
            <p className="text-xs text-[#9b9992]">
              Partition{" "}
              <code className="font-mono text-[#d4d2cc]">
                persist:{slugifyTabId(tabId)}
              </code>{" "}
              keeps login cookies completely separate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9b9992] transition hover:bg-[#353532] hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#cfcdc7]">
                Tab Label *
              </span>
              <input
                type="text"
                required
                value={tabName}
                onChange={(e) => {
                  const val = e.target.value;
                  setTabName(val);
                  if (mode === "create" && !idEdited) {
                    setTabId(slugifyTabId(val));
                  }
                }}
                placeholder="Tab 4"
                className="w-full rounded-xl border border-[#3e3e3b] bg-[#1e1e1c] px-3 py-2 text-xs text-white focus:border-[#d97757] focus:outline-none"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-[#cfcdc7]">
                Unique Tab ID *
              </span>
              <input
                type="text"
                required
                value={tabId}
                onChange={(e) => {
                  setIdEdited(true);
                  setTabId(e.target.value);
                }}
                placeholder="tab-4"
                className="w-full rounded-xl border border-[#3e3e3b] bg-[#1e1e1c] px-3 py-2 font-mono text-xs text-white focus:border-[#d97757] focus:outline-none"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#cfcdc7]">
              Email Label for This Tab *
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="account@gmail.com"
              className="w-full rounded-xl border border-[#3e3e3b] bg-[#1e1e1c] px-3 py-2 text-xs text-white focus:border-[#d97757] focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[#cfcdc7]">
              Website URL
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://claude.ai/new"
              className="w-full rounded-xl border border-[#3e3e3b] bg-[#1e1e1c] px-3 py-2 font-mono text-xs text-white focus:border-[#d97757] focus:outline-none"
            />
          </label>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[#cfcdc7]">
              Tab Dot Color
            </span>
            <div className="flex flex-wrap gap-2">
              {ACCENT_KEYS.map((key) => {
                const theme = ACCENT_THEMES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAccent(key)}
                    title={theme.name}
                    className={`h-6 w-6 rounded-full border-2 transition ${theme.dot} ${
                      accent === key
                        ? "scale-110 border-white"
                        : "border-transparent opacity-65 hover:opacity-100"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {mode === "edit" && isDesktop && onClearSession && (
            <div className="rounded-xl border border-[#3a3a37] bg-[#1e1e1c] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-white">
                    Reset Login Session
                  </p>
                  <p className="text-[11px] text-[#9b9992]">
                    Clears cookies in <code className="font-mono">persist:{initialTab.id}</code> to sign in with another email.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCookies}
                  disabled={clearing}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#444440] bg-[#2a2a28] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#353532] disabled:opacity-50"
                >
                  <RefreshIcon
                    className={`h-3 w-3 ${clearing ? "animate-spin" : ""}`}
                  />
                  <span>Sign Out Tab</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-[#373734] pt-3">
            {mode === "edit" && canDelete && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(initialTab.id)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-950/50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span>Delete Tab</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#3e3e3b] px-3.5 py-2 text-xs font-medium text-[#cfcdc7] transition hover:bg-[#323230]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#d97757] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#c56547]"
              >
                {mode === "create" ? "Create Tab" : "Save Tab"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
