-- ============================================
-- Export des données de configuration VoxPopulous
-- Généré automatiquement
-- ============================================

-- Désactiver les contraintes temporairement
SET session_replication_role = replica;

-- ============================================
-- 1. Forfaits (subscription_plans)
-- ============================================
TRUNCATE TABLE subscription_plans CASCADE;

INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('0343db17-578f-4c37-b8fb-d792cc5e5a02', 'Association', 'ASSO', 'Accès pour une association à l''ensemble des fonctionnalités du site avec la boîte à idées, les signalements et le suivi des évènements et réunions de l''association', 19, 100, true, false, true, false, 0, '{ASSOCIATION}', 'price_1SrcTcGgOdLSKlNrTg8t69b6', 'price_1SrcTcGgOdLSKlNrDdfKhy7K', 'price_1SrfJJGv5nU0YyJVXAYMWR0U', 'price_1SrfJIGv5nU0YyJVsJZV92eH', 0, '2026-01-09 09:39:11.808962');
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('594de748-ab05-4159-bc65-7dea74848899', 'Essentiel', 'ESSENTIEL', 'Accès pour une petite Mairie à la fonctionnalités de la boîte à idées', 29, 290, true, false, false, false, 0, '{MAIRIE}', 'price_1SnjTAGgOdLSKlNro1jh7KrF', 'price_1SnjTAGgOdLSKlNryCnndKYw', 'price_1SrfJPGv5nU0YyJVxtXdVDLA', 'price_1SrfJPGv5nU0YyJV1dkhNADi', 2, '2025-12-13 16:17:41.873246');
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', 'Standard', 'STANDARD', 'Accès pour une Mairie de taille moyenne aux fonctionnalités avec la boîte à idées et les signalements', 39, 390, true, false, false, false, 0, '{MAIRIE}', 'price_1SnjWTGgOdLSKlNrnTF3yBAH', 'price_1SnjWTGgOdLSKlNrDb9rjk4h', 'price_1SrfJSGv5nU0YyJVCLoRAFEp', 'price_1SrfJSGv5nU0YyJVCLoRAFEp', 3, '2025-12-11 14:04:51.455415');
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('47e1a109-3973-477d-a92b-55c6b8f2c86e', 'Pro', 'PRO', 'Accès pour une Mairie de bonne taille à l''ensemble des fonctionnalités avec la boîte à idées, les signalements et la gestion des évènements et réunions.', 49, 490, true, false, true, false, 0, '{MAIRIE}', 'price_1SnjYUGgOdLSKlNrx2rQn7sx', 'price_1SnjYUGgOdLSKlNr2EerQBv5', 'price_1SrfJVGv5nU0YyJVKVXd4qEF', 'price_1SrfJVGv5nU0YyJVGHlBpTXk', 4, '2025-12-11 14:04:51.512613');
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('d674cfd8-2b52-4322-a155-5633cefc0c9f', 'Premium', 'PREMIUM', 'Accès pour une Mairie de bonne taille ou souhaitant mettre à disposition de ses associations l''ensemble de toutes les fonctionnalités avec la boîte à idées, les signalements et la gestion des évènements et réunions. La Mairie peut choisir le nombre d''associations qu''elle prendra en charge dans son forfait. Celles-ci n''auront donc pas à payer leur abonnement à Voxpopulous.fr', 59, 590, true, false, false, false, 0, '{MAIRIE}', 'price_1SnjauGgOdLSKlNrW54DCXYZ', 'price_1SnjauGgOdLSKlNr5JnAzkGZ', 'price_1SrfJXGv5nU0YyJVEtht7Zha', 'price_1SrfJXGv5nU0YyJVaGm0QwRn', 5, '2025-12-11 14:53:29.534902');
INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('fc0d3650-791f-4c16-958e-74190d47487f', 'EPCI', 'EPCI', 'Accès pour une intercommunalité  et possibilité pour elle de prendre en charge pour une partie ou l''ensemble de ses communes et des associations de ses communes aux fonctionnalités complètes avec la boîte à idées, les signalements et la gestion des évènements et des réunions', 199, 1990, true, false, true, false, 0, '{EPCI}', 'price_1SnjcBGgOdLSKlNrzVRvB1gV', 'price_1SnjcBGgOdLSKlNriMf1DAlB', 'price_1SrfJbGv5nU0YyJVzJX9XP4X', 'price_1SrfJbGv5nU0YyJVfWSvSOHl', 6, '2025-12-15 14:39:00.27197');

