export function traduzirErroAuth(mensagem: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email ou senha incorretos.",
    "Email not confirmed": "Confirme seu email antes de entrar (ou desative confirmação no Supabase).",
    "User already registered": "Este email já está cadastrado. Use Entrar.",
    "Password should be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres.",
    "Unable to validate email address: invalid format": "Email inválido.",
    "Signup requires a valid password": "Informe uma senha válida.",
  }
  return map[mensagem] || mensagem
}

export function supabaseConfigurado(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return Boolean(url && key && !url.includes("seu-projeto") && key !== "sua-chave-anon")
}