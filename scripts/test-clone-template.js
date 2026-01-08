#!/usr/bin/env node

/**
 * Test script for clone template API
 * Usage: node scripts/test-clone-template.js <templateId> <newName>
 */

async function testCloneTemplate() {
  const templateId = process.argv[2];
  const newName = process.argv[3] || "Cloned Template " + Date.now();

  if (!templateId) {
    console.error("❌ Error: Template ID is required");
    console.log("\nUsage: node scripts/test-clone-template.js <templateId> <newName>");
    console.log("\nExample:");
    console.log('  node scripts/test-clone-template.js "abc-123-def" "Q1 2025 Report"');
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/templates/${templateId}/clone`;

  console.log("🧪 Testing Clone Template API");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 Original Template ID: ${templateId}`);
  console.log(`📝 New Template Name: ${newName}`);
  console.log(`🌐 API Endpoint: ${url}`);
  console.log("");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Clone Failed!");
      console.error(`Status: ${response.status}`);
      console.error(`Error: ${data.error || "Unknown error"}`);
      process.exit(1);
    }

    console.log("✅ Clone Successful!");
    console.log("");
    console.log("📊 Results:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✓ New Template ID: ${data.template.id}`);
    console.log(`✓ New Template Name: ${data.template.name}`);
    console.log(`✓ Status: ${data.template.status}`);
    console.log(`✓ Sections Cloned: ${data.clonedSectionCount}`);
    console.log(`✓ Default Sources: ${data.template.default_vector_store_ids?.length || 0}`);
    console.log("");
    console.log("📝 Message:", data.message);
    console.log("");
    console.log("🔍 Template Details:");
    console.log(JSON.stringify(data.template, null, 2));
  } catch (error) {
    console.error("❌ Request Failed!");
    console.error(error.message);
    process.exit(1);
  }
}

testCloneTemplate();





