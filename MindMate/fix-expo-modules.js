// fix-expo-modules.js
const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', 'expo-modules-core', 'android', 'build.gradle');

try {
  // Read the current file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if the file has already been modified
  if (content.includes('suppressKotlinVersionCompatibilityCheck')) {
    console.log('File already modified, skipping...');
    process.exit(0);
  }
  
  // Add the property just after the plugin declarations
  const modifiedContent = content.replace(
    "apply plugin: 'com.android.library'\napply plugin: 'kotlin-android'",
    "apply plugin: 'com.android.library'\napply plugin: 'kotlin-android'\n\n// Fix for Kotlin version compatibility\nkotlin {\n    jvmToolchain(17)\n}\n\nandroid.kotlinOptions.freeCompilerArgs += [\n    \"-Xskip-metadata-version-check\",\n    \"-Xsuppress-version-warnings\"\n]"
  );
  
  // Write the modified content back to the file
  fs.writeFileSync(filePath, modifiedContent, 'utf8');
  console.log('Successfully modified expo-modules-core build.gradle file');
} catch (error) {
  console.error('Error modifying file:', error);
  process.exit(1);
}