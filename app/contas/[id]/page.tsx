import { AccountView } from '@/components/account-view';
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) { return <AccountView accountId={(await params).id} />; }
