import { Module } from '@nestjs/common';
import { PillarsResolver } from './pillars.resolver';
import { PillarsService } from './pillars.service';

@Module({
  providers: [PillarsResolver, PillarsService],
})
export class PillarsModule {}
