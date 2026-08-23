import { notFound } from 'next/navigation'
import { FileTextIcon } from '@phosphor-icons/react/dist/ssr'
import { PageHeading } from '@/components/page-heading'
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
      <PageHeading
        icon={<FileTextIcon size={30} />}
        title={document.name}
        back={{ href: '/programs', label: 'Programs' }}
        meta={`Uploaded ${dateTime(document.uploadedAt)} · ${document.contentType}`}
        aside={
          <Badge variant="outline">
            {archived ? 'Original from archive' : 'Extracted text'}
          </Badge>
        }
      />

      <pre className="overflow-x-auto rounded-2xl border bg-card p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}
