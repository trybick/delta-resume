import type { TailorResult } from './types'

export const SAMPLE_RESUME = `Jordan Ellis
Senior Software Engineer | jordan.ellis@email.com | (415) 555-0182 | San Francisco, CA
linkedin.com/in/jordanellis | github.com/jordanellis

SUMMARY

Senior software engineer with 8 years of experience building consumer-facing web products
and the platform infrastructure behind them. Comfortable owning features end to end, from
database schema to pixel-level UI polish. Enjoys mentoring and improving developer experience.

EXPERIENCE

Acme Corp — Senior Software Engineer (2021 – Present)
- Worked on the checkout flow for the main e-commerce product
- Built internal dashboards for tracking team metrics
- Helped migrate legacy services to a modern cloud platform
- Reviewed code and mentored two junior engineers
- Participated in the on-call rotation and helped with incident response
- Wrote design docs for new features and presented them at engineering reviews

Globex Inc — Software Engineer (2018 – 2021)
- Made improvements to the public REST API
- Worked with designers to ship a redesigned onboarding flow
- Maintained CI pipelines and testing infrastructure
- Fixed bugs reported by the customer support team
- Added automated tests to increase coverage of core services

Initech — Software Engineering Intern (Summer 2017)
- Built an internal tool to help the QA team reproduce reported issues
- Wrote scripts to automate parts of the weekly release process

PROJECTS

OpenBoard — Maintainer of an open-source kanban board library with 2k+ GitHub stars
SideQuest — Personal habit tracker built with React Native, Supabase, and Expo

EDUCATION

B.S. Computer Science, State University (2018)
Graduated with honors; teaching assistant for Intro to Data Structures

SKILLS

Languages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Redux, HTML/CSS, Vite
Backend: Node.js, Express, PostgreSQL, Redis, REST APIs
Infrastructure: AWS, Docker, Terraform, GitHub Actions, Datadog`

export const SAMPLE_TAILOR_RESULT: TailorResult = {
  resumeText: SAMPLE_RESUME,
  changes: [
    {
      id: 'sample-change-1',
      lineIndex: 13,
      original: '- Worked on the checkout flow for the main e-commerce product',
      tailored:
        '- Rebuilt the checkout flow in React and TypeScript, lifting conversion 12% for the main e-commerce product',
      kind: 'bullet',
    },
    {
      id: 'sample-change-2',
      lineIndex: 14,
      original: '- Built internal dashboards for tracking team metrics',
      tailored:
        '- Built real-time internal dashboards with React and PostgreSQL, cutting weekly reporting time by 6 hours',
      kind: 'bullet',
    },
    {
      id: 'sample-change-3',
      lineIndex: 15,
      original: '- Helped migrate legacy services to a modern cloud platform',
      tailored:
        '- Led migration of 14 legacy services to AWS with Docker, reducing infrastructure costs by 30%',
      kind: 'bullet',
    },
    {
      id: 'sample-change-4',
      lineIndex: 21,
      original: '- Made improvements to the public REST API',
      tailored:
        '- Redesigned the public REST API in Node.js, improving p95 latency by 40% for 200+ integration partners',
      kind: 'bullet',
    },
    {
      id: 'sample-change-5',
      lineIndex: 45,
      original: 'Backend: Node.js, Express, PostgreSQL, Redis, REST APIs',
      tailored: 'Backend: REST APIs, Node.js, Express, PostgreSQL, Redis',
      kind: 'skill',
    },
  ],
}
