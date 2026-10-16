import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIQuestionGenerator } from '@/components/quiz/AIQuestionGenerator';
const api = vi.hoisted(() => ({ models: vi.fn(), generate: vi.fn() }));
vi.mock('@/lib/ai-management-api', () => ({ teacherAI: api }));
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({role:'teacher', user:{id:'t'}}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
beforeEach(() => { api.models.mockReset().mockResolvedValue({models:[{id:'p',name:'School model',provider:'google',model:'live'}],defaultProfileId:'p'}); api.generate.mockReset().mockResolvedValue({questions:[{text:'Q'}]}); });
afterEach(cleanup);
async function open(onGenerate=vi.fn()) { render(<AIQuestionGenerator quizTitle="Math" onGenerate={onGenerate}/>); fireEvent.click(screen.getByText('AI ile Soruları Üret')); }
it('loads managed models and exposes no provider configuration', async()=>{ await open(); await screen.findByText(/School model/); expect(screen.queryByText(/Gelişmiş/)).toBeNull(); expect(screen.queryByLabelText(/API Anahtarı/)).toBeNull(); });
it('sends only managed profile and question parameters',async()=>{const callback=vi.fn(); await open(callback); await screen.findByText(/School model/); fireEvent.click(screen.getByText('Sınav Sorularını Üret')); await waitFor(()=>expect(callback).toHaveBeenCalledWith([{text:'Q'}])); expect(api.generate.mock.calls[0][0]).toEqual({profileId:'p',topic:'Math',count:3,difficulty:'medium',contentType:'exam'});});
it('distinguishes empty from loading and prevents generation',async()=>{api.models.mockResolvedValue({models:[],defaultProfileId:null}); await open(); await screen.findByText(/Yöneticinize/); expect(screen.getByText('Sınav Sorularını Üret')).toBeDisabled();});
it('offers retry when model list fails',async()=>{api.models.mockRejectedValue(new Error('offline')); await open(); await screen.findByRole('alert'); expect(screen.getByText('Yeniden dene')).toBeEnabled();});
it('ignores generation after closing',async()=>{let resolve!: (v:any)=>void; api.generate.mockImplementation(()=>new Promise(r=>resolve=r)); const callback=vi.fn(); await open(callback); await screen.findByText(/School model/); fireEvent.click(screen.getByText('Sınav Sorularını Üret')); fireEvent.click(screen.getByText('İptal')); resolve({questions:[{text:'Late'}]}); await waitFor(()=>expect(screen.queryByText('AI Soru Üretici')).toBeNull()); expect(callback).not.toHaveBeenCalled();});

it('sends draft attribution without exposing provider settings',async()=>{
 const context={draftId:crypto.randomUUID(),quizTitle:'Tarih taslağı',categoryId:crypto.randomUUID()};
 render(<AIQuestionGenerator quizTitle="Tarih" usageContext={context} onGenerate={vi.fn()}/>);fireEvent.click(screen.getByText('AI ile Soruları Üret'));await screen.findByText(/School model/);fireEvent.click(screen.getByText('Sınav Sorularını Üret'));
 await waitFor(()=>expect(api.generate).toHaveBeenCalled());expect(api.generate.mock.calls[0][0].context).toEqual(context);
});
