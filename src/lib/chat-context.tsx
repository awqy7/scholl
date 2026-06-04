"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface Mensagem {
  role: "user" | "assistant"
  content: string
}

interface ChatContextType {
  mensagens: Mensagem[]
  addMensagem: (msg: Mensagem) => void
  limpar: () => void
}

const ChatContext = createContext<ChatContextType>({
  mensagens: [],
  addMensagem: () => {},
  limpar: () => {},
})

export function ChatProvider({ children }: { children: ReactNode }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "assistant",
      content: "🎯 **Comando Central ativo!**\n\nFale naturalmente — eu interpreto e executo no sistema:\n• \"cadastre turma Maternal C de manhã\"\n• \"Maria Silva faltou, atestado médico\"\n• \"gere a grade horária\" / \"organize o recreio\"\n• \"mude o email do João para joao@escola.com\"\n• \"liste faltas\" / \"confirme substituição\"\n\nPosso criar, editar, deletar e consultar turmas, professores, matérias, períodos, faltas, grade e planejamento.",
    },
  ])

  const addMensagem = useCallback((msg: Mensagem) => {
    setMensagens((prev) => [...prev, msg])
  }, [])

  const limpar = useCallback(() => {
    setMensagens([
      { role: "assistant", content: "🎯 Pronto! Como posso ajudar?" },
    ])
  }, [])

  return (
    <ChatContext.Provider value={{ mensagens, addMensagem, limpar }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  return useContext(ChatContext)
}
