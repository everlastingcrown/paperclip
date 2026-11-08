import { z } from "zod";
import {
  ENVIRONMENT_DRIVERS,
  ENVIRONMENT_LEASE_CLEANUP_STATUSES,
  ENVIRONMENT_LEASE_STATUSES,
  ENVIRONMENT_STATUSES,
} from "../constants.js";
import { envConfigSchema } from "./secret.js";

export const environmentDriverSchema = z.enum(ENVIRONMENT_DRIVERS);
export const environmentStatusSchema = z.enum(ENVIRONMENT_STATUSES);
export const environmentLeaseStatusSchema = z.enum(ENVIRONMENT_LEASE_STATUSES);
export const environmentLeaseCleanupStatusSchema = z.enum(ENVIRONMENT_LEASE_CLEANUP_STATUSES);

const environmentConfigSchema = z.record(z.string(), z.unknown()).superRefine((config, ctx) => {
  if (config.shellEnvironmentKeys === undefined) return;
  const names = config.shellEnvironmentKeys;
  if (!Array.isArray(names) || names.length > 128 || names.some(name => typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)) || new Set(names).size !== names.length) {
    ctx.addIssue({ code: "custom", path: ["shellEnvironmentKeys"], message: "Expected at most 128 distinct environment variable names" });
  }
});

const environmentFields = {
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  driver: environmentDriverSchema,
  status: environmentStatusSchema.optional().default("active"),
  config: environmentConfigSchema.optional().default({}),
  envVars: envConfigSchema.optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
};

export const createEnvironmentSchema = z.object(environmentFields).strict();
export type CreateEnvironment = z.infer<typeof createEnvironmentSchema>;

export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  driver: environmentDriverSchema.optional(),
  status: environmentStatusSchema.optional(),
  config: environmentConfigSchema.optional(),
  envVars: envConfigSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
}).strict();
export type UpdateEnvironment = z.infer<typeof updateEnvironmentSchema>;

export const probeEnvironmentConfigSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  driver: environmentDriverSchema,
  config: environmentConfigSchema.optional().default({}),
  envVars: envConfigSchema.optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
}).strict();
export type ProbeEnvironmentConfig = z.infer<typeof probeEnvironmentConfigSchema>;
