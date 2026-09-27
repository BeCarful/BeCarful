"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { User } from "@/models/User";

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(60),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

const LoginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

const fieldsOf = (fd: FormData) => ({ name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") });

export async function signup(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: fieldsOf(fd) };
  await connectDB();
  if (await User.exists({ email: parsed.data.email })) {
    return { error: "That email already has an account. Try logging in.", fields: fieldsOf(fd) };
  }
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
  });
  await createSession(user._id.toString());
  redirect("/vehicles/new");
}

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: fieldsOf(fd) };
  await connectDB();
  const user = await User.findOne({ email: parsed.data.email }).select("+passwordHash");
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email or password is incorrect.", fields: fieldsOf(fd) };
  }
  await createSession(user._id.toString());
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
