import type { ReactNode } from 'react'

/** Banner for technical admin screens (IA governança, Qdrant, etc.). */
export function TechnicalAreaBanner({ children }: { children?: ReactNode }) {
  return (
    <div
      className="mb-4 rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      role="note"
    >
      <p className="font-medium text-slate-800">Área destinada à administração técnica do sistema.</p>
      <p className="mt-1 text-xs text-slate-600">
        Alterações aqui afetam a Consulta IA e o processamento documental. Prefira drafts, valide antes
        de publicar e confirme ações destrutivas.
      </p>
      {children}
    </div>
  )
}
