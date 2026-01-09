require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 Running Schema Migration for template_sections\n');
  console.log('='.repeat(70));
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'add-missing-section-columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Found ${statements.length} SQL statements to execute\n`);
  
  let success = 0;
  let errors = 0;
  
  for (const statement of statements) {
    if (statement.trim().length === 0) continue;
    
    try {
      // Execute via RPC if available, or use direct query
      const { error } = await supabase.rpc('exec_sql', { query: statement + ';' });
      
      if (error) {
        // Try alternative - some statements might need different execution
        console.log(`⚠️  Statement may need manual execution: ${statement.substring(0, 50)}...`);
        errors++;
      } else {
        success++;
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 Migration Results:`);
  console.log(`   Successful: ${success}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n💡 Note: Some statements may need to be run directly in Supabase SQL editor`);
  console.log(`   File: scripts/add-missing-section-columns.sql`);
})();
