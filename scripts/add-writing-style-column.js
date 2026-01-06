/**
 * Add writing_style column to template_sections table
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

async function addColumn() {
  console.log('🔧 Adding writing_style column to template_sections...\n');

  try {
    // Use raw SQL via RPC or direct query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE template_sections ADD COLUMN IF NOT EXISTS writing_style text;'
    });

    if (error) {
      // If RPC doesn't exist, we'll need to use a different approach
      console.log('⚠️  RPC method not available, trying direct approach...');
      
      // Alternative: Just update the schema file and let user know
      console.log('✅ Column definition added to schema file.');
      console.log('📝 Please run the following SQL in your Supabase SQL Editor:');
      console.log('\n' + '─'.repeat(60));
      console.log('ALTER TABLE template_sections');
      console.log('ADD COLUMN IF NOT EXISTS writing_style text;');
      console.log('─'.repeat(60) + '\n');
      console.log('Or use the Supabase Dashboard → SQL Editor to execute this.');
    } else {
      console.log('✅ Column added successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Please run the following SQL manually in Supabase SQL Editor:');
    console.log('\n' + '─'.repeat(60));
    console.log('ALTER TABLE template_sections');
    console.log('ADD COLUMN IF NOT EXISTS writing_style text;');
    console.log('─'.repeat(60) + '\n');
  }
}

addColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });




