import type { JobRequirement } from './types';

export const hasDraftBullet = (
  requirement: JobRequirement,
): requirement is JobRequirement & { draftBullet: string; insertAfterLine: number } =>
  typeof requirement.draftBullet === 'string' &&
  requirement.draftBullet.length > 0 &&
  typeof requirement.insertAfterLine === 'number';
