"use client"

import Link from "next/link"
import { useEscola } from "@/lib/escola-context"
import { escolaTemRecreioIntercalado } from "@/lib/escola-tipo"
import { Loading } from "@/components/shared/loading"
import { TreePine } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CrecheOnly({ children }: { children: React.ReactNode }) {
  const { loading, tipo, config } = useEscola()

  if (loading) return <Loading />

  if (!escolaTemRecreioIntercalado(tipo)) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4 p-8 glass-card">
        <TreePine className="h-12 w-12 mx-auto text-emerald-400/50" />
        <h2 className="text-xl font-bold text-white">Recreio intercalado</h2>
        <p className="text-sm text-indigo-300/80">
          Este módulo é exclusivo para <strong>Creche / Educação Infantil</strong>.
          Sua escola está cadastrada como <strong>{config.label}</strong>.
        </p>
        <p className="text-xs text-gray-400">
          Na escola regular, use a seção <strong>Rotina</strong> para grade e horários.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="mt-2">
            Voltar ao painel
          </Button>
        </Link>
      </div>
    )
  }

  return <>{children}</>
}