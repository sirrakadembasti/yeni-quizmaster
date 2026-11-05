import { useCallback, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/auth-context';
import { AIProfilesTab } from '@/components/ai-management/AIProfilesTab';
import { AIUsageTab } from '@/components/ai-management/AIUsageTab';
import type { AIUsageResult } from '@/lib/ai-management-api';
import type { UsageAverage } from '@/components/ai-management/AITokenBudgetHelp';
export default function AIManagement() {
    const { role, user } = useAuth();
    if (role !== 'admin') return <DashboardLayout><p role="alert">Bu sayfaya yalnız yöneticiler erişebilir.</p></DashboardLayout>;
    return <DashboardLayout><AIManagementTabs key={user?.id}/></DashboardLayout>;
}
function AIManagementTabs() {
    const [averages, setAverages] = useState<UsageAverage[]>([]);
    const onLoaded = useCallback((data: AIUsageResult) => setAverages(data.averages), []);
    const [tab, setTab] = useState('profiles');
    const [usageVisited, setUsageVisited] = useState(false);
    return <Tabs value={tab} onValueChange={value => { setTab(value); if (value === 'usage') setUsageVisited(true); }}>
        <TabsList aria-label="AI yönetimi bölümleri" className="mb-4 h-auto flex-wrap">
            <TabsTrigger value="profiles">ai profil yönetimi</TabsTrigger>
            <TabsTrigger value="usage">öğretmen ai kullanımı</TabsTrigger>
        </TabsList>
        <TabsContent forceMount value="profiles" hidden={tab !== 'profiles'}><AIProfilesTab averages={averages}/></TabsContent>
        <TabsContent forceMount value="usage" hidden={tab !== 'usage'}>{usageVisited && <AIUsageTab active={tab === 'usage'} onLoaded={onLoaded}/>}</TabsContent>
    </Tabs>;
}
