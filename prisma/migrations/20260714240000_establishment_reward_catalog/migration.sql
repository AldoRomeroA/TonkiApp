-- Catalog of redeemable rewards offered by an establishment.
CREATE TABLE `Establishment_Reward` (
  `establishment_reward_id` CHAR(36) NOT NULL,
  `establishment_id` CHAR(36) NOT NULL,
  `admin_id` CHAR(36) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `short_description` VARCHAR(255) NOT NULL,
  `long_description` TEXT NULL,
  `value_tonkis` INT NOT NULL DEFAULT 0,
  `value_usd` DOUBLE NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`establishment_reward_id`),
  INDEX `Establishment_Reward_establishment_id_idx` (`establishment_id`),
  INDEX `Establishment_Reward_admin_id_idx` (`admin_id`),
  CONSTRAINT `Establishment_Reward_establishment_id_fkey`
    FOREIGN KEY (`establishment_id`) REFERENCES `Establishment`(`establishment_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Establishment_Reward_admin_id_fkey`
    FOREIGN KEY (`admin_id`) REFERENCES `User`(`user_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed 10 catalog rewards for El Campestre.
INSERT INTO `Establishment_Reward` (
  `establishment_reward_id`,
  `establishment_id`,
  `admin_id`,
  `title`,
  `short_description`,
  `long_description`,
  `value_tonkis`,
  `value_usd`,
  `created_at`,
  `updated_at`
) VALUES
(
  'e1a10000000000000000000000000001',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Café',
  'Café americano o espresso',
  'Canjea un café americano o espresso de la casa en El Campestre. Válido en barra durante horario de servicio.',
  250,
  45.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000002',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Té',
  'Té caliente o frío de la casa',
  'Disfruta un té caliente o frío a elección del menú de bebidas de El Campestre.',
  200,
  35.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000003',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Hamburguesa sencilla',
  'Hamburguesa clásica con papas',
  'Hamburguesa sencilla con queso, verdura fresca y papas a la francesa. Ideal para un almuerzo rápido.',
  800,
  120.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000004',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Agua de sabor',
  'Jarra individual de agua fresca',
  'Agua de sabor del día (jamaica, horchata o limón) en presentación individual.',
  150,
  25.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000005',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Orden de papas',
  'Papas fritas o gajo',
  'Orden de papas fritas o gajo para compartir, con salsa de la casa.',
  350,
  55.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000006',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Tacos al pastor',
  'Orden de 3 tacos al pastor',
  'Tres tacos al pastor con cebolla, cilantro y piña. Incluye salsa verde o roja.',
  600,
  90.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000007',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Quesadilla',
  'Quesadilla de queso o guisado',
  'Quesadilla a elección: queso, tinga o champiñones, servida con guacamole.',
  400,
  65.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000008',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Postre del día',
  'Rebanada o porción individual',
  'Postre del día según disponibilidad: flan, pastel o brownie de la casa.',
  450,
  70.00,
  NOW(3),
  NOW(3)
),
(
  'e1a10000000000000000000000000009',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Malteada',
  'Malteada de chocolate o vainilla',
  'Malteada cremosa de chocolate o vainilla, tamaño regular.',
  500,
  80.00,
  NOW(3),
  NOW(3)
),
(
  'e1a1000000000000000000000000000a',
  'b7c9e2f4a1234d56b7890cdef1234567',
  'd9a7f3c2b1e44a6f9c8d1234567890ab',
  'Combo familiar',
  '2 hamburguesas + papas + 2 bebidas',
  'Combo para compartir: dos hamburguesas sencillas, una orden grande de papas y dos bebidas de la casa.',
  1800,
  280.00,
  NOW(3),
  NOW(3)
);
