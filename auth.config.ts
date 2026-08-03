import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    // NextAuth v5's `auth` export only redirects unauthenticated requests when
    // used as middleware if `authorized` is defined here: bare
    // `export { auth as middleware }` does NOT redirect on its own (see
    // node_modules/next-auth/lib/index.d.ts callbacks.authorized docs).
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
