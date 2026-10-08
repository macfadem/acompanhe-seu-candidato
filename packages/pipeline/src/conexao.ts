/**
 * Conexão com o Postgres (Supabase) via `pg`. A URL vem só de variável de ambiente
 * (SUPABASE_DB_URL, guardada em GitHub Secrets) e nunca é impressa.
 *
 * SSL: fora de localhost a conexão sempre valida o servidor (cadeia e nome do host)
 * com o certificado do Supabase em SUPABASE_DB_CA — o equivalente a sslmode=verify-full.
 * Sem o certificado, não conecta. Nunca usamos rejectUnauthorized: false.
 */
import pg from 'pg';
import type { ConexaoSql } from './gravar.js';

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1']);

export class ErroConexao extends Error {
  override name = 'ErroConexao';
}

export interface ConfigConexao {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: false | { ca: string; rejectUnauthorized: true; servername: string };
  application_name: string;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}

/**
 * Lê a configuração do ambiente. A URL é decomposta aqui (e os parâmetros `?sslmode=...`
 * são ignorados) para que nada na URL possa afrouxar a validação do certificado.
 */
export function lerConfigConexao(env: NodeJS.ProcessEnv = process.env): ConfigConexao {
  const bruta = env.SUPABASE_DB_URL?.trim();
  if (!bruta) throw new ErroConexao('SUPABASE_DB_URL não está definida.');
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    // Não repete o valor: ele contém a senha.
    throw new ErroConexao('SUPABASE_DB_URL não é uma URL válida (formato: postgresql://usuario:senha@host:5432/postgres).');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new ErroConexao('SUPABASE_DB_URL deve começar com postgresql://');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || !url.username) throw new ErroConexao('SUPABASE_DB_URL precisa ter usuário e host.');

  const local = HOSTS_LOCAIS.has(host);
  const ca = env.SUPABASE_DB_CA?.trim();
  if (ca && !ca.includes('-----BEGIN CERTIFICATE-----')) {
    throw new ErroConexao('SUPABASE_DB_CA deve ter o conteúdo do certificado (começa com -----BEGIN CERTIFICATE-----).');
  }
  if (!local && !ca) {
    throw new ErroConexao(
      'SUPABASE_DB_CA não está definida. Baixe o certificado em Supabase → Database Settings → SSL Configuration e cadastre o conteúdo como secret; sem ele a conexão não valida o servidor e não é feita.',
    );
  }

  return {
    host,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    ssl: ca ? { ca, rejectUnauthorized: true, servername: host } : false,
    application_name: 'acompanhe-seu-candidato-pipeline',
    connectionTimeoutMillis: 20_000,
    statement_timeout: 120_000,
  };
}

/** Tira a senha e a URL de qualquer mensagem antes de mostrar (o GitHub também mascara secrets). */
export function ocultarSegredos(mensagem: string, env: NodeJS.ProcessEnv = process.env): string {
  let texto = mensagem;
  const bruta = env.SUPABASE_DB_URL?.trim();
  if (bruta) {
    texto = texto.split(bruta).join('***');
    try {
      const senha = new URL(bruta).password;
      for (const forma of new Set([senha, safeDecode(senha)])) if (forma.length >= 4) texto = texto.split(forma).join('***');
    } catch {
      // URL inválida: o valor inteiro já foi removido acima.
    }
  }
  return texto.replace(/postgres(?:ql)?:\/\/[^\s'"]+/g, 'postgresql://***');
}

function safeDecode(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

/** Explica em português os erros de conexão mais comuns, sem detalhes sensíveis. */
export function explicarErroConexao(erro: unknown, env: NodeJS.ProcessEnv = process.env): string {
  if (erro instanceof ErroConexao) return erro.message;
  const codigo = (erro as { code?: string } | null)?.code;
  const base = ocultarSegredos(erro instanceof Error ? erro.message : String(erro), env);
  switch (codigo) {
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'CERT_HAS_EXPIRED':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
      return `Certificado do servidor não confere (${codigo}). Confira se SUPABASE_DB_CA é o certificado baixado em Database Settings → SSL Configuration.`;
    case '28P01':
      return 'Usuário ou senha recusados pelo banco (confira SUPABASE_DB_URL).';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Host do banco não encontrado (confira o host em SUPABASE_DB_URL; use o pooler em modo sessão, porta 5432).';
    case 'ENETUNREACH':
      return 'Rede inalcançável — provavelmente a conexão direta (só IPv6). Use a URL do pooler em modo sessão (porta 5432).';
    default:
      return codigo ? `${base} (código ${codigo})` : base;
  }
}

export interface ConexaoPg extends ConexaoSql {
  fechar(): Promise<void>;
}

/** Abre uma conexão única (não um pool), para que BEGIN/COMMIT valham para todas as consultas. */
export async function conectar(config: ConfigConexao): Promise<ConexaoPg> {
  const cliente = new pg.Client(config);
  // Erro assíncrono depois de conectado (ex.: o servidor caiu): avisa em vez de derrubar o processo;
  // a consulta seguinte falha e a transação é desfeita.
  cliente.on('error', (erro) => console.error(`Conexão com o banco perdida: ${explicarErroConexao(erro)}`));
  await cliente.connect();
  return {
    async query(sql, params) {
      const resultado = await cliente.query(sql, params);
      return { rows: resultado.rows as unknown[] };
    },
    fechar: () => cliente.end(),
  };
}
