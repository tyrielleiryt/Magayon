
 /*********************************************************
 * CONFIG
 *********************************************************/
const SHEET_ID = "1YU15BY6dWfsfIz9Qy3tKCcOcju09XTQAXIldfLTtGyk";

const PRODUCTS = "Products";
const INVENTORY = "Inventory_Items";
const RECIPES = "Product_Recipes";
const DAILY = "Daily_Inventory";
const DAILY_ITEMS = "Daily_Inventory_Items";
const POS_ORDER_ITEMS = "pos_order_items";
const LOCATIONS = "Locations";
const CATEGORIES = "Categories";

const ss = SpreadsheetApp.openById(SHEET_ID);

/*********************************************************
 * HELPERS
 *********************************************************/
function sheet(name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Missing sheet: ${name}`);
  return sh;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg) {
  return json({ success: false, error: msg });
}

function getStaff() {
  return sheet("Staff")
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      staff_id: r[0],
      last_name: r[1],
      first_name: r[2],
      email: String(r[3]).toLowerCase(),
      location_id: r[4],
      position: r[5],
      start_date: r[6],
      can_pos: r[7] === true || r[7] === "TRUE",
      active: r[8] === true || r[8] === "TRUE"
    }));
}

/*********************************************************
 * DAILY INVENTORY STOCKS (FOR POS STOCKS LIST)
 * returns: item_id, item_name, added_today, remaining
 *********************************************************/
function getTodayStocks(location) {
  if (!location) return [];

  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  const inventorySheet = sheet(INVENTORY);
  const dailySheet = sheet(DAILY);
  const dailyItemsSheet = sheet(DAILY_ITEMS);

  /* ================= INVENTORY MASTER ================= */
  const inventoryMap = {}; // item_id → item_name

  inventorySheet.getDataRange().getValues().slice(1).forEach(r => {
    inventoryMap[r[0]] = r[1];
  });

  /* ================= FIND TODAY DAILY ID ================= */
  const dailyRow = dailySheet
    .getDataRange()
    .getValues()
    .slice(1)
    .find(r =>
      Utilities.formatDate(new Date(r[1]), tz, "yyyy-MM-dd") === today &&
      r[2] === location
    );

  if (!dailyRow) {
    // no inventory added today yet
    return Object.keys(inventoryMap).map(id => ({
      item_id: id,
      item_name: inventoryMap[id],
      added_today: 0,
      remaining: 0
    }));
  }

  const dailyId = dailyRow[0];

  /* ================= AGGREGATE ITEMS ================= */
  const resultMap = {}; // item_id → { added_today, remaining }

  dailyItemsSheet.getDataRange().getValues().slice(1).forEach(r => {
    if (r[1] !== dailyId) return;

    const itemId = r[2];
    const qtyAdded = Number(r[3]) || 0;
    const remaining = Number(r[4]) || 0;

    if (!resultMap[itemId]) {
      resultMap[itemId] = {
        added_today: 0,
        remaining: 0
      };
    }

    resultMap[itemId].added_today += qtyAdded;
    resultMap[itemId].remaining = remaining; // latest remaining
  });

  /* ================= FINAL OUTPUT ================= */
  return Object.keys(inventoryMap).map(id => ({
    item_id: id,
    item_name: inventoryMap[id],
    added_today: resultMap[id]?.added_today || 0,
    remaining: resultMap[id]?.remaining || 0
  }));
}

/*********************************************************
 * INVENTORY ITEMS
 *********************************************************/
function getInventoryItems() {
  return sheet(INVENTORY)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      item_id: r[0],
      item_name: r[1],
      description: r[2],
      quantity_per_serving: r[3],
      unit: r[4],
      capital: r[5],
      selling_price: r[6],
      reorder_level: r[7],
      active: r[8]
    }));
}

/*********************************************************
 * DAILY INVENTORY
 *********************************************************/
function getDailyInventory() {
  return sheet(DAILY)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      daily_id: r[0],
      date: r[1],
      location: r[2],
      total_items: r[3],
      created_by: r[4],
      created_at: r[5]
    }));
}

/*********************************************************
 * DAILY INVENTORY ITEMS
 *********************************************************/
function getDailyInventoryItems(date, location) {
  if (!date || !location) return [];

  const tz = Session.getScriptTimeZone();
  const inventoryMap = {};

  sheet(INVENTORY)
    .getDataRange()
    .getValues()
    .slice(1)
    .forEach(r => inventoryMap[r[0]] = r[1]);

  const dailyRow = sheet(DAILY)
    .getDataRange()
    .getValues()
    .slice(1)
    .find(r =>
      Utilities.formatDate(new Date(r[1]), tz, "yyyy-MM-dd") === date &&
      r[2] === location
    );

  if (!dailyRow) return [];

  return sheet(DAILY_ITEMS)
    .getDataRange()
    .getValues()
    .slice(1)
    .filter(r => r[1] === dailyRow[0])
    .map(r => ({
      item_id: r[2],
      item_name: inventoryMap[r[2]] || "Unknown Item",
      qty_added: Number(r[3]) || 0,
      remaining: Number(r[4]) || 0
    }));
}

/*********************************************************
 * PRODUCTS
 *********************************************************/
function getProducts() {
  return sheet(PRODUCTS)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      product_id: r[0],
      product_code: r[1],
      product_name: r[2],
      category_id: r[3],
      description: r[4],
      price: r[5],
      image_url: r[6],
      active: r[7]
    }));
}

/*********************************************************
 * CATEGORIES
 *********************************************************/
function getCategories() {
  return sheet(CATEGORIES)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      category_id: r[0],
      category_name: r[1]
    }));
}

/*********************************************************
 * LOCATIONS
 *********************************************************/
function getLocations() {
  return sheet(LOCATIONS)
    .getDataRange()
    .getValues()
    .slice(1)
    .map(r => ({
      location_id: r[0],
      location_name: r[1],
      address: r[2],
      active: r[3] === true || r[3] === "TRUE"
    }));
}

/*********************************************************
 * RECIPES
 *********************************************************/
function getAllProductRecipes() {
  const map = {};
  sheet(RECIPES)
    .getDataRange()
    .getValues()
    .slice(1)
    .forEach(r => {
      if (!map[r[1]]) map[r[1]] = [];
      map[r[1]].push({
        item_id: r[2],
        qty_used: Number(r[3])
      });
    });
  return map;
}

/*********************************************************
 * ADD DAILY INVENTORY (FIXED)
 *********************************************************/
/*********************************************************
 * ADD DAILY INVENTORY — ACCUMULATING (SAFE)
 *********************************************************/
function addDailyInventory(p) {
  try {
    const location = p.location;
    const createdBy = p.created_by || "";
    const items = JSON.parse(p.items || "[]");

    if (!location || !items.length) {
      return { success: false, error: "Invalid inventory data" };
    }

    const tz = Session.getScriptTimeZone();
    const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    const dailySheet = sheet(DAILY);
    const dailyItemsSheet = sheet(DAILY_ITEMS);

    /* ================= FIND OR CREATE DAILY HEADER ================= */
    const dailyValues = dailySheet.getDataRange().getValues();
    let dailyRowIndex = -1;
    let dailyId = null;

    for (let i = 1; i < dailyValues.length; i++) {
      const r = dailyValues[i];
      if (
        Utilities.formatDate(new Date(r[1]), tz, "yyyy-MM-dd") === today &&
        r[2] === location
      ) {
        dailyRowIndex = i + 1;
        dailyId = r[0];
        break;
      }
    }

    if (!dailyId) {
      dailyId = "DAILY-" + Date.now();
      dailySheet.appendRow([
        dailyId,
        today,
        location,
        0,
        createdBy,
        new Date()
      ]);
      dailyRowIndex = dailySheet.getLastRow();
    }

    /* ================= LOAD EXISTING DAILY ITEMS ================= */
    const itemValues = dailyItemsSheet.getDataRange().getValues();

    const itemRowMap = {}; // item_id → { row, qty, remaining }

    for (let i = 1; i < itemValues.length; i++) {
      const r = itemValues[i];
      if (r[1] === dailyId) {
        itemRowMap[r[2]] = {
          row: i + 1,
          qty: Number(r[3]) || 0,
          remaining: Number(r[4]) || 0
        };
      }
    }

    /* ================= ADD / ACCUMULATE ITEMS ================= */
    items.forEach(it => {
      const addQty = Number(it.qty) || 0;
      if (!addQty) return;

      if (itemRowMap[it.item_id]) {
        // ✅ ACCUMULATE
        const existing = itemRowMap[it.item_id];
        dailyItemsSheet.getRange(existing.row, 4).setValue(existing.qty + addQty);
        dailyItemsSheet.getRange(existing.row, 5).setValue(existing.remaining + addQty);
      } else {
        // ✅ NEW ITEM
        dailyItemsSheet.appendRow([
          "DI-" + Date.now() + "-" + Math.random().toString(36).slice(2),
          dailyId,
          it.item_id,
          addQty,
          addQty, // remaining
          0,
          0,
          new Date()
        ]);
      }
    });

    /* ================= UPDATE TOTAL ITEMS COUNT ================= */
    const totalItems = dailyItemsSheet
      .getDataRange()
      .getValues()
      .slice(1)
      .filter(r => r[1] === dailyId).length;

    dailySheet.getRange(dailyRowIndex, 4).setValue(totalItems);

    return {
      success: true,
      message: "Inventory successfully added for today"
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/*********************************************************
 * CHECKOUT — DEDUCTS DAILY INVENTORY
 *********************************************************/
function checkoutOrder(p) {
  try {
    const items = JSON.parse(p.items || "[]");
    if (!items.length) throw new Error("No items in cart");

    const tz = Session.getScriptTimeZone();
    const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

    const dailyRow = sheet(DAILY)
      .getDataRange()
      .getValues()
      .slice(1)
      .find(r =>
        Utilities.formatDate(new Date(r[1]), tz, "yyyy-MM-dd") === today &&
        r[2] === p.location
      );

    if (!dailyRow) throw new Error("Daily inventory not created");

    const dailyId = dailyRow[0];
    const dailyItemsSheet = sheet(DAILY_ITEMS);
    const values = dailyItemsSheet.getDataRange().getValues();

    const inventoryMap = {};
    const rows = [];

    for (let i = 1; i < values.length; i++) {
      if (values[i][1] === dailyId) {
        inventoryMap[values[i][2]] = Number(values[i][4]) || 0;
        rows.push({ row: i + 1, item_id: values[i][2] });
      }
    }

    const recipes = getAllProductRecipes();

    items.forEach(it => {
      recipes[it.product_id].forEach(r => {
        if (inventoryMap[r.item_id] < r.qty_used * it.qty) {
          throw new Error("Insufficient inventory");
        }
      });
    });

    items.forEach(it => {
      recipes[it.product_id].forEach(r => {
        inventoryMap[r.item_id] -= r.qty_used * it.qty;
      });
    });

    rows.forEach(r => {
      dailyItemsSheet.getRange(r.row, 5).setValue(inventoryMap[r.item_id]);
    });

    sheet("pos_orders").appendRow([p.ref_id, new Date(), p.staff_id, p.location]);

    const orderItemsSheet = sheet(POS_ORDER_ITEMS);
    items.forEach(it => {
      orderItemsSheet.appendRow([
        "POI-" + Date.now(),
        new Date(),
        it.product_id,
        it.qty,
        it.price,
        it.total,
        p.ref_id,
        p.location,
        p.staff_id
      ]);
    });

    return { success: true, message: "Checkout successful" };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/*********************************************************
 * DAILY SALES REPORT (READ ONLY – SAFE)
 *********************************************************/
function getDailySalesReport(date, location) {
  if (!date) return [];

  const tz = Session.getScriptTimeZone();

  const orders = sheet("pos_orders").getDataRange().getValues().slice(1);
  const items = sheet("pos_order_items").getDataRange().getValues().slice(1);

  // filter orders by date (+ location if provided)
  const filteredOrders = orders.filter(o => {
    const d = Utilities.formatDate(new Date(o[1]), tz, "yyyy-MM-dd");
    if (d !== date) return false;
    if (location && o[3] !== location) return false;
    return true;
  });

  return filteredOrders.map(o => {
    const refId = o[0];

    const orderItems = items
      .filter(it => it[6] === refId)
      .map(it => ({
        product_name: it[2],   // product_id for now (safe)
        qty: Number(it[3]) || 0,
        total: Number(it[5]) || 0
      }));

    return {
      ref_id: refId,
      datetime: o[1],          // ✅ checkout time
      total: Number(o[2]) || 0,
      location: o[3],
      cashier: o[4],
      items: orderItems
    };
  });
}

function jsonp(callback, data) {
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(data)})`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/*********************************************************
 * ROUTER
 *********************************************************/
function doGet(e) {
  const p = e.parameter || {};

  // ✅ DAILY SALES REPORT (JSONP SAFE)
  if (p.type === "dailySalesReport") {
    const data = getDailySalesReport(p.date, p.location);
    if (p.callback) {
      return jsonp(p.callback, data); // JSONP response
    }
    return json(data); // normal JSON
  }

  if (p.type === "todayStocks") {return json(getTodayStocks(p.location));}

  if (p.type === "staff" && p.callback) {
  return jsonp(p.callback, getStaff());
}
  
  if (p.action === "addDailyInventory") return json(addDailyInventory(p));
  if (p.type === "inventoryItems") return json(getInventoryItems());
  if (p.type === "dailyInventory") return json(getDailyInventory());
  if (p.type === "dailyInventoryItems")
    return json(getDailyInventoryItems(p.date, p.location));
  if (p.type === "products") return json(getProducts());
  if (p.type === "categories") return json(getCategories());
  if (p.type === "locations") return json(getLocations());
  if (p.type === "allProductRecipes") return json(getAllProductRecipes());
  if (p.type === "dailySalesReport")
    return json(getDailySalesReport(p.date, p.location));
  return json([]);
}

function doPost(e) {
  const p = e.parameter || {};
  if (p.action === "checkoutOrder") return json(checkoutOrder(p));
  if (p.action === "addDailyInventory") return json(addDailyInventory(p));
  return jsonError("Invalid action");
}

