import { createHash } from "node:crypto";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PDF_STYLES = `
@page portraitForm{size:A4 portrait;margin:8mm}@page landscapeForm{size:A4 landscape;margin:8mm}
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;background:#fff}
.pdf-page{width:100%;background:#fff;break-after:page}.pdf-page:last-child{break-after:auto}.portrait-page{page:portraitForm}.landscape-page{page:landscapeForm}
.certificate-head{display:grid;grid-template-columns:25mm minmax(0,1fr) 25mm;gap:4mm;align-items:start;padding:3mm;border:1px solid #333;border-bottom:0}
.certificate-logo{width:23mm;height:17mm;object-fit:contain;object-position:left top}.certificate-logo-space{display:block;width:23mm}.certificate-copy{text-align:center}
.certificate-copy h1{margin:0 0 2mm;font-size:17px}.certificate-copy .subtitle{margin:0 0 2mm;font-size:8px;font-weight:700;line-height:1.3}.certificate-copy .description{margin:0;font-size:7.5px;line-height:1.3}
.draft{display:none}.part-title{margin:0;padding:1.4mm 2mm;border:1px solid #333;background:#ddd;font-size:10px}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:1px solid #333}.field{min-height:12mm;padding:1.4mm 1.8mm;border-right:1px solid #333;border-bottom:1px solid #333;font-size:7.5px;line-height:1.25;overflow-wrap:anywhere}.field.full{grid-column:1/-1}.field strong{display:block;margin-bottom:.8mm;font-size:7.5px}.value{min-height:4mm;white-space:pre-wrap}
.checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-left:1px solid #333}.check-row{padding:1.6mm;border-right:1px solid #333;border-bottom:1px solid #333;font-size:7.5px}.check-mark{display:inline-block;width:3mm;height:3mm;margin-right:1.2mm;border:1px solid #333;text-align:center;line-height:2.5mm;font-weight:700}
table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:1.2mm;border:1px solid #333;text-align:left;vertical-align:top;font-size:6.5px;line-height:1.2;overflow-wrap:anywhere}th{background:#eee;font-weight:700}.g2-table th,.g2-table td{font-size:5.6px;padding:.9mm}.instrument-table th,.instrument-table td{font-size:7px}
.g2-meta{display:grid;grid-template-columns:1fr 1fr;border-left:1px solid #333}.g2-meta .field{min-height:9mm}.declaration{padding:2mm;border:1px solid #333;border-top:0;font-size:7.5px;line-height:1.3}.completion-note{margin-top:2mm;font-size:7px;color:#555}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}`;

function required(name:string) {
  const value=process.env[name];
  if(!value)throw new Error(`${name} is not configured.`);
  return value;
}

