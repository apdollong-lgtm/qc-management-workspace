import fs from 'node:fs/promises';
const base='https://catalog.factorystudio.pro';
if(!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !process.env.GITHUB_SHA) throw Error('Run through GitHub Actions on main');
const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
url.searchParams.set('audience',base);
const identity=await fetch(url,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`}});
if(!identity.ok) throw Error('Unable to obtain GitHub OIDC identity');
const {value:token}=await identity.json();
const product=JSON.parse(await fs.readFile('catalog-product.json','utf8'));
product.version+=`+${process.env.GITHUB_SHA.slice(0,8)}`;
async function api(method,headers,body){
 const response=await fetch(`${base}/api/integrations/github-release`,{method,headers:{Authorization:`Bearer ${token}`,...headers},body});
 if(!response.ok) throw Error(`Catalog ${method}: ${response.status} ${await response.text()}`);
 return response.json();
}
async function uploadAsset(fileName,type,label,contentType){
 const file=await fs.readFile(`release/${fileName}`);
 const headers={'Content-Type':contentType,'X-Product-Slug':product.slug,'X-Release-Version':product.version,'X-Asset-Type':type,'X-Asset-Label':label,'X-File-Name':fileName,'X-File-Size':String(file.length)};
 const {upload}=await api('POST',headers);
 const result=await fetch(upload.uploadUrl,{method:'PUT',headers:{'Content-Type':contentType},body:file});
 if(!result.ok) throw Error(`Upload failed: ${result.status}`);
 await api('PATCH',{...headers,'X-Upload-Id':upload.id,'X-Upload-Key':upload.key});
}
await uploadAsset('qc-workspace-source.zip','package','QC source, Thai manual and narrated Remotion tutorial source','application/zip');
await uploadAsset('qc-installation-th.mp4','video','QC installation tutorial - Thai narration - 1080p','video/mp4');
await api('PUT',{'Content-Type':'application/json','X-Product-Slug':product.slug},JSON.stringify(product));
console.log(`Catalog synced: ${product.slug} ${product.version}`);
