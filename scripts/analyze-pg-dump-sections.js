require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pgDumpPath = path.join(__dirname, '../../EKGproduct/pg_dump.sql');

if (!fs.existsSync(pgDumpPath)) {
  console.error('❌ pg_dump.sql not found at:', pgDumpPath);
  process.exit(1);
}

console.log('📊 Analyzing template_sections in pg_dump.sql\n');
console.log('='.repeat(70));

const content = fs.readFileSync(pgDumpPath, 'utf-8');

// Find the COPY statement for template_sections
const copyStart = content.indexOf('COPY public.template_sections');
if (copyStart === -1) {
  console.log('❌ No template_sections COPY statement found');
  process.exit(1);
}

// Find the end marker (\\.)
const copyEnd = content.indexOf('\n\\.\n', copyStart);
if (copyEnd === -1) {
  console.log('❌ No end marker found for template_sections COPY');
  process.exit(1);
}

// Extract the data section
const dataSection = content.substring(copyStart, copyEnd);
const lines = dataSection.split('\n').filter(line => {
  return line.trim() && 
         !line.startsWith('COPY') && 
         !line.startsWith('\\') &&
         line.trim().length > 0;
});

console.log(`\n📋 Found ${lines.length} sections in pg_dump.sql\n`);

// Parse the columns from the COPY statement
const copyMatch = dataSection.match(/COPY public\.template_sections \((.+)\) FROM stdin;/);
const columns = copyMatch ? copyMatch[1].split(',').map(c => c.trim()) : [];

console.log('Columns in dump:', columns.join(', '));
console.log('\n' + '='.repeat(70));

// Group by template_id (assuming it's the second column)
const sectionsByTemplate = {};
const templateIds = new Set();

lines.forEach((line, index) => {
  const parts = line.split('\t');
  if (parts.length >= 2) {
    const templateId = parts[1]; // template_id is second column
    templateIds.add(templateId);
    
    if (!sectionsByTemplate[templateId]) {
      sectionsByTemplate[templateId] = [];
    }
    
    sectionsByTemplate[templateId].push({
      id: parts[0],
      template_id: templateId,
      section_type: parts[2] || '',
      title: parts[3] || '',
      order_index: parts[5] || '',
      // Show first few sections as examples
      raw: line.substring(0, 80) + (line.length > 80 ? '...' : '')
    });
  }
});

console.log(`\n📊 Summary:\n`);
console.log(`   Total sections: ${lines.length}`);
console.log(`   Unique templates: ${templateIds.size}`);
console.log(`\n📋 Sections per template:\n`);

Object.entries(sectionsByTemplate)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([templateId, sections]) => {
    console.log(`   Template ID ${templateId}: ${sections.length} sections`);
    sections.slice(0, 3).forEach(s => {
      console.log(`      - ${s.title} (order: ${s.order_index}, type: ${s.section_type})`);
    });
    if (sections.length > 3) {
      console.log(`      ... and ${sections.length - 3} more`);
    }
  });

console.log(`\n` + '='.repeat(70));
console.log(`\n💡 Note: These sections use the OLD schema:`);
console.log(`   - Integer IDs (not UUIDs)`);
console.log(`   - order_index (not 'order')`);
console.log(`   - section_type, content, is_editable columns`);
console.log(`\n   They need to be migrated to the new schema before recovery.`);
