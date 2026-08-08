import type { Plugin } from 'prettier';

interface ParserConfig {
  parser: string;
  loadPlugins: () => Promise<Plugin[]>;
}

const LANGUAGE_PARSERS: Record<string, ParserConfig> = {
  javascript: {
    parser: 'babel',
    loadPlugins: async () => [
      (await import('prettier/plugins/babel')).default,
      (await import('prettier/plugins/estree')).default,
    ],
  },
  typescript: {
    parser: 'typescript',
    loadPlugins: async () => [
      (await import('prettier/plugins/typescript')).default,
      (await import('prettier/plugins/estree')).default,
    ],
  },
  json: {
    parser: 'json',
    loadPlugins: async () => [
      (await import('prettier/plugins/babel')).default,
      (await import('prettier/plugins/estree')).default,
    ],
  },
  css: { parser: 'css', loadPlugins: async () => [(await import('prettier/plugins/postcss')).default] },
  scss: { parser: 'scss', loadPlugins: async () => [(await import('prettier/plugins/postcss')).default] },
  less: { parser: 'less', loadPlugins: async () => [(await import('prettier/plugins/postcss')).default] },
  html: { parser: 'html', loadPlugins: async () => [(await import('prettier/plugins/html')).default] },
  markdown: {
    parser: 'markdown',
    loadPlugins: async () => [(await import('prettier/plugins/markdown')).default],
  },
};

export function isFormattableLanguage(language: string): boolean {
  return language in LANGUAGE_PARSERS;
}

/** Formats via Prettier's browser ("standalone") build — no server round-trip, no custom formatter. */
export async function formatDocument(content: string, language: string, tabWidth: number): Promise<string> {
  const config = LANGUAGE_PARSERS[language];
  if (!config) {
    throw new Error(`Formatting isn't supported for this file type yet.`);
  }

  const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), config.loadPlugins()]);

  return format(content, {
    parser: config.parser,
    plugins,
    tabWidth,
    semi: true,
    singleQuote: true,
  });
}
