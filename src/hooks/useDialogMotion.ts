import { useCallback, useEffect, useRef, useState } from 'react'

const CLOSE_MS = 240
const SCROLLABLE_SELECTOR = '.task-dialog form, .sync-section, .delete-confirm'

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

    const { documentElement: html, body } = document
    const scrollY = window.scrollY
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyTouchAction: body.style.touchAction,
    }

    // 页面实际滚动在 html；iOS 还需 fixed 锁住视觉位置
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.touchAction = 'none'

    let touchStartY = 0

    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) return

      const target = event.target
      if (!(target instanceof Element)) {
        event.preventDefault()
        return
      }

      const scrollParent = target.closest(SCROLLABLE_SELECTOR)
      if (!(scrollParent instanceof HTMLElement)) {
        event.preventDefault()
        return
      }

      const { scrollTop, scrollHeight, clientHeight } = scrollParent
      const canScroll = scrollHeight > clientHeight + 1
      if (!canScroll) {
        event.preventDefault()
        return
      }

      const currentY = event.touches[0]?.clientY ?? 0
      const deltaY = currentY - touchStartY
      const atTop = scrollTop <= 0
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1

      // 顶/底继续拖时阻断链式滚动到背景
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)

      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      body.style.position = previous.bodyPosition
      body.style.top = previous.bodyTop
      body.style.width = previous.bodyWidth
      body.style.touchAction = previous.bodyTouchAction
      window.scrollTo(0, scrollY)

      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [requestClose])

  return { leaving, requestClose }
}
