import type { Role, User } from "../types";
import { db } from "../db";
import { newId } from "./id";
import { hashPassword, verifyPassword } from "./crypto";

const SESSION_KEY = "onsite.session.v1";

export type Session = { userId: string };

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(sess: Session | null): void {
  if (!sess) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}

export async function currentUser(): Promise<User | null> {
  const sess = getSession();
  if (!sess) return null;
  return (await db.users.get(sess.userId)) ?? null;
}

export async function login(email: string, password: string): Promise<User> {
  const u = await db.users.where("email").equals(email.trim().toLowerCase()).first();
  if (!u) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, u.passwordHash);
  if (!ok) throw new Error("Invalid email or password");
  setSession({ userId: u.id });
  return u;
}

export async function register(input: {
  role: Role;
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Invalid email");
  const exists = await db.users.where("email").equals(email).first();
  if (exists) throw new Error("Email already registered");

  const u: User = {
    id: newId("user"),
    role: input.role,
    name: input.name.trim(),
    email,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    tags: input.role === "customer" ? ["residential"] : [],
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  await db.users.add(u);

  if (u.role === "technician") {
    await db.techProfiles.add({
      id: newId("tech"),
      userId: u.id,
      isAvailable: true,
      specialties: ["repair", "maintenance"],
      homeBaseAddress: u.address,
    });
  }

  setSession({ userId: u.id });
  return u;
}

export async function logout() {
  setSession(null);
}

export async function resetAllData() {
  setSession(null);
  await db.delete();
}
