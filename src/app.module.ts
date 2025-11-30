import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './services/redis-service';
import Redis from 'ioredis';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
    {
      provide: 'REDIS_CLIENT', // This is the token we will use to inject it
      useFactory: () => {
        return new Redis({
          host: 'localhost', // or process.env.REDIS_HOST
          port: 6379, // or process.env.REDIS_PORT
        });
      },
    },
  ],
})
export class AppModule {}
