import { useCallback, useEffect, useRef, useState } from 'react'

export function useMultiSelect(itemKeys: string[], resetKey?: string | number) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const lastClickedIndexRef = useRef<number>(-1)

  useEffect(() => {
    setSelectedKeys(new Set())
    lastClickedIndexRef.current = -1
  }, [resetKey])

  const handleItemClick = useCallback(
    (
      index: number,
      event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    ) => {
      const key = itemKeys[index]
      if (!key) return

      setSelectedKeys((prev) => {
        if (event.shiftKey && lastClickedIndexRef.current >= 0) {
          const start = Math.min(lastClickedIndexRef.current, index)
          const end = Math.max(lastClickedIndexRef.current, index)
          const rangeKeys = itemKeys.slice(start, end + 1)
          if (event.metaKey || event.ctrlKey) {
            const next = new Set(prev)
            rangeKeys.forEach((k) => next.add(k))
            return next
          }
          return new Set(rangeKeys)
        }

        if (event.metaKey || event.ctrlKey) {
          const next = new Set(prev)
          if (next.has(key)) next.delete(key)
          else next.add(key)
          lastClickedIndexRef.current = index
          return next
        }

        lastClickedIndexRef.current = index
        return new Set([key])
      })
    },
    [itemKeys],
  )

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
    lastClickedIndexRef.current = -1
  }, [])

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(itemKeys))
  }, [itemKeys])

  const toggleItem = useCallback(
    (index: number) => {
      const key = itemKeys[index]
      if (!key) return
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
      lastClickedIndexRef.current = index
    },
    [itemKeys],
  )

  return {
    selectedKeys,
    selectedCount: selectedKeys.size,
    handleItemClick,
    toggleItem,
    clearSelection,
    selectAll,
  }
}
