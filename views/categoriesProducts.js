import { bindDataBoxScroll, getCached, invalidateCache } from "../admin.js";
import { openModal, closeModal, showModalLoader, hideModalLoader } from "./modal.js";

import { API_URL } from "../firebase-config.js";
import { authFetch } from "../auth-guard.js";
import { icon } from "../icons.js";

window.closeModal = closeModal;
window.__productImgFallback = () => icon("utensils", { size: 32, style: "color:#cbd5e1" });

/* =========================================================
   LOADER HELPERS
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

// Which categories are currently expanded — collapsed by default, same
// "nothing shown until asked for" spirit as the Dashboard's widgets.
// Untouched by data reloads, so expand state survives a save/delete.
const expandedCategoryIds = new Set();

const UNCATEGORIZED_ID = "__uncategorized__";

/* ================= ENTRY =================
   No top action bar — Add/Edit/Delete Product all live inside the grid
   itself now: an "Add Product" tile inside each expanded category,
   clicking a product card opens it straight into Edit, and a small
   delete icon sits on each card (same pattern as the category chips'
   edit/delete icons). */
export default async function loadCategoriesProductsView() {
  document.getElementById("actionBar").innerHTML = "";
  renderLayout();

  const [cats, prods] = await Promise.all([
    getCached("categories"),
    getCached("products")
  ]);

  categories = cats;
  products = prods;
  renderCategoryGrid();
}

/* ================= LAYOUT ================= */
function renderLayout() {
  const box = document.getElementById("contentBox");

  box.innerHTML = `
    <div class="data-box">
      <div class="data-scroll">
        <div class="admin-product-grid" id="categoryGrid">
          <p style="grid-column:1/-1;text-align:center;color:#888;padding:24px">Loading…</p>
        </div>
      </div>
    </div>
  `;

  bindDataBoxScroll(box.querySelector(".data-box"));
}

/* ================= RELOAD HELPERS ================= */
async function reloadCategories() {
  categories = await getCached("categories");
  renderCategoryGrid();
}

async function reloadProducts() {
  products = await getCached("products");
  renderCategoryGrid();
}

/* ================= CATEGORY GRID ================= */
function renderCategoryGrid() {
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = "";

  grid.insertAdjacentHTML("beforeend", `
    <button type="button" class="category-chip category-chip-add" id="addCategoryChip">
      ${icon("plus", { size: 22 })}
      <span>Add Category</span>
    </button>
  `);
  document.getElementById("addCategoryChip").onclick = () => openCategoryModal();

  const productsByCategory = {};
  products.forEach(p => {
    const key = categories.some(c => c.category_id === p.category_id)
      ? p.category_id
      : UNCATEGORIZED_ID;
    (productsByCategory[key] ||= []).push(p);
  });

  const allCategories = [...categories];
  if (productsByCategory[UNCATEGORIZED_ID]?.length) {
    allCategories.push({ category_id: UNCATEGORIZED_ID, category_name: "Uncategorized" });
  }

  allCategories.forEach(c => {
    renderCategoryChip(grid, c, productsByCategory[c.category_id] || []);
  });
}

function renderCategoryChip(grid, category, categoryProducts) {
  const isExpanded = expandedCategoryIds.has(category.category_id);
  const isReal = category.category_id !== UNCATEGORIZED_ID;

  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "category-chip" + (isExpanded ? " expanded" : "");
  chip.innerHTML = `
    ${isReal ? `
      <div class="category-chip-actions">
        <button type="button" class="category-chip-icon-btn" data-action="edit" title="Edit category">${icon("pencil", { size: 13 })}</button>
        <button type="button" class="category-chip-icon-btn" data-action="delete" title="Delete category">${icon("trash-2", { size: 13 })}</button>
      </div>
    ` : ""}
    <div class="category-chip-name">${category.category_name}</div>
    <div class="category-chip-count">${categoryProducts.length} product${categoryProducts.length === 1 ? "" : "s"}</div>
    ${icon("chevron-down", { size: 16, class: "widget-chevron category-chip-chevron" })}
  `;

  chip.onclick = () => {
    if (expandedCategoryIds.has(category.category_id)) {
      expandedCategoryIds.delete(category.category_id);
    } else {
      expandedCategoryIds.add(category.category_id);
    }
    renderCategoryGrid();
  };

  if (isReal) {
    chip.querySelector('[data-action="edit"]').onclick = e => {
      e.stopPropagation();
      openCategoryModal(category);
    };
    chip.querySelector('[data-action="delete"]').onclick = e => {
      e.stopPropagation();
      deleteCategory(category);
    };
  }

  grid.appendChild(chip);

  if (isExpanded) {
    const panel = document.createElement("div");
    panel.className = "category-expanded-panel";

    // Adds straight into this category — skipped for the synthetic
    // Uncategorized bucket, which has no real category_id to add into.
    if (isReal) {
      const addTile = document.createElement("button");
      addTile.type = "button";
      addTile.className = "admin-product-card admin-product-card-add";
      addTile.innerHTML = `${icon("plus", { size: 22 })}<span>Add Product</span>`;
      addTile.onclick = () => openProductModal({}, category.category_id);
      panel.appendChild(addTile);
    }

    if (!categoryProducts.length) {
      if (!isReal) {
        panel.innerHTML = `<p style="text-align:center;color:#888;padding:16px">No products in this category</p>`;
      }
    } else {
      categoryProducts.forEach(p => panel.appendChild(renderProductCard(p)));
    }

    grid.appendChild(panel);
  }
}

