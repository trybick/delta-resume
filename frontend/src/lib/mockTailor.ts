import type { TailorResult } from './types'

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

export const SAMPLE_TAILOR_RESULT: TailorResult = {
  resumeText: SAMPLE_RESUME,
  changes: [
    {
      id: 'sample-change-1',
      lineIndex: 6,
      original: '- Worked on the checkout flow for the main e-commerce product',
      tailored:
        '- Rebuilt the checkout flow in React and TypeScript, lifting conversion 12% for the main e-commerce product',
    },
    {
      id: 'sample-change-2',
      lineIndex: 7,
      original: '- Built internal dashboards for tracking team metrics',
      tailored:
        '- Built real-time internal dashboards with React and PostgreSQL, cutting weekly reporting time by 6 hours',
    },
    {
      id: 'sample-change-3',
      lineIndex: 8,
      original: '- Helped migrate legacy services to a modern cloud platform',
      tailored:
        '- Led migration of 14 legacy services to AWS with Docker, reducing infrastructure costs by 30%',
    },
    {
      id: 'sample-change-4',
      lineIndex: 12,
      original: '- Made improvements to the public REST API',
      tailored:
        '- Redesigned the public REST API in Node.js, improving p95 latency by 40% for 200+ integration partners',
    },
    {
      id: 'sample-change-5',
      lineIndex: 13,
      original: '- Worked with designers to ship a redesigned onboarding flow',
      tailored:
        '- Partnered with design to ship a redesigned onboarding flow that increased activation by 18%',
    },
  ],
}
