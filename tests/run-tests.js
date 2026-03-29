#!/usr/bin/env node

/**
 * Test Runner Entry Point
 * Provides a menu for running different test suites
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const testSuites = {
  '1': {
    name: 'Production Test Suite',
    command: 'npm run test:puppeteer',
    description: 'Comprehensive 10-test suite for all major IDE functions'
  },
  '2': {
    name: 'Smoke Test',
    command: 'npm run test:smoke',
    description: 'Quick smoke test for basic functionality'
  },
  '3': {
    name: 'Comprehensive Test',
    command: 'npm run test:comprehensive',
    description: 'Detailed comprehensive test suite'
  },
  '4': {
    name: 'Sprite Editor Test',
    command: 'npm run test:sprite',
    description: 'Sprite editor specific tests'
  }
};

async function runTestSuite(choice) {
  const suite = testSuites[choice];
  if (!suite) {
    console.log('❌ Invalid choice');
    return;
  }

  console.log(`\n🚀 Running: ${suite.name}`);
  console.log(`📋 ${suite.description}`);
  console.log('─'.repeat(50));

  try {
    const { stdout, stderr } = await execAsync(suite.command, { stdio: 'inherit' });
    
    if (stderr) {
      console.error(`\n⚠️  Test completed with warnings:\n${stderr}`);
    }
    
    console.log(`\n✅ ${suite.name} completed`);
  } catch (error) {
    console.error(`\n❌ ${suite.name} failed:`);
    console.error(error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🎯 Web IDE Test Runner');
  console.log('=====================\n');
  
  console.log('Available Test Suites:');
  console.log('─'.repeat(50));
  
  Object.entries(testSuites).forEach(([key, suite]) => {
    console.log(`${key}. ${suite.name}`);
    console.log(`   ${suite.description}`);
  });
  
  console.log('\n0. Exit');
  console.log('─'.repeat(50));
  
  const choice = await question('\nSelect test suite (1-4, or 0 to exit): ');
  
  if (choice === '0') {
    console.log('👋 Goodbye!');
    rl.close();
    return;
  }
  
  await runTestSuite(choice);
  rl.close();
}

// Handle command line arguments
if (process.argv.length > 2) {
  const arg = process.argv[2];
  if (testSuites[arg]) {
    runTestSuite(arg).then(() => process.exit(0));
  } else {
    console.log('Usage: node tests/run-tests.js [1-4]');
    console.log('Or run without arguments for interactive menu');
    process.exit(1);
  }
} else {
  main().catch(console.error);
}