import { prisma } from "./db";

/** Throws unless the id is an active partner account (or null/empty to clear the assignment). */
export async function assertPartner(id?: string | null): Promise<string | null> {
  if (!id) return null;
  const acc = await prisma.ledgerAccount.findUnique({ where: { id } });
  if (!acc || acc.kind !== "partner" || !acc.active) throw new Error("الشريك غير موجود");
  return acc.id;
}
