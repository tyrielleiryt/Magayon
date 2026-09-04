import { bindDataBoxScroll, getCached } from "../admin.js";
import { openModal, closeModal } from "./modal.js";
 
import { API_URL } from "../firebase-config.js";
import { authFetch } from "../auth-guard.js";

window.closeModal = closeModal;

/* =========================================================
   LOADER HELPERS (STEP 4)
========================================================= */
function showLoader(text = "Loading data…") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector(".loader-text").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}

/* ================= STATE ================= */
let products = [];
let categories = [];
let inventoryMap = {};
let selected = null;

/* ================= ENTRY ================= */
export default async function loadProductsView() {
  renderActionBar();
  renderTableLayout();

  // Categories are cached (they rarely change) and products are fetched
  // fresh in parallel — no full-screen blocker, the table headers are
  // already visible while this resolves.
  const [cats, prods] = await Promise.all([
    getCached("categories"),
    fetch(API_URL + "?type=products").then(r => r.json())
  ]);

  categories = cats;
  products = prods;
  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;
  renderTable();
}

/* ================= ACTION BAR ================= */
function renderActionBar() {
  const bar = document.getElementById("actionBar");

  bar.innerHTML = `
    <button id="addBtn" class="category-action-btn">➕ Add Product</button>
    <button id="editBtn" class="category-action-btn" disabled>✏️ Edit</button>
    <button id="deleteBtn" class="category-action-btn" disabled>🗑️ Delete</button>
  `;

  document.getElementById("addBtn").onclick = () => {
  selected = null; // ✅ RESET EDIT STATE
  openProductModal();
};

document.getElementById("editBtn").onclick = () => {
  if (!selected) {
    alert("Please select a product first.");
    return;
  }

  // 🔒 OPTIONAL SAFETY GUARD — PUT IT HERE
  if (!selected.active) {
    alert("Inactive products cannot be edited.");
    return;
  }

  openProductModal(selected);
};
  document.getElementById("deleteBtn").onclick = deleteProduct;
}

/* ================= PRODUCT CARDS ================= */
function renderTableLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <div class="admin-product-grid" id="productGrid">
          <p style="grid-column:1/-1;text-align:center;color:#888;padding:24px">Loading…</p>
        </div>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= LOAD DATA ================= */
async function loadProducts() {
  products = await fetch(API_URL + "?type=products").then(r => r.json());

  selected = null;
  document.getElementById("editBtn").disabled = true;
  document.getElementById("deleteBtn").disabled = true;
  renderTable();
}

/* ================= RENDER ================= */
function renderTable() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  if (!products.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#888;padding:24px">No products found</p>`;
    return;
  }

  products.forEach(p => {
    const cat = categories.find(c => c.category_id === p.category_id);
    const card = document.createElement("div");
    card.className = "admin-product-card" + (!p.active ? " inactive" : "");
    card.dataset.id = p.product_id;

    // No placeholder image file exists in this project, and many products
    // have no image_url set — fall back to a plain food emoji instead of
    // depending on a file that isn't there.
    const imgHtml = p.image_url
      ? `<img src="${p.image_url}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🍽️'}))">`
      : `<span>🍽️</span>`;

    card.innerHTML = `
      <div class="admin-product-img">${imgHtml}</div>
      <div class="admin-product-info">
        <div class="admin-product-code">${p.product_code || ""}</div>
        <div class="admin-product-name">${p.product_name}</div>
        <div class="admin-product-category">${cat ? cat.category_name : ""}</div>
        <div class="admin-product-price">₱${Number(p.price).toFixed(2)}</div>
      </div>
      <button
        class="status-toggle ${p.active ? "active" : "inactive"}"
        data-id="${p.product_id}"
        data-active="${p.active}">
        ${p.active ? "ACTIVE" : "INACTIVE"}
      </button>
    `;

    card.onclick = () => {
      document
        .querySelectorAll("#productGrid .admin-product-card")
        .forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selected = p;

      // ⛔ Edit only allowed if ACTIVE
      document.getElementById("editBtn").disabled = !p.active;

      // 🗑️ Delete allowed for both (or change if you want stricter rules)
      document.getElementById("deleteBtn").disabled = false;
    };

    grid.appendChild(card);

    const statusBtn = card.querySelector(".status-toggle");

    statusBtn.onclick = (e) => {
      e.stopPropagation(); // 🚫 prevent card select

      toggleProductStatus({
        product_id: statusBtn.dataset.id,
        active: statusBtn.dataset.active === "true"
      });
    };
  });
}

async function loadProductRecipe(productId) {
  const allRecipes = await fetch(API_URL + "?type=allProductRecipes")
    .then(r => r.json());

  return allRecipes[productId] || [];
}

