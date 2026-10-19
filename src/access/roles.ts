import type { Access, PayloadRequest } from 'payload'

export const ROLES = ['admin', 'staff'] as const
export type Role = (typeof ROLES)[number]

export const hasRole = (user: PayloadRequest['user'], ...roles: Role[]): boolean =>
  Boolean(user && 'role' in user && roles.includes(user.role as Role))

export const anyone: Access = () => true

export const isAdmin: Access = ({ req: { user } }) => hasRole(user, 'admin')

export const isAdminOrStaff: Access = ({ req: { user } }) => hasRole(user, 'admin', 'staff')

/** Admins see every user; everyone else only their own record. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (hasRole(user, 'admin')) return true
  return { id: { equals: user.id } }
}

/** Public visitors only see published documents; logged-in admin/staff see everything. */
export const publishedOrAdminStaff: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin', 'staff')) return true
  return { status: { equals: 'published' } }
}

/** Public visitors only see published documents; only admins see drafts. */
export const publishedOrAdmin: Access = ({ req: { user } }) => {
  if (hasRole(user, 'admin')) return true
  return { status: { equals: 'published' } }
}