/* ================= PRODUCT CARD =================
   No more select-then-click-Edit — clicking the card opens it straight
   into Edit, and a small delete icon on the card handles delete
   directly (mirrors the category chips' own edit/delete icons). The
   status pill still toggles active/inactive in place. */
function renderProductCard(p) {
  const card = document.createElement("div");
  card.className = "admin-product-card" + (!p.active ? " inactive" : "");
  card.dataset.id = p.product_id;

  const placeholderIcon = icon("utensils", { size: 32, style: "color:#cbd5e1" });
  const imgHtml = p.image_url
    ? `<img src="${p.image_url}" alt="" loading="lazy" onerror="this.outerHTML=window.__productImgFallback()">`
    : placeholderIcon;

  card.innerHTML = `
    <button class="admin-product-delete-btn" title="Delete product">${icon("trash-2", { size: 13 })}</button>
    <div class="admin-product-img">${imgHtml}</div>
    <div class="admin-product-info">
      <div class="admin-product-code">${p.product_code || ""}</div>
      <div class="admin-product-name">${p.product_name}</div>
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
    if (!p.active) {
      alert("Inactive products cannot be edited.");
      return;
    }
    openProductModal(p);
  };

  card.querySelector(".admin-product-delete-btn").onclick = e => {
    e.stopPropagation();
    deleteProductConfirm(p);
  };

  const statusBtn = card.querySelector(".status-toggle");
  statusBtn.onclick = e => {
    e.stopPropagation();
    toggleProductStatus({
      product_id: statusBtn.dataset.id,
      active: statusBtn.dataset.active === "true"
    });
  };

  return card;
}

/* ================= CATEGORY ADD / EDIT ================= */
function openCategoryModal(category = null) {
  openModal(`
    <div class="modal-header">${category ? "Edit Category" : "Add Category"}</div>

    <label>Category Name</label>
    <input id="catName" value="${category?.category_name || ""}">

    <div class="modal-actions">
      <button class="btn-danger" id="saveCategoryBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  document.getElementById("saveCategoryBtn").onclick = () => saveCategory(category);
}

async function saveCategory(category) {
  const name = document.getElementById("catName").value.trim();
  if (!name) {
    alert("Category name required");
    return;
  }

  showLoader(category ? "Saving changes…" : "Adding category…");

  try {
    const res = await authFetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: category ? "editCategory" : "addCategory",
        category_id: category?.category_id || "",
        category_name: name
      })
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Save failed");

    closeModal();
    invalidateCache("categories");
    await reloadCategories();
  } catch (err) {
    console.error(err);
    alert("❌ " + err.message);
  } finally {
    hideLoader();
  }
}

/* ================= CATEGORY DELETE ================= */
function deleteCategory(category) {
  if (!confirm(`Delete "${category.category_name}"? Products already in it will show as Uncategorized.`)) return;

  showLoader("Deleting category…");

  authFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "deleteCategory",
      category_id: category.category_id
    })
  })
    .then(r => r.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || "Delete failed");
      expandedCategoryIds.delete(category.category_id);
      invalidateCache("categories");
      return reloadCategories();
    })
    .catch(err => {
      console.error(err);
      alert("❌ " + err.message);
    })
    .finally(hideLoader);
}

