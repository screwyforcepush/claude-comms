/**
 * Password validation helper for all public Convex functions.
 * Validates against ADMIN_PASSWORD environment variable.
 */
export function requirePassword(args: { password?: string }): void {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("Server misconfigured: ADMIN_PASSWORD not set");
  }
  if (!args.password || args.password !== adminPassword) {
    throw new Error("Unauthorized");
  }
}
