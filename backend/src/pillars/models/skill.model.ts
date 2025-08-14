import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Skill {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => Int)
  level: number;

  @Field(() => Int)
  xp: number;

  @Field()
  pillarId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
