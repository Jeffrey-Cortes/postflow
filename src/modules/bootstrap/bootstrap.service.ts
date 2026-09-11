import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async seedInitialUser(): Promise<{ organizationId: string; userId: string }> {
    const name = this.required('INITIAL_ORGANIZATION_NAME');
    const slug = this.required('INITIAL_ORGANIZATION_SLUG');
    const telegramUserId = this.required('INITIAL_TELEGRAM_USER_ID');
    const organization = await this.prisma.organization.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    const user = await this.prisma.user.upsert({
      where: { telegramUserId },
      update: {
        organizationId: organization.id,
        displayName: this.config.get<string>('INITIAL_USER_DISPLAY_NAME'),
      },
      create: {
        organizationId: organization.id,
        telegramUserId,
        displayName: this.config.get<string>('INITIAL_USER_DISPLAY_NAME'),
      },
    });
    return { organizationId: organization.id, userId: user.id };
  }

  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new Error(`${name} is required to run the seed command`);
    return value;
  }
}
