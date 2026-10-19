import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { hasRole, isAdmin, isAdminOrSelf, ROLES } from '../access/roles'
import { collectionAuditHooks } from '../lib/audit'

const audit = collectionAuditHooks({
  entity: 'users',
  label: (d) => String(d.email ?? d.id),
  ignore: ['hash', 'salt', 'password', 'resetPasswordToken', 'resetPasswordExpiration', 'loginAttempts', 'lockUntil', 'sessions'],
})

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
  auth: true,
  access: {
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
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
