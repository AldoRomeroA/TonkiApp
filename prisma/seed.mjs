import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const TEST_LOGIN_USERS = [
  {
    username: "testuser",
    password: "User12345",
    wallet_address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    name: "Test User",
    type: "user",
  },
  {
    username: "testadmin",
    password: "Admin12345",
    wallet_address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRD",
    name: "Test Admin",
    type: "admin",
  },
];

async function main() {
  for (const testUser of TEST_LOGIN_USERS) {
    let user = await prisma.user.findFirst({
      where: { wallet_address: testUser.wallet_address },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: testUser.name,
          wallet_address: testUser.wallet_address,
          type: testUser.type,
          status: "active",
        },
      });
    }

    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await prisma.credential.upsert({
      where: { username: testUser.username },
      update: {
        user_id: user.user_id,
        password_hash: passwordHash,
      },
      create: {
        user_id: user.user_id,
        username: testUser.username,
        password_hash: passwordHash,
      },
    });
  }

  const adminCred = await prisma.credential.findUnique({
    where: { username: "testadmin" },
    include: { user: true },
  });
  if (adminCred?.user) {
    const adminId = adminCred.user.user_id;
    const existing = await prisma.post.count({ where: { author_id: adminId } });
    if (existing === 0) {
      await prisma.post.create({
        data: {
          author_id: adminId,
          title: "Welcome to the feed",
          body: "Seed post for local development. Uploads API can attach files later.",
        },
      });
      await prisma.post.create({
        data: {
          author_id: adminId,
          title: "Sample post with attachment metadata",
          body: "Non-image attachments show as links in the UI.",
          attachments: {
            create: [
              {
                url: "https://example.com/doc.pdf",
                mime_type: "application/pdf",
                original_name: "sample.pdf",
              },
            ],
          },
        },
      });
      await prisma.post.create({
        data: {
          author_id: adminId,
          title: "Another seeded update",
          body: null,
          attachments: {
            create: {
              url: "/uploads/posts/seed/placeholder.svg",
              mime_type: "image/svg+xml",
              original_name: "placeholder.svg",
            },
          },
        },
      });
    }
  }

  for (const u of TEST_LOGIN_USERS) {
    console.log(`  • ${u.username} / ${u.password} (${u.type})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
