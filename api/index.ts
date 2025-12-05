import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, buildQueryContext } from '../_lib/db';

// Helper para habilitar CORS
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Na Vercel, o path vem em req.url ou podemos usar a query string
  const path = req.url?.split('?')[0] || req.query.path?.[0] || '';
  
  // Roteamento baseado no path
  if (path === '/api/leads' && req.method === 'GET') {
    return handleGetLeads(req, res);
  }
  
  if (path === '/api/leads/metrics' && req.method === 'GET') {
    return handleGetMetrics(req, res);
  }
  
  if (path === '/api/leads/charts/timeline' && req.method === 'GET') {
    return handleGetTimeline(req, res);
  }
  
  if (path === '/api/leads/charts/origem' && req.method === 'GET') {
    return handleGetOrigem(req, res);
  }
  
  if (path === '/api/leads/charts/conversao' && req.method === 'GET') {
    return handleGetConversao(req, res);
  }
  
  if (path === '/api/leads/charts/motivos-recusa' && req.method === 'GET') {
    return handleGetMotivosRecusa(req, res);
  }
  
  if (path === '/api/config/test-connection' && req.method === 'POST') {
    return handleTestConnection(req, res);
  }

  res.status(404).json({ error: 'Endpoint não encontrado' });
}

// Handlers
async function handleGetLeads(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName, dateColumn } = buildQueryContext(req.query);

  const orderBy = tableName === 'leads_contatos'
    ? `ORDER BY ${dateColumn} DESC, sequencia_dia ASC`
    : `ORDER BY ${dateColumn} DESC`;

  const query = `
    SELECT * FROM ${tableName}
    ${whereSql} 
    ${orderBy}
    LIMIT 100
  `;

  try {
    const result = await pool.query(query, params);
    const normalizedRows = result.rows.map((row) => ({
      ...row,
      data_contato: row[dateColumn] || row.data_contato,
    }));
    res.status(200).json(normalizedRows);
  } catch (error) {
    console.error(`Erro ao buscar ${tableName}:`, error);
    res.status(500).json({ error: 'Erro interno ao buscar leads' });
  } finally {
    await pool.end();
  }
}

async function handleGetMetrics(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName } = buildQueryContext(req.query);

  const query = `
    SELECT 
      COUNT(*) as "totalLeads",
      SUM(CASE WHEN agendou = 'Sim' THEN 1 ELSE 0 END) as "totalAgendados",
      SUM(CASE WHEN agendou = 'Pendente' THEN 1 ELSE 0 END) as "totalPendentes"
    FROM ${tableName}
    ${whereSql}
  `;

  try {
    const result = await pool.query(query, params);
    const row = result.rows[0];
    const totalLeads = Number(row.totalLeads);
    const totalAgendados = Number(row.totalAgendados);
    const taxaConversao = totalLeads > 0 ? (totalAgendados / totalLeads) * 100 : 0;

    res.status(200).json({
      totalLeads,
      totalAgendados,
      totalPendentes: Number(row.totalPendentes),
      taxaConversao,
    });
  } catch (error) {
    console.error('Erro metrics:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  } finally {
    await pool.end();
  }
}

async function handleGetTimeline(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName, dateColumn } = buildQueryContext(req.query);

  const query = `
    SELECT 
      TO_CHAR(DATE(${dateColumn}), 'MM/DD') as name,
      COUNT(*) as value,
      SUM(CASE WHEN agendou = 'Sim' THEN 1 ELSE 0 END) as converted
    FROM ${tableName}
    ${whereSql}
    GROUP BY DATE(${dateColumn})
    ORDER BY DATE(${dateColumn}) ASC
  `;

  try {
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro timeline:', error);
    res.status(500).json({ error: 'Erro ao buscar timeline' });
  } finally {
    await pool.end();
  }
}

async function handleGetOrigem(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName } = buildQueryContext(req.query);
  const colors = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  const query = `
    SELECT 
      como_nos_conheceu as name,
      COUNT(*) as value
    FROM ${tableName}
    ${whereSql}
    GROUP BY como_nos_conheceu
    ORDER BY value DESC
  `;

  try {
    const result = await pool.query(query, params);
    const data = result.rows.map((row, index) => ({
      ...row,
      value: Number(row.value),
      fill: colors[index % colors.length],
    }));
    res.status(200).json(data);
  } catch (error) {
    console.error('Erro origem:', error);
    res.status(500).json({ error: 'Erro ao buscar origem' });
  } finally {
    await pool.end();
  }
}

async function handleGetConversao(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName } = buildQueryContext(req.query);

  const query = `
    SELECT 
      como_nos_conheceu as name,
      COUNT(*) as total,
      SUM(CASE WHEN agendou = 'Sim' THEN 1 ELSE 0 END) as agendados
    FROM ${tableName}
    ${whereSql}
    GROUP BY como_nos_conheceu
  `;

  try {
    const result = await pool.query(query, params);
    const data = result.rows
      .map((row: any) => ({
        name: row.name || 'Desconhecido',
        value: Number(row.total) > 0
          ? Number(((Number(row.agendados) / Number(row.total)) * 100).toFixed(1))
          : 0,
      }))
      .sort((a: any, b: any) => b.value - a.value);

    res.status(200).json(data);
  } catch (error) {
    console.error('Erro conversao:', error);
    res.status(500).json({ error: 'Erro ao buscar conversão' });
  } finally {
    await pool.end();
  }
}

async function handleGetMotivosRecusa(req: VercelRequest, res: VercelResponse) {
  const pool = getPool();
  const { whereSql, params, tableName } = buildQueryContext(req.query);

  const whereWithReason = whereSql
    ? `${whereSql} AND agendou = 'Não' AND motivo_nao_agendou IS NOT NULL`
    : `WHERE agendou = 'Não' AND motivo_nao_agendou IS NOT NULL`;

  const query = `
    SELECT 
      motivo_nao_agendou as name,
      COUNT(*) as value
    FROM ${tableName}
    ${whereWithReason}
    GROUP BY motivo_nao_agendou
    ORDER BY value DESC
    LIMIT 5
  `;

  try {
    const result = await pool.query(query, params);
    const data = result.rows.map((row) => ({
      name: row.name,
      value: Number(row.value),
    }));
    res.status(200).json(data);
  } catch (error) {
    console.error('Erro recusa:', error);
    res.status(500).json({ error: 'Erro ao buscar motivos de recusa' });
  } finally {
    await pool.end();
  }
}

async function handleTestConnection(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = req.body;
  const pgModule = await import('pg');
  const testPool = new pgModule.Pool({
    host: config.host,
    port: Number(config.port),
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    await testPool.end();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro de conexão:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
}

