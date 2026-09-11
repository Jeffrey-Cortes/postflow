import { Platform } from '@prisma/client';

export type ReviewAction = 'APPROVE' | 'REJECT' | 'REGENERATE' | 'EDIT';
export interface ReviewCallback {
  action: ReviewAction;
  platform: Platform;
  publicationRequestId: string;
}

export function parseReviewCallback(data?: string): ReviewCallback | null {
  const [namespace, action, platform, publicationRequestId, extra] =
    data?.split('|') ?? [];
  if (namespace !== 'review' || extra || !publicationRequestId) return null;
  if (!['APPROVE', 'REJECT', 'REGENERATE', 'EDIT'].includes(action))
    return null;
  if (platform !== Platform.FACEBOOK && platform !== Platform.X) return null;
  return { action: action as ReviewAction, platform, publicationRequestId };
}
