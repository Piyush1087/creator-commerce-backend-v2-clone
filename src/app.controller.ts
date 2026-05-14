import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: "TheCreatorShop API",
      status: "ready",
    };
  }
}
