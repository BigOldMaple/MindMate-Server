// Fixed version of androidManifestPlugin.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function androidManifestPlugin(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults.manifest;

    // Add the Health Connect permissions rationale intent filter
    // First check if it exists to avoid duplicates
    let rationaleExists = false;
    
    // Make sure the activity exists and has intent-filter array
    if (androidManifest.application[0].activity[0]['intent-filter']) {
      // Check if the rationale intent filter already exists
      for (const filter of androidManifest.application[0].activity[0]['intent-filter']) {
        if (filter.action && Array.isArray(filter.action)) {
          for (const action of filter.action) {
            if (action.$ && action.$['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE') {
              rationaleExists = true;
              break;
            }
          }
        }
        if (rationaleExists) break;
      }
    } else {
      // Create intent-filter array if it doesn't exist
      androidManifest.application[0].activity[0]['intent-filter'] = [];
    }
    
    // Add the rationale intent filter if it doesn't exist
    if (!rationaleExists) {
      console.log("Adding Health Connect permissions rationale intent filter");
      androidManifest.application[0].activity[0]['intent-filter'].push({
        action: [
          {
            $: {
              'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE',
            },
          },
        ],
      });
    }

    // Make sure metadata array exists
    if (!androidManifest.application[0]['meta-data']) {
      androidManifest.application[0]['meta-data'] = [];
    }

    // Check if client metadata already exists
    let clientMetadataExists = false;
    for (const metadata of androidManifest.application[0]['meta-data']) {
      if (metadata.$ && metadata.$['android:name'] === 'androidx.health.connect.client.APP_ID') {
        clientMetadataExists = true;
        break;
      }
    }

    // Add the Health Connect client metadata if needed
    if (!clientMetadataExists) {
      console.log("Adding Health Connect client metadata");
      androidManifest.application[0]['meta-data'].push({
        $: {
          'android:name': 'androidx.health.connect.client.APP_ID',
          'android:value': 'com.nikodemmech.MindMate'
        }
      });
    }

    // Check if provider metadata already exists
    let providerMetadataExists = false;
    for (const metadata of androidManifest.application[0]['meta-data']) {
      if (metadata.$ && metadata.$['android:name'] === 'androidx.health.connect.PROVIDER') {
        providerMetadataExists = true;
        break;
      }
    }

    // Add the Health Connect provider metadata if needed
    if (!providerMetadataExists) {
      console.log("Adding Health Connect provider metadata");
      androidManifest.application[0]['meta-data'].push({
        $: {
          'android:name': 'androidx.health.connect.PROVIDER',
          'android:value': 'true'
        }
      });
    }

    // Add logging to confirm the changes
    console.log("Android manifest modifications complete!");
    
    return config;
  });
};