-- ============================================
-- 2. Options/Addons
-- ============================================
TRUNCATE TABLE addons CASCADE;


-- ============================================
-- 3. Paramètres superadmin
-- ============================================
TRUNCATE TABLE superadmin_settings CASCADE;


-- ============================================
-- 4. Fonctionnalités du catalogue
-- ============================================

-- ============================================
-- 5. Associations plan-fonctionnalités
-- ============================================

-- ============================================
-- 6. Accès addons par plan
-- ============================================
TRUNCATE TABLE plan_addon_access CASCADE;

INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('59e74166-d62b-4ab0-b43b-060bbee05cfc', '0343db17-578f-4c37-b8fb-d792cc5e5a02', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 18:19:40.586976');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('fa829682-8b1b-4b2e-ba04-9ecd5b8491e1', '0343db17-578f-4c37-b8fb-d792cc5e5a02', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 18:19:40.586976');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('34ced6ef-16d9-40f6-9dc2-0db2a7c23929', '0343db17-578f-4c37-b8fb-d792cc5e5a02', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 18:19:40.586976');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('bfd9fe05-213a-4d4d-8fc3-801dedb8baa1', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 09:37:50.909047');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('b8d7fc8e-5a79-4c43-ba8a-45c5e386aeba', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 09:37:50.909047');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('d5c6ecc1-5e3c-4044-963a-0a924a564239', 'd674cfd8-2b52-4322-a155-5633cefc0c9f', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 09:37:50.909047');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('d12b9fb4-1155-4d7d-a645-9176dcda3df7', '594de748-ab05-4159-bc65-7dea74848899', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 18:19:48.12999');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('4fe3f52f-ae38-489c-889f-c9ad5cb30d9c', '594de748-ab05-4159-bc65-7dea74848899', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 18:19:48.12999');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('0e19743b-2ab0-4c63-bd42-efdb5dbd855e', '594de748-ab05-4159-bc65-7dea74848899', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 18:19:48.12999');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('b54abc44-1df2-43b8-9740-fea3fc9acb5f', 'eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 18:19:55.388762');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('20071101-f50b-40a2-874b-f25a3f931dd2', 'eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 18:19:55.388762');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('53357c82-42fd-40ed-b89f-d9cd44c50af4', 'eafca9c3-03ed-4bf2-b96c-466f8d56ebb8', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 18:19:55.388762');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('2c3822ec-4839-406a-a467-21d03ff70d89', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 18:20:05.069841');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('b3f77b8c-80e4-43de-8b88-518de7467327', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 18:20:05.069841');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('309fbf85-d767-4581-8f2f-27aefae56a32', '47e1a109-3973-477d-a92b-55c6b8f2c86e', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 18:20:05.069841');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('eefb8740-8d77-44dc-98d8-ea686aa5ae6b', 'fc0d3650-791f-4c16-958e-74190d47487f', '1bc78c92-4549-4365-82d0-a0a44ffe5f9c', NULL, NULL, '2026-01-09 18:20:46.862296');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('b84777f5-4511-4f41-8b04-e89c223f461b', 'fc0d3650-791f-4c16-958e-74190d47487f', '1268ba76-b5ba-4f7a-b740-8a41fc365250', NULL, NULL, '2026-01-09 18:20:46.862296');
INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('ee2a75d4-9aee-4e7a-a30b-fee6d4fd9cfa', 'fc0d3650-791f-4c16-958e-74190d47487f', '0e5fcf2b-2da1-40d2-b813-f696ec3ff7c6', NULL, NULL, '2026-01-09 18:20:46.862296');

-- Réactiver les contraintes
SET session_replication_role = DEFAULT;

-- Fin de l'export
