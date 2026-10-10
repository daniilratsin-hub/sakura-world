(() => {
  const products = window.SAKURA_PRODUCTS || [];
  const grid = document.querySelector("#product-grid");
  const filters = document.querySelector("#filters");
  const search = document.querySelector("#search");
  const toast = document.querySelector("#toast");
  const overlay = document.querySelector("#cart-overlay");
  const cartItems = document.querySelector("#cart-items");
  const cartCount = document.querySelector("#cart-count");
  const cartTotal = document.querySelector("#cart-total");
  let category = "all";
  let cart = {};
  let toastTimer;

  const money = n => `${new Intl.NumberFormat("uk-UA").format(n)} ₴`;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const showToast = message => {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  };
  const productById = id => products.find(p => p.id === id);
  const qty = () => Object.values(cart).reduce((a,b) => a+b,0);
  const total = () => Object.entries(cart).reduce((sum,[id,q]) => sum + (productById(id)?.price || 0)*q,0);

  function renderProducts() {
    const q = search.value.trim().toLowerCase();
    const visible = products.filter(p => (category === "all" || p.category === category) &&
      `${p.name} ${p.description} ${p.tag}`.toLowerCase().includes(q));
    grid.innerHTML = visible.length ? visible.map(p => `
      <article class="product-card">
        <div class="product-visual" style="--glow:${p.glow}">
          <span class="product-tag">${escapeHtml(p.tag)}</span><span class="product-emoji" aria-hidden="true">${p.emoji}</span>
        </div>
        <div class="product-body">
          <h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p>
          <div class="product-meta"><div class="price">${money(p.price)}</div>
          <button class="add-button" data-add="${escapeHtml(p.id)}">В корзину +</button></div>
        </div>
      </article>`).join("") : '<div class="no-results">Ничего не найдено. Попробуй другой запрос.</div>';
  }

  function renderCart() {
    cartCount.textContent = qty();
    cartItems.innerHTML = qty() ? Object.entries(cart).map(([id,q]) => {
      const p = productById(id);
      if (!p) return "";
      return `<div class="cart-line"><div><b>${escapeHtml(p.name)}</b><small>${money(p.price)} за шт.</small></div>
        <div class="cart-line-actions"><button data-change="${escapeHtml(id)}" data-delta="-1" aria-label="Уменьшить">−</button><span>${q}</span><button data-change="${escapeHtml(id)}" data-delta="1" aria-label="Увеличить">+</button></div></div>`;
    }).join("") : '<p class="empty-cart">Корзина пока пустая 🌸<br>Добавь товары из каталога.</p>';
    cartTotal.textContent = money(total());
  }

  function add(id) {
    if (!productById(id)) return;
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    showToast(`${productById(id).name} добавлен в корзину`);
  }
  function openCart() { overlay.hidden = false; document.body.style.overflow = "hidden"; renderCart(); }
  function closeCart() { overlay.hidden = true; document.body.style.overflow = ""; }

  filters.addEventListener("click", e => {
    const button = e.target.closest("[data-category]");
    if (!button) return;
    category = button.dataset.category;
    filters.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === button));
    renderProducts();
  });
  search.addEventListener("input", renderProducts);
  grid.addEventListener("click", e => {
    const button = e.target.closest("[data-add]");
    if (button) add(button.dataset.add);
  });
  cartItems.addEventListener("click", e => {
    const button = e.target.closest("[data-change]");
    if (!button) return;
    const id = button.dataset.change;
    cart[id] = (cart[id] || 0) + Number(button.dataset.delta);
    if (cart[id] <= 0) delete cart[id];
    renderCart();
  });
  document.querySelector("#open-cart").addEventListener("click", openCart);
  document.querySelector("#close-cart").addEventListener("click", closeCart);
  document.querySelector("#close-cart-bg").addEventListener("click", closeCart);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !overlay.hidden) closeCart(); });

  async function copyIp() {
    try {
      await navigator.clipboard.writeText("free.cloudblaze.org:52126");
      showToast("IP сервера скопирован!");
    } catch {
      showToast("IP сервера: free.cloudblaze.org:52126");
    }
  }
  document.querySelector("#copy-ip").addEventListener("click", copyIp);
  document.querySelector("#copy-ip-bottom").addEventListener("click", copyIp);

  document.querySelector("#checkout-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!qty()) { showToast("Сначала добавь товар в корзину"); return; }
    const playerName = document.querySelector("#player-name").value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(playerName)) {
      showToast("Проверь Minecraft Java-ник (3–16 символов)");
      return;
    }
    const apiBase = String(window.SAKURA_API_BASE || "").replace(/\/$/, "");
    if (!apiBase) {
      showToast("Сервер магазина ещё не подключён");
      alert(`Корзина готова, но сервер магазина ещё не подключён.\n\nЗаказ для: ${playerName}\n\n${Object.entries(cart).map(([id,q])=>`${productById(id)?.name || id} × ${q}`).join("\n")}\n\nИтого: ${money(total())}\n\nСледующий шаг — разместить backend и указать его HTTPS-адрес в backend-config.js. Оплата пока не выполняется.`);
      return;
    }
    const submitButton = document.querySelector('#checkout-form button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Создаём заказ…";
    try {
      const response = await fetch(`${apiBase}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity })) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось создать заказ");
      alert(`Заказ создан: ${result.orderId}\nИгрок: ${playerName}\nСумма: ${money(result.total)}\nСтатус: ${result.status}\n\nВНИМАНИЕ: это пока только запись заказа. Оплата и выдача не подключены.`);
      showToast("Заказ создан в тестовом режиме");
    } catch (error) {
      showToast("Не удалось связаться с сервером магазина");
      alert(`Не удалось создать заказ.\n${error.message}\n\nПроверь HTTPS-адрес backend и его доступность.`);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Перейти к оформлению";
    }
  });

  document.querySelector("#year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
})();
