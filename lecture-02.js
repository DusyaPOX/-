'use strict';
(() => {
  const M=window.TransmissionModel, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const fmt=(value,digits=2)=>value.toLocaleString('ru-RU',{maximumFractionDigits:digits});
  const abbrMap=new Map(M.abbreviations.map(item=>[item.term,item.full]));
  const abbrPattern=new RegExp('(?<![\\p{L}\\p{N}_])(?:'+M.abbreviations.map(x=>x.term).sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![\\p{L}\\p{N}_])','gu');
  function annotate(root) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), nodes=[];
    while(walker.nextNode()) if(!walker.currentNode.parentElement.closest('abbr,script,style,svg,canvas,code,.glossary'))nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const text=node.textContent, matches=[...text.matchAll(abbrPattern)]; if(!matches.length)return;
      const fragment=document.createDocumentFragment();let offset=0;
      matches.forEach(match=>{fragment.append(text.slice(offset,match.index));const abbr=document.createElement('abbr');abbr.textContent=match[0];abbr.title=abbrMap.get(match[0]);fragment.append(abbr);offset=match.index+match[0].length;});
      fragment.append(text.slice(offset));node.replaceWith(fragment);
    });
  }
  const storageKey='opisis:lecture-02:v1';let state=M.restoreProgress(null), storageAvailable=true;
  try{state=M.restoreProgress(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{storageAvailable=false;}
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{storageAvailable=false;}if(!storageAvailable)$('.side-progress p').textContent='Сохранение недоступно. Отметки действуют до закрытия страницы.';}
  function updateProgress(){
    $('#progress-text').textContent=state.lessonComplete?'Пройдена':'Не пройдена';$('#progress-fill').style.width=state.lessonComplete?'100%':'0%';
    $('.progress-track').setAttribute('aria-valuenow',String(Number(state.lessonComplete)));
    $('#lesson-complete').setAttribute('aria-pressed',String(state.lessonComplete));
    $('#lesson-complete').setAttribute('aria-label',state.lessonComplete?'Лекция пройдена. Нажмите, чтобы снять отметку':'Лекция пройдена');
    $('#completion-feedback').textContent=state.lessonComplete?'Лекция отмечена как пройденная. Повторное нажатие снимет отметку.':'';
    if(!storageAvailable)$('.side-progress p').textContent='Сохранение недоступно. Отметки действуют до закрытия страницы.';
  }
  $('#lesson-complete').addEventListener('click',()=>{state.lessonComplete=!state.lessonComplete;updateProgress();save();});
  $('#reset-progress').addEventListener('click',()=>{if(!confirm('Сбросить отметку и ответы только второй лекции?'))return;state=M.restoreProgress(null);save();updateProgress();renderQuiz();});
  updateProgress();
  function bitsHtml(bits,{infoLength=bits.length,selected=-1,positions=null,indices=null,error=-1}={}){
    return bits.map((bit,i)=>{const info=positions?positions.includes(i):i<infoLength;return `<span class="bit-cell ${info?'information':'parity'} ${i===selected?'focused-bit':''} ${i===error?'error-bit':''}" title="Позиция ${indices?indices[i]:i}; значение ${bit}"><b>${bit}</b><small>${indices?indices[i]:i}</small></span>`;}).join('');
  }
  function renderCrc(){
    const text=$('#crc-data').value.trim();
    const valid=/^[01]{4,24}$/.test(text);$('#crc-data').setAttribute('aria-invalid',String(!valid));
    $('#crc-error').textContent=valid?'':'Введите от 4 до 24 символов, используя только 0 и 1.';
    if(!valid){$('#crc-transmitted').textContent='—';$('#crc-received').textContent='—';$('#crc-result').textContent='Для расчёта нужна допустимая битовая последовательность.';return;}
    const input=M.bitsOf(text), encoded=M.crcEncode(input), received=encoded.slice();if($('#crc-flip').checked)received[0]^=1;
    const remainder=M.crcRemainder(received), correct=remainder.every(bit=>bit===0);
    $('#crc-transmitted').innerHTML=bitsHtml(encoded,{infoLength:input.length});
    $('#crc-received').innerHTML=bitsHtml(received,{infoLength:input.length,error:$('#crc-flip').checked?0:-1});
    $('#crc-result').textContent=`Остаток проверки: ${remainder.join('')}. ${correct?'Проверка выполнена. В данном примере биты не изменены.':'Проверка нарушена: одиночная ошибка обнаружена. Положение ошибки проверка сама не исправляет.'}`;
  }
  ['crc-data','crc-flip'].forEach(id=>$(`#${id}`).addEventListener('input',renderCrc));renderCrc();

  let codeType='ldpc';
  function renderCode(){
    const N=Number($('#code-n').value),K=N*Number($('#code-rate').value), selection=$('#inspect-bit');
    selection.max=N-1;selection.value=Math.min(Number(selection.value),N-1);const selected=Number(selection.value);
    $('#inspect-bit-value').value=String(selected);
    $('#code-summary').innerHTML=`<span><b>N = ${N}</b>выходных битов</span><span><b>K = ${K}</b>входных битов</span><span><b>R = ${fmt(K/N)}</b>скорость кода</span>`;
    $$('[data-code]').forEach(button=>{const active=button.dataset.code===codeType;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
    const h=32+N*21, left=90, right=560;
    let svg=`<svg viewBox="0 0 700 ${h}" width="700" height="${h}" aria-hidden="true">`;
    if(codeType==='ldpc'){
      const H=M.parityMatrix(N,K),data=M.exampleBits(K),word=M.encodeParity(data,N),neighbors=H.map((row,r)=>row[selected]?r:-1).filter(r=>r>=0);
      H.forEach((row,r)=>row.forEach((bit,c)=>{if(!bit)return;const y1=26+c*21,y2=32+r*(h-64)/Math.max(1,H.length-1),active=c===selected;svg+=`<line x1="${left}" y1="${y1}" x2="${right}" y2="${y2}" stroke="${active?'var(--signal-purple)':'#d7e1ee'}" stroke-width="${active?2.5:1}"/>`;}));
      word.forEach((bit,i)=>{const y=26+i*21;svg+=`<circle cx="${left}" cy="${y}" r="${i===selected?8:5}" fill="${i<K?'var(--signal-blue)':'var(--signal-purple)'}"/><text x="${left-15}" y="${y+4}" text-anchor="end">x${i} = ${bit}</text>`;});
      H.forEach((row,r)=>{const y=32+r*(h-64)/Math.max(1,H.length-1);svg+=`<rect x="${right-7}" y="${y-7}" width="14" height="14" fill="${neighbors.includes(r)?'var(--signal-purple)':'#738baa'}"/><text x="${right+18}" y="${y+4}">проверка ${r}</text>`;});
      $('#code-detail').textContent=`Бит x${selected} входит в проверки: ${neighbors.join(', ')}. Все ${H.length} проверок для сформированного слова равны нулю. Синие узлы — информационная часть, фиолетовые — проверочная.`;
      $('#code-input-label').textContent='K ВХОДНЫХ БИТОВ';$('#code-input').innerHTML=bitsHtml(data,{selected});$('#code-output').innerHTML=bitsHtml(word,{infoLength:K,selected});
      $('#code-note').textContent='Учебный систематический код H = [A | I] с явно заданным правилом построения. Граф Таннера показывает связи битов и проверок. Это малый пример, а не базовый граф или оценка эффективности стандартного LDPC-кода. Меняя N и K, вы выбираете матрицу из этого учебного семейства.';
    }else{
      const example=M.polarExample(N,K),stages=Math.log2(N),x0=75,dx=520/stages;
      for(let stage=0;stage<stages;stage++){
        const half=2**stage;
        for(let row=0;row<N;row++){
          const y=26+row*21,x=x0+stage*dx;
          svg+=`<line x1="${x}" y1="${y}" x2="${x+dx}" y2="${y}" stroke="#9db3ce"/>`;
          if(row%(2*half)<half){svg+=`<line x1="${x}" y1="${y+half*21}" x2="${x+dx}" y2="${y}" stroke="#d0d9e8"/><circle cx="${x+dx}" cy="${y}" r="5" fill="var(--signal-purple)"/>`;}
        }
      }
      for(let row=0;row<N;row++){
        const y=26+row*21,info=example.positions.includes(row);
        svg+=`<text x="${x0-10}" y="${y+4}" text-anchor="end" fill="${info?'var(--signal-blue)':'#76879d'}">u${row}=${example.u[row]}</text><text x="${x0+stages*dx+12}" y="${y+4}">x${row}=${example.x[row]}</text>`;
        if(row===selected)svg+=`<rect x="6" y="${y-9}" width="61" height="18" rx="3" fill="none" stroke="var(--signal-blue)" stroke-width="2"/>`;
      }
      const info=example.positions.includes(selected);
      $('#code-detail').textContent=`Позиция u${selected}: ${info?'информационная':'замороженная в 0'}. Показатель z для выбранной модели = ${example.z[selected].toPrecision(3)}; меньше — надёжнее. Синяя рамка выделяет входную позицию; фиолетовые узлы — операции XOR.`;
      $('#code-input-label').textContent='u: ИНФОРМАЦИЯ И ЗАМОРОЖЕННЫЕ НУЛИ';$('#code-input').innerHTML=bitsHtml(example.u,{positions:example.positions,selected});$('#code-output').innerHTML=bitsHtml(example.x,{infoLength:0});
      $('#code-note').textContent='Показано преобразование F⊗n без отдельного битового разворота. Для выбора K позиций используется двоичный канал со стираниями (BEC), p = 0,5. Это не построение для канала с гауссовским шумом и не таблица надёжности стандарта 5G. Выход x не обязан содержать исходные информационные биты в неизменном виде.';
    }
    $('#code-drawing').innerHTML=svg+'</svg>';annotate($('#code-detail'));annotate($('#code-note'));
  }
  $$('[data-code]').forEach(button=>button.addEventListener('click',()=>{codeType=button.dataset.code;renderCode();}));
  ['code-n','code-rate','inspect-bit'].forEach(id=>$(`#${id}`).addEventListener('input',renderCode));renderCode();

  const matchWord=M.encodeParity(M.exampleBits(8),16);
  function renderMatching(){
    const E=Number($('#match-e').value),match=M.rateMatch(matchWord,E);$('#match-e-value').value=String(E);
    $('#match-source').innerHTML=bitsHtml(matchWord,{infoLength:8});
    $('#match-output').innerHTML=bitsHtml(match.bits,{infoLength:0,indices:match.indices});
    $('#match-result').textContent=`${E<16?'Пунктирование: не передаются последние '+(16-E)+' позиций.':E>16?'Повторение: добавлено '+(E-16)+' позиций чтением с начала.':'Длины совпадают: передаются все позиции один раз.'} Номинальная R = 0,5; эффективная K/E = ${fmt(8/E,3)}.`;
  }
  $('#match-e').addEventListener('input',renderMatching);renderMatching();

  function canvasContext(id){
    const canvas=$(`#${id}`),width=Math.max(1,canvas.clientWidth),height=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.font='12px Segoe UI, sans-serif';return {ctx,width,height};
  }
  const palette=()=>{const css=getComputedStyle(document.documentElement);return {blue:css.getPropertyValue('--signal-blue').trim(),purple:css.getPropertyValue('--signal-purple').trim()};};
  const noise=M.gaussianNoise(160);
  function renderModulation(){
    const Morder=Number($('#mod-order').value),qbits=Math.log2(Morder),bits=$('#mod-bits').value.trim(),sigma=Number($('#mod-noise').value),points=M.constellation(Morder),point=points.find(p=>p.bits===bits);
    $('#mod-bits').maxLength=qbits;$('#mod-bits').setAttribute('aria-invalid',String(!point));$('#mod-noise-value').value=fmt(sigma,3);
    $('#mod-error').textContent=point?'':`Длина группы — ${qbits}. Допустимы только символы 0 и 1.`;
    const result=canvasContext('constellation-canvas');if(!result)return;const {ctx,width,height}=result,{blue,purple}=palette();
    const margin=38,span=Math.min(width-2*margin,height-2*margin),cx=width/2,cy=height/2,scale=span/3.6;
    const X=x=>cx+x*scale,Y=q=>cy-q*scale;
    ctx.strokeStyle='#d7e1ed';ctx.lineWidth=1;
    for(let v=-1.5;v<=1.5;v+=.5){ctx.beginPath();ctx.moveTo(X(-1.6),Y(v));ctx.lineTo(X(1.6),Y(v));ctx.stroke();ctx.beginPath();ctx.moveTo(X(v),Y(-1.6));ctx.lineTo(X(v),Y(1.6));ctx.stroke();}
    ctx.strokeStyle='#839ab8';ctx.beginPath();ctx.moveTo(X(-1.7),cy);ctx.lineTo(X(1.7),cy);ctx.moveTo(cx,Y(-1.7));ctx.lineTo(cx,Y(1.7));ctx.stroke();
    ctx.fillStyle='#516b8a';ctx.fillText('I',Math.min(width-16,X(1.7)),cy-8);ctx.fillText('Q',cx+9,Math.max(15,Y(1.7)));
    points.forEach(p=>{ctx.beginPath();ctx.arc(X(p.i),Y(p.q),Morder>64?2:3,0,Math.PI*2);ctx.fillStyle='#92a8c2';ctx.fill();if(Morder<=16){ctx.font='11px Consolas, monospace';ctx.fillStyle='#6a7f9a';ctx.fillText(p.bits,X(p.i)+5,Y(p.q)-5);}});
    if(point){
      ctx.save();ctx.beginPath();ctx.rect(margin/2,margin/2,width-margin,height-margin);ctx.clip();
      for(let i=0;i<80;i++){ctx.beginPath();ctx.arc(X(point.i+sigma*noise[2*i]),Y(point.q+sigma*noise[2*i+1]),1.9,0,Math.PI*2);ctx.fillStyle=purple+'99';ctx.fill();}ctx.restore();
      ctx.beginPath();ctx.arc(X(point.i),Y(point.q),7,0,Math.PI*2);ctx.strokeStyle=blue;ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle=blue;ctx.font='bold 13px Consolas, monospace';ctx.fillText(bits,Math.min(width-bits.length*8-8,X(point.i)+10),Y(point.q)+20);
      const dmin=Morder===2?2:2/Math.sqrt(2*(Morder-1)/3);
      $('#mod-details').innerHTML=`<strong>${bits} → (${fmt(point.i,3)}; ${fmt(point.q,3)})</strong><p>Битов на символ: ${qbits}<br>Средняя E<sub>s</sub> = 1<br>Минимальное расстояние: ${fmt(dmin,3)}</p><p>Выделена идеальная точка. Фиолетовым показаны отсчёты этой же группы при добавлении шума.</p>`;
    }else $('#mod-details').textContent='Выберите допустимую битовую группу, чтобы выделить символ.';
  }
  $('#mod-order').addEventListener('change',()=>{$('#mod-bits').value='01011010'.slice(0,Math.log2(Number($('#mod-order').value)));renderModulation();});
  ['mod-bits','mod-noise'].forEach(id=>$(`#${id}`).addEventListener('input',renderModulation));
  $('#next-bits').addEventListener('click',()=>{const count=Math.log2(Number($('#mod-order').value)),old=/^[01]+$/.test($('#mod-bits').value)?parseInt($('#mod-bits').value,2):0;$('#mod-bits').value=((old+1)%(2**count)).toString(2).padStart(count,'0');renderModulation();});

  function plotFrame(result,{xMin,xMax,yMin,yMax,xLabel,yLabel,xTicks,yTicks}){
    const {ctx,width,height}=result,l=43,r=width-18,t=24,b=height-39;
    const X=x=>l+(x-xMin)/(xMax-xMin)*(r-l),Y=y=>b-(y-yMin)/(yMax-yMin)*(b-t);
    ctx.font='11px Segoe UI, sans-serif';ctx.strokeStyle='#d8e1ed';ctx.fillStyle='#6b809b';ctx.lineWidth=1;
    for(const v of xTicks){ctx.beginPath();ctx.moveTo(X(v),t);ctx.lineTo(X(v),b);ctx.stroke();ctx.fillText(fmt(v,2),X(v)-6,b+16);}
    for(const v of yTicks){ctx.beginPath();ctx.moveTo(l,Y(v));ctx.lineTo(r,Y(v));ctx.stroke();ctx.fillText(fmt(v,2),9,Y(v)+4);}
    ctx.fillText(yLabel,9,13);ctx.fillText(xLabel,Math.max(l,width-200),height-5);return {X,Y,l,r,t,b};
  }
  const pulseSymbols=['00','01','11','10','01','00','10','11'].map(bits=>M.constellation(4).find(p=>p.bits===bits));
  function renderSpectrum(){
    const Rs=Number($('#pulse-rate').value),alpha=Number($('#rolloff').value),B=(1+alpha)*Rs,{blue,purple}=palette();
    $('#pulse-rate-value').value=fmt(Rs)+' Мсимв/с';$('#rolloff-value').value=fmt(alpha);
    const pulse=canvasContext('pulse-canvas');
    if(pulse){
      const {ctx}=pulse,frame=plotFrame(pulse,{xMin:-1/Rs,xMax:8/Rs,yMin:-1.7,yMax:1.7,xLabel:'время, мкс',yLabel:'амплитуда',xTicks:[0,2,4,6,8].map(x=>x/Rs),yTicks:[-1,0,1]});
      for(const [key,color,dash] of [['i',blue,[7,4]],['q',purple,[]]]){
        ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);ctx.beginPath();
        for(let j=0;j<=700;j++){const x=-1+9*j/700,y=pulseSymbols.reduce((sum,p,k)=>sum+p[key]*M.raisedCosinePulse(x-k,alpha),0),px=frame.X(x/Rs),py=frame.Y(y);if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.setLineDash([]);
      }
    }
    const spectral=canvasContext('spectrum-canvas');
    if(spectral){
      const {ctx}=spectral,frame=plotFrame(spectral,{xMin:-5,xMax:5,yMin:0,yMax:1.15,xLabel:'частота в основной полосе, МГц',yLabel:'мощность, норм.',xTicks:[-4,-2,0,2,4],yTicks:[0,.5,1]});
      ctx.strokeStyle=blue;ctx.fillStyle=blue+'18';ctx.lineWidth=2.5;ctx.beginPath();
      for(let j=0;j<=800;j++){const f=-5+10*j/800,y=M.raisedCosineResponse(f,Rs,alpha)**2;if(j===0)ctx.moveTo(frame.X(f),frame.Y(y));else ctx.lineTo(frame.X(f),frame.Y(y));}ctx.stroke();ctx.lineTo(frame.X(5),frame.Y(0));ctx.lineTo(frame.X(-5),frame.Y(0));ctx.closePath();ctx.fill();
      ctx.strokeStyle=purple;ctx.setLineDash([5,4]);for(const edge of [-B/2,B/2]){ctx.beginPath();ctx.moveTo(frame.X(edge),frame.Y(0));ctx.lineTo(frame.X(edge),frame.Y(1));ctx.stroke();}ctx.setLineDash([]);
    }
    $('#spectrum-result').textContent=`Tₛ = ${fmt(1/Rs,3)} мкс. Полная ширина поддержки спектра B = (1 + ${fmt(alpha)}) · ${fmt(Rs)} = ${fmt(B,3)} МГц, от −${fmt(B/2,3)} до +${fmt(B/2,3)} МГц. Фиолетовый пунктир отмечает границы.`;
  }
  ['pulse-rate','rolloff'].forEach(id=>$(`#${id}`).addEventListener('input',renderSpectrum));
  function renderRate(){
    const order=Number($('#rate-mod').value),rate=Number($('#rate-code').value),Rs=Number($('#rate-symbols').value),fraction=Number($('#payload-fraction').value)/100,result=M.rateMetrics(order,Rs,rate,fraction);
    $('#rate-symbols-value').value=fmt(Rs)+' Мсимв/с';$('#payload-fraction-value').value=fmt(fraction*100)+'%';
    $('#rate-coded').textContent=fmt(result.coded)+' Мбит/с';$('#rate-info').textContent=fmt(result.info)+' Мбит/с';$('#rate-useful').textContent=fmt(result.useful)+' Мбит/с';
    $('#rate-observation').textContent=`Кодированных битов на символ: ${result.bitsPerSymbol}. ${fmt(Rs)} × ${result.bitsPerSymbol} × ${fmt(rate)} × ${fmt(fraction)} = ${fmt(result.useful)} Мбит/с полезных данных в этой модели.`;
  }
  ['rate-mod','rate-code','rate-symbols','payload-fraction'].forEach(id=>$(`#${id}`).addEventListener('input',renderRate));renderRate();

  function renderQuiz(){
    $('#quiz-questions').innerHTML=M.quiz.map((q,i)=>`<fieldset class="quiz-question"><legend><span class="question-number">${String(i+1).padStart(2,'0')}</span>${q.question}</legend><div class="quiz-options">${q.options.map((option,j)=>`<label><input type="radio" name="q${i}" value="${j}" ${state.answers[i]===j?'checked':''}><span>${option}</span></label>`).join('')}</div><p id="feedback-${i}" class="quiz-feedback" hidden></p></fieldset>`).join('');
    $('#quiz-result').hidden=true;if(state.submitted)showQuizResult(false);annotate($('#quiz-questions'));
  }
  function showQuizResult(focus){
    const result=$('#quiz-result'),missing=M.quiz.map((_,i)=>i).filter(i=>!Number.isInteger(state.answers[i]));result.hidden=false;
    if(missing.length){result.textContent=`Осталось ответить на ${missing.length} из ${M.quiz.length} вопросов. Начните с вопроса ${missing[0]+1}.`;if(focus)$(`input[name="q${missing[0]}"]`).focus();return;}
    let score=0;
    M.quiz.forEach((q,i)=>{const correct=state.answers[i]===q.answer;if(correct)score++;const feedback=$(`#feedback-${i}`);feedback.hidden=false;feedback.classList.toggle('wrong',!correct);feedback.textContent=`${correct?'Верно.':'Нужно повторить.'} ${q.explanation}`;annotate(feedback);$$(`input[name="q${i}"]`).forEach(input=>{input.closest('label').classList.toggle('correct',Number(input.value)===q.answer);input.closest('label').classList.toggle('incorrect',input.checked&&!correct);});});
    result.innerHTML=`<strong>${score} из ${M.quiz.length}</strong><span>${score===M.quiz.length?'Все ответы верны. Объясните своими словами путь от входных битов до передаваемого сигнала.':'Изучите пояснения и повторите соответствующие разделы.'}</span>`;state.submitted=true;save();if(focus)result.focus();
  }
  $('#quiz').addEventListener('change',event=>{if(!event.target.matches('input[type=radio]'))return;state.answers[Number(event.target.name.slice(1))]=Number(event.target.value);state.submitted=false;$$('.quiz-feedback').forEach(x=>{x.hidden=true;});$$('.quiz-options label').forEach(x=>x.classList.remove('correct','incorrect'));$('#quiz-result').hidden=true;save();});
  $('#quiz').addEventListener('submit',event=>{event.preventDefault();showQuizResult(true);});
  $('#quiz-reset').addEventListener('click',()=>{state.answers={};state.submitted=false;save();renderQuiz();});renderQuiz();
  if('ResizeObserver' in window){const observer=new ResizeObserver(()=>{renderModulation();renderSpectrum();});['constellation-canvas','pulse-canvas','spectrum-canvas'].forEach(id=>observer.observe($(`#${id}`)));}else window.addEventListener('resize',()=>{renderModulation();renderSpectrum();});
  renderModulation();renderSpectrum();
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)$$('.chapter-nav a').forEach(a=>{const active=a.hash==='#'+entry.target.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}),{rootMargin:'-10% 0px -65% 0px'});$$('.chapter').forEach(x=>observer.observe(x));}
  let printDetails=[];addEventListener('beforeprint',()=>{printDetails=$$('details:not([open])');printDetails.forEach(x=>{x.open=true;});});addEventListener('afterprint',()=>printDetails.forEach(x=>{x.open=false;}));$('#print-button').addEventListener('click',()=>print());
  annotate(document.body);
})();
