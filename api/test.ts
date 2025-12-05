import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ 
    message: "Backend funcionando!",
    timestamp: new Date().toISOString(),
    path: req.url
  });
}

