export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIMENSIONS = 512;

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
};

export async function createOpenAIEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text.slice(0, 24_000),
      dimensions: OPENAI_EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as EmbeddingResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== OPENAI_EMBEDDING_DIMENSIONS) {
    throw new Error("OpenAI embeddings response had an unexpected shape");
  }
  return embedding;
}
