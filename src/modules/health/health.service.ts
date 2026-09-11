import { Injectable } from '@nestjs/common';
@Injectable()
export class HealthService {
  getHealth(): { status: 'ok'; service: 'postflow'; environment: string } {
    return {
      status: 'ok',
      service: 'postflow',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
