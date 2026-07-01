import { cosineDistance, desc, isNotNull, sql } from 'drizzle-orm';
import { embed } from '../ai/openai';
import { db } from '../db/client';
import { statsEmbeddings } from '../db/schema';

export interface DurableHit {
  sourceTable: string | null;
  content: string | null;
  score: number;
}

// Semantic search over the durable stats_embeddings (pgvector, HNSW cosine). Returns
// [] and never throws when embeddings are absent or the DB is unreachable, so the RAG
// pipeline degrades gracefully on a fresh clone with an empty database.
export async function searchDurable(question: string, limit = 5): Promise<DurableHit[]> {
  try {
    const q = await embed(question);
    if (!q.length) return [];
    const score = sql<number>`1 - (${cosineDistance(statsEmbeddings.embedding, q)})`;
    return await db
      .select({ sourceTable: statsEmbeddings.sourceTable, content: statsEmbeddings.content, score })
      .from(statsEmbeddings)
      .where(isNotNull(statsEmbeddings.embedding))
      .orderBy(desc(score))
      .limit(limit);
  } catch {
    return [];
  }
}
