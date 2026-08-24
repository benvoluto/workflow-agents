'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { DotsThreeVerticalIcon } from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  const [, startTransition] = useTransition()

  return (
    <DropdownMenu>
      {/*
        nativeButton tells Base UI this really is a <button>, so it stops
        layering non-native button semantics (role, aria-disabled) on top of an
        element that already has them.
      */}
      <DropdownMenuTrigger
        nativeButton
        render={
          <button
            type="button"
            aria-label="More actions"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-action transition-opacity hover:opacity-75"
          />
        }
      >
        <DotsThreeVerticalIcon size={20} weight="bold" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={href} />}>Open</DropdownMenuItem>
          {documentHref ? (
            <DropdownMenuItem render={<Link href={documentHref} />}>
              View source document
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => startTransition(() => snoozeItem(itemId, 14))}
          >
            Snooze for two weeks
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
