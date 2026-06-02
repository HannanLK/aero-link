import { z } from 'zod';
import { BaseEventSchema } from '../base.event';

export const RoleNameSchema = z.enum([
  'CUSTOMER',
  'FLIGHT_ATTENDANT',
  'GATE_AGENT',
  'IMMIGRATION_OFFICER',
  'AIRLINE_ADMIN',
  'AIRCRAFT_CREW',
]);
export type RoleName = z.infer<typeof RoleNameSchema>;

// ─── user.registered ──────────────────────────────────────────────────────────

export const UserRegisteredEventSchema = BaseEventSchema.extend({
  eventType: z.literal('aerolink.user.registered'),
  userId: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(RoleNameSchema),
  registeredAt: z.string().datetime(),
});
export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;
