'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  GRUPOS_GENERALES,
  TIPOS_ITEM,
  completitudExpediente,
  etiquetaGrado,
  fechaLarga,
  tituloItem,
  type TeCampo,
  type TeDirectorioFila,
  type TeExpediente,
  type TeExpedienteItem,
  type TeTeacher,
  type TipoItemExpediente,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAbrirArchivo, teAccion, teSubir } from '../teApi'
import { ACEPTAR_DOCS, Avatar, Campo, SelectorArchivo, Vacio } from './ui'

type Base = { teacher: TeTeacher; snap: SeccionProps['snap']; avisar: SeccionProps['avisar']; exp: TeExpediente; recargarExp: () => Promise<void> }

function CampoInput({ campo, valor, onCambio }: { campo: TeCampo; valor: string; onCambio: (v: string) => void }) {
  const comun = { className: 'te-input', value: valor, onChange: (e: { target: { value: string } }) => onCambio(e.target.value) }
  let control
  if (campo.tipo === 'textarea') control = <textarea {...comun} rows={3} maxLength={campo.max} placeholder={campo.placeholder} />
  else if (campo.tipo === 'select') {
    control = (
      <select {...comun}>
        <option value="">Selecciona…</option>
        {campo.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  } else {
    control = (
      <input
        {...comun}
        type={campo.tipo === 'number' ? 'text' : campo.tipo ?? 'text'}
        inputMode={campo.tipo === 'number' ? 'numeric' : campo.tipo === 'tel' ? 'tel' : undefined}
        maxLength={campo.tipo === 'date' ? undefined : campo.max}
        placeholder={campo.placeholder}
        autoCapitalize={campo.mayusculas ? 'characters' : undefined}
        style={campo.mayusculas ? { textTransform: 'uppercase' } : undefined}
      />
    )
  }
  return (
    <Campo etiqueta={`${campo.etiqueta}${campo.requerido ? ' *' : ''}`} completo={campo.completo || campo.tipo === 'textarea'}>
      {control}
    </Campo>
  )
}

/** Valida en el navegador lo mismo que el servidor, para avisar antes de enviar. */
function errorCampos(campos: TeCampo[], datos: Record<string, string>): string | null {
  for (const c of campos) {
    const v = (datos[c.clave] ?? '').trim()
    if (!v) {
      if (c.requerido) return `${c.etiqueta} es obligatorio.`
      continue
    }
    const val = c.mayusculas ? v.toUpperCase() : v
    if (c.tipo === 'number' && !/^\d+$/.test(val)) return `${c.etiqueta} debe ser un número.`
    if (c.patron && !c.patron.test(val)) return `${c.etiqueta} no tiene el formato correcto.`
  }
  return null
}

/* ── Datos generales (crear / editar / borrar) ── */

export function FormGeneral({ teacher, snap, avisar, exp, recargarExp }: Base) {
  const [datos, setDatos] = useState<Record<string, string>>(exp.general)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => setDatos(exp.general), [exp.general])
  const existe = !!exp.actualizado
  const cambios = useMemo(() => JSON.stringify(datos) !== JSON.stringify(exp.general), [datos, exp.general])

  const guardar = async () => {
    const err = errorCampos(GRUPOS_GENERALES.flatMap((g) => g.campos), datos)
    if (err) return avisar(err, 'error')
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'guardar_expediente', { maestro_id: teacher.maestro_id, datos })
      await recargarExp()
      avisar(existe ? 'Datos generales actualizados.' : 'Datos generales registrados. 🗂️')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!window.confirm(`¿Borrar todos los datos generales de ${teacher.nombre}? Formación, documentos y contactos no se tocan.`)) return
    try {
      await teAccion(snap.nivel, 'borrar_expediente', { maestro_id: teacher.maestro_id })
      await recargarExp()
      avisar('Datos generales borrados.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <div className="te-exp-form">
      <p className="te-nota">
        {existe
          ? `Última actualización: ${new Date(exp.actualizado!).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'medium', timeStyle: 'short' })}${exp.actualizado_por ? ` por ${exp.actualizado_por}` : ''}.`
          : 'Este expediente aún no tiene datos generales. Llena lo que tengas y guarda; puedes completarlo después.'}
      </p>
      {GRUPOS_GENERALES.map((g) => (
        <fieldset key={g.clave} className="te-exp-fieldset">
          <legend>{g.emoji} {g.etiqueta}</legend>
          <div className="te-form">
            {g.campos.map((c) => (
              <CampoInput key={c.clave} campo={c} valor={datos[c.clave] ?? ''} onCambio={(v) => setDatos((p) => ({ ...p, [c.clave]: v }))} />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="te-fila-botones te-fila-fin te-exp-acciones">
        {existe ? (
          <button type="button" className="te-btn te-btn-ghost te-peligro" onClick={() => void borrar()}>
            <Trash2 size={16} aria-hidden /> Borrar datos generales
          </button>
        ) : null}
        <button type="button" className="te-btn te-btn-ghost" disabled={!cambios} onClick={() => setDatos(exp.general)}>Deshacer cambios</button>
        <button type="button" className="te-btn te-btn-primary" disabled={guardando || !cambios} onClick={() => void guardar()}>
          {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} {existe ? 'Guardar cambios' : 'Registrar datos'}
        </button>
      </div>
    </div>
  )
}

/* ── Registros individuales (formación, certificaciones, experiencia, contactos, documentos) ── */

export function ListaItems({ tipo, teacher, snap, avisar, exp, recargarExp }: Base & { tipo: TipoItemExpediente }) {
  const def = TIPOS_ITEM[tipo]
  const items = exp.items.filter((i) => i.tipo === tipo)
  const [editando, setEditando] = useState<TeExpedienteItem | 'nuevo' | null>(null)

  const eliminar = async (it: TeExpedienteItem) => {
    if (!window.confirm(`¿Eliminar «${tituloItem(it).titulo || def.etiqueta}»${it.archivo_key ? ' y su archivo' : ''}?`)) return
    try {
      await teAccion(snap.nivel, 'eliminar_expediente_item', { id: it.id })
      await recargarExp()
      avisar(`${def.etiqueta} eliminado.`)
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <section className="te-exp-card">
      <header>
        <h4>{def.emoji} {def.plural} <small>({items.length})</small></h4>
        {editando !== 'nuevo' ? (
          <button type="button" className="te-btn te-btn-primary te-btn-sm" onClick={() => setEditando('nuevo')}>
            <Plus size={14} aria-hidden /> Agregar
          </button>
        ) : null}
      </header>
      {editando === 'nuevo' ? (
        <FormItem tipo={tipo} item={null} teacher={teacher} snap={snap} avisar={avisar} recargarExp={recargarExp} onCerrar={() => setEditando(null)} />
      ) : null}
      {items.length ? (
        <ul className="te-exp-lista">
          {items.map((it) =>
            editando !== 'nuevo' && editando?.id === it.id ? (
              <li key={it.id} className="te-exp-lista-form">
                <FormItem tipo={tipo} item={it} teacher={teacher} snap={snap} avisar={avisar} recargarExp={recargarExp} onCerrar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={it.id}>
                <span className="te-min0">
                  <b>{tituloItem(it).titulo || def.etiqueta}</b>
                  {tituloItem(it).detalle ? <small>{tituloItem(it).detalle}</small> : null}
                </span>
                {it.archivo_key ? (
                  <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(it.archivo_key!).catch((e) => avisar(e.message, 'error'))}>
                    📎 Ver
                  </button>
                ) : def.archivo ? <span className="te-chip te-chip-suave">Sin archivo</span> : null}
                <button type="button" className="te-icon-btn" aria-label="Editar" onClick={() => setEditando(it)}>
                  <Pencil size={15} aria-hidden />
                </button>
                <button type="button" className="te-icon-btn" aria-label="Eliminar" onClick={() => void eliminar(it)}>
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : editando !== 'nuevo' ? (
        <p className="te-nota">Sin registros todavía.</p>
      ) : null}
    </section>
  )
}

function FormItem({ tipo, item, teacher, snap, avisar, recargarExp, onCerrar }: Omit<Base, 'exp'> & {
  tipo: TipoItemExpediente
  item: TeExpedienteItem | null
  onCerrar: () => void
}) {
  const def = TIPOS_ITEM[tipo]
  const [datos, setDatos] = useState<Record<string, string>>(item?.datos ?? {})
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const err = errorCampos(def.campos, datos)
    if (err) return avisar(err, 'error')
    setGuardando(true)
    try {
      const r = await teAccion<{ id: number }>(snap.nivel, 'expediente_item', { maestro_id: teacher.maestro_id, tipo, id: item?.id, datos })
      if (archivo) await teSubir(snap.nivel, { tipo: 'expediente', maestro_id: teacher.maestro_id, item_id: r.id, archivo })
      await recargarExp()
      avisar(item ? `${def.etiqueta} actualizado.` : `${def.etiqueta} agregado.`)
      onCerrar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const quitarArchivo = async () => {
    if (!item || !window.confirm('¿Quitar el archivo de este registro?')) return
    try {
      await teAccion(snap.nivel, 'quitar_archivo_item', { id: item.id })
      await recargarExp()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  return (
    <div className="te-form te-form-caja">
      {def.campos.map((c) => (
        <CampoInput key={c.clave} campo={c} valor={datos[c.clave] ?? ''} onCambio={(v) => setDatos((p) => ({ ...p, [c.clave]: v }))} />
      ))}
      {def.archivo ? (
        <div className="te-campo" data-completo>
          <SelectorArchivo
            etiqueta={item?.archivo_nombre ? `Reemplazar «${item.archivo_nombre}» (opcional)` : 'Adjuntar archivo (opcional)'}
            archivo={archivo}
            onArchivo={setArchivo}
            aceptar={ACEPTAR_DOCS}
          />
          {item?.archivo_key ? (
            <button type="button" className="te-btn te-btn-ghost te-btn-sm te-peligro" onClick={() => void quitarArchivo()}>Quitar archivo actual</button>
          ) : null}
        </div>
      ) : null}
      <div className="te-fila-botones te-fila-fin" data-completo>
        <button type="button" className="te-btn te-btn-ghost" onClick={onCerrar}>Cancelar</button>
        <button type="button" className="te-btn te-btn-primary" disabled={guardando} onClick={() => void guardar()}>
          {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : '💾'} {item ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

/* ── Lectura en el expediente ── */

export function GeneralesLectura({ exp, onEditar }: { exp: TeExpediente; onEditar: () => void }) {
  return (
    <>
      {GRUPOS_GENERALES.map((g) => (
        <section key={g.clave} className="te-exp-card">
          <header>
            <h4>{g.emoji} {g.etiqueta}</h4>
            <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={onEditar}>✏️ Editar</button>
          </header>
          <dl className="te-exp-datos">
            {g.campos.map((c) => {
              const v = exp.general[c.clave]
              return (
                <div key={c.clave} data-completo={c.completo || c.tipo === 'textarea' || undefined}>
                  <dt>{c.etiqueta}</dt>
                  <dd data-vacio={!v || undefined}>{v ? (c.tipo === 'date' ? fechaLarga(v) : v) : 'Sin capturar'}</dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </>
  )
}

export function ItemsLectura({ exp, avisar, onEditar }: { exp: TeExpediente; avisar: SeccionProps['avisar']; onEditar: () => void }) {
  return (
    <>
      {(Object.keys(TIPOS_ITEM) as TipoItemExpediente[]).map((tipo) => {
        const def = TIPOS_ITEM[tipo]
        const items = exp.items.filter((i) => i.tipo === tipo)
        return (
          <section key={tipo} className="te-exp-card">
            <header>
              <h4>{def.emoji} {def.plural} <small>({items.length})</small></h4>
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={onEditar}>✏️ Editar</button>
            </header>
            {items.length ? (
              <ul className="te-exp-lista">
                {items.map((it) => (
                  <li key={it.id}>
                    <span className="te-min0">
                      <b>{tituloItem(it).titulo || def.etiqueta}</b>
                      {tituloItem(it).detalle ? <small>{tituloItem(it).detalle}</small> : null}
                    </span>
                    {it.archivo_key ? (
                      <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => teAbrirArchivo(it.archivo_key!).catch((e) => avisar(e.message, 'error'))}>📎 Ver</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="te-nota">Sin registros todavía.</p>
            )}
          </section>
        )
      })}
    </>
  )
}

/* ── Vista general (todas las teachers) ── */

export function TablaGeneral({ snap, lista, avisar, onAbrir }: { snap: SeccionProps['snap']; lista: TeTeacher[]; avisar: SeccionProps['avisar']; onAbrir: (id: number) => void }) {
  const [filas, setFilas] = useState<TeDirectorioFila[] | null>(null)
  useEffect(() => {
    let vivo = true
    teAccion<{ directorio: TeDirectorioFila[] }>(snap.nivel, 'directorio')
      .then((r) => vivo && setFilas(r.directorio))
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : 'Error', 'error'))
    return () => {
      vivo = false
    }
  }, [snap.nivel, avisar])

  if (!filas) return <p className="te-cargando"><Loader2 size={18} className="te-spin" aria-hidden /> Cargando expedientes…</p>
  if (!lista.length) return <Vacio emoji="🔍" titulo="No encontré teachers" />
  return (
    <div className="te-tabla-scroll">
      <table className="te-tabla-exp">
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Grupos</th>
            <th>Celular</th>
            <th>CURP</th>
            <th>RFC</th>
            <th>Nacimiento</th>
            <th>Ingreso</th>
            <th>Contrato</th>
            <th>Formación</th>
            <th>Docs</th>
            <th>C.V.</th>
            <th>Expediente</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((t) => {
            const f: Pick<TeDirectorioFila, 'general' | 'items'> = filas.find((x) => x.maestro_id === t.maestro_id) ?? { general: {}, items: {} }
            const g = f.general
            const pct = completitudExpediente(g, f.items, !!t.cv_key)
            return (
              <tr key={t.maestro_id} onClick={() => onAbrir(t.maestro_id)}>
                <td>
                  <button type="button" className="te-tabla-nombre" onClick={(e) => { e.stopPropagation(); onAbrir(t.maestro_id) }}>
                    <Avatar emoji={t.emoji} fotoKey={t.foto_key} nombre={t.nombre} tam="sm" />
                    <span>{t.nombre}</span>
                  </button>
                </td>
                <td>{t.grupos.map((x) => `${etiquetaGrado(snap.nivel, Number(x[0]))}${x.slice(1)}`).join(', ') || '—'}</td>
                <td>{g.celular_personal || t.celular || '—'}</td>
                <td className="te-mono">{g.curp || '—'}</td>
                <td className="te-mono">{g.rfc || '—'}</td>
                <td>{g.fecha_nacimiento ? fechaLarga(g.fecha_nacimiento) : '—'}</td>
                <td>{t.fecha_ingreso ? fechaLarga(t.fecha_ingreso) : '—'}</td>
                <td>{g.tipo_contrato || '—'}</td>
                <td>{f.items.formacion ?? 0}</td>
                <td>{f.items.documento ?? 0}</td>
                <td>{t.cv_key ? '✅' : '—'}</td>
                <td>
                  <span className="te-exp-barra" data-tono={pct >= 80 ? 'top' : pct >= 50 ? 'warn' : 'bad'}>
                    <i style={{ ['--p' as string]: pct / 100 }} aria-hidden />
                    <b>{pct}%</b>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
