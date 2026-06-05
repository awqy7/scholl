"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Brain } from "lucide-react"

const FAB_ID = "aria-fab-launcher"

let pediuAbrirChat = false

export function consumirPedidoAbrirChat(): boolean {
  if (!pediuAbrirChat) return false
  pediuAbrirChat = false
  return true
}

/** Botão flutuante da ARIA — sempre visível no canto inferior direito. */
export function AriaFloatingButton() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  function abrirChat() {
    pediuAbrirChat = true
    window.dispatchEvent(new CustomEvent("aria:abrir-chat"))
  }

  const botao = (
    <button
      id={FAB_ID}
      type="button"
      onClick={abrirChat}
      aria-label="Abrir ARIA"
      title="Abrir ARIA"
      className="aria-fab fixed bottom-6 right-6 z-[2147483646] flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-full border border-white/10 p-0 transition-transform hover:scale-105 active:scale-95"
    >
      <Brain size={28} color="#050508" strokeWidth={2} aria-hidden />
    </button>
  )

  if (!portalTarget) return null

  return createPortal(botao, portalTarget)
}

export function esconderFabAria() {
  const el = document.getElementById(FAB_ID)
  if (el) el.style.display = "none"
}

export function mostrarFabAria() {
  const el = document.getElementById(FAB_ID)
  if (el) el.style.display = "flex"
}