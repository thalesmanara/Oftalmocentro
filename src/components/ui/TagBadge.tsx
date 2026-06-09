import type { Tag } from '@/types'

interface TagBadgeProps {
  tag: Tag
}

export function TagBadge({ tag }: TagBadgeProps) {
  const bg = tag.color ?? '#64748b'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      <span
        className="h-2 w-2 rounded-full bg-white/40"
        aria-hidden
      />
      {tag.name}
    </span>
  )
}
