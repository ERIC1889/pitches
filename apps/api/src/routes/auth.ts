import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import {
  SignupRequestSchema,
  LoginRequestSchema,
  AppleLoginRequestSchema,
} from "@pitches/shared";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/signup", async (req, reply) => {
    const body = SignupRequestSchema.parse(req.body);
    const existing = await app.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      return reply.code(409).send({ error: "EMAIL_TAKEN" });
    }
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await app.prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash },
    });
    const token = app.jwt.sign({ sub: user.id });
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  });

  app.post("/login", async (req, reply) => {
    const body = LoginRequestSchema.parse(req.body);
    const user = await app.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    const token = app.jwt.sign({ sub: user.id });
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  });

  // TODO: Apple identity token 검증 (apple-signin-auth 등)
  app.post("/apple", async (req, reply) => {
    const body = AppleLoginRequestSchema.parse(req.body);
    return reply.code(501).send({
      error: "NOT_IMPLEMENTED",
      hint: "Apple identity token 검증 로직은 W2에 구현 예정",
      received: { hasToken: Boolean(body.identityToken) },
    });
  });

  app.get("/me", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    const { sub } = req.user as { sub: string };
    const user = await app.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, name: true, locale: true },
    });
    if (!user) return reply.code(404).send({ error: "NOT_FOUND" });
    return user;
  });
};
