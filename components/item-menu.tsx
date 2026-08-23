'use client'

import Link from 'next/link'
import { DotsThreeVerticalIcon } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { snoozeItem } from '@/app/actions'

export function ItemMenu({
  href,
  itemId,
  documentHref,
}: {
  href: string
  itemId: string
  documentHref: string | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="More actions"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          />
        }
      >
        <DotsThreeVerticalIcon size={20} weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={href} />}>Open</DropdownMenuItem>
        {documentHref ? (
          <DropdownMenuItem render={<Link href={documentHref} />}>
            View source document
          </DropdownMenuItem>
        ) : null}
        <form action={snoozeItem}>
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="days" value="14" />
          <DropdownMenuItem render={<button type="submit" className="w-full cursor-pointer" />}>
            Snooze for two weeks
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
