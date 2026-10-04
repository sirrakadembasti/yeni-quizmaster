import { describe, expect, it } from 'vitest';
import { orderAcademicYears, historicalSection, historicalRoute } from './history-model';
describe('academic history navigation', () => {
  it('defaults to active year and orders closed years descending', () => {
    expect(orderAcademicYears([{ id:'old', label:'2023-2024', status:'closed' }, { id:'new', label:'2025-2026', status:'closed' }, { id:'active', label:'2026-2027', status:'active' }]).map(y => y.id)).toEqual(['active','new','old']);
  });
  it('preserves exact route/query scopes and labels unsupported views',()=>{
    expect(historicalRoute('/teachers/123','')).toMatchObject({teacherId:'123',section:'teacher'});
    expect(historicalRoute('/student/result/456','')).toMatchObject({entityId:'456',section:'result'});
    expect(historicalRoute('/results','?studentId=student')).toMatchObject({studentId:'student',section:'result'});
    expect(historicalRoute('/survey-results','')).toMatchObject({section:'surveyAnswer'});
    expect(historicalRoute('/settings','')).toMatchObject({view:'unsupported'});
    expect(historicalRoute('/archive','')).toMatchObject({view:'summary'});
  });
  it('maps direct detail URLs to frozen sections', () => {
    expect(historicalSection('/teachers/123')).toBe('teacher');
    expect(historicalSection('/admin/classes/123')).toBe('class');
    expect(historicalSection('/student/result/123')).toBe('result');
    expect(historicalSection('/student/quiz/123')).toBe('quiz');
    expect(historicalSection('/guardian-management')).toBe('guardianLink');
  });
});
