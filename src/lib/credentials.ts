import 'server-only'

import type { Payload } from 'payload'

import { getPayloadClient } from './cms'
import { resolveCredential, type CredentialKey } from './credentials-core'

export { MissingCredentialError, type CredentialKey } from './credentials-core'

/**
 * Single entry point for every integration secret in web routes (brief §6 / conventions).
 * Background jobs call resolveCredential() with their own Payload instance.
 */
export async function getCredential(key: CredentialKey, payload?: Payload): Promise<string> {
  return resolveCredential(payload ?? (await getPayloadClient()), key)
}
