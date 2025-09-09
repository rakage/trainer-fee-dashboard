#!/usr/bin/env node

/**
 * Database Seeding Utility
 * 
 * This script seeds the database with sample data for development and testing.
 * 
 * Usage:
 *   node scripts/seed-database.js
 *   npm run seed
 */

const https = require('https');
const http = require('http');

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/seed`;

  console.log(`📡 Calling: ${url}`);

  const client = baseUrl.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    const postData = '';
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.success) {
            console.log('✅ Database seeded successfully!');
            console.log(`📊 Statistics:`);
            console.log(`   - Events: ${response.data.events}`);
            console.log(`   - Tickets: ${response.data.tickets}`);
            console.log(`   - Trainer Splits: ${response.data.splits}`);
            console.log(`🎯 Sample Event ID: ${response.data.sampleEventId}`);
            console.log('\n🚀 You can now test the application with sample data!');
            resolve(response);
          } else {
            console.error('❌ Seeding failed:', response.error);
            if (response.details) {
              console.error('📋 Details:', response.details);
            }
            reject(new Error(response.error));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse response:', parseError.message);
          console.error('📋 Raw response:', data);
          reject(parseError);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Network error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('\n✨ Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seeding failed:', error.message);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
