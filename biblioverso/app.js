const adminPassword = "thierry123@";
const sessionKey = "biblioverso-session";
const libraryKey = "biblioverso-library";

const state = {
  session: loadSession(),
  reviews: [],
  clubs: [],
  userBooks: [],
  library: loadLibrary(),
  authMode: "login",
  profilePanel: "reviews",
};

const defaultView = "feed";
let activeView = defaultView;

const challenges = [
  {
    id: "month-3",
    title: "3 livros no mês",
    text: "Leia três livros e publique pelo menos um depoimento sobre cada um.",
    tag: "Meta mensal",
  },
  {
    id: "classic",
    title: "Um clássico brasileiro",
    text: "Escolha um clássico nacional e conte no feed o que ele te fez pensar.",
    tag: "Clássicos",
  },
  {
    id: "new-author",
    title: "Autor novo",
    text: "Leia alguém que você nunca leu antes e registre sua primeira impressão.",
    tag: "Descoberta",
  },
];

const views = {
  feed: document.querySelector("#feed-view"),
  "new-review": document.querySelector("#new-review-view"),
  profile: document.querySelector("#profile-view"),
  ranking: document.querySelector("#ranking-view"),
  want: document.querySelector("#want-view"),
  challenges: document.querySelector("#challenges-view"),
  recommendations: document.querySelector("#recommendations-view"),
  clubs: document.querySelector("#clubs-view"),
  admin: document.querySelector("#admin-view"),
};

const pageTitle = document.querySelector("#page-title");
const reviewsGrid = document.querySelector("#reviews-grid");
const reviewTemplate = document.querySelector("#review-template");
const searchInput = document.querySelector("#search");
const reviewForm = document.querySelector("#review-form");
const wantForm = document.querySelector("#want-form");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const toggleAuthModeButton = document.querySelector("#toggle-auth-mode");
const logoutButton = document.querySelector("#logout-button");
const sidebarLogoutButton = document.querySelector("#sidebar-logout-button");
const sessionStatus = document.querySelector("#session-status");
const sidebarSessionStatus = document.querySelector("#sidebar-session-status");
const adminNavItem = document.querySelector(".admin-nav-item");
const profileHeading = document.querySelector("#profile-heading");
const profileSummary = document.querySelector("#profile-summary");
const profileAvatar = document.querySelector("#profile-avatar");
const profileList = document.querySelector("#profile-list");
const profileBioForm = document.querySelector("#profile-bio-form");
const profileBioPreview = document.querySelector("#profile-bio-preview");
const authorBookForm = document.querySelector("#author-book-form");
const authorBooksList = document.querySelector("#author-books-list");
const clubForm = document.querySelector("#club-form");
const adminLocked = document.querySelector("#admin-locked");
const adminPanel = document.querySelector("#admin-panel");
const adminList = document.querySelector("#admin-list");
const authTitle = document.querySelector("#login-title");
const authCopy = document.querySelector(".auth-copy");
const authCopyText = document.createElement("p");

loginForm.querySelector("label").childNodes[0].nodeValue = "Email ou numero de telefone";
registerForm.querySelector("label").childNodes[0].nodeValue = "Email ou numero de telefone";
loginForm.elements.identifier.placeholder = "voce@email.com ou (11) 99999-9999";
registerForm.elements.identifier.placeholder = "voce@email.com ou (11) 99999-9999";
loginForm.elements.identifier.inputMode = "email";
registerForm.elements.identifier.inputMode = "email";
authTitle.textContent = "Entre no Biblioverso";
authCopyText.textContent = "Entre com email ou telefone para acessar seu feed de leituras.";
authCopy.append(authCopyText);

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-profile-panel]").forEach((button) => {
  button.addEventListener("click", () => {
    state.profilePanel = button.dataset.profilePanel;
    renderProfile();
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  button.classList.remove("clicked");
  window.requestAnimationFrame(() => button.classList.add("clicked"));
});

