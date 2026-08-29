import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { BrandInstagramDeletionService } from "./services/brand-instagram-deletion.service";
import { MetaInstagramDeletionCallbackService } from "./services/meta-instagram-deletion-callback.service";

@Public()
@Controller("api/v1/meta/instagram/data-deletion")
export class MetaInstagramDeletionController {
  constructor(
    private readonly callback: MetaInstagramDeletionCallbackService,
    private readonly deletion: BrandInstagramDeletionService,
  ) {}

  @Post()
  handle(@Body() body: { signed_request?: string }) {
    return this.callback.handle(body.signed_request ?? "");
  }

  @Get("status/:confirmationCode")
  status(@Param("confirmationCode") confirmationCode: string) {
    return this.deletion.status(confirmationCode);
  }
}
