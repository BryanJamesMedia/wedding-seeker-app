import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { pool } from "@/db";
import { sendMagicLinkEmail } from "./email";

function trustedOrigins(): string[] {
  return [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    "http://localhost:3000",
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/+$/, ""));
}

const timestamps = { createdAt: "created_at", updatedAt: "updated_at" };

export const isGoogleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: pool,
  trustedOrigins: trustedOrigins(),
  user: {
    modelName: "users",
    fields: { emailVerified: "email_verified", ...timestamps },
  },
  session: {
    modelName: "sessions",
    fields: { expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent", userId: "user_id", ...timestamps },
  },
  account: {
    modelName: "accounts",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      ...timestamps,
    },
  },
  verification: {
    modelName: "verifications",
    fields: { expiresAt: "expires_at", ...timestamps },
  },
  socialProviders: isGoogleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  rateLimit: { enabled: true, window: 60, max: 30 },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, url }) => {
        if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
          console.log(`[auth] magic link for ${email}: ${url}`);
        }
        await sendMagicLinkEmail(email, url);
      },
    }),
    nextCookies(),
  ],
});
