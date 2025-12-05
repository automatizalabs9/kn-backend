import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, buildQueryContext } from '../../../_lib/db';

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

