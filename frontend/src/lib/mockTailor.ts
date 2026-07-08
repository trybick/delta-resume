import type { CoverLetterResult, TailorResult } from './types'

export const SAMPLE_RESUME = `Jordan Ellis
Senior Software Engineer | jordan.ellis@email.com | (415) 555-0182 | San Francisco, CA
linkedin.com/in/jordanellis | github.com/jordanellis

SKILLS

Languages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Redux, HTML/CSS, Vite
Backend: Node.js, Express, PostgreSQL, Redis, REST APIs
Infrastructure: AWS, Docker, Terraform, GitHub Actions, Datadog

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
Graduated with honors; teaching assistant for Intro to Data Structures`

export const SAMPLE_MATCH_SCORE = {
  before: 54,
  after: 86,
}

export const SAMPLE_COVER_LETTER_RESULT: CoverLetterResult = {
  jobTitle: 'Senior Frontend Engineer',
  companyName: 'Acme',
  letter: `Dear Acme Hiring Team,

Your posting for a Senior Frontend Engineer caught my attention because it pairs the product problems I enjoy most with a stack I know deeply. Over the past eight years I have shipped React and TypeScript applications used by hundreds of thousands of people, and I would love to bring that experience to Acme.

In my current role I rebuilt the checkout flow in React and TypeScript, lifting conversion 12% on the company's highest-traffic surface. Getting there meant profiling render bottlenecks, redesigning the state model around optimistic updates, and working closely with design to keep every interaction under 100 milliseconds. It is exactly the kind of user-facing performance work your posting calls out.

I have also carried features well beyond the frontend when the product needed it. I led the migration of 14 legacy services to AWS with Docker, cutting infrastructure costs by 30%, and redesigned a public REST API used by more than 200 integration partners, improving p95 latency by 40%. That end-to-end comfort means I can own a feature from database schema to pixel-level polish without waiting on handoffs.

Beyond shipping, I care about how teams ship. I mentor junior engineers, maintain an open-source kanban library with over 2,000 GitHub stars, and push for the details your team clearly values: accessible components, fast feedback loops, and interfaces that feel effortless.

I would welcome the chance to talk about how I can help Acme ship its next chapter.

Sincerely,
Jordan Ellis`,
}

export const SAMPLE_TAILOR_RESULT: TailorResult = {
  resumeText: SAMPLE_RESUME,
  changes: [
    {
      id: 'sample-change-1',
      lineIndex: 20,
      original: '- Worked on the checkout flow for the main e-commerce product',
      tailored:
        '- Rebuilt the checkout flow in React and TypeScript, lifting conversion 12% for the main e-commerce product',
      kind: 'bullet',
      reason: 'Names React and TypeScript, the two core technologies the job description leads with',
    },
    {
      id: 'sample-change-2',
      lineIndex: 21,
      original: '- Built internal dashboards for tracking team metrics',
      tailored:
        '- Built real-time internal dashboards with React and PostgreSQL, cutting weekly reporting time by 6 hours',
      kind: 'bullet',
      reason: 'Adds a concrete outcome and surfaces PostgreSQL, listed under required experience',
    },
    {
      id: 'sample-change-3',
      lineIndex: 22,
      original: '- Helped migrate legacy services to a modern cloud platform',
      tailored:
        '- Led migration of 14 legacy services to AWS with Docker, reducing infrastructure costs by 30%',
      kind: 'bullet',
      reason: 'The posting mentions AWS and Docker three times across responsibilities and requirements',
    },
    {
      id: 'sample-change-4',
      lineIndex: 28,
      original: '- Made improvements to the public REST API',
      tailored:
        '- Redesigned the public REST API in Node.js, improving p95 latency by 40% for 200+ integration partners',
      kind: 'bullet',
      reason: 'Matches the "performance-minded API design" requirement and quantifies the impact',
    },
    {
      id: 'sample-change-5',
      lineIndex: 7,
      original: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite',
      tailored: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite, React Native',
      kind: 'skill',
      reason: 'React Native is required by the job and evidenced by your SideQuest project',
    },
  ],
  structure: {
    headerLines: [0, 1, 2],
    sections: [
      {
        headingLine: 4,
        items: [
          { kind: 'paragraph', lines: [6] },
          { kind: 'paragraph', lines: [7] },
          { kind: 'paragraph', lines: [8] },
          { kind: 'paragraph', lines: [9] },
        ],
      },
      {
        headingLine: 11,
        items: [{ kind: 'paragraph', lines: [13, 14, 15] }],
      },
      {
        headingLine: 17,
        items: [
          { kind: 'subheading', lines: [19] },
          { kind: 'bullet', lines: [20] },
          { kind: 'bullet', lines: [21] },
          { kind: 'bullet', lines: [22] },
          { kind: 'bullet', lines: [23] },
          { kind: 'bullet', lines: [24] },
          { kind: 'bullet', lines: [25] },
          { kind: 'subheading', lines: [27] },
          { kind: 'bullet', lines: [28] },
          { kind: 'bullet', lines: [29] },
          { kind: 'bullet', lines: [30] },
          { kind: 'bullet', lines: [31] },
          { kind: 'bullet', lines: [32] },
          { kind: 'subheading', lines: [34] },
          { kind: 'bullet', lines: [35] },
          { kind: 'bullet', lines: [36] },
        ],
      },
      {
        headingLine: 38,
        items: [
          { kind: 'paragraph', lines: [40] },
          { kind: 'paragraph', lines: [41] },
        ],
      },
      {
        headingLine: 43,
        items: [
          { kind: 'subheading', lines: [45] },
          { kind: 'paragraph', lines: [46] },
        ],
      },
    ],
  },
}