toggleAuthModeButton.addEventListener("click", () => {
  state.authMode = state.authMode === "login" ? "register" : "login";
  render();
});

logoutButton.addEventListener("click", () => {
  logout();
});

sidebarLogoutButton.addEventListener("click", logout);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const response = await postJson("/api/auth/login", {
    identifier: form.get("identifier").trim(),
    password: form.get("password"),
  });

  if (!response.ok) return showFormError(response.data.error);
  state.session = response.data.user;
  saveSession();
  loginForm.reset();
  await loadUserExtras();
  showView(defaultView);
  render();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(registerForm);
  const identifier = form.get("identifier").trim();
  const response = await postJson("/api/auth/register", {
    name: displayNameFromIdentifier(identifier),
    identifier,
    password: form.get("password"),
  });

  if (!response.ok) return showFormError(response.data.error);
  state.session = response.data.user;
  saveSession();
  registerForm.reset();
  state.authMode = "login";
  await loadUserExtras();
  showView(defaultView);
  render();
});

searchInput.addEventListener("input", renderFeed);

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(reviewForm);
  const reviewer = state.session?.name || "Visitante";
  const response = await postJson("/api/reviews", {
    title: form.get("title").trim(),
    author: form.get("author").trim(),
    category: form.get("category"),
    rating: Number(form.get("rating")),
    text: form.get("text").trim(),
    reviewer,
  });

  if (!response.ok) return alert(response.data.error || "Não foi possível salvar o depoimento.");
  reviewForm.reset();
  reviewForm.elements.rating.value = 5;
  await fetchReviews();
  showView("feed");
  render();
});

wantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(wantForm);
  addWantBook({
    title: form.get("title").trim(),
    author: form.get("author").trim(),
  });
  wantForm.reset();
  renderWantList();
});

profileBioForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isRealUser()) return alert("Entre com uma conta de leitor para editar o perfil.");
  const form = new FormData(profileBioForm);
  const response = await requestJson(`/api/users/${state.session.id}/profile`, {
    method: "PATCH",
    body: {
      bio: form.get("bio"),
      socialLinks: form.get("socialLinks"),
    },
  });

  if (!response.ok) return alert(response.data.error || "Não foi possível salvar o perfil.");
  state.session = response.data.user;
  saveSession();
  renderProfile();
});

authorBookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isRealUser()) return alert("Entre com uma conta de leitor para publicar seu livro.");
  const form = new FormData(authorBookForm);
  const response = await postJson(`/api/users/${state.session.id}/books`, {
    title: form.get("title").trim(),
    genre: form.get("genre").trim(),
    description: form.get("description").trim(),
    link: form.get("link").trim(),
  });

  if (!response.ok) return alert(response.data.error || "Não foi possível publicar o livro.");
  authorBookForm.reset();
  await fetchUserBooks();
  renderProfile();
});

clubForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(clubForm);
  const response = await requestJson("/api/clubs", {
    method: "POST",
    headers: getAdminHeaders(),
    body: {
      title: form.get("title").trim(),
      theme: form.get("theme").trim(),
      description: form.get("description").trim(),
    },
  });

  if (!response.ok) return alert(response.data.error || "Não foi possível criar o clube.");
  clubForm.reset();
  await fetchClubs();
  renderClubs();
});

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey)) || null;
  } catch {
    return null;
  }
}

function saveSession() {
  if (!state.session) {
    localStorage.removeItem(sessionKey);
    return;
  }
  localStorage.setItem(sessionKey, JSON.stringify(state.session));
}

function loadLibrary() {
  const fallback = { want: [], likedReviews: [], joinedChallenges: [], joinedClubs: [] };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(libraryKey)) };
  } catch {
    return fallback;
  }
}

