(() => {
  'use strict';

  const questions = [
    {ja:'ねこ', answers:['neko']},
    {ja:'いぬ', answers:['inu']},
    {ja:'とり', answers:['tori']},
    {ja:'むし', answers:['mushi','musi']},
    {ja:'かぶとむし', answers:['kabutomushi','kabutomusi']},
    {ja:'くわがた', answers:['kuwagata']},
    {ja:'かまきり', answers:['kamakiri']},
    {ja:'ちょうちょ', answers:['choucho','tyoutyo','choutyo','tyoucho']},
    {ja:'すずめ', answers:['suzume']},
    {ja:'つばめ', answers:['tsubame','tubame']},
    {ja:'さかな', answers:['sakana']},
    {ja:'うさぎ', answers:['usagi']},
    {ja:'きつね', answers:['kitsune','kitune']},
    {ja:'たぬき', answers:['tanuki']},
    {ja:'りんご', answers:['ringo']},
    {ja:'みかん', answers:['mikan']},
    {ja:'すいか', answers:['suika']},
    {ja:'でんしゃ', answers:['densha','densya']},
    {ja:'くるま', answers:['kuruma']},
    {ja:'ひこうき', answers:['hikouki']},
    {ja:'がっこう', answers:['gakkou']},
    {ja:'きって', answers:['kitte']},
    {ja:'にっぽん', answers:['nippon']},
    {ja:'きょうりゅう', answers:['kyouryuu']},
    {ja:'しゃしん', answers:['shashin','syasin']},
    {ja:'ちきゅう', answers:['chikyuu','tikyuu']},
    {ja:'うちゅう', answers:['uchuu','utyuu']},
    {ja:'りょこう', answers:['ryokou']}
  ];

  const promptEl = document.getElementById('prompt');
  const hintEl = document.getElementById('hint');
  const inputEl = document.getElementById('typingInput');
  const feedbackEl = document.getElementById('feedback');
  const scoreEl = document.getElementById('score');
  const streakEl = document.getElementById('streak');
  const nextBtn = document.getElementById('nextBtn');
  const tableToggle = document.getElementById('tableToggle');
  const romajiTable = document.getElementById('romajiTable');

  let current = null;
  let previousIndex = -1;
  let score = 0;
  let streak = 0;
  let solved = false;

  const REQUIRED_CORRECT = 10;
  const REWARD_TOKEN_KEY = "miniGameRewardToken";

  function normalize(value){
    return value
      .normalize("NFKC")
      .trim()
      .replace(/[\\u30a1-\\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
      .replace(/\\s+/g, "");
  }

  function completeLesson(){
    const token = String(Date.now()) + "-" + String(Math.random());
    sessionStorage.setItem(REWARD_TOKEN_KEY, token);
    window.location.replace("game-menu.html");
  }

  function pickQuestion(){
    let index = Math.floor(Math.random() * questions.length);
    if(questions.length > 1 && index === previousIndex){
      index = (index + 1 + Math.floor(Math.random() * (questions.length - 1))) % questions.length;
    }
    previousIndex = index;
    current = questions[index];
    solved = false;
    promptEl.textContent = current.ja;
    hintEl.textContent = '';
    inputEl.value = '';
    inputEl.classList.remove('correct','wrong');
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = 'キーボードで入力してね';
    inputEl.disabled = false;
    inputEl.focus();
  }

  function check(){
    if(solved) return;
    const value = normalize(inputEl.value);
    if(!value){
      inputEl.classList.remove('correct','wrong');
      feedbackEl.className = 'feedback';
      feedbackEl.textContent = 'キーボードで入力してね';
      return;
    }

    const answer = normalize(current.ja);
    if(value === answer){
      solved = true;
      score += 1;
      streak += 1;
      scoreEl.textContent = score;
      streakEl.textContent = streak;
      inputEl.classList.remove('wrong');
      inputEl.classList.add('correct');
      inputEl.disabled = true;
      feedbackEl.className = 'feedback ok';
      feedbackEl.textContent = score >= REQUIRED_CORRECT ? '10もん せいかい！ ごほうび！ 🎉' : 'せいかい！ 🎉';
      hintEl.textContent = '';
      setTimeout(score >= REQUIRED_CORRECT ? completeLesson : pickQuestion, 700);
      return;
    }

    if(answer.startsWith(value)){
      inputEl.classList.remove('wrong');
      feedbackEl.className = 'feedback';
      feedbackEl.textContent = 'そのちょうし！';
    }else{
      inputEl.classList.add('wrong');
      feedbackEl.className = 'feedback ng';
      feedbackEl.textContent = 'ちがうよ。もどしてなおそう';
      streak = 0;
      streakEl.textContent = streak;
    }
  }

  inputEl.addEventListener('input', check);
  inputEl.addEventListener('keydown', (event) => {
    if(event.key === 'Enter'){
      event.preventDefault();
      if(solved) pickQuestion();
      else check();
    }
  });

  nextBtn.addEventListener('click', pickQuestion);

  tableToggle.addEventListener('click', () => {
    const opening = romajiTable.classList.contains('hidden');
    romajiTable.classList.toggle('hidden', !opening);
    tableToggle.classList.toggle('on', opening);
    tableToggle.textContent = opening ? '表をオフ' : '表をオン';
    tableToggle.setAttribute('aria-expanded', String(opening));
    if(!opening) inputEl.focus();
  });

  pickQuestion();
})();