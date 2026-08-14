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
  DispatchLogisticsDto,
  PostCollaborationMessageDto,
  ReportFulfillmentIssueDto,
  ReviewCollaborationMediaDto,
  SubmitCollaborationMediaDto,
  SubmitLivePostDto,
  UpsertCreatorBankDetailsDto,
  UpsertCreatorShippingAddressDto,
} from "./dto/collaboration-actions.dto";
import { ListCollaborationThreadsQueryDto } from "./dto/collaboration-query.dto";
import { CollaborationCreatorProfileService } from "./services/collaboration-creator-profile.service";
import { CollaborationExceptionService } from "./services/collaboration-exception.service";
import { CollaborationFulfillmentService } from "./services/collaboration-fulfillment.service";
import { CollaborationFeedbackService } from "./services/collaboration-feedback.service";
import { CollaborationNegotiationService } from "./services/collaboration-negotiation.service";
import { CollaborationProductionService } from "./services/collaboration-production.service";
import { CollaborationPublishingService } from "./services/collaboration-publishing.service";
import { CollaborationQueryService } from "./services/collaboration-query.service";
import { CollaborationSecurementService } from "./services/collaboration-securement.service";
import { CollaborationService } from "./services/collaboration.service";

@Controller("api/v1/collaboration")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CollaborationController {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly exceptions: CollaborationExceptionService,
    private readonly collaborationQueries: CollaborationQueryService,
    private readonly negotiation: CollaborationNegotiationService,
    private readonly securement: CollaborationSecurementService,
    private readonly fulfillment: CollaborationFulfillmentService,
    private readonly feedback: CollaborationFeedbackService,
    private readonly production: CollaborationProductionService,
    private readonly publishing: CollaborationPublishingService,
    private readonly creatorProfile: CollaborationCreatorProfileService,
  ) {}

  @Get("threads")
  listThreads(
    @Req() req: RequestWithAuthUser,
    @Query() query: ListCollaborationThreadsQueryDto,
  ) {
    return this.collaborationQueries.list(req.user, query);
  }

  @Get("threads/:collaborationId")
  getThread(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
  ) {
    return this.collaborationQueries.detail(req.user, collaborationId);
  }

  @Post("threads/:collaborationId/end-by-brand")
  endCollaborationByBrand(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.exceptions.endByBrand(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/cancel-by-creator")
  cancelCollaborationByCreator(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.exceptions.cancelByCreator(req.user, collaborationId, body);
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

  @Post("threads/:collaborationId/negotiation/accept-proposed-fee")
  acceptProposedFee(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.negotiation.acceptProposedFee(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/negotiation/counter-offer")
  counterOffer(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.negotiation.counterOffer(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/negotiation/accept-counter-offer")
  acceptCounterOffer(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.negotiation.acceptCounterOffer(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/negotiation/decline")
  declineNegotiation(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.negotiation.decline(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/securement/request-escrow-funding")
  requestEscrowFunding(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.securement.requestEscrowFunding(
      req.user,
      collaborationId,
      body,
    );
  }

  @Post("threads/:collaborationId/fulfillment/provide")
  provideFulfillment(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.fulfillment.provide(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/fulfillment/confirm")
  confirmFulfillment(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.fulfillment.confirm(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/fulfillment/report-issue")
  reportCanonicalFulfillmentIssue(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.fulfillment.reportIssue(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/fulfillment/remediate")
  provideFulfillmentRemediation(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.fulfillment.remediate(req.user, collaborationId, body);
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

  @Post("threads/:collaborationId/production/submit-deliverable")
  submitDeliverable(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.production.submit(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/production/approve-deliverable")
  approveDeliverable(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.production.approve(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/production/request-revision")
  requestDeliverableRevision(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.production.requestRevision(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/production/reject-final")
  rejectFinalDeliverable(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.production.rejectFinal(req.user, collaborationId, body);
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

  @Post("threads/:collaborationId/publishing/authorize")
  authorizePublishing(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.authorize(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/publishing/decline")
  declinePublishing(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.decline(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/publishing/evidence")
  submitPublishingEvidence(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.submitEvidence(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/publishing/verify")
  verifyCanonicalPublishing(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.verify(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/publishing/request-correction")
  requestPublishingCorrection(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.requestCorrection(req.user, collaborationId, body);
  }

  @Post("threads/:collaborationId/publishing/corrected-evidence")
  submitCorrectedPublishingEvidence(
    @Req() req: RequestWithAuthUser,
    @Param("collaborationId", ParseUUIDPipe) collaborationId: string,
    @Body() body: unknown,
  ) {
    return this.publishing.submitCorrectedEvidence(
      req.user,
      collaborationId,
      body,
    );
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
    @Body() body: unknown,
  ) {
    return this.feedback.submit(req.user, collaborationId, body);
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
