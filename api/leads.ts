import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, buildQueryContext } from "./_lib/db.js";

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
      // Se não conseguir criar pool (variáveis não configuradas), retornar array vazio
      return res.status(200).json([]);
    }

    const { whereSql, params, tableName, dateColumn } = buildQueryContext(
      req.query
    );

    const orderBy =
      tableName === "leads_contatos"
        ? `ORDER BY ${dateColumn} DESC, sequencia_dia ASC`
        : `ORDER BY ${dateColumn} DESC`;

    const query = `
      SELECT * FROM ${tableName}
      ${whereSql} 
      ${orderBy}
      LIMIT 100
    `;

    const result = await pool.query(query, params);
    const normalizedRows = result.rows.map((row) => ({
      ...row,
      data_contato: row[dateColumn] || row.data_contato,
    }));
    console.log(`✅ Retornando ${normalizedRows.length} leads de ${tableName}`);
    res.status(200).json(normalizedRows);
  } catch (error: any) {
    console.error(`❌ Erro ao buscar leads:`, error);
    console.error(`   Mensagem:`, error?.message);
    console.error(`   Código:`, error?.code);
    console.error(`   Stack:`, error?.stack);

    // Sempre retornar array vazio em caso de erro, não objeto de erro
    // Isso evita o erro "e.reduce is not a function" no frontend
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
