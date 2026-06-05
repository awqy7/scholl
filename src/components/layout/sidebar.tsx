"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Calendar, Users, BookOpen, Clock,
  TreePine, UserX, RefreshCw, ClipboardList, LogOut,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/turmas", label: "Turmas", icon: Users },
  { href: "/professores", label: "Professores", icon: BookOpen },
  { href: "/materias", label: "Matérias", icon: BookOpen },
  { href: "/horarios", label: "Períodos", icon: Clock },
  { href: "/grade", label: "Grade Horária", icon: Calendar },
  { href: "/recreio", label: "Recreio", icon: TreePine },
  { href: "/faltas", label: "Faltas", icon: UserX },
  { href: "/substituicoes", label: "Substituições", icon: RefreshCw },
  { href: "/planejamento", label: "Planejamento", icon: ClipboardList },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
          EI
        </div>
        <span className="font-semibold text-lg">Escola IA</span>
      </div>

      <nav className="flex flex-col gap-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-4 left-4 right-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
