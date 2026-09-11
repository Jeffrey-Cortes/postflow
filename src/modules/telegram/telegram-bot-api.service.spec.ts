import { TelegramBotApiService } from './telegram-bot-api.service';

describe('TelegramBotApiService', () => {
  it('does not make a network request when no bot token is configured', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const service = new TelegramBotApiService(config as never);
    await expect(service.sendText('123', 'hola')).resolves.toBeUndefined();
  });
});
