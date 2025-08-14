import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Skill } from './skill.model';

@ObjectType()
export class Pillar {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [Skill], { nullable: 'items' })
  skills: Skill[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
