// Public-record checks Vee runs on CNPJ, CPF and court records found in a forwarded message.
// CNPJ: OpenCNPJ (free, no key). CPF: format check only, no personal data is ever shown.
// Court records: optional provider (env PROCESS_API_KEY, PROCESS_API_URL, PROCESS_API_HEADER); skipped when not configured.
const env = process.env;
const digits = s => String(s).replace(/\D/g, '');

function cnpjOk(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +d[12] && calc(13) === +d[13];
}
function cpfOk(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === +d[9] && calc(10) === +d[10];
}
function extract(text) {
  let t = String(text || '');
  const cnpj = [], cpf = [];
  t = t.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, m => { const d = digits(m); if (cnpjOk(d) && !cnpj.includes(d)) cnpj.push(d); return ' '; });
  t.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, m => { const d = digits(m); if (cpfOk(d) && !cpf.includes(d)) cpf.push(d); return m; });
  return { cnpj: cnpj.slice(0, 2), cpf: cpf.slice(0, 2) };
}

async function getJson(url, init = {}, ms = 4500) {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { ...init, signal: ac.signal }); if (r.status === 404) return { notFound: true }; if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; } finally { clearTimeout(to); }
}

async function opencnpj(d) {
  const j = await getJson('https://api.opencnpj.org/' + d);
  if (!j) return null;
  if (j.notFound) return { notFound: true };
  const cn = j.cnae_principal;
  return { name: j.razao_social || j.nome_fantasia || '', status: String(j.situacao_cadastral || ''), since: j.data_inicio_atividade || '', cnae: typeof cn === 'string' ? cn : (cn && (cn.descricao || cn.texto)) || '' };
}

async function lawsuits(d, kind) {
  if (!env.PROCESS_API_KEY) return null;
  const j = await getJson(env.PROCESS_API_URL || 'https://lawsuits.production.judit.io/lawsuits/synthetic', {
    method: 'POST', headers: { 'Content-Type': 'application/json', [env.PROCESS_API_HEADER || 'api-key']: env.PROCESS_API_KEY },
    body: JSON.stringify({ search: { search_type: kind, search_key: d } }) }, 7000);
  if (!j || j.notFound) return null;
  const n = [j.count, j.total, j.lawsuits_count, j.response_data && j.response_data.count].find(x => Number.isFinite(x));
  return Number.isFinite(n) ? n : null;
}

const fmtCnpj = d => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const maskCpf = d => '•••.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-••';
const TX = {
  pt: {
    cnpj: (d, o) => `CNPJ ${fmtCnpj(d)}: ${o.name || 'sem nome'}. Situação: ${o.status || 'não informada'}${o.since ? '. Aberta em ' + o.since : ''}${o.cnae ? '. Atividade: ' + o.cnae : ''}.`,
    nf: d => `CNPJ ${fmtCnpj(d)}: não encontrei esse CNPJ na base pública.`,
    inactive: 'o CNPJ não está ativo', young: 'empresa aberta há menos de 6 meses', missing: 'CNPJ não encontrado na base pública',
    cpf: d => `CPF ${maskCpf(d)}: o formato é válido. Por privacidade, não mostro dados de pessoas.`,
    suits: (n, what) => `Processos ${what}: ${n} encontrado(s).`,
    head: 'Consultas da Vee'
  },
  es: {
    cnpj: (d, o) => `CNPJ ${fmtCnpj(d)}: ${o.name || 'sin nombre'}. Situación: ${o.status || 'no informada'}${o.since ? '. Abierta el ' + o.since : ''}${o.cnae ? '. Actividad: ' + o.cnae : ''}.`,
    nf: d => `CNPJ ${fmtCnpj(d)}: no encontré ese CNPJ en la base pública.`,
    inactive: 'el CNPJ no está activo', young: 'empresa abierta hace menos de 6 meses', missing: 'CNPJ no encontrado en la base pública',
    cpf: d => `CPF ${maskCpf(d)}: el formato es válido. Por privacidad, no muestro datos de personas.`,
    suits: (n, what) => `Procesos ${what}: ${n} encontrado(s).`,
    head: 'Consultas de Vee'
  },
  en: {
    cnpj: (d, o) => `CNPJ ${fmtCnpj(d)}: ${o.name || 'no name'}. Status: ${o.status || 'not reported'}${o.since ? '. Opened ' + o.since : ''}${o.cnae ? '. Activity: ' + o.cnae : ''}.`,
    nf: d => `CNPJ ${fmtCnpj(d)}: I could not find this CNPJ in the public registry.`,
    inactive: 'the CNPJ is not active', young: 'company opened less than 6 months ago', missing: 'CNPJ not found in the public registry',
    cpf: d => `CPF ${maskCpf(d)}: the format is valid. For privacy, I never show personal data.`,
    suits: (n, what) => `Court cases ${what}: ${n} found.`,
    head: "Vee's checks"
  },
};

// Returns { text, flags:[{label,why}], risk } or null when there is nothing to check.
async function run(ids, lang) {
  const t = TX[lang] || TX.en;
  if (!ids.cnpj.length && !ids.cpf.length) return null;
  const lines = [], flags = []; let risk = false;
  for (const d of ids.cnpj) {
    const [o, n] = await Promise.all([opencnpj(d), lawsuits(d, 'cnpj')]);
    if (o && o.notFound) { lines.push(t.nf(d)); flags.push({ label: 'CNPJ', why: t.missing }); risk = true; }
    else if (o) {
      lines.push(t.cnpj(d, o));
      if (o.status && !/ativ/i.test(o.status)) { flags.push({ label: 'CNPJ', why: t.inactive }); risk = true; }
      const ms = Date.parse(o.since); if (ms && Date.now() - ms < 180 * 864e5) { flags.push({ label: 'CNPJ', why: t.young }); risk = true; }
    }
    if (n != null) lines.push(t.suits(n, 'CNPJ'));
  }
  for (const d of ids.cpf) {
    lines.push(t.cpf(d));
    const n = await lawsuits(d, 'cpf'); if (n != null) lines.push(t.suits(n, 'CPF'));
  }
  if (!lines.length) return null;
  return { text: t.head + '\n' + lines.map(l => '• ' + l).join('\n'), flags, risk };
}

module.exports = { extract, run, cnpjOk, cpfOk };
