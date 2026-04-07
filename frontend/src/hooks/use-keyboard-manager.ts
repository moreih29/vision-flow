import { useEffect, useLayoutEffect, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  handler: (e: KeyboardEvent) => void;
  enabled?: boolean;
  priority?: number;
  ignoreInput?: boolean;
}

export interface KeyboardManagerOptions {
  enabled?: boolean;
}

interface ParsedKey {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  key: string;
}

function parseShortcutKey(shortcut: string): ParsedKey {
  const parts = shortcut.split("+");
  const key = parts[parts.length - 1];
  return {
    ctrl: parts.includes("Ctrl"),
    meta: parts.includes("Meta"),
    shift: parts.includes("Shift"),
    key,
  };
}

function matchesEvent(parsed: ParsedKey, e: KeyboardEvent): boolean {
  if (parsed.ctrl && !(e.ctrlKey || e.metaKey)) return false;
  if (parsed.meta && !e.metaKey) return false;
  if (parsed.shift && !e.shiftKey) return false;
  if (!parsed.ctrl && !parsed.meta && (e.ctrlKey || e.metaKey)) return false;
  if (!parsed.shift && e.shiftKey) return false;
  return e.key === parsed.key;
}

export function useKeyboardManager(
  ref: React.RefObject<HTMLElement | null>,
  shortcuts: KeyboardShortcut[],
  options?: KeyboardManagerOptions,
) {
  const shortcutsRef = useRef(shortcuts);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    shortcutsRef.current = shortcuts;
    optionsRef.current = options;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      if (optionsRef.current?.enabled === false) return;

      const active = shortcutsRef.current
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const shortcut of active) {
        const parsed = parseShortcutKey(shortcut.key);
        if (!matchesEvent(parsed, e)) continue;

        const ignoreInput = shortcut.ignoreInput !== false;
        if (ignoreInput) {
          const target = e.target as HTMLElement;
          if (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          )
            continue;
        }

        shortcut.handler(e);
        break;
      }
    };

    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [ref]);
}
