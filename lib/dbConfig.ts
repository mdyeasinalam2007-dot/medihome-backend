// DATABASE_URL must come from the environment (.env locally, Render env vars in production).
// There is deliberately no fallback: a missing value should fail loudly, not connect somewhere unexpected.
export function dbConfigError(url = process.env.DATABASE_URL): string | null {
  const v = String(url || "").trim();
  if (!v) return "DATABASE_URL is not set. Add it to .env (local) or to the Render environment variables.";
  if (!/^postgres(ql)?:\/\//i.test(v)) return "DATABASE_URL must be a PostgreSQL URL starting with postgresql://";
  return null;
}
