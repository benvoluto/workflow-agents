import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Make a link cover its nearest positioned ancestor, so a whole card or row is
 * clickable.
 *
 * An overlay rather than wrapping the card in an anchor: that keeps exactly one
 * link per item for anything reading the page linearly, keeps middle-click and
 * open-in-new-tab working, and avoids nesting anchors inside anchors, which is
 * invalid and behaves unpredictably. Anything else interactive inside the same
 * ancestor needs RAISED to sit above the overlay.
 *
 * The focus ring moves to the overlay too, so keyboard focus outlines the whole
 * item instead of a few words of its title.
 */
export const STRETCHED =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"

/** Sits above a STRETCHED overlay, so it stays independently clickable. */
export const RAISED = 'relative z-10'
