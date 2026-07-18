import type { CoverLetterResult, JobRequirement, TailorResult } from './types';

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
Graduated with honors; teaching assistant for Intro to Data Structures`;

const SAMPLE_REQUIREMENTS: JobRequirement[] = [
  {
    text: 'Expert React and TypeScript development',
    importance: 'must',
    satisfiedBy: [6, 7],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'Building consumer-facing web products',
    importance: 'must',
    satisfiedBy: [13, 20],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'Performance and conversion optimization',
    importance: 'must',
    satisfiedBy: [],
    satisfiedByChanges: [20],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'REST API design and integration',
    importance: 'must',
    satisfiedBy: [8, 28],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'GraphQL APIs',
    importance: 'must',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit in your Backend skills line or under your Globex API work.',
    draftBullet:
      '- Designed and shipped GraphQL APIs for [product or service], serving [number] of clients',
    insertAfterLine: 28,
  },
  {
    text: 'Next.js',
    importance: 'nice',
    satisfiedBy: [7],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'AWS cloud infrastructure',
    importance: 'nice',
    satisfiedBy: [9, 22],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'Mentoring junior engineers',
    importance: 'nice',
    satisfiedBy: [15, 23],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterLine: null,
  },
  {
    text: 'Accessibility (WCAG) standards',
    importance: 'nice',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit under your onboarding redesign bullet at Globex.',
    draftBullet:
      '- Brought [flow or product] up to WCAG [2.1 AA] accessibility standards, validating with [screen readers and audits]',
    insertAfterLine: 29,
  },
  {
    text: 'Design systems and component libraries',
    importance: 'nice',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit under your Acme Corp role, alongside the checkout work.',
    draftBullet:
      '- Built and maintained a design system of [number] reusable React components adopted by [teams or products]',
    insertAfterLine: 20,
  },
];

export const SAMPLE_COVER_LETTER_RESULT: CoverLetterResult = {
  jobTitle: 'Senior Frontend Engineer',
  companyName: 'Acme',
  letter: `Dear Acme Hiring Team,

Your posting for a Senior Frontend Engineer caught my attention because it pairs the product problems I enjoy most with a stack I know deeply. Over the past eight years I have shipped React and TypeScript applications used by hundreds of thousands of people, and I would love to bring that experience to Acme.

In my current role I rebuilt the checkout flow in React and TypeScript, lifting conversion 12% on the company's highest-traffic surface. Getting there meant profiling render bottlenecks, redesigning the state model around optimistic updates, and working closely with design to keep every interaction under 100 milliseconds. It is exactly the kind of user-facing performance work your posting calls out.

I have also carried features well beyond the frontend when the product needed it. I led the migration of 14 legacy services to AWS with Docker, cutting infrastructure costs by 30%, and redesigned a public REST API used by more than 200 integration partners, improving p95 latency by 40%. That end-to-end comfort means I can own a feature from database schema to pixel-level polish without waiting on handoffs.

I would welcome the chance to talk about how I can help Acme ship its next chapter.

Sincerely,
Jordan Ellis`,
};

export const SAMPLE_TAILOR_RESULT: TailorResult = {
  resumeText: SAMPLE_RESUME,
  summary:
    'The role emphasizes React, TypeScript, cloud infrastructure, and performance-minded product development. The suggested changes strengthen those themes with relevant technologies and measurable outcomes already supported by the resume.',
  changes: [
    {
      id: 'sample-change-1',
      lineIndex: 20,
      original: '- Worked on the checkout flow for the main e-commerce product',
      tailored:
        '- Rebuilt the checkout flow in React and TypeScript, lifting conversion 12% for the main e-commerce product',
      kind: 'bullet',
    },
    {
      id: 'sample-change-2',
      lineIndex: 21,
      original: '- Built internal dashboards for tracking team metrics',
      tailored:
        '- Built real-time internal dashboards with React and PostgreSQL, cutting weekly reporting time by 6 hours',
      kind: 'bullet',
    },
    {
      id: 'sample-change-3',
      lineIndex: 22,
      original: '- Helped migrate legacy services to a modern cloud platform',
      tailored:
        '- Led migration of 14 legacy services to AWS with Docker, reducing infrastructure costs by 30%',
      kind: 'bullet',
    },
    {
      id: 'sample-change-4',
      lineIndex: 28,
      original: '- Made improvements to the public REST API',
      tailored:
        '- Redesigned the public REST API in Node.js, improving p95 latency by 40% for 200+ integration partners',
      kind: 'bullet',
    },
    {
      id: 'sample-change-5',
      lineIndex: 7,
      original: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite',
      tailored: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite, React Native',
      kind: 'skill',
    },
  ],
  requirements: SAMPLE_REQUIREMENTS,
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
};
