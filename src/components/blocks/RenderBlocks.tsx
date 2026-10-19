import { RichText } from '@payloadcms/richtext-lexical/react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { BookGrid } from '@/components/BookCard'
import { Icon } from '@/components/Icon'
import { getBooks } from '@/lib/cms'
import { asMedia, mediaUrl } from '@/lib/media'
import type {
  BookGridBlock,
  CtaBlock,
  FaqBlock,
  FeaturesBlock,
  HeroBlock,
  Page,
  RichTextBlock,
  TestimonialsBlock,
} from '@/payload-types'

type LayoutBlock = NonNullable<Page['layout']>[number]

function Hero({ block, first }: { block: HeroBlock; first: boolean }) {
  const image = asMedia(block.image)
  const src = mediaUrl(block.image, 'hero')
  const Heading = first ? 'h1' : 'h2'
  return (
    <section className="k-hero k-wrap">
      {block.eyebrow && <p className="k-hero__eyebrow">{block.eyebrow}</p>}
      <Heading className="k-hero__title">{block.heading}</Heading>
      {block.subheading && <p className="k-hero__lead">{block.subheading}</p>}
      {block.ctaLabel && block.ctaLink && (
        <div className="k-hero__actions">
          <Link href={block.ctaLink} className="k-btn k-btn--lime">
            <span>{block.ctaLabel}</span>
          </Link>
        </div>
      )}
      {src && (
        <div className="k-hero__art">
          <Image
            src={src}
            alt={image?.alt || ''}
            width={image?.width ?? 1600}
            height={image?.height ?? 1000}
            sizes="(max-width: 1200px) 100vw, 1100px"
            priority={first}
          />
        </div>
      )}
    </section>
  )
}

function Features({ block }: { block: FeaturesBlock }) {
  const image = asMedia(block.image)
  const src = mediaUrl(block.image, 'hero')
  return (
    <section id={block.anchor || undefined} className="k-section k-wrap">
      <div className={`k-card k-features${src ? ' k-features--with-art' : ''}`}>
        <header className="k-section__head">
          <h2 className="k-section__title k-gradient-text">{block.heading}</h2>
          {block.intro && <p className="k-section__intro">{block.intro}</p>}
        </header>
        <div className="k-features__body">
          {src && (
            <div className="k-features__art">
              <Image
                src={src}
                alt={image?.alt || ''}
                width={image?.width ?? 1200}
                height={image?.height ?? 1200}
                sizes="(max-width: 900px) 100vw, 480px"
              />
            </div>
          )}
          <ul className={`k-features__grid k-features__grid--${block.columns ?? '3'}`}>
            {block.items?.map((item) => (
              <li key={item.id} className="k-feature">
                <span className="k-feature__icon">
                  <Icon name={item.icon ?? 'book'} />
                </span>
                <h3>{item.title}</h3>
                {item.text && <p>{item.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function RichTextSection({ block }: { block: RichTextBlock }) {
  return (
    <section className="k-section k-wrap">
      <div className="k-prose">
        <RichText data={block.content} />
      </div>
    </section>
  )
}

async function BookGridSection({ block }: { block: BookGridBlock }) {
  const books =
    block.source === 'manual'
      ? await getBooks({
          source: 'ids',
          ids: (block.books ?? []).map((b) => (typeof b === 'object' ? b.id : b)),
        })
      : await getBooks({ source: block.source, limit: block.limit ?? 8 })

  return (
    <section className="k-section k-wrap">
      {block.heading && (
        <header className="k-section__head k-section__head--row">
          <h2 className="k-section__title">{block.heading}</h2>
          <Link href="/books" className="k-link-arrow">
            View all books <Icon name="arrow" size={18} />
          </Link>
        </header>
      )}
      <BookGrid books={books} />
    </section>
  )
}

function Testimonials({ block }: { block: TestimonialsBlock }) {
  if (!block.items?.length) return null
  return (
    <section className="k-section k-wrap">
      {block.heading && (
        <header className="k-section__head">
          <h2 className="k-section__title k-gradient-text">{block.heading}</h2>
        </header>
      )}
      <div className="k-testimonials">
        {block.items.map((t) => (
          <figure key={t.id} className="k-card k-testimonial">
            {t.rating ? (
              <p className="k-stars" aria-label={`${t.rating} out of 5 stars`}>
                {'★'.repeat(t.rating)}
              </p>
            ) : null}
            <blockquote>{t.quote}</blockquote>
            <figcaption>
              <strong>{t.name}</strong>
              {t.context && <span>{t.context}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Faq({ block }: { block: FaqBlock }) {
  return (
    <section id="faq" className="k-section k-wrap">
      {block.heading && (
        <header className="k-section__head">
          <h2 className="k-section__title k-gradient-text">{block.heading}</h2>
        </header>
      )}
      <div className="k-faq">
        {block.items?.map((item) => (
          <details key={item.id} className="k-faq__item">
            <summary>{item.question}</summary>
            <div className="k-prose k-faq__answer">
              <RichText data={item.answer} />
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function Cta({ block }: { block: CtaBlock }) {
  return (
    <section className="k-section k-wrap">
      <div className="k-card k-cta">
        <h2 className="k-cta__title k-gradient-text">{block.heading}</h2>
        {block.body && <p>{block.body}</p>}
        <Link href={block.buttonLink} className="k-btn k-btn--lime">
          <span>{block.buttonLabel}</span>
        </Link>
      </div>
    </section>
  )
}

export function RenderBlocks({ blocks }: { blocks: LayoutBlock[] | null | undefined }) {
  if (!blocks?.length) return null
  return (
    <>
      {blocks.map((block, i) => {
        const key = block.id ?? `${block.blockType}-${i}`
        switch (block.blockType) {
          case 'hero':
            return <Hero key={key} block={block} first={i === 0} />
          case 'features':
            return <Features key={key} block={block} />
          case 'richText':
            return <RichTextSection key={key} block={block} />
          case 'bookGrid':
            return <BookGridSection key={key} block={block} />
          case 'testimonials':
            return <Testimonials key={key} block={block} />
          case 'faq':
            return <Faq key={key} block={block} />
          case 'cta':
            return <Cta key={key} block={block} />
          default:
            return null
        }
      })}
    </>
  )
}
