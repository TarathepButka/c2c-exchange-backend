import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = Date.now();
    const { method, originalUrl } = req;
    const userAgent = req.get("user-agent") ?? "-";
    const clientIp = this.getClientIp(req);

    res.on("finish", () => {
      const durationMs = Date.now() - startedAt;
      const message = `${method} ${originalUrl} ${res.statusCode} ${durationMs}ms ip=${clientIp} ua="${userAgent}"`;

      if (res.statusCode >= 500) {
        this.logger.error(message);
        return;
      }

      if (res.statusCode >= 400) {
        this.logger.warn(message);
        return;
      }

      this.logger.log(message);
    });

    next();
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers["x-forwarded-for"];

    if (Array.isArray(forwardedFor)) {
      return forwardedFor[0] ?? "unknown";
    }

    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() ?? "unknown";
    }

    return req.ip ?? req.socket.remoteAddress ?? "unknown";
  }
}
