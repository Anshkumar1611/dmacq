import type { Request, Response, NextFunction } from "express";

const HEADER = "x-tenant-id";
const TENANT_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const raw = req.header(HEADER);
  if (!raw || !raw.trim()) {
    res.status(400).json({ error: `Missing or empty ${HEADER} header` });
    return;
  }
  const tenantId = raw.trim();
  if (!TENANT_RE.test(tenantId)) {
    res.status(400).json({
      error: `${HEADER} must be 1-64 chars and contain only letters, numbers, _ or -`,
    });
    return;
  }
  req.tenantId = tenantId;
  next();
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}
