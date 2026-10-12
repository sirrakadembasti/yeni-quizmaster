const PART_BYTES=2*1024*1024,ARTICLES_PER_PART=100;
const length=(text:string)=>Buffer.byteLength(text,'utf8');
type Piece={klass:any;course?:any;quiz?:any;classHeading:string;courseHeading:string;markup:string};
function contentChunks(body:string,allowance:number){
  if(allowance<1)throw new Error('Archive PDF indivisible heading size limit exceeded');
  const chunks:string[]=[];let current='',currentBytes=0;
  const flush=()=>{if(current){chunks.push(current);current='';currentBytes=0;}};
  const append=(fragment:string)=>{const bytes=length(fragment);if(bytes>allowance)throw new Error('Archive PDF indivisible row or image size limit exceeded');if(currentBytes+bytes>allowance)flush();current+=fragment;currentBytes+=bytes;};
  const tokens=[...body.matchAll(/<table>[\s\S]*?<\/table>|<figure>[\s\S]*?<\/figure>|<p>[\s\S]*?<\/p>/g)];
  if(tokens.map(token=>token[0]).join('')!==body)throw new Error('Archive PDF content mismatch');
  for(const token of tokens){
    if(!token[0].startsWith('<table>')){append(token[0]);continue;}
    const rows=[...token[0].matchAll(/<tr>[\s\S]*?<\/tr>/g)];let table='<table>',tableBytes=7;
    for(const row of rows){
      const bytes=length(row[0]);if(bytes+15>allowance)throw new Error('Archive PDF indivisible row size limit exceeded');
      if(tableBytes+bytes+8>allowance){append(table+'</table>');table='<table>';tableBytes=7;}
      table+=row[0];tableBytes+=bytes;
    }
    append(table+'</table>');
  }
  flush();return chunks;
}
/** Only parses HTML produced by our escaped, fixed report renderer. No external HTML. */
export function archivePdfParts(report:{html:string;index:any}){
  const index=report.index,articles=(report.html.match(/<article>/g)??[]).length;
  const add=(owner:any,path:string)=>{owner.documents??=[];if(!owner.documents.includes(path))owner.documents.push(path);};
  if(articles<=ARTICLES_PER_PART&&length(report.html)<=PART_BYTES){
    index.documents=[{path:'pdfs/report.pdf',title:'Tam rapor'}];
    for(const klass of index.classes){add(klass,'pdfs/report.pdf');for(const course of klass.courses){add(course,'pdfs/report.pdf');for(const quiz of course.quizzes)add(quiz,'pdfs/report.pdf');}}
    return [{path:'pdfs/report.pdf',html:report.html}];
  }
  const firstSection=report.html.indexOf('<section>'),head=report.html.slice(0,firstSection),tail='</body></html>';
  const sections=[...report.html.matchAll(/<section>([\s\S]*?)<\/section>/g)];
  if(sections.length!==index.classes.length)throw new Error('Archive PDF section mismatch');
  const pieces:Piece[]=[];
  for(let sectionIndex=0;sectionIndex<sections.length;sectionIndex++){
    const klass=index.classes[sectionIndex],section=sections[sectionIndex][1];
    const classHeading=section.match(/^<h2>[\s\S]*?<\/h2>/)![0],courseStarts=[...section.matchAll(/<h3>[\s\S]*?<\/h3>/g)];
    if(courseStarts.length!==klass.courses.length)throw new Error('Archive PDF course mismatch');
    if(!courseStarts.length)pieces.push({klass,classHeading,courseHeading:'',markup:''});
    for(let courseIndex=0;courseIndex<courseStarts.length;courseIndex++){
      const course=klass.courses[courseIndex],start=courseStarts[courseIndex],courseHeading=start[0];
      const content=section.slice(start.index!+courseHeading.length,courseStarts[courseIndex+1]?.index??section.length);
      const quizArticles=[...content.matchAll(/<article>[\s\S]*?<\/article>/g)];
      if(quizArticles.length!==course.quizzes.length)throw new Error('Archive PDF quiz mismatch');
      const prelude=content.slice(0,quizArticles[0]?.index??content.length);
      if(prelude){for(const markup of contentChunks(prelude,PART_BYTES-length(head+classHeading+courseHeading+tail)-64))pieces.push({klass,course,classHeading,courseHeading,markup});}
      else if(!quizArticles.length)pieces.push({klass,course,classHeading,courseHeading,markup:''});
      for(let articleIndex=0;articleIndex<quizArticles.length;articleIndex++){
        const quiz=course.quizzes[articleIndex],article=quizArticles[articleIndex][0];
        const matched=/^<article>(<h4>[\s\S]*?<\/h4><p>[\s\S]*?<\/p>)([\s\S]*)<\/article>$/.exec(article);
        if(!matched)throw new Error('Archive PDF article mismatch');
        const header=matched[1],allowance=PART_BYTES-length(head+classHeading+courseHeading+'<article>'+header+'</article>'+tail)-64;
        for(const markup of contentChunks(matched[2],allowance))pieces.push({klass,course,quiz,classHeading,courseHeading,markup:'<article>'+header+markup+'</article>'});
      }
    }
  }
  const documents:Array<{path:string;html:string}>=[];
  let body='',bodyBytes=0,count=0,lastClass:any,lastCourse:any,owners:Piece[]=[];
  const fixedBytes=length(head+tail);
  const flush=()=>{
    if(!owners.length)return;
    const path='pdfs/report-'+String(documents.length+1).padStart(4,'0')+'.pdf';
    documents.push({path,html:head+body+tail});
    for(const owner of owners){add(owner.klass,path);if(owner.course)add(owner.course,path);if(owner.quiz)add(owner.quiz,path);}
    body='';bodyBytes=0;count=0;lastClass=undefined;lastCourse=undefined;owners=[];
  };
  for(const piece of pieces){
    let headings=(lastClass!==piece.klass?piece.classHeading:'')+(lastClass!==piece.klass||lastCourse!==piece.course?piece.courseHeading:'');
    if(owners.length&&((piece.quiz&&count>=ARTICLES_PER_PART)||fixedBytes+bodyBytes+length(headings)+length(piece.markup)>PART_BYTES)){flush();headings=piece.classHeading+piece.courseHeading;}
    const bytes=length(headings)+length(piece.markup);if(fixedBytes+bytes>PART_BYTES)throw new Error('Archive PDF indivisible section size limit exceeded');
    body+=headings+piece.markup;bodyBytes+=bytes;owners.push(piece);if(piece.quiz)count++;lastClass=piece.klass;lastCourse=piece.course;
  }
  flush();
  let contents=head+'<h2>Rapor dosyaları</h2><p>Tüm dondurulmuş kayıtlar aşağıdaki sıralı PDF parçalarında bulunur. Sınıf, ders ve içerik eşlemesi index.json içindedir.</p><table>';
  for(const document of documents)contents+='<tr><td>'+document.path+'</td></tr>';
  contents+='</table>'+tail;if(length(contents)>PART_BYTES)throw new Error('Archive PDF directory size limit exceeded');
  index.documents=[{path:'pdfs/report.pdf',title:'Rapor dizini'},...documents.map(document=>({path:document.path,title:'Rapor parçası '+document.path}))];
  return [{path:'pdfs/report.pdf',html:contents},...documents];
}
