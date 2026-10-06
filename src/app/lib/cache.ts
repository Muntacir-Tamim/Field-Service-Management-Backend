import { redisClient } from "./redis";

// Cache never breaks the API: if Redis fails, we just read from the database.
const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await redisClient.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    console.error("Cache read failed:", error);
    return null;
  }
};

const cacheSet = async (key: string, value: unknown, ttlSeconds: number) => {
  try {
    await redisClient.set(key, JSON.stringify(value), {
      expiration: { type: "EX", value: ttlSeconds },
    });
  } catch (error) {
    console.error("Cache write failed:", error);
  }
};

export const cacheGetOrSet = async <T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const fresh = await loader();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
};

export const cacheDeleteByPrefix = async (prefix: string) => {
  try {
    for await (const batch of redisClient.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100,
    })) {
      const keys = Array.isArray(batch) ? batch : [batch];
      if (keys.length) await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Cache delete failed:", error);
  }
};
