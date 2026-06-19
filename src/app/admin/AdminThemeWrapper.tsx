'use client'

import { useEffect, useRef, useState } from 'react'

export type AdminTheme = 'light' | 'dark'
const STORAGE_KEY = 'admin-theme'

export default function AdminThemeWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<AdminTheme>('light')

  // Leer preferencia guardada al montar
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as AdminTheme) || 'light'
    setTheme(saved)
    if (ref.current) ref.current.dataset.theme = saved
  }, [])

  // Escuchar cambios del toggle (CustomEvent 'admin-theme-change')
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<AdminTheme>).detail
      setTheme(next)
      localStorage.setItem(STORAGE_KEY, next)
      if (ref.current) ref.current.dataset.theme = next
    }
    window.addEventListener('admin-theme-change', handler)
    return () => window.removeEventListener('admin-theme-change', handler)
  }, [])

  return (
    <div
      ref={ref}
      className="admin-layout"
      data-theme={theme}
    >
      {children}
    </div>
  )
}