function saveLibrary() {
  localStorage.setItem(libraryKey, JSON.stringify(state.library));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function postJson(url, body) {
  return requestJson(url, { method: "POST", body });
}

async function fetchReviews() {
  const response = await requestJson("/api/reviews");
  state.reviews = response.data.reviews || [];
}

async function fetchClubs() {
  const response = await requestJson("/api/clubs");
  state.clubs = response.data.clubs || [];
}

async function fetchUserBooks() {
  if (!isRealUser()) {
    state.userBooks = [];
    return;
  }
  const response = await requestJson(`/api/users/${state.session.id}/books`);
  state.userBooks = response.data.books || [];
}

async function loadUserExtras() {
  await fetchUserBooks();
}

function showView(viewName) {
  if (!state.session) {
    activeView = defaultView;
    return;
  }

  if (viewName === "admin" && !isAdmin()) {
    viewName = defaultView;
  }

  activeView = viewName;
  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("is-visible", name === viewName);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  const titles = {
    feed: "Descubra o que os leitores sentiram",
    "new-review": "Conte sua experiência com um livro",
    profile: "Sua estante pessoal",
    ranking: "Livros que estão movimentando a comunidade",
    want: "Sua lista de próximas leituras",
    challenges: "Metas para ler com mais vontade",
    recommendations: "Sugestões com a sua cara",
    clubs: "Leituras coletivas dentro do app",
    admin: "Gerencie a comunidade",
  };
  pageTitle.textContent = titles[viewName];
}

function render() {
  renderAccessState();
  renderAuthForms();
  syncSessionUi();
  renderFeed();
  renderProfile();
  renderRanking();
  renderWantList();
  renderChallenges();
  renderRecommendations();
  renderClubs();
  renderAdmin();
  showView(activeView);
}

function syncSessionUi() {
  adminNavItem.hidden = !isAdmin();
  sidebarLogoutButton.hidden = !state.session;

  if (!state.session) {
    sessionStatus.textContent = "Voce precisa entrar para acessar o Biblioverso.";
    sidebarSessionStatus.textContent = "";
    return;
  }

  const roleText = isAdmin() ? "administrador" : "leitor";
  const handle = state.session.username ? ` @${state.session.username}` : "";
  sidebarSessionStatus.textContent = `${state.session.name}${handle}`;
  sessionStatus.textContent = `${state.session.name}${handle} entrou como ${roleText}.`;
}

function renderAccessState() {
  const logged = Boolean(state.session);
  document.body.classList.toggle("auth-locked", !logged);
  document.body.classList.toggle("auth-ready", logged);

  toggleAuthModeButton.textContent = state.authMode === "login" ? "Fazer cadastro" : "Voltar ao login";

  if (!logged) {
    activeView = defaultView;
    Object.values(views).forEach((view) => view.classList.remove("is-visible"));
    return;
  }

  if (activeView === "admin" && !isAdmin()) {
    activeView = defaultView;
  }
}

function renderAuthForms() {
  const logged = Boolean(state.session);
  const adminUser = isAdmin();
  loginForm.hidden = logged || state.authMode !== "login";
  registerForm.hidden = logged || state.authMode !== "register";
  toggleAuthModeButton.hidden = logged;
  logoutButton.hidden = !logged;
  sidebarLogoutButton.hidden = !logged;
  adminNavItem.hidden = !adminUser;
  toggleAuthModeButton.textContent = state.authMode === "login" ? "Fazer cadastro" : "Voltar ao login";
  authTitle.textContent = state.authMode === "login" ? "Entre no Biblioverso" : "Crie sua conta";
  authCopyText.textContent =
    state.authMode === "login"
      ? "Acesse seu feed de feedbacks literarios e descubra novas leituras pela voz da comunidade."
      : "Cadastre seu email ou numero, crie uma senha e entre direto no seu feed.";
  toggleAuthModeButton.textContent = state.authMode === "login" ? "Criar conta" : "Já tenho conta";

  if (!logged) {
    sessionStatus.textContent = "Você está como visitante.";
    return;
  }

  const roleText = state.session.role === "admin" ? "administrador" : "leitor";
  const handle = state.session.username ? ` @${state.session.username}` : "";
  sessionStatus.textContent = `${state.session.name}${handle} entrou como ${roleText}.`;
}

function showFormError(message) {
  sessionStatus.textContent = message || "Não foi possível concluir a ação.";
}

function renderFeed() {
  const query = searchInput.value.trim().toLowerCase();
  const reviews = state.reviews.filter((review) => {
    const text = `${review.title} ${review.author} ${review.reviewer}`.toLowerCase();
    return text.includes(query);
  });

  reviewsGrid.innerHTML = "";

  if (!reviews.length) {
    reviewsGrid.innerHTML = '<div class="empty-state">Nenhum depoimento encontrado.</div>';
    return;
  }

  reviews.forEach((review, index) => {
    const card = reviewTemplate.content.firstElementChild.cloneNode(true);
    card.style.animationDelay = `${Math.min(index, 8) * 55}ms`;
    card.querySelector(".book-cover").style.backgroundColor = coverColor(index);
    card.querySelector(".category").textContent = review.category;
    card.querySelector(".rating").textContent = "★".repeat(review.rating);
    card.querySelector("h3").textContent = review.title;
    card.querySelector(".author").textContent = review.author;
    card.querySelector(".quote").textContent = review.text;
    card.querySelector(".reviewer").textContent = `por ${review.reviewer}`;

    const likeButton = card.querySelector(".like-button");
    likeButton.textContent = `Curtir (${review.likes})`;
    likeButton.addEventListener("click", async () => {
      rememberLikedReview(review.id);
      await fetch(`/api/reviews/${review.id}/like`, { method: "POST" });
      await fetchReviews();
      render();
    });

    const wantButton = document.createElement("button");
    wantButton.className = "ghost-button";
    wantButton.type = "button";
    wantButton.textContent = isWanted(review.title) ? "Na lista" : "Quero ler";
    wantButton.addEventListener("click", () => {
      addWantBook({ title: review.title, author: review.author });
      render();
    });
    card.querySelector(".review-footer").append(wantButton);

    reviewsGrid.append(card);
  });
}

function renderProfile() {
  const name = state.session?.name || "Visitante";
  const mine = state.reviews.filter((review) => review.reviewer === name);
  const uniqueBooks = new Set(mine.map((review) => review.title.toLowerCase()));
  const average = mine.length
    ? mine.reduce((sum, review) => sum + review.rating, 0) / mine.length
    : 0;

  profileHeading.textContent = name;
  profileAvatar.textContent = name.charAt(0).toUpperCase();
  profileSummary.textContent = state.session
    ? "Seu perfil reúne seu feed, biografia, links e livros autorais."
    : "Entre com sua conta para criar sua estante.";
  document.querySelector("#stat-reviews").textContent = mine.length;
  document.querySelector("#stat-books").textContent = uniqueBooks.size;
  document.querySelector("#stat-average").textContent = average.toFixed(1);

  document.querySelectorAll("[data-profile-panel]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.profilePanel === state.profilePanel);
  });

  profileList.hidden = state.profilePanel !== "reviews";
  profileBioForm.hidden = state.profilePanel !== "bio" || !isRealUser();
  profileBioPreview.hidden = state.profilePanel !== "bio";
  authorBookForm.hidden = state.profilePanel !== "books" || !isRealUser();
  authorBooksList.hidden = state.profilePanel !== "books";

  renderProfileReviews(mine);
  renderProfileBio();
  renderAuthorBooks();
}

