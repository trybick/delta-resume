export type TailorStatus = 'idle' | 'loading' | 'done'

export type ChangeKind = 'bullet' | 'skill'

export type BulletChange = {
  id: string
  lineIndex: number
  original: string
  tailored: string
  kind: ChangeKind
}

export type TailorResult = {
  resumeText: string
  changes: BulletChange[]
}

export type ChangeDecision = 'pending' | 'accepted' | 'rejected'

export type CreditStatus = {
  remaining: number
  total: number
  plan: string
  isAuthenticated: boolean
}

export type SavedResume = {
  id: string
  name: string
  resumeText: string
  createdAt: string
}
