import { Injectable, BadRequestException } from "@nestjs/common";
import type { AuthUser } from "../auth/types/auth-user";
import {
  PortfolioMutationSchema,
  PortfolioQuerySchema,
} from "./contracts/portfolio.contract";
import { PortfolioRepository } from "./portfolio.repository";
@Injectable()
export class PortfolioService {
  constructor(private readonly repository: PortfolioRepository) {}
  read(user: AuthUser, query: unknown = {}) {
    const parsed = PortfolioQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException({ code: "PORTFOLIO_INVALID_QUERY" });
    return this.repository.read(user, parsed.data);
  }
  mutate(user: AuthUser, input: unknown) {
    const parsed = PortfolioMutationSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: "PORTFOLIO_INVALID_COMMAND",
        issues: parsed.error.issues.map((i) => ({
          path: i.path,
          code: i.code,
        })),
      });
    return this.repository.mutate(user, parsed.data);
  }
}
