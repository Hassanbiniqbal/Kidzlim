'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { Icon } from '@/components/Icon'
import { formatAED, VARIANT_LABELS } from '@/lib/format'

import type { ClientPricedLine } from './CartProvider'

type Props = {
  line: ClientPricedLine
  onQuantity?: (quantity: number) => void
  onRemove?: () => void
  compact?: boolean
}

export function LineItem({ line, onQuantity, onRemove, compact }: Props) {
  return (
    <li className={`k-line${compact ? ' k-line--compact' : ''}`}>
      <Link href={`/books/${line.slug}`} className="k-line__thumb" tabIndex={-1} aria-hidden="true">
        {line.coverUrl ? <Image src={line.coverUrl} alt="" width={96} height={128} /> : null}
      </Link>
      <div className="k-line__info">
        <Link href={`/books/${line.slug}`} className="k-line__title">
          {line.title}
        </Link>
        <span className="k-line__meta">
          <Icon name={line.physical ? 'book' : 'download'} size={14} /> {VARIANT_LABELS[line.variantType]} ·{' '}
          {formatAED(line.unitPriceAED)}
          {compact && line.quantity > 1 ? ` × ${line.quantity}` : ''}
        </span>
        {!compact && onQuantity && onRemove && (
          <div className="k-line__controls">
            {line.physical ? (
              <div className="k-qty k-qty--sm" role="group" aria-label={`Quantity for ${line.title}`}>
                <button type="button" onClick={() => onQuantity(line.quantity - 1)} aria-label="Decrease quantity">
                  −
                </button>
                <output>{line.quantity}</output>
                <button
                  type="button"
                  onClick={() => onQuantity(line.quantity + 1)}
                  disabled={line.quantity >= 20}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            ) : (
              <span className="k-line__hint">1 download</span>
            )}
            <button type="button" className="k-line__remove" onClick={onRemove}>
              <Icon name="trash" size={16} /> Remove
            </button>
          </div>
        )}
      </div>
      <span className="k-line__total">{formatAED(line.lineTotalAED)}</span>
    </li>
  )
}
