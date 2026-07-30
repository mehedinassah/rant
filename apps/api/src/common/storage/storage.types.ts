export interface StorageProvider {
  readonly name: string;
  put(key: string, bytes: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
  /** A time-limited URL for direct download, or null when bytes are streamed
   * through the API (the DB provider). */
  signedUrl(key: string, filename?: string): Promise<string | null>;
}
