import {
  entity,
  role,
  text,
  boolean,
  date,
  uuid,
  int,
} from '@microsoft/rayfin-core';

@entity()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Calculation {
  @uuid() id!: string;
  @text({ min: 1, max: 100 }) name!: string;
  @int() salary!: number;
  @int() smmlv!: number;
  @int() auxTransport!: number;
  @boolean() isIntegral!: boolean;
  @int() arlClass!: number;
  @boolean() isExempt!: boolean;
  @boolean({ optional: true }) isSena?: boolean;
  @text({ optional: true, max: 20 }) senaStage?: string;
  @date() createdAt!: Date;
  @text() user_id!: string;
}
