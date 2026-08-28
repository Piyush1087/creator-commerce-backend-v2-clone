import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandWorkspaceAuthorizationService } from "../brand-centre/brand-workspace-authorization.service";
import {
  CalculateEscrowBreakdownDto,
  ExecuteLockAllocationDto,
  ExecuteTrancheDisbursalDto,
  ListEscrowLedgerQueryDto,
  TopUpIntentDto,
  TransitionStageDto,
  TriggerCancellationRefundDto,
} from "./dto/brand-escrow.dto";
import { BrandEscrowAccessService } from "./services/brand-escrow-access.service";
import { BrandEscrowComputationService } from "./services/brand-escrow-computation.service";
import { BrandEscrowHardenedService } from "./services/brand-escrow-hardened.service";
import { BrandEscrowInterlockService } from "./services/brand-escrow-interlock.service";
import { BrandEscrowService } from "./services/brand-escrow.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller("api/v1/escrow")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandEscrowController {
  constructor(
    private readonly brandAuth: BrandCentreAuthService,
    private readonly workspaceAuth: BrandWorkspaceAuthorizationService,
    private readonly access: BrandEscrowAccessService,
    private readonly escrow: BrandEscrowService,
    private readonly computation: BrandEscrowComputationService,
    private readonly interlock: BrandEscrowInterlockService,
    private readonly hardened: BrandEscrowHardenedService,
  ) {}

  @Post("initialize")
  @HttpCode(HttpStatus.CREATED)
  async initializeVault(@Req() req: RequestWithAuthUser) {
    const { brandProfileId } = await this.workspaceAuth.assertFinancialMutation(
      req.user,
    );
    return this.escrow.initializeSecureVault(brandProfileId);
  }

  @Get("vault")
  async getVault(@Req() req: RequestWithAuthUser) {
    const { brandProfileId } = await this.workspaceAuth.resolveBrandContext(
      req.user,
    );
    return this.escrow.getVault(brandProfileId);
  }

  @Get("ledger")
  async listLedger(
    @Req() req: RequestWithAuthUser,
    @Query() query: ListEscrowLedgerQueryDto,
  ) {
    const { brandProfileId } = await this.workspaceAuth.resolveBrandContext(
      req.user,
    );
    return this.escrow.listLedger(brandProfileId, query.limit ?? 50);
  }

  @Post("topup-intent")
  @HttpCode(HttpStatus.OK)
  async createTopUpIntent(
    @Req() req: RequestWithAuthUser,
    @Body() body: TopUpIntentDto,
  ) {
    const { brandProfileId } = await this.workspaceAuth.assertFinancialMutation(
      req.user,
    );
    return this.escrow.createCardTopUpIntent(
      brandProfileId,
      body.target_allocation,
      body.idempotency_key,
    );
  }

  @Post("calculate-breakdown")
  @HttpCode(HttpStatus.OK)
  async calculateBreakdown(
    @Req() req: RequestWithAuthUser,
    @Body() body: CalculateEscrowBreakdownDto,
  ) {
    const { brandProfileId } = await this.workspaceAuth.resolveBrandContext(
      req.user,
    );
    return this.escrow.calculateBreakdown(brandProfileId, {
      grossCreatorQuote: body.gross_creator_quote,
      currency: body.currency,
      expectedTdsPercentage: body.expected_tds_percentage,
    });
  }
}

@Controller("api/v1/escrow-engine")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandEscrowEngineController {
  constructor(
    private readonly brandAuth: BrandCentreAuthService,
    private readonly access: BrandEscrowAccessService,
    private readonly computation: BrandEscrowComputationService,
  ) {}

  @Post("lock-collaboration-funds")
  @HttpCode(HttpStatus.CREATED)
  async lockFunds(
    @Req() req: RequestWithAuthUser,
    @Body() body: ExecuteLockAllocationDto,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    await this.access.assertCollaborationAccess(
      req.user,
      body.collaboration_id,
      brandProfileId,
    );

    return this.computation.executeStage2Lock({
      collaborationId: body.collaboration_id,
      brandProfileId,
      grossCreatorQuote: body.gross_creator_quote,
      expectedTdsPercentage: body.expected_tds_percentage,
    });
  }

  @Post("disburse-tranche-payout")
  @HttpCode(HttpStatus.OK)
  async disburseTranche(
    @Req() req: RequestWithAuthUser,
    @Body() body: ExecuteTrancheDisbursalDto,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    await this.access.assertCollaborationAccess(
      req.user,
      body.collaboration_id,
      brandProfileId,
    );

    return this.computation.executeTrancheDisbursal({
      collaborationId: body.collaboration_id,
      tranche: body.tranche,
    });
  }
}

@Controller("api/v1/escrow-interlock")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandEscrowInterlockController {
  constructor(
    private readonly brandAuth: BrandCentreAuthService,
    private readonly access: BrandEscrowAccessService,
    private readonly interlock: BrandEscrowInterlockService,
  ) {}

  @Post("transition-stage")
  @HttpCode(HttpStatus.OK)
  async transitionStage(
    @Req() req: RequestWithAuthUser,
    @Body() body: TransitionStageDto,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    await this.access.assertCollaborationAccess(
      req.user,
      body.collaboration_id,
      brandProfileId,
    );

    return this.interlock.transitionCollaborationStage({
      collaborationId: body.collaboration_id,
      targetStage: body.target_stage,
      initiatedByUserId: req.user.id,
    });
  }

  @Post("trigger-rule-refund")
  @HttpCode(HttpStatus.OK)
  async triggerRefund(
    @Req() req: RequestWithAuthUser,
    @Body() body: TriggerCancellationRefundDto,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    await this.access.assertCollaborationAccess(
      req.user,
      body.collaboration_id,
      brandProfileId,
    );

    return this.interlock.executeAutomatedRefund({
      collaborationId: body.collaboration_id,
      reasonCode: body.reason_code,
      diagnosticNotes: body.diagnostic_notes,
    });
  }
}

@Controller("api/v1/hardened-escrow")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandEscrowHardenedController {
  constructor(
    private readonly brandAuth: BrandCentreAuthService,
    private readonly access: BrandEscrowAccessService,
    private readonly hardened: BrandEscrowHardenedService,
  ) {}

  @Post("lock-funds")
  @HttpCode(HttpStatus.OK)
  async lockFundsHardened(
    @Req() req: RequestWithAuthUser,
    @Body() body: ExecuteLockAllocationDto,
    @Headers("x-idempotency-key") idempotencyKeyRaw?: string,
  ) {
    if (!idempotencyKeyRaw) {
      throw new BadRequestException("x-idempotency-key header is required");
    }

    const idempotencyKey = idempotencyKeyRaw.trim().toLowerCase();
    if (!UUID_REGEX.test(idempotencyKey)) {
      throw new BadRequestException("x-idempotency-key must be a valid UUID");
    }

    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    await this.access.assertCollaborationAccess(
      req.user,
      body.collaboration_id,
      brandProfileId,
    );

    return this.hardened.secureCollaborationFundsHardened(
      {
        collaborationId: body.collaboration_id,
        brandProfileId,
        grossCreatorQuote: body.gross_creator_quote,
        expectedTdsPercentage: body.expected_tds_percentage,
      },
      idempotencyKey,
    );
  }
}
