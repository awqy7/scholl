"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Calendar,
  Users,
  BookOpen,
  UserX,
  ClipboardList,
  LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEscola } from "@/lib/escola-context"
import { escolaTemRecreioIntercalado } from "@/lib/escola-tipo"
import { AriaLogo } from "@/components/layout/aria-logo"

type MenuItem = {
  href: string
  label: string
  labelCreche?: string
  icon: typeof LayoutDashboard
  onlyCreche?: boolean
}

// MENU SIMPLIFICADO — máximo 6 seções principais
// O objetivo é que o usuário nunca se perca.
// Coisas relacionadas (horários, grade, recreio) ficam dentro de "Rotina".
// Faltas + Substituições ficam dentro de "Ausências".
// Professores + Monitores ficam dentro de "Equipe".
const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  {
    href: "/turmas",
    label: "Salas",
    labelCreche: "Salas",
    icon: Users,
  },
  { href: "/equipe", label: "Equipe", icon: BookOpen },
  { href: "/rotina", label: "Rotina", icon: Calendar },
  { href: "/ausencias", label: "Ausências", icon: UserX },
  { href: "/planejamento", label: "Planejamento", icon: ClipboardList },
]

function NavLink({
  item,
  label,
  active,
}: {
  item: MenuItem
  label: string
  active: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className="aria-nav-item"
      data-active={active}
      title={label}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
      <span>{label}</span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { tipo, config } = useEscola()
  const temRecreio = escolaTemRecreioIntercalado(tipo)

  // Filtra itens (ex: recreio só para creche, mas como agora está dentro de Rotina, quase tudo visível)
  const itensVisiveis = menuItems.filter((item) => !item.onlyCreche || temRecreio)

  function rotulo(item: MenuItem) {
    if (tipo === "creche" && item.labelCreche) return item.labelCreche
    return item.label
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="aria-sidebar">
      <div
        className="shrink-0 px-4 py-5 border-b"
        style={{ borderColor: "var(--aria-border)" }}
      >
        <AriaLogo href="/dashboard" />
        <p
          className="mt-2 ml-[2.85rem] text-[10px] font-medium tracking-wide truncate"
          style={{ color: "var(--aria-text-subtle)" }}
        >
          {config.label}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {itensVisiveis.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <NavLink
                key={item.href}
                item={item}
                label={rotulo(item)}
                active={active}
              />
            )
          })}
        </div>

        {/* Pequena ajuda visual */}
        <div className="mt-6 px-2 text-[10px] opacity-50 leading-tight">
          Tudo organizado em poucas seções.<br />Use o Painel para atalhos rápidos.
        </div>
      </nav>

      <div className="shrink-0 p-3 border-t" style={{ borderColor: "var(--aria-border)" }}>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "aria-nav-item w-full text-left",
            "hover:!text-red-300 hover:!bg-red-500/10"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}