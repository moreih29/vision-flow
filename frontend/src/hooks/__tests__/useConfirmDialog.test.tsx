import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirmDialog } from '../useConfirmDialog'

// wrapper 컴포넌트: confirmDialog를 렌더링하고 테스트 버튼을 제공
function TestComponent({
  onResult,
}: {
  onResult?: (result: boolean) => void
}) {
  const { confirmDialog, confirm } = useConfirmDialog()

  const handleOpen = async () => {
    const result = await confirm({ title: '삭제하시겠습니까?' })
    onResult?.(result)
  }

  return (
    <>
      {confirmDialog}
      <button onClick={handleOpen}>열기</button>
    </>
  )
}

describe('useConfirmDialog', () => {
  it('confirm 호출 시 다이얼로그 표시', async () => {
    const user = userEvent.setup()
    render(<TestComponent />)

    await user.click(screen.getByText('열기'))

    expect(screen.getByText('삭제하시겠습니까?')).toBeInTheDocument()
  })

  it('확인 클릭 시 true 반환', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<TestComponent onResult={onResult} />)

    await user.click(screen.getByText('열기'))

    // AlertDialogAction은 Button으로 렌더링되며 confirmLabel 기본값은 '확인'
    const actionButton = screen.getByText('확인')
    await user.click(actionButton)

    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('취소 클릭 시 false 반환', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<TestComponent onResult={onResult} />)

    await user.click(screen.getByText('열기'))

    // AlertDialogCancel은 cancelLabel 기본값 '취소'로 렌더링
    const cancelButton = screen.getByText('취소')
    await user.click(cancelButton)

    expect(onResult).toHaveBeenCalledWith(false)
  })
})
