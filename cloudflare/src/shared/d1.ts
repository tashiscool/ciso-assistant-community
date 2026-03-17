export async function nowIso(): Promise<string> {
  return new Date().toISOString();
}

export function toJsonString(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export function getStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function getOptionalStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}
