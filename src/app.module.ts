import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './services/redis-service';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RateLimiterGuard } from './guards/rate-limiter-guard';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
    RateLimiterGuard,
    {
      provide: 'REDIS_CLIENT', // This is the token we will use to inject it
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = Number(config.get('REDIS_PORT', '6379'));

        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('REDIS_PORT must be an integer from 1 to 65535.');
        }

        return new Redis({
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port,
          username: config.get('REDIS_USERNAME') || undefined,
          password: config.get('REDIS_PASSWORD') || undefined,
          tls: config.get('REDIS_TLS', 'false') === 'true' ? {} : undefined,
          maxRetriesPerRequest: 1,
        });
      },
    },
  ],
})
export class AppModule {}
