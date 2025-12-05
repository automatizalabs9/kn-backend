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
  const colors = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

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
    console.log(`✅ Origem: ${data.length} fontes`);
    res.status(200).json(data);
  } catch (error: any) {
    console.error("❌ Erro origem:", error);
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
