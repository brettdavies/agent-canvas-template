import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY is not set');
}

export const openai = new OpenAI({ apiKey });

export const CHAT_MODEL = 'gpt-4o-mini';
export const EMBED_MODEL = 'text-embedding-3-small';

export async function chat(prompt: string, model: string = CHAT_MODEL): Promise<string> {
  const res = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content ?? '';
}

export async function embed(input: string, model: string = EMBED_MODEL): Promise<number[]> {
  const res = await openai.embeddings.create({ model, input });
  return res.data[0]?.embedding ?? [];
}
