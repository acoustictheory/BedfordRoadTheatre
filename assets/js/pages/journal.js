const JOURNAL_UI_BUILD='journal-v41-1-glow-responsive-20260814';

const JOURNAL_PHASES=[
  {id:'Starting the Journey',icon:'✦',short:'Starting',copy:'Meeting the company, learning expectations, finding your place, and setting early goals.'},
  {id:'Building Foundations',icon:'▦',short:'Foundations',copy:'Learning material, routines, responsibilities, vocabulary, music, lines, design ideas, and rehearsal habits.'},
  {id:'Developing Craft',icon:'◆',short:'Craft',copy:'Strengthening acting, voice, music, movement, design, technical, or leadership skills.'},
  {id:'Connecting the Show',icon:'↔',short:'Connecting',copy:'Making scenes, departments, relationships, transitions, and ensemble work connect into one production.'},
  {id:'Integrating Movement & Memory',icon:'◇',short:'Movement + Memory',copy:'Combining choreography, blocking, lines, music, cues, physical choices, and memory under pressure.'},
  {id:'Runs & Refinement',icon:'↗',short:'Refinement',copy:'Running larger sections, taking notes, building consistency, stamina, pacing, detail, and recovery skills.'},
  {id:'Tech & Dress',icon:'⚙',short:'Tech + Dress',copy:'Integrating technical elements, costumes, microphones, scenery, backstage systems, and full-company timing.'},
  {id:'Performance',icon:'★',short:'Performance',copy:'Performing for an audience while staying present, adaptable, responsible, and connected to the company.'},
  {id:'Closing Reflection',icon:'∞',short:'Looking Back',copy:'Looking back at how you changed, what you contributed, and what you will carry beyond this production.'}
];

const JOURNAL_FOCUS_AREAS=[
  'Acting & Character','Vocal Technique','Music & Harmony','Lines & Memorization','Choreography & Movement',
  'Blocking & Stage Awareness','Technical / Design Craft','Teamwork & Ensemble','Leadership & Responsibility',
  'Grit & Resilience','Confidence & Risk-Taking','Preparation & Time Management','Creativity & Problem Solving','Communication & Feedback'
];

const JOURNAL_LENSES=[
  ['Craft','What changed in the quality, control, detail, or technique of your work?'],
  ['Ensemble','How did your choices affect other people, and how did their work affect you?'],
  ['Resilience','What did you do when the work became difficult, uncertain, repetitive, or frustrating?'],
  ['Responsibility','How did preparation, focus, reliability, or leadership affect the work today?'],
  ['Self-awareness','What did you learn about how you learn, rehearse, communicate, or respond to feedback?'],
  ['Creativity','Where did you experiment, solve a problem, make a choice, or see a new possibility?']
];

const PHASE_PROMPTS={
  'Starting the Journey':[
    'What surprised you about the first days of this process, and what does that tell you about what you may need to learn?',
    'Where do you already feel comfortable, and where are you still uncertain or hesitant?',
    'What kind of company member do you want to become by the end of this production?',
    'What early habit could make the biggest difference for future-you?'
  ],
  'Building Foundations':[
    'What basic skill or routine is beginning to feel more automatic, and what helped it improve?',
    'Where are you still relying on reminders, scripts, tracks, diagrams, or another person—and what is your plan to become more independent?',
    'What feedback have you received more than once, and what are you doing differently because of it?',
    'What is one small preparation choice that made rehearsal or production work easier today?'
  ],
  'Developing Craft':[
    'Name one specific technique you are trying to improve. What evidence shows it changed today?',
    'What choice became more intentional today rather than accidental?',
    'Where did you notice the difference between simply completing the task and doing it with craft?',
    'What detail would an audience never consciously notice but still makes the work stronger?'
  ],
  'Connecting the Show':[
    'Where did your work depend on someone else today, and what did good collaboration look like?',
    'What transition, relationship, cue, or sequence became clearer when you saw the larger picture?',
    'Where did the company lose connection or momentum, and what could help the group recover more quickly?',
    'How did your individual responsibility contribute to something bigger than your own role?'
  ],
  'Integrating Movement & Memory':[
    'What happens to your acting, voice, timing, or focus when your brain is also managing movement or memory?',
    'Which part breaks down first when several skills are combined, and what strategy could make that combination more secure?',
    'What memory strategy actually worked today—physical landmarks, repetition, cue words, music, imagery, relationships, or something else?',
    'Where can you stop thinking about the steps and start communicating the story?'
  ],
  'Runs & Refinement':[
    'What stayed consistent across the run, and what became less reliable when you were tired or under pressure?',
    'Which note would create the biggest improvement if you truly solved it before the next run?',
    'Where did you recover well from a mistake instead of letting it affect the next moment?',
    'What are you doing now that you could not have done confidently a few weeks ago?'
  ],
  'Tech & Dress':[
    'What changed when technical, costume, microphone, scenic, or backstage elements were added?',
    'Where did you need patience or adaptability because another department was solving a problem?',
    'What responsibility now has to happen the same way every time for the production to run safely and smoothly?',
    'What did you learn about how many people and systems are required to create one moment onstage?'
  ],
  'Performance':[
    'What felt different with an audience present, and how did you use that energy without losing your technique or focus?',
    'Where were you most present today rather than simply trying to remember what comes next?',
    'What mistake or unexpected event did you recover from professionally?',
    'What did you give to the company or audience today that you are proud of?'
  ],
  'Closing Reflection':[
    'Compare who you were at the beginning of this process with who you are now. What changed most?',
    'What difficulty are you now grateful you had to work through?',
    'What contribution did you make to this company that cannot be measured by applause?',
    'What skill, habit, relationship, or belief will you carry into the next part of your life?'
  ]
};

const FOCUS_PROMPTS={
  'Acting & Character':['What does your character want more clearly now?','Which choice made the scene feel more truthful, specific, or connected?'],
  'Vocal Technique':['What changed in breath, resonance, diction, pitch, range, registration, or stamina?','What physical or listening cue helped your voice work more efficiently?'],
  'Music & Harmony':['Which musical detail became more secure—notes, rhythm, harmony, phrasing, tuning, dynamics, or listening?','Where did listening to someone else change what you sang or played?'],
  'Lines & Memorization':['Which cue-to-line connection became stronger, and what memory strategy helped?','Where are you still reciting words rather than responding in the scene?'],
  'Choreography & Movement':['Which movement is becoming embodied rather than counted?','How can movement communicate character or story instead of only showing the steps?'],
  'Blocking & Stage Awareness':['What spatial choice, traffic pattern, sightline, entrance, exit, or transition became clearer?','Where did awareness of other performers or stage geography improve your work?'],
  'Technical / Design Craft':['What design or technical decision became more intentional because of today’s work?','What constraint forced you to problem-solve creatively?'],
  'Teamwork & Ensemble':['How did you make someone else’s work easier or stronger today?','Where did the group need more listening, trust, patience, or shared responsibility?'],
  'Leadership & Responsibility':['What did you notice and take responsibility for without being asked?','How did your choices affect the readiness or confidence of the group?'],
  'Grit & Resilience':['What did you do after frustration, failure, fatigue, or a mistake?','What helped you stay engaged when improvement was slow?'],
  'Confidence & Risk-Taking':['What did you try today that felt vulnerable, unfamiliar, or bold?','What evidence suggests your confidence is becoming more grounded in preparation?'],
  'Preparation & Time Management':['What preparation paid off today?','What needs to happen before the next rehearsal so you arrive ready rather than catching up?'],
  'Creativity & Problem Solving':['What problem had more than one possible solution, and why did you choose yours?','Where did experimentation lead to a better idea?'],
  'Communication & Feedback':['What feedback did you understand differently after trying it?','How did the way you communicated affect the outcome of the work?']
};

