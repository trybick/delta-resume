import type { CoverLetterResult, JobRequirement, ResumeDocument, TailorResult } from './types';

export const SAMPLE_RESUME = `Jordan Ellis
Senior Software Engineer | jordan.ellis@email.com | (415) 555-0182 | San Francisco, CA
linkedin.com/in/jordanellis | github.com/jordanellis

SUMMARY

Senior software engineer with 8 years of experience building consumer-facing web products
and the platform infrastructure behind them. Comfortable owning features end to end, from
database schema to pixel-level UI polish. Enjoys mentoring and improving developer experience.

SKILLS

Languages: TypeScript, JavaScript, Python, SQL
Frontend: React, Next.js, Redux, HTML/CSS, Vite
Backend: Node.js, Express, PostgreSQL, Redis, REST APIs
Infrastructure: AWS, Docker, Terraform, GitHub Actions, Datadog

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

const SAMPLE_DOCUMENT: ResumeDocument = {
  version: 1,
  header: {
    name: { id: 'h.name', sourceLines: [0] },
    contact: [
      { id: 'h.contact.0', sourceLines: [1] },
      { id: 'h.contact.1', sourceLines: [2] },
    ],
  },
  sections: [
    {
      id: 's.0',
      kind: 'summary',
      heading: { id: 's.0.heading', sourceLines: [4] },
      blocks: [{ kind: 'paragraph', id: 's.0.b.0', sourceLines: [6, 7, 8] }],
    },
    {
      id: 's.1',
      kind: 'skills',
      heading: { id: 's.1.heading', sourceLines: [10] },
      blocks: [
        { kind: 'skillsGroup', id: 's.1.b.0', label: 'Languages', sourceLines: [12] },
        { kind: 'skillsGroup', id: 's.1.b.1', label: 'Frontend', sourceLines: [13] },
        { kind: 'skillsGroup', id: 's.1.b.2', label: 'Backend', sourceLines: [14] },
        { kind: 'skillsGroup', id: 's.1.b.3', label: 'Infrastructure', sourceLines: [15] },
      ],
    },
    {
      id: 's.2',
      kind: 'experience',
      heading: { id: 's.2.heading', sourceLines: [17] },
      blocks: [
        {
          kind: 'entry',
          id: 's.2.b.0',
          title: 'Senior Software Engineer',
          organization: 'Acme Corp',
          location: null,
          dates: { start: '2021', end: 'Present', text: '2021 – Present' },
          headingSourceLines: [19],
          bullets: [
            { id: 's.2.b.0.bullet.0', sourceLines: [20] },
            { id: 's.2.b.0.bullet.1', sourceLines: [21] },
            { id: 's.2.b.0.bullet.2', sourceLines: [22] },
            { id: 's.2.b.0.bullet.3', sourceLines: [23] },
            { id: 's.2.b.0.bullet.4', sourceLines: [24] },
            { id: 's.2.b.0.bullet.5', sourceLines: [25] },
          ],
        },
        {
          kind: 'entry',
          id: 's.2.b.1',
          title: 'Software Engineer',
          organization: 'Globex Inc',
          location: null,
          dates: { start: '2018', end: '2021', text: '2018 – 2021' },
          headingSourceLines: [27],
          bullets: [
            { id: 's.2.b.1.bullet.0', sourceLines: [28] },
            { id: 's.2.b.1.bullet.1', sourceLines: [29] },
            { id: 's.2.b.1.bullet.2', sourceLines: [30] },
            { id: 's.2.b.1.bullet.3', sourceLines: [31] },
            { id: 's.2.b.1.bullet.4', sourceLines: [32] },
          ],
        },
        {
          kind: 'entry',
          id: 's.2.b.2',
          title: 'Software Engineering Intern',
          organization: 'Initech',
          location: null,
          dates: { start: 'Summer 2017', end: null, text: 'Summer 2017' },
          headingSourceLines: [34],
          bullets: [
            { id: 's.2.b.2.bullet.0', sourceLines: [35] },
            { id: 's.2.b.2.bullet.1', sourceLines: [36] },
          ],
        },
      ],
    },
    {
      id: 's.3',
      kind: 'projects',
      heading: { id: 's.3.heading', sourceLines: [38] },
      blocks: [
        { kind: 'paragraph', id: 's.3.b.0', sourceLines: [40] },
        { kind: 'paragraph', id: 's.3.b.1', sourceLines: [41] },
      ],
    },
    {
      id: 's.4',
      kind: 'education',
      heading: { id: 's.4.heading', sourceLines: [43] },
      blocks: [
        {
          kind: 'entry',
          id: 's.4.b.0',
          title: 'B.S. Computer Science',
          organization: 'State University',
          location: null,
          dates: { start: '2018', end: null, text: '2018' },
          headingSourceLines: [45],
          bullets: [],
        },
        { kind: 'paragraph', id: 's.4.b.1', sourceLines: [46] },
      ],
    },
  ],
};

const SAMPLE_REQUIREMENTS: JobRequirement[] = [
  {
    text: 'Expert React and TypeScript development',
    importance: 'must',
    satisfiedBy: ['s.1.b.1', 's.1.b.0'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'Building consumer-facing web products',
    importance: 'must',
    satisfiedBy: ['s.0.b.0', 's.2.b.0.bullet.0'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'Performance and conversion optimization',
    importance: 'must',
    satisfiedBy: [],
    satisfiedByChanges: ['s.2.b.0.bullet.0'],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'REST API design and integration',
    importance: 'must',
    satisfiedBy: ['s.1.b.2', 's.2.b.1.bullet.0'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'GraphQL APIs',
    importance: 'must',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit in your Backend skills line or under your Globex API work.',
    draftBullet:
      '- Designed and shipped GraphQL APIs for [product or service], serving [number] of clients',
    insertAfterId: 's.2.b.1.bullet.0',
    locked: false,
  },
  {
    text: 'Next.js',
    importance: 'nice',
    satisfiedBy: ['s.1.b.1'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'AWS cloud infrastructure',
    importance: 'nice',
    satisfiedBy: ['s.1.b.3', 's.2.b.0.bullet.2'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'Mentoring junior engineers',
    importance: 'nice',
    satisfiedBy: ['s.0.b.0', 's.2.b.0.bullet.3'],
    satisfiedByChanges: [],
    gapHint: null,
    draftBullet: null,
    insertAfterId: null,
    locked: false,
  },
  {
    text: 'Design systems and component libraries',
    importance: 'nice',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit under your Acme Corp role, alongside the checkout work.',
    draftBullet:
      '- Built and maintained a design system of [number] reusable React components adopted by [teams or products]',
    insertAfterId: 's.2.b.0.bullet.0',
    locked: false,
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
      targetId: 's.2.b.0.bullet.0',
      sourceLines: [20],
      original: '- Worked on the checkout flow for the main e-commerce product',
      tailored:
        '- Rebuilt the checkout flow in React and TypeScript, lifting conversion 12% for the main e-commerce product',
      kind: 'bullet',
    },
    {
      id: 'sample-change-2',
      targetId: 's.2.b.0.bullet.1',
      sourceLines: [21],
      original: '- Built internal dashboards for tracking team metrics',
      tailored:
        '- Built real-time internal dashboards with React and PostgreSQL, cutting weekly reporting time by 6 hours',
      kind: 'bullet',
    },
    {
      id: 'sample-change-3',
      targetId: 's.2.b.0.bullet.2',
      sourceLines: [22],
      original: '- Helped migrate legacy services to a modern cloud platform',
      tailored:
        '- Led migration of 14 legacy services to AWS with Docker, reducing infrastructure costs by 30%',
      kind: 'bullet',
    },
    {
      id: 'sample-change-4',
      targetId: 's.2.b.1.bullet.0',
      sourceLines: [28],
      original: '- Made improvements to the public REST API',
      tailored:
        '- Redesigned the public REST API in Node.js, improving p95 latency by 40% for 200+ integration partners',
      kind: 'bullet',
    },
    {
      id: 'sample-change-5',
      targetId: 's.1.b.1',
      sourceLines: [13],
      original: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite',
      tailored: 'Frontend: React, Next.js, Redux, HTML/CSS, Vite, React Native',
      kind: 'skill',
    },
    {
      id: 'sample-change-6',
      targetId: 's.0.b.0',
      sourceLines: [6, 7, 8],
      original:
        'Senior software engineer with 8 years of experience building consumer-facing web products and the platform infrastructure behind them. Comfortable owning features end to end, from database schema to pixel-level UI polish. Enjoys mentoring and improving developer experience.',
      tailored:
        'Senior software engineer with 8 years of experience building fast, consumer-facing web products in React and TypeScript. Comfortable owning features end to end, from database schema to pixel-level UI polish. Enjoys mentoring and improving developer experience.',
      kind: 'paragraph',
    },
  ],
  requirements: SAMPLE_REQUIREMENTS,
  document: SAMPLE_DOCUMENT,
};
