(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.TransmissionModel = model;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const abbreviations = [
    ['ОПИСиС','Основы построения информационных систем и сетей'],
    ['CRC','Cyclic Redundancy Check — циклическая проверка избыточности'],
    ['LDPC','Low-Density Parity-Check — код с малой плотностью проверок на чётность'],
    ['XOR','Exclusive OR — исключающее ИЛИ, сложение по модулю 2'],
    ['BEC','Binary Erasure Channel — двоичный канал со стираниями'],
    ['BPSK','Binary Phase Shift Keying — двоичная фазовая манипуляция'],
    ['QPSK','Quadrature Phase Shift Keying — квадратурная фазовая манипуляция'],
    ['QAM','Quadrature Amplitude Modulation — квадратурная амплитудная модуляция'],
    ['I/Q','In-phase / Quadrature — синфазная и квадратурная составляющие'],
    ['BER','Bit Error Rate — доля битовых ошибок'],
    ['АБГШ','Аддитивный белый гауссовский шум'],
    ['5G','Fifth Generation — пятое поколение мобильной связи'],
    ['NR','New Radio — новый радиоинтерфейс'],
    ['OFDM','Orthogonal Frequency-Division Multiplexing — мультиплексирование с ортогональным частотным разделением'],
    ['PDF','Portable Document Format — переносимый формат документов'],
    ['RF','Radio Frequency — радиочастотное представление'],
    ['IP','Internet Protocol — межсетевой протокол']
  ].map(([term, full]) => ({term, full}));
  const bitsOf = text => {
    if (!/^[01]+$/.test(text)) throw new RangeError('Допустимы только биты 0 и 1');
    return [...text].map(Number);
  };
  function crcRemainder(bits, polynomial = [1,0,1,1]) {
    if (polynomial.length < 2 || polynomial[0] !== 1 || polynomial.at(-1) !== 1) throw new RangeError('Неверный полином');
    const work = bits.slice();
    for (let i = 0; i <= work.length - polynomial.length; i++) if (work[i])
      polynomial.forEach((bit, j) => { work[i+j] ^= bit; });
    return work.slice(-(polynomial.length-1));
  }
  function crcEncode(bits) { return [...bits, ...crcRemainder([...bits,0,0,0])]; }
  const exampleBits = k => Array.from({length:k}, (_,i) => [1,0,1,1,0,0,1,0][i%8]);
  function validateCode(N, K) {
    if (![16,32].includes(N) || ![N/4,N/2,3*N/4].includes(K)) throw new RangeError('Выберите N=16/32 и K=N/4, N/2 или 3N/4');
  }
  function parityMatrix(N, K) {
    validateCode(N,K);
    const m = N-K;
    return Array.from({length:m}, (_,r) => Array.from({length:N}, (_,c) =>
      c >= K ? Number(c-K === r) : Number(r === c%m || r === (c+1+Math.floor(c/m))%m)));
  }
  function encodeParity(data,N) {
    const K=data.length, H=parityMatrix(N,K);
    return [...data, ...H.map(row => data.reduce((p,bit,i) => p ^ (bit & row[i]),0))];
  }
  const syndrome = (H,word) => H.map(row => row.reduce((value,bit,i) => value ^ (bit & word[i]),0));
  function becReliabilities(N, p=0.5) {
    if (!Number.isInteger(Math.log2(N)) || N<2 || !(p>=0&&p<=1)) throw new RangeError('Некорректные параметры поляризации');
    let z=[p];
    while(z.length<N) z=z.flatMap(value=>[2*value-value*value,value*value]);
    return z;
  }
  function polarTransform(input) {
    if (!Number.isInteger(Math.log2(input.length))) throw new RangeError('Длина должна быть степенью двойки');
    const x=input.slice();
    for(let half=1;half<x.length;half*=2) for(let block=0;block<x.length;block+=2*half)
      for(let j=0;j<half;j++) x[block+j]^=x[block+j+half];
    return x;
  }
  function polarExample(N,K) {
    validateCode(N,K);
    const z=becReliabilities(N), positions=Array.from({length:N},(_,i)=>i).sort((a,b)=>z[a]-z[b]||a-b).slice(0,K).sort((a,b)=>a-b);
    const data=exampleBits(K), u=Array(N).fill(0);
    positions.forEach((position,i)=>{u[position]=data[i];});
    return {z,positions,u,x:polarTransform(u),data};
  }
  function rateMatch(word,E) {
    if (!Number.isInteger(E)||E<1||!word.length) throw new RangeError('Некорректная длина');
    const indices=Array.from({length:E},(_,i)=>i%word.length);
    return {indices,bits:indices.map(i=>word[i]),mode:E<word.length?'puncture':E>word.length?'repeat':'unchanged'};
  }
  function constellation(M) {
    if (![2,4,16,64,256].includes(M)) throw new RangeError('Неподдерживаемая модуляция');
    if (M===2) return [{bits:'0',i:1,q:0},{bits:'1',i:-1,q:0}];
    const side=Math.sqrt(M), perAxis=Math.log2(side), norm=Math.sqrt(2*(M-1)/3), out=[];
    for(let i=0;i<side;i++) for(let q=0;q<side;q++) out.push({
      bits:(i^(i>>1)).toString(2).padStart(perAxis,'0')+(q^(q>>1)).toString(2).padStart(perAxis,'0'),
      i:(2*i-side+1)/norm,q:(2*q-side+1)/norm
    });
    return out;
  }
  function rateMetrics(M,Rs,rate,payloadFraction=1) {
    if (![2,4,16,64,256].includes(M)||!Number.isFinite(Rs)||Rs<=0||!(rate>0&&rate<=1)||!(payloadFraction>0&&payloadFraction<=1)) throw new RangeError('Некорректные параметры скорости');
    const bitsPerSymbol=Math.log2(M), coded=Rs*bitsPerSymbol, info=coded*rate;
    return {bitsPerSymbol,coded,info,useful:info*payloadFraction};
  }
  function sinc(x) { return Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x); }
  function raisedCosinePulse(x,alpha) {
    if (alpha===0) return sinc(x);
    if (Math.abs(Math.abs(2*alpha*x)-1)<1e-8) return Math.PI/4*sinc(x);
    return sinc(x)*Math.cos(Math.PI*alpha*x)/(1-(2*alpha*x)**2);
  }
  function raisedCosineResponse(f,Rs,alpha) {
    const a=Math.abs(f), low=(1-alpha)*Rs/2, high=(1+alpha)*Rs/2;
    if (a<=low) return 1;
    if (a>=high||alpha===0) return 0;
    return .5*(1+Math.cos(Math.PI*(a-low)/(alpha*Rs)));
  }
  function gaussianNoise(count,seed=127) {
    let state=seed>>>0;
    const uniform=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+1)/4294967297;};
    return Array.from({length:count},()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform()));
  }
  const quiz = [
    ['Зачем передатчику нужна избыточность?', ['Чтобы выполнять проверку и исправление ошибок при подходящем декодировании','Чтобы каждый символ всегда содержал один бит','Чтобы полностью исключить физический канал'],0,'Дополнительные проверочные соотношения помогают обнаруживать ошибки и восстанавливать данные; результат зависит от кода, канала и декодера.'],
    ['Чем CRC отличается от исправляющего кода?', ['CRC всегда исправляет любую одиночную ошибку','CRC прежде всего проверяет блок; исправление выполняет помехоустойчивый декодер','CRC меняет несущую частоту'],1,'CRC добавляет проверочный остаток. Сам по себе ненулевой остаток сообщает о нарушении проверки, но не задаёт исправленный блок.'],
    ['Почему N и K недостаточно для определения LDPC-кода?', ['Нужно ещё задать проверочную матрицу или правило её построения','Потому что K всегда равно N','Потому что LDPC не использует биты'],0,'При одинаковых N и K возможны разные матрицы H, графы проверок и свойства кода.'],
    ['Как используют позиции в полярном коде?', ['Все позиции обязательно несут независимые данные','Данные помещают в выбранные надёжные позиции, остальные замораживают','Замороженные позиции случайны и неизвестны приёмнику'],1,'Информационное множество выбирают по заданному правилу построения; значения замороженных позиций заранее известны.'],
    ['Кодер получает K=8 бит и выдаёт N=16 бит. Чему равна R?', ['2','1/4','1/2'],2,'Номинальная скорость кода R=K/N=8/16=1/2. Здесь K — вход кодера, который в реальном тракте может включать CRC.'],
    ['Что меняется при согласовании N=16 к E=24?', ['Для повторения части битов используются дополнительные позиции передачи','Скорость кода обязательно становится 24/16','Все информационные биты исчезают'],0,'В учебной модели выход кодера повторяется циклически до E. При K=8 эффективная скорость составит K/E=1/3.'],
    ['Сколько битов отображается в один символ 16-QAM?', ['2','4','16'],1,'Qm=log₂M=log₂16=4. Это число кодированных битов на модуляционный символ.'],
    ['Что означает нормировка Es=1 в интерактиве?', ['Средняя энергия символа одинакова для сравниваемых созвездий','Средняя энергия информационного бита одинакова при любых M и R','Шум отсутствует'],0,'Энергия символа и энергия бита — разные величины. Изменение числа битов на символ меняет их соотношение.'],
    ['Как корректно сравнить некодированные когерентные BPSK и QPSK в АБГШ?', ['QPSK всегда хуже при одинаковом Eb/N0','Их теоретическая BER одинакова при одинаковом Eb/N0 и отображении Грея','Они имеют одинаковое число точек созвездия'],1,'Для этих условий BPSK и QPSK имеют одинаковую теоретическую вероятность битовой ошибки; при одинаковой энергии символа условия уже другие.'],
    ['Какова роль формирующего фильтра?', ['Он определяет IP-адрес','Он управляет формой импульсов и спектром сигнала','Он заменяет все заголовки CRC'],1,'Импульсное формирование связывает последовательность символов с непрерывным сигналом и его занимаемой полосой.'],
    ['Что произойдёт с B=(1+α)Rs при росте α и фиксированной Rs?', ['Полоса увеличится','Полоса уменьшится','Полоса не изменится'],0,'Рост коэффициента скругления расширяет переходную область выбранного фильтра и занимаемую полосу.'],
    ['При Rs=1 Мсимв/с, 16-QAM и R=1/2 чему равна скорость на входе кодера без дополнительных расходов?', ['8 Мбит/с','4 Мбит/с','2 Мбит/с'],2,'Rs·log₂M·R=1·4·1/2=2 Мбит/с. Для полезных данных приложения нужно дополнительно учесть служебные расходы.']
  ].map(([question,options,answer,explanation])=>({question,options,answer,explanation}));
  function restoreProgress(saved) {
    const state={lessonComplete:false,answers:{},submitted:false};
    if(!saved||typeof saved!=='object')return state;
    state.lessonComplete=saved.lessonComplete===true;
    quiz.forEach((item,i)=>{const value=saved.answers?.[i];if(Number.isInteger(value)&&value>=0&&value<item.options.length)state.answers[i]=value;});
    state.submitted=saved.submitted===true&&Object.keys(state.answers).length===quiz.length;
    return state;
  }
  return {abbreviations,bitsOf,crcRemainder,crcEncode,exampleBits,parityMatrix,encodeParity,syndrome,becReliabilities,polarTransform,polarExample,rateMatch,constellation,rateMetrics,sinc,raisedCosinePulse,raisedCosineResponse,gaussianNoise,quiz,restoreProgress};
});
