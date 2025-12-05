import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, buildQueryContext } from "../../_lib/db.js";

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
      return res.status(200).json([]);
    }

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

    const result = await pool.query(query, params);
    const data = result.rows.map((row) => ({
      name: row.name,
      value: Number(row.value),
    }));
    console.log(`✅ Motivos recusa: ${data.length} motivos`);
    res.status(200).json(data);
  } catch (error: any) {
    console.error("❌ Erro recusa:", error);
    console.error(`   Mensagem:`, error?.message);
    console.error(`   Stack:`, error?.stack);
    // Sempre retornar array vazio
    if (!res.headersSent) {
      res.status(200).json([]);
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
