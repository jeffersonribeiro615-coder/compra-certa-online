import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({error:"O cadastro inteligente ainda não foi configurado. Cadastre manualmente ou adicione uma chave OpenAI na hospedagem."},{status:503});
  try {
    const {command} = await req.json();
    if (!command || typeof command !== "string") return NextResponse.json({error:"Escreva o comando."},{status:400});
    const client = new OpenAI({apiKey:key});
    const response = await client.chat.completions.create({
      model:"gpt-4o-mini",
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:"Extraia dados de produto de um comando em português. Retorne JSON com name, price (número), store (Mercado Livre ou Shopee), category, image_url (string ou vazio), affiliate_url (string ou vazio), description. Não invente preço nem links. Se não informado, use string vazia ou 0."},
        {role:"user",content:command}
      ]
    });
    const product = JSON.parse(response.choices[0].message.content || "{}");
    return NextResponse.json({product});
  } catch {
    return NextResponse.json({error:"Não consegui interpretar. Tente escrever de forma mais simples."},{status:400});
  }
}
