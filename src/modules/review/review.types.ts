import { Platform } from '@prisma/client';

export type ReviewAction = 'APPROVE' | 'REJECT' | 'REGENERATE' | 'EDIT';
export interface ReviewCallback {
  action: ReviewAction;
  platform: Platform;
  publicationRequestId: string;
  draftId: string;
}

export function parseReviewCallback(data?: string): ReviewCallback | null {
  const [namespace, action, platform, publicationRequestId, draftId, extra] =
    data?.split('|') ?? [];
  const actions: Record<string, ReviewAction> = {
    A: 'APPROVE',
    R: 'REJECT',
    G: 'REGENERATE',
    E: 'EDIT',
  };
  const platforms: Record<string, Platform> = {
    F: Platform.FACEBOOK,
    X: Platform.X,
  };
  if (
    namespace !== 'r' ||
    extra ||
    !publicationRequestId ||
    !draftId ||
    !actions[action] ||
    !platforms[platform]
  )
    return null;
  return {
    action: actions[action],
    platform: platforms[platform],
    publicationRequestId,
    draftId,
  };
}
