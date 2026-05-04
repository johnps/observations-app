const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withUniversalApk(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /def enableSeparateBuildPerCPUArchitecture\s*=\s*(true|false)/,
      'def enableSeparateBuildPerCPUArchitecture = false'
    );
    return config;
  });
};
