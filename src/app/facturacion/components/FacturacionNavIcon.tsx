import type { ReactElement, SVGProps } from 'react'

type IconName =
  | 'calendar'
  | 'file'
  | 'users'
  | 'x-circle'
  | 'undo'
  | 'ticket'
  | 'receipt'
  | 'download'
  | 'scale'

const paths: Record<IconName, ReactElement> = {
  receipt: (
  <>
    <path d="M4 2h16v20l-4-2-4 2-4-2-4 2V2z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </>
  ),
  calendar: (
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>
  ),
  file: (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </>
  ),
  users: (
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>
  ),
  'x-circle': (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </>
  ),
  undo: (
  <>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
  </>
  ),
  ticket: (
  <>
    <path d="M2 9a3 3 0 0 1 0 6v1a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-1a3 3 0 0 1 0-6V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </>
  ),
  download: (
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
  ),
  scale: (
  <>
    <path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z" />
    <path d="M2 16h20" />
    <path d="M6 16v-3a2 2 0 0 1 2-2h1" />
    <path d="M12 11V7a2 2 0 0 1 2-2h1" />
    <path d="M18 11V5a2 2 0 0 0-2-2h-1" />
  </>
  ),
}

export default function FacturacionNavIcon({
  name,
  ...props
}: { name: string } & SVGProps<SVGSVGElement>) {
  const icon = paths[name as IconName] ?? paths.receipt
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {icon}
    </svg>
  )
}
