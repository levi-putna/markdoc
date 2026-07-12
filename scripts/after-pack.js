// @ts-check
'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Runs after electron-builder packs the app but before signing/installers.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    embedQuickLookAppex(context);
  }
};

/**
 * Embed the Quick Look preview extension into the packaged app bundle.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
function embedQuickLookAppex(context) {
  const projectDir = context.packager.projectDir;
  const appexSrc = path.resolve(
    projectDir,
    'macos',
    'QuickLookExtension',
    'build',
    'MarkDocQuickLook.appex'
  );

  if (!fs.existsSync(appexSrc)) {
    console.warn(
      `after-pack: MarkDocQuickLook.appex not found at ${appexSrc}; skipping (run yarn build:quicklook first)`
    );
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const plugins = path.join(context.appOutDir, appName, 'Contents', 'PlugIns');
  fs.mkdirSync(plugins, { recursive: true });

  const dest = path.join(plugins, 'MarkDocQuickLook.appex');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(appexSrc, dest, { recursive: true });
  console.log(`after-pack: embedded Quick Look appex at ${dest}`);
};
