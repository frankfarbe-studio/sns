/**
 * 한줄 댓글 피드 - Frontend Logic (Supabase 연동)
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Supabase client ---
  const cfg = window.SUPABASE_CONFIG || {};
  let sb = null;
  if (window.supabase && cfg.url && !cfg.url.startsWith('PASTE_')) {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  // --- State ---
  let comments = [];
  let likedIds = loadLikedIds(); // 내가 누른 좋아요 (기기별, localStorage)
  let adminSecret = localStorage.getItem('adminSecret') || null; // 관리자 비밀번호 (소유자 기기에만)

  // --- DOM Elements ---
  const themeToggle = document.getElementById('theme-toggle');
  const adminToggle = document.getElementById('admin-toggle');
  const commentCountEl = document.getElementById('comment-count');
  const commentForm = document.getElementById('comment-form');
  const authorInput = document.getElementById('comment-author');
  const contentInput = document.getElementById('comment-content');
  const charCountEl = document.getElementById('char-count');
  const commentList = document.getElementById('comment-list');
  const emptyState = document.getElementById('empty-state');

  // --- Initializer ---
  async function init() {
    loadTheme();
    setupEventListeners();
    updateAdminUI();
    if (!sb) {
      showFatal('Supabase 설정이 필요합니다. supabase-config.js의 url/anonKey를 채워주세요.');
      return;
    }
    await loadComments();
  }

  // --- Theme Management ---
  function loadTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  // --- localStorage: 내 좋아요 기록 ---
  function loadLikedIds() {
    try {
      return JSON.parse(localStorage.getItem('likedIds') || '[]');
    } catch {
      return [];
    }
  }
  function saveLikedIds() {
    localStorage.setItem('likedIds', JSON.stringify(likedIds));
  }

  // --- Helper Functions ---
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAvatarLetter(name) {
    if (!name) return '익';
    return name.trim().charAt(0);
  }

  // created_at(ISO 문자열) → ms
  function toMs(createdAt) {
    return new Date(createdAt).getTime();
  }

  function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (diff < 10000) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 30) return `${days}일 전`;

    const date = new Date(timestamp);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  function showFatal(msg) {
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHTML(msg)}</p>`;
  }

  // --- Data layer (Supabase) ---
  async function loadComments() {
    // 댓글 + 답글을 한 번에 (FK 임베드). 답글은 오래된 순.
    const { data, error } = await sb
      .from('comments')
      .select('*, replies(*)')
      .order('created_at', { ascending: false })
      .order('created_at', { foreignTable: 'replies', ascending: true });

    if (error) {
      showFatal('댓글을 불러오지 못했습니다: ' + error.message);
      return;
    }
    comments = data || [];
    renderComments();
  }

  // --- Render logic ---
  function updateCount() {
    let totalCount = comments.length;
    comments.forEach(comment => {
      if (comment.replies) totalCount += comment.replies.length;
    });
    commentCountEl.textContent = totalCount;
  }

  function renderComments() {
    const existingCards = commentList.querySelectorAll('.comment-card');
    existingCards.forEach(card => card.remove());

    updateCount();

    if (comments.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    comments.forEach(comment => {
      const card = createCommentCardElement(comment);
      commentList.appendChild(card);
    });
  }

  function createCommentCardElement(comment) {
    const card = document.createElement('div');
    card.className = 'comment-card';
    card.dataset.id = comment.id;

    const ts = toMs(comment.created_at);
    const isLiked = likedIds.includes(comment.id);
    const likedClass = isLiked ? 'liked' : '';
    const avatarLetter = escapeHTML(getAvatarLetter(comment.author));

    card.innerHTML = `
      <div class="comment-header">
        <div class="comment-meta">
          <div class="comment-avatar">${avatarLetter}</div>
          <div class="comment-info">
            <span class="comment-author-name">${escapeHTML(comment.author)}</span>
            <span class="comment-time" data-timestamp="${ts}">${timeAgo(ts)}</span>
          </div>
        </div>
      </div>
      <div class="comment-body">${escapeHTML(comment.content)}</div>
      <div class="comment-footer">
        <div class="footer-left">
          <button class="like-btn ${likedClass}" data-action="like" data-id="${comment.id}">
            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            <span class="like-count">${comment.likes || 0}</span>
          </button>
          <button class="reply-toggle-btn" data-action="toggle-reply-box" data-id="${comment.id}">
            <i class="fa-regular fa-comment"></i> 답글
          </button>
        </div>
        ${adminSecret ? `<button class="del-btn" data-action="del-comment" data-id="${comment.id}" title="삭제"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
      <div class="replies-container" id="replies-container-${comment.id}"></div>
    `;

    const repliesContainer = card.querySelector(`#replies-container-${comment.id}`);
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach(reply => {
        repliesContainer.appendChild(createReplyCardElement(reply, comment.id));
      });
    }
    return card;
  }

  function createReplyCardElement(reply, parentId) {
    const replyCard = document.createElement('div');
    replyCard.className = 'reply-card';
    replyCard.dataset.id = reply.id;
    replyCard.dataset.parentId = parentId;

    const ts = toMs(reply.created_at);
    const avatarLetter = escapeHTML(getAvatarLetter(reply.author));

    replyCard.innerHTML = `
      <div class="comment-header">
        <div class="comment-meta">
          <div class="comment-avatar" style="width: 28px; height: 28px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%)">${avatarLetter}</div>
          <div class="comment-info">
            <span class="comment-author-name" style="font-size: 0.85rem;">${escapeHTML(reply.author)}</span>
            <span class="comment-time" data-timestamp="${ts}">${timeAgo(ts)}</span>
          </div>
        </div>
        ${adminSecret ? `<button class="del-btn" data-action="del-reply" data-id="${reply.id}" data-parent-id="${parentId}" title="삭제"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
      <div class="comment-body" style="font-size: 0.88rem; color: var(--text-main);">${escapeHTML(reply.content)}</div>
    `;
    return replyCard;
  }

  // --- Actions ---
  async function handleCommentSubmit(e) {
    e.preventDefault();
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    if (!author || !content) return;

    const submitBtn = commentForm.querySelector('.submit-btn');
    submitBtn.disabled = true;

    const { data, error } = await sb
      .from('comments')
      .insert({ author, content })
      .select('*, replies(*)')
      .single();

    submitBtn.disabled = false;

    if (error) {
      alert('댓글 등록 실패: ' + error.message);
      return;
    }

    comments.unshift(data);
    renderComments();

    authorInput.value = '';
    contentInput.value = '';
    charCountEl.textContent = '0';

    const newCard = commentList.querySelector(`[data-id="${data.id}"]`);
    if (newCard) {
      newCard.classList.add('newly-added');
      setTimeout(() => newCard.classList.remove('newly-added'), 2000);
      newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Likes ---
  async function handleLike(btn, id) {
    const comment = comments.find(c => c.id === id);
    if (!comment) return;

    const likeCountSpan = btn.querySelector('.like-count');
    const heartIcon = btn.querySelector('i');
    const index = likedIds.indexOf(id);
    const liking = index === -1;

    // 낙관적 UI 업데이트
    if (liking) {
      likedIds.push(id);
      comment.likes = (comment.likes || 0) + 1;
      btn.classList.add('liked');
      heartIcon.className = 'fa-solid fa-heart';
    } else {
      likedIds.splice(index, 1);
      comment.likes = Math.max(0, (comment.likes || 1) - 1);
      btn.classList.remove('liked');
      heartIcon.className = 'fa-regular fa-heart';
    }
    likeCountSpan.textContent = comment.likes;
    saveLikedIds();

    const fn = liking ? 'increment_likes' : 'decrement_likes';
    const { data, error } = await sb.rpc(fn, { row_id: id });
    if (error) {
      // 실패 시 서버 값 기준으로 되돌림은 생략하되, 콘솔에 기록
      console.error('like RPC failed:', error.message);
      return;
    }
    if (typeof data === 'number') {
      comment.likes = data;
      likeCountSpan.textContent = data;
    }
  }

  // --- Admin mode (소유자 전용 삭제) ---
  function updateAdminUI() {
    if (!adminToggle) return;
    const on = !!adminSecret;
    adminToggle.classList.toggle('active', on);
    adminToggle.title = on ? '관리자 모드 켜짐 (클릭해서 해제)' : '관리자 모드';
    const icon = adminToggle.querySelector('i');
    if (icon) icon.className = on ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock';
  }

  async function toggleAdmin() {
    if (adminSecret) {
      adminSecret = null;
      localStorage.removeItem('adminSecret');
      updateAdminUI();
      renderComments();
      return;
    }
    const pw = prompt('관리자 비밀번호를 입력하세요');
    if (!pw) return;
    const { data, error } = await sb.rpc('verify_admin', { admin_secret: pw });
    if (error) {
      alert('확인 실패: ' + error.message);
      return;
    }
    if (data === true) {
      adminSecret = pw;
      localStorage.setItem('adminSecret', pw);
      updateAdminUI();
      renderComments();
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  }

  async function handleDeleteComment(id) {
    if (!adminSecret) return;
    if (!confirm('이 댓글을 삭제할까요? (달린 답글도 함께 삭제됩니다)')) return;
    const { data, error } = await sb.rpc('delete_comment', { row_id: id, admin_secret: adminSecret });
    if (error || data !== true) {
      alert('삭제 실패' + (error ? ': ' + error.message : ' (권한 없음)'));
      return;
    }
    comments = comments.filter(c => c.id !== id);
    renderComments();
  }

  async function handleDeleteReply(parentId, replyId) {
    if (!adminSecret) return;
    if (!confirm('이 답글을 삭제할까요?')) return;
    const { data, error } = await sb.rpc('delete_reply', { row_id: replyId, admin_secret: adminSecret });
    if (error || data !== true) {
      alert('삭제 실패' + (error ? ': ' + error.message : ' (권한 없음)'));
      return;
    }
    const parent = comments.find(c => c.id === parentId);
    if (parent && parent.replies) parent.replies = parent.replies.filter(r => r.id !== replyId);
    renderComments();
  }

  // --- Replies ---
  function handleToggleReplyBox(btn, commentId) {
    const container = document.getElementById(`replies-container-${commentId}`);
    if (!container) return;

    const existingForm = container.querySelector('.reply-write-box');
    if (existingForm) {
      existingForm.remove();
      return;
    }

    const replyForm = document.createElement('div');
    replyForm.className = 'reply-write-box';
    replyForm.innerHTML = `
      <div style="margin-bottom: 0.5rem;">
        <input type="text" class="reply-author-input" placeholder="답글 닉네임" required style="width: 100%;" maxlength="15">
      </div>
      <textarea class="reply-content-input" placeholder="답글 내용을 적어주세요..." required maxlength="300"></textarea>
      <div class="reply-write-actions">
        <button class="btn btn-secondary cancel-reply-btn">취소</button>
        <button class="btn btn-primary submit-reply-btn">답글 등록</button>
      </div>
    `;

    const cancelBtn = replyForm.querySelector('.cancel-reply-btn');
    const submitBtn = replyForm.querySelector('.submit-reply-btn');
    const rAuthor = replyForm.querySelector('.reply-author-input');
    const rContent = replyForm.querySelector('.reply-content-input');

    cancelBtn.addEventListener('click', () => replyForm.remove());
    submitBtn.addEventListener('click', async () => {
      const author = rAuthor.value.trim();
      const content = rContent.value.trim();
      if (!author || !content) {
        alert('모든 항목을 입력해주세요.');
        return;
      }
      submitBtn.disabled = true;
      await submitReply(commentId, author, content);
      submitBtn.disabled = false;
      replyForm.remove();
    });

    container.insertBefore(replyForm, container.firstChild);
    rAuthor.focus();
  }

  async function submitReply(parentId, author, content) {
    const parentComment = comments.find(c => c.id === parentId);
    if (!parentComment) return;

    const { data, error } = await sb
      .from('replies')
      .insert({ comment_id: parentId, author, content })
      .select('*')
      .single();

    if (error) {
      alert('답글 등록 실패: ' + error.message);
      return;
    }

    if (!parentComment.replies) parentComment.replies = [];
    parentComment.replies.push(data);
    renderComments();
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    if (adminToggle) adminToggle.addEventListener('click', toggleAdmin);
    commentForm.addEventListener('submit', handleCommentSubmit);

    contentInput.addEventListener('input', () => {
      charCountEl.textContent = contentInput.value.length;
    });

    commentList.addEventListener('click', (e) => {
      const target = e.target;

      const likeBtn = target.closest('.like-btn');
      if (likeBtn && likeBtn.dataset.action === 'like') {
        handleLike(likeBtn, likeBtn.dataset.id);
        return;
      }

      const replyToggleBtn = target.closest('.reply-toggle-btn');
      if (replyToggleBtn && replyToggleBtn.dataset.action === 'toggle-reply-box') {
        handleToggleReplyBox(replyToggleBtn, replyToggleBtn.dataset.id);
        return;
      }

      const delCommentBtn = target.closest('[data-action="del-comment"]');
      if (delCommentBtn) {
        handleDeleteComment(delCommentBtn.dataset.id);
        return;
      }

      const delReplyBtn = target.closest('[data-action="del-reply"]');
      if (delReplyBtn) {
        handleDeleteReply(delReplyBtn.dataset.parentId, delReplyBtn.dataset.id);
        return;
      }
    });

    setInterval(() => {
      document.querySelectorAll('.comment-time').forEach(el => {
        const timestamp = parseInt(el.getAttribute('data-timestamp'));
        if (timestamp) el.textContent = timeAgo(timestamp);
      });
    }, 60000);
  }

  init();
});
