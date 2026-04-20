import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";

const googleClientId =
  process.env.AUTH_GOOGLE_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_ID ||
  "";
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.GOOGLE_SECRET ||
  "";
const googleHostedDomain =
  process.env.AUTH_GOOGLE_HD?.trim() ||
  process.env.GOOGLE_HD?.trim() ||
  undefined;

const appleClientId =
  process.env.AUTH_APPLE_ID || process.env.APPLE_CLIENT_ID || process.env.APPLE_ID || "";
const appleClientSecret =
  process.env.AUTH_APPLE_SECRET || process.env.APPLE_CLIENT_SECRET || process.env.APPLE_SECRET || "";

const hasGoogleProvider = Boolean(googleClientId && googleClientSecret);
const hasAppleProvider = Boolean(appleClientId && appleClientSecret);

const providers = [];

if (hasGoogleProvider) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          ...(googleHostedDomain ? { hd: googleHostedDomain } : {}),
        },
      },
    }),
  );
}

if (hasAppleProvider) {
  providers.push(
    Apple({
      clientId: appleClientId,
      clientSecret: appleClientSecret,
    }),
  );
}

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "clisonix-dev-auth-secret-change-me"
    : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  providers,
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id =
          (token.sub as string | undefined) ||
          (token.email as string | undefined) ||
          "";
      }
      return session;
    },
  },
});
