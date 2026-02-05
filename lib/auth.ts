import { NextAuthOptions } from "next-auth";
import LinkedInProvider from "next-auth/providers/linkedin";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      // OpenID Connect configuration (required by LinkedIn)
      // w_member_social is required for posting to LinkedIn
      authorization: {
        params: {
          scope: "openid profile email w_member_social",
        },
      },
      issuer: "https://www.linkedin.com/oauth",
      jwks_endpoint: "https://www.linkedin.com/oauth/openid/jwks",
      // Allow linking accounts with same email (safe for LinkedIn as emails are verified)
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          linkedInId: profile.sub,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Get user's account to retrieve access token
      const account = await prisma.account.findFirst({
        where: { userId: user.id },
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
        },
        accessToken: account?.access_token,
        linkedInId: (user as { linkedInId?: string }).linkedInId,
      };
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  cookies: {
    sessionToken: {
      name: "lph.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Set to true only when debugging auth issues (exposes sensitive data in logs)
  debug: false,
};
