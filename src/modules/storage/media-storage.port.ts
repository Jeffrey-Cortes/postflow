export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface StoreMediaInput {
  key: string;
  body: Uint8Array;
  contentType?: string;
}

export interface MediaStorage {
  store(input: StoreMediaInput): Promise<void>;
}
