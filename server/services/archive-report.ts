export type FrozenRow = { entityType: string; entityId: string; data: Record<string, any> };
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const display = (value: unknown) => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
function group(rows: FrozenRow[], key: (row: FrozenRow) => string) {
  const groups = new Map<string, FrozenRow[]>();
  for (const row of rows) { const id = key(row); const values = groups.get(id) ?? []; values.push(row); groups.set(id, values); }
  return groups;
}
const relationIds = (values: unknown): string[] => Array.isArray(values) ? values.map(value => typeof value === 'string' ? value : value?.id).filter((id): id is string => typeof id === 'string' && Boolean(id)) : [];
/** One frozen hierarchy supplies both the readable PDF and its machine index. */
export function archiveReport(label: string, capturedAt: string, rows: FrozenRow[], images: Map<string, string>,byteLimit:number) {
  const byType = group(rows, row => row.entityType), of = (type: string) => byType.get(type) ?? [];
  const users = new Map(of('user').map(row => [row.entityId, row.data]));
  const classes = of('class'), categories = of('category'), quizzes = of('quiz');
  const knownClasses = new Set(classes.map(row => row.entityId));
  const participantClass = (studentId: string) => { const id = users.get(studentId)?.classId; return knownClasses.has(id) ? id : ''; };
  const results = group(of('result'), row => row.data.quizId);
  const submissions = group(of('surveySubmission'), row => row.data.surveyId);
  const questions = group(of('question'), row => row.data.quizId);
  const questionsById = new Map(of('question').map(row => [row.entityId, row]));
  for (const values of questions.values()) values.sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
  const answers = group(of('surveyAnswer'), row => row.data.submissionId);
  const assignments = group(of('teacherAssignment'), row => row.data.classId);
  const assignedCourses = new Set<string>();
  const classCourses = new Map(classes.map(row => {
    const ids = [...new Set([...relationIds(row.data.assignedCategoryIds), ...relationIds(row.data.assignedCategories)])];
    for (const id of ids) assignedCourses.add(id);
    return [row.entityId, ids];
  }));
  for (const row of of('teacherAssignment')) assignedCourses.add(row.data.categoryId);
  const quizzesByClass = new Map<string, FrozenRow[]>();
  const resultsBySection = new Map<string, FrozenRow[]>(), submissionsBySection = new Map<string, FrozenRow[]>();
  const sectionKey = (quiz: string, klass: string) => JSON.stringify([quiz, klass]);
  for (const quiz of quizzes) {
    const ids = [...new Set([...relationIds(quiz.data.assignedClassIds), ...relationIds(quiz.data.classIds), ...relationIds(quiz.data.assignedClasses)])];
    const sections = new Set(ids.map(id => knownClasses.has(id) ? id : ''));
    if (!ids.length) sections.add(''); else assignedCourses.add(quiz.data.categoryId);
    for (const result of results.get(quiz.entityId) ?? []) {
      const klass = participantClass(result.data.studentId); sections.add(klass);
      const key = sectionKey(quiz.entityId, klass), values = resultsBySection.get(key) ?? []; values.push(result); resultsBySection.set(key, values);
    }
    for (const submission of submissions.get(quiz.entityId) ?? []) {
      const klass = participantClass(submission.data.studentId); sections.add(klass);
      const key = sectionKey(quiz.entityId, klass), values = submissionsBySection.get(key) ?? []; values.push(submission); submissionsBySection.set(key, values);
    }
    for (const klass of sections) { const values = quizzesByClass.get(klass) ?? []; values.push(quiz); quizzesByClass.set(klass, values); }
  }
  let html = '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><style>body{font-family:Arial,sans-serif;font-size:11px}h2{border-bottom:1px solid #777;break-before:page}h3{color:#333}table{border-collapse:collapse;table-layout:fixed;width:100%;margin:8px 0}td,th{border:1px solid #bbb;padding:5px;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap}tr{break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;max-height:240px}</style></head><body>';
  let bytes=Buffer.byteLength(html,'utf8');
  const append=(fragment:string)=>{bytes+=Buffer.byteLength(fragment,'utf8');if(bytes>byteLimit)throw new Error('Archive HTML size limit exceeded');html+=fragment;};
  append(`<h1>Eğitim yılı arşivi ${escape(label)}</h1><p>${escape(capturedAt)}</p>`);
  const table = (data: unknown[][]) => {
    let result='<table>',tableBytes=7;
    for(const row of data){
      const cells:string[]=[];
      for(const cell of row){const text=display(cell);if(Buffer.byteLength(text,'utf8')>byteLimit)throw new Error('Archive HTML size limit exceeded');cells.push('<td>'+escape(text)+'</td>');}
      const fragment='<tr>'+cells.join('')+'</tr>';tableBytes+=Buffer.byteLength(fragment,'utf8');
      if(bytes+tableBytes+8>byteLimit)throw new Error('Archive HTML size limit exceeded');result+=fragment;
    }
    return result+'</table>';
  };
  const index: { pdf: string; classes: Array<{ id: string | null; name: string; courses: Array<{ id: string | null; name: string; quizzes: Array<{ id: string; title: string }> }> }> } = { pdf: 'pdfs/report.pdf', classes: [] };
  for (const klass of [...classes, { entityType: 'class', entityId: '', data: { name: 'Atanmamış sınıf' } }]) {
    append(`<section><h2>${escape(klass.data.name)}</h2>`);
    const matching = quizzesByClass.get(klass.entityId) ?? [], teachers = assignments.get(klass.entityId) ?? [];
    const teachersByCourse = group(teachers, row => row.data.categoryId);
    const contentByCourse = group(matching, row => row.data.categoryId ?? '');
    const ids = new Set([...(classCourses.get(klass.entityId) ?? []), ...teachers.map(row => row.data.categoryId), ...contentByCourse.keys()]);
    if (!klass.entityId) for (const category of categories) if (!assignedCourses.has(category.entityId)) ids.add(category.entityId);
    const section: typeof index.classes[number] = { id: klass.entityId || null, name: klass.data.name, courses: [] }; index.classes.push(section);
    for (const category of [...categories, { entityType: 'category', entityId: '', data: { name: 'Atanmamış ders' } }]) {
      if (!ids.has(category.entityId)) continue;
      append(`<h3>${escape(category.data.name)}</h3>`);
      const teachers = teachersByCourse.get(category.entityId) ?? [];
      if (teachers.length) append(table(teachers.map(row => ['Öğretmen', users.get(row.data.teacherId)?.name ?? row.data.teacherId])));
      const course: typeof section.courses[number] = { id: category.entityId || null, name: category.data.name, quizzes: [] }; section.courses.push(course);
      for (const quiz of contentByCourse.get(category.entityId) ?? []) {
        course.quizzes.push({ id: quiz.entityId, title: quiz.data.title });
        const quizDate=quiz.data.publishedAt??quiz.data.createdAt;
        append(`<article><h4>${escape(quiz.data.title)}</h4><p>${quizDate?'İçerik tarihi: '+escape(quizDate)+'<br>':''}${escape(quiz.data.description)}</p>`);
        const quizQuestions = questions.get(quiz.entityId) ?? [];
        append(table(quizQuestions.map(row => [row.data.text, row.data.type, row.data.options, row.data.correctAnswer])));
        for (const question of quizQuestions) { const image = images.get('question:' + question.entityId); if (image) append(`<figure><img alt="${escape(question.data.text)}" src="${image}"></figure>`); }
        const key = sectionKey(quiz.entityId, klass.entityId);
        append(table((resultsBySection.get(key) ?? []).map(row => [users.get(row.data.studentId)?.name ?? row.data.studentId, row.data.score, row.data.status, row.data.answers])));
        for (const submission of submissionsBySection.get(key) ?? []) {
          append(`<p>${escape(users.get(submission.data.studentId)?.name ?? submission.data.studentId)}</p>`);
          append(table((answers.get(submission.entityId) ?? []).map(row => [questionsById.get(row.data.questionId)?.data.text ?? row.data.questionId, row.data.value])));
        }
        append('</article>');
      }
    }
    append('</section>');
  }
  append('</body></html>');return { html, index };
}
