'use client'

/**
 * Animaciones compartidas de los módulos de boletas, adaptadas de Motion Primitives
 * (AnimatedGroup, TransitionPanel, AnimatedNumber). Respetan «reducir movimiento» del sistema.
 */

import { LazyMotion, MotionConfig, domAnimation, m, useReducedMotion, useSpring, useTransform, type Variants } from 'motion/react'
import { useEffect, type CSSProperties, type ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

function Motion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}

const LISTA: Variants = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

const ITEM: Variants = {
  oculto: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.42, ease: EASE } },
}

/** Lista cuyos elementos entran escalonados (menús de dirección, tarjetas de grupos). Usar con `ItemAnimado`. */
export function ListaAnimada({ children, className, ordenada = false }: { children: ReactNode; className?: string; ordenada?: boolean }) {
  const Lista = ordenada ? m.ol : m.ul
  return (
    <Motion>
      <Lista className={className} variants={LISTA} initial="oculto" animate="visible">
        {children}
      </Lista>
    </Motion>
  )
}

export function ItemAnimado({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.li className={className} variants={ITEM}>
      {children}
    </m.li>
  )
}

/**
 * Cambio de vista dentro de un módulo (menú → entregas → captura…): la vista nueva entra suave.
 * Al terminar no deja `transform`, así que no rompe `position: sticky` de las hojas de captura.
 */
export function VistaAnimada({ vista, children, className }: { vista: string; children: ReactNode; className?: string }) {
  return (
    <Motion>
      <m.div
        key={vista}
        className={className}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {children}
      </m.div>
    </Motion>
  )
}

const SOLO_LECTOR: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/**
 * Número que sube hasta su valor (promedios, avances). Al terminar muestra `texto` tal cual,
 * para que promedios truncados nunca se vean redondeados.
 */
export function NumeroAnimado({ valor, texto, decimales = 0, className }: { valor: number; texto: string; decimales?: number; className?: string }) {
  const reducido = useReducedMotion()
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.8 })
  const umbral = 10 ** -(decimales + 1)
  const mostrado = useTransform(spring, (v) => (Math.abs(v - valor) < umbral ? texto : v.toFixed(decimales)))

  useEffect(() => {
    spring.set(valor)
  }, [spring, valor])

  if (reducido || !Number.isFinite(valor)) return <span className={className}>{texto}</span>
  return (
    <span className={className}>
      <span style={SOLO_LECTOR}>{texto}</span>
      <Motion>
        <m.span aria-hidden style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mostrado}
        </m.span>
      </Motion>
    </span>
  )
}
