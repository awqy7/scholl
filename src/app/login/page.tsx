"use client"

import { Suspense, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Baby, School, Brain } from "lucide-react"
import type { TipoEscola } from "@/lib/escola-tipo"
import { traduzirErroAuth } from "@/lib/auth-messages"
import { AriaLogo } from "@/components/layout/aria-logo"

type Modo = "entrar" | "criar"

function LoginForm() {
  const [modo, setModo] = useState<Modo>("entrar")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nomeEscola, setNomeEscola] = useState("")
  const [tipoEscola, setTipoEscola] = useState<TipoEscola>("creche")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok" | "info"; texto: string } | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      setMsg({ tipo: "erro", texto: "Falha na autenticação. Tente entrar novamente." })
    }
  }, [searchParams])

  function getClient() {
    try {
      return createClient()
    } catch (e) {
      setMsg({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao conectar. Verifique as variáveis de ambiente.",
      })
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const supabase = getClient()
    if (!supabase) {
      setLoading(false)
      return
    }

    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErroAuth(error.message) })
        setLoading(false)
        return
      }
      router.push("/dashboard")
      router.refresh()
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome: nomeEscola.trim() || email.split("@")[0],
          tipo_escola: tipoEscola,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMsg({ tipo: "erro", texto: traduzirErroAuth(error.message) })
      setLoading(false)
      return
    }

    if (data.session) {
      await fetch("/api/escola", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeEscola.trim() || email.split("@")[0],
          tipo: tipoEscola,
        }),
      }).catch(() => {})
      setMsg({ tipo: "ok", texto: "Conta criada! Entrando..." })
      router.push("/dashboard")
      router.refresh()
      setLoading(false)
      return
    }

    setMsg({
      tipo: "info",
      texto:
        "Conta criada! Se pedir confirmação de email, abra o link enviado. " +
        "Ou no Supabase desative 'Confirm email' e use Entrar.",
    })
    setModo("entrar")
    setLoading(false)
  }

  const msgStyles =
    msg?.tipo === "erro"
      ? "bg-red-500/10 text-red-300 border-red-500/20"
      : msg?.tipo === "ok"
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
        : "bg-cyan-500/10 text-cyan-200 border-cyan-500/20"

  return (
    <div className="flex min-h-screen flex-col p-6">
      <header className="mb-10">
        <AriaLogo href="/" showName />
      </header>

      <div className="flex flex-1 items-center justify-center">
        <div className="glass-card w-full max-w-md p-8">
          <p className="text-sm mb-6" style={{ color: "var(--aria-text-muted)" }}>
            Gestão escolar inteligente — entre ou cadastre sua escola
          </p>

          <div
            className="flex rounded-[var(--aria-radius)] p-1 mb-6"
            style={{ background: "var(--aria-surface-hover)" }}
          >
            {(["entrar", "criar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 rounded-[10px] py-2 text-sm font-medium transition-all ${
                  modo === m ? "text-[#050508]" : ""
                }`}
                style={
                  modo === m
                    ? { background: "var(--aria-accent)", color: "#050508" }
                    : { color: "var(--aria-text-muted)" }
                }
                onClick={() => setModo(m)}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === "criar" && (
              <>
                <div className="space-y-2">
                  <Label>Tipo de escola</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "creche" as const, icon: Baby, title: "Creche", sub: "Educação infantil" },
                        { id: "normal" as const, icon: School, title: "Regular", sub: "Ensino fundamental" },
                      ] as const
                    ).map(({ id, icon: Icon, title, sub }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTipoEscola(id)}
                        className="rounded-[var(--aria-radius)] border p-3 text-left transition-all"
                        style={{
                          borderColor:
                            tipoEscola === id ? "rgba(34,211,238,0.45)" : "var(--aria-border)",
                          background:
                            tipoEscola === id ? "var(--aria-accent-soft)" : "transparent",
                        }}
                      >
                        <Icon
                          className="h-4 w-4 mb-1"
                          style={{ color: tipoEscola === id ? "var(--aria-accent)" : undefined }}
                        />
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--aria-text-subtle)" }}>
                          {sub}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da escola</Label>
                  <Input
                    id="nome"
                    placeholder={
                      tipoEscola === "creche" ? "Ex: Creche Sol" : "Ex: Colégio Horizonte"
                    }
                    value={nomeEscola}
                    onChange={(e) => setNomeEscola(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              />
            </div>

            {msg && (
              <div className={`rounded-lg border p-3 text-sm ${msgStyles}`}>{msg.texto}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : modo === "entrar" ? (
                "Entrar"
              ) : (
                "Criar conta e acessar"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2">
          <Brain className="h-5 w-5" style={{ color: "var(--aria-accent)" }} />
          <span style={{ color: "var(--aria-text-muted)" }}>ARIA</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}