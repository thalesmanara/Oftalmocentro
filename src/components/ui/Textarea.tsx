import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s/g, '-')
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`min-h-[100px] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary,#0d4f8b)] focus:ring-2 focus:ring-[var(--color-primary,#0d4f8b)]/20 ${className}`}
        {...props}
      />
    </div>
  )
}
