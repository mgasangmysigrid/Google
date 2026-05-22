import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { supabaseServer } from "@/lib/supabase/server";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Single shared demo credential, configured via env. Gmail authorization
      // is a separate, explicit step (see /api/communications/google/connect),
      // so logging in here grants no access to any Google data.
      async authorize(creds) {
        const email = (creds?.email as string | undefined)?.trim().toLowerCase();
        const password = creds?.password as string | undefined;
        const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
        const demoPassword = process.env.DEMO_PASSWORD;
        if (!email || !password || !demoEmail || !demoPassword) return null;
        if (email !== demoEmail || password !== demoPassword) return null;

        // Upsert the user so Gmail tokens and tasks can key off a stable id.
        await supabaseServer()
          .from("users")
          .upsert(
            { id: email, email, first_name: "MySigrid", last_name: "Demo" },
            { onConflict: "id" },
          );
        return { id: email, email, name: "MySigrid Demo" };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
