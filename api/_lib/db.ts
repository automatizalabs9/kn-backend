import pg from "pg";

// Helper para obter pool do PostgreSQL
export function getPool() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const DB_HOST = process.env.DB_HOST;
  const DB_PORT = process.env.DB_PORT;
  const DB_NAME = process.env.DB_NAME;
  const DB_USER = process.env.DB_USER;
  const DB_PASSWORD = process.env.DB_PASSWORD;
  const DB_SSL = process.env.DB_SSL;

  let poolConfig: pg.PoolConfig;

  if (
    DATABASE_URL &&
    (DATABASE_URL.startsWith("postgresql://") ||
      DATABASE_URL.startsWith("postgres://"))
  ) {
    poolConfig = {
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
    console.log("🔗 Usando DATABASE_URL para conexão");
  } else if (DB_HOST && DB_USER && DB_PASSWORD) {
    poolConfig = {
      host: DB_HOST,
      port: Number(DB_PORT) || 5432,
      database: DB_NAME || "postgres",
      user: DB_USER,
      password: DB_PASSWORD,
      ssl: DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    };
    console.log(
      `🔗 Usando variáveis individuais: ${DB_HOST}:${DB_PORT}/${DB_NAME}`
    );
  } else {
    console.error("❌ Nenhuma configuração de banco encontrada!");
    console.error("   Configure DATABASE_URL ou DB_HOST, DB_USER, DB_PASSWORD");
    throw new Error("Configuração de banco de dados não encontrada");
  }

  return new pg.Pool(poolConfig);
}

// Helper para construir queries
export function buildQueryContext(query: any) {
  const { startDate, endDate, nome, telefone, agendou, table } = query;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  const tableName = table === "leads_contatos" ? "leads_contatos" : "leads";
  const dateColumn =
    tableName === "leads_contatos" ? "data_snapshot" : "data_contato";

  if (startDate) {
    conditions.push(`${dateColumn} >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    conditions.push(`${dateColumn} <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  if (nome) {
    conditions.push(`nome ILIKE $${paramIndex}`);
    params.push(`%${nome}%`);
    paramIndex++;
  }

  if (telefone) {
    conditions.push(`telefone ILIKE $${paramIndex}`);
    params.push(`%${telefone}%`);
    paramIndex++;
  }

  if (agendou && agendou !== "Todos") {
    conditions.push(`agendou = $${paramIndex}`);
    params.push(agendou);
    paramIndex++;
  }

  const whereSql =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { whereSql, params, tableName, dateColumn };
}

