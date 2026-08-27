export const demoAdminId = '00000000-0000-4000-8000-000000000001';

export const demoAnalysts = [
  { id: '00000000-0000-4000-8000-000000000201', name: 'Luigi Ferreira', email: 'luigi@demo.local', active: true },
  { id: '00000000-0000-4000-8000-000000000202', name: 'Júlio Almeida', email: 'julio@demo.local', active: true },
] as const;

export const demoBrands = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'Casa Di Conti', code: 'CDC', active: true },
  { id: '00000000-0000-4000-8000-000000000102', name: 'Conti Cola', code: 'CC', active: true },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Moinho Real', code: 'MR', active: true },
  { id: '00000000-0000-4000-8000-000000000104', name: 'Zero Grau', code: 'ZG', active: true },
  { id: '00000000-0000-4000-8000-000000000105', name: 'Big Power', code: 'BP', active: true },
  { id: '00000000-0000-4000-8000-000000000106', name: 'Burguesa', code: 'BUR', active: true },
] as const;

export const demoAccounts = [
  { id: '00000000-0000-4000-8000-000000000301', metaAccountId: '238481104938', name: '#AR · CDC · Casa Di Conti', brandId: demoBrands[0].id, market: 'Argentina', analystId: demoAnalysts[0].id, monthlyBudget: 11051.88, monthlySpend: 10343.96, scale: 1.00 },
  { id: '00000000-0000-4000-8000-000000000302', metaAccountId: '238481104939', name: '#BO · CDC · Casa Di Conti', brandId: demoBrands[0].id, market: 'Bolívia', analystId: demoAnalysts[0].id, monthlyBudget: 4003.28, monthlySpend: 3823.47, scale: 0.74 },
  { id: '00000000-0000-4000-8000-000000000303', metaAccountId: '238481104940', name: '#BR · CDC · BIG POWER 2', brandId: demoBrands[4].id, market: 'Brasil', analystId: demoAnalysts[0].id, monthlyBudget: 2464.32, monthlySpend: 3101.87, scale: 0.86 },
  { id: '00000000-0000-4000-8000-000000000304', metaAccountId: '238481104941', name: '#BR · CDC · Burguesa', brandId: demoBrands[5].id, market: 'Brasil', analystId: demoAnalysts[1].id, monthlyBudget: 16583.08, monthlySpend: 15759.10, scale: 1.20 },
  { id: '00000000-0000-4000-8000-000000000305', metaAccountId: '238481104942', name: '#BR · CDC · Conti Cola', brandId: demoBrands[1].id, market: 'Brasil', analystId: demoAnalysts[0].id, monthlyBudget: 20410.76, monthlySpend: 17673.48, scale: 1.42 },
  { id: '00000000-0000-4000-8000-000000000306', metaAccountId: '238481104943', name: '#BR · CDC · Moinho Real', brandId: demoBrands[2].id, market: 'Brasil', analystId: demoAnalysts[1].id, monthlyBudget: 16744.84, monthlySpend: 13888.60, scale: 1.58 },
  { id: '00000000-0000-4000-8000-000000000307', metaAccountId: '238481104944', name: '#PY · CDC · Casa Di Conti', brandId: demoBrands[0].id, market: 'Paraguai', analystId: demoAnalysts[0].id, monthlyBudget: 12982.32, monthlySpend: 11611.89, scale: 0.92 },
  { id: '00000000-0000-4000-8000-000000000308', metaAccountId: '238481104945', name: '#UY · CDC · Zero Grau', brandId: demoBrands[3].id, market: 'Uruguai', analystId: demoAnalysts[0].id, monthlyBudget: 14592.24, monthlySpend: 13643.91, scale: 1.08 },
] as const;

export const demoMetricDefinitions = [
  { key: 'spend', displayName: 'Investimento', metaField: 'spend', unit: 'currency', aggregationRule: 'sum' },
  { key: 'reach', displayName: 'Alcance', metaField: 'reach', unit: 'people', aggregationRule: 'period_aggregate' },
  { key: 'impressions', displayName: 'Impressões', metaField: 'impressions', unit: 'count', aggregationRule: 'sum' },
  { key: 'engagement', displayName: 'Engajamentos', metaField: 'post_engagement', unit: 'count', aggregationRule: 'sum' },
  { key: 'video_views', displayName: 'Reproduções de vídeo', metaField: 'video_view', unit: 'count', aggregationRule: 'sum' },
  { key: 'likes_growth', displayName: 'Curtidores', metaField: 'page_fans', unit: 'growth', aggregationRule: 'period_delta' },
  { key: 'followers_growth', displayName: 'Seguidores', metaField: 'followers_count', unit: 'growth', aggregationRule: 'period_delta' },
] as const;
