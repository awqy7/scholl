"use client"

import { Suspense, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, School, Settings, Copy, Check } from "lucide-react"
import { traduzirErroAuth } from "@/lib/auth-messages"
import {
  gerarEnvLocal,
  isSupabaseReady,
  salvarSupabaseLocal,
  getSupabaseUrl,
} from "@/lib/supabase/config"

type Modo = "entrar" | "criar"

function LoginForm() {
  const [modo, setModo] = useState<Modo>("entrar")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [nomeEscola, setNomeEscola] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok" | "info"; texto: string } | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [sbUrl, setSbUrl] = useState("")
  const [sbKey, setSbKey] = useState("")
  const [copiado, setCopiado] = useState(false)
  const [pronto, setPronto] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("error") === "auth_failed") {
      setMsg({ tipo: "erro", texto: "Falha na autenticação. Tente entrar novamente." })
    }
    setPronto(isSupabaseReady())
    if (!isSupabaseReady()) setShowConfig(true)
  }, [searchParams])

  function getClient() {
    try {
      return createClient()
    } catch (e) {
      setMsg({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Configure o Supabase abaixo.",
      })
      setShowConfig(true)
      return null
    }
  }

  function salvarConfig() {
    if (!sbUrl.trim() || !sbKey.trim()) {
      setMsg({ tipo: "erro", texto: "Cole a URL e a chave anon do Supabase." })
      return
    }
    salvarSupabaseLocal(sbUrl, sbKey)
    setPronto(true)
    setShowConfig(false)
    setMsg({
      tipo: "ok",
      texto: "Conexão salva! Agora crie sua conta ou entre com email e senha.",
    })
  }

  async function copiarEnv() {
    const texto = gerarEnvLocal(sbUrl || getSupabaseUrl(), sbKey)
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
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
        data: { nome: nomeEscola.trim() || email.split("@")[0] },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMsg({ tipo: "erro", texto: traduzirErroAuth(error.message) })
      setLoading(false)
      return
    }

    if (data.session) {
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

  const msgClass =
    msg?.tipo === "erro"
      ? "bg-red-50 text-red-700"
      : msg?.tipo === "ok"
        ? "bg-green-50 text-green-700"
        : "bg-blue-50 text-blue-700"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <School className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Escola Inteligente</CardTitle>
            <CardDescription>Entre ou crie sua conta para usar o sistema com IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-sm font-medium ${modo === "entrar" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}
                onClick={() => setModo("entrar")}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-2 text-sm font-medium ${modo === "criar" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}
                onClick={() => setModo("criar")}
              >
                Criar conta
              </button>
            </div>

            {!pronto && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                Primeiro configure o Supabase abaixo (só uma vez).
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {modo === "criar" && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da escola</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Creche Sol"
                    value={nomeEscola}
                    onChange={(e) => setNomeEscola(e.target.value)}
                  />
                </div>
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

              {msg && <div className={`rounded-lg p-3 text-sm ${msgClass}`}>{msg.texto}</div>}

              <Button type="submit" className="w-full" disabled={loading || !pronto}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : modo === "entrar" ? "Entrar" : "Criar conta e acessar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700"
            onClick={() => setShowConfig(!showConfig)}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurar conexão (Supabase)
            </span>
            <span className={pronto ? "text-green-600 text-xs" : "text-amber-600 text-xs"}>
              {pronto ? "OK" : "Obrigatório"}
            </span>
          </button>
          {showConfig && (
            <CardContent className="space-y-3 border-t pt-3 text-sm">
              <ol className="list-decimal list-inside space-y-1 text-gray-600 text-xs">
                <li>
                  Crie projeto em{" "}
                  <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    supabase.com
                  </a>
                </li>
                <li>
                  SQL Editor → execute <code className="bg-gray-100 px-1">supabase/migrations/00001_schema.sql</code>
                </li>
                <li>Settings → API → copie URL e anon key</li>
              </ol>
              <div className="space-y-2">
                <Label>URL do projeto</Label>
                <Input placeholder="https://xxxxx.supabase.co" value={sbUrl} onChange={(e) => setSbUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Chave anon (public)</Label>
                <Input placeholder="eyJ... ou sb_publishable_..." value={sbKey} onChange={(e) => setSbKey(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={salvarConfig}>
                  Salvar e continuar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={copiarEnv} title="Copiar .env.local">
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Para a IA funcionar, cole também em <code className="bg-gray-100 px-1">.env.local</code> e reinicie{" "}
                <code className="bg-gray-100 px-1">npm run dev</code>.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  )
}