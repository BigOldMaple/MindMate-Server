const fs = require('fs');
const path = require('path');

// Path to the expo-modules-core build.gradle file
const filePath = path.join('node_modules', 'expo-modules-core', 'android', 'build.gradle');

try {
  console.log('Fixing expo-modules-core build.gradle...');
  
  // Read the file content
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if the file already has the fix
  if (content.includes('suppressKotlinVersionCompatibilityCheck = true')) {
    console.log('File already contains the fix, skipping...');
    process.exit(0);
  }
  
  // Look for the android { ... } block in the file
  if (content.includes('android {')) {
    // Add the kotlinOptions block inside the android block
    content = content.replace(
      'android {',
      `android {
    kotlinOptions {
        suppressKotlinVersionCompatibilityCheck = true
        freeCompilerArgs += [
            "-Xskip-metadata-version-check",
            "-Xsuppress-version-warnings"
        ]
    }`
    );
  } else {
    // If there's no android block, add it after the kotlin-android plugin
    content = content.replace(
      "apply plugin: 'kotlin-android'",
      `apply plugin: 'kotlin-android'

android {
    kotlinOptions {
        suppressKotlinVersionCompatibilityCheck = true
        freeCompilerArgs += [
            "-Xskip-metadata-version-check",
            "-Xsuppress-version-warnings"
        ]
    }
}`
    );
  }
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully fixed expo-modules-core build.gradle');
} catch (error) {
  console.error('Error fixing expo-modules-core build.gradle:', error);
  process.exit(1);
}