export type UserLevel = 'coordenador' | 'professor' | 'aluno'
export type RecordingStatus = 'proposta' | 'aprovada' | 'concluida' | 'cancelada'
export type SubStatus = 'pendente' | 'em_andamento' | 'concluido'

export interface Colaborador {
  id: string
  nome: string
  email: string
  telefone: string | null
  nivel: UserLevel
  criado_em: string
  professor_disciplinas?: { disciplina_id: number }[]
  professor_horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string }[]
}

export interface Disciplina {
  id: number
  nome: string
  cor: string
  microassunto: string | null
  total_paginas: number
}

export interface Tema {
  id: number
  disciplina_id: number
  tema_especifico: string
  ordem: number
  paginas: number | null
  questoes_previstas: number | null
  responsavel: string | null
  observacoes: string | null
  status_geral: SubStatus
  mat_atualizado: SubStatus
  mat_revisado: SubStatus
  mat_diagramado: SubStatus
  mat_conferencia: SubStatus
  vid_slide: SubStatus
  vid_gravacao: SubStatus
  vid_edicao: SubStatus
  comp_simulado: SubStatus
  comp_questoes: SubStatus
  comp_flashcards: SubStatus
  updated_at: string
}

export interface ExternalLink {
  label: string
  url: string
}

export interface Gravacao {
  id: number
  professor_id: string
  disciplina_id: number
  tema_id: number
  data_hora: string
  duracao_minutos: number
  status: RecordingStatus
  gravada: boolean
  cancelada: boolean
  motivo_cancelamento: string | null
  observacoes: string | null
  links: ExternalLink[]
  concluida_em: string | null
  criado_em: string
  colaboradores?: { nome: string }
  disciplinas?: { nome: string; cor: string }
  temas?: { tema_especifico: string }
}

export interface UserSession {
  id: string
  email: string
  nivel: UserLevel
  nome: string
  disciplina_ids?: number[]
}

export interface DisciplinaStats extends Disciplina {
  total_temas: number
  concluidos: number
  em_andamento: number
  pendentes: number
  paginas_totais: number
  progresso_geral: number
}
