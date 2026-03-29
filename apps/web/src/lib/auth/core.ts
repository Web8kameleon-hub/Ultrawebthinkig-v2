import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const hasGoogleProvider = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const authBaseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  ...(authBaseUrl
    ? {
        redirectProxyUrl: `${authBaseUrl.replace(/\/$/, "")}/api/auth`,
      }
    : {}),
  providers: hasGoogleProvider
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
      ]
    : [],
  pages: {
    signIn: "/sign-in",
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
