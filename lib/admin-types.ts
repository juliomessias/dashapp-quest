export type AdminAccount = { id:string;metaAccountId:string;name:string;brandId:string;brand:string;market:string;analystId:string|null;analyst:string|null;currency:string;timezone:string;facebookPageId:string|null;instagramProfileId:string|null;status:'active'|'paused'|'archived' };
export type AdminBrand = { id:string;name:string;code:string;active:boolean };
export type AdminAnalyst = { id:string;name:string;email:string;active:boolean };
export type AdminUser = { id:string;name:string;email:string;role:'admin'|'analyst'|'viewer';active:boolean;createdAt:string };
export type AdminCatalog = { accounts:AdminAccount[];brands:AdminBrand[];analysts:AdminAnalyst[];users:AdminUser[] };
export type AdminGoal = { id:string;year:number;month:number|null;accountId:string|null;account:string|null;brandId:string|null;brand:string|null;metricKey:string;value:string;note:string|null;source:string;changedAt:string;changedBy:string|null };
export type AdminBudget = { id:string;accountId:string;account:string;brandId:string;brand:string;year:number;month:number;budget:string;prepaidBalance:string|null;note:string|null;source:string;changedAt:string;changedBy:string|null };
export type AdminLog = { id:string;action:string;entity:string;beforeValues:unknown;afterValues:unknown;createdAt:string;user:string|null };
