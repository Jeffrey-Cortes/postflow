import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Platform } from '@prisma/client';
import {
  PublishInput,
  PublishResult,
  SocialPublisher,
} from './social-publisher.port';

@Injectable()
export class MockFacebookPublisher implements SocialPublisher {
  readonly platform = Platform.FACEBOOK;
  publish(input: PublishInput): Promise<PublishResult> {
    return Promise.resolve(mockResult('facebook', input));
  }
}

@Injectable()
export class MockXPublisher implements SocialPublisher {
  readonly platform = Platform.X;
  publish(input: PublishInput): Promise<PublishResult> {
    return Promise.resolve(mockResult('x', input));
  }
}

function mockResult(network: string, input: PublishInput): PublishResult {
  const suffix = createHash('sha256')
    .update(input.idempotencyKey)
    .digest('hex')
    .slice(0, 16);
  return {
    externalPostId: `mock-${network}-${suffix}`,
    externalUrl: `https://mock.${network}.local/posts/${suffix}`,
    simulated: true,
  };
}
