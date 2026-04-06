import bcrypt from "bcrypt";

async function main() {
  const password = "admin123";
  const hash = await bcrypt.hash(password, 10);
  console.log("Hash generado:", hash);
}

main();