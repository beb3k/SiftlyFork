import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/app/generated/prisma/client'
import path from 'path'

const defaultDbPath = path.join(process.cwd(), 'prisma', 'dev.db')

function resolveDbUrl(rawUrl?: string): string {
  if (!rawUrl) return `file:${defaultDbPath}`
  if (!rawUrl.startsWith('file:')) return rawUrl

  const [rawPath, rawQuery] = rawUrl.slice('file:'.length).split('?', 2)
  if (!rawPath) return `file:${defaultDbPath}${rawQuery ? `?${rawQuery}` : ''}`

  const normalizedPath = rawPath.replace(/\\/g, '/')
  let resolvedPath: string

  // Match Prisma's schema-relative SQLite path behavior on this repo.
  if (
    normalizedPath === 'dev.db' ||
    normalizedPath === './dev.db' ||
    normalizedPath === 'prisma/dev.db' ||
    normalizedPath === './prisma/dev.db'
  ) {
    resolvedPath = defaultDbPath
  } else if (path.isAbsolute(rawPath)) {
    resolvedPath = rawPath
  } else {
    resolvedPath = path.resolve(process.cwd(), 'prisma', rawPath)
  }

  return `file:${resolvedPath}${rawQuery ? `?${rawQuery}` : ''}`
}

const dbUrl = resolveDbUrl(process.env.DATABASE_URL)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: dbUrl }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
