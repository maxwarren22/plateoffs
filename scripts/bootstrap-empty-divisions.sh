#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# bootstrap-empty-divisions.sh
#
# Finds every currently-active division whose recipe bank is empty or below
# the minimum playable size, then calls curate-division-recipes for each one
# sequentially. Run this once after deploying to fix divisions that failed
# or were never curated in the prototype.
#
# Usage:
#   export SUPABASE_URL=https://<project>.supabase.co
#   export SERVICE_ROLE_KEY=<your-service-role-key>
#   bash scripts/bootstrap-empty-divisions.sh
#
# Optional — only process specific slugs:
#   bash scripts/bootstrap-empty-divisions.sh protein-throne plant-power
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL is not set}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY is not set}"
BRACKET_SIZE=8

AUTH_HEADERS=(
  -H "apikey: $SERVICE_ROLE_KEY"
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
  -H "Content-Type: application/json"
)

# ── Determine which slugs to process ─────────────────────────────────────────

if [ "$#" -gt 0 ]; then
  # Specific slugs passed as arguments
  TARGET_SLUGS=("$@")
  echo "Processing ${#TARGET_SLUGS[@]} specified slug(s)."
else
  # Find all active divisions with fewer than BRACKET_SIZE recipes
  echo "Querying active divisions with empty or incomplete banks..."

  ACTIVE_JSON=$(curl -sf \
    "${AUTH_HEADERS[@]}" \
    "$SUPABASE_URL/rest/v1/plateoffs_divisions?is_active=eq.true&select=slug,recipe_ids")

  # Read into array without mapfile (compatible with macOS bash 3.2)
  TARGET_SLUGS=()
  while IFS= read -r slug; do
    TARGET_SLUGS+=("$slug")
  done < <(echo "$ACTIVE_JSON" | jq -r --argjson min "$BRACKET_SIZE" \
    '.[] | select((.recipe_ids == null) or ((.recipe_ids | length) < $min)) | .slug')

  if [ "${#TARGET_SLUGS[@]}" -eq 0 ]; then
    echo "All active divisions have ≥ $BRACKET_SIZE recipes. Nothing to do."
    exit 0
  fi

  echo "Found ${#TARGET_SLUGS[@]} division(s) needing curation:"
  printf '  - %s\n' "${TARGET_SLUGS[@]}"
  echo ""
fi

# ── Curate each division sequentially ────────────────────────────────────────

SUCCEEDED=()
FAILED=()

for slug in "${TARGET_SLUGS[@]}"; do
  echo "──────────────────────────────────────"
  echo "Curating: $slug"

  HTTP_STATUS=$(curl -s -o /tmp/curate_response.json -w "%{http_code}" -X POST \
    "${AUTH_HEADERS[@]}" \
    -d "{\"slug\": \"$slug\"}" \
    "$SUPABASE_URL/functions/v1/curate-division-recipes")

  RESPONSE=$(cat /tmp/curate_response.json)

  if [ "$HTTP_STATUS" -eq 200 ]; then
    BANK_SIZE=$(echo "$RESPONSE" | jq -r '.bankSize // "?"')
    MODE=$(echo "$RESPONSE" | jq -r '.mode // "?"')
    INSERTED=$(echo "$RESPONSE" | jq -r '.inserted // "?"')
    MATCHED=$(echo "$RESPONSE" | jq -r '.matched // "?"')
    echo "  ✓ Done — mode: $MODE, bank: $BANK_SIZE recipes (inserted: $INSERTED, matched: $MATCHED)"
    SUCCEEDED+=("$slug")
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "unknown error"')
    echo "  ✗ Failed (HTTP $HTTP_STATUS) — $ERROR"
    FAILED+=("$slug")
  fi

  echo ""
done

# ── Summary ───────────────────────────────────────────────────────────────────

echo "══════════════════════════════════════"
echo "Bootstrap complete."
echo "  Succeeded: ${#SUCCEEDED[@]}"
echo "  Failed:    ${#FAILED[@]}"

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo ""
  echo "Failed slugs (re-run with these as arguments to retry):"
  printf '  %s\n' "${FAILED[@]}"
  echo ""
  echo "  bash scripts/bootstrap-empty-divisions.sh ${FAILED[*]}"
fi
