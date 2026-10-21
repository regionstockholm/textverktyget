import type { User } from "../generated/prisma/client.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { hashPassword, verifyPassword } from "./password.js";

export function toSafeUser(user: User) {
  return { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() };
}

export async function findUserById(id: number): Promise<User | null> {
  return getPrismaClient().user.findUnique({ where: { id } });
}

export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const user = await getPrismaClient().user.findUnique({ where: { username } });
  // Equal-cost verification also for unknown usernames.
  const hash = user?.passwordHash ?? await (dummyPasswordHash ??= hashPassword("not-an-account-password"));
  const valid = await verifyPassword(password, hash);
  return user && valid ? user : null;
}

let dummyPasswordHash: Promise<string> | undefined;

export async function createUser(username: string, password: string): Promise<User> {
  return getPrismaClient().user.create({
    data: { username, passwordHash: await hashPassword(password) },
  });
}

export async function listUsers(): Promise<User[]> {
  return getPrismaClient().user.findMany({ orderBy: { username: "asc" } });
}

export async function deleteUser(id: number): Promise<boolean> {
  const result = await getPrismaClient().user.deleteMany({ where: { id } });
  return result.count > 0;
}
