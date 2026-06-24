import type { ReactElement, SVGProps } from 'react'

type IconName =
  | 'calendar'
  | 'file'
  | 'users'
  | 'x-circle'
  | 'undo'
  | 'ticket'
  | 'receipt'

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
