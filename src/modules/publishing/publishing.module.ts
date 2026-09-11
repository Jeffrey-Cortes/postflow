import { Module } from '@nestjs/common';
import {
  MockFacebookPublisher,
  MockXPublisher,
} from './mock-social-publisher.service';
import { PublicationService } from './publication.service';
import { SOCIAL_PUBLISHERS } from './social-publisher.port';
@Module({
  providers: [
    PublicationService,
    MockFacebookPublisher,
    MockXPublisher,
    {
      provide: SOCIAL_PUBLISHERS,
      useFactory: (facebook: MockFacebookPublisher, x: MockXPublisher) => [
        facebook,
        x,
      ],
      inject: [MockFacebookPublisher, MockXPublisher],
    },
  ],
  exports: [PublicationService],
})
export class PublishingModule {}
