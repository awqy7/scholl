import { NextResponse } from "next/server"
import { formatIaError } from "@/lib/ia-utils"
import { getProvedorAtivo } from "@/lib/ia-client"
import { requireApiUser } from "@/lib/api-auth"
import {
  isAcaoValida,
  normalizarAcaoComando,
  normalizarParamsComando,
  type AcaoComando,
  type DecisaoComando,
} from "@/lib/ia-comando"
import {
  interpretarComandoAria,
  conversarComDiretor,
  deveExecutarAcao,
} from "@/lib/aria-orquestrador"
import { adicionarFatoMemoria, carregarMemoria } from "@/lib/aria-memoria"
import { normalizarTipoEscola } from "@/lib/escola-tipo"

export const maxDuration = 90

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { comando, contexto, historico } = body

    if (!comando || typeof comando !== "string") {
      return NextResponse.json({ error: "Comando vazio" }, { status: 400 })
    }

    let memoria = { resumo: "", fatos: [] as { texto: string; ts: string; acao?: string }[] }
    try {
      memoria = await carregarMemoria(auth.supabase, auth.escolaId)
    } catch {
      // tabela aria_contexto pode não existir ainda — segue sem memória
    }

    const { data: escolaRow } = await auth.supabase
      .from("escolas")
      .select("tipo, nome")
      .eq("id", auth.escolaId)
      .maybeSingle()

    const tipoEscola = normalizarTipoEscola(
      escolaRow?.tipo || (auth.user.user_metadata?.tipo_escola as string)
    )

    const contextoCompleto = {
      ...(typeof contexto === "object" && contexto ? contexto : {}),
      tipoEscola,
      escolaNome: escolaRow?.nome,
    }

    const parsed = await interpretarComandoAria({
      comando,
      contexto: contextoCompleto,
      historico,
      memoria,
    })

    const acaoCanon = normalizarAcaoComando(parsed?.acao) || parsed?.acao

    if (!acaoCanon || !isAcaoValida(acaoCanon)) {
      const resposta = await conversarComDiretor({
        pergunta: comando,
        contextoEscola: contextoCompleto,
        historico,
        memoria,
      })
      return NextResponse.json({
        acao: "responder_pergunta",
        params: { pergunta: comando, resposta },
        sucesso: true,
        resposta,
        modo: "ia",
        provedor: getProvedorAtivo(),
      })
    }

    if (
      acaoCanon === "responder_pergunta" ||
      !deveExecutarAcao(comando, acaoCanon)
    ) {
      const pergunta = String(
        parsed.params?.pergunta || parsed.params?.texto || comando
      )
      const resposta = await conversarComDiretor({
        pergunta,
        contextoEscola: contextoCompleto,
        historico,
        memoria,
      })
      return NextResponse.json({
        acao: "responder_pergunta",
        params: { pergunta, resposta },
        sucesso: true,
        resposta,
        confianca: parsed.confianca,
        explicacao: parsed.explicacao,
        modo: "ia",
        provedor: getProvedorAtivo(),
      })
    }

    const params = normalizarParamsComando(
      acaoCanon,
      parsed.params || {},
      comando
    )

    const decisao: DecisaoComando = {
      acao: acaoCanon as AcaoComando,
      params,
      confianca: parsed.confianca,
      explicacao: parsed.explicacao,
    }

    try {
      await adicionarFatoMemoria(
        auth.supabase,
        auth.escolaId,
        `Pedido: ${comando.slice(0, 200)} → ${decisao.acao}`,
        decisao.acao
      )
    } catch {
      // memória opcional — não bloqueia o comando
    }

    const acaoLabel = String(decisao.acao)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())

    return NextResponse.json({
      acao: decisao.acao,
      params: decisao.params,
      sucesso: true,
      confianca: decisao.confianca,
      explicacao: decisao.explicacao,
      mensagem: `Executando: ${acaoLabel}...`,
      modo: "ia",
      provedor: getProvedorAtivo(),
      tipoEscola,
    })
  } catch (err) {
    return NextResponse.json(
      {
        resposta: formatIaError(err),
        acao: "erro",
        sucesso: false,
      },
      { status: 502 }
    )
  }
}