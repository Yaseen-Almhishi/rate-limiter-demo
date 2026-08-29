import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

export interface RateLimitResult {
  count: number;
  ttlSeconds: number;
}

const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])

if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end

return { count, ttl }
`;

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  onModuleInit() {
    // Test connection
    console.log('Redis status:', this.redisClient.status);
  }

  public async incrementFixedWindow(
    key: string,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const result = (await this.redisClient.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      windowSeconds,
    )) as [number, number];

    return {
      count: Number(result[0]),
      ttlSeconds: Math.max(Number(result[1]), 0),
    };
  }
}
