export interface IEmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isConfigured(): boolean;
}
