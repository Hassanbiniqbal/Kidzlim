'use client'

import Image from 'next/image'
import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useCart } from '@/components/cart/CartProvider'
import { Icon } from '@/components/Icon'

export type HeroSlide = {
  id: number
  slug: string
  title: string
  series: { title: string; slug: string } | null
  excerpt: string
  ageRange: string | null
  formats: string[]
  fromPrice: string | null
  cover: { src: string; thumb: string; alt: string; width: number; height: number }
  quickAdd: { bookId: number; sku: string; label: string } | null
}

const INTERVAL_MS = 7000

const REDUCED = '(prefers-reduced-motion: reduce)'
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const subscribeVisibility = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/**
 * Home hero: one featured book at a time over a blurred, slowly zooming backdrop of its cover.
 * Auto-advances (paused on hover/focus, hidden tabs and reduced motion); the thumbnail strip
 * switches books, with a progress bar on the active one.
 */
export function HomeHero({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0)
  const [hovered, setPaused] = useState(false)
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false)
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false)
  const paused = hovered || hidden
  const [added, setAdded] = useState<number | null>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const { add } = useCart()

  const count = slides.length
  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count])

  useEffect(() => {
    if (paused || reduced || count < 2) return
    const timer = window.setTimeout(() => go(active + 1), INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [active, paused, reduced, count, go])

  // Gentle 3D tilt of the cover towards the pointer.
  const onPointerMove = (e: React.PointerEvent) => {
    const el = artRef.current
    if (!el || reduced || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--tilt-x', `${((e.clientY - r.top) / r.height - 0.5) * -10}deg`)
    el.style.setProperty('--tilt-y', `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`)
  }
  const resetTilt = () => {
    artRef.current?.style.setProperty('--tilt-x', '0deg')
    artRef.current?.style.setProperty('--tilt-y', '0deg')
  }

  const quickAdd = (slide: HeroSlide) => {
    if (!slide.quickAdd) return
    add({ bookId: slide.quickAdd.bookId, sku: slide.quickAdd.sku, quantity: 1 })
    setAdded(slide.id)
    window.setTimeout(() => setAdded((v) => (v === slide.id ? null : v)), 1800)
  }

  if (count === 0) return null
  const slide = slides[active]

  return (
    <section
      className="kh-hero"
      aria-roledescription="carousel"
      aria-label="Featured books"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="kh-hero__backdrop" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={s.id} className={`kh-hero__bg ${i === active ? 'is-active' : ''}`}>
            <Image src={s.cover.thumb} alt="" fill sizes="50vw" priority={i === 0} />
          </div>
        ))}
        <div className="kh-hero__shade" />
        <span className="kh-spark kh-spark--1">✦</span>
        <span className="kh-spark kh-spark--2">✧</span>
        <span className="kh-spark kh-spark--3">☾</span>
        <span className="kh-spark kh-spark--4">✦</span>
      </div>

      <div className="k-wrap kh-hero__inner">
        <div className="kh-hero__copy" key={slide.id} aria-live={paused ? 'polite' : 'off'}>
          {slide.series && (
            <Link href={`/books?series=${slide.series.slug}`} className="kh-hero__eyebrow kh-rise" style={{ '--d': 0 } as React.CSSProperties}>
              {slide.series.title}
            </Link>
          )}
          <h2 className="kh-hero__title">
            {slide.title.split(' ').map((word, i) => (
              <React.Fragment key={`${word}-${i}`}>
                {i > 0 && ' '}
                <span className="kh-word" style={{ '--d': i } as React.CSSProperties}>
                  {word}
                </span>
              </React.Fragment>
            ))}
          </h2>
          <ul className="kh-meta kh-rise" style={{ '--d': 3 } as React.CSSProperties}>
            {slide.ageRange && <li>Ages {slide.ageRange}</li>}
            {slide.formats.map((f) => (
              <li key={f}>{f}</li>
            ))}
            {slide.fromPrice && <li className="kh-meta__price">From {slide.fromPrice}</li>}
          </ul>
          {slide.excerpt && (
            <p className="kh-hero__excerpt kh-rise" style={{ '--d': 4 } as React.CSSProperties}>
              {slide.excerpt}
            </p>
          )}
          <div className="kh-hero__actions kh-rise" style={{ '--d': 5 } as React.CSSProperties}>
            <Link href={`/books/${slide.slug}`} className="k-btn k-btn--lime kh-cta">
              <span>Shop now</span>
            </Link>
            {slide.quickAdd && (
              <button
                type="button"
                className={`kh-round ${added === slide.id ? 'is-done' : ''}`}
                onClick={() => quickAdd(slide)}
                aria-label={added === slide.id ? 'Added to basket' : slide.quickAdd.label}
                title={slide.quickAdd.label}
              >
                <Icon name={added === slide.id ? 'check' : 'plus'} size={20} />
              </button>
            )}
            <span className="kh-toast" role="status">
              {added === slide.id ? 'Added to your basket ✓' : ''}
            </span>
          </div>
        </div>

        <div className="kh-hero__art" ref={artRef} onPointerMove={onPointerMove} onPointerLeave={resetTilt}>
          <Link href={`/books/${slide.slug}`} className="kh-hero__cover" key={slide.id} tabIndex={-1} aria-hidden="true">
            <Image
              src={slide.cover.src}
              alt=""
              width={slide.cover.width}
              height={slide.cover.height}
              sizes="(max-width: 900px) 60vw, 420px"
              priority
            />
          </Link>
          <span className="kh-hero__glow" aria-hidden="true" />
        </div>
      </div>

      {count > 1 && (
        <div className="k-wrap kh-thumbs-wrap">
          <ul className="kh-thumbs" aria-label="Choose a featured book">
            {slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`kh-thumb ${i === active ? 'is-active' : ''} ${paused || reduced ? 'is-paused' : ''}`}
                  onClick={() => go(i)}
                  aria-label={`Show ${s.title}`}
                  aria-current={i === active ? 'true' : undefined}
                  style={{ '--interval': `${INTERVAL_MS}ms` } as React.CSSProperties}
                >
                  <Image src={s.cover.thumb} alt="" fill sizes="96px" />
                  <span className="kh-thumb__progress" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
