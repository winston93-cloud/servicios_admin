import { redirect } from 'next/navigation'

/** El portal de familias (app `services`) está inactivo: los cobros se hacen en caja (/pos). */
export default function PortalDesayunosPage() {
  redirect('/proximamente?m=desayunos')
}
