import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  DraftGenerationInput,
  DraftGenerator,
  GeneratedDraft,
} from './draft-generator.port';

@Injectable()
export class OpenAiDraftGeneratorService implements DraftGenerator {
  private readonly logger = new Logger(OpenAiDraftGeneratorService.name);
  constructor(private readonly config: ConfigService) {}

  async generate(input: DraftGenerationInput): Promise<GeneratedDraft> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new Error('OPENAI_API_KEY is required for real generation');
    const images = await this.loadTelegramImages(input.availableImageFileIds);
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna',
      instructions:
        'Write an institutional Spanish social media draft. Never invent names, dates, places, titles, URLs, or facts. Use only source material. Historical posts are style reference only; never copy them verbatim. Select images only from the supplied images and only when visually appropriate. Return JSON matching the schema.',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Platform: ${input.platform}\nSource material:\n${input.sourceText}\n\nStyle references:\n${input.references.map((reference) => `- ${reference.text}`).join('\n') || '(none)'}\n\nImage IDs supplied in the same order as the images: ${images.fileIds.join(', ') || '(none)'}`,
            },
            ...images.content,
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'social_draft',
          strict: true,
          schema: this.schema(images.fileIds),
        },
      },
    });
    const parsed = JSON.parse(response.output_text) as GeneratedDraft;
    return {
      content: parsed.content,
      selectedImageFileIds: parsed.selectedImageFileIds.filter((id) =>
        input.availableImageFileIds.includes(id),
      ),
      selectionReason: parsed.selectionReason,
    };
  }

  private schema(imageIds: string[]): Record<string, unknown> {
    const imageItem =
      imageIds.length > 0
        ? { type: 'string', enum: imageIds }
        : { type: 'string' };
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        selectedImageFileIds: {
          type: 'array',
          items: imageItem,
          maxItems: Math.min(4, imageIds.length),
        },
        selectionReason: { type: 'string' },
      },
      required: ['content', 'selectedImageFileIds', 'selectionReason'],
    };
  }

  private async loadTelegramImages(fileIds: string[]): Promise<{
    fileIds: string[];
    content: OpenAiImageContent[];
  }> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token || fileIds.length === 0) return { fileIds: [], content: [] };
    const images = await Promise.all(
      fileIds
        .slice(0, 4)
        .map((fileId) => this.downloadTelegramImage(token, fileId)),
    );
    const usableImages = images.filter(
      (image): image is TelegramImageInput => image !== null,
    );
    return {
      fileIds: usableImages.map((image) => image.fileId),
      content: usableImages.map((image) => ({
        type: image.type,
        image_url: image.image_url,
        detail: image.detail,
      })),
    };
  }

  private async downloadTelegramImage(
    token: string,
    fileId: string,
  ): Promise<TelegramImageInput | null> {
    try {
      const metadataResponse = await fetch(
        `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const metadata = (await metadataResponse.json()) as {
        ok?: boolean;
        result?: { file_path?: string };
      };
      if (!metadata.ok || !metadata.result?.file_path)
        throw new Error('Telegram did not provide a file path');
      const fileResponse = await fetch(
        `https://api.telegram.org/file/bot${token}/${metadata.result.file_path}`,
        { signal: AbortSignal.timeout(20_000) },
      );
      if (!fileResponse.ok)
        throw new Error(
          `Telegram file download failed with HTTP ${fileResponse.status}`,
        );
      const bytes = Buffer.from(await fileResponse.arrayBuffer());
      return {
        fileId,
        type: 'input_image',
        image_url: `data:${fileResponse.headers.get('content-type') ?? 'image/jpeg'};base64,${bytes.toString('base64')}`,
        detail: 'low',
      };
    } catch (error) {
      this.logger.warn(
        `Unable to load Telegram image ${fileId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }
}

interface TelegramImageInput extends OpenAiImageContent {
  fileId: string;
}

interface OpenAiImageContent {
  type: 'input_image';
  image_url: string;
  detail: 'low';
}