async function graphToken() {
  const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(required("MICROSOFT_TENANT_ID"))}/oauth2/v2.0/token`,{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:required("MICROSOFT_CLIENT_ID"),client_secret:required("MICROSOFT_CLIENT_SECRET"),scope:"https://graph.microsoft.com/.default",grant_type:"client_credentials"}),signal:AbortSignal.timeout(20000)
  });
  const payload=await response.json() as {access_token?:string;error_description?:string};
  if(!response.ok||!payload.access_token)throw new Error(payload.error_description||"Microsoft Graph authentication failed.");
  return payload.access_token;
}

export async function POST(request:Request) {
  const supabaseUrl=required("NEXT_PUBLIC_SUPABASE_URL");
  const admin=createClient(supabaseUrl,required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
  let signoffId="";
  try{
    let submitterEmail="Email not available";
    const body=await request.json() as {signoffId?:string;externalToken?:string;html?:string;projectName?:string};
    signoffId=body.signoffId??"";
    if(!signoffId||!body.html||body.html.length>2_000_000)return NextResponse.json({error:"Invalid sign-off email payload."},{status:400});
    const {data:signoff,error:signoffError}=await admin.from("project_signoffs").select("id,project_id,status").eq("id",signoffId).single();
    if(signoffError||!signoff||signoff.status!=="submitted")return NextResponse.json({error:"The submitted sign-off could not be verified."},{status:403});
    if(body.externalToken){
      const hash=createHash("sha256").update(body.externalToken).digest("hex");
      const {data:link}=await admin.from("project_signoff_access_links").select("id,electrician_email").eq("signoff_id",signoffId).eq("token_hash",hash).in("status",["submitted","active"]).maybeSingle();
      if(!link)return NextResponse.json({error:"The electrician link could not be verified."},{status:403});
      submitterEmail=link.electrician_email||submitterEmail;
    }else{
      const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
      if(!bearer)return NextResponse.json({error:"Authentication is required."},{status:401});
      const {data:userData,error:userError}=await admin.auth.getUser(bearer);
      if(userError||!userData.user)return NextResponse.json({error:"Authentication is invalid."},{status:401});
      submitterEmail=userData.user.email||submitterEmail;
      const {data:project}=await admin.from("projects").select("user_id").eq("id",signoff.project_id).single();
      if(!project||project.user_id!==userData.user.id)return NextResponse.json({error:"Only the project owner can submit and email this sign-off."},{status:403});
    }
    const {data:project,error:projectError}=await admin.from("projects").select("user_id,name").eq("id",signoff.project_id).single();
    if(projectError||!project)throw new Error("The project owner could not be resolved.");
    const {data:owner,error:ownerError}=await admin.auth.admin.getUserById(project.user_id);
    const recipient=owner.user?.email;
    if(ownerError||!recipient)throw new Error("The project owner does not have an account email address.");

    const browser=await puppeteer.launch({args:chromium.args,defaultViewport:{width:1440,height:1000},executablePath:await chromium.executablePath(),headless:true});
    let pdf:Uint8Array;
    try{
      const page=await browser.newPage();
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${body.html}</body></html>`,{waitUntil:"domcontentloaded",timeout:30000});
      await page.evaluate(async()=>{await Promise.race([Promise.all(Array.from(document.images).map((image)=>image.complete?Promise.resolve():new Promise<void>((resolve)=>{image.addEventListener("load",()=>resolve(),{once:true});image.addEventListener("error",()=>resolve(),{once:true});}))),new Promise<void>((resolve)=>setTimeout(resolve,8000))]);});
      pdf=await page.pdf({printBackground:true,preferCSSPageSize:true});
    }finally{await browser.close();}

    const token=await graphToken();
    const sender=required("MICROSOFT_SENDER_EMAIL");
    const safeName=(body.projectName||project.name||"System Sign-Off").replace(/[^a-z0-9 _-]/gi,"").trim()||"System Sign-Off";
    const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
    const emailProjectName=escapeHtml(body.projectName||project.name||"System Sign-Off");
    const emailSubmitter=escapeHtml(submitterEmail);
    const graphResponse=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,{
      method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({message:{subject:`System Sign-Off - ${safeName}`,body:{contentType:"HTML",content:`<p>The completed system sign-off documentation for '${emailProjectName}' has been submitted and is attached here.</p><p>This documentation was submitted by '${emailSubmitter}'</p><p>This email was sent automatically by LVA Power Planner</p>`},toRecipients:[{emailAddress:{address:recipient}}],attachments:[{"@odata.type":"#microsoft.graph.fileAttachment",name:`${safeName} - System Sign-Off.pdf`,contentType:"application/pdf",contentBytes:Buffer.from(pdf).toString("base64")} ]},saveToSentItems:true}),signal:AbortSignal.timeout(20000)
    });
    if(!graphResponse.ok)throw new Error(`Microsoft Graph rejected the email (${graphResponse.status}): ${await graphResponse.text()}`);
    await admin.from("project_signoffs").update({email_status:"sent"}).eq("id",signoffId);
    return NextResponse.json({sent:true,recipient});
  }catch(error){
    if(signoffId){try{const admin=createClient(required("NEXT_PUBLIC_SUPABASE_URL"),required("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});await admin.from("project_signoffs").update({email_status:"failed"}).eq("id",signoffId);}catch{} }
    return NextResponse.json({error:error instanceof Error?error.message:"The sign-off email could not be sent."},{status:500});
  }
}
