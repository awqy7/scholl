"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Calendar,
  Users,
  BookOpen,
  Clock,
  TreePine,
  UserX,
  RefreshCw,
  ClipboardList,
  LogOut,
  GraduationCap,
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
  group: "main" | "cadastros" | "operacional"
  onlyCreche?: boolean
}

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  {
    href: "/turmas",
    label: "Turmas",
    labelCreche: "Salas",
    icon: Users,
    group: "cadastros",
  },
  { href: "/professores", label: "Professores", icon: BookOpen, group: "cadastros" },
  { href: "/materias", label: "Matérias", icon: GraduationCap, group: "cadastros" },
  { href: "/horarios", label: "Períodos", icon: Clock, group: "cadastros" },
  { href: "/grade", label: "Grade", icon: Calendar, group: "operacional" },
  {
    href: "/recreio",
    label: "Recreio",
    icon: TreePine,
    group: "operacional",
    onlyCreche: true,
  },
  { href: "/faltas", label: "Faltas", icon: UserX, group: "operacional" },
  { href: "/substituicoes", label: "Substituições", icon: RefreshCw, group: "operacional" },
  { href: "/planejamento", label: "Planejamento", icon: ClipboardList, group: "operacional" },
]

const groups: { key: MenuItem["group"]; label: string }[] = [
  { key: "main", label: "Visão" },
  { key: "cadastros", label: "Cadastros" },
  { key: "operacional", label: "Operação" },
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

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group) => {
          const items = itensVisiveis.filter((i) => i.group === group.key)
          if (!items.length) return null
          return (
            <div key={group.key}>
              <p className="aria-nav-label">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
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
            </div>
          )
        })}
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