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
      content: "🎯 **Comando Central ativo!**\n\nDigite comandos naturais como:\n• \"crie uma turma Maternal C\"\n• \"Fernanda faltou, motivo médico\"\n• \"liste todos os professores\"\n• \"status da escola\"\n\nPosso criar turmas, professores, registrar faltas, sugerir substitutos e muito mais!",
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
