import { type CollectionBeforeChangeHook, type CollectionBeforeValidateHook, type CollectionConfig, ValidationError } from 'payload'

import { hasRole, isAdmin, isAdminOrSelf, ROLES } from '../access/roles'
import { collectionAuditHooks } from '../lib/audit'

const audit = collectionAuditHooks({
  entity: 'users',
  label: (d) => String(d.email ?? d.id),
  ignore: ['hash', 'salt', 'password', 'resetPasswordToken', 'resetPasswordExpiration', 'loginAttempts', 'lockUntil', 'sessions'],
})

export const MIN_PASSWORD_LENGTH = 12

/** Admin/staff passwords must be at least 12 characters (checked whenever one is set). */
export const requireStrongPassword: CollectionBeforeValidateHook = ({ data }) => {
  const password = (data as { password?: unknown } | undefined)?.password
  if (typeof password === 'string' && password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError({
      collection: 'users',
      errors: [{ path: 'password', message: `Use at least ${MIN_PASSWORD_LENGTH} characters — a short phrase is easiest to remember.` }],
    })
  }
  return data
}

/**
 * Role assignment guard:
 * - the very first user created (via /admin/create-first-user) becomes `admin`
 * - only admins can set or change a role; anyone else keeps the existing/default role
 */
const enforceRole: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation === 'create') {
    const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
    if (totalDocs === 0) return { ...data, role: 'admin' }
    if (!hasRole(req.user, 'admin')) return { ...data, role: 'staff' }
    return data
  }

  if (!hasRole(req.user, 'admin')) return { ...data, role: originalDoc?.role }
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
    group: 'Admin',
  },
  auth: {
    // Brute-force protection: 5 wrong passwords lock the account for 15 minutes.
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    // Admin sessions last a working day.
    tokenExpiration: 8 * 60 * 60,
    cookies: {
      // HTTPS-only cookie in production; Lax blocks it on cross-site POSTs (CSRF).
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    },
  },
  access: {
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [requireStrongPassword],
    beforeChange: [enforceRole],
    afterChange: [audit.afterChange],
    afterDelete: [audit.afterDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'staff',
      saveToJWT: true,
      options: ROLES.map((role) => ({ label: role === 'admin' ? 'Admin' : 'Staff', value: role })),
      admin: {
        position: 'sidebar',
        description: 'Admin: full access incl. Settings. Staff: Books and Orders only.',
      },
    },
  ],
}
