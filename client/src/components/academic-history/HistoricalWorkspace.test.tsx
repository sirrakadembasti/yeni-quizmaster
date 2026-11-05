import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({path:'/management',search:'?tab=logs',request:vi.fn()}));
vi.mock('wouter',()=>({useLocation:()=>[state.path,vi.fn()],useSearch:()=>state.search}));
vi.mock('@/context/academic-year-context',()=>({useAcademicYear:()=>({year:{id:'past',label:'2025-2026'},pending:false}),historyRequest:state.request}));
vi.mock('@/lib/archive-api',()=>({archiveApi:{authorizeDownload:vi.fn(),download:vi.fn()}}));
import { HistoricalWorkspace } from './HistoricalWorkspace';
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><HistoricalWorkspace/></QueryClientProvider>);}
it('explains historical management logs without querying or rendering unrelated people',()=>{
  state.path='/management';state.search='?tab=logs';mount();
  expect(screen.getByRole('note')).toHaveTextContent('günlükleri');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(state.request).not.toHaveBeenCalled();
});
it('maps management class tab to frozen class records',async()=>{
  state.path='/management';state.search='?tab=classes';state.request.mockResolvedValue({snapshotId:'snapshot',rows:[{id:'class',name:'Frozen Class'}],classes:[],counts:{},pagination:{page:1,pageSize:25,total:1,pages:1}});mount();
  expect(await screen.findByRole('cell',{name:'Frozen Class'})).toBeInTheDocument();
  expect(screen.getByRole('tab',{name:'Sınıflar'})).toHaveAttribute('aria-selected','true');
  expect(state.request).toHaveBeenCalledWith(expect.stringContaining('type=class'));
});
it('labels raw quiz entity counts as combined exams and surveys in the annual summary',async()=>{
  state.path='/archive';state.search='';state.request.mockResolvedValue({snapshotId:'snapshot',rows:[],classes:[],counts:{quiz:2},pagination:{page:1,pageSize:25,total:2,pages:1}});mount();
  expect(await screen.findByText('Sınav ve anket içerikleri: 2')).toBeInTheDocument();
  expect(screen.queryByText('Sınavlar: 2')).not.toBeInTheDocument();
});
it('renders a frozen question package asset in details instead of the live upload URL',async()=>{
  state.path='/quizzes/exam';state.search='?tab=questions';
  const imageAssetUrl='/api/admin/academic-history/years/past/assets/'+'a'.repeat(64)+'.png';
  state.request.mockResolvedValue({snapshotId:'snapshot',rows:[{id:'question',text:'Frozen image question',imageUrl:'/uploads/live.png',imageAssetUrl}],classes:[],counts:{},pagination:{page:1,pageSize:25,total:1,pages:1}});mount();
  await screen.findByRole('cell',{name:'Frozen image question'});fireEvent.click(screen.getByRole('button',{name:'Ayrıntıları görüntüle'}));
  expect(screen.getByRole('img',{name:'Dondurulmuş soru görseli'})).toHaveAttribute('src',imageAssetUrl);
  expect(document.querySelector('img[src="/uploads/live.png"]')).toBeNull();
});
it('keeps external or untrusted image URLs out of historical image requests',async()=>{
  state.path='/quizzes/exam';state.search='?tab=questions';
  state.request.mockResolvedValue({snapshotId:'snapshot',rows:[{id:'question',text:'External image question',imageUrl:'https://example.invalid/live.png',imageAssetUrl:'https://example.invalid/forged.png'}],classes:[],counts:{},pagination:{page:1,pageSize:25,total:1,pages:1}});mount();
  await screen.findByRole('cell',{name:'External image question'});fireEvent.click(screen.getByRole('button',{name:'Ayrıntıları görüntüle'}));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('keeps business data closed while legacy archive preparation offers an explicit retry',async()=>{
  state.path='/management';state.search='?tab=classes';
  state.request.mockRejectedValueOnce(new Error('Arşiv arama dizini hazırlanıyor. Yeniden deneyin.')).mockResolvedValue({snapshotId:'snapshot',rows:[{id:'class',name:'Ready Frozen Class'}],classes:[],counts:{},pagination:{page:1,pageSize:25,total:1,pages:1}});
  mount();
  expect(await screen.findByText('Arşiv hazırlanıyor. Biraz sonra yeniden deneyin.')).toHaveAttribute('role','status');
  expect(screen.queryByRole('cell',{name:'Ready Frozen Class'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Yeniden dene'}));
  expect(await screen.findByRole('cell',{name:'Ready Frozen Class'})).toBeInTheDocument();
});
