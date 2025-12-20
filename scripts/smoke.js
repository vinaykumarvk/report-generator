#!/usr/bin/env node
/**
 * Minimal smoke script to ensure the project files are present.
 * This keeps `npm test` fast and dependency-free in restricted environments.
 */
const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "src/server.js",
  "src/validation.js",
  "prisma/schema.prisma",
  "public/index.html",
];

const missing = requiredFiles.filter(
  (file) => !fs.existsSync(path.join(__dirname, "..", file))
);

if (missing.length > 0) {
  console.error("Missing required files:", missing.join(", "));
  process.exit(1);
}

console.log("Smoke check passed. Key files are present.");
