import { syncAllAccounts } from '../services/meta/sync';
const end=process.argv[3]??new Date().toISOString().slice(0,10); const start=process.argv[2]??new Date(Date.now()-6*86_400_000).toISOString().slice(0,10);
syncAllAccounts({start,end}).then((result)=>{const failed=result.filter((item)=>item.status==='failed');console.info(`Sincronização concluída: ${result.length-failed.length} sucesso(s), ${failed.length} falha(s).`);process.exitCode=failed.length?1:0;}).catch((error)=>{console.error(error instanceof Error?error.message:'Falha na sincronização.');process.exitCode=1;});
