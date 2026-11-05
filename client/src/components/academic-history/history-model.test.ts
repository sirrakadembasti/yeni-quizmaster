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
  it.each([
    ['/management','', 'category','records'],
    ['/management','?tab=categories','category','records'],
    ['/management','?tab=classes','class','records'],
    ['/management','?tab=users','user','records'],
    ['/management','?tab=logs','user','unsupported'],
    ['/management','?tab=invalid','category','records'],
    ['/students','?studentId=one','student','records'],
    ['/teachers/one','','teacher','records'],
    ['/admin/classes/one','','class','records'],
    ['/classlist','','class','records'],
    ['/quizzes/one','?tab=questions','question','records'],
    ['/admin-quizzes','?contentType=survey','survey','records'],
    ['/survey-results','?surveyId=one','surveyAnswer','records'],
    ['/statistics','','result','statistics'],
    ['/settings','','user','unsupported'],
  ])('maps admin route %s %s to its historical equivalent',(path,search,section,view)=>{
    expect(historicalRoute(path,search)).toMatchObject({section,view});
  });
  it('preserves survey detail scope and explains unsupported management logs',()=>{
    expect(historicalRoute('/survey-results','?surveyId=one')).toMatchObject({quizId:'one'});
    expect(historicalRoute('/management','?tab=logs').notice).toMatch(/günlükleri/);
  });
});
