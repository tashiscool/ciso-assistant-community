/**
 * IAM command handler.
 *
 * Handles CQRS commands for user management, user-group membership,
 * and role assignments. This module is designed to be imported by
 * command-worker.ts for dispatching iam.* command types.
 */

import type { CommandEnvelope, DomainEventEnvelope } from "../shared/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CommandExecutionResult {
  events: DomainEventEnvelope[];
  finalizeJob: boolean;
  pendingProgress?: number;
}

interface Env {
  APP_D1_MAIN: D1Database;
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readArray(payload: Record<string, unknown>, key: string): unknown[] {
  const value = payload[key];
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Event factory
// ---------------------------------------------------------------------------

function makeEvent(
  eventType: string,
  tenantId: string,
  aggregateId: string,
  payload: Record<string, unknown>
): DomainEventEnvelope {
  return {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    aggregate_id: aggregateId,
    aggregate_version: 1,
    tenant_id: tenantId,
    occurred_at: new Date().toISOString(),
    payload
  };
}

// ---------------------------------------------------------------------------
// Read model projection updater
// ---------------------------------------------------------------------------

async function refreshIamUserDirectoryProjection(
  db: D1Database,
  tenantId: string,
  userId: string,
  now: string
): Promise<void> {
  // Fetch user record
  const user = await db
    .prepare(
      `SELECT id, email, first_name, last_name, is_active, is_superuser,
              date_joined, last_login, folder_id
       FROM iam_users
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`
    )
    .bind(tenantId, userId)
    .first<Record<string, unknown>>();

  if (!user) {
    return;
  }

  // Fetch groups the user belongs to via role assignments
  const groupRows = await db
    .prepare(
      `SELECT g.id, g.name, ra.role
       FROM iam_role_assignments ra
       JOIN iam_user_groups g ON ra.tenant_id = g.tenant_id AND ra.group_id = g.id
       WHERE ra.tenant_id = ? AND ra.user_id = ?`
    )
    .bind(tenantId, userId)
    .all<{ id: string; name: string; role: string }>();

  const groups: { id: string; name: string; role: string }[] = [];
  for (const row of groupRows.results ?? []) {
    groups.push({ id: row.id, name: row.name, role: row.role });
  }

  // Count direct role assignments
  const assignmentCount = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM iam_role_assignments
       WHERE tenant_id = ? AND user_id = ?`
    )
    .bind(tenantId, userId)
    .first<{ cnt: number }>();

  await db
    .prepare(
      `INSERT INTO rm_iam_user_directory (
         tenant_id, user_id, email, first_name, last_name,
         is_active, is_superuser, groups_json, assignment_count,
         folder_id, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, user_id)
       DO UPDATE SET
         email = excluded.email,
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         is_active = excluded.is_active,
         is_superuser = excluded.is_superuser,
         groups_json = excluded.groups_json,
         assignment_count = excluded.assignment_count,
         folder_id = excluded.folder_id,
         updated_at = excluded.updated_at`
    )
    .bind(
      tenantId,
      userId,
      readString(user, "email"),
      readString(user, "first_name"),
      readString(user, "last_name"),
      user.is_active ? 1 : 0,
      user.is_superuser ? 1 : 0,
      JSON.stringify(groups),
      assignmentCount?.cnt ?? 0,
      readString(user, "folder_id"),
      now
    )
    .run();
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

async function handleUserUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const email = readString(payload, "email");
  const firstName = readString(payload, "first_name");
  const lastName = readString(payload, "last_name");
  const isActive = payload.is_active !== false ? 1 : 0;
  const isSuperuser = payload.is_superuser === true ? 1 : 0;
  const dateJoined = readString(payload, "date_joined") || now;
  const lastLogin = readOptionalString(payload, "last_login");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO iam_users (
       tenant_id, id, email, first_name, last_name,
       is_active, is_superuser, date_joined, last_login, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       email = excluded.email,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       is_active = excluded.is_active,
       is_superuser = excluded.is_superuser,
       date_joined = excluded.date_joined,
       last_login = excluded.last_login,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      email,
      firstName,
      lastName,
      isActive,
      isSuperuser,
      dateJoined,
      lastLogin,
      folderId,
      now,
      now
    )
    .run();

  await refreshIamUserDirectoryProjection(env.APP_D1_MAIN, command.tenant_id, id, now);

  return {
    events: [
      makeEvent("IamUserUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        user_id: id,
        email,
        is_active: isActive === 1,
        is_superuser: isSuperuser === 1,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleUserGroupUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const name = readString(payload, "name");
  const description = readString(payload, "description");
  const permissions = readArray(payload, "permissions");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO iam_user_groups (
       tenant_id, id, name, description, permissions_json, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       permissions_json = excluded.permissions_json,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      name,
      description,
      JSON.stringify(permissions),
      folderId,
      now,
      now
    )
    .run();

  return {
    events: [
      makeEvent("IamUserGroupUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        group_id: id,
        name,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

async function handleRoleAssignmentUpsert(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  const now = new Date().toISOString();
  const payload = command.payload ?? {};
  const id = readString(payload, "id") || command.command_id;
  const userId = readString(payload, "user_id");
  const groupId = readString(payload, "group_id");
  const role = readString(payload, "role");
  const folderId = readString(payload, "folder_id");

  await env.APP_D1_MAIN.prepare(
    `INSERT INTO iam_role_assignments (
       tenant_id, id, user_id, group_id, role, folder_id,
       created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, id)
     DO UPDATE SET
       user_id = excluded.user_id,
       group_id = excluded.group_id,
       role = excluded.role,
       folder_id = excluded.folder_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      command.tenant_id,
      id,
      userId,
      groupId,
      role,
      folderId,
      now,
      now
    )
    .run();

  // Refresh the user directory projection for the affected user
  if (userId) {
    await refreshIamUserDirectoryProjection(env.APP_D1_MAIN, command.tenant_id, userId, now);
  }

  return {
    events: [
      makeEvent("IamRoleAssignmentUpserted", command.tenant_id, id, {
        command_id: command.command_id,
        command_type: command.command_type,
        tenant_id: command.tenant_id,
        assignment_id: id,
        user_id: userId,
        group_id: groupId,
        role,
        executed_at: now
      })
    ],
    finalizeJob: true
  };
}

// ---------------------------------------------------------------------------
// Public command dispatcher
// ---------------------------------------------------------------------------

export async function handleIamCommand(
  command: CommandEnvelope,
  env: Env
): Promise<CommandExecutionResult> {
  switch (command.command_type) {
    case "iam.user.upsert":
      return handleUserUpsert(command, env);

    case "iam.user-group.upsert":
      return handleUserGroupUpsert(command, env);

    case "iam.role-assignment.upsert":
      return handleRoleAssignmentUpsert(command, env);

    default:
      throw new Error(`Unsupported IAM command type: ${command.command_type}`);
  }
}
