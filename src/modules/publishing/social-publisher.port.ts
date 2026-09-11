import { Platform } from '@prisma/client';

export const SOCIAL_PUBLISHERS = Symbol('SOCIAL_PUBLISHERS');

export interface PublishInput {
  platform: Platform;
  content: string;
  idempotencyKey: string;
}

export interface PublishResult {
  externalPostId: string;
  externalUrl: string;
}
export interface SocialPublisher {
  platform: Platform;
  publish(input: PublishInput): Promise<PublishResult>;
}
