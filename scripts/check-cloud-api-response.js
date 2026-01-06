/**
 * Script to check what the cloud API returns for templates
 * Run this to compare with local response
 */

const https = require('https');

const CLOUD_URL = process.env.CLOUD_URL || 'https://report-generator-47249889063.europe-west1.run.app';

async function checkCloudAPI() {
  console.log('🔍 Checking cloud API response...\n');
  console.log(`URL: ${CLOUD_URL}/api/templates\n`);

  return new Promise((resolve, reject) => {
    const url = new URL(`${CLOUD_URL}/api/templates`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const templates = JSON.parse(data);
          const solutionsTemplate = templates.find(t => 
            t.name && t.name.toLowerCase().includes('solutions')
          );

          if (solutionsTemplate) {
            console.log('✅ Found Solutions Document template:');
            console.log(`   ID: ${solutionsTemplate.id}`);
            console.log(`   Name: ${solutionsTemplate.name}`);
            console.log(`   connectors array length: ${solutionsTemplate.connectors?.length || 0}`);
            console.log(`   sources_json type: ${typeof solutionsTemplate.sources_json}`);
            console.log(`   sources_json length: ${Array.isArray(solutionsTemplate.sources_json) ? solutionsTemplate.sources_json.length : 'not array'}`);
            
            if (solutionsTemplate.connectors && solutionsTemplate.connectors.length > 0) {
              console.log('\n   Connectors:');
              solutionsTemplate.connectors.forEach((conn, i) => {
                console.log(`     ${i + 1}. type: ${conn.type}, name: ${conn.name || 'missing'}`);
              });
            } else {
              console.log('\n   ⚠️  No connectors in response!');
            }

            if (solutionsTemplate.sources_json && Array.isArray(solutionsTemplate.sources_json) && solutionsTemplate.sources_json.length > 0) {
              console.log('\n   sources_json (raw):');
              console.log(JSON.stringify(solutionsTemplate.sources_json, null, 2));
            }

            // Check sections
            if (solutionsTemplate.sections && solutionsTemplate.sections.length > 0) {
              console.log(`\n   Sections: ${solutionsTemplate.sections.length}`);
              solutionsTemplate.sections.forEach((section, i) => {
                console.log(`     ${i + 1}. ${section.title}`);
                console.log(`        sourceMode: ${section.sourceMode}`);
                console.log(`        evidencePolicy: ${section.evidencePolicy || 'null'}`);
              });
            }
          } else {
            console.log('❌ Solutions Document template not found in response');
            console.log(`   Found ${templates.length} templates total`);
          }

          resolve(templates);
        } catch (err) {
          console.error('❌ Failed to parse response:', err.message);
          console.log('Raw response:', data.substring(0, 500));
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      reject(err);
    });

    req.end();
  });
}

checkCloudAPI().catch(console.error);

