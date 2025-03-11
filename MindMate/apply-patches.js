const fs = require('fs');
const path = require('path');

// Fix the expo-modules-core build.gradle file
function fixExpoModulesCore() {
  const filePath = path.join('node_modules', 'expo-modules-core', 'android', 'build.gradle');
  
  try {
    console.log('Patching expo-modules-core build.gradle...');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already patched
    if (content.includes('kotlinOptions.suppressKotlinVersionCompatibilityCheck')) {
      console.log('Already patched, skipping...');
      return;
    }
    
    // Add Kotlin options
    const kotlinPlugin = 'apply plugin: \'kotlin-android\'';
    const patchedContent = content.replace(
      kotlinPlugin,
      `${kotlinPlugin}

// Fix for Kotlin version compatibility
android {
    kotlinOptions {
        kotlinOptions.suppressKotlinVersionCompatibilityCheck = true
        freeCompilerArgs += [
            "-Xskip-metadata-version-check",
            "-Xsuppress-version-warnings"
        ]
    }
}`
    );
    
    fs.writeFileSync(filePath, patchedContent, 'utf8');
    console.log('Successfully patched expo-modules-core build.gradle');
  } catch (error) {
    console.error('Error patching file:', error);
  }
}

// Fix the android/build.gradle file to force Kotlin versions
function fixRootBuildGradle() {
  const filePath = path.join('android', 'build.gradle');
  
  try {
    console.log('Patching android/build.gradle...');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already patched
    if (content.includes('subprojects { subproject ->')) {
      console.log('Already patched, skipping...');
      return;
    }
    
    // Add subprojects configuration to handle Kotlin compiler args
    const applyRootPlugin = 'apply plugin: "com.facebook.react.rootproject"';
    const patchedContent = content.replace(
      applyRootPlugin,
      `${applyRootPlugin}

// Add this specific fix for Kotlin compiler
subprojects { subproject ->
    subproject.plugins.withId("org.jetbrains.kotlin.android") {
        subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
            kotlinOptions {
                freeCompilerArgs += [
                    "-Xskip-metadata-version-check",
                    "-Xskip-prerelease-check",
                    "-Xsuppress-version-warnings"
                ]
                suppressKotlinVersionCompatibilityCheck = true
            }
        }
    }
}`
    );
    
    fs.writeFileSync(filePath, patchedContent, 'utf8');
    console.log('Successfully patched android/build.gradle');
  } catch (error) {
    console.error('Error patching file:', error);
  }
}

// Run the patches
fixExpoModulesCore();
fixRootBuildGradle();