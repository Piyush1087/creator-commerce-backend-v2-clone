import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) {
    const authorization = context.switchToHttp().getRequest().headers
      ?.authorization as string | undefined;
    if (!authorization?.trim()) return true;
    return super.canActivate(context);
  }
}
