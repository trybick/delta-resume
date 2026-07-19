import type { JobRequirement } from './types';

export const LOCKED_GAP_PLACEHOLDERS: JobRequirement[] = [
  {
    text: 'Experience with distributed systems at scale',
    importance: 'must',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit under your most recent role, alongside the platform work.',
    draftBullet: null,
    insertAfterLine: null,
    locked: true,
  },
  {
    text: 'CI/CD pipelines and automated deployment',
    importance: 'nice',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit in your skills section or under your infrastructure work.',
    draftBullet: null,
    insertAfterLine: null,
    locked: true,
  },
  {
    text: 'Cross-functional collaboration with product and design',
    importance: 'nice',
    satisfiedBy: [],
    satisfiedByChanges: [],
    gapHint: 'Would fit under a recent project where you partnered with other teams.',
    draftBullet: null,
    insertAfterLine: null,
    locked: true,
  },
];
