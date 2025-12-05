import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, buildQueryContext } from '../_lib/db';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

