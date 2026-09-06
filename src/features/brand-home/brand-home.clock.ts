import { Injectable } from "@nestjs/common";

@Injectable()
export class BrandHomeClock {
  now(): Date {
    return new Date();
  }
}