/* ================= MODAL ================= */
async function openProductModal(product = {}) {
  openModal(`
    <div class="modal-header">
    <h2>${product.product_id ? "Edit" : "Add"} Product</h2>
    </div>

      <div class="modal-body">

    <label>Product Code</label>
    <input id="productCode" value="${product.product_code || ""}">

    <label>Product Name</label>
    <input id="productName" value="${product.product_name || ""}">

    <label>Category</label>
    <select id="categorySelect">
      ${categories
        .map(
          c => `
        <option value="${c.category_id}" ${
            c.category_id === product.category_id ? "selected" : ""
          }>
          ${c.category_name}
        </option>
      `
        )
        .join("")}
    </select>

    <label>Price</label>
    <input type="number" id="priceInput" value="${product.price || ""}">

    <label>Image URL</label>
    <input id="imageInput" value="${product.image_url || ""}">

    <div class="recipe-section">
      <strong>Product Recipe</strong>
      <div class="recipe-scroll" id="recipeList"></div>
      <button type="button" class="add-ingredient-btn" id="addIngredientBtn">
        ➕ Add Ingredient
      </button>
    </div>

    </div>
  
<div class="modal-footer">
      <button class="btn-danger" id="saveProductBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  showLoader("Loading inventory…");

  try {
    await loadInventory();
document.getElementById("recipeList").innerHTML = ""; // ✅ CLEAR OLD RECIPES

document.getElementById("addIngredientBtn").onclick = addRecipeRow;
document.getElementById("saveProductBtn").onclick = saveProduct;
    if (product.product_id) {
  const recipe = await loadProductRecipe(product.product_id);
  recipe.forEach(r => addRecipeRowWithData(r));
} else {
  addRecipeRow();
}
  } finally {
    hideLoader();
  }
}

/* ================= INVENTORY ================= */
async function loadInventory() {
  inventoryMap = {};
  const items = await getCached("inventoryItems");

  items.forEach(i => {
    inventoryMap[i.item_id] = {
      name: i.item_name,
      capital: Number(i.capital) || 0
    };
  });
}

/* ================= RECIPE ================= */
function addRecipeRow() {
  const list = document.getElementById("recipeList");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.entries(inventoryMap)
        .map(([id, i]) => `<option value="${id}">${i.name}</option>`)
        .join("")}
    </select>
    <button class="recipe-btn minus">−</button>
    <input class="recipe-qty" type="number" value="1" min="1">
    <button class="recipe-btn plus">+</button>
    <div class="recipe-cost">₱0.00</div>
  `;

  list.appendChild(row);
  bindRecipeEvents(row);
}

function addRecipeRowWithData(r) {
  const list = document.getElementById("recipeList");

  const row = document.createElement("div");
  row.className = "recipe-row";

  row.innerHTML = `
    <select class="recipe-item">
      ${Object.entries(inventoryMap)
        .map(([id, i]) =>
          `<option value="${id}" ${id === r.item_id ? "selected" : ""}>
            ${i.name}
          </option>`
        )
        .join("")}
    </select>
    <button class="recipe-btn minus">−</button>
    <input class="recipe-qty" type="number" value="${r.qty_used}" min="1">
    <button class="recipe-btn plus">+</button>
    <div class="recipe-cost">₱0.00</div>
  `;

  list.appendChild(row);
  bindRecipeEvents(row);
}

function bindRecipeEvents(row) {
  const select = row.querySelector(".recipe-item");
  const qty = row.querySelector(".recipe-qty");
  const cost = row.querySelector(".recipe-cost");

  function update() {
    const item = inventoryMap[select.value];
    cost.textContent = `₱${(item.capital * Number(qty.value)).toFixed(2)}`;
  }

  row.querySelector(".plus").onclick = () => {
    qty.value++;
    update();
  };
  row.querySelector(".minus").onclick = () => {
    qty.value = Math.max(1, qty.value - 1);
    update();
  };
  qty.oninput = update;
  select.onchange = update;

  update();
}

/* ================= SAVE ================= */
function saveProduct() {
  showLoader("Saving product…");

  const code = productCode.value.trim();
  const name = productName.value.trim();
  const category = categorySelect.value;
  const price = Number(priceInput.value);
  const image = imageInput.value.trim();

  if (!code || !name || !price) {
    alert("Product Code, Name, and Price are required.");
    hideLoader();
    return;
  }

  const recipe = Array.from(document.querySelectorAll(".recipe-row")).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(r.querySelector(".recipe-qty").value)
  }));


  authFetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    action: "saveProduct",
    product_id: selected?.product_id || "",
    product_code: code,
    product_name: name,
    category_id: category,
    price: price,
    image_url: image,
    recipe: JSON.stringify(recipe)
  })
})
.then(r => r.json())
.then(res => {
  if (!res.success && res.error === "DUPLICATE_CODE") {
    alert("❌ Product code already exists.");
    return;
  }

  closeModal();
  setTimeout(loadProducts, 300);
})
.catch(err => {
  console.error(err);
  alert("❌ Failed to save product");
})
.finally(hideLoader);
}

/* ================= DELETE ================= */
function deleteProduct() {
  if (!selected) {
    alert("Please select a product first.");
    return;
  }

  if (!confirm(`Delete ${selected.product_name}?`)) return;

  showLoader("Deleting product…");

  authFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      action: "deleteProduct",
      product_id: selected.product_id
    })
  })
    .then(r => r.json())
    .then(() => {
      selected = null;      // ✅ reset state
      loadProducts();       // ✅ reload AFTER delete
    })
    .finally(hideLoader);
}

function toggleProductStatus(product) {

  // ✅ CONFIRM BEFORE DEACTIVATING
  if (product.active && !confirm("Deactivate this product?")) {
    return;
  }

  showLoader("Updating product status…");

  authFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      action: "toggleProductStatus",
      product_id: product.product_id,   // ✅ FIXED
      active: (!product.active).toString() // ✅ FIXED
    })
  })
    .then(r => r.text()) // 🔥 REQUIRED for Apps Script
    .then(text => {
      const clean = text.replace(/^\)\]\}',?\n?/, "");
      const res = JSON.parse(clean);

      if (!res.success) {
        throw new Error(res.error || "Update failed");
      }

      // ✅ refresh table
      loadProducts();
    })
    .catch(err => {
      console.error("STATUS UPDATE ERROR:", err);
      alert("Failed to update product status");
    })
    .finally(hideLoader);
}