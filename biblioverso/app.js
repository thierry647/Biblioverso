const adminPassword = "admin123";
const sessionKey = "biblioverso-session";
const libraryKey = "biblioverso-library";

const state = {
  session: loadSession(),
  reviews: [],
  library: loadLibrary(),
};

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

const clubs = [
  {
    id: "classicos",
    title: "Clube dos Clássicos",
    text: "Leituras coletivas de obras brasileiras e internacionais que atravessaram gerações.",
    members: 42,
  },
  {
    id: "fantasia",
    title: "Fantasia e Mundos",
    text: "Para quem gosta de magia, aventuras, mapas, sagas e universos inventados.",
    members: 35,
  },
  {
    id: "vida-real",
    title: "Leituras da Vida Real",
    text: "Biografias, memórias, comportamento e livros que ajudam a entender pessoas.",
    members: 28,
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
const userNameInput = document.querySelector("#user-name");
const userRoleInput = document.querySelector("#user-role");
const adminPasswordInput = document.querySelector("#admin-password");
const adminPasswordLabel = document.querySelector("#admin-password-label");
const sessionStatus = document.querySelector("#session-status");
const profileHeading = document.querySelector("#profile-heading");
const profileSummary = document.querySelector("#profile-summary");
const profileAvatar = document.querySelector("#profile-avatar");
const profileList = document.querySelector("#profile-list");
const adminLocked = document.querySelector("#admin-locked");
const adminPanel = document.querySelector("#admin-panel");
const adminList = document.querySelector("#admin-list");

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  button.classList.remove("clicked");
  window.requestAnimationFrame(() => button.classList.add("clicked"));
});

userRoleInput.addEventListener("change", renderAdminPasswordField);

document.querySelector("#login-button").addEventListener("click", () => {
  const name = userNameInput.value.trim() || "Leitor";
  const role = userRoleInput.value;

  if (role === "admin" && adminPasswordInput.value !== adminPassword) {
    state.session = { name, role: "reader" };
    saveSession();
    render();
    sessionStatus.textContent = "Senha de administrador incorreta. Você entrou como leitor.";
    return;
  }

  state.session = { name, role };
  saveSession();
  render();
});

searchInput.addEventListener("input", renderFeed);

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(reviewForm);
  const reviewer = state.session?.name || "Visitante";

  await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: form.get("title").trim(),
      author: form.get("author").trim(),
      category: form.get("category"),
      rating: Number(form.get("rating")),
      text: form.get("text").trim(),
      reviewer,
    }),
  });

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

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey)) || null;
  } catch {
    return null;
  }
}

function saveSession() {
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

async function fetchReviews() {
  const response = await fetch("/api/reviews");
  const data = await response.json();
  state.reviews = data.reviews || [];
}

function showView(viewName) {
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
  renderSession();
  renderAdminPasswordField();
  renderFeed();
  renderProfile();
  renderRanking();
  renderWantList();
  renderChallenges();
  renderRecommendations();
  renderClubs();
  renderAdmin();
}

function renderAdminPasswordField() {
  const isAdminSelected = userRoleInput.value === "admin";
  adminPasswordInput.hidden = !isAdminSelected;
  adminPasswordLabel.hidden = !isAdminSelected;
}

function renderSession() {
  if (!state.session) {
    sessionStatus.textContent = "Você está como visitante.";
    return;
  }

  userNameInput.value = state.session.name;
  userRoleInput.value = state.session.role;
  sessionStatus.textContent =
    state.session.role === "admin"
      ? `${state.session.name} entrou como administrador.`
      : `${state.session.name} entrou como leitor.`;
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
    ? "Sua estante mostra os depoimentos publicados por você."
    : "Entre com seu nome para criar sua estante.";
  document.querySelector("#stat-reviews").textContent = mine.length;
  document.querySelector("#stat-books").textContent = uniqueBooks.size;
  document.querySelector("#stat-average").textContent = average.toFixed(1);

  profileList.innerHTML = "";
  if (!mine.length) {
    profileList.innerHTML = '<div class="empty-state">Você ainda não publicou depoimentos.</div>';
    return;
  }

  mine.forEach((review) => profileList.append(createListRow(review)));
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

  clubs.forEach((club) => {
    const joined = state.library.joinedClubs.includes(club.id);
    const card = createFeatureCard(club.title, club.text, `${club.members} membros`);
    const button = document.createElement("button");
    button.className = joined ? "primary-button" : "ghost-button";
    button.type = "button";
    button.textContent = joined ? "Você está no clube" : "Entrar no clube";
    button.addEventListener("click", () => toggleListItem("joinedClubs", club.id));
    card.append(button);
    list.append(card);
  });
}

function renderAdmin() {
  const isAdmin = state.session?.role === "admin";
  adminLocked.hidden = isAdmin;
  adminPanel.hidden = !isAdmin;

  if (!isAdmin) return;

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
      await fetch(`/api/reviews/${review.id}`, { method: "DELETE" });
      await fetchReviews();
      render();
    });
    row.append(deleteButton);
    adminList.append(row);
  });
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

function coverColor(index) {
  const colors = ["#8fbc9b", "#a7c7e7", "#f0b7a4", "#c8b6df", "#e7cf8f"];
  return colors[index % colors.length];
}

fetchReviews().then(render);
