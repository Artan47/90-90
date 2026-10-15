import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const shots = join(dirname(fileURLToPath(import.meta.url)), "..", ".shots");
mkdirSync(shots, { recursive: true });
const TYPES = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".json":"application/json",".webmanifest":"application/manifest+json",".txt":"text/plain" };
const server = createServer((req,res)=>{let p=join(root,decodeURIComponent(req.url.split("?")[0]));if(existsSync(p)&&statSync(p).isDirectory())p=join(p,"index.html");if(!existsSync(p)){res.writeHead(404);res.end();return;}res.writeHead(200,{"content-type":TYPES[extname(p)]??"application/octet-stream"});res.end(readFileSync(p));});
await new Promise(r=>server.listen(4322,r));
const BASE="http://localhost:4322";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell" });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
await page.addInitScript(()=>{const R=Date;const F=new R("2026-08-27T10:00:00");class X extends R{constructor(...a){super(...(a.length?a:[F.getTime()]))}static now(){return F.getTime()}}globalThis.Date=X;});
await page.goto(BASE);
await page.evaluate(()=>{const stays=[["2026-01-05","2026-01-19"],["2026-02-10","2026-02-24"],["2026-04-01","2026-04-30"],["2026-06-01","2026-06-20"]].map(([entry,exit],i)=>({id:`t${i}`,entry,exit,country:"DE"}));localStorage.setItem("sa-dite:v1",JSON.stringify({version:1,stays,profile:{locale:"sq"}}));});
await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem("sa-dite:v1"));d.profile.locale="fr";localStorage.setItem("sa-dite:v1",JSON.stringify(d));});
for (const [path,name] of [["/","home-fr"],["/settings/","settings-fr"]]) {
  await page.goto(BASE+path,{waitUntil:"networkidle"});
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(shots,`${name}.png`), fullPage: path!=="/" });
}
await browser.close(); server.close();
console.log("ok");
