export type MetricKey = 'investment' | 'reach' | 'impressions' | 'engagement' | 'video' | 'likes' | 'followers';

export const metrics = [
  { key: 'investment', label: 'Investimento', value: 183406, goal: 201270, previous: 169270, format: 'currency' },
  { key: 'reach', label: 'Alcance', value: 48600000, goal: 52400000, previous: 45900000, format: 'number' },
  { key: 'impressions', label: 'Impressões', value: 89400000, goal: 87300000, previous: 82100000, format: 'number' },
  { key: 'engagement', label: 'Engajamentos', value: 6450000, goal: 6910000, previous: 6220000, format: 'number' },
  { key: 'video', label: 'Rep. de vídeo', value: 5220000, goal: 4980000, previous: 4710000, format: 'number' },
  { key: 'likes', label: 'Curtidores', value: 14190, goal: 16200, previous: 13610, format: 'number' },
  { key: 'followers', label: 'Seguidores', value: 8600, goal: 7900, previous: 7950, format: 'number' },
] as const;

export const trendData = [
  { month: 'Jan', realized: 18.2, goal: 19.8, budget: 21.0 }, { month: 'Fev', realized: 36.9, goal: 39.7, budget: 41.0 },
  { month: 'Mar', realized: 57.1, goal: 59.8, budget: 61.2 }, { month: 'Abr', realized: 77.8, goal: 80.2, budget: 82.1 },
  { month: 'Mai', realized: 98.5, goal: 100.5, budget: 101.7 }, { month: 'Jun', realized: 119.8, goal: 120.8, budget: 122.0 },
  { month: 'Jul', realized: 140.4, goal: 141.0, budget: 143.2 }, { month: 'Ago', realized: 161.7, goal: 161.1, budget: 164.0 },
  { month: 'Set', realized: 183.4, goal: 181.2, budget: 185.1 }, { month: 'Out', realized: null, goal: 201.3, budget: 205.0 },
];

export type AccountRow = { id: string; account: string; brand: string; analyst: string; reach: number; impressions: number; engagement: number; video: number; likes: number; followers: number; spent: number; budget: number; };
export const accounts: AccountRow[] = [
  { id: 'ar-casa-di-conti', account: '#AR · CDC · Casa Di Conti', brand: 'Casa Di Conti', analyst: 'Luigi', reach: 698118, impressions: 905716, engagement: 68525, video: 63058, likes: 103, followers: -33, spent: 10343.96, budget: 11051.88 },
  { id: 'bo-casa-di-conti', account: '#BO · CDC · Casa Di Conti', brand: 'Casa Di Conti', analyst: 'Luigi', reach: 1077760, impressions: 433652, engagement: 99742, video: 102469, likes: -600, followers: -147, spent: 3823.47, budget: 4003.28 },
  { id: 'br-big-power', account: '#BR · CDC · BIG POWER 2', brand: 'Big Power', analyst: 'Luigi', reach: 927398, impressions: 1391204, engagement: 54528, video: 40311, likes: 256, followers: -525, spent: 3101.87, budget: 2464.32 },
  { id: 'br-burguesa', account: '#BR · CDC · Burguesa', brand: 'Burguesa', analyst: 'Júlio', reach: 450201, impressions: 504144, engagement: -685449, video: -617853, likes: -2754, followers: -2607, spent: 15759.1, budget: 16583.08 },
  { id: 'br-conti-cola', account: '#BR · CDC · Conti Cola', brand: 'Conti Cola', analyst: 'Luigi', reach: 1325522, impressions: 728741, engagement: 83382, video: 98847, likes: 844, followers: 667, spent: 17673.48, budget: 20410.76 },
  { id: 'br-moinho-real', account: '#BR · CDC · Moinho Real', brand: 'Moinho Real', analyst: 'Júlio', reach: 2583679, impressions: 4847279, engagement: 405953, video: 420840, likes: 318, followers: 353, spent: 13888.6, budget: 16744.84 },
  { id: 'py-casa-di-conti', account: '#PY · CDC · Casa Di Conti', brand: 'Casa Di Conti', analyst: 'Luigi', reach: 125469, impressions: -2368936, engagement: 25713, video: 27121, likes: -10667, followers: -37, spent: 11611.89, budget: 12982.32 },
  { id: 'uy-zero-grau', account: '#UY · CDC · Zero Grau', brand: 'Zero Grau', analyst: 'Luigi', reach: 1158672, impressions: 997410, engagement: 476051, video: 429827, likes: 31, followers: 499, spent: 13643.91, budget: 14592.24 },
];
export const statusCounts = [{ name: 'Dentro da meta', value: 11, color: '#15803d' }, { name: 'Próximas', value: 5, color: '#d97706' }, { name: 'Abaixo', value: 4, color: '#dc2626' }];
export const campaignData = [
  { campaign: 'Always On · Alcance', spend: 3824, results: 1942000, cpr: 1.97 }, { campaign: 'Verão Conti 2026', spend: 2940, results: 1214000, cpr: 2.42 },
  { campaign: 'Vídeo Institucional', spend: 2210, results: 982000, cpr: 2.25 }, { campaign: 'Conversão · PDV', spend: 1370, results: 441000, cpr: 3.11 },
];
export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
