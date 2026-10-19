import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  Payload,
  PayloadRequest,
} from 'payload'

/**
 * Audit log (brief §7: "who changed what, when") for Orders, Store Settings and Users.
 * Records changes made by a signed-in person; automated changes (webhooks, jobs) are already
 * in each order's fulfilment log. Secret values are never written here — only "changed".
 * CLI-safe (loaded by collection hooks via payload.config).
 */

export type AuditChange = { field: string; from: unknown; to: unknown }

const ALWAYS_IGNORE = new Set(['id', 'createdAt', 'updatedAt', 'globalType', '_status'])
const MAX = 200

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

/** Flattens nested groups to dotted paths (arrays stay whole and are compared as JSON). */
function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  if (isPlainObject(value) && depth < 4) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out, depth + 1)
  } else if (prefix) {
    out[prefix] = value
  }
  return out
}

function present(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return null
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`
  if (typeof v === 'object') return JSON.stringify(v).slice(0, MAX)
  if (typeof v === 'string' && v.length > MAX) return `${v.slice(0, MAX)}…`
  return v
}

/**
 * Comparison form: populated relationships become their id (hooks may see a doc on one side
 * and an id on the other), and empty values (null, '', []) are equal.
 */
function normalize(v: unknown): unknown {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return null
  if (Array.isArray(v)) return v.map(normalize)
  if (isPlainObject(v)) {
    if ('id' in v && ('createdAt' in v || 'updatedAt' in v)) return v.id
    return Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'id').map(([k, val]) => [k, normalize(val)]))
  }
  return v
}

const same = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))

export function diffDocs(
  prev: unknown,
  next: unknown,
  opts: { ignore?: string[]; redact?: string[] } = {},
): AuditChange[] {
  const ignore = new Set([...ALWAYS_IGNORE, ...(opts.ignore ?? [])])
  const redact = new Set(opts.redact ?? [])
  const a = flatten(prev)
  const b = flatten(next)
  const changes: AuditChange[] = []

  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const top = field.split('.')[0]
    if (ignore.has(field) || ignore.has(top)) continue
    if (redact.has(field)) continue // secrets are reported separately via context
    if (same(a[field], b[field])) continue
    changes.push({ field, from: present(a[field]), to: present(b[field]) })
  }
  return changes.sort((x, y) => x.field.localeCompare(y.field))
}

type AuditUser = { id: number | string; email?: string | null } | null | undefined

export async function recordAudit(
  payload: Payload,
  entry: {
    user: AuditUser
    action: 'create' | 'update' | 'delete' | 'order-action' | 'test-connection'
    entity: string
    entityId?: string | number
    entityLabel?: string
    summary: string
    changes?: AuditChange[]
    req?: PayloadRequest
  },
): Promise<void> {
  try {
    await payload.create({
      collection: 'audit-log',
      overrideAccess: true,
      ...(entry.req ? { req: entry.req } : {}),
      data: {
        actor: typeof entry.user?.id === 'number' ? entry.user.id : undefined,
        actorEmail: entry.user?.email ?? 'system',
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId != null ? String(entry.entityId) : undefined,
        entityLabel: entry.entityLabel,
        summary: entry.summary.slice(0, 500),
        changes: entry.changes ?? [],
      },
    })
  } catch (err) {
    // Never block a business operation because the audit write failed — but make it visible.
    payload.logger.error({ err, msg: `[audit] failed to record "${entry.summary}"` })
  }
}

/** Secret fields record their own changes here (values are never exposed). */
export const CHANGED_SECRETS = 'changedSecrets'

const summarise = (changes: AuditChange[]) =>
  changes.length === 0 ? 'no field changes' : changes.slice(0, 6).map((c) => c.field).join(', ') + (changes.length > 6 ? ` +${changes.length - 6} more` : '')

export function collectionAuditHooks(opts: { entity: string; label: (doc: Record<string, unknown>) => string; ignore?: string[] }): {
  afterChange: CollectionAfterChangeHook
  afterDelete: CollectionAfterDeleteHook
} {
  return {
    afterChange: async ({ doc, previousDoc, operation, req }) => {
      if (!req.user) return doc // automated change — see fulfilment log
      const changes = operation === 'create' ? [] : diffDocs(previousDoc, doc, { ignore: opts.ignore })
      if (operation === 'update' && changes.length === 0) return doc
      await recordAudit(req.payload, {
        user: req.user,
        action: operation === 'create' ? 'create' : 'update',
        entity: opts.entity,
        entityId: doc.id,
        entityLabel: opts.label(doc),
        summary: operation === 'create' ? `Created ${opts.entity} ${opts.label(doc)}` : `Updated ${summarise(changes)}`,
        changes,
        req,
      })
      return doc
    },
    afterDelete: async ({ doc, req }) => {
      if (!req.user) return doc
      await recordAudit(req.payload, {
        user: req.user,
        action: 'delete',
        entity: opts.entity,
        entityId: doc.id,
        entityLabel: opts.label(doc),
        summary: `Deleted ${opts.entity} ${opts.label(doc)}`,
        req,
      })
      return doc
    },
  }
}

export function globalAuditHook(opts: { entity: string; secretPaths: string[] }): GlobalAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    if (!req.user) return doc
    const changes = diffDocs(previousDoc, doc, { redact: opts.secretPaths })
    const secrets = (req.context?.[CHANGED_SECRETS] as { path: string; cleared: boolean }[] | undefined) ?? []
    for (const s of secrets) changes.push({ field: s.path, from: '••••', to: s.cleared ? null : '•••• (new value)' })
    if (changes.length === 0) return doc
    await recordAudit(req.payload, {
      user: req.user,
      action: 'update',
      entity: opts.entity,
      summary: `Updated ${summarise(changes)}`,
      changes,
      req,
    })
    return doc
  }
}
