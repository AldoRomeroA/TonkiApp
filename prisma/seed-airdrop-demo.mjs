/**
 * Datos de demostración para estadísticas de airdrop.
 * Ejecutar: node prisma/seed-airdrop-demo.mjs
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

const DEMO_CONFIG_ID = "f1e2d3c4-b5a6-7890-cdef-123456789abc";
const DEMO_LOG_ID = "a9b8c7d6-e5f4-3210-abcd-ef9876543210";

const CAMPAIGN_START = new Date("2026-02-01T12:00:00.000Z");
const CAMPAIGN_END = new Date("2026-02-28T23:59:59.999Z");

/** Usuarios existentes + consumos ficticios (puntos por visita). */
const DEMO_CONSUMPTIONS = [
  { user_id: "53cbab56cc7d41e491e063e10126cb02", name: "Aldo Romero Arroyo", visits: [12, 8, 15] },
  { user_id: "de536bbbb4af450ebe11f6a72653ef6f", name: "Brayan Samuel Nieto De la Paz", visits: [20, 10] },
  { user_id: "04feaecc87eb4f3aa37b836d585b312e", name: "Adriana Morales", visits: [7, 14, 6] },
  { user_id: "380218ef827e4b55a0b7551f62ea1504", name: "ALVARO FLORES", visits: [25] },
  { user_id: "55108a1d95c64dd39de47328a0ee8d21", name: "Angelica Anaeer Salazar Rodriguez", visits: [9, 11] },
  { user_id: "76bb243c781f4a969b95260a9cfa53b5", name: "Maria Elena JIMENEZ", visits: [18, 5] },
  { user_id: "a5fad7427ae54287a7aa71ac06f16ee1", name: "David Lopez", visits: [30, 12] },
  { user_id: "af33283e073c414c8742b79550c5ad86", name: "Judith Anaya Crisanto", visits: [6] },
  { user_id: "b8f01e0e88b04d038cc20f20fff214ab", name: "Ade Martínez", visits: [22, 8, 4] },
  { user_id: "fcb9da9996364ed1a94771b77b7e0c4a", name: "Antonio Gerardo Escárcega Jiménez", visits: [16] },
  { user_id: "4d022172-cdf2-499e-83a9-a14e00d6b948", name: "Wallet GA7JHS…JW4V", visits: [10, 10] },
];

function visitDate(dayOfMonth, hour = 14) {
  const d = Math.min(Math.max(dayOfMonth, 1), 28);
  return new Date(`2026-02-${String(d).padStart(2, "0")}T${String(hour).padStart(2, "0")}:30:00.000Z`);
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { type: "admin" },
    select: { user_id: true, name: true },
  });
  if (!admin) throw new Error("No se encontró usuario admin");

  const establishment = await prisma.establishment.findFirst({
    where: { admin_id: admin.user_id },
    select: { establishment_id: true, name: true },
  });
  if (!establishment) throw new Error("No se encontró establecimiento del admin");

  console.log(`Admin: ${admin.name}`);
  console.log(`Establecimiento: ${establishment.name}`);

  const existing = await prisma.airdropConfig.findUnique({
    where: { config_id: DEMO_CONFIG_ID },
  });

  if (!existing) {
    await prisma.airdropConfig.create({
      data: {
        config_id: DEMO_CONFIG_ID,
        user_id: admin.user_id,
        amount: 150,
        scheduled_date: CAMPAIGN_START,
        scheduled_end_date: CAMPAIGN_END,
        periodicity_months: 3,
        max_users: 10,
        created_at: CAMPAIGN_START,
      },
    });
    console.log("✓ Campaña demo creada (feb 2026)");
  } else {
    console.log("• Campaña demo ya existía");
  }

  const rewardMarker = "demo-airdrop-feb2026";
  const existingRewards = await prisma.reward.count({
    where: {
      establishment_id: establishment.establishment_id,
      title: { startsWith: rewardMarker },
    },
  });

  if (existingRewards === 0) {
    let dayCursor = 2;
    const rows = [];

    for (const user of DEMO_CONSUMPTIONS) {
      for (let i = 0; i < user.visits.length; i++) {
        const points = user.visits[i];
        rows.push({
          reward_id: randomUUID(),
          user_id: user.user_id,
          establishment_id: establishment.establishment_id,
          title: `${rewardMarker}-${user.user_id.slice(0, 8)}-${i + 1}`,
          description: `Consumo demo — ${user.name}`,
          points,
          status: "active",
          created_at: visitDate(dayCursor + i * 2, 12 + (i % 6)),
        });
        dayCursor += 1;
        if (dayCursor > 26) dayCursor = 2;
      }
    }

    await prisma.reward.createMany({ data: rows });
    console.log(`✓ ${rows.length} consumos ficticios creados para ${DEMO_CONSUMPTIONS.length} usuarios`);
  } else {
    console.log(`• ${existingRewards} consumos demo ya existían`);
  }

  const existingLog = await prisma.airdropLog.findUnique({
    where: { log_id: DEMO_LOG_ID },
  });

  if (!existingLog) {
    await prisma.airdropLog.create({
      data: {
        log_id: DEMO_LOG_ID,
        config_id: DEMO_CONFIG_ID,
        transaction_hash: "DEMO_TX_HASH_FEB2026_CAMPAIGN",
        total_amount: 142.75,
        users_involved: 10,
        executed_at: new Date("2026-03-01T10:00:00.000Z"),
        success: true,
      },
    });
    console.log("✓ Log de airdrop demo creado");
  } else {
    console.log("• Log de airdrop demo ya existía");
  }

  const existingArchive = await prisma.airdropCampaignArchive.findUnique({
    where: { config_id: DEMO_CONFIG_ID },
  });

  if (!existingArchive) {
    const rewards = await prisma.reward.findMany({
      where: {
        establishment_id: establishment.establishment_id,
        title: { startsWith: rewardMarker },
      },
      select: { user_id: true, points: true },
    });

    const visitors = new Set(rewards.map((r) => r.user_id));
    const totalSpent = rewards.reduce((s, r) => s + r.points, 0);

    await prisma.airdropCampaignArchive.create({
      data: {
        archive_id: randomUUID(),
        config_id: DEMO_CONFIG_ID,
        admin_id: admin.user_id,
        establishment_id: establishment.establishment_id,
        campaign_start: CAMPAIGN_START,
        campaign_end: CAMPAIGN_END,
        balance_sent: 142.75,
        users_sent: 10,
        visitors_count: visitors.size,
        purchase_count: rewards.length,
        total_spent: totalSpent,
        archived_at: new Date("2026-03-01T12:00:00.000Z"),
      },
    });

    console.log(
      `✓ Archivo de campaña creado: ${visitors.size} visitantes, ${rewards.length} compras, ${totalSpent} tonkis`
    );
  } else {
    console.log("• Archivo de campaña demo ya existía");
  }

  console.log("\nListo. Abre /admin/airdrop/stats para ver la campaña archivada.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
