import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { RateLimiterGuard } from './../src/guards/rate-limiter-guard';
import { RedisService } from './../src/services/redis-service';
import { ConfigService } from '@nestjs/config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let count: number;

  beforeEach(async () => {
    count = 0;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        RateLimiterGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: unknown) =>
              ({
                RATE_LIMIT_MAX: 10,
                RATE_LIMIT_WINDOW_SECONDS: 60,
                RATE_LIMIT_FAILURE_MODE: 'closed',
              })[key] ?? fallback,
          },
        },
        {
          provide: RedisService,
          useValue: {
            incrementFixedWindow: () =>
              Promise.resolve({ count: ++count, ttlSeconds: 60 }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows ten requests and rejects the eleventh', async () => {
    for (let requestNumber = 1; requestNumber <= 10; requestNumber += 1) {
      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .expect(200)
        .expect('Welcome to the Dashboard');

      expect(response.headers['ratelimit-limit']).toBe('10');
      expect(response.headers['ratelimit-remaining']).toBe(
        String(10 - requestNumber),
      );
    }

    const blocked = await request(app.getHttpServer())
      .get('/dashboard')
      .expect(429);

    expect(blocked.headers['retry-after']).toBe('60');
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
  });
});
