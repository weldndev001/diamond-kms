import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email dan password diperlukan");
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              user_groups: {
                where: { is_primary: true },
                include: { group: true }
              }
            }
          });

          if (!user || !user.password_hash) {
            console.warn(`[AUTH] Login failed: User ${credentials?.email} not found or no password hash`);
            throw new Error("Email atau password salah");
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password_hash
          );

          if (!isPasswordValid) {
            console.warn(`[AUTH] Login failed: Invalid password for ${credentials?.email}`);
            throw new Error("Email atau password salah");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.user_groups[0]?.role,
            organizationId: user.organization_id,
            groupId: user.user_groups[0]?.group_id
          };
        } catch (error: any) {
          console.error("[AUTH] Authorize Error:", error.message);
          // Re-throw meaningful errors or return null
          if (error.message.includes("Connection terminated unexpectedly")) {
             throw new Error("Database connection error. Please try again later.");
          }
          throw error;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.groupId = user.groupId;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
        session.user.groupId = token.groupId;
      }
      return session;
    }
  }
}