function journalDateKey(value){
  const text=String(value??'').trim();if(!text)return '';
  const direct=text.match(/^(\d{4})-(\d{2})-(\d{2})/);if(direct)return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const d=new Date(text);if(Number.isNaN(d.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Regina',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).reduce((a,p)=>(a[p.type]=p.value,a),{});
  return parts.year&&parts.month&&parts.day?`${parts.year}-${parts.month}-${parts.day}`:'';
}
function formatJournalDate(value){const key=journalDateKey(value);if(!key)return 'Date unavailable';const [y,m,d]=key.split('-').map(Number);return new Intl.DateTimeFormat('en-CA',{dateStyle:'medium'}).format(new Date(y,m-1,d,12));}
function todayJournalKey(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;}
function journalTrue(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1';}
function sameJournalId(a,b){return String(a??'')===String(b??'');}
function journalNumber(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function journalClip(v,n=220){const s=String(v||'').trim();return s.length>n?`${s.slice(0,n-1)}…`:s;}
function journalFocusList(value){return String(value||'').split('||').map(x=>x.trim()).filter(Boolean);}
function journalPhaseRecord(id){return JOURNAL_PHASES.find(x=>x.id===id)||{id:id||'Unspecified phase',icon:'○',short:id||'Unspecified',copy:''};}
function journalFeedbackForEntry(entry,feedback){return (feedback||[]).filter(f=>sameJournalId(f.JournalEntryID,entry.JournalEntryID)).sort((a,b)=>String(a.CreatedAt||'').localeCompare(String(b.CreatedAt||'')));}
function submittedEntries(entries){return entries.filter(e=>String(e.Status)==='Submitted');}
function latestPreviousGoal(entries,excludeId=''){
  return submittedEntries(entries).filter(e=>!excludeId||!sameJournalId(e.JournalEntryID,excludeId)).sort((a,b)=>String(b.EntryDate).localeCompare(String(a.EntryDate))).find(e=>String(e.NextStep||'').trim())||null;
}
function journalMilestones(entries,feedback){
  const submitted=submittedEntries(entries),minutes=submitted.reduce((s,e)=>s+journalNumber(e.MinutesWorked),0),items=[];
  if(submitted.length>=1)items.push(['✦','First reflection captured','You started building a record of your learning.']);
  if(submitted.length>=5)items.push(['↗','Building momentum','Five learning snapshots are now part of your production story.']);
  if(submitted.length>=10)items.push(['◎','Reflective habit','You have documented ten moments of learning and growth.']);
  if(minutes>=300)items.push(['◷','Five hours documented','You have recorded at least five hours of focused production work.']);
  if((feedback||[]).length>=1)items.push(['↔','Feedback loop started','You have reviewer feedback you can use in your next rehearsal or work session.']);
  if(submitted.some(e=>journalTrue(e.HelpRequested)))items.push(['◇','Used your support network','Asking for help is part of learning, collaboration, and production work.']);
  if(submitted.some(e=>journalTrue(e.PortfolioStar)))items.push(['★','Growth Book curator','You chose a reflection that matters enough to revisit later.']);
  if(submitted.some(e=>String(e.ProductionPhase)==='Closing Reflection'))items.push(['∞','Journey reflected','You looked back across the entire production rather than only one rehearsal.']);
  return items.slice(-5);
}
function focusCounts(entries){const counts=new Map();submittedEntries(entries).forEach(e=>journalFocusList(e.FocusAreas).forEach(f=>counts.set(f,(counts.get(f)||0)+1)));return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}
function phaseCounts(entries){const map=new Map();submittedEntries(entries).forEach(e=>{const p=e.ProductionPhase||'Unspecified phase';map.set(p,(map.get(p)||0)+1);});return map;}
function escapeBook(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

let JOURNAL_STUDENT_STATE={entries:[],feedback:[],main:null,host:null,load:null};

document.addEventListener('DOMContentLoaded',()=>BRM.initPrivatePage(async()=>{
  const main=document.querySelector('#app-main');JOURNAL_STUDENT_STATE.main=main;
  main.innerHTML=`<div class="journal-page" data-journal-build="${JOURNAL_UI_BUILD}">
    <section class="journal-hero journal-journey-hero">
      <div>
        <span class="eyebrow">Your private production journey</span>
        <h1>My Musical Journey</h1>
        <p>This journal is not a list of tasks. It is where you notice how your craft, confidence, habits, relationships, resilience, and responsibility change as the show grows.</p>
        <div class="journal-privacy-line"><span>🔒</span><span>Other students cannot see your entries. Authorized teachers and administrators can review submitted reflections and respond privately.</span></div>
      </div>
      <div class="journal-hero-actions">
        <button class="button button-primary" data-new-entry>+ Capture a learning moment</button>
        <button class="button button-secondary" data-growth-book>📖 Create my Growth Book</button>
        <button class="button button-ghost button-small" data-reflection-guide>How do I write a strong reflection?</button>
        <span class="journal-build">${JOURNAL_UI_BUILD}</span>
      </div>
    </section>

    <section class="journal-snapshot-grid" data-journal-snapshot></section>
    <section class="panel journal-journey-map"><div class="section-heading"><div><span class="eyebrow">The production changes — so should the questions</span><h2>Your journey through the show</h2><p>Each phase asks something different of you. Your reflections can change with it.</p></div></div><div class="journal-phase-map" data-phase-map></div></section>

    <div class="journal-layout">
      <div class="stack">
        <section class="panel">
          <div class="section-heading"><div><span class="eyebrow">Your story so far</span><h2>Reflection timeline</h2><p>Look back at the specific moments that built the production—and built you.</p></div></div>
          <div class="toolbar journal-toolbar">
            <div class="search-wrap"><input class="search-input" data-search placeholder="Search your reflections"></div>
            <div class="toolbar-group">
              <select class="search-input" data-status><option value="">All entries</option><option>Submitted</option><option>Draft</option></select>
              <select class="search-input" data-phase><option value="">All phases</option>${JOURNAL_PHASES.map(p=>`<option value="${BRM.escape(p.id)}">${BRM.escape(p.short)}</option>`).join('')}</select>
              <select class="search-input" data-focus><option value="">All growth areas</option>${JOURNAL_FOCUS_AREAS.map(f=>`<option>${BRM.escape(f)}</option>`).join('')}</select>
            </div>
          </div>
          <div data-journal-list></div>
        </section>
      </div>
      <aside class="stack">
        <section class="panel journal-next-panel" data-next-step></section>
        <section class="panel" data-growth-threads></section>
        <section class="panel" data-milestones></section>
        <section class="panel" data-book-panel></section>
      </aside>
    </div>
  </div>`;

  const host=main.querySelector('[data-journal-list]');JOURNAL_STUDENT_STATE.host=host;
  const load=async()=>{
    BRM.loading(host,'Loading your musical journey…');
    try{
      const result=await BRM.api('myJournal',{}, {noCache:true,forceNetwork:true});
      JOURNAL_STUDENT_STATE.entries=(result.entries||[]).map(e=>({...e,EntryDate:journalDateKey(e.EntryDate)}));
      JOURNAL_STUDENT_STATE.feedback=result.feedback||[];
      renderStudentJournal();
    }catch(e){host.innerHTML=`<div class="alert alert-error"><strong>Your journal could not load.</strong><div style="margin-top:6px">${BRM.escape(e.message)}</div></div>`;}
  };
  JOURNAL_STUDENT_STATE.load=load;

  main.querySelector('[data-search]').addEventListener('input',renderStudentTimeline);
  main.querySelector('[data-status]').addEventListener('change',renderStudentTimeline);
  main.querySelector('[data-phase]').addEventListener('change',renderStudentTimeline);
  main.querySelector('[data-focus]').addEventListener('change',renderStudentTimeline);
  main.querySelector('[data-new-entry]').addEventListener('click',()=>openJournalForm(null,load,JOURNAL_STUDENT_STATE.entries));
  main.querySelector('[data-growth-book]').addEventListener('click',()=>openStudentGrowthBook());
  main.querySelector('[data-reflection-guide]').addEventListener('click',openReflectionGuide);

  await load();
  if(new URLSearchParams(location.search).get('new'))openJournalForm(null,load,JOURNAL_STUDENT_STATE.entries);
}));

function renderStudentJournal(){
  renderStudentSnapshot();renderPhaseMap();renderStudentTimeline();renderNextStep();renderGrowthThreads();renderMilestones();renderBookPanel();
}

function renderStudentSnapshot(){
  const {main,entries,feedback}=JOURNAL_STUDENT_STATE,submitted=submittedEntries(entries);
  const minutes=submitted.reduce((s,e)=>s+journalNumber(e.MinutesWorked),0),threads=focusCounts(entries).length;
  const connected=submitted.filter(e=>String(e.PreviousGoalReflection||'').trim()).length;
  main.querySelector('[data-journal-snapshot]').innerHTML=`
    <div class="journal-stat"><span>Reflections</span><strong>${submitted.length}</strong><small>moments captured</small></div>
    <div class="journal-stat"><span>Time documented</span><strong>${Math.round(minutes/60*10)/10}</strong><small>hours of process</small></div>
    <div class="journal-stat"><span>Growth threads</span><strong>${threads}</strong><small>areas you have reflected on</small></div>
    <div class="journal-stat"><span>Goals revisited</span><strong>${connected}</strong><small>times you checked your own next step</small></div>
    <div class="journal-stat"><span>Feedback</span><strong>${feedback.length}</strong><small>private responses received</small></div>`;
}

function renderPhaseMap(){
  const counts=phaseCounts(JOURNAL_STUDENT_STATE.entries),target=JOURNAL_STUDENT_STATE.main.querySelector('[data-phase-map]');
  target.innerHTML=JOURNAL_PHASES.map(p=>`<button type="button" class="journal-phase-card ${counts.get(p.id)?'visited':''}" data-phase-filter="${BRM.escape(p.id)}"><span class="journal-phase-icon">${p.icon}</span><strong>${BRM.escape(p.short)}</strong><small>${BRM.escape(p.copy)}</small><b>${counts.get(p.id)||0}</b></button>`).join('');
  target.querySelectorAll('[data-phase-filter]').forEach(b=>b.addEventListener('click',()=>{JOURNAL_STUDENT_STATE.main.querySelector('[data-phase]').value=b.dataset.phaseFilter;renderStudentTimeline();JOURNAL_STUDENT_STATE.main.querySelector('[data-journal-list]').scrollIntoView({behavior:'smooth',block:'start'});}));
}

function renderStudentTimeline(){
  const {main,host,entries,feedback}=JOURNAL_STUDENT_STATE;
  const q=main.querySelector('[data-search]').value.toLowerCase().trim(),status=main.querySelector('[data-status]').value,phase=main.querySelector('[data-phase]').value,focus=main.querySelector('[data-focus]').value;
  const list=entries.filter(e=>{
    const blob=`${e.ActivityTitle||''} ${e.WorkCompleted||''} ${e.Successes||''} ${e.Challenges||''} ${e.EvidenceMoment||''} ${e.NextStep||''} ${e.FocusAreas||''}`.toLowerCase();
    return (!q||blob.includes(q))&&(!status||String(e.Status)===status)&&(!phase||String(e.ProductionPhase)===phase)&&(!focus||journalFocusList(e.FocusAreas).includes(focus));
  });
  host.innerHTML=list.length?`<div class="journal-timeline-list">${list.map(e=>{
    const fb=journalFeedbackForEntry(e,feedback),latest=fb[fb.length-1],submitted=String(e.Status)==='Submitted',p=journalPhaseRecord(e.ProductionPhase),focuses=journalFocusList(e.FocusAreas);
    return `<article class="journal-entry-card ${submitted?'submitted':'draft'} ${journalTrue(e.PortfolioStar)?'portfolio-starred':''}">
      <div class="journal-entry-date"><strong>${formatJournalDate(e.EntryDate)}</strong><span>${BRM.escape(e.ActivityType||'Reflection')}</span><span class="journal-phase-mini">${p.icon} ${BRM.escape(p.short)}</span></div>
      <div class="journal-entry-main">
        <div class="item-meta"><span class="badge">${BRM.escape(e.Status||'')}</span><span class="badge journal-selfcheck">Self-check ${BRM.escape(e.SuccessRating||3)}/5</span>${journalTrue(e.HelpRequested)?'<span class="badge badge-important">Support requested</span>':''}${journalTrue(e.PortfolioStar)?'<span class="badge journal-book-badge">★ Growth Book</span>':''}${e.MinutesWorked?`<span>${BRM.escape(e.MinutesWorked)} min</span>`:''}</div>
        <h3>${BRM.escape(e.ActivityTitle||e.ActivityType||'Learning reflection')}</h3>
        ${focuses.length?`<div class="journal-focus-tags">${focuses.map(f=>`<span>${BRM.escape(f)}</span>`).join('')}</div>`:''}
        <p>${BRM.escape(journalClip(e.EvidenceMoment||e.WorkCompleted||e.Successes||'',280))}</p>
        ${e.NextStep?`<div class="journal-next-mini"><strong>Next move:</strong> ${BRM.escape(journalClip(e.NextStep,180))}</div>`:''}
        ${latest?`<div class="journal-feedback-mini"><span>↔</span><div><strong>${BRM.escape(latest.ReviewerName||'Production Team')} responded</strong><p>${BRM.escape(journalClip(latest.Feedback,190))}</p></div></div>`:''}
        <div class="card-actions"><button class="button button-secondary button-small" data-view-entry="${BRM.escape(e.JournalEntryID)}">Read reflection</button>${String(e.Status)==='Draft'?`<button class="button button-ghost button-small" data-edit-entry="${BRM.escape(e.JournalEntryID)}">Continue draft</button>`:''}${submitted?`<button class="button button-ghost button-small" data-star-entry="${BRM.escape(e.JournalEntryID)}">${journalTrue(e.PortfolioStar)?'★ Remove from Growth Book':'☆ Add to Growth Book'}</button>`:''}</div>
      </div>
    </article>`;
  }).join('')}</div>`:BRM.empty('No reflections found','Adjust the filters or capture a new learning moment.','✎');

  host.querySelectorAll('[data-view-entry]').forEach(b=>b.addEventListener('click',()=>openJournalView(entries.find(e=>sameJournalId(e.JournalEntryID,b.dataset.viewEntry)),feedback)));
  host.querySelectorAll('[data-edit-entry]').forEach(b=>b.addEventListener('click',()=>openJournalForm(entries.find(e=>sameJournalId(e.JournalEntryID,b.dataset.editEntry)),JOURNAL_STUDENT_STATE.load,entries)));
  host.querySelectorAll('[data-star-entry]').forEach(b=>b.addEventListener('click',()=>toggleJournalPortfolioStar(entries.find(e=>sameJournalId(e.JournalEntryID,b.dataset.starEntry)))));
}

function renderNextStep(){
  const entries=JOURNAL_STUDENT_STATE.entries,target=JOURNAL_STUDENT_STATE.main.querySelector('[data-next-step]');
  const latest=submittedEntries(entries).find(e=>String(e.NextStep||'').trim())||entries.find(e=>String(e.NextStep||'').trim());
  if(!latest){target.innerHTML='<span class="eyebrow">Looking ahead</span><h2>Your next move</h2><p style="color:var(--muted);margin:0">After your first reflection, your next step will stay visible here so your journal influences what you actually do next.</p>';return;}
  target.innerHTML=`<span class="eyebrow">Your journal should change the next rehearsal</span><h2>Your next move</h2><blockquote class="journal-next-quote">${BRM.escape(latest.NextStep)}</blockquote><small>From ${formatJournalDate(latest.EntryDate)} · ${BRM.escape(latest.ActivityTitle||latest.ActivityType||'Reflection')}</small><button class="button button-primary button-small button-block" style="margin-top:14px" data-reflect-next>Reflect on how this went</button>`;
  target.querySelector('[data-reflect-next]').addEventListener('click',()=>openJournalForm(null,JOURNAL_STUDENT_STATE.load,JOURNAL_STUDENT_STATE.entries));
}

function renderGrowthThreads(){
  const target=JOURNAL_STUDENT_STATE.main.querySelector('[data-growth-threads]'),counts=focusCounts(JOURNAL_STUDENT_STATE.entries);
  target.innerHTML=`<span class="eyebrow">Patterns across time</span><h2>Your growth threads</h2><p style="color:var(--muted)">These are the areas you keep returning to. Repetition can show what matters, what is difficult, or what is becoming part of your identity.</p>${counts.length?`<div class="journal-thread-list">${counts.slice(0,7).map(([f,n])=>`<button type="button" data-thread-filter="${BRM.escape(f)}"><span>${BRM.escape(f)}</span><strong>${n}</strong></button>`).join('')}</div>`:'<div class="journal-milestone-empty">Growth threads will appear as you choose focus areas in reflections.</div>'}`;
  target.querySelectorAll('[data-thread-filter]').forEach(b=>b.addEventListener('click',()=>{JOURNAL_STUDENT_STATE.main.querySelector('[data-focus]').value=b.dataset.threadFilter;renderStudentTimeline();}));
}

function renderMilestones(){
  const items=journalMilestones(JOURNAL_STUDENT_STATE.entries,JOURNAL_STUDENT_STATE.feedback),target=JOURNAL_STUDENT_STATE.main.querySelector('[data-milestones]');
  target.innerHTML=`<span class="eyebrow">Growth markers</span><h2>Milestones</h2><p style="color:var(--muted)">These are not grades or a leaderboard. They recognize habits that make reflection useful.</p>${items.length?`<div class="journal-milestones">${items.map(([icon,title,copy])=>`<div><span>${icon}</span><div><strong>${BRM.escape(title)}</strong><small>${BRM.escape(copy)}</small></div></div>`).join('')}</div>`:'<div class="journal-milestone-empty">Your first milestone appears after your first submitted reflection.</div>'}`;
}

function renderBookPanel(){
  const submitted=submittedEntries(JOURNAL_STUDENT_STATE.entries),starred=submitted.filter(e=>journalTrue(e.PortfolioStar));
  JOURNAL_STUDENT_STATE.main.querySelector('[data-book-panel]').innerHTML=`<span class="eyebrow">Something to keep</span><h2>Your Growth Book</h2><p style="color:var(--muted)">At the end of the musical, turn this journal into a designed record of where you started, what challenged you, what you learned, teacher feedback, and the moments you chose to remember.</p><div class="journal-book-count"><strong>${starred.length}</strong><span>reflection${starred.length===1?'':'s'} starred for the book</span></div><button class="button button-secondary button-block" data-open-book>📖 Preview Growth Book</button>`;
  JOURNAL_STUDENT_STATE.main.querySelector('[data-open-book]').addEventListener('click',openStudentGrowthBook);
}

function openReflectionGuide(){
  BRM.openModal(`<span class="eyebrow">Reflection is a skill</span><h2>What makes a reflection meaningful?</h2><div class="journal-reflection-guide"><div><strong>1. Be specific</strong><p>Instead of “rehearsal went well,” name the exact scene, note, cue, skill, problem, or interaction.</p></div><div><strong>2. Give evidence</strong><p>Describe a moment that proves something changed: what happened, what you noticed, what someone said, or what you could suddenly do.</p></div><div><strong>3. Explain the learning</strong><p>Go beyond what happened. Why did it happen? What strategy helped? What does the difficulty reveal?</p></div><div><strong>4. Connect people and process</strong><p>A musical is collaborative. Notice how preparation, communication, trust, feedback, and responsibility affect others.</p></div><div><strong>5. Make the next step usable</strong><p>Future-you should know exactly what to try at the next rehearsal or work session.</p></div></div><div class="journal-example-reflection"><span class="eyebrow">Basic → deeper</span><p><strong>Basic:</strong> “I worked on choreography. It was hard but got better.”</p><p><strong>Deeper:</strong> “During the second chorus I kept arriving late to the turn because I was watching other people instead of using the lyric as my cue. When I connected the turn to the word ‘take,’ I hit it three times in a row. Next rehearsal I want to run the chorus once without watching anyone beside me.”</p></div>`,{wide:true});
}

function promptPoolFor(phase,focuses,lens){
  const pool=[...(PHASE_PROMPTS[phase]||PHASE_PROMPTS['Developing Craft'])];
  focuses.forEach(f=>(FOCUS_PROMPTS[f]||[]).forEach(p=>pool.push(p)));
  const lensPrompt=JOURNAL_LENSES.find(x=>x[0]===lens)?.[1];if(lensPrompt)pool.push(lensPrompt);
  return [...new Set(pool)];
}
function choosePrompts(pool,count=3,offset=0){if(!pool.length)return [];const out=[];for(let i=0;i<Math.min(count,pool.length);i++)out.push(pool[(i+offset)%pool.length]);return out;}

function openJournalForm(entry,onSaved,allEntries=[]){
  const departments=BRM.context.departments||[],e=entry||{},entryDate=journalDateKey(e.EntryDate)||todayJournalKey();
  const previous=latestPreviousGoal(allEntries,e.JournalEntryID||''),savedFocus=journalFocusList(e.FocusAreas),savedPhase=e.ProductionPhase||'Starting the Journey',savedLens=e.ReflectionLens||'Self-awareness';
  const rating=Math.min(5,Math.max(1,journalNumber(e.SuccessRating,3))),helpRequested=journalTrue(e.HelpRequested);

  const modal=BRM.openModal(`<div class="journal-compose-head"><span class="eyebrow">Guided learning reflection</span><h2>${entry?'Continue your reflection':'Capture a learning moment'}</h2><p>You are not trying to sound impressive. You are trying to notice something true about your work and make it useful for what comes next.</p></div>
    <div class="journal-stepper" data-stepper>${[1,2,3,4,5].map((n,i)=>`<button type="button" data-step-jump="${n}" ${n===1?'class="active"':''}><span>${n}</span><small>${['Context','Follow through','Look deeper','Grow forward','Review'][i]}</small></button>`).join('')}</div>
    <form data-journal-form>
      <section class="journal-step active" data-step="1"><span class="eyebrow">Step 1 · Context matters</span><h3>Where are you in the journey?</h3><p class="journal-step-intro">The beginning of a show asks different questions than tech week or performance. Choose the phase that best matches today.</p>
        <div class="form-grid">
          <div class="field"><label>Date</label><input type="date" name="entryDate" value="${BRM.escape(entryDate)}" required></div>
          <div class="field"><label>Department or area</label><select name="departmentId"><option value="">General production</option>${departments.map(d=>`<option value="${BRM.escape(d.DepartmentID)}" ${sameJournalId(e.DepartmentID,d.DepartmentID)?'selected':''}>${BRM.escape(d.Name)}</option>`).join('')}</select></div>
          <div class="field"><label>Activity</label><select name="activityType">${['Rehearsal','Build Session','Practice','Design Work','Performance','Meeting','Other'].map(v=>`<option ${String(e.ActivityType||'Rehearsal')===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Time spent <span class="field-hint">minutes</span></label><input type="number" min="0" max="1440" step="1" name="minutesWorked" value="${BRM.escape(e.MinutesWorked||'')}"></div>
          <div class="field span-2"><label>Production phase</label><select name="productionPhase" data-production-phase>${JOURNAL_PHASES.map(p=>`<option value="${BRM.escape(p.id)}" ${savedPhase===p.id?'selected':''}>${p.icon} ${BRM.escape(p.id)}</option>`).join('')}</select><small class="field-hint" data-phase-description></small></div>
          <div class="field span-2"><label>Give this learning moment a title</label><input name="activityTitle" value="${BRM.escape(e.ActivityTitle||'')}" required placeholder="Example: Finding Mal's intention in Scene 3 / Keeping breath through the finale / Learning the castle wagon change"></div>
          <div class="field span-2"><label>What parts of your growth were involved today?</label><div class="journal-focus-picker" data-focus-picker>${JOURNAL_FOCUS_AREAS.map(f=>`<label class="journal-focus-choice"><input type="checkbox" value="${BRM.escape(f)}" ${savedFocus.includes(f)?'checked':''}><span>${BRM.escape(f)}</span></label>`).join('')}</div><small class="field-hint">Choose 1–4 areas. They become growth threads you can follow across the production.</small></div>
        </div>
      </section>

      <section class="journal-step" data-step="2"><span class="eyebrow">Step 2 · Reflection should connect across time</span><h3>${previous?'What happened with your last next step?':'What intention did you bring into today?'}</h3>
        ${previous?`<div class="journal-previous-goal"><span>From ${formatJournalDate(previous.EntryDate)}</span><blockquote>${BRM.escape(previous.NextStep)}</blockquote></div>`:`<div class="journal-previous-goal empty"><p>This is your first recorded goal connection. Think about what you hoped to improve, contribute, understand, or attempt before today began.</p></div>`}
        <div class="field"><label>${previous?'How did that goal go?':'What were you hoping to improve or contribute today?'}</label><textarea name="previousGoalReflection" placeholder="Be specific: Did you try it? What happened? What still needs attention?">${BRM.escape(e.PreviousGoalReflection||'')}</textarea></div>
        <div class="field"><label>What did you actually work on?</label><textarea name="workCompleted" required placeholder="Name the scene, song, cue, design task, build task, rehearsal problem, or responsibility—not just ‘we rehearsed.’">${BRM.escape(e.WorkCompleted||'')}</textarea></div>
      </section>

      <section class="journal-step" data-step="3"><span class="eyebrow">Step 3 · Look deeper</span><h3>Move from “what happened” to “what did I learn?”</h3>
        <div class="field"><label>Choose a reflection lens</label><div class="journal-lens-picker">${JOURNAL_LENSES.map(([name,copy])=>`<label><input type="radio" name="reflectionLens" value="${BRM.escape(name)}" ${savedLens===name?'checked':''}><span><strong>${BRM.escape(name)}</strong><small>${BRM.escape(copy)}</small></span></label>`).join('')}</div></div>
        <div class="journal-prompt-coach"><div><span class="eyebrow">Prompt Coach</span><h4>Need help getting beyond “it was good”?</h4><p>Choose a question that makes you think. You do not have to answer every prompt.</p></div><div data-prompt-options></div><button type="button" class="button button-ghost button-small" data-another-prompts>↻ Give me different prompts</button><input type="hidden" name="reflectionPrompt" value="${BRM.escape(e.ReflectionPrompt||'')}"><div class="journal-selected-prompt" data-selected-prompt></div></div>
        <div class="form-grid">
          <div class="field span-2"><label>Give one concrete moment that shows what happened</label><textarea name="evidenceMoment" required placeholder="A cue you finally caught, a note from the director, a mistake you recovered from, a line that became truthful, a paint technique that worked, a transition that broke down…">${BRM.escape(e.EvidenceMoment||'')}</textarea><small class="field-hint">Evidence makes reflection believable and useful.</small></div>
          <div class="field span-2"><label>What felt successful, stronger, clearer, or more intentional?</label><textarea name="successes" required placeholder="What changed—and what did you do that helped it change?">${BRM.escape(e.Successes||'')}</textarea></div>
          <div class="field span-2"><label>What challenged you, confused you, frustrated you, or taught you something?</label><textarea name="challenges" required placeholder="What is the difficulty showing you about your skill, preparation, mindset, communication, or strategy?">${BRM.escape(e.Challenges||'')}</textarea></div>
        </div>
      </section>

      <section class="journal-step" data-step="4"><span class="eyebrow">Step 4 · Grow forward</span><h3>Turn reflection into action</h3>
        <div class="field"><label>How did the work feel today?</label><p class="field-hint">This is not a grade. A thoughtful 2/5 day can contain more learning than an easy 5/5 day.</p><div class="rating-input journal-rating-input">${[[1,'Rough'],[2,'Challenging'],[3,'Getting there'],[4,'Strong'],[5,'Great']].map(([n,label])=>`<input id="rate-${n}" type="radio" name="successRating" value="${n}" ${rating===n?'checked':''}><label for="rate-${n}"><strong>${n}</strong><small>${label}</small></label>`).join('')}</div></div>
        <div class="field"><label>My next step is…</label><textarea name="nextStep" required placeholder="Make it small enough to do and specific enough to know whether you did it. Example: Before Friday, run the Scene 4 lines twice using cue words instead of reading the script.">${BRM.escape(e.NextStep||'')}</textarea></div>
        <label class="checkbox-row journal-help-toggle"><input type="checkbox" name="helpRequested" ${helpRequested?'checked':''}><span><strong>I would like some support</strong><small>Strong artists and collaborators know when to ask for help.</small></span></label>
        <div class="field" data-help-details ${helpRequested?'':'hidden'}><label>What kind of support would actually help?</label><textarea name="helpDetails" placeholder="A check-in, someone to run lines with, clarification, vocal help, choreography review, design feedback, help planning practice…">${BRM.escape(e.HelpDetails||'')}</textarea></div>
      </section>

      <section class="journal-step" data-step="5"><span class="eyebrow">Step 5 · Read it like future-you</span><h3>Will this reflection still mean something later?</h3><div class="journal-reflection-ingredients" data-reflection-ingredients></div><div class="journal-entry-preview" data-entry-preview></div><div class="journal-book-nudge"><span>★</span><div><strong>Your future Growth Book is built from entries like this.</strong><p>Specific moments, honest challenges, useful next steps, and teacher feedback will become a record of how you changed across the production.</p></div></div></section>

      <div class="journal-save-status" data-save-status aria-live="polite"></div>
      <div class="journal-compose-actions journal-wizard-actions"><button type="button" class="button button-ghost" data-prev-step>← Back</button><button type="button" class="button button-secondary" data-save-draft>Save draft</button><button type="button" class="button button-primary" data-next-step>Next →</button><button type="submit" class="button button-primary" data-submit-reflection hidden>Submit reflection</button></div>
    </form>`,{wide:true});

  const form=modal.querySelector('[data-journal-form]'),steps=[...modal.querySelectorAll('[data-step]')];let currentStep=1,promptOffset=0,saving=false;
  const phaseSelect=form.elements.productionPhase,phaseDescription=modal.querySelector('[data-phase-description]'),helpBox=form.elements.helpRequested,helpDetails=modal.querySelector('[data-help-details]');

  function selectedFocuses(){return [...modal.querySelectorAll('[data-focus-picker] input:checked')].map(x=>x.value);}
  function selectedLens(){return form.querySelector('input[name="reflectionLens"]:checked')?.value||'Self-awareness';}
  function updatePhaseDescription(){phaseDescription.textContent=journalPhaseRecord(phaseSelect.value).copy;}
  function updatePrompts(){
    const pool=promptPoolFor(phaseSelect.value,selectedFocuses(),selectedLens()),prompts=choosePrompts(pool,3,promptOffset),host=modal.querySelector('[data-prompt-options]');
    host.innerHTML=prompts.map(p=>`<button type="button" data-use-prompt="${BRM.escape(p)}">${BRM.escape(p)}</button>`).join('');
    host.querySelectorAll('[data-use-prompt]').forEach(b=>b.addEventListener('click',()=>{form.elements.reflectionPrompt.value=b.dataset.usePrompt;modal.querySelector('[data-selected-prompt]').innerHTML=`<strong>Your chosen thinking prompt:</strong> ${BRM.escape(b.dataset.usePrompt)}`;updatePreview();}));
    const chosen=form.elements.reflectionPrompt.value;if(chosen)modal.querySelector('[data-selected-prompt]').innerHTML=`<strong>Your chosen thinking prompt:</strong> ${BRM.escape(chosen)}`;
  }
  function updateIngredients(){
    const val=name=>String(form.elements[name]?.value||'').trim(),hasPrev=!!previous;
    const items=[
      ['Specific context',val('workCompleted').length>=35,'You named what you actually worked on.'],
      ['Concrete evidence',val('evidenceMoment').length>=35,'You included a moment future-you can picture.'],
      ['Learning, not only events',val('successes').length>=45&&val('challenges').length>=45,'You explained what improved and what the difficulty taught you.'],
      ['Goal connection',!hasPrev||val('previousGoalReflection').length>=25,'You connected today to a previous intention or goal.'],
      ['Usable next move',val('nextStep').length>=30,'Your next step is specific enough to act on.']
    ];
    modal.querySelector('[data-reflection-ingredients]').innerHTML=items.map(([label,ok,copy])=>`<div class="${ok?'ready':''}"><span>${ok?'✓':'○'}</span><div><strong>${label}</strong><small>${copy}</small></div></div>`).join('');
  }
  function updatePreview(){
    const phase=journalPhaseRecord(phaseSelect.value),focuses=selectedFocuses(),val=n=>String(form.elements[n]?.value||'').trim();
    modal.querySelector('[data-entry-preview]').innerHTML=`<div class="item-meta"><span class="badge">${phase.icon} ${BRM.escape(phase.short)}</span>${focuses.map(f=>`<span class="badge">${BRM.escape(f)}</span>`).join('')}</div><h3>${BRM.escape(val('activityTitle')||'Untitled learning moment')}</h3><div class="journal-preview-grid"><div><span>Evidence</span><p>${BRM.escape(val('evidenceMoment')||'Add one specific moment before submitting.')}</p></div><div><span>Learning</span><p>${BRM.escape(journalClip(val('challenges')||val('successes')||'Describe what changed or what the difficulty taught you.',250))}</p></div><div><span>Next move</span><p>${BRM.escape(val('nextStep')||'Choose one specific action for next time.')}</p></div></div>`;
    updateIngredients();
  }
  function showStep(n){currentStep=Math.max(1,Math.min(5,n));steps.forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===currentStep));modal.querySelectorAll('[data-step-jump]').forEach(b=>b.classList.toggle('active',Number(b.dataset.stepJump)===currentStep));modal.querySelector('[data-prev-step]').hidden=currentStep===1;modal.querySelector('[data-next-step]').hidden=currentStep===5;modal.querySelector('[data-submit-reflection]').hidden=currentStep!==5;if(currentStep===3)updatePrompts();if(currentStep===5)updatePreview();modal.querySelector('[data-stepper]').scrollIntoView({block:'nearest'});}
  function stepValid(n){
    if(n===1){if(!form.elements.entryDate.value.trim()){form.elements.entryDate.focus();BRM.toast('Choose the reflection date.','error');return false;}if(!form.elements.activityTitle.value.trim()){form.elements.activityTitle.focus();BRM.toast('Give this learning moment a title.','error');return false;}if(selectedFocuses().length===0){BRM.toast('Choose at least one growth area for today.','error');return false;}return true;}
    if(n===2&&!form.elements.workCompleted.value.trim()){form.elements.workCompleted.focus();BRM.toast('Describe what you worked on before continuing.','error');return false;}
    if(n===3){for(const name of ['evidenceMoment','successes','challenges'])if(!form.elements[name].value.trim()){form.elements[name].focus();BRM.toast('Complete the reflection fields before continuing.','error');return false;}}
    if(n===4&&!form.elements.nextStep.value.trim()){form.elements.nextStep.focus();BRM.toast('Choose a specific next step before continuing.','error');return false;}
    return true;
  }

  updatePhaseDescription();updatePrompts();showStep(1);
  phaseSelect.addEventListener('change',()=>{updatePhaseDescription();promptOffset=0;updatePrompts();});
  modal.querySelectorAll('[data-focus-picker] input').forEach(x=>x.addEventListener('change',()=>{if(selectedFocuses().length>4){x.checked=false;BRM.toast('Choose up to four focus areas so the reflection stays focused.');}promptOffset=0;updatePrompts();}));
  modal.querySelectorAll('input[name="reflectionLens"]').forEach(x=>x.addEventListener('change',()=>{promptOffset=0;updatePrompts();}));
  modal.querySelector('[data-another-prompts]').addEventListener('click',()=>{promptOffset+=3;updatePrompts();});
  helpBox.addEventListener('change',()=>{helpDetails.hidden=!helpBox.checked;if(!helpBox.checked)form.elements.helpDetails.value='';});
  modal.querySelectorAll('[data-step-jump]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.stepJump);if(n>currentStep&&!stepValid(currentStep))return;showStep(n);}));
  modal.querySelector('[data-prev-step]').addEventListener('click',()=>showStep(currentStep-1));
  modal.querySelector('[data-next-step]').addEventListener('click',()=>{if(stepValid(currentStep))showStep(currentStep+1);});
  form.addEventListener('input',()=>{if(currentStep===5)updatePreview();});

  const save=async status=>{
    if(saving)return;
    for(let s=1;s<=4;s++)if(status==='Submitted'&&!stepValid(s)){showStep(s);return;}
    const f=new FormData(form),date=journalDateKey(f.get('entryDate'));if(!date){BRM.toast('Choose a valid reflection date.','error');return;}
    saving=true;const buttons=[...modal.querySelectorAll('button')],saveStatus=modal.querySelector('[data-save-status]');buttons.forEach(b=>b.disabled=true);saveStatus.textContent=status==='Draft'?'Saving draft…':'Submitting reflection…';
    try{
      const result=await BRM.api('saveJournalEntry',{
        journalEntryId:e.JournalEntryID||'',entryDate:date,departmentId:f.get('departmentId'),activityType:f.get('activityType'),activityTitle:f.get('activityTitle'),minutesWorked:f.get('minutesWorked'),workCompleted:f.get('workCompleted'),successes:f.get('successes'),challenges:f.get('challenges'),successRating:f.get('successRating'),nextStep:f.get('nextStep'),helpRequested:f.get('helpRequested')==='on',helpDetails:f.get('helpDetails'),productionPhase:f.get('productionPhase'),focusAreas:selectedFocuses().join('||'),reflectionLens:f.get('reflectionLens'),previousGoalReflection:f.get('previousGoalReflection'),evidenceMoment:f.get('evidenceMoment'),reflectionPrompt:f.get('reflectionPrompt'),portfolioStar:journalTrue(e.PortfolioStar),status
      },{noCache:true});
      if(result?.journalEntryId)e.JournalEntryID=result.journalEntryId;
      BRM.toast(status==='Draft'?'Draft saved — come back when you are ready.':'Reflection submitted — another piece of your journey is captured.');modal.closeModal();await onSaved();
    }catch(error){saveStatus.textContent='Nothing was lost. Your reflection is still open — try saving again.';buttons.forEach(b=>b.disabled=false);saving=false;BRM.toast(error.message||'The reflection could not be saved.','error');}
  };
  form.addEventListener('submit',ev=>{ev.preventDefault();save('Submitted');});
  modal.querySelector('[data-save-draft]').addEventListener('click',()=>save('Draft'));
}

function journalEntryPayload(e,portfolioStar){return {journalEntryId:e.JournalEntryID,entryDate:journalDateKey(e.EntryDate),departmentId:e.DepartmentID||'',activityType:e.ActivityType||'',activityTitle:e.ActivityTitle||'',minutesWorked:e.MinutesWorked||0,workCompleted:e.WorkCompleted||'',successes:e.Successes||'',challenges:e.Challenges||'',successRating:e.SuccessRating||3,nextStep:e.NextStep||'',helpRequested:journalTrue(e.HelpRequested),helpDetails:e.HelpDetails||'',productionPhase:e.ProductionPhase||'',focusAreas:e.FocusAreas||'',reflectionLens:e.ReflectionLens||'',previousGoalReflection:e.PreviousGoalReflection||'',evidenceMoment:e.EvidenceMoment||'',reflectionPrompt:e.ReflectionPrompt||'',portfolioStar,status:e.Status==='Draft'?'Draft':'Submitted'};}
async function toggleJournalPortfolioStar(entry){if(!entry)return;const next=!journalTrue(entry.PortfolioStar);try{await BRM.api('saveJournalEntry',journalEntryPayload(entry,next),{noCache:true});BRM.toast(next?'★ Added to your Growth Book.':'Removed from your Growth Book.');await JOURNAL_STUDENT_STATE.load();}catch(error){BRM.toast(error.message||'Could not update the Growth Book selection.','error');}}

function openJournalView(e,feedback){
  if(!e)return;const fb=journalFeedbackForEntry(e,feedback),p=journalPhaseRecord(e.ProductionPhase),focuses=journalFocusList(e.FocusAreas);
  const modal=BRM.openModal(`<div class="journal-read-head"><div><span class="eyebrow">${formatJournalDate(e.EntryDate)}</span><h2>${BRM.escape(e.ActivityTitle||'Learning reflection')}</h2></div><button type="button" class="button button-secondary button-small" data-view-star>${journalTrue(e.PortfolioStar)?'★ In Growth Book':'☆ Add to Growth Book'}</button></div>
    <div class="item-meta"><span class="badge">${p.icon} ${BRM.escape(p.id)}</span><span class="badge">Self-check ${BRM.escape(e.SuccessRating||3)}/5</span><span>${BRM.escape(e.ActivityType||'')}</span><span>${BRM.escape(e.MinutesWorked||0)} minutes</span></div>${focuses.length?`<div class="journal-focus-tags journal-focus-tags-large">${focuses.map(f=>`<span>${BRM.escape(f)}</span>`).join('')}</div>`:''}
    ${e.PreviousGoalReflection?`<div class="journal-connected-reflection"><span class="eyebrow">Follow-through</span><h3>How the previous goal went</h3><p>${BRM.escape(e.PreviousGoalReflection)}</p></div>`:''}
    ${e.ReflectionPrompt?`<div class="journal-read-prompt"><strong>Question I was thinking about:</strong> ${BRM.escape(e.ReflectionPrompt)}</div>`:''}
    <div class="journal-read-grid">
      <div class="panel-inset"><span class="eyebrow">Work</span><h3>What I worked on</h3><p>${BRM.escape(e.WorkCompleted||'')}</p></div>
      <div class="panel-inset journal-evidence-read"><span class="eyebrow">Evidence</span><h3>A moment that shows it</h3><p>${BRM.escape(e.EvidenceMoment||'')}</p></div>
      <div class="panel-inset"><span class="eyebrow">Growth</span><h3>What improved</h3><p>${BRM.escape(e.Successes||'')}</p></div>
      <div class="panel-inset"><span class="eyebrow">Learning</span><h3>Challenge / discovery</h3><p>${BRM.escape(e.Challenges||'')}</p></div>
      <div class="panel-inset journal-next-read span-2"><span class="eyebrow">Next</span><h3>My next move</h3><p>${BRM.escape(e.NextStep||'')}</p></div>
    </div>
    ${journalTrue(e.HelpRequested)?`<div class="alert alert-info" style="margin-top:18px"><strong>Support I asked for:</strong> ${BRM.escape(e.HelpDetails||'I asked for a check-in.')}</div>`:''}
    ${fb.length?`<section class="journal-feedback-history"><span class="eyebrow">Feedback loop</span><h3>Private responses</h3>${fb.map(f=>`<div class="journal-feedback-full"><div class="item-meta"><span class="badge">${BRM.escape(f.ReviewStatus||'Reviewed')}</span><span>${BRM.escape(f.ReviewerName||'Production Team')}</span>${f.CreatedAt?`<span>${BRM.formatDateTime(f.CreatedAt)}</span>`:''}</div><p>${BRM.escape(f.Feedback||'')}</p></div>`).join('')}</section>`:''}`,{wide:true});
  modal.querySelector('[data-view-star]').addEventListener('click',async()=>{modal.closeModal();await toggleJournalPortfolioStar(e);});
}

function growthBookEntryHtml(e,feedback){
  const p=journalPhaseRecord(e.ProductionPhase),focuses=journalFocusList(e.FocusAreas),fb=journalFeedbackForEntry(e,feedback);
  return `<article class="entry"><div class="entry-meta"><span>${escapeBook(formatJournalDate(e.EntryDate))}</span><span>${escapeBook(p.id)}</span><span>Self-check ${escapeBook(e.SuccessRating||3)}/5</span></div><h3>${escapeBook(e.ActivityTitle||'Learning reflection')}</h3>${focuses.length?`<div class="tags">${focuses.map(f=>`<span>${escapeBook(f)}</span>`).join('')}</div>`:''}${e.PreviousGoalReflection?`<section><h4>Follow-through</h4><p>${escapeBook(e.PreviousGoalReflection)}</p></section>`:''}<section><h4>What I worked on</h4><p>${escapeBook(e.WorkCompleted||'')}</p></section>${e.EvidenceMoment?`<section class="evidence"><h4>A moment that shows it</h4><p>${escapeBook(e.EvidenceMoment)}</p></section>`:''}<div class="two"><section><h4>Growth / success</h4><p>${escapeBook(e.Successes||'')}</p></section><section><h4>Challenge / learning</h4><p>${escapeBook(e.Challenges||'')}</p></section></div><section class="next"><h4>My next move</h4><p>${escapeBook(e.NextStep||'')}</p></section>${fb.length?`<section class="feedback"><h4>Teacher / reviewer feedback</h4>${fb.map(f=>`<p><strong>${escapeBook(f.ReviewerName||'Production Team')} · ${escapeBook(f.ReviewStatus||'Reviewed')}</strong><br>${escapeBook(f.Feedback||'')}</p>`).join('')}</section>`:''}</article>`;
}

function buildGrowthBookHtml(studentName,entries,feedback){
  const submitted=submittedEntries(entries).slice().sort((a,b)=>String(a.EntryDate).localeCompare(String(b.EntryDate))),minutes=submitted.reduce((s,e)=>s+journalNumber(e.MinutesWorked),0),threads=focusCounts(submitted),phases=phaseCounts(submitted),starred=submitted.filter(e=>journalTrue(e.PortfolioStar)),first=submitted[0],latest=submitted[submitted.length-1],closing=[...submitted].reverse().find(e=>e.ProductionPhase==='Closing Reflection');
  const production=BRM.context?.production||{},productionName=production.Title||production.Name||'Bedford Road Musical',schoolYear=production.SchoolYear||'';
  const highlights=(starred.length?starred:[first,submitted[Math.floor((submitted.length-1)/2)],latest].filter(Boolean).filter((e,i,a)=>a.findIndex(x=>sameJournalId(x.JournalEntryID,e.JournalEntryID))===i));
  const portfolioFeedback=feedback.filter(f=>String(f.ReviewStatus)==='Portfolio Highlight');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeBook(studentName)} — Musical Growth Book</title><style>
    :root{--ink:#17171b;--muted:#666873;--accent:#990016;--soft:#f4f0f1;--line:#ddd7d9}*{box-sizing:border-box}body{margin:0;color:var(--ink);font-family:Inter,Arial,sans-serif;background:#ece8e9}.book{width:min(900px,100%);margin:auto;background:#fff}.page{padding:58px 64px;border-bottom:1px solid var(--line);page-break-after:always}.cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(145deg,#fff,#f5edef)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;color:var(--accent);font-size:11px;font-weight:800}.cover h1{font-size:56px;line-height:.98;margin:14px 0}.cover h2{font-weight:400;color:var(--muted)}h2{font-size:30px;margin:8px 0 18px}h3{font-size:22px;margin:8px 0}h4{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:0 0 6px}p{line-height:1.65;white-space:pre-wrap}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.stat{padding:18px;background:var(--soft);border-radius:12px}.stat strong{display:block;font-size:26px}.stat span{color:var(--muted);font-size:12px}.threads,.tags{display:flex;gap:7px;flex-wrap:wrap}.threads span,.tags span{padding:6px 9px;border-radius:999px;background:var(--soft);font-size:11px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:18px}.compare>div,.entry section{padding:15px;border:1px solid var(--line);border-radius:12px}.highlight{border-left:5px solid var(--accent);padding-left:20px;margin:20px 0}.entry{padding:28px 0;border-bottom:2px solid var(--line);page-break-inside:avoid}.entry-meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:11px}.entry .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.entry section{margin-top:12px}.entry .evidence{background:#faf7f8}.entry .next{background:var(--soft);border-color:#d8c5ca}.entry .feedback{border-left:4px solid var(--accent)}.timeline-row{display:grid;grid-template-columns:140px 1fr 42px;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)}.timeline-row small{color:var(--muted)}.controls{position:sticky;top:0;padding:12px 20px;background:#17171b;color:white;display:flex;gap:8px;z-index:10}.controls button{border:0;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer}.quote{font-size:24px;line-height:1.45;color:#343139;border-left:5px solid var(--accent);padding-left:20px}.closing{background:#fbf7f8}@media print{body{background:#fff}.controls{display:none}.book{width:100%}.page{min-height:auto;padding:45px 52px}.cover{min-height:96vh}}@media(max-width:700px){.page{padding:34px 24px}.cover h1{font-size:42px}.stats{grid-template-columns:1fr 1fr}.compare,.entry .two{grid-template-columns:1fr}}
  </style></head><body><div class="controls"><button onclick="window.print()">Print / Save PDF</button><button id="downloadBook">Download HTML copy</button></div><main class="book">
  <section class="page cover"><span class="eyebrow">Bedford Road Musical · Learning Journal</span><h1>My Musical<br>Growth Book</h1><h2>${escapeBook(studentName)}</h2><p>${escapeBook(productionName)} ${schoolYear?`· ${escapeBook(schoolYear)}`:''}</p><p class="quote">A record of process, not perfection: the moments, problems, people, risks, habits, and discoveries that shaped this production.</p></section>
  <section class="page"><span class="eyebrow">Journey at a glance</span><h2>What this process contains</h2><div class="stats"><div class="stat"><strong>${submitted.length}</strong><span>reflections</span></div><div class="stat"><strong>${Math.round(minutes/60*10)/10}</strong><span>hours documented</span></div><div class="stat"><strong>${threads.length}</strong><span>growth threads</span></div><div class="stat"><strong>${[...phases.keys()].filter(x=>x!=='Unspecified phase').length}</strong><span>production phases</span></div></div><h3>Growth threads I returned to</h3><div class="threads">${threads.length?threads.map(([f,n])=>`<span>${escapeBook(f)} · ${n}</span>`).join(''):'<span>Earlier entries did not use growth-area tags.</span>'}</div><h3 style="margin-top:28px">My journey through the show</h3>${JOURNAL_PHASES.filter(p=>phases.get(p.id)).map(p=>`<div class="timeline-row"><strong>${escapeBook(p.short)}</strong><small>${escapeBook(p.copy)}</small><b>${phases.get(p.id)}</b></div>`).join('')}</section>
  ${first&&latest?`<section class="page"><span class="eyebrow">Change across time</span><h2>Where I started → where I arrived</h2><div class="compare"><div><h3>${escapeBook(formatJournalDate(first.EntryDate))}</h3><h4>Early learning</h4><p>${escapeBook(first.Challenges||first.Successes||first.WorkCompleted||'')}</p><h4>Next move then</h4><p>${escapeBook(first.NextStep||'')}</p></div><div><h3>${escapeBook(formatJournalDate(latest.EntryDate))}</h3><h4>Most recent learning</h4><p>${escapeBook(latest.Successes||latest.Challenges||latest.WorkCompleted||'')}</p><h4>Next move now</h4><p>${escapeBook(latest.NextStep||'')}</p></div></div></section>`:''}
  <section class="page"><span class="eyebrow">Chosen moments</span><h2>Reflections worth remembering</h2><p>${starred.length?'These are the reflections I starred for this book.':'No reflections were starred yet, so this section samples moments from across the journey.'}</p>${highlights.map(e=>`<div class="highlight"><strong>${escapeBook(formatJournalDate(e.EntryDate))} · ${escapeBook(e.ActivityTitle||'Reflection')}</strong><p>${escapeBook(e.EvidenceMoment||e.Successes||e.Challenges||e.WorkCompleted||'')}</p></div>`).join('')}</section>
  ${portfolioFeedback.length?`<section class="page"><span class="eyebrow">Words worth keeping</span><h2>Portfolio feedback from my teachers</h2>${portfolioFeedback.map(f=>`<div class="highlight"><p>${escapeBook(f.Feedback||'')}</p><small>${escapeBook(f.ReviewerName||'Production Team')}</small></div>`).join('')}</section>`:''}
  ${closing?`<section class="page closing"><span class="eyebrow">Closing reflection</span><h2>${escapeBook(closing.ActivityTitle||'Looking back')}</h2><p class="quote">${escapeBook(closing.EvidenceMoment||closing.Successes||closing.Challenges||'')}</p>${growthBookEntryHtml(closing,feedback)}</section>`:''}
  <section class="page"><span class="eyebrow">Full journal</span><h2>The learning record</h2>${submitted.map(e=>growthBookEntryHtml(e,feedback)).join('')}</section>
  <section class="page"><span class="eyebrow">End of this chapter</span><h2>The show ends. The learning does not.</h2><p class="quote">This book is evidence that growth happens rehearsal by rehearsal: through repetition, feedback, responsibility, collaboration, risk, mistakes, recovery, and the decision to keep working.</p></section>
  </main><script>document.getElementById('downloadBook').addEventListener('click',()=>{const html='<!doctype html>\\n'+document.documentElement.outerHTML;const blob=new Blob([html],{type:'text/html'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=${JSON.stringify((studentName||'student').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'-musical-growth-book.html')};a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);});<\/script></body></html>`;
}

function openStudentGrowthBook(){
  const submitted=submittedEntries(JOURNAL_STUDENT_STATE.entries);if(!submitted.length){BRM.toast('Submit at least one reflection before creating a Growth Book.');return;}
  const name=BRM.context?.profile?.DisplayName||BRM.context?.user?.DisplayName||'Student',win=window.open('','_blank');if(!win){BRM.toast('Allow pop-ups for this site to open the Growth Book.','error');return;}win.document.open();win.document.write(buildGrowthBookHtml(name,JOURNAL_STUDENT_STATE.entries,JOURNAL_STUDENT_STATE.feedback));win.document.close();
}
