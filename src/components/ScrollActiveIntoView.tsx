'use client'

import { useEffect } from 'react'

/** On narrow screens the series filter is a horizontal scroller; bring the selected pill into view. */
export function ScrollActiveIntoView({ selector }: { selector: string }) {
  useEffect(() => {
    document.querySelector(selector)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selector])
  return null
}