function renderProfileReviews(mine) {
  profileList.innerHTML = "";
  if (!mine.length) {
    profileList.innerHTML = '<div class="empty-state">Você ainda não publicou depoimentos.</div>';
    return;
  }
  mine.forEach((review) => profileList.append(createListRow(review)));
}

function renderProfileBio() {
  const bio = state.session?.bio || "";
  const socialLinks = state.session?.socialLinks || "";
  profileBioForm.elements.bio.value = bio;
  profileBioForm.elements.socialLinks.value = socialLinks;

  const bioHtml = formatMultilineText(bio) || "Nenhuma biografia cadastrada.";
  const linksHtml = formatMultilineText(socialLinks) || "Nenhum link social cadastrado.";
  profileBioPreview.innerHTML = `
    <article class="bio-card">
      <h3>Biografia</h3>
      <p>${bioHtml}</p>
      <h3>Links e redes</h3>
      <p>${linksHtml}</p>
    </article>
  `;
}

function renderAuthorBooks() {
  authorBooksList.innerHTML = "";
  if (!isRealUser()) {
    authorBooksList.innerHTML = '<div class="empty-state">Entre com uma conta de leitor para publicar livros de sua autoria.</div>';
    return;
  }
  if (!state.userBooks.length) {
    authorBooksList.innerHTML = '<div class="empty-state">Você ainda não publicou livros autorais no perfil.</div>';
    return;
  }

  state.userBooks.forEach((book) => {
    const row = document.createElement("article");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <h3></h3>
        <p></p>
      </div>
    `;
    row.querySelector("h3").textContent = book.title;
    row.querySelector("p").textContent = `${book.genre} · ${book.description}`;
    if (book.link) {
      const link = document.createElement("a");
      link.className = "ghost-button inline-link-button";
      link.href = book.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Abrir";
      row.append(link);
    }
    authorBooksList.append(row);
  });
}

function renderRanking() {
  const rankingList = document.querySelector("#ranking-list");
  const grouped = new Map();

  state.reviews.forEach((review) => {
    const key = review.title.toLowerCase();
    const current = grouped.get(key) || {
      title: review.title,
      author: review.author,
      count: 0,
      likes: 0,
      rating: 0,
    };
    current.count += 1;
    current.likes += review.likes;
    current.rating += review.rating;
    grouped.set(key, current);
  });

  const ranking = [...grouped.values()].sort((a, b) => b.count - a.count || b.likes - a.likes);
  rankingList.innerHTML = "";

  if (!ranking.length) {
    rankingList.innerHTML = '<div class="empty-state">Ainda não há livros no ranking.</div>';
    return;
  }

  ranking.forEach((book, index) => {
    const row = document.createElement("article");
    row.className = "ranking-row";
    row.innerHTML = `
      <strong>${index + 1}</strong>
      <div>
        <h3></h3>
        <p></p>
      </div>
      <span></span>
    `;
    row.querySelector("h3").textContent = book.title;
    row.querySelector("p").textContent = `${book.author} · ${book.likes} curtidas`;
    row.querySelector("span").textContent = `${book.count} comentários`;
    rankingList.append(row);
  });
}

function renderWantList() {
  const wantList = document.querySelector("#want-list");
  wantList.innerHTML = "";

  if (!state.library.want.length) {
    wantList.innerHTML = '<div class="empty-state">Sua lista ainda está vazia.</div>';
    return;
  }

  state.library.want.forEach((book) => {
    const row = document.createElement("article");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <h3></h3>
        <p></p>
      </div>
      <button class="ghost-button" type="button">Remover</button>
    `;
    row.querySelector("h3").textContent = book.title;
    row.querySelector("p").textContent = book.author;
    row.querySelector("button").addEventListener("click", () => {
      state.library.want = state.library.want.filter((item) => item.id !== book.id);
      saveLibrary();
      renderWantList();
    });
    wantList.append(row);
  });
}

