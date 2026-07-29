import { z } from 'zod';

export const vocalSchema = z.object({
  accuracy: z.coerce.number().min(0, 'Min 0').max(15, 'Maksimal 15'),
  character: z.coerce.number().min(0, 'Min 0').max(10, 'Maksimal 10'),
  tempo: z.coerce.number().min(0, 'Min 0').max(10, 'Maksimal 10'),
  technique: z.coerce.number().min(0, 'Min 0').max(10, 'Maksimal 10'),
  expression: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
});

export const performanceSchema = z.object({
  performanceExpression: z.coerce.number().min(0, 'Min 0').max(10, 'Maksimal 10'),
  confidence: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  appearance: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  gesture: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  creativity: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
});

export const stagingSchema = z.object({
  interaction: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  communication: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  roomAtmosphere: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
  audienceEngagement: z.coerce.number().min(0, 'Min 0').max(5, 'Maksimal 5'),
});

export const scoreFormSchema = z.object({
  vocal: vocalSchema,
  performance: performanceSchema,
  staging: stagingSchema,
  notes: z.string().optional(),
});

export type ScoreFormValues = z.infer<typeof scoreFormSchema>;
