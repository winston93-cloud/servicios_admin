'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import UsuariosCatalogoModal from '../components/UsuariosCatalogoModal'
import UsuariosPinGate from '../components/UsuariosPinGate'

/**
 * Módulo al final del menú de Servicios: abre el catálogo CRUD de `usuario` en modal.
 * Requiere PIN (cookie) antes de listar o modificar.
 */
export default function UsuariosCatalogoModulo() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(true)

  useEffect(() => {
    setAbierto(true)
  }, [])

  const cerrar = () => {
    setAbierto(false)
    router.replace('/servicios?modulo=alumnos')
  }

  return (
    <UsuariosPinGate>
      <div className="servicios-panel-inner usr-modulo">
        <header className="servicios-panel-header">
          <h1 className="servicios-panel-title">
            <UsersRound size={22} aria-hidden /> Usuarios
          </h1>
          <p className="servicios-panel-lead">
            Catálogo CRUD del personal administrativo y exportación a Excel.
          </p>
        </header>
        <div className="servicios-panel-card">
          <p className="servicios-panel-hint">
            El catálogo se abre en un modal. Si lo cerraste,{' '}
            <button type="button" className="usr-link-btn" onClick={() => setAbierto(true)}>
              vuelve a abrirlo
            </button>
            .
          </p>
        </div>
        <UsuariosCatalogoModal abierto={abierto} onCerrar={cerrar} />
      </div>
    </UsuariosPinGate>
  )
}
