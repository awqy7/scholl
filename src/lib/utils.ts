import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date))
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function generateId() {
  return crypto.randomUUID()
}

export const DIAS_SEMANA = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
]

export const PERIODOS_DIA = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "integral", label: "Integral" },
]

export const STATUS_PROFESSOR = {
  presente: "Presente",
  ausente: "Ausente",
  ferias: "Férias",
  licenca: "Licença",
  atestado: "Atestado",
} as const
