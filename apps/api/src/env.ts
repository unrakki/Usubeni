// Fail at startup instead of on the first request that needs the value.
function required(name: string): string {
  const value = Bun.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env at the repository root and fill it in.`,
    );
  }
  return value;
}

export const env = {
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
};
