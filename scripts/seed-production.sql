-- Script de seed pour la base de données de production VoxPopulous
-- Copiez-collez ce script dans la console SQL de la base de production

-- 1. FEATURES (Fonctionnalités du catalogue)
INSERT INTO features (id, name, code, description, display_order)
VALUES 
  ('9f14b96c-c185-46c3-a453-77ba1e5fa4f4', 'Boite à idées', 'IDEA_BOX_CORE', NULL, 1),
  ('25ca511c-3481-4560-94eb-04b650b03cd8', 'Signalements', 'INCIDENTS_CORE', NULL, 2),
  ('001f31fc-bce2-400f-8934-f0d4d60de2a9', 'Evènements et réunions', 'EVENTS_CORE', 'L''ECPI, la commune ou l''association communique sur ses réunions et événements à venir (Conseil inter communal, communal, match, spectacle...)', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 2. SUBSCRIPTION PLANS (Forfaits d'abonnement)
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, has_ideas, has_incidents, has_meetings, max_admins, is_active, is_free, is_best_value, display_order, target_tenant_types, associations_included, communes_included, has_promo, promo_percent)
VALUES 
  ('15c38178-681d-4989-96e0-d8a92c31090f', 'Essai Gratuit', 'FREE_TRIAL', 'Essai gratuit de 30 jours avec toutes les fonctionnalités', 0, 0, true, true, true, 5, true, true, false, 0, '{MAIRIE,EPCI,ASSOCIATION}', 0, 0, false, 0),
  ('c93d747e-adee-4295-bba7-c7cdecdab227', 'Association', 'ASSO', 'Forfait spécial pour les associations intégrant toutes les fonctionnalités', 39, 390, true, true, true, 1, true, false, true, 1, '{ASSOCIATION}', 0, 0, false, 0),
  ('594de748-ab05-4159-bc65-7dea74848899', 'Essentiel', 'ESSENTIEL', 'Forfait avec les options essentiels pour petite Structure (Mairie/Association)', 19, 190, true, true, true, 1, true, false, false, 2, '{MAIRIE}', 0, 0, false, 0),
  ('eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', 'Standard', 'STANDARD', 'Forfait avec accès aux fonctionnalités standard pour les moyennes structures. Hébergement jusqu''à 5 associations et 2 Administrateurs actifs', 29, 290, true, false, false, 1, true, false, false, 3, '{MAIRIE}', 0, 0, false, 0),
  ('47e1a109-3973-477d-a92b-55c6b8f2c86e', 'Pro', 'PRO', 'Accès à l''ensemble des fonctionnalités. hébergement jusqu''à 20 associations et 5 administrateurs actifs', 39, 390, true, true, false, 2, true, false, true, 4, '{MAIRIE}', 0, 0, false, 0),
  ('d674cfd8-2b52-4322-a155-5633cefc0c9f', 'Premium', 'PREMIUM', 'Accès à l''ensemble de toutes les fonctionnalités avec jusqu''à 100 associations hébergées et 10 administrateurs actifs', 49, 490, true, true, true, 5, true, false, false, 5, '{MAIRIE}', 0, 0, false, 0),
  ('fc0d3650-791f-4c16-958e-74190d47487f', 'Établissement Public de Coopération Intercommunale', 'EPCI', 'Ce forfait regroupe une Intercommunalité intégrant plusieurs communes avec leurs associations rejoignant l''EPCI', 199, 1990, true, true, true, 1, true, false, true, 6, '{EPCI}', 0, 0, false, 0)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  has_ideas = EXCLUDED.has_ideas,
  has_incidents = EXCLUDED.has_incidents,
  has_meetings = EXCLUDED.has_meetings,
  max_admins = EXCLUDED.max_admins,
  is_active = EXCLUDED.is_active,
  is_free = EXCLUDED.is_free,
  is_best_value = EXCLUDED.is_best_value,
  display_order = EXCLUDED.display_order,
  target_tenant_types = EXCLUDED.target_tenant_types,
  associations_included = EXCLUDED.associations_included,
  communes_included = EXCLUDED.communes_included,
  has_promo = EXCLUDED.has_promo,
  promo_percent = EXCLUDED.promo_percent;

-- 3. ADDONS (Options supplémentaires)
INSERT INTO addons (id, name, code, description, is_active)
VALUES 
  ('0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', 'Mairie', 'MAIRIES', 'Mairies faisant partie de la communauté de commune', true),
  ('1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Associations', 'ASSOCIATIONS', 'Gestion des associations locales avec espace dédié', true),
  ('1bc78c92-4549-4365-82d0-a0a44ffe5f9c', 'Administrateur', 'ADMIN', 'Administrateur du site', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- 4. ADDON TIERS (Niveaux de tarification des options)
INSERT INTO addon_tiers (id, addon_id, name, min_quantity, max_quantity, monthly_price, yearly_price, display_order)
VALUES 
  ('077c63f9-6368-4d05-b140-e32d4959782d', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', 'Petite communauté de commune', 0, 20, 199, 1990, 1),
  ('e3ad91ec-d139-4c7b-a905-0d76b11e673b', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', 'Communauté de communes intermédiaire', 21, 40, 399, 3990, 2),
  ('3cf6c0db-611a-4e4b-9c7f-880f31c1e7b9', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', 'Grande communauté de communes', 41, 100, 799, 7990, 3),
  ('fb43e5ae-aaa0-4bf3-a9b0-81c45a247f38', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', 'Très grande communauté de communes', 101, NULL, 1599, 15990, 4),
  ('3dd069ab-bea0-486c-83e2-a09abd7ca92c', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Moins de 5 associations', 1, 5, 15, 150, 1),
  ('37aecaed-4c43-469e-a356-c7581f336142', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Entre 6 et 20 associations', 6, 20, 30, 300, 2),
  ('497b3afd-cee3-4b39-a169-182c9e137513', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Entre 21 et 50 associations', 21, 50, 60, 600, 3),
  ('a48f2f6d-d018-463d-a2d7-b361abc36d0e', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Entre 51 et 100 associations', 51, 100, 120, 1200, 4),
  ('a60b7ca3-8dd1-4cba-aa21-2c1368b25316', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Entre 101 et 200 associations', 101, 200, 150, 1500, 5),
  ('9ffe91e7-c884-4f18-88cb-5251f5ee2df8', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Entre 201 et 500 associations', 201, 500, 300, 3000, 6),
  ('cc7d7b03-2ad0-41d8-b8f6-7fe99752af90', '1268ba76-b5ba-4f7a-b740-8a41fc365250', 'Plus de 500 associations', 501, NULL, 600, 6000, 7),
  ('f3a8d662-f3d4-4777-a274-070cbf31e82e', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', 'Basique', 1, 2, 0, 0, 1),
  ('6d8bbb3a-b050-4078-adf7-b0582de6e1f0', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', 'Standard', 3, 10, 5, 50, 2),
  ('7a24941c-9a02-4dfb-a847-f88a7103a184', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', 'Pro', 21, 30, 15, 150, 3)
ON CONFLICT (id) DO UPDATE SET
  addon_id = EXCLUDED.addon_id,
  name = EXCLUDED.name,
  min_quantity = EXCLUDED.min_quantity,
  max_quantity = EXCLUDED.max_quantity,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  display_order = EXCLUDED.display_order;

-- 5. PLAN FEATURE ASSIGNMENTS (Assignation des fonctionnalités aux forfaits)
INSERT INTO plan_feature_assignments (id, plan_id, feature_id)
VALUES 
  ('e50eca0f-9f4d-451c-b005-bfcc2af66817', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('eea17e5c-b549-434f-89fc-240867658965', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('1858d0e7-1289-460a-a534-57d11527d240', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '001f31fc-bce2-400f-8934-f0d4d60de2a9'),
  ('efa33428-5b74-4317-8ce0-678fb0c62adb', '15c38178-681d-4989-96e0-d8a92c31090f', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('9cc58385-3d6c-41de-ba1d-dc84c6eabfb1', '15c38178-681d-4989-96e0-d8a92c31090f', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('cdd365a8-449a-443c-b938-b556d47e7532', '15c38178-681d-4989-96e0-d8a92c31090f', '001f31fc-bce2-400f-8934-f0d4d60de2a9'),
  ('38dc53d9-4ee9-46d9-ad0e-82a55e37aacf', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('9624d08f-479a-4312-97cb-6bd82f6610e3', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('87c893d0-21f7-431a-9369-e91bdb337795', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '001f31fc-bce2-400f-8934-f0d4d60de2a9'),
  ('e0c1608e-df6e-4138-8791-ac5f056a7b32', '594de748-ab05-4159-bc65-7dea74848899', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('c11b59c9-8eec-4829-a8ec-7d3b576af926', 'eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('ac058d23-9e7f-4183-b9a5-e42d28c69e81', 'eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('538901e2-e252-44d2-80e8-e04c1dfb35d8', 'c93d747e-adee-4295-bba7-c7cdecdab227', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('80285249-a5d9-4578-9e93-ba95579c1915', 'c93d747e-adee-4295-bba7-c7cdecdab227', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('9d5c240f-4e23-40d7-8a0a-597e0b4564cf', 'c93d747e-adee-4295-bba7-c7cdecdab227', '001f31fc-bce2-400f-8934-f0d4d60de2a9'),
  ('d4ae3671-c7bc-4e07-929d-2243b6770562', 'fc0d3650-791f-4c16-958e-74190d47487f', '9f14b96c-c185-46c3-a453-77ba1e5fa4f4'),
  ('6e9ff30e-136e-4f1a-a094-ba327bfa8963', 'fc0d3650-791f-4c16-958e-74190d47487f', '25ca511c-3481-4560-94eb-04b650b03cd8'),
  ('573458ed-328e-4d47-889f-4a0a76d52925', 'fc0d3650-791f-4c16-958e-74190d47487f', '001f31fc-bce2-400f-8934-f0d4d60de2a9')
ON CONFLICT (id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  feature_id = EXCLUDED.feature_id;

-- Vérification
SELECT 'Forfaits créés:' as info, COUNT(*) as count FROM subscription_plans WHERE is_active = true;
SELECT 'Fonctionnalités créées:' as info, COUNT(*) as count FROM features;
SELECT 'Options créées:' as info, COUNT(*) as count FROM addons WHERE is_active = true;
