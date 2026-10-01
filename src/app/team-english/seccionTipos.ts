import type { TeSnapshot } from '@/lib/teamEnglish/teTypes'

export type SeccionProps = {
  snap: TeSnapshot
  recargar: () => Promise<void>
  avisar: (texto: string, tipo?: 'ok' | 'error') => void
}
