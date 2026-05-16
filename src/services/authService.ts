import bcrypt from "bcrypt";
import prisma from "src/lib/db";

/**
 * Busca credencial por nombre de usuario o email del usuario y valida la contraseña.
 */
export async function validateCredentialByUsernameOrEmail(
  usernameOrEmail: string,
  password: string
) {
  const credential = await prisma.credential.findFirst({
    where: {
      OR: [{ username: usernameOrEmail }, { user: { email: usernameOrEmail } }],
    },
    include: { user: true },
  });

  if (!credential?.password_hash) return null;

  const isValid = await bcrypt.compare(password, credential.password_hash);
  return isValid ? credential : null;
}
