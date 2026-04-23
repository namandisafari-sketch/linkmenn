import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export type ShortcutAction =
  | { type: "navigate"; path: string }
  | { type: "callback"; fn: () => void };

export interface ShortcutMap {
  [key: string]: ShortcutAction;
}

/**
 * Build a key signature like "F8", "Alt+R", "Ctrl+Enter", "Escape".
 */
const sig = (e: KeyboardEvent): string => {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && e.key.length > 1) parts.push("Shift");
  // Function keys, Escape, Enter etc. use e.key directly
  let k = e.key;
  if (k === " ") k = "Space";
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
};

const isTypingTarget = (el: EventTarget | null): boolean => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "INPUT") {
    const type = (t as HTMLInputElement).type;
    // Allow F-keys & escape even inside inputs; we filter at handler level
    return type !== "checkbox" && type !== "radio" && type !== "button";
  }
  return tag === "TEXTAREA" || tag === "SELECT";
};

/**
 * Global keyboard shortcuts — works app-wide.
 * F-keys, Escape, and Ctrl/Alt combos are honored even when an input is focused.
 * Plain letter keys are ignored when typing.
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutMap, enabled = true) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const key = sig(e);
      const action = shortcuts[key];
      if (!action) return;

      const typing = isTypingTarget(e.target);
      const isFKey = /^F\d{1,2}$/.test(e.key);
      const isCombo = e.ctrlKey || e.metaKey || e.altKey;
      const isEscape = e.key === "Escape";

      // Ignore plain letter shortcuts while typing
      if (typing && !isFKey && !isCombo && !isEscape) return;

      e.preventDefault();
      e.stopPropagation();

      if (action.type === "navigate") navigate(action.path);
      else action.fn();
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [shortcuts, enabled, navigate]);
};
