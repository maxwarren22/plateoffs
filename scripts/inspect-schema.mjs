/**
 * inspect-schema.mjs
 *
 * Prints the column definitions for a Supabase table by fetching
 * the PostgREST OpenAPI spec (works with the anon key).
 *
 * Run: node scripts/inspect-schema.mjs [table_name]
 *   eg: node scripts/inspect-schema.mjs plateoffs_divisions
 */

const SUPABASE_URL = 'https://ppdgdwfiwgwifzykkngr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const tableName = process.argv[2] || 'plateoffs_divisions';

async function main() {
  const params = new URLSearchParams({
    select: 'column_name,data_type,udt_name,is_nullable,column_default,ordinal_position',
    table_name: `eq.${tableName}`,
    table_schema: 'eq.public',
    order: 'ordinal_position',
  });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Failed to fetch schema: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }

  const spec = await res.json();
  const definition = spec?.definitions?.[tableName];

  if (!definition) {
    const available = Object.keys(spec?.definitions ?? {}).sort();
    console.error(`Table "${tableName}" not found in schema.`);
    console.error(`Available tables:\n  ${available.join('\n  ')}`);
    process.exit(1);
  }

  console.log(`\nSchema for: ${tableName}\n${'─'.repeat(70)}`);

  const props = definition.properties ?? {};
  const required = new Set(definition.required ?? []);

  const rows = Object.entries(props).map(([col, meta]) => ({
    col,
    type: meta.format ?? meta.type ?? '?',
    nullable: required.has(col) ? 'NO ' : 'YES',
    desc: meta.description ?? '',
  }));

  const colW  = Math.max(...rows.map(r => r.col.length), 6);
  const typeW = Math.max(...rows.map(r => r.type.length), 4);

  console.log(`${'COLUMN'.padEnd(colW)}  ${'TYPE'.padEnd(typeW)}  NULLABLE  DESCRIPTION`);
  console.log('─'.repeat(70));

  for (const { col, type, nullable, desc } of rows) {
    console.log(`${col.padEnd(colW)}  ${type.padEnd(typeW)}  ${nullable}       ${desc}`);
  }

  console.log();
}

main().catch(err => { console.error(err); process.exit(1); });
