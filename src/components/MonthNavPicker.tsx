import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, startOfMonth } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = Array.from({ length: 12 }, (_, index) => index)

type MonthNavPickerProps = {
  value: Date
  onChange: (month: Date) => void
}

export function MonthNavPicker({ value, onChange }: MonthNavPickerProps) {
  const [open, setOpen] = useState(false)
  const [draftYear, setDraftYear] = useState(value.getFullYear())
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDraftYear(value.getFullYear())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, value])

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null)
      return
    }

    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const popoverWidth = Math.min(228, window.innerWidth - 28)
      const half = popoverWidth / 2
      const centerX = rect.left + rect.width / 2
      const minCenter = 14 + half
      const maxCenter = window.innerWidth - 14 - half
      setPopoverPos({
        top: rect.bottom + 6,
        left: Math.min(maxCenter, Math.max(minCenter, centerX)),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <div className="month-nav-picker-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="month-nav-picker"
        aria-label="选择月份"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="month-nav-label">{format(value, 'yyyy年M月')}</span>
        <ChevronDown className="month-nav-picker-caret" size={14} aria-hidden="true" />
      </button>

      {open &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="month-picker-popover"
            role="dialog"
            aria-label="选择月份"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="month-picker-year">
              <button
                type="button"
                className="icon-button"
                aria-label="上一年"
                onClick={() => setDraftYear((year) => year - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong>{draftYear}年</strong>
              <button
                type="button"
                className="icon-button"
                aria-label="下一年"
                onClick={() => setDraftYear((year) => year + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="month-picker-grid">
              {MONTHS.map((month) => {
                const selected =
                  value.getFullYear() === draftYear && value.getMonth() === month
                return (
                  <button
                    key={month}
                    type="button"
                    className={selected ? 'is-selected' : undefined}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => {
                      onChange(startOfMonth(new Date(draftYear, month, 1)))
                      setOpen(false)
                    }}
                  >
                    {month + 1}月
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
