/**
 * Simple Build Script for Textverktyg
 * Bundles client-side JavaScript using esbuild and compiles SCSS
 */

import * as esbuild from "esbuild";
import * as sass from "sass";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Convert ESM module paths to filesystem paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple environment detection
const isProduction = process.env.NODE_ENV === "production";

// Create output directories
const scriptBuildDir = path.join(__dirname, "public", "script");
const cssBuildDir = path.join(__dirname, "public", "css");

if (!fs.existsSync(scriptBuildDir)) {
  fs.mkdirSync(scriptBuildDir, { recursive: true });
}
if (!fs.existsSync(cssBuildDir)) {
  fs.mkdirSync(cssBuildDir, { recursive: true });
}

// Simple build configuration
const buildOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  target: ["es2020"],
  drop: isProduction ? ["console", "debugger"] : [],
  treeShaking: true,
  legalComments: "none",
  charset: "utf8",
  outbase: "src",
  loader: {
    ".js": "jsx",
    ".ts": "ts",
    ".svg": "dataurl",
    ".png": "dataurl",
    ".jpg": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
  },
};

/**
 * Compile SCSS to CSS
 */
async function buildCSS() {
  try {
    const scssFile = path.join(__dirname, "public", "css", "app-main.scss");
    const cssFile = path.join(cssBuildDir, "app-main.css");
    const mapFile = path.join(cssBuildDir, "app-main.css.map");

    if (!fs.existsSync(scssFile)) {
      throw new Error(`SCSS file not found: ${scssFile}`);
    }

    console.log("🎨 Compiling SCSS...");

    const result = sass.compile(scssFile, {
      sourceMap: !isProduction,
      style: isProduction ? "compressed" : "expanded",
    });

    // Write CSS file
    fs.writeFileSync(cssFile, result.css);

    // Write source map if available
    if (result.sourceMap && !isProduction) {
      fs.writeFileSync(mapFile, JSON.stringify(result.sourceMap));
    }

    console.log(`✅ SCSS compiled successfully`);
    console.log(`📦 Output: public/css/app-main.css`);
  } catch (error) {
    console.error("❌ SCSS compilation failed:", error);
    process.exit(1);
  }
}

/**
 * Build the main application bundles
 */
async function buildJS() {
  try {
    const entryPoint = fs.existsSync("src/client/main.ts")
      ? "src/client/main.ts"
      : "src/client/main.js";
    const adminEntryPoint = "src/client/admin/main.ts";

    if (!fs.existsSync(entryPoint)) {
      throw new Error(`Entry point not found: ${entryPoint}`);
    }
    if (!fs.existsSync(adminEntryPoint)) {
      throw new Error(`Entry point not found: ${adminEntryPoint}`);
    }

    console.log(`🚀 Building JavaScript from ${entryPoint}...`);

    await esbuild.build({
      ...buildOptions,
      entryPoints: [entryPoint],
      outfile: path.join(scriptBuildDir, "app-main.js"),
      format: "iife",
      globalName: "AppModule",
      footer: {
        js: `
          // Expose AppModule to window
          if (typeof window !== 'undefined') {
            window.AppModule = AppModule;
          }
        `,
      },
    });

    console.log(`✅ JavaScript build completed successfully`);
    console.log(`📦 Output: public/script/app-main.js`);

    console.log(`🚀 Building Admin UI JavaScript from ${adminEntryPoint}...`);

    await esbuild.build({
      ...buildOptions,
      entryPoints: [adminEntryPoint],
      outfile: path.join(scriptBuildDir, "admin-ui.js"),
      format: "iife",
      globalName: "AdminModule",
      footer: {
        js: `
          // Expose AdminModule to window
          if (typeof window !== 'undefined') {
            window.AdminModule = AdminModule;
          }
        `,
      },
    });

    console.log(`✅ Admin UI JavaScript build completed successfully`);
    console.log(`📦 Output: public/script/admin-ui.js`);
  } catch (error) {
    console.error("❌ JavaScript build failed:", error);
    process.exit(1);
  }
}

/**
 * Main build function
 */
async function build() {
  try {
    console.log(`🏗️  Starting build (${isProduction ? 'production' : 'development'} mode)...`);
    
    // Build both CSS and JavaScript in parallel
    await Promise.all([
      buildCSS(),
      buildJS()
    ]);

    console.log(`🎉 Build completed successfully!`);
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

// Execute the build
build();