function renderChallenges() {
  const list = document.querySelector("#challenges-list");
  list.innerHTML = "";

  challenges.forEach((challenge) => {
    const joined = state.library.joinedChallenges.includes(challenge.id);
    const card = createFeatureCard(challenge.title, challenge.text, challenge.tag);
    const button = document.createElement("button");
    button.className = joined ? "primary-button" : "ghost-button";
    button.type = "button";
    button.textContent = joined ? "Participando" : "Entrar no desafio";
    button.addEventListener("click", () => toggleListItem("joinedChallenges", challenge.id));
    card.append(button);
    list.append(card);
  });
}

function renderRecommendations() {
  const list = document.querySelector("#recommendations-list");
  const liked = state.reviews.filter((review) => state.library.likedReviews.includes(review.id));
  const categories = new Set(liked.map((review) => review.category));
  const candidates = state.reviews.filter((review) => {
    if (!categories.size) return review.rating >= 4;
    return categories.has(review.category) && !state.library.likedReviews.includes(review.id);
  });

  const unique = [];
  const seen = new Set();
  candidates.forEach((review) => {
    const key = review.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(review);
  });

  list.innerHTML = "";
  unique.slice(0, 6).forEach((review) => {
    const card = createFeatureCard(
      review.title,
      `${review.author} · ${review.category} · ${review.rating}/5`,
      categories.size ? "Parecido com seus likes" : "Bem avaliado"
    );
    const button = document.createElement("button");
    button.className = "ghost-button";
    button.type = "button";
    button.textContent = isWanted(review.title) ? "Na lista" : "Quero ler";
    button.addEventListener("click", () => {
      addWantBook({ title: review.title, author: review.author });
      renderRecommendations();
      renderWantList();
    });
    card.append(button);
    list.append(card);
  });

  if (!list.children.length) {
    list.innerHTML = '<div class="empty-state">Curta alguns depoimentos para melhorar suas recomendações.</div>';
  }
}

