const LOCAL_ORIGIN = "http://localhost:4242";

export function getApplicationOrigin(): string {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.DOMAIN;
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_URL is required in production");
    return LOCAL_ORIGIN;
  }

  let origin: string;
  try {
    origin = new URL(configured).origin;
  } catch {
    throw new Error("BETTER_AUTH_URL must be a valid application origin");
  }
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production");
  }
  return origin;
}
