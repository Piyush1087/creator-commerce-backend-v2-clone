import { Injectable, NotFoundException } from "@nestjs/common";
import { BrandRoutingType } from "@prisma/client";

import { getIndustryRoutingTemplate } from "../config/industry-routing-templates";
import type { IndustryRoutingTemplate } from "../types/routing-template.types";

@Injectable()
export class BrandCentreRoutingService {
  getTemplate(routingType: BrandRoutingType): IndustryRoutingTemplate {
    return getIndustryRoutingTemplate(routingType);
  }

  resolveTemplateForProfile(profile: {
    brandRoutingType: BrandRoutingType;
  }): IndustryRoutingTemplate {
    return getIndustryRoutingTemplate(profile.brandRoutingType);
  }

  requireTemplate(routingType: BrandRoutingType): IndustryRoutingTemplate {
    const template = getIndustryRoutingTemplate(routingType);
    if (!template) {
      throw new NotFoundException(`Routing template not found: ${routingType}`);
    }
    return template;
  }
}
