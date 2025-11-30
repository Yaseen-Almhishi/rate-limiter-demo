import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { RateLimiterGuard } from './guards/RateLimiterGuard';

@Controller('/dashboard')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(RateLimiterGuard)
  getHello(): string {
    return this.appService.getWelcome();
  }
}
