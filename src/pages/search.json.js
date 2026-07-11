import { getGardenEntries } from "../lib/garden";
const clean = (value = "") => String(value).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
export async function GET(){const entries=await getGardenEntries();return new Response(JSON.stringify(entries.map((entry)=>({title:entry.data.title,description:entry.data.description,url:`/blog/${entry.id}`,pubDate:entry.data.pubDate.toISOString(),kind:entry.data.kind,tags:entry.data.tags,externalUrl:entry.data.externalUrl,body:clean(entry.body).slice(0,1200)}))),{headers:{"content-type":"application/json; charset=utf-8"}});}
