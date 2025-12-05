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

