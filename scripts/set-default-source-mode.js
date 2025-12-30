/**
 * Set default source_mode to 'inherit' for all sections
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setDefaultSourceMode() {
  console.log('🔄 Setting default source_mode for all sections...\n');

  try {
    // Fetch all sections
    const { data: sections, error: fetchError } = await supabase
      .from('template_sections')
      .select('id, title, source_mode');

    if (fetchError) {
      console.error('❌ Failed to fetch sections:', fetchError.message);
      return;
    }

    console.log(`📊 Found ${sections.length} sections\n`);

    let updated = 0;
    let alreadySet = 0;

    for (const section of sections) {
      if (!section.source_mode || section.source_mode === null) {
        const { error: updateError } = await supabase
          .from('template_sections')
          .update({ source_mode: 'inherit' })
          .eq('id', section.id);

        if (updateError) {
          console.error(`  ❌ Failed to update "${section.title}":`, updateError.message);
        } else {
          console.log(`  ✅ ${section.title} → source_mode set to "inherit"`);
          updated++;
        }
      } else {
        console.log(`  ⏭️  ${section.title} → already has source_mode: "${section.source_mode}"`);
        alreadySet++;
      }
    }

    console.log(`\n✅ Updated ${updated} sections`);
    console.log(`⏭️  ${alreadySet} sections already had source_mode set`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setDefaultSourceMode()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

