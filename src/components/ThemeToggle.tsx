'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type ThemeToggleProps = {
  className?: string
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <span className="theme-toggle-track" aria-hidden>
        <Sun size={15} className="theme-toggle-icon theme-toggle-icon--sun" />
        <Moon size={15} className="theme-toggle-icon theme-toggle-icon--moon" />
        <span
          className={`theme-toggle-thumb${isDark ? ' theme-toggle-thumb--dark' : ''}`}
        />
      </span>
      <span className="theme-toggle-label">{isDark ? 'Oscuro' : 'Claro'}</span>
    </button>
  )
}
