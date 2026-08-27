export function GET(){return Response.json({status:'ok',mode:process.env.DEMO_MODE==='true'?'demo':'real',timestamp:new Date().toISOString()});}
