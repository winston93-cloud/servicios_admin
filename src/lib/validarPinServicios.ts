/** Valida el PIN compartido de servicios (mismo de Usuarios / Costos). */
export async function validarPinServicios(
  pin: string
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const valor = String(pin ?? '').trim()
  if (!valor) {
    return { ok: false, mensaje: 'Ingresa el PIN de acceso.' }
  }
  try {
    const res = await fetch('/api/usuarios/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: valor }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, mensaje: data.error || 'PIN incorrecto.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: 'No se pudo validar el PIN. Intenta de nuevo.' }
  }
}
