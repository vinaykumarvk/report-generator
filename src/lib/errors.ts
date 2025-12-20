export type ErrorMetadata = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly metadata?: ErrorMetadata;
  public readonly isOperational: boolean;

  constructor(message: string, code = 'INTERNAL_ERROR', status = 500, metadata?: ErrorMetadata) {
    super(message);
    this.code = code;
    this.status = status;
    this.metadata = metadata;
    this.isOperational = true;
  }
}

export function toAppError(error: unknown, fallbackCode = 'INTERNAL_ERROR'): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    return new AppError(error.message, fallbackCode);
  }

  return new AppError('Unknown error', fallbackCode);
}

export function assertCondition(condition: unknown, message: string, code = 'INVALID_STATE') {
  if (!condition) {
    throw new AppError(message, code, 400);
  }
}
