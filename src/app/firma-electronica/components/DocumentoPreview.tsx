'use client'

type Props = {
  title: string
  url: string | null
  emptyLabel?: string
}

export default function DocumentoPreview({ title, url, emptyLabel }: Props) {
  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {url ? (
          <a
            className="fe-doc-open"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en pestaña
          </a>
        ) : null}
      </header>
      <div className="fe-doc-frame">
        {url ? (
          <iframe title={title} src={url} className="fe-doc-iframe" />
        ) : (
          <p className="fe-doc-empty">
            {emptyLabel || 'El documento aparecerá aquí.'}
          </p>
        )}
      </div>
    </section>
  )
}
