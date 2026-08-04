const PRESS_SELECTOR = 'button, .task-mark, .check-row, .brand-button, .summary-switch button, .mode-switch button'

function resolveTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  return node.closest(PRESS_SELECTOR) as HTMLElement | null
}

/** 为可点击元素写入涟漪坐标，并短暂加上 is-pressed */
export function enablePressFeedback(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = resolveTarget(event.target)
    if (!target || target.hasAttribute('disabled')) return
    const rect = target.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100
    target.style.setProperty('--rx', `${x}%`)
    target.style.setProperty('--ry', `${y}%`)
    target.classList.remove('is-pressed')
    // 强制重启动画
    void target.offsetWidth
    target.classList.add('is-pressed')
  }

  const clearPressed = (event: Event) => {
    const target = resolveTarget(event.target)
    if (!target) return
    window.setTimeout(() => target.classList.remove('is-pressed'), 180)
  }

  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointerup', clearPressed, { passive: true })
  document.addEventListener('pointercancel', clearPressed, { passive: true })
  document.addEventListener('pointerleave', clearPressed, { passive: true })

  return () => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('pointerup', clearPressed)
    document.removeEventListener('pointercancel', clearPressed)
    document.removeEventListener('pointerleave', clearPressed)
  }
}
