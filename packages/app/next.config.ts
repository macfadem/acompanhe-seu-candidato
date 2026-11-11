import type { NextConfig } from 'next';

const config: NextConfig = {
  // O app lê os tipos e o formato do arquivo da coleta direto do código-fonte do pipeline,
  // para existir um só modelo de dados no projeto.
  transpilePackages: ['@acompanhe/pipeline'],
  poweredByHeader: false,
};

export default config;
