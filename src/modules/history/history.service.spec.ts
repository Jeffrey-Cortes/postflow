import { Platform } from '@prisma/client';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  it('creates a stable external ID for imported rows without one', async () => {
    const calls: Array<{ data: Array<{ externalId: string }> }> = [];
    const createMany = jest.fn(
      (input: { data: Array<{ externalId: string }> }) => {
        calls.push(input);
        return Promise.resolve({ count: 1 });
      },
    );
    const service = new HistoryService({
      historicalPost: { createMany },
    } as never);
    const row = { platform: Platform.X, text: 'Texto histórico' };

    await service.importRows('organization-1', [row]);
    await service.importRows('organization-1', [row]);

    const firstExternalId = calls[0]?.data[0]?.externalId;
    const secondExternalId = calls[1]?.data[0]?.externalId;
    expect(firstExternalId).toBe(secondExternalId);
    expect(firstExternalId).toMatch(/^postflow:[a-f0-9]{64}$/);
  });
});
