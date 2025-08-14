import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { PillarsService } from './pillars.service';
import { Pillar } from './models/pillar.model';

@Resolver(() => Pillar)
export class PillarsResolver {
  constructor(private readonly pillarsService: PillarsService) {}

  @Query(() => [Pillar], { name: 'pillars' })
  async findAll() {
    return this.pillarsService.findAll();
  }

  @Query(() => Pillar, { name: 'pillar', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string) {
    return this.pillarsService.findOne(id);
  }
}
