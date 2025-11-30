import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

  onModuleInit() {
    // Test connection
    console.log('Redis status:', this.redisClient.status);
  }

  public async inc(key: string): Promise<number> {
    return await this.redisClient.incr(key);
  }
  public async expire(key: string, seconds: number): Promise<void> {
    await this.redisClient.expire(key, seconds);
  }
}
