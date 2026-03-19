import { renderHook, act } from '@testing-library/react'
import { useMultiSelect } from '../useMultiSelect'

const items = ['a', 'b', 'c', 'd', 'e']

function noModifier() {
  return { shiftKey: false, metaKey: false, ctrlKey: false }
}

function ctrlClick() {
  return { shiftKey: false, metaKey: false, ctrlKey: true }
}

function shiftClick() {
  return { shiftKey: true, metaKey: false, ctrlKey: false }
}

describe('useMultiSelect', () => {
  it('초기 상태: 선택 없음', () => {
    const { result } = renderHook(() => useMultiSelect(items))
    expect(result.current.selectedKeys.size).toBe(0)
    expect(result.current.selectedCount).toBe(0)
  })

  it('단순 클릭: 단일 항목 선택', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(1, noModifier())
    })

    expect(result.current.selectedKeys.has('b')).toBe(true)
    expect(result.current.selectedCount).toBe(1)
  })

  it('단순 클릭: 이전 선택 대체', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(0, noModifier())
    })
    act(() => {
      result.current.handleItemClick(2, noModifier())
    })

    expect(result.current.selectedKeys.has('a')).toBe(false)
    expect(result.current.selectedKeys.has('c')).toBe(true)
    expect(result.current.selectedCount).toBe(1)
  })

  it('ctrl+클릭: 항목 토글 추가', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(0, noModifier())
    })
    act(() => {
      result.current.handleItemClick(2, ctrlClick())
    })

    expect(result.current.selectedKeys.has('a')).toBe(true)
    expect(result.current.selectedKeys.has('c')).toBe(true)
    expect(result.current.selectedCount).toBe(2)
  })

  it('ctrl+클릭: 이미 선택된 항목 해제', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(1, noModifier())
    })
    act(() => {
      result.current.handleItemClick(1, ctrlClick())
    })

    expect(result.current.selectedKeys.has('b')).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('shift+클릭: 범위 선택', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(1, noModifier())
    })
    act(() => {
      result.current.handleItemClick(3, shiftClick())
    })

    expect(result.current.selectedKeys.has('b')).toBe(true)
    expect(result.current.selectedKeys.has('c')).toBe(true)
    expect(result.current.selectedKeys.has('d')).toBe(true)
    expect(result.current.selectedCount).toBe(3)
  })

  it('shift+클릭: 역방향 범위 선택', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(3, noModifier())
    })
    act(() => {
      result.current.handleItemClick(1, shiftClick())
    })

    expect(result.current.selectedKeys.has('b')).toBe(true)
    expect(result.current.selectedKeys.has('c')).toBe(true)
    expect(result.current.selectedKeys.has('d')).toBe(true)
    expect(result.current.selectedCount).toBe(3)
  })

  it('clearSelection: 선택 초기화', () => {
    const { result } = renderHook(() => useMultiSelect(items))

    act(() => {
      result.current.handleItemClick(0, noModifier())
    })
    act(() => {
      result.current.handleItemClick(2, ctrlClick())
    })
    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedCount).toBe(0)
  })
})
