import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, buildQueryContext } from "../_lib/db";

function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let pool;

  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      pool = getPool();
    } catch (error: any) {
      console.error("❌ Erro ao criar pool:", error?.message);
      return res.status(200).json({
        totalLeads: 0,
        totalAgendados: 0,
        totalPendentes: 0,
        taxaConversao: 0,
      });
    }

    const { whereSql, params, tableName } = buildQueryContext(req.query);

    const query = `
      SELECT 
        COUNT(*) as "totalLeads",
        SUM(CASE WHEN agendou = 'Sim' THEN 1 ELSE 0 END) as "totalAgendados",
        SUM(CASE WHEN agendou = 'Pendente' THEN 1 ELSE 0 END) as "totalPendentes"
      FROM ${tableName}
      ${whereSql}
    `;

    const result = await pool.query(query, params);
    const row = result.rows[0];
    const totalLeads = Number(row.totalLeads) || 0;
    const totalAgendados = Number(row.totalAgendados) || 0;
    const taxaConversao =
      totalLeads > 0 ? (totalAgendados / totalLeads) * 100 : 0;

    const metrics = {
      totalLeads,
      totalAgendados,
      totalPendentes: Number(row.totalPendentes) || 0,
      taxaConversao,
    };

    console.log(`✅ Métricas calculadas:`, metrics);
    res.status(200).json(metrics);
  } catch (error: any) {
    console.error("❌ Erro inesperado em metrics:", error);
    console.error(`   Mensagem:`, error?.message);
    console.error(`   Stack:`, error?.stack);

    // Garantir que sempre retornamos uma resposta válida
    if (!res.headersSent) {
      res.status(200).json({
        totalLeads: 0,
        totalAgendados: 0,
        totalPendentes: 0,
        taxaConversao: 0,
      });
    }
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // Ignorar erro ao fechar pool
      }
    }
  }
}
