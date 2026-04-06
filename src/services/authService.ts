import prisma from "src/lib/db";
import bcrypt from "bcrypt";

export async function validateUser(username: string, password: string) {
  // Buscar credencial por username
  const credential = await prisma.credential.findUnique({
    where: { username },
    include: { user: true },
  });

  if (!credential) return null;

  const isValid = await bcrypt.compare(password, credential.password_hash);
  return isValid ? credential.user : null;
}