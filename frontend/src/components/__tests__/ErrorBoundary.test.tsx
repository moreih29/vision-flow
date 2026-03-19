import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

// 에러를 throw하는 테스트용 컴포넌트
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('테스트 에러')
  }
  return <div>정상 콘텐츠</div>
}

describe('ErrorBoundary', () => {
  // ErrorBoundary가 console.error를 호출하므로 에러 로그 억제
  const originalError = console.error

  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalError
  })

  it('정상 렌더링 시 children 표시', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('정상 콘텐츠')).toBeInTheDocument()
  })

  it('에러 발생 시 에러 UI 표시', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    expect(screen.getByText('새로고침')).toBeInTheDocument()
  })
})
