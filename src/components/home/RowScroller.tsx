'use client'

import React, { useRef } from 'react'

import { Icon } from '@/components/Icon'

/** Horizontal, scroll-snapping shelf with previous/next buttons (touch and trackpads scroll natively). */
export function RowScroller({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <div className="kh-row__scroller">
      <button type="button" className="kh-row__nav kh-row__nav--prev" onClick={() => scroll(-1)} aria-label={`Scroll ${label} left`}>
        <Icon name="chevronLeft" size={22} />
      </button>
      <ul className="kh-row__track" ref={ref} aria-label={label}>
        {children}
      </ul>
      <button type="button" className="kh-row__nav kh-row__nav--next" onClick={() => scroll(1)} aria-label={`Scroll ${label} right`}>
        <Icon name="chevronRight" size={22} />
      </button>
    </div>
  )
}
