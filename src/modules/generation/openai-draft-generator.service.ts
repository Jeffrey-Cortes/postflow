import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import OpenAI from 'openai';
import { resolveImageMimeType } from '../telegram/telegram-image-mime';
import {
  BatchDraftGenerationInput,
  DraftGenerationInput,
  DraftGenerator,
  GeneratedDraft,
} from './draft-generator.port';

@Injectable()
export class OpenAiDraftGeneratorService implements DraftGenerator {
  private readonly logger = new Logger(OpenAiDraftGeneratorService.name);
  constructor(private readonly config: ConfigService) {}

  async generate(input: DraftGenerationInput): Promise<GeneratedDraft> {
    const drafts = await this.generateBatch({
      platforms: [input.platform],
      sourceText: input.sourceText,
      referencesByPlatform: { [input.platform]: input.references },
      availableImageFileIds: input.availableImageFileIds,
      mediaSelectionMode: input.mediaSelectionMode,
    });
    const draft = drafts[input.platform];
    if (!draft) throw new Error(`OpenAI returned no ${input.platform} draft`);
    return draft;
  }

  async generateBatch(
    input: BatchDraftGenerationInput,
  ): Promise<Partial<Record<Platform, GeneratedDraft>>> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new Error('OPENAI_API_KEY is required for real generation');
    const images = await this.loadTelegramImages(input.availableImageFileIds);
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.6-luna',
      instructions: this.instructionsFor(
        input.platforms,
        input.mediaSelectionMode === 'MANUAL_VIDEO_SELECTION',
      ),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: this.promptFor(input, images.fileIds),
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
          schema: this.schema(images.fileIds, input.platforms),
        },
      },
    });
    const parsed = JSON.parse(response.output_text) as BatchOpenAiResponse;
    const selectedImageFileIds = parsed.selectedImageFileIds.filter((id) =>
      input.availableImageFileIds.includes(id),
    );
    return Object.fromEntries(
      input.platforms.flatMap((platform) => {
        const value = parsed.drafts?.[platform];
        if (!value) return [];
        const segments = this.normalizedSegments(value.segments, value.content);
        return [
          [
            platform,
            {
              content: segments.join('\n\n'),
              segments,
              selectedImageFileIds,
              selectionReason: parsed.selectionReason,
            },
          ],
        ];
      }),
    );
  }

  private instructionsFor(platforms: string[], hasVideo: boolean): string {
    const platformInstructions = platforms
      .map((platform) =>
        platform === 'X'
          ? 'For X, return one segment when the message fits naturally. Otherwise return a coherent thread of at most five segments. Every segment must be at most 280 Unicode characters, must stand as a complete thought, and must not include artificial numbering such as 1/3.'
          : 'For Facebook, return exactly one segment.',
      )
      .join(' ');
    const mediaInstruction = hasVideo
      ? 'A video is present, so do not select any media; a human must choose it.'
      : 'Select images only from the supplied images and only when visually appropriate.';
    return `Write institutional Spanish social media drafts. Never invent names, dates, places, titles, URLs, or facts. Use only source material. Historical posts are style reference only; never copy them verbatim. Keep every platform draft factually consistent with the others while adapting its style. ${platformInstructions} ${mediaInstruction} Return JSON matching the schema.`;
  }

  private promptFor(
    input: BatchDraftGenerationInput,
    imageIds: string[],
  ): string {
    const references = input.platforms
      .map(
        (platform) =>
          `${platform} style references:\n${(input.referencesByPlatform[platform] ?? []).map((reference) => `- ${reference.text}`).join('\n') || '(none)'}`,
      )
      .join('\n\n');
    return `Target platforms: ${input.platforms.join(', ')}\nSource material:\n${input.sourceText}\n\n${references}\n\nMedia selection mode: ${input.mediaSelectionMode}\nImage IDs supplied in the same order as the images: ${imageIds.join(', ') || '(none)'}`;
  }

  private normalizedSegments(segments: unknown, fallback: unknown): string[] {
    const values = Array.isArray(segments) ? segments : [fallback];
    const normalized = values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
    if (normalized.length === 0)
      throw new Error('OpenAI returned no draft segments');
    return normalized;
  }

  private schema(
    imageIds: string[],
    platforms: string[],
  ): Record<string, unknown> {
    const imageItem =
      imageIds.length > 0
        ? { type: 'string', enum: imageIds }
        : { type: 'string' };
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        drafts: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            platforms.map((platform) => [
              platform,
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  segments: {
                    type: 'array',
                    minItems: 1,
                    maxItems: platform === 'X' ? 5 : 1,
                    items: { type: 'string' },
                  },
                },
                required: ['segments'],
              },
            ]),
          ),
          required: platforms,
        },
        selectedImageFileIds: {
          type: 'array',
          items: imageItem,
          maxItems: Math.min(4, imageIds.length),
        },
        selectionReason: { type: 'string' },
      },
      required: ['drafts', 'selectedImageFileIds', 'selectionReason'],
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
      const mimeType = resolveImageMimeType(
        bytes,
        fileResponse.headers.get('content-type') ?? undefined,
      );
      if (!mimeType) throw new Error('Telegram returned an unsupported image');
      return {
        fileId,
        type: 'input_image',
        image_url: `data:${mimeType};base64,${bytes.toString('base64')}`,
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

interface BatchOpenAiResponse {
  drafts?: Partial<Record<string, { segments?: unknown; content?: unknown }>>;
  selectedImageFileIds: string[];
  selectionReason: string;
}
