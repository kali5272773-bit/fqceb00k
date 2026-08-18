/**
 * FaceB00k private demo backend
 *
 * IMPORTANT:
 * - Never put TELEGRAM_BOT_TOKEN in frontend code.
 * - Passwords are never sent to Telegram and are never stored in plaintext.
 * - Telegram receives only non-sensitive account metadata.
 *
 * Cloudflare bindings:
 *   DB = D1 database
 * Secrets:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    };

    if (request.method === "OPTIONS") return new Response(null, {headers:cors});

    try {
      if (url.pathname === "/api/signup" && request.method === "POST") {
        const body = await request.json();
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!name || !email || password.length < 8) {
          return json({ok:false,error:"Name, email and an 8+ character password are required."},400,cors);
        }

        const exists = await env.DB.prepare(
          "SELECT id FROM users WHERE email = ? LIMIT 1"
        ).bind(email).first();

        if (exists) return json({ok:false,error:"Account already exists."},409,cors);

        const userId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);

        await env.DB.prepare(
          "INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)"
        ).bind(userId,name,email,passwordHash,new Date().toISOString()).run();

        await telegram(env,
          "🟢 FaceB00k — New account\n\n" +
          `User ID: ${userId}\nName: ${name}\nEmail: ${email}\nCreated: ${new Date().toISOString()}\n\n` +
          "Password: NOT sent to Telegram."
        );

        return json({ok:true,user:{id:userId,name,email}},201,cors);
      }

      if (url.pathname === "/api/login" && request.method === "POST") {
        const body = await request.json();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        const user = await env.DB.prepare(
          "SELECT id,name,email,password_hash FROM users WHERE email = ? LIMIT 1"
        ).bind(email).first();

        if (!user || !(await verifyPassword(password,user.password_hash))) {
          return json({ok:false,error:"Invalid email or password."},401,cors);
        }

        await telegram(env,
          "🔐 FaceB00k — Login\n\n" +
          `User ID: ${user.id}\nName: ${user.name}\nEmail: ${user.email}\nTime: ${new Date().toISOString()}\n\n` +
          "Password: NOT sent to Telegram."
        );

        return json({ok:true,user:{id:user.id,name:user.name,email:user.email}},200,cors);
      }

      return json({ok:false,error:"Not found"},404,cors);
    } catch (e) {
      return json({ok:false,error:"Server error"},500,cors);
    }
  }
};

function json(data,status,headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json",...headers}
  });
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},
    key,256
  );
  return `pbkdf2$120000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [scheme,iter,saltB64,hashB64] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      {name:"PBKDF2",salt:fromB64(saltB64),iterations:Number(iter),hash:"SHA-256"},
      key,256
    );
    return timingSafeEqual(new Uint8Array(bits),fromB64(hashB64));
  } catch { return false; }
}

function b64(bytes) {
  let s="";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s) {
  const bin=atob(s);
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function timingSafeEqual(a,b) {
  if (a.length !== b.length) return false;
  let x=0;
  for(let i=0;i<a.length;i++) x |= a[i]^b[i];
  return x===0;
}

async function telegram(env,text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const endpoint=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      chat_id:env.TELEGRAM_CHAT_ID,
      text
    })
  });
}
