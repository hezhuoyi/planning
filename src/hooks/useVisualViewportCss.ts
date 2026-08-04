import { useEffect } from 'react'

/** 同步 iOS Safari 可视视口，避免键盘顶起后 fixed 弹窗被挡住 */
export function useVisualViewportCss() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport

    const sync = () => {
      const height = vv?.height ?? window.innerHeight
      const offsetTop = vv?.offsetTop ?? 0
      root.style.setProperty('--vv-height', `${Math.round(height)}px`)
      root.style.setProperty('--vv-offset-top', `${Math.round(offsetTop)}px`)
    }

    sync()
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('resize', sync)

    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--vv-height')
      root.style.removeProperty('--vv-offset-top')
    }
  }, [])
}
