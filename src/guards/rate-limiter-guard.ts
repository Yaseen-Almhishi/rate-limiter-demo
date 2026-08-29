import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../services/redis-service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly requestLimit: number;
  private readonly windowSeconds: number;
  private readonly failureMode: 'open' | 'closed';

  constructor(
    private readonly redisService: RedisService,
    config: ConfigService,
  ) {
    this.requestLimit = this.readPositiveInteger(config, 'RATE_LIMIT_MAX', 10);
    this.windowSeconds = this.readPositiveInteger(
      config,
      'RATE_LIMIT_WINDOW_SECONDS',
      60,
    );
    this.failureMode =
      config.get('RATE_LIMIT_FAILURE_MODE', 'closed') === 'open'
        ? 'open'
        : 'closed';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    let ip = request.ip || request.socket.remoteAddress || 'unknown';

    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    const key = `rate_limit:fixed:${ip}`;

    let count: number;
    let ttlSeconds: number;

    try {
      ({ count, ttlSeconds } = await this.redisService.incrementFixedWindow(
        key,
        this.windowSeconds,
      ));
    } catch (error) {
      this.logger.error(
        'Rate-limit storage is unavailable.',
        error instanceof Error ? error.stack : undefined,
      );

      if (this.failureMode === 'open') {
        response.setHeader('RateLimit-Policy', 'unavailable; mode=open');
        return true;
      }

      throw new HttpException(
        'Rate-limit service unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const remaining = Math.max(this.requestLimit - count, 0);
    const resetAt = Math.ceil(Date.now() / 1000) + ttlSeconds;

    response.setHeader('RateLimit-Limit', this.requestLimit);
    response.setHeader('RateLimit-Remaining', remaining);
    response.setHeader('RateLimit-Reset', resetAt);

    if (count > this.requestLimit) {
      response.setHeader('Retry-After', ttlSeconds);
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private readPositiveInteger(
    config: ConfigService,
    key: string,
    fallback: number,
  ): number {
    const value = Number(config.get(key, fallback));

    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`${key} must be a positive integer.`);
    }

    return value;
  }
}
