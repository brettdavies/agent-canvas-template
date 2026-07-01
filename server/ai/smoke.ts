import { CHAT_MODEL, chat, EMBED_MODEL, embed } from './openai';

const result: Record<string, unknown> = {};

try {
  const reply = await chat('Reply with exactly one word: pong');
  result.chat = { model: CHAT_MODEL, reply: reply.trim() };
} catch (err) {
  result.chat = { model: CHAT_MODEL, error: (err as Error).message };
}

try {
  const vector = await embed('hello world');
  result.embed = { model: EMBED_MODEL, dimensions: vector.length, sample: vector.slice(0, 3) };
} catch (err) {
  result.embed = { model: EMBED_MODEL, error: (err as Error).message };
}

console.log(JSON.stringify(result, null, 2));
