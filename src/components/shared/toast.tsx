"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 11)
    const toast: Toast = { id, message, type }

    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg flex items-start gap-3 cursor-pointer transition-all ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : toast.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-200"
                : toast.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-200"
            }`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="flex-1">{toast.message}</div>
            <button className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback during development if provider missing
    return {
      showToast: (msg: string) => console.log("[toast fallback]", msg),
      removeToast: () => {},
      toasts: [],
    }
  }
  return ctx
}
