import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  const appController = new AppController(new AppService());

  describe('root', () => {
    it('returns the dashboard welcome message', () => {
      expect(appController.getHello()).toBe('Welcome to the Dashboard');
    });
  });
});
