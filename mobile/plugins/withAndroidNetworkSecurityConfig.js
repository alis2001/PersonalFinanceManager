const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidNetworkSecurityConfig = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Add usesCleartextTraffic and networkSecurityConfig to application tag
    const application = androidManifest.manifest.application[0];
    
    // Enable cleartext traffic
    application.$['android:usesCleartextTraffic'] = 'true';
    
    // Add network security config reference
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    
    // Copy network security config file to res/xml
    const projectRoot = config.modRequest.projectRoot;
    const networkConfigSource = path.join(projectRoot, 'android-network-security-config.xml');
    const networkConfigDest = path.join(
      projectRoot,
      'android',
      'app',
      'src',
      'main',
      'res',
      'xml',
      'network_security_config.xml'
    );
    
    // Create xml directory if it doesn't exist
    const xmlDir = path.dirname(networkConfigDest);
    if (!fs.existsSync(xmlDir)) {
      fs.mkdirSync(xmlDir, { recursive: true });
    }
    
    // Copy the file
    if (fs.existsSync(networkConfigSource)) {
      fs.copyFileSync(networkConfigSource, networkConfigDest);
      console.log('✅ Network security config copied to android/app/src/main/res/xml/');
    }
    
    return config;
  });
};

module.exports = withAndroidNetworkSecurityConfig;

