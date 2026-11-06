const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../lecture-02-model.js');
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('CRC-3: известный остаток, корректное слово и все одиночные ошибки',()=>{
  const data=M.bitsOf('11010011101100'),word=M.crcEncode(data);
  assert.equal(word.slice(-3).join(''),'100');
  assert.deepEqual(M.crcRemainder(word),[0,0,0]);
  for(let i=0;i<word.length;i++){const received=word.slice();received[i]^=1;assert.ok(M.crcRemainder(received).some(Boolean));}
  const undetected=word.slice();[1,0,1,1].forEach((bit,i)=>{undetected[i]^=bit;});
  assert.deepEqual(M.crcRemainder(undetected),[0,0,0],'ошибка, кратная g(x), не должна выдаваться за обнаруженную');
  assert.throws(()=>M.bitsOf('101x'),RangeError);
});
test('проверочная матрица: любые исследуемые слова удовлетворяют Hxᵀ=0',()=>{
  for(const N of [16,32])for(const rate of [.25,.5,.75]){
    const K=N*rate,H=M.parityMatrix(N,K);
    for(let i=0;i<K;i++){
      const input=Array(K).fill(0);input[i]=1;
      const word=M.encodeParity(input,N);assert.equal(word.length,N);assert.deepEqual(word.slice(0,K),input);assert.ok(M.syndrome(H,word).every(v=>v===0));
    }
  }
});
test('полярное преобразование: явный вектор, линейность и обратимость',()=>{
  assert.deepEqual(M.polarTransform([1,0,1,1]),[1,1,0,1]);
  for(const N of [16,32]){
    const a=M.exampleBits(N),b=Array.from({length:N},(_,i)=>Number(i%3===0));
    assert.deepEqual(M.polarTransform(M.polarTransform(a)),a);
    assert.deepEqual(M.polarTransform(a.map((v,i)=>v^b[i])),M.polarTransform(a).map((v,i)=>v^M.polarTransform(b)[i]));
    for(const K of [N/4,N/2,3*N/4]){
      const e=M.polarExample(N,K);assert.equal(e.positions.length,K);assert.equal(new Set(e.positions).size,K);
      e.u.forEach((bit,i)=>{if(!e.positions.includes(i))assert.equal(bit,0);});
      const chosen=e.positions.map(i=>e.z[i]),frozen=e.z.filter((_,i)=>!e.positions.includes(i));assert.ok(Math.max(...chosen)<=Math.min(...frozen));
    }
  }
});
test('надёжности BEC соответствуют точному восстановлению на канале стираний N=4',()=>{
  // Independent check: for each erasure pattern, enumerate future unknown bits.
  const N=4,reliability=[];
  for(let bit=0;bit<N;bit++){
    let ambiguous=0;
    for(let mask=0;mask<2**N;mask++){
      let canConfuse=false;
      for(let candidate=0;candidate<2**(N-bit-1);candidate++){
        const u=Array(N).fill(0);u[bit]=1;
        for(let j=bit+1;j<N;j++)u[j]=(candidate>>(j-bit-1))&1;
        const x=M.polarTransform(u);
        if(x.every((v,i)=>((mask>>i)&1)||v===0)){canConfuse=true;break;}
      }
      if(canConfuse)ambiguous++;
    }
    reliability.push(ambiguous/2**N);
  }
  assert.deepEqual(M.becReliabilities(4),reliability);
});
test('согласование: порядок индексов, сохранение длины и повторение',()=>{
  const word=M.exampleBits(16);
  assert.deepEqual(M.rateMatch(word,8).bits,word.slice(0,8));
  assert.deepEqual(M.rateMatch(word,24).indices,Array.from({length:24},(_,i)=>i%16));
  assert.equal(M.rateMatch(word,16).mode,'unchanged');assert.throws(()=>M.rateMatch(word,0),RangeError);
});
test('созвездия: уникальные метки, единичная средняя энергия и соседство Грея',()=>{
  for(const order of [2,4,16,64,256]){
    const c=M.constellation(order);assert.equal(c.length,order);assert.equal(new Set(c.map(p=>p.bits)).size,order);
    close(c.reduce((sum,p)=>sum+p.i*p.i+p.q*p.q,0)/order,1);
    assert.ok(c.every(p=>p.bits.length===Math.log2(order)));
    if(order>2){const side=Math.sqrt(order);for(let i=0;i<side-1;i++)for(let q=0;q<side;q++){
      const a=c[i*side+q].bits,b=c[(i+1)*side+q].bits;assert.equal([...a].filter((v,j)=>v!==b[j]).length,1);
    }}
  }
});
test('приподнятый косинус: конечность в особых точках и заявленные границы спектра',()=>{
  for(const alpha of [0,.25,.5,1]){
    close(M.raisedCosinePulse(0,alpha),1);
    for(let k=-4;k<=4;k++)if(k)close(M.raisedCosinePulse(k,alpha),0);
    if(alpha>0){const x=1/(2*alpha),limit=M.raisedCosinePulse(x,alpha);assert.ok(Number.isFinite(limit));close(M.raisedCosinePulse(x+1e-6,alpha),limit,1e-5);}
    const edge=(1+alpha)*2/2;assert.equal(M.raisedCosineResponse(edge+.01,2,alpha),0);close(M.raisedCosineResponse(0,2,alpha),1);
  }
});
test('полезная скорость и независимое состояние второй лекции',()=>{
  assert.deepEqual(M.rateMetrics(16,1,.5),{bitsPerSymbol:4,coded:4,info:2,useful:2});
  close(M.rateMetrics(4,2,.75,.8).useful,2.4);
  const answers=Object.fromEntries(M.quiz.map((q,i)=>[i,q.answer]));assert.equal(M.restoreProgress({answers,submitted:true}).submitted,true);
  assert.equal(M.restoreProgress({answers:{0:100},submitted:true}).submitted,false);
  assert.equal(M.quiz.length,12);assert.ok(fs.readFileSync(path.join(__dirname,'../lecture-02.js'),'utf8').includes('opisis:lecture-02:v1'));
});
test('страница второй лекции: ресурсы, якоря, восемь терминов и одна отметка',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../lecture-02.html'),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),match[1]);
  for(const match of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g))if(!/^https?:/.test(match[1]))assert.ok(fs.existsSync(path.join(__dirname,'..',match[1].split(/[?#]/)[0])),match[1]);
  assert.equal((html.match(/<dt>/g)||[]).length,8);assert.equal((html.match(/id="lesson-complete"/g)||[]).length,1);assert.equal(html.includes('data-complete='),false);
  const first=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(first.includes('href="lecture-02.html"'));assert.ok(html.includes('href="index.html"'));
});
