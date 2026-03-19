import { useCallback, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface AlertOptions {
  title: string
  description?: string
  confirmLabel?: string
}

type DialogMode = 'confirm' | 'alert'

interface DialogState {
  open: boolean
  mode: DialogMode
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  variant: 'default' | 'destructive'
}

export function useConfirmDialog() {
  const [state, setState] = useState<DialogState>({
    open: false,
    mode: 'confirm',
    title: '',
    confirmLabel: '\uD655\uC778',
    cancelLabel: '\uCDE8\uC18C',
    variant: 'default',
  })
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setState({
        open: true,
        mode: 'confirm',
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? '\uD655\uC778',
        cancelLabel: options.cancelLabel ?? '\uCDE8\uC18C',
        variant: options.variant ?? 'default',
      })
    })
  }, [])

  const showAlert = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = () => resolve()
      setState({
        open: true,
        mode: 'alert',
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? '\uD655\uC778',
        cancelLabel: '',
        variant: 'default',
      })
    })
  }, [])

  const handleAction = useCallback(() => {
    resolveRef.current?.(true)
    resolveRef.current = null
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    resolveRef.current = null
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const confirmDialog = (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description && (
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {state.mode === 'confirm' && (
            <AlertDialogCancel onClick={handleCancel}>
              {state.cancelLabel}
            </AlertDialogCancel>
          )}
          <AlertDialogAction variant={state.variant} onClick={handleAction}>
            {state.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmDialog, confirm, showAlert }
}
