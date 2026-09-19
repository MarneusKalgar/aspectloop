import { z } from 'zod';

const platformDocumentFieldValidationSchema = z
  .object({
    max: z.number().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    min: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    pattern: z.string().min(1).optional(),
    scale: z.number().int().nonnegative().optional(),
  })
  .strict();

const platformDocumentFieldSchema = z
  .object({
    codeListKey: z.string().min(1).optional(),
    id: z.string().min(1),
    inputType: z.enum(['code-list', 'date', 'number', 'text']),
    label: z.string().min(1),
    path: z.string().min(1),
    required: z.boolean().optional(),
    validation: platformDocumentFieldValidationSchema.optional(),
  })
  .strict();

const platformDocumentSectionSchema = z
  .object({
    fields: z.array(platformDocumentFieldSchema).min(1),
    id: z.string().min(1),
    label: z.string().min(1),
    path: z.string().min(1),
    repeatable: z.boolean(),
  })
  .strict();

export const platformDocumentTypeConfigSchema = z
  .object({
    label: z.string().min(1),
    sections: z.array(platformDocumentSectionSchema).min(1),
    type: z.string().min(1),
    version: z.number().int().positive(),
  })
  .strict();

export const platformDocumentTypeResponseSchema = z
  .object({
    documentType: platformDocumentTypeConfigSchema,
  })
  .strict();

export const platformDocumentTypeSummarySchema = platformDocumentTypeConfigSchema.pick({
  label: true,
  type: true,
  version: true,
});

export const platformDocumentTypesResponseSchema = z
  .object({
    documentTypes: z.array(platformDocumentTypeSummarySchema),
  })
  .strict();

export type PlatformDocumentField = z.infer<typeof platformDocumentFieldSchema>;
export type PlatformDocumentFieldValidation = z.infer<typeof platformDocumentFieldValidationSchema>;
export type PlatformDocumentSection = z.infer<typeof platformDocumentSectionSchema>;
export type PlatformDocumentTypeConfig = z.infer<typeof platformDocumentTypeConfigSchema>;
export type PlatformDocumentTypeResponse = z.infer<typeof platformDocumentTypeResponseSchema>;
export type PlatformDocumentTypesResponse = z.infer<typeof platformDocumentTypesResponseSchema>;
export type PlatformDocumentTypeSummary = z.infer<typeof platformDocumentTypeSummarySchema>;
