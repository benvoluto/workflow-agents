import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { dateTime } from '@/lib/format'
import { getDocument } from '@/lib/queries'
import { readArchived } from '@/lib/storage/blob'

/**
 * The source document, served by the app rather than by a public URL.
 *
 * The archive lives in a private Blob store, so this reads it back server-side.
 * If the archive is unavailable the extracted text still is, and the page says
 * which one you are looking at rather than pretending they are the same thing.
 */
export default async function DocumentPage({ params }: PageProps<'/documents/[id]'>) {
  const { id } = await params
  const document = await getDocument(id)
  if (!document) notFound()

  const archived = document.blobUrl ? await readArchived(document.blobUrl) : null
  const body = archived ?? document.bodyText

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/programs"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Programs
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{document.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Uploaded {dateTime(document.uploadedAt)} · {document.contentType}
            </p>
          </div>
          <Badge variant="outline">
            {archived ? 'Original from archive' : 'Extracted text'}
          </Badge>
        </div>
      </div>

      <pre className="overflow-x-auto rounded-xl border bg-card p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}
