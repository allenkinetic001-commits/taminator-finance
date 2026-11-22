// vite.config.js
import { ViteEjsPlugin } from "file:///app/applet/web/node_modules/vite-plugin-ejs/index.js";
import { ViteMinifyPlugin } from "file:///app/applet/web/node_modules/vite-plugin-minify/dist/index.js";
import basicSsl from "file:///app/applet/web/node_modules/@vitejs/plugin-basic-ssl/dist/index.mjs";
import path from "path";
import { sentryVitePlugin } from "file:///app/applet/web/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import svgLoader from "file:///app/applet/web/node_modules/vite-svg-loader/index.js";
import vue from "file:///app/applet/web/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { defineConfig, loadEnv } from "file:///app/applet/web/node_modules/vite/dist/node/index.js";
import { nodePolyfills } from "file:///app/applet/web/node_modules/vite-plugin-node-polyfills/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const isHttps = process.argv.includes("--https");
  const loadedEnv = loadEnv(mode, "./");
  const env = {
    VITE_BUILD_TYPE: "web",
    VITE_PLATFORM: "web",
    VITE_DISTRIBUTION: "web",
    VITE_NAME: "Taminator",
    VITE_VERSION: "6.33.0",
    VITE_SITE_URL: "",
    VITE_API_CSP: "",
    ...loadedEnv
  };
  return {
    define: {
      "import.meta.env.VITE_BUILD_TYPE": JSON.stringify(env.VITE_BUILD_TYPE),
      "import.meta.env.VITE_PLATFORM": JSON.stringify(env.VITE_PLATFORM),
      "import.meta.env.VITE_DISTRIBUTION": JSON.stringify(env.VITE_DISTRIBUTION),
      "import.meta.env.VITE_NAME": JSON.stringify(env.VITE_NAME),
      "import.meta.env.VITE_VERSION": JSON.stringify(env.VITE_VERSION)
    },
    server: {
      port: 3e3,
      host: "0.0.0.0",
      strictPort: true,
      proxy: {
        "/api": { target: "http://localhost:8080", headers: isHttps ? { "X-Forwarded-Proto": "https" } : {} }
      }
    },
    base: process.env.BASE_URL || "/",
    plugins: [
      nodePolyfills(),
      vue({
        template: {
          compilerOptions: {
            nodeTransforms: [bem]
          }
        }
      }),
      svgLoader({ svgo: false }),
      sfcAutoName(),
      moneroCoreStub(),
      ViteEjsPlugin({ env }),
      ViteMinifyPlugin(),
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        telemetry: false,
        sourcemaps: {
          filesToDeleteAfterUpload: outDir(env.VITE_BUILD_TYPE) + "/**/*.map"
        },
        disable: !process.env.SENTRY_AUTH_TOKEN
      }),
      ...isHttps ? [basicSsl()] : []
    ],
    build: {
      minify: true,
      outDir: outDir(env.VITE_BUILD_TYPE),
      emptyOutDir: true,
      sourcemap: "hidden",
      rollupOptions: {
        external: ["apexcharts/ssr"],
        input: inputs(env.VITE_BUILD_TYPE),
        preserveEntrySignatures: env.VITE_BUILD_TYPE === "electron" ? "exports-only" : void 0,
        output: {
          entryFileNames(info) {
            if (info.name === "variables") {
              return "variables.js";
            }
            if (info.name === "schemes") {
              return "schemes.js";
            }
            return "assets/js/[name]-[hash].js";
          },
          chunkFileNames(info) {
            const defaultName = "assets/js/[name]-[hash].js";
            if (/src\/lib\/i18n\/messages\/[a-z-]+\.json/.test(info.facadeModuleId)) {
              const match = /messages\/([a-z-]+).json/.exec(info.facadeModuleId);
              return `assets/js/i18n/${match[1]}-[hash].js`;
            }
            if (info.name === "index") {
              const id = info.facadeModuleId || info.moduleIds[0];
              const match = /node_modules\/((@[^/]*\/)?[^/]*)\//.exec(id);
              if (!match)
                return defaultName;
              return `assets/js/${match[1]}-[hash].js`;
            }
            return defaultName;
          },
          assetFileNames({ name }) {
            let dir = "";
            if (/\.css$/.test(name))
              dir = "css/";
            if (/\.wasm$/.test(name))
              dir = "wasm/";
            if (/\.svg$/.test(name))
              dir = "img/";
            return `assets/${dir}[name]-[hash][extname]`;
          }
        }
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ["legacy-js-api", "import", "global-builtin"],
          additionalData: (content, filename) => {
            const kebab = kebabanize(filename);
            const str = `
              @import "./src/assets/styles/mixins";
              $filename: "${kebab}";
            `;
            return str + content;
          }
        }
      }
    }
  };
});
function kebabanize(componentPath) {
  return path.basename(componentPath, ".vue").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
function bem(node, context) {
  if (!node.props)
    return;
  const kebab = kebabanize(context.selfName);
  node.props.forEach((prop) => {
    var _a;
    if (prop.name === "class") {
      prop.value.content = prop.value.content.replace(/&/g, kebab);
    }
    if (prop.name === "bind" && ((_a = prop.arg) == null ? void 0 : _a.content) === "class") {
      if (prop.exp.children) {
        prop.exp.children = prop.exp.children.map((child) => {
          if (typeof child === "string") {
            child = child.replace(/&([-_])/g, `${kebab}$1`);
          }
          return child;
        });
      }
      if (prop.exp.content) {
        prop.exp.content = prop.exp.content.replace(/&/g, kebab);
      }
    }
  });
}
function sfcAutoName() {
  return {
    name: "sfc-auto-name",
    enforce: "pre",
    transform(code, id) {
      if (!/\.vue$/.test(id))
        return;
      const name = path.basename(id, ".vue");
      return {
        code: code.replace(/(export default \{)/, `$1 name: '${name}',`),
        map: null
      };
    }
  };
}
function outDir(buildType) {
  switch (buildType) {
    case "electron":
      return "../electron/dist";
    case "phonegap":
      return "../phonegap/build/www";
    default:
      return "../server/dist";
  }
}
function moneroCoreStub() {
  const virtualId = "\0monero-core-stub";
  return {
    name: "monero-core-stub",
    resolveId(source, importer) {
      if ((source === "./build/MoneroCoreJS.js" || source === "./build/MoneroCoreJS.asm.js") && (importer == null ? void 0 : importer.includes("monero-core-js"))) {
        return virtualId;
      }
      return null;
    },
    load(id) {
      if (id === virtualId) {
        return 'export default async function() { throw new Error("MoneroCoreJS wasm is not built in this environment"); }';
      }
      return null;
    }
  };
}
function inputs(buildType) {
  const inputs2 = {
    main: "./index.html"
  };
  if (buildType === "web") {
    inputs2["fido"] = "./fido/index.html";
  }
  if (buildType === "electron") {
    inputs2["variables"] = "./src/variables.js";
    inputs2["schemes"] = "./src/lib/schemes.js";
  }
  return inputs2;
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2FwcGxldC93ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvYXBwbGV0L3dlYi92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vYXBwL2FwcGxldC93ZWIvdml0ZS5jb25maWcuanNcIjsvKiBlc2xpbnQtZW52IG5vZGUgKi9cbmltcG9ydCB7IFZpdGVFanNQbHVnaW4gfSBmcm9tICd2aXRlLXBsdWdpbi1lanMnO1xuaW1wb3J0IHsgVml0ZU1pbmlmeVBsdWdpbiB9IGZyb20gJ3ZpdGUtcGx1Z2luLW1pbmlmeSc7XG5pbXBvcnQgYmFzaWNTc2wgZnJvbSAnQHZpdGVqcy9wbHVnaW4tYmFzaWMtc3NsJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgc2VudHJ5Vml0ZVBsdWdpbiB9IGZyb20gJ0BzZW50cnkvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IHN2Z0xvYWRlciBmcm9tICd2aXRlLXN2Zy1sb2FkZXInO1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSc7XG5cbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgaXNIdHRwcyA9IHByb2Nlc3MuYXJndi5pbmNsdWRlcygnLS1odHRwcycpO1xuICBjb25zdCBsb2FkZWRFbnYgPSBsb2FkRW52KG1vZGUsICcuLycpO1xuICBjb25zdCBlbnYgPSB7XG4gICAgVklURV9CVUlMRF9UWVBFOiAnd2ViJyxcbiAgICBWSVRFX1BMQVRGT1JNOiAnd2ViJyxcbiAgICBWSVRFX0RJU1RSSUJVVElPTjogJ3dlYicsXG4gICAgVklURV9OQU1FOiAnVGFtaW5hdG9yJyxcbiAgICBWSVRFX1ZFUlNJT046ICc2LjMzLjAnLFxuICAgIFZJVEVfU0lURV9VUkw6ICcnLFxuICAgIFZJVEVfQVBJX0NTUDogJycsXG4gICAgLi4ubG9hZGVkRW52LFxuICB9O1xuICByZXR1cm4ge1xuICAgIGRlZmluZToge1xuICAgICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX0JVSUxEX1RZUEUnOiBKU09OLnN0cmluZ2lmeShlbnYuVklURV9CVUlMRF9UWVBFKSxcbiAgICAgICdpbXBvcnQubWV0YS5lbnYuVklURV9QTEFURk9STSc6IEpTT04uc3RyaW5naWZ5KGVudi5WSVRFX1BMQVRGT1JNKSxcbiAgICAgICdpbXBvcnQubWV0YS5lbnYuVklURV9ESVNUUklCVVRJT04nOiBKU09OLnN0cmluZ2lmeShlbnYuVklURV9ESVNUUklCVVRJT04pLFxuICAgICAgJ2ltcG9ydC5tZXRhLmVudi5WSVRFX05BTUUnOiBKU09OLnN0cmluZ2lmeShlbnYuVklURV9OQU1FKSxcbiAgICAgICdpbXBvcnQubWV0YS5lbnYuVklURV9WRVJTSU9OJzogSlNPTi5zdHJpbmdpZnkoZW52LlZJVEVfVkVSU0lPTiksXG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDMwMDAsXG4gICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJy9hcGknOiB7IHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODA4MCcsIGhlYWRlcnM6IGlzSHR0cHMgPyB7ICdYLUZvcndhcmRlZC1Qcm90byc6ICdodHRwcycgfSA6IHt9IH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgYmFzZTogcHJvY2Vzcy5lbnYuQkFTRV9VUkwgfHwgJy8nLFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIG5vZGVQb2x5ZmlsbHMoKSxcbiAgICAgIHZ1ZSh7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICAgICAgICBub2RlVHJhbnNmb3JtczogW2JlbV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgc3ZnTG9hZGVyKHsgc3ZnbzogZmFsc2UgfSksXG4gICAgICBzZmNBdXRvTmFtZSgpLFxuICAgICAgbW9uZXJvQ29yZVN0dWIoKSxcbiAgICAgIFZpdGVFanNQbHVnaW4oeyBlbnYgfSksXG4gICAgICBWaXRlTWluaWZ5UGx1Z2luKCksXG4gICAgICBzZW50cnlWaXRlUGx1Z2luKHtcbiAgICAgICAgb3JnOiBwcm9jZXNzLmVudi5TRU5UUllfT1JHLFxuICAgICAgICBwcm9qZWN0OiBwcm9jZXNzLmVudi5TRU5UUllfUFJPSkVDVCxcbiAgICAgICAgYXV0aFRva2VuOiBwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTixcbiAgICAgICAgdGVsZW1ldHJ5OiBmYWxzZSxcbiAgICAgICAgc291cmNlbWFwczoge1xuICAgICAgICAgIGZpbGVzVG9EZWxldGVBZnRlclVwbG9hZDogb3V0RGlyKGVudi5WSVRFX0JVSUxEX1RZUEUpICsgJy8qKi8qLm1hcCcsXG4gICAgICAgIH0sXG4gICAgICAgIGRpc2FibGU6ICFwcm9jZXNzLmVudi5TRU5UUllfQVVUSF9UT0tFTixcbiAgICAgIH0pLFxuICAgICAgLi4uKGlzSHR0cHMgPyBbYmFzaWNTc2woKV0gOiBbXSksXG4gICAgXSxcbiAgICBidWlsZDoge1xuICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgb3V0RGlyOiBvdXREaXIoZW52LlZJVEVfQlVJTERfVFlQRSksXG4gICAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAgIHNvdXJjZW1hcDogJ2hpZGRlbicsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIGV4dGVybmFsOiBbJ2FwZXhjaGFydHMvc3NyJ10sXG4gICAgICAgIGlucHV0OiBpbnB1dHMoZW52LlZJVEVfQlVJTERfVFlQRSksXG4gICAgICAgIHByZXNlcnZlRW50cnlTaWduYXR1cmVzOiBlbnYuVklURV9CVUlMRF9UWVBFID09PSAnZWxlY3Ryb24nID8gJ2V4cG9ydHMtb25seScgOiB1bmRlZmluZWQsXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIGVudHJ5RmlsZU5hbWVzKGluZm8pIHtcbiAgICAgICAgICAgIGlmIChpbmZvLm5hbWUgPT09ICd2YXJpYWJsZXMnKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmFyaWFibGVzLmpzJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmZvLm5hbWUgPT09ICdzY2hlbWVzJykge1xuICAgICAgICAgICAgICByZXR1cm4gJ3NjaGVtZXMuanMnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcyc7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBjaHVua0ZpbGVOYW1lcyhpbmZvKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0TmFtZSA9ICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcyc7XG4gICAgICAgICAgICBpZiAoL3NyY1xcL2xpYlxcL2kxOG5cXC9tZXNzYWdlc1xcL1thLXotXStcXC5qc29uLy50ZXN0KGluZm8uZmFjYWRlTW9kdWxlSWQpKSB7XG4gICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gL21lc3NhZ2VzXFwvKFthLXotXSspLmpzb24vLmV4ZWMoaW5mby5mYWNhZGVNb2R1bGVJZCk7XG4gICAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL2pzL2kxOG4vJHttYXRjaFsxXX0tW2hhc2hdLmpzYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpbmZvLm5hbWUgPT09ICdpbmRleCcpIHtcbiAgICAgICAgICAgICAgY29uc3QgaWQgPSBpbmZvLmZhY2FkZU1vZHVsZUlkIHx8IGluZm8ubW9kdWxlSWRzWzBdO1xuICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IC9ub2RlX21vZHVsZXNcXC8oKEBbXi9dKlxcLyk/W14vXSopXFwvLy5leGVjKGlkKTtcbiAgICAgICAgICAgICAgaWYgKCFtYXRjaCkgcmV0dXJuIGRlZmF1bHROYW1lO1xuICAgICAgICAgICAgICByZXR1cm4gYGFzc2V0cy9qcy8ke21hdGNoWzFdfS1baGFzaF0uanNgO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRlZmF1bHROYW1lO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgYXNzZXRGaWxlTmFtZXMoeyBuYW1lIH0pIHtcbiAgICAgICAgICAgIGxldCBkaXIgPSAnJztcbiAgICAgICAgICAgIGlmICgvXFwuY3NzJC8udGVzdChuYW1lKSkgZGlyID0gJ2Nzcy8nO1xuICAgICAgICAgICAgaWYgKC9cXC53YXNtJC8udGVzdChuYW1lKSkgZGlyID0gJ3dhc20vJztcbiAgICAgICAgICAgIGlmICgvXFwuc3ZnJC8udGVzdChuYW1lKSkgZGlyID0gJ2ltZy8nO1xuICAgICAgICAgICAgcmV0dXJuIGBhc3NldHMvJHtkaXJ9W25hbWVdLVtoYXNoXVtleHRuYW1lXWA7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjc3M6IHtcbiAgICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcbiAgICAgICAgc2Nzczoge1xuICAgICAgICAgIHNpbGVuY2VEZXByZWNhdGlvbnM6IFsnbGVnYWN5LWpzLWFwaScsICdpbXBvcnQnLCAnZ2xvYmFsLWJ1aWx0aW4nXSxcbiAgICAgICAgICBhZGRpdGlvbmFsRGF0YTogKGNvbnRlbnQsIGZpbGVuYW1lKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBrZWJhYiA9IGtlYmFiYW5pemUoZmlsZW5hbWUpO1xuICAgICAgICAgICAgY29uc3Qgc3RyID0gYFxuICAgICAgICAgICAgICBAaW1wb3J0IFwiLi9zcmMvYXNzZXRzL3N0eWxlcy9taXhpbnNcIjtcbiAgICAgICAgICAgICAgJGZpbGVuYW1lOiBcIiR7a2ViYWJ9XCI7XG4gICAgICAgICAgICBgO1xuICAgICAgICAgICAgcmV0dXJuIHN0ciArIGNvbnRlbnQ7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcbn0pO1xuXG5mdW5jdGlvbiBrZWJhYmFuaXplKGNvbXBvbmVudFBhdGgpIHtcbiAgcmV0dXJuIHBhdGguYmFzZW5hbWUoY29tcG9uZW50UGF0aCwgJy52dWUnKS5yZXBsYWNlKC8oW2EtejAtOV0pKFtBLVpdKS9nLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBiZW0obm9kZSwgY29udGV4dCkge1xuICBpZiAoIW5vZGUucHJvcHMpIHJldHVybjtcbiAgY29uc3Qga2ViYWIgPSBrZWJhYmFuaXplKGNvbnRleHQuc2VsZk5hbWUpO1xuICBub2RlLnByb3BzLmZvckVhY2goKHByb3ApID0+IHtcbiAgICBpZiAocHJvcC5uYW1lID09PSAnY2xhc3MnKSB7XG4gICAgICBwcm9wLnZhbHVlLmNvbnRlbnQgPSBwcm9wLnZhbHVlLmNvbnRlbnQucmVwbGFjZSgvJi9nLCBrZWJhYik7XG4gICAgfVxuICAgIGlmIChwcm9wLm5hbWUgPT09ICdiaW5kJyAmJiBwcm9wLmFyZz8uY29udGVudCA9PT0gJ2NsYXNzJykge1xuICAgICAgaWYgKHByb3AuZXhwLmNoaWxkcmVuKSB7XG4gICAgICAgIHByb3AuZXhwLmNoaWxkcmVuID0gcHJvcC5leHAuY2hpbGRyZW4ubWFwKChjaGlsZCkgPT4ge1xuICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjaGlsZCA9IGNoaWxkLnJlcGxhY2UoLyYoWy1fXSkvZywgYCR7a2ViYWJ9JDFgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGNoaWxkO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChwcm9wLmV4cC5jb250ZW50KSB7XG4gICAgICAgIHByb3AuZXhwLmNvbnRlbnQgPSBwcm9wLmV4cC5jb250ZW50LnJlcGxhY2UoLyYvZywga2ViYWIpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHNmY0F1dG9OYW1lKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdzZmMtYXV0by1uYW1lJyxcbiAgICBlbmZvcmNlOiAncHJlJyxcbiAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcbiAgICAgIGlmICghL1xcLnZ1ZSQvLnRlc3QoaWQpKSByZXR1cm47XG4gICAgICBjb25zdCBuYW1lID0gcGF0aC5iYXNlbmFtZShpZCwgJy52dWUnKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvZGU6IGNvZGUucmVwbGFjZSgvKGV4cG9ydCBkZWZhdWx0IFxceykvLCBgJDEgbmFtZTogJyR7bmFtZX0nLGApLFxuICAgICAgICBtYXA6IG51bGwsXG4gICAgICB9O1xuICAgIH0sXG4gIH07XG59XG5cbmZ1bmN0aW9uIG91dERpcihidWlsZFR5cGUpIHtcbiAgc3dpdGNoIChidWlsZFR5cGUpIHtcbiAgICBjYXNlICdlbGVjdHJvbic6XG4gICAgICByZXR1cm4gJy4uL2VsZWN0cm9uL2Rpc3QnO1xuICAgIGNhc2UgJ3Bob25lZ2FwJzpcbiAgICAgIHJldHVybiAnLi4vcGhvbmVnYXAvYnVpbGQvd3d3JztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcuLi9zZXJ2ZXIvZGlzdCc7XG4gIH1cbn1cblxuZnVuY3Rpb24gbW9uZXJvQ29yZVN0dWIoKSB7XG4gIGNvbnN0IHZpcnR1YWxJZCA9ICdcXDBtb25lcm8tY29yZS1zdHViJztcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnbW9uZXJvLWNvcmUtc3R1YicsXG4gICAgcmVzb2x2ZUlkKHNvdXJjZSwgaW1wb3J0ZXIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKHNvdXJjZSA9PT0gJy4vYnVpbGQvTW9uZXJvQ29yZUpTLmpzJyB8fCBzb3VyY2UgPT09ICcuL2J1aWxkL01vbmVyb0NvcmVKUy5hc20uanMnKVxuICAgICAgICAmJiBpbXBvcnRlcj8uaW5jbHVkZXMoJ21vbmVyby1jb3JlLWpzJylcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gdmlydHVhbElkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBsb2FkKGlkKSB7XG4gICAgICBpZiAoaWQgPT09IHZpcnR1YWxJZCkge1xuICAgICAgICByZXR1cm4gJ2V4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uKCkgeyB0aHJvdyBuZXcgRXJyb3IoXCJNb25lcm9Db3JlSlMgd2FzbSBpcyBub3QgYnVpbHQgaW4gdGhpcyBlbnZpcm9ubWVudFwiKTsgfSc7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnB1dHMoYnVpbGRUeXBlKSB7XG4gIGNvbnN0IGlucHV0cyA9IHtcbiAgICBtYWluOiAnLi9pbmRleC5odG1sJyxcbiAgfTtcbiAgaWYgKGJ1aWxkVHlwZSA9PT0gJ3dlYicpIHtcbiAgICBpbnB1dHNbJ2ZpZG8nXSA9ICcuL2ZpZG8vaW5kZXguaHRtbCc7XG4gIH1cbiAgaWYgKGJ1aWxkVHlwZSA9PT0gJ2VsZWN0cm9uJykge1xuICAgIGlucHV0c1sndmFyaWFibGVzJ10gPSAnLi9zcmMvdmFyaWFibGVzLmpzJztcbiAgICBpbnB1dHNbJ3NjaGVtZXMnXSA9ICcuL3NyYy9saWIvc2NoZW1lcy5qcyc7XG4gIH1cbiAgcmV0dXJuIGlucHV0cztcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxPQUFPLGNBQWM7QUFDckIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsd0JBQXdCO0FBQ2pDLE9BQU8sZUFBZTtBQUN0QixPQUFPLFNBQVM7QUFDaEIsU0FBUyxjQUFjLGVBQWU7QUFFdEMsU0FBUyxxQkFBcUI7QUFFOUIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxVQUFVLFFBQVEsS0FBSyxTQUFTLFNBQVM7QUFDL0MsUUFBTSxZQUFZLFFBQVEsTUFBTSxJQUFJO0FBQ3BDLFFBQU0sTUFBTTtBQUFBLElBQ1YsaUJBQWlCO0FBQUEsSUFDakIsZUFBZTtBQUFBLElBQ2YsbUJBQW1CO0FBQUEsSUFDbkIsV0FBVztBQUFBLElBQ1gsY0FBYztBQUFBLElBQ2QsZUFBZTtBQUFBLElBQ2YsY0FBYztBQUFBLElBQ2QsR0FBRztBQUFBLEVBQ0w7QUFDQSxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixtQ0FBbUMsS0FBSyxVQUFVLElBQUksZUFBZTtBQUFBLE1BQ3JFLGlDQUFpQyxLQUFLLFVBQVUsSUFBSSxhQUFhO0FBQUEsTUFDakUscUNBQXFDLEtBQUssVUFBVSxJQUFJLGlCQUFpQjtBQUFBLE1BQ3pFLDZCQUE2QixLQUFLLFVBQVUsSUFBSSxTQUFTO0FBQUEsTUFDekQsZ0NBQWdDLEtBQUssVUFBVSxJQUFJLFlBQVk7QUFBQSxJQUNqRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLFFBQ0wsUUFBUSxFQUFFLFFBQVEseUJBQXlCLFNBQVMsVUFBVSxFQUFFLHFCQUFxQixRQUFRLElBQUksQ0FBQyxFQUFFO0FBQUEsTUFDdEc7QUFBQSxJQUNGO0FBQUEsSUFDQSxNQUFNLFFBQVEsSUFBSSxZQUFZO0FBQUEsSUFDOUIsU0FBUztBQUFBLE1BQ1AsY0FBYztBQUFBLE1BQ2QsSUFBSTtBQUFBLFFBQ0YsVUFBVTtBQUFBLFVBQ1IsaUJBQWlCO0FBQUEsWUFDZixnQkFBZ0IsQ0FBQyxHQUFHO0FBQUEsVUFDdEI7QUFBQSxRQUNGO0FBQUEsTUFDRixDQUFDO0FBQUEsTUFDRCxVQUFVLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFBQSxNQUN6QixZQUFZO0FBQUEsTUFDWixlQUFlO0FBQUEsTUFDZixjQUFjLEVBQUUsSUFBSSxDQUFDO0FBQUEsTUFDckIsaUJBQWlCO0FBQUEsTUFDakIsaUJBQWlCO0FBQUEsUUFDZixLQUFLLFFBQVEsSUFBSTtBQUFBLFFBQ2pCLFNBQVMsUUFBUSxJQUFJO0FBQUEsUUFDckIsV0FBVyxRQUFRLElBQUk7QUFBQSxRQUN2QixXQUFXO0FBQUEsUUFDWCxZQUFZO0FBQUEsVUFDViwwQkFBMEIsT0FBTyxJQUFJLGVBQWUsSUFBSTtBQUFBLFFBQzFEO0FBQUEsUUFDQSxTQUFTLENBQUMsUUFBUSxJQUFJO0FBQUEsTUFDeEIsQ0FBQztBQUFBLE1BQ0QsR0FBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUFBLElBQ2hDO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixRQUFRLE9BQU8sSUFBSSxlQUFlO0FBQUEsTUFDbEMsYUFBYTtBQUFBLE1BQ2IsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLFFBQ2IsVUFBVSxDQUFDLGdCQUFnQjtBQUFBLFFBQzNCLE9BQU8sT0FBTyxJQUFJLGVBQWU7QUFBQSxRQUNqQyx5QkFBeUIsSUFBSSxvQkFBb0IsYUFBYSxpQkFBaUI7QUFBQSxRQUMvRSxRQUFRO0FBQUEsVUFDTixlQUFlLE1BQU07QUFDbkIsZ0JBQUksS0FBSyxTQUFTLGFBQWE7QUFDN0IscUJBQU87QUFBQSxZQUNUO0FBQ0EsZ0JBQUksS0FBSyxTQUFTLFdBQVc7QUFDM0IscUJBQU87QUFBQSxZQUNUO0FBQ0EsbUJBQU87QUFBQSxVQUNUO0FBQUEsVUFDQSxlQUFlLE1BQU07QUFDbkIsa0JBQU0sY0FBYztBQUNwQixnQkFBSSwwQ0FBMEMsS0FBSyxLQUFLLGNBQWMsR0FBRztBQUN2RSxvQkFBTSxRQUFRLDJCQUEyQixLQUFLLEtBQUssY0FBYztBQUNqRSxxQkFBTyxrQkFBa0IsTUFBTSxDQUFDLENBQUM7QUFBQSxZQUNuQztBQUNBLGdCQUFJLEtBQUssU0FBUyxTQUFTO0FBQ3pCLG9CQUFNLEtBQUssS0FBSyxrQkFBa0IsS0FBSyxVQUFVLENBQUM7QUFDbEQsb0JBQU0sUUFBUSxxQ0FBcUMsS0FBSyxFQUFFO0FBQzFELGtCQUFJLENBQUM7QUFBTyx1QkFBTztBQUNuQixxQkFBTyxhQUFhLE1BQU0sQ0FBQyxDQUFDO0FBQUEsWUFDOUI7QUFDQSxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxVQUNBLGVBQWUsRUFBRSxLQUFLLEdBQUc7QUFDdkIsZ0JBQUksTUFBTTtBQUNWLGdCQUFJLFNBQVMsS0FBSyxJQUFJO0FBQUcsb0JBQU07QUFDL0IsZ0JBQUksVUFBVSxLQUFLLElBQUk7QUFBRyxvQkFBTTtBQUNoQyxnQkFBSSxTQUFTLEtBQUssSUFBSTtBQUFHLG9CQUFNO0FBQy9CLG1CQUFPLFVBQVUsR0FBRztBQUFBLFVBQ3RCO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxLQUFLO0FBQUEsTUFDSCxxQkFBcUI7QUFBQSxRQUNuQixNQUFNO0FBQUEsVUFDSixxQkFBcUIsQ0FBQyxpQkFBaUIsVUFBVSxnQkFBZ0I7QUFBQSxVQUNqRSxnQkFBZ0IsQ0FBQyxTQUFTLGFBQWE7QUFDckMsa0JBQU0sUUFBUSxXQUFXLFFBQVE7QUFDakMsa0JBQU0sTUFBTTtBQUFBO0FBQUEsNEJBRUksS0FBSztBQUFBO0FBRXJCLG1CQUFPLE1BQU07QUFBQSxVQUNmO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7QUFFRCxTQUFTLFdBQVcsZUFBZTtBQUNqQyxTQUFPLEtBQUssU0FBUyxlQUFlLE1BQU0sRUFBRSxRQUFRLHNCQUFzQixPQUFPLEVBQUUsWUFBWTtBQUNqRztBQUVBLFNBQVMsSUFBSSxNQUFNLFNBQVM7QUFDMUIsTUFBSSxDQUFDLEtBQUs7QUFBTztBQUNqQixRQUFNLFFBQVEsV0FBVyxRQUFRLFFBQVE7QUFDekMsT0FBSyxNQUFNLFFBQVEsQ0FBQyxTQUFTO0FBeEkvQjtBQXlJSSxRQUFJLEtBQUssU0FBUyxTQUFTO0FBQ3pCLFdBQUssTUFBTSxVQUFVLEtBQUssTUFBTSxRQUFRLFFBQVEsTUFBTSxLQUFLO0FBQUEsSUFDN0Q7QUFDQSxRQUFJLEtBQUssU0FBUyxZQUFVLFVBQUssUUFBTCxtQkFBVSxhQUFZLFNBQVM7QUFDekQsVUFBSSxLQUFLLElBQUksVUFBVTtBQUNyQixhQUFLLElBQUksV0FBVyxLQUFLLElBQUksU0FBUyxJQUFJLENBQUMsVUFBVTtBQUNuRCxjQUFJLE9BQU8sVUFBVSxVQUFVO0FBQzdCLG9CQUFRLE1BQU0sUUFBUSxZQUFZLEdBQUcsS0FBSyxJQUFJO0FBQUEsVUFDaEQ7QUFDQSxpQkFBTztBQUFBLFFBQ1QsQ0FBQztBQUFBLE1BQ0g7QUFDQSxVQUFJLEtBQUssSUFBSSxTQUFTO0FBQ3BCLGFBQUssSUFBSSxVQUFVLEtBQUssSUFBSSxRQUFRLFFBQVEsTUFBTSxLQUFLO0FBQUEsTUFDekQ7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFQSxTQUFTLGNBQWM7QUFDckIsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sU0FBUztBQUFBLElBQ1QsVUFBVSxNQUFNLElBQUk7QUFDbEIsVUFBSSxDQUFDLFNBQVMsS0FBSyxFQUFFO0FBQUc7QUFDeEIsWUFBTSxPQUFPLEtBQUssU0FBUyxJQUFJLE1BQU07QUFDckMsYUFBTztBQUFBLFFBQ0wsTUFBTSxLQUFLLFFBQVEsdUJBQXVCLGFBQWEsSUFBSSxJQUFJO0FBQUEsUUFDL0QsS0FBSztBQUFBLE1BQ1A7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBRUEsU0FBUyxPQUFPLFdBQVc7QUFDekIsVUFBUSxXQUFXO0FBQUEsSUFDakIsS0FBSztBQUNILGFBQU87QUFBQSxJQUNULEtBQUs7QUFDSCxhQUFPO0FBQUEsSUFDVDtBQUNFLGFBQU87QUFBQSxFQUNYO0FBQ0Y7QUFFQSxTQUFTLGlCQUFpQjtBQUN4QixRQUFNLFlBQVk7QUFDbEIsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sVUFBVSxRQUFRLFVBQVU7QUFDMUIsV0FDRyxXQUFXLDZCQUE2QixXQUFXLG1DQUNqRCxxQ0FBVSxTQUFTLG9CQUN0QjtBQUNBLGVBQU87QUFBQSxNQUNUO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFBQSxJQUNBLEtBQUssSUFBSTtBQUNQLFVBQUksT0FBTyxXQUFXO0FBQ3BCLGVBQU87QUFBQSxNQUNUO0FBQ0EsYUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxTQUFTLE9BQU8sV0FBVztBQUN6QixRQUFNQSxVQUFTO0FBQUEsSUFDYixNQUFNO0FBQUEsRUFDUjtBQUNBLE1BQUksY0FBYyxPQUFPO0FBQ3ZCLElBQUFBLFFBQU8sTUFBTSxJQUFJO0FBQUEsRUFDbkI7QUFDQSxNQUFJLGNBQWMsWUFBWTtBQUM1QixJQUFBQSxRQUFPLFdBQVcsSUFBSTtBQUN0QixJQUFBQSxRQUFPLFNBQVMsSUFBSTtBQUFBLEVBQ3RCO0FBQ0EsU0FBT0E7QUFDVDsiLAogICJuYW1lcyI6IFsiaW5wdXRzIl0KfQo=
