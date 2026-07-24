import type { JobRequirement } from './types';

export const hasDraftBullet = (
  requirement: JobRequirement,
): requirement is JobRequirement & { draftBullet: string; insertAfterId: string } =>
  typeof requirement.draftBullet === 'string' &&
  requirement.draftBullet.length > 0 &&
  typeof requirement.insertAfterId === 'string' &&
  requirement.insertAfterId.length > 0;
