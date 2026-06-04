/**
 * 한줄 댓글 피드 - Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- State ---
  let comments = [];
  let likedIds = [];

  // --- DOM Elements ---
  const themeToggle = document.getElementById('theme-toggle');
  const commentCountEl = document.getElementById('comment-count');
  const commentForm = document.getElementById('comment-form');
  const authorInput = document.getElementById('comment-author');
  const contentInput = document.getElementById('comment-content');
  const charCountEl = document.getElementById('char-count');
  const commentList = document.getElementById('comment-list');
  const emptyState = document.getElementById('empty-state');

  // --- Initializer ---
  function init() {
    loadTheme();
    renderComments();
    setupEventListeners();
  }

  // --- Theme Management ---
  function loadTheme() {
    // Default to system preference or dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
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

  // --- Render logic ---
  function updateCount() {
    let totalCount = comments.length;
    comments.forEach(comment => {
      if (comment.replies) {
        totalCount += comment.replies.length;
      }
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

    const isLiked = likedIds.includes(comment.id);
    const likedClass = isLiked ? 'liked' : '';
    const avatarLetter = escapeHTML(getAvatarLetter(comment.author));

    card.innerHTML = `
      <div class="comment-header">
        <div class="comment-meta">
          <div class="comment-avatar">${avatarLetter}</div>
          <div class="comment-info">
            <span class="comment-author-name">${escapeHTML(comment.author)}</span>
            <span class="comment-time" data-timestamp="${comment.timestamp}">${timeAgo(comment.timestamp)}</span>
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
      </div>
      <!-- Replies Section Container -->
      <div class="replies-container" id="replies-container-${comment.id}"></div>
    `;

    // Render existing replies
    const repliesContainer = card.querySelector(`#replies-container-${comment.id}`);
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach(reply => {
        const replyEl = createReplyCardElement(reply, comment.id);
        repliesContainer.appendChild(replyEl);
      });
    }

    return card;
  }

  function createReplyCardElement(reply, parentId) {
    const replyCard = document.createElement('div');
    replyCard.className = 'reply-card';
    replyCard.dataset.id = reply.id;
    replyCard.dataset.parentId = parentId;

    const avatarLetter = escapeHTML(getAvatarLetter(reply.author));

    replyCard.innerHTML = `
      <div class="comment-header">
        <div class="comment-meta">
          <div class="comment-avatar" style="width: 28px; height: 28px; font-size: 0.8rem; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%)">${avatarLetter}</div>
          <div class="comment-info">
            <span class="comment-author-name" style="font-size: 0.85rem;">${escapeHTML(reply.author)}</span>
            <span class="comment-time" data-timestamp="${reply.timestamp}">${timeAgo(reply.timestamp)}</span>
          </div>
        </div>
      </div>
      <div class="comment-body" style="font-size: 0.88rem; color: var(--text-main);">${escapeHTML(reply.content)}</div>
    `;

    return replyCard;
  }

  // --- DOM Manipulation Actions ---
  function handleCommentSubmit(e) {
    e.preventDefault();
    const author = authorInput.value.trim();
    const content = contentInput.value.trim();

    if (!author || !content) return;

    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      author: author,
      content: content,
      timestamp: Date.now(),
      likes: 0,
      replies: []
    };

    comments.unshift(newComment);
    renderComments();

    // Reset inputs
    authorInput.value = '';
    contentInput.value = '';
    charCountEl.textContent = '0';

    // Highlight newly added comment
    const newCard = commentList.querySelector(`[data-id="${newComment.id}"]`);
    if (newCard) {
      newCard.classList.add('newly-added');
      setTimeout(() => {
        newCard.classList.remove('newly-added');
      }, 2000);
      newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // --- Likes Flow ---
  function handleLike(btn, id) {
    const comment = comments.find(c => c.id === id);
    if (!comment) return;

    const likeCountSpan = btn.querySelector('.like-count');
    const heartIcon = btn.querySelector('i');
    
    const index = likedIds.indexOf(id);
    if (index === -1) {
      // Like it
      likedIds.push(id);
      comment.likes = (comment.likes || 0) + 1;
      btn.classList.add('liked');
      heartIcon.className = 'fa-solid fa-heart';
    } else {
      // Unlike it
      likedIds.splice(index, 1);
      comment.likes = Math.max(0, (comment.likes || 1) - 1);
      btn.classList.remove('liked');
      heartIcon.className = 'fa-regular fa-heart';
    }

    likeCountSpan.textContent = comment.likes;
  }

  // --- Replies Flow ---
  function handleToggleReplyBox(btn, commentId) {
    const container = document.getElementById(`replies-container-${commentId}`);
    if (!container) return;

    // Check if reply form is already open
    const existingForm = container.querySelector('.reply-write-box');
    if (existingForm) {
      existingForm.remove();
      return;
    }

    // Create Reply Form
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

    // Event handlers inside form
    const cancelBtn = replyForm.querySelector('.cancel-reply-btn');
    const submitBtn = replyForm.querySelector('.submit-reply-btn');
    const rAuthor = replyForm.querySelector('.reply-author-input');
    const rContent = replyForm.querySelector('.reply-content-input');

    cancelBtn.addEventListener('click', () => replyForm.remove());
    submitBtn.addEventListener('click', () => {
      const author = rAuthor.value.trim();
      const content = rContent.value.trim();

      if (!author || !content) {
        alert('모든 항목을 입력해주세요.');
        return;
      }

      submitReply(commentId, author, content);
      replyForm.remove();
    });

    container.insertBefore(replyForm, container.firstChild);
    rAuthor.focus();
  }

  function submitReply(parentId, author, content) {
    const parentComment = comments.find(c => c.id === parentId);
    if (!parentComment) return;

    const newReply = {
      id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      author: author,
      content: content,
      timestamp: Date.now()
    };

    if (!parentComment.replies) parentComment.replies = [];
    parentComment.replies.push(newReply);
    renderComments();
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Comment submission
    commentForm.addEventListener('submit', handleCommentSubmit);

    // Character counter
    contentInput.addEventListener('input', () => {
      charCountEl.textContent = contentInput.value.length;
    });

    // Event delegation on comment list
    commentList.addEventListener('click', (e) => {
      const target = e.target;

      // Liking a comment
      const likeBtn = target.closest('.like-btn');
      if (likeBtn && likeBtn.dataset.action === 'like') {
        const id = likeBtn.dataset.id;
        handleLike(likeBtn, id);
        return;
      }

      // Replying trigger
      const replyToggleBtn = target.closest('.reply-toggle-btn');
      if (replyToggleBtn && replyToggleBtn.dataset.action === 'toggle-reply-box') {
        const id = replyToggleBtn.dataset.id;
        handleToggleReplyBox(replyToggleBtn, id);
        return;
      }
    });

    // Update times every minute dynamically
    setInterval(() => {
      const timeElements = document.querySelectorAll('.comment-time');
      timeElements.forEach(el => {
        const timestamp = parseInt(el.getAttribute('data-timestamp'));
        if (timestamp) {
          el.textContent = timeAgo(timestamp);
        }
      });
    }, 60000);
  }

  // Run initial loading
  init();
});