/* ================= PRODUCT RECIPE LOOKUP ================= */
async function loadProductRecipe(productId) {
  const allRecipes = await getCached("allProductRecipes");
  return allRecipes[productId] || [];
}

/* ================= PRODUCT MODAL ================= */
async function openProductModal(product = {}, presetCategoryId = null) {
  openModal(`
    <div class="modal-header">
    <h2>${product.product_id ? "Edit" : "Add"} Product</h2>
    </div>

      <div class="modal-body">

    <label>Product Name</label>
    <input id="productName" value="${product.product_name || ""}">

    <div class="form-row">
      <div class="form-field">
        <label>Product Code</label>
        <input id="productCode" value="${product.product_code || ""}">
      </div>
      <div class="form-field">
        <label>Price</label>
        <input type="number" id="priceInput" value="${product.price || ""}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-field">
        <label>Category</label>
        <select id="categorySelect">
          ${categories
            .map(
              c => `
            <option value="${c.category_id}" ${
                c.category_id === (product.category_id || presetCategoryId) ? "selected" : ""
              }>
              ${c.category_name}
            </option>
          `
            )
            .join("")}
        </select>
      </div>
      <div class="form-field">
        <label>Image URL</label>
        <input id="imageInput" value="${product.image_url || ""}">
      </div>
    </div>

    <div class="recipe-section">
      <strong>Product Recipe</strong>
      <div class="recipe-scroll" id="recipeList"></div>
      <button type="button" class="add-ingredient-btn" id="addIngredientBtn">
        ${icon("plus")} Add Ingredient
      </button>
    </div>

    </div>

<div class="modal-footer">
      <button class="btn-danger" id="saveProductBtn">Save</button>
      <button class="btn-back" onclick="closeModal()">Cancel</button>
    </div>
  `);

  showModalLoader("Loading inventory…");

  try {
    await loadInventory();
    document.getElementById("recipeList").innerHTML = "";

    document.getElementById("addIngredientBtn").onclick = addRecipeRow;
    document.getElementById("saveProductBtn").onclick = () => saveProduct(product.product_id || null);
    if (product.product_id) {
      const recipe = await loadProductRecipe(product.product_id);
      recipe.forEach(r => addRecipeRowWithData(r));
    } else {
      addRecipeRow();
    }
  } finally {
    hideModalLoader();
  }
}

/* ================= INVENTORY (for recipe cost calc) ================= */
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

/* ================= PRODUCT SAVE ================= */
function saveProduct(productId) {
  const code = productCode.value.trim();
  const name = productName.value.trim();
  const category = categorySelect.value;
  const price = Number(priceInput.value);
  const image = imageInput.value.trim();

  if (!code || !name || !price) {
    alert("Product Code, Name, and Price are required.");
    return;
  }

  const recipe = Array.from(document.querySelectorAll(".recipe-row")).map(r => ({
    item_id: r.querySelector(".recipe-item").value,
    qty_used: Number(r.querySelector(".recipe-qty").value)
  }));

  showModalLoader("Saving product…");
  const saveBtn = document.getElementById("saveProductBtn");
  if (saveBtn) saveBtn.disabled = true;

  authFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      action: "saveProduct",
      product_id: productId || "",
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

      invalidateCache("products");
      invalidateCache("allProductRecipes");
      closeModal();
      setTimeout(reloadProducts, 300);
    })
    .catch(err => {
      console.error(err);
      alert("❌ Failed to save product");
    })
    .finally(() => {
      hideModalLoader();
      if (saveBtn) saveBtn.disabled = false;
    });
}

/* ================= PRODUCT DELETE ================= */
function deleteProductConfirm(product) {
  if (!confirm(`Delete ${product.product_name}?`)) return;

  showLoader("Deleting product…");

  authFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      action: "deleteProduct",
      product_id: product.product_id
    })
  })
    .then(r => r.json())
    .then(() => {
      invalidateCache("products");
      reloadProducts();
    })
    .finally(hideLoader);
}

function toggleProductStatus(product) {
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
      product_id: product.product_id,
      active: (!product.active).toString()
    })
  })
    .then(r => r.text())
    .then(text => {
      const clean = text.replace(/^\)\]\}',?\n?/, "");
      const res = JSON.parse(clean);

      if (!res.success) {
        throw new Error(res.error || "Update failed");
      }

      invalidateCache("products");
      reloadProducts();
    })
    .catch(err => {
      console.error("STATUS UPDATE ERROR:", err);
      alert("Failed to update product status");
    })
    .finally(hideLoader);
}
