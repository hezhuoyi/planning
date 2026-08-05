import { useCallback, useEffect, useRef, useState } from 'react'

const CLOSE_MS = 240
const SCROLLABLE_SELECTOR =
  '.task-dialog form, .delete-confirm, .dialog-body'

function findScrollParent(target: Element): HTMLElement | null {
  let node: HTMLElement | null =
    target.closest(SCROLLABLE_SELECTOR) instanceof HTMLElement
      ? (target.closest(SCROLLABLE_SELECTOR) as HTMLElement)
      : null

  while (node) {
    const { scrollHeight, clientHeight } = node
    if (scrollHeight > clientHeight + 1) return node

    const parentMatch = node.parentElement?.closest(SCROLLABLE_SELECTOR)
    node = parentMatch instanceof HTMLElement ? parentMatch : null
  }

  return null
}

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

      const scrollParent = findScrollParent(target)
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
