import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import caddyfileGrammar from "../syntaxes/caddyfile.tmLanguage.json" with { type: "json" };

const languages = [{ ...caddyfileGrammar, aliases: ["caddy"], name: "caddyfile" }];

export default defineConfig({
  site: "https://willibrandon.github.io",
  base: "/vscode-caddyfile",
  trailingSlash: "always",
  publicDir: "../media",
  integrations: [
    starlight({
      title: "Caddyfile",
      description: "Caddyfile editing in Visual Studio Code.",
      favicon: "/icon.svg",
      customCss: ["./src/styles/docs.css"],
      credits: false,
      components: {
        MarkdownContent: "./src/components/MarkdownContent.astro",
      },
      expressiveCode: {
        shiki: {
          langs: languages,
        },
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/willibrandon/vscode-caddyfile",
        },
      ],
      sidebar: [
        { slug: "", label: "Overview" },
        { slug: "getting-started" },
        { slug: "editing" },
        { slug: "imports" },
        { slug: "caddy-checks" },
        { slug: "settings" },
        { slug: "commands" },
        { slug: "privacy-and-trust" },
        { slug: "troubleshooting" },
      ],
    }),
    sitemap(),
  ],
});
