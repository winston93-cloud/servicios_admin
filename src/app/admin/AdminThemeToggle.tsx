'use client'

import { useEffect, useState } from 'react'

type AdminTheme = 'light' | 'dark'
const STORAGE_KEY = 'admin-theme'

export default function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>('light')

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as AdminTheme) || 'light'
    setTheme(saved)
  }, [])

  const handleChange = (next: AdminTheme) => {
    setTheme(next)
    window.dispatchEvent(new CustomEvent<AdminTheme>('admin-theme-change', { detail: next }))
  }

  return (
    <div className="admin-theme-toggle" role="group" aria-label="Cambiar tema">
      <button
        type="button"
        className={`admin-theme-btn${theme === 'light' ? ' active' : ''}`}
        onClick={() => handleChange('light')}
        aria-pressed={theme === 'light'}
        title="Modo claro"
      >
        <span aria-hidden="true">☀️</span> Light
      </button>
      <button
        type="button"
        className={`admin-theme-btn${theme === 'dark' ? ' active' : ''}`}
        onClick={() => handleChange('dark')}
        aria-pressed={theme === 'dark'}
        title="Modo oscuro synthwave"
      >
        <span aria-hidden="true">🌌</span> Dark
      </button>
    </div>
  )
}
