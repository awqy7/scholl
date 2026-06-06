"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getConfigTipo,
  normalizarTipoEscola,
  type TipoEscola,
  type ConfigTipoEscola,
} from "@/lib/escola-tipo"

interface EscolaContextValue {
  loading: boolean
  nome: string
  tipo: TipoEscola
  config: ConfigTipoEscola
  recarregar: () => Promise<void>
}

const EscolaContext = createContext<EscolaContextValue | null>(null)

export function EscolaProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState("")
  const [tipo, setTipo] = useState<TipoEscola>("normal")

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // New proper way: resolve via membership (supports multiple schools per user in future)
    const { data: membro } = await supabase
      .from("escola_membros")
      .select("escola_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    const resolvedEscolaId = membro?.escola_id || user.id // legacy fallback

    const { data } = await supabase
      .from("escolas")
      .select("nome, tipo")
      .eq("id", resolvedEscolaId)
      .maybeSingle()

    if (data) {
      setNome(data.nome || "Minha Escola")
      setTipo(normalizarTipoEscola(data.tipo))
    } else {
      const metaTipo = user.user_metadata?.tipo_escola as string | undefined
      setNome(String(user.user_metadata?.nome || user.email?.split("@")[0] || "Minha Escola"))
      setTipo(normalizarTipoEscola(metaTipo))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const config = getConfigTipo(tipo)

  return (
    <EscolaContext.Provider
      value={{ loading, nome, tipo, config, recarregar: carregar }}
    >
      {children}
    </EscolaContext.Provider>
  )
}

export function useEscola(): EscolaContextValue {
  const ctx = useContext(EscolaContext)
  if (!ctx) {
    const config = getConfigTipo("normal")
    return {
      loading: false,
      nome: "",
      tipo: "normal",
      config,
      recarregar: async () => {},
    }
  }
  return ctx
}