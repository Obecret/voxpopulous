#!/bin/bash

# Export configuration data from development to production
# Usage: ./scripts/export-config-data.sh

echo "=== Export des données de configuration ==="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Erreur: DATABASE_URL n'est pas définie"
  exit 1
fi

OUTPUT_FILE="config_data_export.sql"

echo "Export vers $OUTPUT_FILE..."

# Export subscription plans (with Stripe price IDs)
cat > $OUTPUT_FILE << 'EOF'
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

EOF

# Export subscription_plans data
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO subscription_plans (id, name, code, description, monthly_price, yearly_price, is_active, is_free, is_best_value, has_promo, promo_percent, target_tenant_types, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('
  || quote_literal(id) || ', '
  || quote_literal(name) || ', '
  || quote_literal(code) || ', '
  || quote_nullable(description) || ', '
  || monthly_price || ', '
  || yearly_price || ', '
  || is_active || ', '
  || is_free || ', '
  || is_best_value || ', '
  || has_promo || ', '
  || COALESCE(promo_percent::text, 'NULL') || ', '
  || COALESCE(quote_literal(target_tenant_types::text), 'NULL') || ', '
  || quote_nullable(stripe_price_id_monthly_test) || ', '
  || quote_nullable(stripe_price_id_yearly_test) || ', '
  || quote_nullable(stripe_price_id_monthly_live) || ', '
  || quote_nullable(stripe_price_id_yearly_live) || ', '
  || display_order || ', '
  || quote_literal(created_at::text)
  || ');'
FROM subscription_plans ORDER BY display_order;
" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "-- 2. Options/Addons" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "TRUNCATE TABLE addons CASCADE;" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Export addons data
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO addons (id, code, name, description, default_monthly_price, default_yearly_price, is_active, stripe_price_id_monthly_test, stripe_price_id_yearly_test, stripe_price_id_monthly_live, stripe_price_id_yearly_live, display_order, created_at) VALUES ('
  || quote_literal(id) || ', '
  || quote_literal(code) || ', '
  || quote_literal(name) || ', '
  || quote_nullable(description) || ', '
  || default_monthly_price || ', '
  || default_yearly_price || ', '
  || is_active || ', '
  || quote_nullable(stripe_price_id_monthly_test) || ', '
  || quote_nullable(stripe_price_id_yearly_test) || ', '
  || quote_nullable(stripe_price_id_monthly_live) || ', '
  || quote_nullable(stripe_price_id_yearly_live) || ', '
  || display_order || ', '
  || quote_literal(created_at::text)
  || ');'
FROM addons ORDER BY display_order;
" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "-- 3. Paramètres superadmin" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "TRUNCATE TABLE superadmin_settings CASCADE;" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Export superadmin_settings
psql "$DATABASE_URL" -t -A -c "
SELECT 'INSERT INTO superadmin_settings (id, key, value, created_at, updated_at) VALUES ('
  || quote_literal(id) || ', '
  || quote_literal(key) || ', '
  || quote_literal(value) || ', '
  || quote_literal(created_at::text) || ', '
  || quote_literal(updated_at::text)
  || ');'
FROM superadmin_settings;
" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "-- 4. Fonctionnalités du catalogue" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE

# Check if catalog_features exists
psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_features' LIMIT 1;" | grep -q 1 && {
  echo "TRUNCATE TABLE catalog_features CASCADE;" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
  psql "$DATABASE_URL" -t -A -c "
  SELECT 'INSERT INTO catalog_features (id, code, name, description, is_active, display_order, created_at) VALUES ('
    || quote_literal(id) || ', '
    || quote_literal(code) || ', '
    || quote_literal(name) || ', '
    || quote_nullable(description) || ', '
    || is_active || ', '
    || display_order || ', '
    || quote_literal(created_at::text)
    || ');'
  FROM catalog_features ORDER BY display_order;
  " >> $OUTPUT_FILE
}

echo "" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "-- 5. Associations plan-fonctionnalités" >> $OUTPUT_FILE  
echo "-- ============================================" >> $OUTPUT_FILE

psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_catalog_features' LIMIT 1;" | grep -q 1 && {
  echo "TRUNCATE TABLE plan_catalog_features CASCADE;" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
  psql "$DATABASE_URL" -t -A -c "
  SELECT 'INSERT INTO plan_catalog_features (id, plan_id, feature_id, created_at) VALUES ('
    || quote_literal(id) || ', '
    || quote_literal(plan_id) || ', '
    || quote_literal(feature_id) || ', '
    || quote_literal(created_at::text)
    || ');'
  FROM plan_catalog_features;
  " >> $OUTPUT_FILE
}

echo "" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE
echo "-- 6. Accès addons par plan" >> $OUTPUT_FILE
echo "-- ============================================" >> $OUTPUT_FILE

psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'plan_addon_access' LIMIT 1;" | grep -q 1 && {
  echo "TRUNCATE TABLE plan_addon_access CASCADE;" >> $OUTPUT_FILE
  echo "" >> $OUTPUT_FILE
  psql "$DATABASE_URL" -t -A -c "
  SELECT 'INSERT INTO plan_addon_access (id, plan_id, addon_id, monthly_price, yearly_price, created_at) VALUES ('
    || quote_literal(id) || ', '
    || quote_literal(plan_id) || ', '
    || quote_literal(addon_id) || ', '
    || COALESCE(monthly_price::text, 'NULL') || ', '
    || COALESCE(yearly_price::text, 'NULL') || ', '
    || quote_literal(created_at::text)
    || ');'
  FROM plan_addon_access;
  " >> $OUTPUT_FILE
}

cat >> $OUTPUT_FILE << 'EOF'

-- Réactiver les contraintes
SET session_replication_role = DEFAULT;

-- Fin de l'export
EOF

echo ""
echo "Export terminé: $OUTPUT_FILE"
echo ""
echo "Pour importer sur la production:"
echo "  psql \"\$PRODUCTION_DATABASE_URL\" < $OUTPUT_FILE"
