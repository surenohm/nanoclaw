// ===== PARTICLE BACKGROUND =====
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: null, y: null };
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = Math.random() * 1.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > w) this.speedX *= -1;
      if (this.y < 0 || this.y > h) this.speedY *= -1;

      if (mouse.x !== null) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          const force = (120 - dist) / 120;
          this.x += dx * force * 0.01;
          this.y += dy * force * 0.01;
        }
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99, 102, 241, ${this.opacity})`;
      ctx.fill();
    }
  }

  const count = Math.min(80, Math.floor((w * h) / 15000));
  for (let i = 0; i < count; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const opacity = (1 - dist / 150) * 0.08;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animate);
  }
  animate();
})();


// ===== APP STATE =====
let token = sessionStorage.getItem('nc_token');
let refreshTimer = null;

// ===== PAGES =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => {
    if (p.classList.contains('active')) {
      p.classList.add('exit');
      p.classList.remove('active');
    }
  });
  setTimeout(() => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('exit'));
    document.getElementById(id).classList.add('active');
  }, 400);
}


// ===== LOGIN =====
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  if (!password) return;

  loginBtn.classList.add('loading');
  loginError.classList.remove('visible');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (!res.ok) {
      throw new Error('Invalid password');
    }

    const data = await res.json();
    token = data.token;
    sessionStorage.setItem('nc_token', token);

    showPage('dashboard-page');
    setTimeout(loadDashboard, 600);
    refreshTimer = setInterval(loadDashboard, 10000);

  } catch (err) {
    loginError.textContent = err.message || 'Login failed';
    loginError.classList.add('visible');
    document.getElementById('password').focus();
  } finally {
    loginBtn.classList.remove('loading');
  }
});


// ===== LOGOUT =====
document.getElementById('logout-btn').addEventListener('click', () => {
  token = null;
  sessionStorage.removeItem('nc_token');
  if (refreshTimer) clearInterval(refreshTimer);
  showPage('login-page');
});


// ===== DASHBOARD DATA =====
async function loadDashboard() {
  if (!token) return;

  try {
    const res = await fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        token = null;
        sessionStorage.removeItem('nc_token');
        showPage('login-page');
        return;
      }
      throw new Error('Failed to load');
    }

    const data = await res.json();
    renderStats(data);
    renderGroups(data.groupsList);
    renderTasks(data.tasksList);
    renderChats(data.chatsList);

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 600;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(current + (target - current) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function timeAgo(iso) {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderStats(data) {
  animateNumber(document.getElementById('stat-groups'), data.registeredGroups);
  animateNumber(document.getElementById('stat-chats'), data.totalChats);
  animateNumber(document.getElementById('stat-tasks'), data.activeTasks);
  document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
}

function renderGroups(groups) {
  const el = document.getElementById('groups-list');
  document.getElementById('groups-badge').textContent = groups.length;

  if (groups.length === 0) {
    el.innerHTML = '<div class="empty-state">No groups registered yet</div>';
    return;
  }

  el.innerHTML = groups.map((g, i) => `
    <div class="list-item" style="animation-delay: ${i * 0.05}s">
      <div class="item-icon group">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <div class="item-info">
        <div class="item-name">${esc(g.name)}</div>
        <div class="item-detail">${esc(g.folder)} &middot; ${esc(g.trigger)}</div>
      </div>
      <span class="item-badge registered">Active</span>
    </div>
  `).join('');
}

function renderTasks(tasks) {
  const el = document.getElementById('tasks-list');
  document.getElementById('tasks-badge').textContent = tasks.length;

  if (tasks.length === 0) {
    el.innerHTML = '<div class="empty-state">No tasks scheduled</div>';
    return;
  }

  el.innerHTML = tasks.map((t, i) => `
    <div class="list-item" style="animation-delay: ${i * 0.05}s">
      <div class="item-icon task">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>
      </div>
      <div class="item-info">
        <div class="item-name">${esc(t.prompt.slice(0, 60))}</div>
        <div class="item-detail">${t.scheduleType}: ${esc(t.scheduleValue)} &middot; Next: ${timeAgo(t.nextRun)}</div>
      </div>
      <span class="item-badge ${t.status}">${t.status}</span>
    </div>
  `).join('');
}

function renderChats(chats) {
  const el = document.getElementById('chats-list');
  document.getElementById('chats-badge').textContent = chats.length;

  if (chats.length === 0) {
    el.innerHTML = '<div class="empty-state">No activity yet</div>';
    return;
  }

  el.innerHTML = chats.map((c, i) => `
    <div class="list-item" style="animation-delay: ${i * 0.03}s">
      <div class="item-icon chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${
          c.isGroup
            ? '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>'
            : '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>'
        }</svg>
      </div>
      <div class="item-info">
        <div class="item-name">${esc(c.name)}</div>
        <div class="item-detail">${timeAgo(c.lastActivity)}</div>
      </div>
      <span class="item-badge seen">${c.isGroup ? 'Group' : 'Chat'}</span>
    </div>
  `).join('');
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}


// ===== AUTO-LOGIN IF TOKEN EXISTS =====
if (token) {
  showPage('dashboard-page');
  setTimeout(loadDashboard, 100);
  refreshTimer = setInterval(loadDashboard, 10000);
}
