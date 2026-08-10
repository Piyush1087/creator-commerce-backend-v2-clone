import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  AcceptCommercialsDto,
  BrandCounterOfferDto,
  DispatchLogisticsDto,
  FundEscrowDto,
  PostCollaborationMessageDto,
  ReportFulfillmentIssueDto,
  ReviewCollaborationMediaDto,
  SubmitCollaborationMediaDto,
  SubmitCollaborationReviewDto,
  SubmitCreatorQuoteDto,
  SubmitLivePostDto,
  UploadReceiptDto,
  UpsertCreatorBankDetailsDto,
  UpsertCreatorShippingAddressDto,
} from "./dto/collaboration-actions.dto";
import { ListCollaborationThreadsQueryDto } from "./dto/collaboration-query.dto";
import { CollaborationCreatorProfileService } from "./services/collaboration-creator-profile.service";
import { CollaborationService } from "./services/collaboration.service";

@Controller("api/v1/collaboration")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CollaborationController {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly creatorProfile: CollaborationCreatorProfileService,
  ) {}

  @Get("threads")
  listThreads(
    @Req() req: RequestWithAuthUser,
    @Query() query: ListCollaborationThreadsQueryDto,
  ) {
    return this.collaboration.listThreads(req.user, query);
  }

  @Get("threads/:collaborationId")
  getThread(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaboration.getThread(req.user, collaborationId);
  }

  @Get("threads/:collaborationId/messages")
  listMessages(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaboration.listMessages(req.user, collaborationId);
  }

  @Post("threads/:collaborationId/messages")
  postMessage(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: PostCollaborationMessageDto,
  ) {
    return this.collaboration.postMessage(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/negotiation/quote")
  submitQuote(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: SubmitCreatorQuoteDto,
  ) {
    return this.collaboration.submitCreatorQuote(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/negotiation/counter-offer")
  counterOffer(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: BrandCounterOfferDto,
  ) {
    return this.collaboration.brandCounterOffer(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/negotiation/accept")
  acceptCommercials(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: AcceptCommercialsDto,
  ) {
    return this.collaboration.acceptCommercials(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/securement/fund-escrow")
  fundEscrow(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: FundEscrowDto,
  ) {
    return this.collaboration.fundEscrow(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/securement/advance-receipt")
  uploadAdvanceReceipt(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: UploadReceiptDto,
  ) {
    return this.collaboration.uploadAdvanceReceipt(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/securement/confirm-manual-advance")
  confirmManualAdvance(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaboration.confirmManualAdvanceReceived(
      req.user,
      collaborationId,
    );
  }

  @Post("threads/:collaborationId/logistics/dispatch")
  dispatchLogistics(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: DispatchLogisticsDto,
  ) {
    return this.collaboration.dispatchLogistics(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/logistics/confirm-receipt")
  confirmReceipt(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaboration.confirmReceipt(req.user, collaborationId);
  }

  @Post("threads/:collaborationId/logistics/report-issue")
  reportIssue(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: ReportFulfillmentIssueDto,
  ) {
    return this.collaboration.reportFulfillmentIssue(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/production/submit")
  submitMedia(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: SubmitCollaborationMediaDto,
  ) {
    return this.collaboration.submitMedia(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/production/review")
  reviewMedia(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: ReviewCollaborationMediaDto,
  ) {
    return this.collaboration.reviewMedia(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/posting/live-url")
  submitLivePost(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: SubmitLivePostDto,
  ) {
    return this.collaboration.submitLivePost(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/posting/verify-compliance")
  verifyCompliance(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaboration.verifyCompliance(req.user, collaborationId);
  }

  @Post("threads/:collaborationId/feedback/review")
  submitReview(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: SubmitCollaborationReviewDto,
  ) {
    return this.collaboration.submitReview(req.user, collaborationId, body);
  }

  @Get("creator/profile")
  getCreatorProfile(@Req() req: RequestWithAuthUser) {
    return this.creatorProfile.getCreatorProfile(req.user);
  }

  @Post("creator/bank-details")
  upsertBankDetails(
    @Req() req: RequestWithAuthUser,
    @Body() body: UpsertCreatorBankDetailsDto,
  ) {
    return this.creatorProfile.upsertBankDetails(req.user, body);
  }

  @Post("creator/shipping-address")
  upsertShippingAddress(
    @Req() req: RequestWithAuthUser,
    @Body() body: UpsertCreatorShippingAddressDto,
  ) {
    return this.creatorProfile.upsertShippingAddress(req.user, body);
  }
}
