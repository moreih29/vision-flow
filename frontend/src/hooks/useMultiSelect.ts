import { useCallback, useEffect, useRef, useState } from "react";

export function useMultiSelect(itemKeys: string[], resetKey?: string | number) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number>(-1);
  const cursorIndexRef = useRef<number>(-1);
  const pendingSelectKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const pending = pendingSelectKeyRef.current;
    pendingSelectKeyRef.current = null;
    if (pending) {
      setSelectedKeys(new Set([pending]));
      const index = itemKeys.indexOf(pending);
      if (index >= 0) {
        lastClickedIndexRef.current = index;
        cursorIndexRef.current = index;
      }
    } else {
      setSelectedKeys(new Set());
      lastClickedIndexRef.current = -1;
      cursorIndexRef.current = -1;
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleItemClick = useCallback(
    (
      index: number,
      event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    ) => {
      const key = itemKeys[index];
      if (!key) return;

      setSelectedKeys((prev) => {
        if (event.shiftKey && lastClickedIndexRef.current >= 0) {
          const start = Math.min(lastClickedIndexRef.current, index);
          const end = Math.max(lastClickedIndexRef.current, index);
          const rangeKeys = itemKeys.slice(start, end + 1);
          if (event.metaKey || event.ctrlKey) {
            const next = new Set(prev);
            rangeKeys.forEach((k) => next.add(k));
            return next;
          }
          return new Set(rangeKeys);
        }

        if (event.metaKey || event.ctrlKey) {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          lastClickedIndexRef.current = index;
          return next;
        }

        lastClickedIndexRef.current = index;
        return new Set([key]);
      });
    },
    [itemKeys],
  );

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    lastClickedIndexRef.current = -1;
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(itemKeys));
  }, [itemKeys]);

  const toggleItem = useCallback(
    (index: number) => {
      const key = itemKeys[index];
      if (!key) return;
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      lastClickedIndexRef.current = index;
    },
    [itemKeys],
  );

  const selectByKey = useCallback(
    (key: string) => {
      pendingSelectKeyRef.current = key;
      setSelectedKeys(new Set([key]));
      const index = itemKeys.indexOf(key);
      if (index >= 0) {
        lastClickedIndexRef.current = index;
        cursorIndexRef.current = index;
      }
    },
    [itemKeys],
  );

  // anchor(lastClickedIndexRef)에서 targetIndex까지 범위 선택.
  // cursor(cursorIndexRef)만 업데이트하고 anchor는 유지.
  const selectTo = useCallback(
    (targetIndex: number) => {
      const anchor = lastClickedIndexRef.current;
      if (anchor < 0) {
        const key = itemKeys[targetIndex];
        if (key) {
          setSelectedKeys(new Set([key]));
          lastClickedIndexRef.current = targetIndex;
          cursorIndexRef.current = targetIndex;
        }
        return;
      }
      const start = Math.min(anchor, targetIndex);
      const end = Math.max(anchor, targetIndex);
      const rangeKeys = itemKeys.slice(start, end + 1);
      setSelectedKeys(new Set(rangeKeys));
      cursorIndexRef.current = targetIndex;
    },
    [itemKeys],
  );

  return {
    selectedKeys,
    selectedCount: selectedKeys.size,
    handleItemClick,
    toggleItem,
    clearSelection,
    selectAll,
    selectByKey,
    selectTo,
    cursorIndexRef,
  };
}
