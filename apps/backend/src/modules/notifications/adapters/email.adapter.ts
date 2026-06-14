import { Injectable } from '@nestjs/common';

export interface IEmailAdapter {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

@Injectable()
export class ConsoleEmailAdapter implements IEmailAdapter {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}\n${body}`);
  }
}
