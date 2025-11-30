import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { RedisService } from 'src/services/redis-service';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  // Constants for the rate limit (Or fetch these via Reflector/Decorators later)
  private readonly REQUEST_LIMIT = 10; // Max requests
  private readonly WINDOW_SIZE_IN_SECONDS = 60; // Time window

  constructor(
    // Assumes you have a provider for 'REDIS_CLIENT' in your module
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 1. IDENTIFY THE CLIENT
    // Extract IP address or User ID to use as the unique key
    let ip: string =
      request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';

    if (ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    // 2. DEFINE THE REDIS KEY
    // Common pattern: "rate_limit:<algorithm>:<identifier>"
    const key = `rate_limit:fixed:${ip}`;

    // ====================================================
    // Algorithm: Fixed Window Counter
    // ====================================================

    // TODO: Step A - Increment the counter
    const currentCount = await this.redisService.inc(key);
    // TODO: Step B - Handle Expiration (The "Window")
    if (currentCount === 1) {
      await this.redisService.expire(key, this.WINDOW_SIZE_IN_SECONDS);
    }

    // TODO: Step C - Check Limit
    if (currentCount > this.REQUEST_LIMIT) {
      // Optional: Set headers (X-RateLimit-Retry-After)
      const remaining = this.REQUEST_LIMIT - currentCount;
      response.setHeader(
        'X-RateLimit-Remaining',
        remaining < 0 ? 0 : remaining,
      );

      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    response.setHeader('X-RateLimit-Limit', this.REQUEST_LIMIT);
    response.setHeader(
      'X-RateLimit-Remaining',
      this.REQUEST_LIMIT - currentCount,
    );

    return true;
  }
}
