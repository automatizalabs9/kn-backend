import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, buildQueryContext } from "../../../_lib/db";

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
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let pool;
  try {
    pool = getPool();
  } catch (error: any) {
    console.error("❌ Erro ao criar pool:", error?.message);
    return res.status(200).json([]);
  }

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
        name: row.name || "Desconhecido",
        value:
          Number(row.total) > 0
            ? Number(
                ((Number(row.agendados) / Number(row.total)) * 100).toFixed(1)
              )
            : 0,
      }))
      .sort((a: any, b: any) => b.value - a.value);

    console.log(`✅ Conversão: ${data.length} canais`);
    res.status(200).json(data);
  } catch (error: any) {
    console.error("❌ Erro conversao:", error);
    // Sempre retornar array vazio
    res.status(200).json([]);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // Ignorar erro ao fechar pool
    }
  }
}
