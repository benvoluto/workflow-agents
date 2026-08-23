import { get, put } from '@vercel/blob'

/**
 * Archive of the original uploaded bytes.
 *
 * The store is private, so nothing here is reachable by URL guessing. The app
 * reads a document back server-side and serves it from its own route, which is
 * what a real deployment would need anyway once these are contracts rather than
 * sample files.
 *
 * Extracted text lives in Postgres and is the thing the app actually reasons
 * over. Blob holds the artefact, so provenance can point at the real document.
 */

function configured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN)
}

export async function archiveDocument(input: {
  name: string
  body: string | Buffer
  contentType: string
}): Promise<string | null> {
  if (!configured()) return null
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const result = await put(`documents/${stamp}-${input.name}`, input.body, {
      access: 'private',
      contentType: input.contentType,
      addRandomSuffix: true,
    })
    return result.url
  } catch (error) {
    // Archiving is not on the critical path: a document whose text we already
    // extracted is still fully usable without its original.
    console.warn('[blob] archive failed:', error instanceof Error ? error.message : error)
    return null
  }
}

export async function readArchived(url: string): Promise<string | null> {
  if (!configured()) return null
  try {
    const result = await get(url, { access: 'private' })
    if (!result) return null
    return await new Response(result.stream).text()
  } catch (error) {
    console.warn('[blob] read failed:', error instanceof Error ? error.message : error)
    return null
  }
}
