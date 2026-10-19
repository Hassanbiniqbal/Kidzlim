import 'server-only'

import { getPayloadClient } from '../cms'
import { getCredential } from '../credentials'
import { createStripeGateway, type StripeGateway } from '../integrations/stripe'

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeConfigError'
  }
}

/**
 * Returns a Stripe gateway for the mode selected in Store Settings, refusing to run
 * if the key doesn't match the mode (e.g. Live mode with an sk_test_ key).
 */
export async function getStripe(): Promise<StripeGateway> {
  const payload = await getPayloadClient()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
  const mode = settings.stripe?.mode ?? (process.env.STRIPE_MODE === 'live' ? 'live' : 'test')
  const key = await getCredential('stripe.secretKey', payload)

  const keyMode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test'
  if (keyMode !== mode) {
    throw new StripeConfigError(
      `Stripe is set to ${mode} mode but the secret key is a ${keyMode} key. Fix it in Admin → Store Settings → Stripe.`,
    )
  }
  return createStripeGateway(key)
}
