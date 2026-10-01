'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Languages } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import './team-english.css'

export default function TeamEnglishPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <TeamEnglishView />
    </ProtectedRoute>
  )
}

function TeamEnglishView() {
  const router = useRouter()
  return (
    <div className="te-page">
      <div className="te-shell">
        <header className="te-topbar">
          <button type="button" className="te-back" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={16} aria-hidden /> Dashboard
          </button>
          <ThemeToggle />
        </header>
        <section className="te-hero">
          <span className="te-icon" aria-hidden>
            <Languages size={28} />
          </span>
          <p className="te-kicker">Inglés</p>
          <h1 className="te-title">Team English</h1>
          <p className="te-lead">Módulo en construcción.</p>
        </section>
      </div>
    </div>
  )
}
