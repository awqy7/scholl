"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { useEscola } from "@/lib/escola-context"
import { mensagemInicialAria } from "@/lib/escola-tipo"

export interface Mensagem {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  acao?: string
  isLoading?: boolean
  isError?: boolean
}

interface ChatContextType {
  mensagens: Mensagem[]
  addMensagem: (msg: Omit<Mensagem, "id" | "timestamp">) => void
  updateLastMessage: (content: string, extra?: Partial<Mensagem>) => void
  limpar: () => void
  isTyping: boolean
  setIsTyping: (v: boolean) => void
  historico: Mensagem[]
}

const MENSAGEM_INICIAL: Omit<Mensagem, "id" | "timestamp"> = {
  role: "assistant",
  content: mensagemInicialAria("normal"),
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function createMensagem(msg: Omit<Mensagem, "id" | "timestamp">): Mensagem {
  return {
    ...msg,
    id: generateId(),
    timestamp: new Date(),
  }
}

const STORAGE_KEY = "aria-chat"
const MAX_HISTORY = 50

const ChatContext = createContext<ChatContextType>({
  mensagens: [],
  addMensagem: () => {},
  updateLastMessage: () => {},
  limpar: () => {},
  isTyping: false,
  setIsTyping: () => {},
  historico: [],
})

export function ChatProvider({ children }: { children: ReactNode }) {
  const { tipo, loading: escolaLoading } = useEscola()
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    createMensagem(MENSAGEM_INICIAL),
  ])
  const [isTyping, setIsTyping] = useState(false)

  // Persistência local do histórico
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Mensagem[]
        if (parsed.length > 1) {
          setMensagens(
            parsed
              .slice(-MAX_HISTORY)
              .map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
          )
          return
        }
      }
    } catch {
      // ignora erro de localStorage
    }
  }, [])

  useEffect(() => {
    if (escolaLoading) return
    setMensagens((prev) => {
      if (prev.length !== 1 || prev[0].role !== "assistant") return prev
      const intro = mensagemInicialAria(tipo)
      if (prev[0].content === intro) return prev
      return [createMensagem({ role: "assistant", content: intro })]
    })
  }, [tipo, escolaLoading])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mensagens.slice(-MAX_HISTORY)))
    } catch {
      // ignora
    }
  }, [mensagens])

  const addMensagem = useCallback((msg: Omit<Mensagem, "id" | "timestamp">) => {
    setMensagens((prev) => [...prev, createMensagem(msg)])
  }, [])

  const updateLastMessage = useCallback(
    (content: string, extra?: Partial<Mensagem>) => {
      setMensagens((prev) => {
        if (!prev.length) return prev
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content,
          ...extra,
        }
        return updated
      })
    },
    []
  )

  const limpar = useCallback(() => {
    const reset = createMensagem({ role: "assistant", content: "🎯 Pronto! Como posso ajudar?" })
    setMensagens([reset])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignora
    }
  }, [])

  return (
    <ChatContext.Provider
      value={{
        mensagens,
        addMensagem,
        updateLastMessage,
        limpar,
        isTyping,
        setIsTyping,
        historico: mensagens.slice(-10),
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  return useContext(ChatContext)
}
