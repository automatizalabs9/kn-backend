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