function renderClubs() {
  const list = document.querySelector("#clubs-list");
  list.innerHTML = "";
  clubForm.hidden = !isAdmin();

  if (!state.clubs.length) {
    list.innerHTML = '<div class="empty-state">Ainda não há clubes cadastrados.</div>';
    return;
  }

  state.clubs.forEach((club) => {
    const joined = state.library.joinedClubs.includes(club.id);
    const card = createFeatureCard(club.title, club.description, `${club.theme} · ${club.members} membros`);
    const joinButton = document.createElement("button");
    joinButton.className = joined ? "primary-button" : "ghost-button";
    joinButton.type = "button";
    joinButton.textContent = joined ? "Sair do clube" : "Entrar no clube";
    joinButton.addEventListener("click", () => toggleClubMembership(club.id, joined));
    card.append(joinButton);

    if (isAdmin()) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "ghost-button danger-button";
      deleteButton.type = "button";
      deleteButton.textContent = "Excluir clube";
      deleteButton.addEventListener("click", () => deleteClub(club.id));
      card.append(deleteButton);
    }

    list.append(card);
  });
}

function renderAdmin() {
  const isAdminUser = isAdmin();
  adminNavItem.hidden = !isAdminUser;
  adminLocked.hidden = isAdminUser;
  adminPanel.hidden = !isAdminUser;

  if (!isAdminUser) return;

  document.querySelector("#admin-total-reviews").textContent = state.reviews.length;
  document.querySelector("#admin-total-users").textContent = new Set(
    state.reviews.map((review) => review.reviewer)
  ).size;
  document.querySelector("#admin-total-books").textContent = new Set(
    state.reviews.map((review) => review.title.toLowerCase())
  ).size;

  adminList.innerHTML = "";
  state.reviews.forEach((review) => {
    const row = createListRow(review);
    const deleteButton = document.createElement("button");
    deleteButton.className = "ghost-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Remover";
    deleteButton.addEventListener("click", async () => {
      const response = await requestJson(`/api/reviews/${review.id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });

      if (!response.ok) return alert(response.data.error || "Não foi possível remover o depoimento.");
      await fetchReviews();
      render();
    });
    row.append(deleteButton);
    adminList.append(row);
  });
}

async function toggleClubMembership(clubId, joined) {
  const action = joined ? "leave" : "join";
  const response = await postJson(`/api/clubs/${clubId}/${action}`, {});
  if (!response.ok) return alert(response.data.error || "Não foi possível atualizar o clube.");

  if (joined) {
    state.library.joinedClubs = state.library.joinedClubs.filter((id) => id !== clubId);
  } else {
    state.library.joinedClubs.push(clubId);
  }
  saveLibrary();
  await fetchClubs();
  renderClubs();
}

async function deleteClub(clubId) {
  const response = await requestJson(`/api/clubs/${clubId}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
  if (!response.ok) return alert(response.data.error || "Não foi possível excluir o clube.");
  state.library.joinedClubs = state.library.joinedClubs.filter((id) => id !== clubId);
  saveLibrary();
  await fetchClubs();
  renderClubs();
}

function createListRow(review) {
  const row = document.createElement("article");
  row.className = "list-row";
  row.innerHTML = `
    <div>
      <h3></h3>
      <p></p>
    </div>
  `;
  row.querySelector("h3").textContent = review.title;
  row.querySelector("p").textContent = `${review.author} · ${review.reviewer} · ${review.rating}/5`;
  return row;
}

function createFeatureCard(title, text, tag) {
  const card = document.createElement("article");
  card.className = "feature-card";
  card.innerHTML = `
    <span></span>
    <h3></h3>
    <p></p>
  `;
  card.querySelector("span").textContent = tag;
  card.querySelector("h3").textContent = title;
  card.querySelector("p").textContent = text;
  return card;
}

function addWantBook(book) {
  const alreadyExists = state.library.want.some(
    (item) => item.title.toLowerCase() === book.title.toLowerCase()
  );
  if (alreadyExists) return;

  state.library.want.unshift({
    id: crypto.randomUUID(),
    title: book.title,
    author: book.author,
  });
  saveLibrary();
}

function isWanted(title) {
  return state.library.want.some((book) => book.title.toLowerCase() === title.toLowerCase());
}

function rememberLikedReview(reviewId) {
  if (state.library.likedReviews.includes(reviewId)) return;
  state.library.likedReviews.push(reviewId);
  saveLibrary();
}

function toggleListItem(listName, id) {
  const list = state.library[listName];
  if (list.includes(id)) {
    state.library[listName] = list.filter((item) => item !== id);
  } else {
    state.library[listName].push(id);
  }
  saveLibrary();
  render();
}

function formatMultilineText(text) {
  const escaped = String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return escaped
    .split("\n")
    .filter(Boolean)
    .map((line) => linkify(line))
    .join("<br>");
}

function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer">$1</a>'
  );
}

function isAdmin() {
  return state.session?.role === "admin";
}

function isRealUser() {
  return Boolean(state.session && state.session.role !== "admin" && state.session.id !== "admin");
}

function getAdminHeaders() {
  if (!isAdmin()) return {};
  return { "X-Admin-Password": adminPassword };
}

function logout() {
  state.session = null;
  state.userBooks = [];
  activeView = defaultView;
  saveSession();
  render();
}

function displayNameFromIdentifier(identifier) {
  const cleaned = String(identifier || "").trim();
  if (!cleaned) return "Leitor";
  const baseName = cleaned.includes("@") ? cleaned.split("@")[0] : cleaned;
  return baseName.replace(/[._-]+/g, " ").trim() || "Leitor";
}

function coverColor(index) {
  const colors = ["#8fbc9b", "#a7c7e7", "#f0b7a4", "#c8b6df", "#e7cf8f"];
  return colors[index % colors.length];
}

Promise.all([fetchReviews(), fetchClubs(), loadUserExtras()]).then(() => {
  if (state.session) showView(defaultView);
  render();
});
