import { describe, expect, it } from 'vitest';
import { ErroConexao, explicarErroConexao, lerConfigConexao, ocultarSegredos } from '../src/conexao.js';

const CA = '-----BEGIN CERTIFICATE-----\nMIIfalso\n-----END CERTIFICATE-----';
const URL_SUPABASE = 'postgresql://postgres.abcdef:s3nh%40Secreta@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

describe('configuração da conexão (só por variável de ambiente)', () => {
  it('Supabase: valida o certificado (verify-full) e decodifica a senha', () => {
    const config = lerConfigConexao({ SUPABASE_DB_URL: URL_SUPABASE, SUPABASE_DB_CA: CA });
    expect(config).toMatchObject({
      host: 'aws-0-sa-east-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.abcdef',
      password: 's3nh@Secreta',
      database: 'postgres',
      ssl: { ca: CA, rejectUnauthorized: true, servername: 'aws-0-sa-east-1.pooler.supabase.com' },
    });
  });

  it('parâmetros na URL não afrouxam o SSL', () => {
    const config = lerConfigConexao({
      SUPABASE_DB_URL: `${URL_SUPABASE}?sslmode=disable&sslrootcert=/tmp/x`,
      SUPABASE_DB_CA: CA,
    });
    expect(config.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it('fora de localhost, sem certificado não conecta', () => {
    expect(() => lerConfigConexao({ SUPABASE_DB_URL: URL_SUPABASE })).toThrow(/SUPABASE_DB_CA não está definida/);
    expect(() => lerConfigConexao({ SUPABASE_DB_URL: URL_SUPABASE, SUPABASE_DB_CA: 'não é PEM' })).toThrow(/BEGIN CERTIFICATE/);
  });

  it('localhost (CI e máquina local) dispensa SSL', () => {
    const config = lerConfigConexao({ SUPABASE_DB_URL: 'postgresql://postgres:postgres@localhost:5432/teste' });
    expect(config).toMatchObject({ host: 'localhost', database: 'teste', ssl: false });
  });

  it('erros de configuração nunca repetem a URL nem a senha', () => {
    const casos = [{}, { SUPABASE_DB_URL: 'xx s3nhaSecreta' }, { SUPABASE_DB_URL: 'mysql://u:s3nhaSecreta@h/db' }];
    for (const env of casos) {
      let mensagem = '';
      try {
        lerConfigConexao(env);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroConexao);
        mensagem = explicarErroConexao(erro, env);
      }
      expect(mensagem).not.toBe('');
      expect(mensagem).not.toContain('s3nhaSecreta');
    }
  });
});

describe('mensagens de erro sem segredos', () => {
  const env = { SUPABASE_DB_URL: URL_SUPABASE };

  it('remove a URL, a senha (codificada ou não) e qualquer URL postgres', () => {
    const texto = `falhou ${URL_SUPABASE} senha s3nh@Secreta ou s3nh%40Secreta; outra postgres://a:b@c/d`;
    const limpo = ocultarSegredos(texto, env);
    expect(limpo).not.toMatch(/s3nh/);
    expect(limpo).not.toContain('a:b@c');
  });

  it('traduz os erros comuns', () => {
    expect(explicarErroConexao(Object.assign(new Error('x'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }), env)).toMatch(
      /Certificado do servidor não confere/,
    );
    expect(explicarErroConexao(Object.assign(new Error('x'), { code: '28P01' }), env)).toMatch(/senha recusados/);
    expect(explicarErroConexao(Object.assign(new Error('x'), { code: 'ENETUNREACH' }), env)).toMatch(/pooler/);
  });
});
