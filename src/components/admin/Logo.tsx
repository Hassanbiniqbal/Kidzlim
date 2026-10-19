import React from 'react'

export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo inside the Payload admin */}
    <img src="/brand/kidzlim-mascot.png" alt="" width={56} height={56} style={{ borderRadius: '50%' }} />
    <span
      style={{
        fontFamily: 'Futura, "Trebuchet MS", sans-serif',
        fontSize: 34,
        letterSpacing: '0.01em',
        background: 'linear-gradient(91deg, #e5e5e5 0%, #737373 130%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      Kidzlim
    </span>
  </div>
)
