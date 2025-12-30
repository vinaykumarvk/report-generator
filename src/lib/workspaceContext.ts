/**
 * Workspace Context Middleware
 * Provides workspace isolation for all API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultWorkspaceId } from "./workspace";

/**
 * Get workspace ID from request
 * Priority: header > query > cookie > default
 */
export async function getWorkspaceIdFromRequest(
  request: NextRequest
): Promise<string> {
  // 1. Check X-Workspace-ID header
  const headerWorkspaceId = request.headers.get("x-workspace-id");
  if (headerWorkspaceId) {
    return headerWorkspaceId;
  }

  // 2. Check query parameter
  const { searchParams } = new URL(request.url);
  const queryWorkspaceId = searchParams.get("workspace_id");
  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  // 3. Check cookie
  const cookieWorkspaceId = request.cookies.get("workspace_id")?.value;
  if (cookieWorkspaceId) {
    return cookieWorkspaceId;
  }

  // 4. Fall back to default workspace
  return await getDefaultWorkspaceId();
}

/**
 * Workspace context for API routes
 * Usage: const workspaceId = await getWorkspaceContext(request);
 */
export async function getWorkspaceContext(
  request: NextRequest
): Promise<{ workspaceId: string }> {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  return { workspaceId };
}

/**
 * Middleware to inject workspace context into request
 * Can be used in middleware.ts for automatic injection
 */
export async function withWorkspaceContext(
  request: NextRequest,
  handler: (
    request: NextRequest,
    context: { workspaceId: string }
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  return handler(request, { workspaceId });
}

/**
 * Helper to add workspace filter to Supabase queries
 * Usage: query.eq(...addWorkspaceFilter(workspaceId))
 */
export function addWorkspaceFilter(workspaceId: string): ["workspace_id", string] {
  return ["workspace_id", workspaceId];
}

/**
 * Validate that a resource belongs to the workspace
 */
export function validateWorkspaceAccess(
  resourceWorkspaceId: string | null,
  requestWorkspaceId: string
): boolean {
  // Allow null workspace_id for backward compatibility (legacy data)
  if (resourceWorkspaceId === null) {
    return true;
  }
  return resourceWorkspaceId === requestWorkspaceId;
}


