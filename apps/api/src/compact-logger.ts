import { ConsoleLogger } from '@nestjs/common';

export class CompactLogger extends ConsoleLogger {
  protected getTimestamp(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${date} ${hours}.${minutes}.${seconds}`;
  }

  protected formatPid(pid: number): string {
    return `\x1B[37m[Nest] ${pid} \x1B[39m`;
  }
}
