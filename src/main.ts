import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const trustedProxies = process.env.TRUSTED_PROXIES?.split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);

  if (trustedProxies?.length) {
    app.set('trust proxy', trustedProxies);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
