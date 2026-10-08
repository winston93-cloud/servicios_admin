/** Enlace de YouTube / Google Drive / Vimeo → URL para <iframe>; mp4 directo → { tipo: 'video' }. */
export function videoEmbed(url: string): { tipo: 'iframe' | 'video'; src: string } | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return id ? { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` } : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id =
      u.searchParams.get('v') ||
      u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ||
      ''
    return id ? { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}` } : null
  }
  if (host === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get('id') || ''
    return id ? { tipo: 'iframe', src: `https://drive.google.com/file/d/${id}/preview` } : null
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.match(/^\/(\d+)/)?.[1]
    return id ? { tipo: 'iframe', src: `https://player.vimeo.com/video/${id}` } : null
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { tipo: 'video', src: u.toString() }
  return null
}
