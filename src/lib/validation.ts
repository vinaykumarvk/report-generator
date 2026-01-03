/**
 * API Input Validation Schemas
 * 
 * Centralized Zod schemas for validating API inputs.
 * Prevents SQL injection, XSS, and data corruption.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const workspaceIdSchema = z.string().uuid('Invalid workspace ID');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// ============================================================================
// REPORT RUNS
// ============================================================================

export const createRunSchema = z.object({
  templateId: uuidSchema,
  inputJson: z.object({
    topic: z.string().min(1, 'Topic is required').max(500, 'Topic must be less than 500 characters'),
    sourceOverrides: z.record(z.object({
      vectorStoreIds: z.array(z.string()).optional(),
      fileIds: z.array(z.string()).optional(),
      webSearchEnabled: z.boolean().optional(),
    })).optional(),
  }).passthrough(), // Allow additional properties
});

export const updateRunSchema = z.object({
  status: z.enum(['DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  inputJson: z.record(z.unknown()).optional(),
  contextJson: z.record(z.unknown()).optional(),
}).strict();

export const runFilterSchema = z.object({
  status: z.enum(['DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  templateId: uuidSchema.optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'completed_at']).default('created_at'),
  sortOrder: sortOrderSchema,
}).merge(paginationSchema);

// ============================================================================
// EXPORTS
// ============================================================================

export const exportFormatSchema = z.enum(['MARKDOWN', 'PDF']);

export const createExportSchema = z.object({
  format: exportFormatSchema,
});

// ============================================================================
// TEMPLATES
// ============================================================================

export const templateSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Section title is required').max(200),
  purpose: z.string().max(1000).optional(),
  outputFormat: z.string().max(100).optional(),
  evidencePolicy: z.string().max(100).optional(),
  orderIndex: z.number().int().nonnegative().optional(),
  promptOverride: z.string().max(5000).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(1000).optional(),
  sections: z.array(templateSectionSchema).min(1, 'At least one section is required'),
  vectorStoreIds: z.array(z.string()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  sections: z.array(templateSectionSchema).optional(),
  vectorStoreIds: z.array(z.string()).optional(),
}).strict();

// ============================================================================
// SECTION RUNS
// ============================================================================

export const regenerateSectionSchema = z.object({
  instructions: z.string().max(2000).optional(),
});

// ============================================================================
// VECTOR STORES
// ============================================================================

export const createVectorStoreSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  code: string;
  details: z.ZodIssue[];
  
  constructor(error: { code: string; message: string; details: z.ZodIssue[] }) {
    super(error.message);
    this.name = 'ValidationError';
    this.code = error.code;
    this.details = error.details;
  }
  
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details.map(d => ({
          path: d.path.join('.'),
          message: d.message,
        })),
      },
    };
  }
}

export type ValidationErrorData = {
  code: string;
  message: string;
  details: z.ZodIssue[];
};

/**
 * Validates data against a schema and returns typed result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: ValidationErrorData } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: result.error.errors,
    },
  };
}

/**
 * Express/Next.js middleware for validating request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (data: unknown) => {
    const result = validate(schema, data);
    
    if (!result.success) {
      throw new ValidationError(result.error);
    }
    
    return result.data;
  };
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

/**
 * Sanitizes HTML content to prevent XSS
 * Note: Import DOMPurify separately in client/server contexts
 */
export function sanitizeHtml(html: string): string {
  // This is a placeholder - actual implementation should use DOMPurify
  // For server-side: use isomorphic-dompurify
  // For client-side: use dompurify
  
  // Basic sanitization (replace with DOMPurify in production)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * Sanitizes markdown to prevent injection
 */
export function sanitizeMarkdown(markdown: string): string {
  // Remove potentially dangerous markdown patterns
  return markdown
    .replace(/\[([^\]]+)\]\(javascript:[^\)]+\)/g, '[$1](#)')
    .replace(/<script[^>]*>.*?<\/script>/gis, '');
}

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export const schemas = {
  // Common
  uuid: uuidSchema,
  workspaceId: workspaceIdSchema,
  pagination: paginationSchema,
  sortOrder: sortOrderSchema,
  
  // Report Runs
  createRun: createRunSchema,
  updateRun: updateRunSchema,
  runFilter: runFilterSchema,
  
  // Exports
  exportFormat: exportFormatSchema,
  createExport: createExportSchema,
  
  // Templates
  templateSection: templateSectionSchema,
  createTemplate: createTemplateSchema,
  updateTemplate: updateTemplateSchema,
  
  // Section Runs
  regenerateSection: regenerateSectionSchema,
  
  // Vector Stores
  createVectorStore: createVectorStoreSchema,
};

