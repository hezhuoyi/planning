import { useCallback, useEffect, useRef, useState } from 'react'

const CLOSE_MS = 240

/** 弹窗关闭时先播退出动画，再真正卸载 */
export function useDialogMotion(onClose: () => void) {
  const [leaving, setLeaving] = useState(false)
  const leavingRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const requestClose = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onCloseRef.current()
    }, CLOSE_MS)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)

    const { body } = document
    const previousOverflow = body.style.overflow
    const previousTouchAction = body.style.touchAction
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'

    return () => {
      window.removeEventListener('keydown', onKey)
      body.style.overflow = previousOverflow
      body.style.touchAction = previousTouchAction
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [requestClose])

  return { leaving, requestClose }
}
