import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPool, buildQueryContext } from '../../_lib/db';

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

