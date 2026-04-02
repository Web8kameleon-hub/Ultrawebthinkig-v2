import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const hasGoogleProvider = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "clisonix-dev-auth-secret-change-me"
    : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
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
