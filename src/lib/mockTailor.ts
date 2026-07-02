import type { BulletChange, TailorResult } from './types'

export const SAMPLE_RESUME = `Jordan Ellis
Senior Software Engineer | jordan.ellis@email.com | San Francisco, CA

EXPERIENCE

Acme Corp — Senior Software Engineer (2021 – Present)
- Worked on the checkout flow for the main e-commerce product
- Built internal dashboards for tracking team metrics
- Helped migrate legacy services to a modern cloud platform
- Reviewed code and mentored two junior engineers

Globex Inc — Software Engineer (2018 – 2021)
- Made improvements to the public REST API
- Worked with designers to ship a redesigned onboarding flow
- Maintained CI pipelines and testing infrastructure

EDUCATION

B.S. Computer Science, State University (2018)

SKILLS

TypeScript, React, Node.js, PostgreSQL, AWS, Docker`

const VERB_UPGRADES: Array<[RegExp, string]> = [
  [/^worked on\b/i, 'Spearheaded'],
  [/^worked with\b/i, 'Partnered with'],
  [/^helped\b/i, 'Drove'],
  [/^made\b/i, 'Delivered'],
  [/^built\b/i, 'Architected and shipped'],
  [/^managed\b/i, 'Led'],
  [/^maintained\b/i, 'Owned and hardened'],
  [/^reviewed\b/i, 'Championed'],
  [/^created\b/i, 'Designed and launched'],
]

const IMPACT_PHRASES = [
  ', increasing conversion by 18% in line with the role’s focus on customer impact',
  ', cutting reporting turnaround from days to minutes for cross-functional stakeholders',
  ', reducing infrastructure costs by 25% while improving deployment reliability',
  ', raising code-quality standards emphasized in the job description',
  ', improving p95 latency by 40% across high-traffic endpoints',
  ', boosting new-user activation by 22% quarter over quarter',
]

const BULLET_PATTERN = /^(\s*[-•*]\s+)(.*\S)\s*$/

const rewriteBulletContent = (content: string, phraseIndex: number): string => {
  const withoutTrailingPeriod = content.replace(/\.\s*$/, '')
  const upgrade = VERB_UPGRADES.find(([pattern]) =>
    pattern.test(withoutTrailingPeriod),
  )
  const upgraded = upgrade
    ? withoutTrailingPeriod.replace(upgrade[0], upgrade[1])
    : withoutTrailingPeriod
  return `${upgraded}${IMPACT_PHRASES[phraseIndex % IMPACT_PHRASES.length]}`
}

const pickSpread = <T,>(items: T[], count: number): T[] => {
  if (items.length <= count) return items
  const step = items.length / count
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)])
}

export const tailorResume = (
  resumeText: string,
  _jobDescription: string,
): Promise<TailorResult> => {
  const lines = resumeText.split('\n')
  const bulletLines = lines
    .map((line, lineIndex) => ({ line, lineIndex }))
    .filter(({ line }) => BULLET_PATTERN.test(line))
  const selected = pickSpread(bulletLines, 4)

  const changes: BulletChange[] = selected.map(({ line, lineIndex }, i) => {
    const match = line.match(BULLET_PATTERN)!
    const [, marker, content] = match
    return {
      id: `change-${lineIndex}`,
      lineIndex,
      original: line,
      tailored: `${marker}${rewriteBulletContent(content, i)}`,
    }
  })

  return new Promise((resolve) => {
    setTimeout(() => resolve({ resumeText, changes }), 1500)
  })
}
