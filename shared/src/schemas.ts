import { z } from 'zod';
import {
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  ProjectStatus,
  StylingOption,
  Theme,
} from './enums';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Project name must be at least 3 characters')
    .max(60, 'Project name must be at most 60 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  frontend: z.enum(enumValues(FrontendStack)),
  backend: z.enum(enumValues(BackendStack)),
  database: z.enum(enumValues(DatabaseOption)),
  authentication: z.enum(enumValues(AuthOption)),
  styling: z.enum(enumValues(StylingOption)),
  deployment: z.enum(enumValues(DeploymentOption)),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(enumValues(ProjectStatus)).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(enumValues(ProjectStatus)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(9),
  sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
});

export type ProjectQueryInput = z.infer<typeof projectQuerySchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(50).optional(),
  bio: z.string().trim().max(280, 'Bio must be at most 280 characters').optional(),
  workspace: z.string().trim().min(2).max(50).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateSettingsSchema = z.object({
  theme: z.enum(enumValues(Theme)).optional(),
  notifications: z
    .object({
      productUpdates: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      projectActivity: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
    })
    .partial()
    .optional(),
  security: z
    .object({
      twoFactorEnabled: z.boolean().optional(),
    })
    .partial()
    .optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(80, 'Title must be at most 80 characters'),
});

export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

export const MESSAGE_MAX_LENGTH = 8000;

export const sendMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH).optional(),
    retryMessageId: z
      .string()
      .regex(OBJECT_ID_REGEX, 'Invalid message id')
      .optional(),
  })
  .refine((data) => Boolean(data.content) !== Boolean(data.retryMessageId), {
    message: 'Provide exactly one of "content" or "retryMessageId"',
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messageQuerySchema = z.object({
  cursor: z.string().regex(OBJECT_ID_REGEX, 'Invalid cursor').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;
