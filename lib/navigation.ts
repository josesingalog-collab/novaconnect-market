/** Reject protocol-relative and external redirect destinations. */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
