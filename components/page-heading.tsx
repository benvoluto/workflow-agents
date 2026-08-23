import Link from 'next/link'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/ssr'

/**
 * The same heading treatment as the home page columns: a light, large title
 * with a Phosphor glyph, so an interior page reads as part of the same surface
 * rather than as a different application.
 */
export function PageHeading({
  icon,
  title,
  meta,
  back,
  aside,
}: {
  icon: React.ReactNode
  title: string
  meta?: React.ReactNode
  back?: { href: string; label: string }
  aside?: React.ReactNode
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretLeftIcon size={16} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-[30px] leading-tight font-normal text-heading">
            {icon}
            <span className="text-foreground">{title}</span>
          </h1>
          {meta ? (
            <p className="mt-1.5 text-[15px] text-muted-foreground">{meta}</p>
          ) : null}
        </div>
        {aside}
      </div>
    </div>
  )
}
