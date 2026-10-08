import { z } from "zod";

/**
 * Every device adapter (Ring, Bee, Fire TV, Alexa) must normalize its
 * raw events into this shape before the behavior engine ever sees them.
 * The behavior engine never depends on adapter-specific fields.
 */
export const EventSourceSchema = z.enum(["ring", "fire_tv", "alexa", "bee"]);
export type EventSource = z.infer<typeof EventSourceSchema>;

export const NormalizedEventSchema = z.object({
  id: z.string(),
  residentId: z.string(),
  timestamp: z.string().datetime(),
  source: EventSourceSchema,
  type: z.string(), // e.g. "motion", "departure", "inactive", "checkin_response"
  location: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

export const ResidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().positive(),
  timezone: z.string(),
});
export type Resident = z.infer<typeof ResidentSchema>;

export const BaselineSchema = z.object({
  residentId: z.string(),
  usualDepartureWindow: z.tuple([z.string(), z.string()]), // ["18:30","18:50"]
  usualReturnDurationMinutes: z.tuple([z.number(), z.number()]), // [35,50]
  eveningTvUsuallyActive: z.boolean(),
  eveningAlexaUsuallyActive: z.boolean(),
});
export type Baseline = z.infer<typeof BaselineSchema>;

export const DeviationSeveritySchema = z.enum(["low", "medium", "high"]);
export type DeviationSeverity = z.infer<typeof DeviationSeveritySchema>;

export const DeviationExplanationSchema = z.object({
  schedule: z.string().optional(),
  corroboratedBy: z.string().optional(),
});
export type DeviationExplanation = z.infer<typeof DeviationExplanationSchema>;

export const DeviationSchema = z.object({
  residentId: z.string(),
  severity: DeviationSeveritySchema,
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  explainedBy: DeviationExplanationSchema.optional(),
});
export type Deviation = z.infer<typeof DeviationSchema>;

export const CheckInStatusSchema = z.enum([
  "none",
  "pending",
  "successful",
  "unanswered",
  "help_requested",
]);
export type CheckInStatus = z.infer<typeof CheckInStatusSchema>;

export const CheckInChannelSchema = z.enum([
  "alexa_voice",
  "firetv_remote",
  "firetv_voice",
]);
export type CheckInChannel = z.infer<typeof CheckInChannelSchema>;

export const CheckInSchema = z.object({
  residentId: z.string(),
  status: CheckInStatusSchema,
  timestamp: z.string().datetime().optional(),
  response: z.string().optional(),
  via: CheckInChannelSchema.optional(),
  voiceStatus: CheckInStatusSchema.optional(),
  screenStatus: CheckInStatusSchema.optional(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const AgentActionSchema = z.enum([
  "NO_ACTION",
  "REQUEST_CHECKIN",
  "INSPECT_RING",
  "ESCALATE",
  "RENOTIFY",
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const ScheduleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  away: z.boolean(),
  location: z.string().optional(),
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

export const ScheduleContextSchema = z.object({
  residentId: z.string(),
  source: z.literal("mock-calendar"),
  hasConsent: z.boolean(),
  awayNow: z.boolean(),
  currentOrUpcomingEvent: ScheduleItemSchema.optional(),
  items: z.array(ScheduleItemSchema),
});
export type ScheduleContext = z.infer<typeof ScheduleContextSchema>;

export const CaregiverNotificationSchema = z.object({
  incidentId: z.string(),
  urgency: z.enum(["attention", "urgent"]),
  headline: z.string(),
  reasons: z.array(z.string()),
  confidence: z.number(),
  timeline: z.array(
    z.object({
      t: z.string(),
      tool: z.string(),
      summary: z.string(),
    })
  ),
  accessLog: z.array(
    z.object({
      t: z.string(),
      resource: z.literal("ring_snapshot"),
      reason: z.string(),
      mode: z.enum(["mock", "sim", "real"]),
    })
  ),
  recommendedAction: z.literal("call_resident"),
});
export type CaregiverNotification = z.infer<typeof CaregiverNotificationSchema>;
