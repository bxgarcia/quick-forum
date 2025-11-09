let token = localStorage.getItem('token') || '';
let currentUser = localStorage.getItem('username') || '';
let currentCategory = null;

const authView = document.getElementById('authView');
const dashView = document.getElementById('dashView');
const loginErr = document.getElementById('loginErr');
const regErr = document.getElementById('regErr');
const whoami = document.getElementById('whoami');
const catList = document.getElementById('catList');
const qList = document.getElementById('qList');
const placeholder = document.getElementById('placeholder');
const askCat = document.getElementById('askCat');
const askText = document.getElementById('askText');

document.getElementById('goRegister').onclick = () => {
  document.getElementById('regCard').classList.remove('hidden');
};
document.getElementById('goLogin').onclick = () => {
  document.getElementById('regCard').classList.add('hidden');
};

document.getElementById('btnLogin').onclick = async () => {
  loginErr.textContent = '';
  const r = await fetch('/api/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      username: document.getElementById('loginUser').value.trim(),
      password: document.getElementById('loginPass').value
    })
  });
  const data = await r.json();
  if (!r.ok) { loginErr.textContent = data.message || 'Login failed'; return; }
  token = data.token; currentUser = data.username;
  localStorage.setItem('token', token);
  localStorage.setItem('username', currentUser);
  showDash();
};

document.getElementById('btnRegister').onclick = async () => {
  regErr.textContent = '';
  const r = await fetch('/api/register', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      username: document.getElementById('regUser').value.trim(),
      password: document.getElementById('regPass').value
    })
  });
  const data = await r.json();
  if (!r.ok) { regErr.textContent = data.message || 'Registration failed'; return; }
  alert('Registered! Please login.');
  document.getElementById('regCard').classList.add('hidden');
};

document.getElementById('logout').onclick = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  token = ''; currentUser = '';
  dashView.classList.add('hidden'); authView.classList.remove('hidden');
};

document.getElementById('btnAsk').onclick = async () => {
  const text = askText.value.trim();
  const categoryId = askCat.value;
  if (!text) return;
  const r = await fetch('/api/questions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer ' + token},
    body: JSON.stringify({ categoryId, text })
  });
  if (r.ok) { askText.value = ''; loadQuestions(categoryId); }
};

async function showDash() {
  authView.classList.add('hidden');
  dashView.classList.remove('hidden');
  whoami.textContent = currentUser;
  await loadCategories();
}

async function loadCategories() {
  catList.innerHTML = '';
  askCat.innerHTML = '';
  const r = await fetch('/api/categories', { headers:{'Authorization':'Bearer ' + token} });
  const cats = await r.json();
  cats.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.name;
    li.onclick = () => { selectCategory(c._id, li); };
    catList.appendChild(li);

    const opt = document.createElement('option');
    opt.value = c._id; opt.textContent = c.name;
    askCat.appendChild(opt);
  });
  placeholder.style.display = 'block';
  qList.innerHTML = '';
}

async function loadQuestions(categoryId) {
  const r = await fetch('/api/questions?categoryId=' + categoryId, { headers:{'Authorization':'Bearer ' + token} });
  const items = await r.json();
  placeholder.style.display = items.length ? 'none' : 'block';
  qList.innerHTML = items.map(q => renderQuestion(q)).join('');
  bindAnswerButtons(items);
}

function renderQuestion(q) {
  return `
  <div class="q">
    <div><strong>${q.text}</strong></div>
    <div class="meta">by ${q.author}  ${new Date(q.createdAt).toLocaleString()}</div>
    ${(q.answers||[]).map(a => `<div class='answer'>${a.text}  <span class="meta">${a.author}, ${new Date(a.createdAt).toLocaleString()}</span></div>`).join('')}
    <div class="answer">
      <input placeholder="Write an answer..." id="ans-${q._id}" />
      <button data-qid="${q._id}" class="btnAnswer">Answer</button>
    </div>
  </div>`;
}

function bindAnswerButtons(items) {
  document.querySelectorAll('.btnAnswer').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-qid');
      const input = document.getElementById('ans-' + id);
      const text = input.value.trim();
      if (!text) return;
      const r = await fetch('/api/answers', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer ' + token},
        body: JSON.stringify({ questionId: id, text })
      });
      if (r.ok) { input.value=''; loadQuestions(currentCategory); }
    }
  });
}

function selectCategory(id, li) {
  currentCategory = id;
  [...catList.children].forEach(n => n.classList.remove('active'));
  li.classList.add('active');
  loadQuestions(id);
}

if (token) { showDash(); }
