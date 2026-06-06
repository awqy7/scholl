"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Hook compartilhado para obter escolaId de forma segura e reutilizável.
 * Reduz duplicação massiva de getUser + getCurrentEscolaId em todas as páginas.
 * Retorna { escolaId, loading, error, refresh }
 * Uso recomendado:
 *   const { escolaId, loading } = useEscolaId()
 *   if (loading || !escolaId) return <Loading />
 *   // depois use em queries .eq("escola_id", escolaId)
 */
export function useEscolaId() {
  const [escolaId, setEscolaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setEscolaId(null)
        setLoading(false)
        return
      }
      const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
      const id = await getCurrentEscolaId(userData.user.id)
      setEscolaId(id)
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar escola"))
      setEscolaId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { escolaId, loading, error, refresh: load }
}

/**
 * Hook mais completo para carregar dados comuns da escola + queries.
 * Ajuda na praticidade de entender e mexer no sistema.
 * Exemplo de uso em página:
 *   const { escolaId, loading, data: { professores, faltas } } = useSchoolData({
 *     professores: (eId) => supabase.from("professores").select("*").eq("escola_id", eId),
 *     faltas: (eId) => supabase.from("faltas").select("*").eq("escola_id", eId).order("data", { ascending: false }),
 *   })
 */
export function useSchoolData<T extends Record<string, (eId: string) => Promise<any>>>(
  queries: T
) {
  const { escolaId, loading: idLoading, error: idError, refresh: refreshId } = useEscolaId()
  const [data, setData] = useState<Partial<Record<keyof T, any>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async (currentEscolaId: string | null) => {
    if (!currentEscolaId) {
      setData({})
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const results: any = {}
      await Promise.all(
        Object.entries(queries).map(async ([key, queryFn]) => {
          const res = await (queryFn as any)(currentEscolaId)
          results[key] = res.data || res
        })
      )
      setData(results)
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar dados da escola"))
    } finally {
      setLoading(false)
    }
  }, [queries])

  useEffect(() => {
    load(escolaId)
  }, [escolaId, load])

  const refresh = useCallback(() => {
    refreshId()
    if (escolaId) load(escolaId)
  }, [refreshId, escolaId, load])

  return {
    escolaId,
    data,
    loading: idLoading || loading,
    error: idError || error,
    refresh,
  }
}
