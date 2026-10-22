'use client'

import { useEffect } from 'react'

const SELECTOR = '[data-reveal]:not(.is-visible)'

/**
 * Fades/slides `[data-reveal]` elements in as they scroll into view (once). Children of a
 * `[data-reveal-stagger]` parent animate one after another. Elements added later (e.g. the
 * book grid after picking another series without a page reload) are picked up too.
 * Without JS everything is simply visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('kh-js')
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-visible')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    const observeAll = (scope: ParentNode) => {
      if (scope instanceof Element && scope.matches(SELECTOR)) io.observe(scope)
      scope.querySelectorAll(SELECTOR).forEach((el) => io.observe(el))
    }
    observeAll(document)

    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && observeAll(n))
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return null
}
