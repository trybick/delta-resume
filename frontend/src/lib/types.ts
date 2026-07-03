export type TailorStatus = 'idle' | 'loading' | 'done'

export type BulletChange = {
  id: string
  lineIndex: number
  original: string
  tailored: string
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
