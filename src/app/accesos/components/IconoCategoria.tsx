import { Banknote, Globe, KeyRound, Laptop, Mail, Server, Share2, Wifi } from 'lucide-react'

const ICONOS = {
  equipo: Laptop,
  correo: Mail,
  sistema: Globe,
  servidor: Server,
  banco: Banknote,
  wifi: Wifi,
  redes: Share2,
  otro: KeyRound,
} as const

export function IconoCategoria({ categoria, size = 18 }: { categoria: string; size?: number }) {
  const Icono = ICONOS[categoria as keyof typeof ICONOS] ?? KeyRound
  return <Icono size={size} aria-hidden />
}
