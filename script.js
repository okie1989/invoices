// Helper functions
function formatNumber(num) {
  return Number(num).toLocaleString("id-ID");
}

// Satuan list
const satuanList = [
  "Pcs",
  "Kg",
  "Roll",
  "Cm",
  "Meter",
  "Lembar",
  "Lainnya",
];

// Item row template
function createItemRow(item = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
        <td><input type="text" class="item-name" value="${
          item.name || ""
        }" style="width:220px;min-width:160px;max-width:320px;"></td>
        <td><input type="text" class="item-size" value="${
          item.size || ""
        }" style="width:70px;min-width:60px;max-width:90px;text-align:center;"></td>
        <td>
            <input type="number" class="item-qty" value="${
              item.qty || 1
            }" min="0" step="any" style="width:70px;min-width:60px;max-width:90px;text-align:center;">
        </td>
        <td>
            <select class="item-unit" style="width:70px;min-width:60px;max-width:90px;text-align:center;">
                ${satuanList
                  .map(
                    (s) =>
                      `<option value="${s}"${
                        item.unit === s ? " selected" : ""
                      }>${s}</option>`
                  )
                  .join("")}
            </select>
        </td>
        <td><input type="number" class="item-price" value="${
          item.price || 0
        }" min="0" step="any"></td>
        <td class="item-total">0</td>
        <td>
          <button class="remove-item" title="Hapus" style="background:none;border:none;cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
              <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
              <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
              <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
            </svg>
          </button>
        </td>
    `;
  return tr;
}

// Helper: normalisasi tanggal ke YYYY-MM-DD
function normalizeDate(val) {
  if (!val) return "";
  // Jika sudah ISO, return
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Coba parse dari format lain (misal: dd/mm/yyyy, dd-mm-yyyy)
  let d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  // Fallback: return as is
  return val;
}

// Helper: normalisasi angka (string/number) ke Number
function normalizeNumber(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  // Hilangkan pemisah ribuan/koma
  return Number((val + "").replace(/[^0-9.\-]/g, "").replace(",", ".")) || 0;
}

// Helper: normalisasi satu invoice
function normalizeInvoice(inv) {
  return {
    ...inv,
    invoiceDate: normalizeDate(inv.invoiceDate || inv.date || ""),
    dateline: normalizeDate(inv.dateline || inv.rawDateline || ""),
    paidAmount: normalizeNumber(
      inv.paidAmount || inv["paid-amount"] || inv.amountPaid
    ),
    totalPrice: normalizeNumber(inv.totalPrice),
    totalQty: normalizeNumber(inv.totalQty),
    discount: normalizeNumber(inv.discount),
    unpaidAmount: normalizeNumber(inv.unpaidAmount),
    items: (inv.items || []).map((item) => ({
      ...item,
      price: normalizeNumber(item.price),
      qty: normalizeNumber(item.qty),
      total: normalizeNumber(item.total),
      size: item.size || "",
    })),
  };
}

// Helper: normalisasi satu expense
function normalizeExpense(exp) {
  return {
    ...exp,
    date: normalizeDate(exp.date),
    amount: normalizeNumber(exp.amount || exp.grandTotal),
    items: (exp.items || []).map((item) => ({
      ...item,
      qty: normalizeNumber(item.qty),
      price: normalizeNumber(item.price || item.unitPrice),
      total: normalizeNumber(item.total),
      unit: item.unit || "",
      name: item.name || "",
    })),
  };
}

// DOM elements
const orderItems = document.getElementById("order-items");
const addItemBtn = document.getElementById("add-item");
const totalQty = document.getElementById("total-qty");
const totalPrice = document.getElementById("total-price");
const paidAmount = document.getElementById("paid-amount");
const discount = document.getElementById("discount");
const unpaidAmount = document.getElementById("unpaid-amount");
const changeAmount = document.getElementById("change-amount");
// Tombol aksi sekarang ada di sidebar-navbar, tetap ambil dengan getElementById
const saveBtn = document.getElementById("save-invoice");
const viewBtn = document.getElementById("view-invoice");
const printBtn = document.getElementById("print-invoice");
const bookkeepingBtn = document.getElementById("bookkeeping");
const expenseBtn = document.getElementById("expense-btn");
const statisticBtn = document.getElementById("statistic-btn");
const utangPiutangBtn = document.getElementById("utang-piutang-btn");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const closeModal = document.getElementById("close-modal");
const mockupInput = document.getElementById("mockup");
const mockupPreview = document.getElementById("mockup-preview");
const invoiceDateInput = document.getElementById("invoice-date");
const invoiceNumberInput = document.getElementById("invoice-number");
const paidFullBtn = document.getElementById("paid-full-btn");

// Tambahan: order-name select & input
const orderNameSelect = document.getElementById("order-name-select");
const orderNameInput = document.getElementById("order-name");

// Sinkronisasi dropdown dan input manual Nama Pesanan
if (orderNameSelect && orderNameInput) {
  orderNameSelect.addEventListener("change", function () {
    if (this.value === "LAINNYA") {
      orderNameInput.style.display = "inline-block";
      orderNameInput.value = "";
      orderNameInput.focus();
    } else if (this.value) {
      orderNameInput.style.display = "none";
      orderNameInput.value = this.value;
    } else {
      orderNameInput.style.display = "none";
      orderNameInput.value = "";
    }
    setAutoInvoiceNumber();
  });
  orderNameInput.addEventListener("input", setAutoInvoiceNumber);
}

// === Firebase Setup untuk Realtime Database (v11.6.1 modular) ===
const firebaseConfig = {
  apiKey: "AIzaSyAzFqzNJXd9f_kAQGEFvU3uuI9m_ySZh9o",
  authDomain: "invoicenew-37e56.firebaseapp.com",
  databaseURL:
    "https://invoicenew-37e56-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "invoicenew-37e56",
  storageBucket: "invoicenew-37e56.firebasestorage.app",
  messagingSenderId: "944057744116",
  appId: "1:944057744116:web:d3a20564e75cc2c925fca1",
};
// Inisialisasi Firebase App
const app = firebase.initializeApp(firebaseConfig);
// Inisialisasi Database
const db = firebase.database();

// --- FIREBASE CRUD HELPERS ---
async function getAllInvoices() {
  const snap = await db.ref("invoices").once("value");
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}
async function getInvoiceByNumber(invoiceNumber) {
  const snap = await db.ref("invoices/" + invoiceNumber).once("value");
  return snap.val();
}
async function saveInvoiceToFirebase(data) {
  try {
    await db.ref("invoices/" + data.invoiceNumber).set(data);
    alert("Invoice berhasil disimpan ke Firebase Realtime Database!");
  } catch (e) {
    alert("Gagal simpan ke Firebase: " + e.message);
  }
}
async function deleteInvoiceFromFirebase(invoiceNumber) {
  await db.ref("invoices/" + invoiceNumber).remove();
}

async function getAllExpenses() {
  const snap = await db.ref("expenses").once("value");
  const val = snap.val();
  if (!val) return [];
  return Object.values(val);
}
async function saveExpenseToFirebase(data, expenseKey) {
  if (expenseKey) {
    // Update existing expense
    await db.ref("expenses/" + expenseKey).set(data);
  } else {
    // Use push for unique key
    const ref = db.ref("expenses").push();
    await ref.set(data);
  }
}
async function deleteExpenseFromFirebase(expenseKey) {
  await db.ref("expenses/" + expenseKey).remove();
}

// --- INVOICE NUMBER GENERATION (now from Firebase) ---
async function generateInvoiceNumber() {
  const date = invoiceDateInput.value;
  if (!date) return "";
  const [yyyy, mm, dd] = date.split("-");
  const base = `INV-${dd}${mm}${yyyy}`;
  const invoices = await getAllInvoices();
  let nums = invoices
    .filter((inv) => inv.invoiceNumber && inv.invoiceNumber.startsWith(base))
    .map((inv) => {
      const m = inv.invoiceNumber.match(/-(\d{3})$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  let next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${base}-${String(next).padStart(3, "0")}`;
}
async function setAutoInvoiceNumber() {
  if (!invoiceDateInput.value) return;
  if (
    !invoiceNumberInput.value ||
    invoiceNumberInput.value.startsWith("INV-")
  ) {
    invoiceNumberInput.value = await generateInvoiceNumber();
  }
}
invoiceDateInput.addEventListener("change", setAutoInvoiceNumber);
invoiceDateInput.addEventListener("blur", setAutoInvoiceNumber);
document
  .getElementById("customer-name")
  .addEventListener("input", setAutoInvoiceNumber);
// Ganti event pada order-name-input dan order-name-select
if (orderNameSelect) {
  orderNameSelect.addEventListener("change", setAutoInvoiceNumber);
}
if (orderNameInput) {
  orderNameInput.addEventListener("input", setAutoInvoiceNumber);
}

// Mockup image upload and preview
let mockupDataUrl = "";

// Tambahkan tombol hapus mockup
let removeMockupBtn = document.createElement("button");
removeMockupBtn.type = "button";
removeMockupBtn.id = "remove-mockup-btn";
removeMockupBtn.textContent = "Hapus Gambar";
removeMockupBtn.style = "margin-left:8px;display:none;background:#e74c3c;color:#fff;padding:4px 10px;border-radius:5px;border:none;cursor:pointer;font-size:0.95em;";

// Sisipkan tombol setelah mockupPreview
if (mockupPreview && mockupPreview.parentNode) {
  mockupPreview.parentNode.insertBefore(removeMockupBtn, mockupPreview.nextSibling);
}

mockupInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) {
    mockupPreview.style.display = "none";
    mockupDataUrl = "";
    removeMockupBtn.style.display = "none";
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    mockupDataUrl = evt.target.result; // <-- DataURL (Base64)
    mockupPreview.src = mockupDataUrl;
    mockupPreview.style.display = "block";
    removeMockupBtn.style.display = "inline-block";
  };
  reader.readAsDataURL(file);
});

// Tombol hapus gambar mockup
removeMockupBtn.onclick = function () {
  mockupPreview.style.display = "none";
  mockupPreview.src = "";
  mockupInput.value = "";
  mockupDataUrl = "";
  removeMockupBtn.style.display = "none";
};

// When loading invoice, show mockup preview if exists
function setMockupPreview(dataUrl) {
  if (dataUrl) {
    mockupPreview.src = dataUrl;
    mockupPreview.style.display = "block";
    mockupDataUrl = dataUrl;
    removeMockupBtn.style.display = "inline-block";
  } else {
    mockupPreview.style.display = "none";
    mockupPreview.src = "";
    mockupDataUrl = "";
    removeMockupBtn.style.display = "none";
  }
}

// Add item row
function addItem(item) {
  const tr = createItemRow(item);
  orderItems.appendChild(tr);
  updateTotals();
  tr.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", updateTotals);
  });
  tr.querySelector(".remove-item").onclick = () => {
    tr.remove();
    updateTotals();
  };
  enableItemNameAutocomplete(tr);
}
addItemBtn.onclick = () => addItem();

// Update header tabel invoice (tambahkan kolom Satuan)
document.addEventListener("DOMContentLoaded", function () {
  const orderTableHead = document.querySelector("#order-table thead tr");
  if (orderTableHead && orderTableHead.children.length === 6) {
    // Tambah kolom Satuan setelah Qty
    const satuanTh = document.createElement("th");
    satuanTh.textContent = "Satuan";
    orderTableHead.insertBefore(satuanTh, orderTableHead.children[3]);
  }
  // Update tfoot colspan
  const tfootRow = document.querySelector("#order-table tfoot tr");
  if (tfootRow && tfootRow.children.length === 6) {
    tfootRow.children[0].setAttribute("colspan", "3");
  }
});

function parseNumberInput(val) {
  // Hilangkan semua karakter selain digit dan koma/desimal
  val = (val || "").toString().replace(/[^\d,]/g, "");
  // Ganti koma dengan titik jika ada
  val = val.replace(",", ".");
  return Number(val) || 0;
}

// Update totals
function updateTotals() {
  let qtySum = 0,
    priceSum = 0;
  orderItems.querySelectorAll("tr").forEach((tr) => {
    const qty = Number(tr.querySelector(".item-qty").value) || 0;
    const price = Number(tr.querySelector(".item-price").value) || 0;
    const total = qty * price;
    tr.querySelector(".item-total").textContent = formatNumber(total);
    qtySum += qty;
    priceSum += total;
  });
  totalQty.textContent = qtySum;
  totalPrice.textContent = formatNumber(priceSum);

  // Payment calculation
  const paid = parseNumberInput(paidAmount.value);
  const disc = Number(discount.value) || 0;
  const unpaid = Math.max(priceSum - disc - paid, 0);
  const change = Math.max(paid + disc - priceSum, 0);
  unpaidAmount.textContent = formatNumber(unpaid);
  changeAmount.textContent = formatNumber(change);
}
orderItems.addEventListener("input", updateTotals);
paidAmount.addEventListener("input", updateTotals);
discount.addEventListener("input", updateTotals);

if (paidFullBtn) {
  paidFullBtn.onclick = function () {
    // Ambil total harga dan diskon
    const total =
      Number(
        totalPrice.textContent
          .toString()
          .replace(/[^\d,]/g, "")
          .replace(",", ".")
      ) || 0;
    const disc = Number(discount.value) || 0;
    const toPay = Math.max(total - disc, 0);
    paidAmount.value = toPay;
    updateTotals();
    paidAmount.focus();
  };
}

// Collect invoice data
function collectInvoiceData() {
  const invoiceDate = document.getElementById("invoice-date").value;
  const invoiceNumber = document.getElementById("invoice-number").value;
  const customerName = document.getElementById("customer-name").value;
  // Ambil nama pesanan dari select atau input manual
  let orderName = "";
  if (orderNameSelect && orderNameInput) {
    if (orderNameSelect.value === "LAINNYA") {
      orderName = orderNameInput.value;
    } else {
      orderName = orderNameSelect.value;
    }
  } else {
    orderName = document.getElementById("order-name").value;
  }
  const dateline = document.getElementById("dateline").value;
  const discountVal = Number(discount.value) || 0;
  const paidVal = parseNumberInput(paidAmount.value);
  const items = Array.from(orderItems.querySelectorAll("tr"))
    .map((tr) => ({
      name: tr.querySelector(".item-name").value,
      size: tr.querySelector(".item-size").value,
      qty: Number(tr.querySelector(".item-qty").value) || 0,
      unit: tr.querySelector(".item-unit").value,
      price: Number(tr.querySelector(".item-price").value) || 0,
    }))
    .filter((i) => i.name);
  let totalQty = 0,
    totalPrice = 0;
  items.forEach((item) => {
    totalQty += item.qty;
    totalPrice += item.qty * item.price;
  });
  const unpaid = Math.max(totalPrice - discountVal - paidVal, 0);
  const change = Math.max(paidVal + discountVal - totalPrice, 0);

  return {
    invoiceDate,
    invoiceNumber,
    customerName,
    orderName,
    dateline,
    items,
    totalQty,
    totalPrice,
    paidAmount: paidVal,
    discount: discountVal,
    unpaidAmount: unpaid,
    changeAmount: change,
    businessName: document.querySelector(".business-name")
      ? document.querySelector(".business-name").innerHTML
      : "",
    logo: document.querySelector(".logo")
      ? document.querySelector(".logo").src
      : "",
    mockup: mockupDataUrl || "",
  };
}

// Fill invoice data
function fillInvoiceData(data) {
  document.getElementById("invoice-date").value =
    data.invoiceDate || data.date || "";
  document.getElementById("invoice-number").value = data.invoiceNumber || "";
  document.getElementById("customer-name").value = data.customerName || "";
  // Sinkronisasi ke dropdown dan input manual
  if (orderNameSelect && orderNameInput) {
    let found = false;
    for (let i = 0; i < orderNameSelect.options.length; i++) {
      if (orderNameSelect.options[i].value === data.orderName) {
        orderNameSelect.selectedIndex = i;
        orderNameInput.style.display = "none";
        orderNameInput.value = data.orderName;
        found = true;
        break;
      }
    }
    if (!found) {
      orderNameSelect.value = "LAINNYA";
      orderNameInput.style.display = "inline-block";
      orderNameInput.value = data.orderName || "";
    }
  } else {
    document.getElementById("order-name").value = data.orderName || "";
  }
  document.getElementById("dateline").value = data.dateline || "";
  orderItems.innerHTML = "";
  (data.items || []).forEach((item) => addItem(item));
  document.getElementById("discount").value = data.discount || 0;
  document.getElementById("paid-amount").value =
    data.paidAmount || data.amountPaid || 0;
  document.querySelector(".business-name").innerHTML = `KANVAS MERCHANDISE
        <div class="business-address">
            Jl.Riau Barat No.21 Kec. Sananwetan Kota Blitar<br>
            Telp. 082257423324
        </div>`;
  document.querySelector(".logo").src = "https://i.imgur.com/75tlt7m.png";
  setMockupPreview(data.mockup);
  updateTotals();
}

// --- SAVE INVOICE (Firebase only) ---
saveBtn.onclick = async function () {
  const data = collectInvoiceData();
  if (!data.invoiceDate) {
    alert("Tanggal nota harus diisi!");
    return;
  }
  if (!data.invoiceNumber) {
    alert("Nomor nota harus diisi!");
    return;
  }
  await saveInvoiceToFirebase(data);
};

// Tambahkan fungsi untuk mengunduh invoice sebagai JPG menggunakan html2canvas
async function downloadInvoiceAsJPG() {
  if (typeof html2canvas === "undefined") {
    return alert(
      "html2canvas library is not loaded. Please include it in your project."
    );
  }
  const invoiceView = document.querySelector(".invoice-view");
  if (!invoiceView) return alert("Invoice tidak ditemukan!");

  // Tambahkan class 'no-capture' pada tombol download
  const controls = document.getElementById("invoice-preview-controls");
  let downloadBtn;
  if (controls) {
    downloadBtn = controls.querySelector("#download-invoice-jpg");
    if (downloadBtn) downloadBtn.classList.add("no-capture");
  }

  // Clone the invoiceView for rendering
  const clone = invoiceView.cloneNode(true);
  clone.id = "";
  // Copy computed styles from modal preview
  const modalContent = document.querySelector("#modal .modal-content");
  if (modalContent) {
    const modalStyle = getComputedStyle(modalContent);
    clone.style.background = modalStyle.background;
    clone.style.backgroundColor = modalStyle.backgroundColor;
    clone.style.color = modalStyle.color;
    clone.style.fontFamily = modalStyle.fontFamily;
    clone.style.fontSize = modalStyle.fontSize;
    clone.style.borderRadius = modalStyle.borderRadius;
    clone.style.boxShadow = modalStyle.boxShadow;
    clone.style.padding = modalStyle.padding;
  }
  clone.style.width = `${invoiceView.offsetWidth}px`;
  clone.style.margin = "0 auto";
  clone.style.position = "static";

  // Copy all computed styles recursively for all children
  function copyAllStyles(src, dest) {
    const srcStyle = getComputedStyle(src);
    for (let prop of srcStyle) {
      dest.style[prop] = srcStyle.getPropertyValue(prop);
    }
    Array.from(src.children).forEach((srcChild, i) => {
      if (dest.children[i]) copyAllStyles(srcChild, dest.children[i]);
    });
  }
  copyAllStyles(invoiceView, clone);

  // Ensure all images in the clone have crossOrigin set to 'anonymous'
  const imgs = clone.querySelectorAll("img");
  imgs.forEach((img) => {
    img.crossOrigin = "anonymous";
  });

  // Create a container off-screen for rendering
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.appendChild(clone);
  document.body.appendChild(container);

  // Wait for images to load in the clone
  await Promise.all(
    Array.from(imgs).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((res) => {
        img.onload = img.onerror = () => res();
      });
    })
  );

  // Wait briefly to stabilize layout
  await new Promise((r) => setTimeout(r, 100));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: getComputedStyle(clone).backgroundColor || "#fff",
      logging: false,
      windowWidth: clone.offsetWidth,
      windowHeight: clone.offsetHeight,
      ignoreElements: (el) =>
        el.classList && el.classList.contains("no-capture"),
    });

    if (controls && downloadBtn) downloadBtn.classList.remove("no-capture");
    document.body.removeChild(container);

    const link = document.createElement("a");
    link.download = "Invoice.jpg";
    link.href = canvas.toDataURL("image/jpeg", 1.0);
    link.click();
  } catch (error) {
    if (controls && downloadBtn) downloadBtn.classList.remove("no-capture");
    document.body.removeChild(container);
    alert("Gagal mengunduh gambar invoice: " + error.message);
  }
}

// Fungsi untuk share invoice ke WhatsApp
async function shareToWhatsApp() {
  try {
    // Ambil elemen invoice preview (readonly) di modal
    const invoiceView = document.querySelector(".invoice-view");
    if (!invoiceView) {
      alert("Invoice tidak ditemukan!");
      return;
    }

    // Clone node agar tidak mengganggu tampilan asli
    const clone = invoiceView.cloneNode(true);
    clone.style.background = "#fff";
    clone.style.color = "#111";
    clone.style.width = `${invoiceView.offsetWidth}px`;
    clone.style.margin = "0 auto";
    clone.style.position = "static";

    // Copy computed styles (opsional, jika ingin hasil lebih konsisten)
    function copyAllStyles(src, dest) {
      const srcStyle = getComputedStyle(src);
      for (let prop of srcStyle) {
        dest.style[prop] = srcStyle.getPropertyValue(prop);
      }
      Array.from(src.children).forEach((srcChild, i) => {
        if (dest.children[i]) copyAllStyles(srcChild, dest.children[i]);
      });
    }
    copyAllStyles(invoiceView, clone);

    // Pastikan semua gambar crossOrigin
    const imgs = clone.querySelectorAll("img");
    imgs.forEach((img) => {
      img.crossOrigin = "anonymous";
    });

    // Render di container off-screen
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.zIndex = "-1";
    container.appendChild(clone);
    document.body.appendChild(container);

    // Tunggu gambar selesai load
    await Promise.all(
      Array.from(imgs).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((res) => {
          img.onload = img.onerror = () => res();
        });
      })
    );
    await new Promise((r) => setTimeout(r, 100));

    // Ambil gambar dengan html2canvas
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fff",
      logging: false,
      windowWidth: clone.offsetWidth,
      windowHeight: clone.offsetHeight,
      ignoreElements: (el) =>
        el.classList && el.classList.contains("no-capture"),
    });

    document.body.removeChild(container);

    // Konversi ke blob
    canvas.toBlob(
      async function (blob) {
        try {
          const file = new File([blob], "invoice.jpg", { type: "image/jpeg" });
          // Info invoice
          const invNo = document.querySelector(".invoice-view .invoice-info b")
            ? document
                .querySelector(".invoice-view .invoice-info b")
                .parentElement.textContent.replace("Nomor Nota:", "")
                .trim()
            : "";
          const customer = document.querySelector(
            ".invoice-view .invoice-view-header2-left"
          )
            ? document
                .querySelector(".invoice-view .invoice-view-header2-left")
                .textContent.replace(/Pelanggan:/, "")
                .trim()
                .split("\n")[0]
            : "";
          const total = document.querySelector(
            ".invoice-view tfoot tr td:last-child"
          )
            ? document.querySelector(".invoice-view tfoot tr td:last-child")
                .textContent
            : "";

          // Web Share API (mobile)
          if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({ files: [file] })
          ) {
            await navigator.share({
              files: [file],
              title: "Invoice Pembayaran",
              text: `Invoice: ${invNo}\nPelanggan: ${customer}\nTotal: Rp ${total}`,
            });
          } else {
            // Fallback: WhatsApp Web dengan link gambar (base64)
            const url = canvas.toDataURL("image/jpeg");
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
              `Invoice Pembayaran\nNo. Invoice: ${invNo}\nPelanggan: ${customer}\nTotal: Rp ${total}\nLihat Invoice: ${url}`
            )}`;
            window.open(whatsappUrl, "_blank");
          }
        } catch (error) {
          alert(
            "Gagal membuka WhatsApp. Pastikan aplikasi WhatsApp terinstall."
          );
        }
      },
      "image/jpeg",
      0.9
    );
  } catch (error) {
    alert("Gagal membuat gambar invoice. Silakan coba lagi.");
  }
}

// View invoice (readonly)
viewBtn.onclick = function () {
  const data = collectInvoiceData();
  // Tambahkan tombol share WhatsApp di atas invoice
  const controlsHtml = `
    <div id="invoice-preview-controls" style="
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 14px;
      padding: 8px 0;
      border-radius: 8px;
      align-items: center;
      transition: box-shadow 0.2s;
    ">
      <button id="download-invoice-jpg" style="
        background: #007bff;
        color: #fff;
        padding: 8px 18px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 1.15em;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 7px;
        box-shadow: 0 1px 6px 0 rgba(0,123,255,0.10);
        transition: background 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.background='#0056b3';this.style.boxShadow='0 2px 12px 0 rgba(0,123,255,0.18)';" onmouseout="this.style.background='#007bff';this.style.boxShadow='0 1px 6px 0 rgba(0,123,255,0.10)';">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#fff" d="M12 16a1 1 0 0 1-1-1V5a1 1 0 1 1 2 0v10a1 1 0 0 1-1 1Zm-5.707-3.707a1 1 0 0 1 1.414 0L12 15.586l4.293-4.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414Z"/><rect width="20" height="20" x="2" y="2" stroke="#fff" stroke-width="0" rx="4"/></svg>
        <span>Download JPG</span>
      </button>
      <button id="share-wa" style="
        background: #25D366;
        color: #fff;
        padding: 8px 18px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 1.15em;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 7px;
        box-shadow: 0 1px 6px 0 rgba(37,211,102,0.10);
        transition: background 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.background='#128c7e';this.style.boxShadow='0 2px 12px 0 rgba(37,211,102,0.18)';" onmouseout="this.style.background='#25D366';this.style.boxShadow='0 1px 6px 0 rgba(37,211,102,0.10)';">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path fill="#fff" d="M12 2a10 10 0 0 0-8.94 14.47l-1.05 3.85a1 1 0 0 0 1.23 1.23l3.85-1.05A10 10 0 1 0 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm4.07-5.75c-.22-.11-1.29-.64-1.49-.71-.2-.07-.34-.11-.48.11-.14.22-.55.71-.67.85-.12.14-.25.16-.47.05-.22-.11-.93-.34-1.77-1.09-.66-.59-1.11-1.31-1.24-1.53-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.36.07-.14.04-.27-.02-.38-.06-.11-.48-1.16-.66-1.59-.17-.41-.34-.35-.47-.36-.12-.01-.27-.01-.42-.01a.81.81 0 0 0-.59.27c-.2.22-.77.75-.77 1.83 0 1.08.79 2.13.9 2.28.11.15 1.56 2.38 3.79 3.23.53.18.94.29 1.26.37.53.13 1.01.11 1.39.07.43-.05 1.29-.53 1.47-1.04.18-.51.18-.95.13-1.04-.05-.09-.2-.14-.42-.25Z"/></svg>
        <span>Share WhatsApp</span>
      </button>
    </div>
    <style>
      #invoice-preview-controls button:active {
        transform: scale(0.97);
        box-shadow: 0 1px 12px 0 rgba(0,0,0,0.13);
      }
      #invoice-preview-controls button:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      #invoice-preview-controls button:hover span {
        text-decoration: underline;
      }
    </style>
  `;
  showModal("", controlsHtml + renderInvoiceView(data));
  // Sembunyikan tombol "Hapus Nota Tersimpan" jika ada
  const deleteBtn = document.getElementById("delete-saved-invoice");
  if (deleteBtn) deleteBtn.style.display = "none";
  // Event tombol download
  document.getElementById("download-invoice-jpg").onclick =
    downloadInvoiceAsJPG;
  // Event tombol share WhatsApp
  document.getElementById("share-wa").onclick = shareToWhatsApp;
};

printBtn.onclick = function () {
  const data = collectInvoiceData();

  // Render struk HTML (50mm width, font kecil, layout sederhana)
  function renderStruk(data) {
    // Helper: format tanggal dd/mm/yyyy
    function formatDate(d) {
      if (!d) return "-";
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    }
    // Nama toko & alamat
    const businessName = (data.businessName || "KANVAS MERCHANDISE").replace(
      /\n/g,
      "<br>"
    );
    const address =
      "Jl.Riau Barat No.21 Kec. Sananwetan Kota Blitar<br><span style='font-size:9px;'>Telp. 082257423324</span>";
    let showAddress = true;
    if (
      businessName.includes("Jl.Riau Barat No.21") ||
      businessName.includes("082257423324")
    ) {
      showAddress = false;
    }
    // Group items by name, but keep order and allow same name with different price/qty
    let groupedRows = [];
    (data.items || []).forEach((item) => {
      if (!item.name) return;
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const subtotal = qty * price;
      groupedRows.push({
        name: item.name,
        qty,
        price,
        subtotal,
      });
    });

    // Font angka gepeng: gunakan 'Arial Narrow', 'Roboto Condensed', 'Oswald', monospace
    const numberFont = "'Arial Narrow', 'Roboto Condensed', 'Oswald', Arial, monospace";
    // CSS untuk angka lebih gepeng (font-stretch)
    const numberFontStyle = "font-family:" + numberFont + ";font-stretch:condensed;font-variation-settings:'wdth' 75;letter-spacing:0.01em;";

    // Font size besar untuk angka penting
    const bigNumberFontStyle = numberFontStyle + "font-size:1.25em;";

    // Prepare rows for printing: only show name if different from previous row
    let htmlRows = "";
    let prevName = null;
    let total = 0,
      totalQty = 0;
    groupedRows.forEach((row) => {
      total += row.subtotal;
      totalQty += row.qty;
      htmlRows += `
        <tr>
          <td style="text-align:left;word-break:break-word;padding:2px 0 2px 0;">${row.name !== prevName ? row.name : ""}</td>
          <td style="text-align:right;padding:2px 0;${numberFontStyle}">${row.qty}</td>
          <td style="text-align:right;padding:2px 0;${numberFontStyle}">${formatNumber(row.price)}</td>
          <td style="text-align:right;padding:2px 0;${numberFontStyle}">${formatNumber(row.subtotal)}</td>
        </tr>
      `;
      prevName = row.name;
    });

    let html = `
      <div style="
        width:45mm;
        max-width:100vw;
        font-family:'Segoe UI', Arial, sans-serif;
        font-size:12px;
        line-height:1.35;
        background:#fff;
        color:#222;
        padding:0;
        margin:0;
        text-transform:uppercase;
      ">
        <div style="text-align:center;margin-bottom:2px;">
          <img src="https://i.imgur.com/75tlt7m.png" alt="Logo" style="width:32px;height:44px;display:block;margin:0 auto 2px auto;" crossOrigin="anonymous" />
        </div>
        <div style="text-align:center;font-weight:700;font-size:10.5px;margin-bottom:1px;letter-spacing:0.5px;">${businessName}</div>
        ${
          showAddress
            ? `<div style="text-align:center;margin-bottom:3px;font-size:8.5px;line-height:1.2;">${address}</div>`
            : ""
        }
        <div style="border-top:1.2px dashed #222;margin:3px 0 5px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:9.5px;">
          <span>Tgl: <span style="${numberFontStyle}">${formatDate(data.invoiceDate)}</span></span>
          <span>No: <span style="${numberFontStyle}font-size:9.5px;">${data.invoiceNumber}</span></span>
        </div>
        <div style="font-size:9.5px;">Pelanggan: <b>${data.customerName || "-"}</b></div>
        <div style="font-size:9.5px;">Pesanan: <b>${data.orderName || "-"}</b></div>
        <div style="border-top:1.2px dashed #222;margin:4px 0 5px 0;"></div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead>
            <tr>
              <th style="text-align:left;padding-bottom:1px;">Barang</th>
              <th style="text-align:right;padding-bottom:1px;">Qty</th>
              <th style="text-align:right;padding-bottom:1px;">Harga</th>
              <th style="text-align:right;padding-bottom:1px;">Jml</th>
            </tr>
          </thead>
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
        <div style="border-top:1.2px dashed #222;margin:5px 0 5px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Total Qty:</span>
          <span style="${bigNumberFontStyle}"><b>${totalQty}</b></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Total:</span>
          <span style="${bigNumberFontStyle}"><b>${formatNumber(total)}</b></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Diskon:</span>
          <span style="${numberFontStyle}">${formatNumber(data.discount || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Terbayar:</span>
          <span style="${bigNumberFontStyle}">${formatNumber(data.paidAmount || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Belum Lunas:</span>
          <span style="${bigNumberFontStyle}">${formatNumber(data.unpaidAmount || 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span>Kembalian:</span>
          <span style="${numberFontStyle}">${formatNumber(data.changeAmount || 0)}</span>
        </div>
        <div style="border-top:1.2px dashed #222;margin:6px 0 0 0;"></div>
        <div style="text-align:center;font-size:9.5px;margin-top:4px;line-height:1.2;font-weight:500;">
          Terima kasih<br>
          Semoga Berkah dan Manfaat
        </div>
      </div>
      <style>
        @import url('https://fonts.googleapis.com/css?family=Roboto+Condensed:400,700&display=swap');
        @import url('https://fonts.googleapis.com/css?family=Oswald:400,700&display=swap');
      </style>
    `;
    return html;
  }

  // Open print window
  const win = window.open("", "", "width=400,height=600");
  const html = `
        <html>
            <head>
                <title>Print Struk</title>
                <style>
                    @media print {
                        body { margin:0; background:#fff; }
                        .struk-print { width:50mm !important; max-width:100vw; }
                        table { font-size:10px; }  
                        th, td { padding:0; }
                    }
                </style>
            </head>
            <body>
                <div class="struk-print">
                    ${renderStruk(data)}
                </div>
            </body>
        </html>
    `;
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
};

// Render invoice view (readonly)
function renderInvoiceView(data) {
  const paidAmount = Number(data.paidAmount) || 0;
  const discount = Number(data.discount) || 0;
  const unpaidAmount = Number(data.unpaidAmount) || 0;
  const changeAmount = Number(data.changeAmount) || 0;

  // --- Watermark LUNAS jika sudah lunas ---
  let watermarkHtml = "";
  if (unpaidAmount <= 0 && paidAmount > 0) {
    let pelunasanDate = data.invoiceDate || "";
    watermarkHtml = `
      <div class="lunas-watermark" style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-7deg);
        z-index: 10;
        pointer-events: none;
        opacity: 0.13;
        font-family: 'Arial Narrow', Arial, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          width: 220px;
          height: 220px;
          border-radius: 50%;
          border: 7px solid #e74c3c;
          background: rgba(255,255,255,0.12);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 24px 0 rgba(231,76,60,0.09);
        ">
          <div style="
            color: #e74c3c;
            font-size: 2.7em;
            font-weight: bold;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: none;
            border: none;
            border-radius: 50%;
            padding: 0;
            margin-bottom: 8px;
            box-shadow: none;
            text-align: center;
          ">LUNAS</div>
          <div style="
            color: #e74c3c;
            font-size: 1em;
            font-weight: 600;
            background: none;
            border-radius: 8px;
            padding: 2px 12px;
            border: 1px solid #e74c3c;
            opacity: 0.7;
            margin-top: 2px;
            text-align: center;
          ">${pelunasanDate}</div>
        </div>
      </div>
    `;
  }

  // --- Group items by name for merging ---
  let grouped = {};
  (data.items || []).forEach((item) => {
    if (!item.name) return;
    if (!grouped[item.name]) grouped[item.name] = [];
    grouped[item.name].push(item);
  });

  let rows = "";
  let totalQty = 0;
  let totalPrice = 0;
  Object.keys(grouped).forEach((name) => {
    const items = grouped[name];
    items.forEach((item, idx) => {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const subtotal = qty * price;
      totalQty += qty;
      totalPrice += subtotal;
      rows += `<tr>`;
      // Merge cell for name (rowspan)
      if (idx === 0) {
        rows += `<td rowspan="${items.length}" style="text-align:left;vertical-align:middle;">${name}</td>`;
      }
      // Kolom lain tetap per item
      rows += `
                <td>${item.size || "-"}</td>
                <td>${qty}</td>
                <td>${item.unit || "-"}</td>
                <td style="text-align:right;">${formatNumber(price)}</td>
                <td style="text-align:right;">${formatNumber(subtotal)}</td>
            </tr>`;
    });
  });

  const mockupHtml = data.mockup
    ? `<img src="${data.mockup}" class="mockup-large" alt="Mockup" />`
    : "";

  // Note transfer bank & keterangan (HTML 2 kolom rapi)
  const noteHtml = `
    <div style="

    margin-top: 18px;
    padding: 8px 10px;
    border: 0.2px dashed #888;
    border-radius: 0.2px;
    background: #f9f9f9;
    font-size: 60%;
    max-width: 100%;
    display: flex;
    gap: 34px;
    flex-wrap: wrap;
    justify-content: space-between;
    text-transform: math-auto;
    font-style: italic;

    ">
      <div style="min-width:220px;flex:1;">
        <b>Transfer Bank:</b><br>
        BRI: 350701030785536 a/n Okky Maulana M<br>
        BCA: 0901702593 a/n Okky Maulana M
      </div>
      <div style="min-width:260px;flex:2;">
        <b>Keterangan:</b>
        <ul style="margin:6px 0 0 18px;padding:0 0 0 0.5em;">
          <li>Batas konfirmasi DP 1x24 jam setelah tagihan dikirim.</li>
          <li>Lewat dari 1x24 jam, maka dateline produksi dihitung setelah konfirmasi DP.</li>
          <li>Pastikan sudah mengecek detail pesanan, kelalaian pelanggan bukan tanggung jawab kami.</li>
          <li>Anda bisa melacak proses pesanan di <a href="https://lacakorderku.netlify.app/" target="_blank">https://lacakorderku.netlify.app/</a> dengan memasukkan no. invoice ini (khusus pesanan kaos sablon manual di atas 30pcs).</li>
        </ul>
      </div>
    </div>
  `;

  return `
    <div class="invoice-container invoice-view" style="max-width:900px;width:95vw;min-width:0;margin:24px auto;position:relative;">
        ${watermarkHtml}
        <div class="header" style="flex-wrap:nowrap;align-items:flex-start;">
            <div class="logo-section">
                <img src="https://i.imgur.com/75tlt7m.png" class="logo" style="border:none;box-shadow:none;" crossOrigin="anonymous" onerror="this.style.display='block';" />
                <span class="business-name">
                    ${data.businessName}
                    
                </span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;min-width:220px;">
                <div class="invoice-info" style="text-align:right;margin-bottom:0;">
                    <div><b>Tanggal Nota:</b> ${data.invoiceDate}</div>
                    <div><b>Nomor Nota:</b> ${data.invoiceNumber}</div>
                </div>
            </div>
        </div>
        <h1 style="margin:0 0 0 0;font-size:1.35em;">INVOICE</h1>
        <div class="header2 invoice-view-header2-flex">
            <div class="invoice-view-header2-left">
                <div><b>Pelanggan:</b> ${data.customerName || "-"}</div>
                <div><b>Pesanan:</b> ${data.orderName || "-"}</div>
                <div><b>Dateline:</b> ${data.dateline || "-"}</div>
            </div>
            ${
              mockupHtml
                ? `<div class="invoice-view-header2-right">${mockupHtml}</div>`
                : ""
            }
        </div>
        <table style="margin-bottom:12px;">
            <thead>
                <tr>
                    <th style="width:22%;">Nama Barang</th>
                    <th style="width:13%;">Size</th>
                    <th style="width:10%;">Qty</th>
                    <th style="width:10%;">Satuan</th>
                    <th style="width:18%;">Harga Satuan</th>
                    <th style="width:18%;">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="border:none;"></td>
                    <td style="font-weight:bold;">${totalQty}</td>
                    <td style="font-weight:bold;">Total</td>
                    <td style="font-weight:bold;text-align:right;">${formatNumber(
                      totalPrice
                    )}</td>
                </tr>
            </tfoot>
        </table>
        <div class="payment-section" style="padding:10px 18px;margin-bottom:0;">
            <div><b>Terbayar:</b> ${formatNumber(paidAmount)}</div>
            <div><b>Diskon:</b> ${formatNumber(discount)}</div>
            <div><b>Belum Terbayar:</b> ${formatNumber(unpaidAmount)}</div>
            <div><b>Kembalian:</b> ${formatNumber(changeAmount)}</div>
        </div>
        ${noteHtml}
    </div>
    `;
}

// --------- PENGELUARAN (EXPENSE) ---------
expenseBtn.onclick = function () {
  showExpenseForm();
};

function showExpenseForm(expenseData = null, expenseKey = null) {
  const html = `
        <form id="expense-form" ${
          expenseKey ? `data-expense-key="${expenseKey}"` : ""
        } style="font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;letter-spacing:0.08em;color:#e67e22;">TANGGAL:</label>
                <input type="date" id="expense-date" required value="${new Date()
                  .toISOString()
                  .slice(0, 10)}" style="text-transform:uppercase;font-weight:bold;padding:6px 12px;border-radius:6px;border:1px solid #e67e22;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;letter-spacing:0.08em;color:#e67e22;">JENIS PENGELUARAN:</label>
                <select id="expense-type" required style="text-transform:uppercase;font-weight:bold;padding:6px 12px;border-radius:6px;border:1px solid #e67e22;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
                    <option value="">--PILIH--</option>
                    <option value="Bahan Kain">BAHAN KAIN</option>
                    <option value="Bahan Sablon">BAHAN SABLON</option>
                    <option value="Cetak">CETAK</option>
                    <option value="Ongkos Jahit">ONGKOS JAHIT</option>
                    <option value="Kebutuhan Toko">KEBUTUHAN TOKO</option>
                    <option value="Gaji">GAJI</option>
                    <option value="Iuran Wajib">IURAN WAJIB</option>
                    <option value="Lain-lain">LAIN-LAIN (ISI MANUAL)</option>
                </select>
                <input type="text" id="expense-type-manual" placeholder="ISI JENIS LAIN-LAIN" style="display:none;margin-top:4px;text-transform:uppercase;font-weight:bold;padding:6px 12px;border-radius:6px;border:1px solid #e67e22;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;letter-spacing:0.08em;color:#e67e22;">NAMA SUPPLIER:</label>
                <input type="text" id="expense-supplier" required style="text-transform:uppercase;font-weight:bold;padding:6px 12px;border-radius:6px;border:1px solid #e67e22;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;letter-spacing:0.08em;color:#e67e22;">RINCIAN PEMBELIAN:</label>
                <table id="expense-items-table" style="width:100%;margin-bottom:8px;border-radius:8px;box-shadow:0 2px 12px 0 rgba(230,126,34,0.08);overflow:hidden;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
                    <thead style="background:#e67e22;">
                        <tr style="color:#fff;text-transform:uppercase;font-weight:bold;letter-spacing:0.07em;">
                            <th>NAMA BARANG</th>
                            <th>QTY</th>
                            <th>SATUAN</th>
                            <th>HARGA SATUAN</th>
                            <th>DISKON</th>
                            <th>JUMLAH</th>
                            <th>HAPUS</th>
                        </tr>
                    </thead>
                    <tbody id="expense-items-body">
                        <!-- Baris barang pengeluaran -->
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="7" style="text-align:center;">
                              <button type="button" id="add-expense-item" style="background:#e67e22;color:#fff;font-weight:bold;padding:7px 18px;border-radius:6px;border:none;cursor:pointer;text-transform:uppercase;box-shadow:0 1px 6px 0 rgba(230,126,34,0.10);font-family:'Exo', 'Segoe UI', Arial, sans-serif;">TAMBAH BARANG</button>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;letter-spacing:0.08em;color:#e67e22;">TOTAL PENGELUARAN (RP):</label>
                <input type="number" id="expense-amount" required min="0" readonly style="background:#f8fafc;text-transform:uppercase;font-weight:bold;padding:6px 12px;border-radius:6px;border:1px solid #e67e22;color:#e67e22;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">
            </div>
            <button type="submit" style="margin-top:8px;background:#e67e22;color:#fff;font-weight:bold;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;text-transform:uppercase;box-shadow:0 2px 12px 0 rgba(230,126,34,0.13);font-size:1.08em;letter-spacing:0.08em;font-family:'Exo', 'Segoe UI', Arial, sans-serif;">SIMPAN PENGELUARAN</button>
        </form>
        <style>
          @import url('https://fonts.googleapis.com/css?family=Exo:400,700&display=swap');
          #expense-items-table th, #expense-items-table td {
            font-size:1em;
            text-transform:uppercase;
            padding:8px 6px;
            border-bottom:1px solid #f3f3f3;
            font-family:'Exo', 'Segoe UI', Arial, sans-serif;
          }
          #expense-items-table th {
            background:#e67e22;
            color:#fff;
            font-weight:bold;
            font-family:'Exo', 'Segoe UI', Arial, sans-serif;
          }
          #expense-items-table tr:last-child td {
            border-bottom:none;
          }
          #expense-items-table input, #expense-items-table select {
            text-transform:uppercase;
            font-weight:bold;
            padding:4px 8px;
            border-radius:5px;
            border:1px solid #e67e22;
            font-family:'Exo', 'Segoe UI', Arial, sans-serif;
          }
        </style>
    `;
  // Tambahkan judul dengan box dan rata tengah, huruf kapital semua
  const titleBox = `
    <div style="
      text-align:center;
      background:#e67e22;
      color:#fff;
      font-weight:bold;
      font-size:1.25em;
      letter-spacing:0.08em;
      padding:14px 0 12px 0;
      border-radius:8px;
      margin-bottom:18px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
    ">
      PENGELUARAN TOKO
    </div>
  `;
  showModal("", titleBox + html);

  // Show/hide manual input for "Lain-lain"
  const expenseType = document.getElementById("expense-type");
  const expenseTypeManual = document.getElementById("expense-type-manual");
  expenseType.addEventListener("change", function () {
    if (this.value === "Lain-lain") {
      expenseTypeManual.style.display = "inline-block";
      expenseTypeManual.required = true;
    } else {
      expenseTypeManual.style.display = "none";
      expenseTypeManual.required = false;
      expenseTypeManual.value = "";
    }
  });

  // --- Barang pengeluaran: tabel dinamis ---
  function createExpenseItemRow(item = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="expense-item-name" value="${
          item.name || ""
        }" required></td>
        <td><input type="number" class="expense-item-qty" value="${
          item.qty || 1
        }" min="0" step="any" required style="width:60px;"></td>
        <td>
          <select class="expense-item-unit" style="width:70px;">
            ${satuanList
              .map(
              (s) =>
                `<option value="${s}"${
                item.unit === s ? " selected" : ""
                }>${s}</option>`
              )
              .join("")}
          </select>
        </td>
        <td><input type="number" class="expense-item-price" value="${
          item.price || 0
        }" min="0" step="any" required style="width:90px;"></td>
        <td><input type="number" class="expense-item-discount" value="${
          item.discount || 0
        }" min="0" step="any" style="width:70px;" title="Diskon per barang"></td>
        <td class="expense-item-total">0</td>
        <td>
          <button type="button" class="remove-expense-item" title="Hapus" style="background:none;border:none;cursor:pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
            <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
            <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
            <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
            <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
            <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
          </svg>
          </button>
        </td>
      `;
    return tr;
  }
  const expenseItemsBody = document.getElementById("expense-items-body");
  function addExpenseItemRow(item) {
    const tr = createExpenseItemRow(item);
    expenseItemsBody.appendChild(tr);
    updateExpenseItemsTotal();
    tr.querySelectorAll("input, select").forEach((input) => {
      input.addEventListener("input", updateExpenseItemsTotal);
    });
    tr.querySelector(".remove-expense-item").onclick = () => {
      tr.remove();
      updateExpenseItemsTotal();
    };
  }
  document.getElementById("add-expense-item").onclick = () =>
    addExpenseItemRow();

  // Minimal 1 baris default
  addExpenseItemRow();

  function updateExpenseItemsTotal() {
    let total = 0;
    expenseItemsBody.querySelectorAll("tr").forEach((tr) => {
      const qty = Number(tr.querySelector(".expense-item-qty").value) || 0;
      const price = Number(tr.querySelector(".expense-item-price").value) || 0;
      const discount = Number(tr.querySelector(".expense-item-discount")?.value) || 0;
      const subtotal = Math.max(qty * price - discount, 0);
      tr.querySelector(".expense-item-total").textContent =
        formatNumber(subtotal);
      total += subtotal;
    });
    document.getElementById("expense-amount").value = total;
  }

  // Jika edit, isi data
  if (expenseData) {
    document.getElementById("expense-date").value = expenseData.date || "";
    document.getElementById("expense-supplier").value =
      expenseData.supplier || "";
    // Jenis
    let found = false;
    for (let i = 0; i < expenseType.options.length; i++) {
      if (expenseType.options[i].value === expenseData.type) {
        expenseType.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      expenseType.value = "Lain-lain";
      expenseTypeManual.style.display = "inline-block";
      expenseTypeManual.value = expenseData.type;
    } else {
      expenseTypeManual.style.display = "none";
      expenseTypeManual.value = "";
    }
    // Items
    expenseItemsBody.innerHTML = "";
    (expenseData.items || []).forEach((item) => addExpenseItemRow(item));
    // Total
    let total = 0;
    expenseItemsBody.querySelectorAll("tr").forEach((tr2) => {
      const qty = Number(tr2.querySelector(".expense-item-qty").value) || 0;
      const price = Number(tr2.querySelector(".expense-item-price").value) || 0;
      const discount = Number(tr2.querySelector(".expense-item-discount")?.value) || 0;
      const subtotal = Math.max(qty * price - discount, 0);
      tr2.querySelector(".expense-item-total").textContent =
        formatNumber(subtotal);
      total += subtotal;
    });
    document.getElementById("expense-amount").value = total;
  }

  document.getElementById("expense-form").onsubmit = saveExpense;
}

// Simpan pengeluaran: rincian barang berupa array
async function saveExpense(e) {
  e.preventDefault();
  const date = document.getElementById("expense-date").value;
  let type = document.getElementById("expense-type").value;
  const typeManual = document
    .getElementById("expense-type-manual")
    .value.trim();
  if (type === "Lain-lain" && typeManual) type = typeManual;
  const supplier = document.getElementById("expense-supplier").value.trim();

  // Ambil array barang
  const items = Array.from(document.querySelectorAll("#expense-items-body tr"))
    .map((tr) => ({
      name: tr.querySelector(".expense-item-name").value,
      qty: Number(tr.querySelector(".expense-item-qty").value),
      unit: tr.querySelector(".expense-item-unit").value,
      price: Number(tr.querySelector(".expense-item-price").value),
      discount: Number(tr.querySelector(".expense-item-discount")?.value) || 0,
    }))
    .filter((i) => i.name && i.qty && i.price >= 0);

  if (!date) {
    alert("Tanggal pengeluaran harus diisi!");
    return;
  }
  if (!type || !supplier || !items.length)
    return alert("Lengkapi semua data dan minimal 1 barang!");

  // Total = SUM(qty*price - discount) per item
  const amount = items.reduce((sum, i) => sum + Math.max(i.qty * i.price - (i.discount || 0), 0), 0);

  // Ambil expenseKey jika ada (edit mode)
  const form = document.getElementById("expense-form");
  const expenseKey = form.getAttribute("data-expense-key") || null;

  await saveExpenseToFirebase(
    { date, type, supplier, items, amount },
    expenseKey
  );

  // Jika edit, tutup modal setelah update
  if (expenseKey) {
    closeModalFunc();
    renderExpenseList();
    return;
  }

  document.getElementById("expense-form").reset();
  // Reset tabel barang
  expenseItemsBody.innerHTML = "";
  // Tambah baris default
  addExpenseItemRow();
  document.getElementById("expense-date").value = new Date()
    .toISOString()
    .slice(0, 10);
  document.getElementById("expense-type-manual").style.display = "none";
}

// Tampilkan daftar pengeluaran: rincian barang sebagai tabel
async function renderExpenseList() {
  let expenses = await getAllExpenses();
  if (!expenses.length) {
    document.getElementById("expense-list-section").innerHTML =
      "<i>Belum ada pengeluaran tercatat.</i>";
    return;
  }
  let total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  let html = `
        <h3>Daftar Pengeluaran</h3>
        <table style="width:100%;font-size:1em;">
            <thead>
                <tr>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Supplier</th>
                    <th>Rincian Pembelian</th>
                    <th>Jumlah</th>
                    <th>Jenis</th>
                    <th>Hapus</th>
                </tr>
            </thead>
            <tbody>
                ${expenses
                  .map(
                    (e, i) => `
                    <tr>
                        <td>${e.date}</td>
                        <td>${e.type || "-"}</td>
                        <td>${e.supplier || "-"}</td>
                        <td>
                            <table style="width:100%;background:#f8fafc;border-radius:4px;">
                                <thead>
                                    <tr>
                                        <th style="font-size:0.95em;">Nama Barang</th>
                                        <th style="font-size:0.95em;">Qty</th>
                                        <th style="font-size:0.95em;">Satuan</th>
                                        <th style="font-size:0.95em;">Harga Satuan</th>
                                        <th style="font-size:0.95em;">Diskon</th>
                                        <th style="font-size:0.95em;">Jumlah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(e.items || [])
                                      .map(
                                        (item) => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>${item.qty}</td>
                                            <td>${item.unit || "-"}</td>
                                            <td style="text-align:right;">${formatNumber(
                                              item.price
                                            )}</td>
                                            <td style="text-align:right;">${formatNumber(
                                              item.discount || 0
                                            )}</td>
                                            <td style="text-align:right;">${formatNumber(
                                              Math.max(
                                                (item.qty || 0) * (item.price || 0) -
                                                  (item.discount || 0),
                                                0
                                              )
                                            )}</td>
                                        </tr>
                                    `
                                      )
                                      .join("")}
                                </tbody>
                            </table>
                        </td>
                        <td style="text-align:right;">${formatNumber(
                          e.amount
                        )}</td>
                        <td>${e.type || "-"}</td>
                        <td>
                          <button class="delete-expense" data-idx="${i}" title="Hapus" style="background:none;border:none;cursor:pointer;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
                              <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
                              <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
                              <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
                              <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
                              <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
                            </svg>
                          </button>
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3" style="font-weight:bold;">Total</td>
                    <td style="font-weight:bold;text-align:right;">${formatNumber(
                      total
                    )}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
    `;
  document.getElementById("expense-list-section").innerHTML = html;
  document.querySelectorAll(".delete-expense").forEach((btn, idx) => {
    btn.onclick = async function () {
      if (confirm("Hapus pengeluaran ini?")) {
        // Find key by re-fetching all expenses
        const snap = await db.ref("expenses").once("value");
        const val = snap.val();
        const keys = Object.keys(val || {});
        await deleteExpenseFromFirebase(keys[idx]);
        renderExpenseList();
      }
    };
  });
}

// --- BOOKKEEPING, STATISTICS, UTANG PIUTANG, SEARCH ---
bookkeepingBtn.onclick = async function () {
  let invoices = (await getAllInvoices()).map(normalizeInvoice);
  let snap = await db.ref("expenses").once("value");
  let val = snap.val();
  let expenses = [];
  let expenseKeys = [];
  if (val) {
    expenseKeys = Object.keys(val);
    expenses = Object.values(val).map((e, i) => ({
      ...e,
      _key: expenseKeys[i],
    }));
  }
  expenses = expenses.map(normalizeExpense);

  // --- Filter by year and month ---
  let allMonths = [
    ...invoices.map((inv) => (inv.invoiceDate || "").slice(0, 7)),
    ...expenses.map((exp) => (exp.date || "").slice(0, 7)),
  ].filter(Boolean);
  let uniqueMonths = Array.from(new Set(allMonths)).sort().reverse();

  let defaultMonth = new Date().toISOString().slice(0, 7);
  if (!uniqueMonths.includes(defaultMonth) && uniqueMonths.length)
    defaultMonth = uniqueMonths[0];

  // Fungsi untuk menghitung saldo akhir bulan sebelumnya
  function getPreviousMonthSaldo(selectedMonth) {
    if (!selectedMonth) return 0;
    // Ambil semua transaksi sebelum bulan terpilih
    let prevInvoices = invoices.filter(
      (inv) => (inv.invoiceDate || "").slice(0, 7) < selectedMonth
    );
    let prevExpenses = expenses.filter(
      (exp) => (exp.date || "").slice(0, 7) < selectedMonth
    );
    let saldo = 0;
    prevInvoices.forEach((inv) => {
      saldo += Number(inv.paidAmount) || 0;
    });
    prevExpenses.forEach((exp) => {
      saldo -= Number(exp.amount) || 0;
    });
    return saldo;
  }

  // Fungsi render ulang tabel sesuai filter
  async function renderBookkeepingTable(
    selectedMonth,
    highlightRef = null,
    highlightType = null
  ) {
    // Filter data
    let filteredInvoices = selectedMonth
      ? invoices.filter(
          (inv) => (inv.invoiceDate || "").slice(0, 7) === selectedMonth
        )
      : invoices;
    let filteredExpenses = selectedMonth
      ? expenses.filter((exp) => (exp.date || "").slice(0, 7) === selectedMonth)
      : expenses;

    // Gabungkan transaksi
    let transactions = [];
    filteredInvoices.forEach((inv) => {
      transactions.push({
        date: inv.invoiceDate,
        type: "INVOICE",
        subjek: inv.customerName || "-",
        keterangan: inv.orderName || "-",
        income: inv.paidAmount || 0,
        expense: 0,
        ref: inv.invoiceNumber,
        raw: inv,
      });
    });
    filteredExpenses.forEach((exp) => {
      const expenseCategory = exp.expenseCategory || exp.type || "-";
      transactions.push({
        date: exp.date,
        type: "EXPENSE",
        subjek: exp.supplier || "-",
        keterangan: expenseCategory,
        income: 0,
        expense: exp.amount || 0,
        ref: exp._key || exp,
        raw: exp,
      });
    });
    // Sort transaksi berdasarkan tanggal dan waktu (jika ada)
    transactions = transactions
      .filter((t) => t.date)
      .sort((a, b) => {
        // Sort by date, then by type (INVOICE before EXPENSE if same date)
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        if (a.type === b.type) return 0;
        return a.type === "INVOICE" ? -1 : 1;
      });

    // Hitung saldo awal dari bulan sebelumnya
    let saldoAwal = getPreviousMonthSaldo(selectedMonth);

    // Hitung saldo berjalan secara realtime dan aktual
    let saldo = saldoAwal;
    let saldoArr = [];
    transactions.forEach((t, idx) => {
      saldo += (Number(t.income) || 0) - (Number(t.expense) || 0);
      saldoArr[idx] = saldo;
    });

    let rows = transactions
      .map((t, idx) => {
        let deleteBtn = "";
        if (t.type === "INVOICE") {
            deleteBtn = `<button class="delete-bk-invoice" data-ref="${t.ref}" title="Hapus Invoice" style="background:none;border:none;cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
              <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
              <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
              <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
            </svg>
            </button>`;
        } else if (t.type === "EXPENSE") {
            deleteBtn = `<button class="delete-bk-expense" data-key="${t.ref}" title="Hapus Pengeluaran" style="background:none;border:none;cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
              <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
              <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
              <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
              <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
            </svg>
            </button>`;
        }
        // Highlight baris jika ref/type sesuai
        let highlightClass = "";
        if (
          highlightRef &&
          highlightType &&
          t.ref == highlightRef &&
          t.type == highlightType
        ) {
          highlightClass = "bk-row-highlight";
        }
        return `<tr class="bk-row ${highlightClass}" data-type="${
          t.type
        }" data-idx="${idx}" data-ref="${t.ref}" style="cursor:pointer;">
                <td>${t.date}</td>
                <td>${t.subjek}</td>
                <td>${t.type === "EXPENSE" ? t.keterangan : t.keterangan}</td>
                <td style="text-align:right;">${
                  t.income ? formatNumber(t.income) : ""
                }</td>
                <td style="text-align:right;">${
                  t.expense ? formatNumber(t.expense) : ""
                }</td>
                <td style="text-align:right;">${formatNumber(saldoArr[idx])}</td>
                <td>${deleteBtn}</td>
            </tr>`;
      })
      .join("");

    let totalIncome = transactions.reduce((sum, t) => sum + (Number(t.income) || 0), 0);
    let totalExpense = transactions.reduce(
      (sum, t) => sum + (Number(t.expense) || 0),
      0
    );
    let saldoAkhir = saldoArr.length ? saldoArr[saldoArr.length - 1] : saldoAwal;

    // --- Next/Prev Button Logic ---
    let currentIdx = uniqueMonths.indexOf(selectedMonth || "");
    let prevMonth =
      currentIdx < uniqueMonths.length - 1
        ? uniqueMonths[currentIdx + 1]
        : null;
    let nextMonth = currentIdx > 0 ? uniqueMonths[currentIdx - 1] : null;

    let navHtml = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <button id="bk-prev-month" ${
                  !prevMonth ? "disabled" : ""
                } style="padding:4px 12px;">&lt; Prev</button>
                <span style="font-weight:bold;">${
                  selectedMonth || "Semua Bulan"
                }</span>
                <button id="bk-next-month" ${
                  !nextMonth ? "disabled" : ""
                } style="padding:4px 12px;">Next &gt;</button>
            </div>
        `;

    // Filter select
    let filterHtml = `
            <div style="margin-bottom:12px;">
                <label for="bookkeeping-month">Pilih Bulan:</label>
                <select id="bookkeeping-month">
                    <option value="">Semua</option>
                    ${uniqueMonths
                      .map(
                        (m) =>
                          `<option value="${m}"${
                            m === selectedMonth ? " selected" : ""
                          }>${m}</option>`
                      )
                      .join("")}
                </select>
            </div>
        `;

    let html = `
            ${navHtml}
            ${filterHtml}
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="border-bottom:0.2px solid #111;">Tanggal</th>
                        <th style="border-bottom:0.2px solid #111;">Subjek</th>
                        <th style="border-bottom:0.2px solid #111;">Keterangan</th>
                        <th style="border-bottom:0.2px solid #111;">Masuk</th>
                        <th style="border-bottom:0.2px solid #111;">Keluar</th>
                        <th style="border-bottom:0.2px solid #111;">Saldo</th>
                        <th style="border-bottom:0.2px solid #111;">Hapus</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      selectedMonth
                        ? `<tr style="background:#f7f7f7;font-weight:bold;">
                            <td colspan="5" style="text-align:right;">Saldo Awal</td>
                            <td style="text-align:right;">${formatNumber(saldoAwal)}</td>
                            <td></td>
                          </tr>`
                        : ""
                    }
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="font-weight:bold;">Total</td>
                        <td style="font-weight:bold;text-align:right;">${formatNumber(
                          totalIncome
                        )}</td>
                        <td style="font-weight:bold;text-align:right;">${formatNumber(
                          totalExpense
                        )}</td>
                        <td style="font-weight:bold;text-align:right;">${formatNumber(
                          saldoAkhir
                        )}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:10px;padding:10px 0 0 0;border-top:1px solid #bbb;">
                <b>Omset:</b> ${formatNumber(totalIncome)} &nbsp; | &nbsp;
                <b>Profit:</b> ${formatNumber(
                  totalIncome - totalExpense
                )} &nbsp; | &nbsp;
                <b>Saldo Akhir:</b> ${formatNumber(saldoAkhir)}
            </div>
        `;
    // Tambahkan judul dengan box dan rata tengah, huruf kapital semua
    const titleBox = `
      <div style="
      text-align:center;
      background:#007bff;
      color:#fff;
      font-weight:bold;
      font-size:1.25em;
      letter-spacing:0.08em;
      padding:14px 0 12px 0;
      border-radius:8px;
      margin-bottom:18px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
      ">
      PEMBUKUAN
      </div>
    `;
    showModal("", titleBox + html);

    // Event filter bulan
    document.getElementById("bookkeeping-month").onchange = function () {
      renderBookkeepingTable(this.value);
    };

    // Event tombol prev/next
    document.getElementById("bk-prev-month").onclick = function () {
      if (prevMonth) renderBookkeepingTable(prevMonth);
    };
    document.getElementById("bk-next-month").onclick = function () {
      if (nextMonth) renderBookkeepingTable(nextMonth);
    };

    // Event hapus invoice
    document.querySelectorAll(".delete-bk-invoice").forEach((btn) => {
      btn.onclick = async function () {
        if (confirm("Hapus invoice ini?")) {
          await deleteInvoiceFromFirebase(btn.dataset.ref);
          // Fetch ulang data setelah hapus
          invoices = (await getAllInvoices()).map(normalizeInvoice);
          renderBookkeepingTable(
            document.getElementById("bookkeeping-month").value
          );
        }
      };
    });
    // Event hapus expense
    document.querySelectorAll(".delete-bk-expense").forEach((btn) => {
      btn.onclick = async function () {
        if (confirm("Hapus pengeluaran ini?")) {
          await deleteExpenseFromFirebase(btn.dataset.key);
          // Fetch ulang data setelah hapus
          let snap = await db.ref("expenses").once("value");
          let val = snap.val();
          let expenseKeys = [];
          let newExpenses = [];
          if (val) {
            expenseKeys = Object.keys(val);
            newExpenses = Object.values(val).map((e, i) => ({
              ...e,
              _key: expenseKeys[i],
            }));
          }
          expenses = newExpenses.map(normalizeExpense);
          renderBookkeepingTable(
            document.getElementById("bookkeeping-month").value
          );
        }
      };
    });

    // === Event klik baris untuk edit ===
    document.querySelectorAll(".bk-row").forEach((tr) => {
      tr.addEventListener("click", async function (e) {
        // Jangan trigger jika klik tombol hapus
        if (e.target.closest("button")) return;
        const idx = Number(tr.dataset.idx);
        const t = transactions[idx];
        closeModalFunc();
        // Simpan info bulan & ref/type untuk kembali ke posisi setelah edit
        let currentMonth = document.getElementById("bookkeeping-month")
          ? document.getElementById("bookkeeping-month").value
          : selectedMonth;
        let lastEditedRef = t.ref;
        let lastEditedType = t.type;
        if (t.type === "INVOICE") {
          // Edit invoice: isi form utama
          const inv = await getInvoiceByNumber(t.ref);
          if (inv) {
            fillInvoiceData(inv);
            window.scrollTo({ top: 0, behavior: "smooth" });
            const container = document.querySelector(".invoice-container");
            if (container) {
              container.style.boxShadow = "0 0 0 4px #007bff";
              setTimeout(() => {
                container.style.boxShadow = "";
              }, 1200);
            }
            // Override tombol save agar setelah save kembali ke bookkeeping
            const origSave = saveBtn.onclick;
            saveBtn.onclick = async function () {
              const data = collectInvoiceData();
              if (!data.invoiceNumber) {
                alert("Nomor nota harus diisi!");
                return;
              }
              // Jika nomor nota diubah, hapus invoice lama sebelum simpan baru
              if (data.invoiceNumber !== inv.invoiceNumber) {
                await deleteInvoiceFromFirebase(inv.invoiceNumber);
              }
              await saveInvoiceToFirebase(data);
              // Setelah save, fetch ulang data dan kembali ke bookkeeping dan highlight baris
              saveBtn.onclick = origSave; // restore
              // Fetch ulang data
              invoices = (await getAllInvoices()).map(normalizeInvoice);
              let snap = await db.ref("expenses").once("value");
              let val = snap.val();
              let expenseKeys = [];
              let newExpenses = [];
              if (val) {
                expenseKeys = Object.keys(val);
                newExpenses = Object.values(val).map((e, i) => ({
                  ...e,
                  _key: expenseKeys[i],
                }));
              }
              expenses = newExpenses.map(normalizeExpense);
              bookkeepingBtn.click();
              setTimeout(() => {
                renderBookkeepingTable(
                  currentMonth,
                  data.invoiceNumber,
                  "INVOICE"
                );
                setTimeout(() => {
                  const row = document.querySelector(".bk-row-highlight");
                  if (row) {
                    row.scrollIntoView({ behavior: "smooth", block: "center" });
                    row.style.transition = "background 0.8s";
                    row.style.background = "#ffe066";
                    setTimeout(() => {
                      row.style.background = "";
                    }, 1200);
                  }
                }, 400);
              }, 400);
            };
          }
        } else if (t.type === "EXPENSE") {
          // Edit pengeluaran: tampilkan form pengeluaran dan isi datanya
          showExpenseForm(t.raw, t.ref);
          setTimeout(() => {
            const form = document.getElementById("expense-form");
            if (form) {
              const origSubmit = form.onsubmit;
              form.onsubmit = async function (e2) {
                e2.preventDefault();
                const date = document.getElementById("expense-date").value;
                let type = document.getElementById("expense-type").value;
                const typeManual = document
                  .getElementById("expense-type-manual")
                  .value.trim();
                if (type === "Lain-lain" && typeManual) type = typeManual;
                const supplier = document
                  .getElementById("expense-supplier")
                  .value.trim();
                const items = Array.from(
                  document.querySelectorAll("#expense-items-body tr")
                )
                  .map((tr2) => ({
                    name: tr2.querySelector(".expense-item-name").value,
                    qty: Number(tr2.querySelector(".expense-item-qty").value),
                    unit: tr2.querySelector(".expense-item-unit").value,
                    price: Number(tr2.querySelector(".expense-item-price").value),
                    discount: Number(tr2.querySelector(".expense-item-discount")?.value) || 0,
                  }))
                  .filter((i) => i.name && i.qty && i.price >= 0);
                if (!date || !type || !supplier || !items.length)
                  return alert("Lengkapi semua data dan minimal 1 barang!");
                const amount = items.reduce(
                  (sum, i) => sum + Math.max(i.qty * i.price - (i.discount || 0), 0),
                  0
                );
                const expenseKey =
                  form.getAttribute("data-expense-key") || null;
                await saveExpenseToFirebase(
                  { date, type, supplier, items, amount },
                  expenseKey
                );
                closeModalFunc();
                form.onsubmit = origSubmit; // restore
                // Fetch ulang data
                invoices = (await getAllInvoices()).map(normalizeInvoice);
                let snap = await db.ref("expenses").once("value");
                let val = snap.val();
                let expenseKeys = [];
                let newExpenses = [];
                if (val) {
                  expenseKeys = Object.keys(val);
                  newExpenses = Object.values(val).map((e, i) => ({
                    ...e,
                    _key: expenseKeys[i],
                  }));
                }
                expenses = newExpenses.map(normalizeExpense);
                // Setelah save, kembali ke bookkeeping dan highlight baris
                bookkeepingBtn.click();
                setTimeout(() => {
                  renderBookkeepingTable(currentMonth, expenseKey, "EXPENSE");
                  setTimeout(() => {
                    const row = document.querySelector(".bk-row-highlight");
                    if (row) {
                      row.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      row.style.transition = "background 0.8s";
                      row.style.background = "#ffe066";
                      setTimeout(() => {
                        row.style.background = "";
                      }, 1200);
                    }
                  }, 400);
                }, 400);
              };
            }
            const modal = document.getElementById("modal");
            if (modal) {
              modal.querySelector(".modal-content").style.boxShadow =
                "0 0 0 4px #007bff";
              setTimeout(() => {
                modal.querySelector(".modal-content").style.boxShadow = "";
              }, 1200);
            }
          }, 200);
        }
      });
    });
    // Highlight baris jika perlu (saat kembali dari edit)
    if (highlightRef && highlightType) {
      setTimeout(() => {
        const row = document.querySelector(".bk-row-highlight");
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.style.transition = "background 0.8s";
          row.style.background = "#ffe066";
          setTimeout(() => {
            row.style.background = "";
          }, 1200);
        }
      }, 400);
    }
  }

  renderBookkeepingTable(defaultMonth);

  // Tambahkan style highlight
  (function addBkRowHighlightStyle() {
    if (document.getElementById("bk-row-highlight-style")) return;
    const style = document.createElement("style");
    style.id = "bk-row-highlight-style";
    style.innerHTML = `
        .bk-row-highlight {
            background: #ffe066 !important;
            transition: background 0.8s;
        }
        `;
    document.head.appendChild(style);
  })();
};

// === STATISTIK KEUANGAN ===
statisticBtn.onclick = async function () {
  let invoices = (await getAllInvoices()).map(normalizeInvoice);
  let expenses = (await getAllExpenses()).map(normalizeExpense);
  let chart;

  // Gabungkan semua tanggal dari invoice dan expense
  let allDates = [
    ...invoices.map((inv) => inv.invoiceDate),
    ...expenses.map((exp) => exp.date),
  ].filter(Boolean);

  function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  let allYears = Array.from(new Set(allDates.map((d) => (d || "").slice(0, 4))))
    .filter(Boolean)
    .sort()
    .reverse();
  let currentYear = new Date().getFullYear().toString();
  if (!allYears.includes(currentYear) && allYears.length)
    currentYear = allYears[0];

  function getMonthsForYear(year) {
    return Array.from(
      new Set(
        allDates
          .filter((d) => d && d.startsWith(year))
          .map((d) => d.slice(0, 7))
      )
    )
      .sort()
      .reverse();
  }
  let months = getMonthsForYear(currentYear);
  let currentMonth = new Date().toISOString().slice(0, 7);
  if (!months.includes(currentMonth) && months.length) currentMonth = months[0];

  // Tambahkan style modern, clean, dan menarik
  (function addStatistikStyle() {
    if (document.getElementById("statistik-style")) return;
    const style = document.createElement("style");
    style.id = "statistik-style";
    style.innerHTML = `
      .statistic-modal {
        background: linear-gradient(135deg,#f8fafc 0%,#e3e8ee 100%);
        border-radius: 16px;
        box-shadow: 0 8px 32px 0 rgba(0,0,0,0.10);
        padding: 32px 24px 24px 24px !important;
        max-width: 900px;
        min-width: 320px;
        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
      }
      #statistic-chart {
        background: #fff;
        border-radius: 12px;
        margin-bottom: 24px;
        box-shadow: 0 2px 12px 0 rgba(0,0,0,0.06);
        border: 1px solid #e5e7eb;
      }
      #stat-summary {
        background: linear-gradient(90deg,#e0e7ff 0%,#f1f5f9 100%);
        border-radius: 10px;
        padding: 14px 18px;
        font-size: 1.13em;
        color: #222;
        margin-bottom: 22px;
        box-shadow: 0 1px 8px 0 rgba(0,0,0,0.03);
        letter-spacing: 0.01em;
        display: flex;
        gap: 24px;
        justify-content: center;
        align-items: center;
      }
      .stat-top-summary-flex {
        display: flex;
        flex-wrap: wrap;
        gap: 32px;
        justify-content: center;
        align-items: stretch;
        margin-top: 0;
        margin-bottom: 0;
        width: 100%;
      }
      .stat-top-summary-col {
        flex: 1 1 220px;
        min-width: 220px;
        max-width: 510px;
        display: flex;
        flex-direction: column;
        margin-bottom: 0;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 12px 0 rgba(0,0,0,0.07);
        padding: 16px 12px 12px 12px;
        border: 1px solid #e5e7eb;
        transition: box-shadow 0.2s;
      }
      .stat-top-summary-col:hover {
        box-shadow: 0 4px 24px 0 rgba(0,0,0,0.13);
      }
      .stat-top-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 0;
        background: transparent;
        border-radius: 0.2px;
        overflow: hidden;
      }
      .stat-top-table th, .stat-top-table td {
        padding: 8px 10px;
        font-size: 1em;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
      }
      .stat-top-table th {
        background: #f3f4f6;
        color: #222;
        font-weight: 600;
        border-bottom: 1px solid #e5e7eb;
      }
      .stat-top-table tr:last-child td {
        border-bottom: none;
      }
      .stat-top-table .stat-rank {
        font-weight: bold;
        font-size: 1.08em;
        color: #fff;
        background: linear-gradient(135deg,#6366f1 0%,#2563eb 100%);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 6px;
        box-shadow: 0 1px 4px 0 rgba(0,0,0,0.07);
      }
      .stat-top-table .stat-customer,
      .stat-top-table .stat-order,
      .stat-top-table .stat-item,
      .stat-top-table .stat-type,
      .stat-top-table .stat-supplier {
        color: #222;
        font-weight: 500;
      }
      .stat-top-table .stat-amount,
      .stat-top-table .stat-profit,
      .stat-top-table .stat-expense,
      .stat-top-table .stat-qty {
        color: #2563eb;
        font-weight: 700;
        text-align: right;
      }
      .statistic-filter-bar {
        display: flex;
        gap: 18px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 24px;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 1px 8px 0 rgba(0,0,0,0.04);
        padding: 14px 18px 12px 18px;
        justify-content: center;
      }
      .statistic-filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-right: 10px;
      }
      .statistic-filter-label {
        font-weight: 600;
        color: #2563eb;
        font-size: 1.08em;
        letter-spacing: 0.01em;
      }
      .statistic-filter-select {
        font-size: 1em;
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #f3f4f6;
        color: #222;
        font-weight: 500;
        transition: border 0.2s;
        outline: none;
      }
      .statistic-filter-select:focus {
        border: 1px solid #2563eb;
        background: #e0e7ff;
      }
      @media (max-width: 900px) {
        .statistic-modal { padding: 10px 2vw 10px 2vw !important; }
        .stat-top-table th, .stat-top-table td { padding: 6px 4px; font-size: 0.97em; }
        .statistic-filter-bar { flex-direction: column; gap: 8px; padding: 8px 2vw 6px 2vw; }
        .stat-top-summary-flex {
          flex-direction: column;
          gap: 18px;
        }
        .stat-top-summary-col {
          min-width: 0;
          max-width: 100%;
        }
      }
      @media (max-width: 600px) {
        .statistic-modal { padding: 2px 0 2px 0 !important; }
        .stat-top-table th, .stat-top-table td { padding: 4px 2px; font-size: 0.93em; }
        .stat-top-summary-flex { gap: 7px; }
      }
    `;
    document.head.appendChild(style);
  })();

  let html = `
    <div class="statistic-filter-bar">
      <div class="statistic-filter-group">
        <span class="statistic-filter-label">Tahun</span>
        <select id="stat-year" class="statistic-filter-select">
          ${allYears
            .map(
              (y) =>
                `<option value="${y}"${
                  y === currentYear ? " selected" : ""
                }>${y}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="statistic-filter-group">
        <span class="statistic-filter-label">Bulan</span>
        <select id="stat-month" class="statistic-filter-select">
          <option value="">Semua</option>
          ${getMonthsForYear(currentYear)
            .map(
              (m) =>
                `<option value="${m}"${
                  m === currentMonth ? " selected" : ""
                }>${m}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="statistic-filter-group">
        <span class="statistic-filter-label">Mode</span>
        <select id="stat-mode" class="statistic-filter-select">
          <option value="minggu">Per Minggu</option>
          <option value="bulan">Per Bulan</option>
          <option value="tahun">Per Tahun</option>
        </select>
      </div>
    </div>
    <div style="width:100%;max-width:900px;margin:0 auto;">
      <canvas id="statistic-chart" height="320"></canvas>
    </div>
    <div id="stat-summary" style="margin-top:14px;font-size:1.05em;"></div>
    <div id="stat-top-summary" style="margin-top:14px;font-size:1em;"></div>
  `;
  // Judul dengan gradient dan icon
  const titleBox = `
    <div style="
      text-align:center;
      background: linear-gradient(90deg,#6366f1 0%,#2563eb 100%);
      color:#fff;
      font-weight:bold;
      font-size:1.35em;
      letter-spacing:0.08em;
      padding:18px 0 16px 0;
      border-radius:16px;
      margin-bottom:24px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
      display:flex;
      align-items:center;
      justify-content:center;
      gap:14px;
    ">
      <span style="font-size:1.5em;">📊</span>
      Statistik Keuangan
    </div>
  `;
  showModal("", titleBox + html);

  setTimeout(() => {
    const modalContent = document.querySelector(".modal-content");
    if (modalContent) {
      modalContent.classList.add("statistic-modal");
    }
    setTimeout(() => {
      if (window.Chart && window.Chart.instances) {
        Object.values(window.Chart.instances).forEach((c) => {
          if (c && c.resize) c.resize();
        });
      }
    }, 150);
  }, 50);

  function renderTopSummary(year, month) {
    let filteredInvoices = invoices.filter(
      (inv) => inv.invoiceDate && inv.invoiceDate.startsWith(year)
    );
    let filteredExpenses = expenses.filter(
      (exp) => exp.date && exp.date.startsWith(year)
    );
    if (month) {
      filteredInvoices = filteredInvoices.filter((inv) =>
        inv.invoiceDate.startsWith(month)
      );
      filteredExpenses = filteredExpenses.filter((exp) =>
        exp.date.startsWith(month)
      );
    }

    // Top 3 Pembelian Terbanyak
    let topPembelian = filteredInvoices
      .map((inv) => ({
        customerName: inv.customerName || "-",
        orderName: inv.orderName || "-",
        paidAmount: inv.paidAmount || 0,
      }))
      .sort((a, b) => b.paidAmount - a.paidAmount)
      .slice(0, 3);

    // Top 3 Pelanggan Paling Sering Order
    let pelangganCount = {};
    filteredInvoices.forEach((inv) => {
      let name = inv.customerName || "-";
      pelangganCount[name] = (pelangganCount[name] || 0) + 1;
    });
    let topPelanggan = Object.entries(pelangganCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Top 3 Item Terlaris
    let itemQty = {};
    filteredInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        let name = item.name || "-";
        itemQty[name] = (itemQty[name] || 0) + (Number(item.qty) || 0);
      });
    });
    let topItems = Object.entries(itemQty)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    // Top 3 Pengeluaran Terbesar
    let topExpense = filteredExpenses
      .map((exp) => ({
        type: exp.type || "-",
        supplier: exp.supplier || "-",
        amount: exp.amount || 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    // Modern card style
    let html = `
      <div class="stat-top-summary-flex">
        <div class="stat-top-summary-col">
          <div style="font-weight:700;font-size:1.13em;margin-bottom:8px;color:#2563eb;display:flex;align-items:center;gap:7px;">
            <span style="font-size:1.2em;">💰</span> Top 3 Pembelian Terbanyak
          </div>
          <table class="stat-top-table">
            <thead>
              <tr>
                <th style="width:32px;">#</th>
                <th>Pelanggan</th>
                <th>Pesanan</th>
                <th class="stat-amount" style="text-align:right;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${
                topPembelian.length
                  ? topPembelian
                      .map(
                        (p, i) =>
                          `<tr>
                            <td><span class="stat-rank">${i + 1}</span></td>
                            <td class="stat-customer">${p.customerName}</td>
                            <td class="stat-order">${p.orderName}</td>
                            <td class="stat-amount" style="text-align:right;">Rp ${formatNumber(p.paidAmount)}</td>
                          </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4"><i>Tidak ada data</i></td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="stat-top-summary-col">
          <div style="font-weight:700;font-size:1.13em;margin-bottom:8px;color:#2563eb;display:flex;align-items:center;gap:7px;">
            <span style="font-size:1.2em;">👤</span> Top 3 Pelanggan Paling Sering Order
          </div>
          <table class="stat-top-table">
            <thead>
              <tr>
                <th style="width:32px;">#</th>
                <th>Pelanggan</th>
                <th class="stat-qty" style="text-align:right;">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${
                topPelanggan.length
                  ? topPelanggan
                      .map(
                        (p, i) =>
                          `<tr>
                            <td><span class="stat-rank">${i + 1}</span></td>
                            <td class="stat-customer">${p.name}</td>
                            <td class="stat-qty" style="text-align:right;">${p.count}x</td>
                          </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="3"><i>Tidak ada data</i></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
      <div class="stat-top-summary-flex" style="margin-top:18px;">
        <div class="stat-top-summary-col">
          <div style="font-weight:700;font-size:1.13em;margin-bottom:8px;color:#2563eb;display:flex;align-items:center;gap:7px;">
            <span style="font-size:1.2em;">📦</span> Top 3 Item Terlaris
          </div>
          <table class="stat-top-table">
            <thead>
              <tr>
                <th style="width:32px;">#</th>
                <th>Nama Barang</th>
                <th class="stat-qty" style="text-align:right;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${
                topItems.length
                  ? topItems
                      .map(
                        (i, idx) =>
                          `<tr>
                            <td><span class="stat-rank">${idx + 1}</span></td>
                            <td class="stat-item">${i.name}</td>
                            <td class="stat-qty" style="text-align:right;">${i.qty}</td>
                          </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="3"><i>Tidak ada data</i></td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="stat-top-summary-col">
          <div style="font-weight:700;font-size:1.13em;margin-bottom:8px;color:#2563eb;display:flex;align-items:center;gap:7px;">
            <span style="font-size:1.2em;">🧾</span> Top 3 Pengeluaran Terbesar
          </div>
          <table class="stat-top-table">
            <thead>
              <tr>
                <th style="width:32px;">#</th>
                <th>Jenis</th>
                <th>Supplier</th>
                <th class="stat-expense" style="text-align:right;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${
                topExpense.length
                  ? topExpense
                      .map(
                        (e, idx) =>
                          `<tr>
                            <td><span class="stat-rank">${idx + 1}</span></td>
                            <td class="stat-type">${e.type}</td>
                            <td class="stat-supplier">${e.supplier}</td>
                            <td class="stat-expense" style="text-align:right;">Rp ${formatNumber(e.amount)}</td>
                          </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4"><i>Tidak ada data</i></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById("stat-top-summary").innerHTML = html;
  }

  async function renderChart() {
    const year = document.getElementById("stat-year").value;
    const month = document.getElementById("stat-month").value;
    const mode = document.getElementById("stat-mode").value;

    let filteredInvoices = invoices.filter(
      (inv) => inv.invoiceDate && inv.invoiceDate.startsWith(year)
    );
    let filteredExpenses = expenses.filter(
      (exp) => exp.date && exp.date.startsWith(year)
    );

    if (month) {
      filteredInvoices = filteredInvoices.filter((inv) =>
        inv.invoiceDate.startsWith(month)
      );
      filteredExpenses = filteredExpenses.filter((exp) =>
        exp.date.startsWith(month)
      );
    }

    let labels = [];
    let incomeData = [];
    let expenseData = [];
    let profitData = [];

    if (mode === "minggu") {
      let weekMap = {};
      filteredInvoices.forEach((inv) => {
        if (!inv.invoiceDate) return;
        let week = getWeekNumber(inv.invoiceDate);
        let key = `${inv.invoiceDate.slice(0, 4)}-W${String(week).padStart(
          2,
          "0"
        )}`;
        weekMap[key] = weekMap[key] || { income: 0, expense: 0 };
        weekMap[key].income += inv.paidAmount || 0;
      });
      filteredExpenses.forEach((exp) => {
        if (!exp.date) return;
        let week = getWeekNumber(exp.date);
        let key = `${exp.date.slice(0, 4)}-W${String(week).padStart(2, "0")}`;
        weekMap[key] = weekMap[key] || { income: 0, expense: 0 };
        weekMap[key].expense += exp.amount || 0;
      });
      labels = Object.keys(weekMap).sort();
      incomeData = labels.map((l) => weekMap[l].income);
      expenseData = labels.map((l) => weekMap[l].expense);
      profitData = labels.map((l, i) => incomeData[i] - expenseData[i]);
    } else if (mode === "bulan") {
      let monthMap = {};
      filteredInvoices.forEach((inv) => {
        if (!inv.invoiceDate) return;
        let m = inv.invoiceDate.slice(0, 7);
        monthMap[m] = monthMap[m] || { income: 0, expense: 0 };
        monthMap[m].income += inv.paidAmount || 0;
      });
      filteredExpenses.forEach((exp) => {
        if (!exp.date) return;
        let m = exp.date.slice(0, 7);
        monthMap[m] = monthMap[m] || { income: 0, expense: 0 };
        monthMap[m].expense += exp.amount || 0;
      });
      labels = Object.keys(monthMap).sort();
      incomeData = labels.map((l) => monthMap[l].income);
      expenseData = labels.map((l) => monthMap[l].expense);
      profitData = labels.map((l, i) => incomeData[i] - expenseData[i]);
    } else if (mode === "tahun") {
      let yearMap = {};
      invoices.forEach((inv) => {
        if (!inv.invoiceDate) return;
        let y = inv.invoiceDate.slice(0, 4);
        yearMap[y] = yearMap[y] || { income: 0, expense: 0 };
        yearMap[y].income += inv.paidAmount || 0;
      });
      expenses.forEach((exp) => {
        if (!exp.date) return;
        let y = exp.date.slice(0, 4);
        yearMap[y] = yearMap[y] || { income: 0, expense: 0 };
        yearMap[y].expense += exp.amount || 0;
      });
      labels = Object.keys(yearMap).sort();
      incomeData = labels.map((l) => yearMap[l].income);
      expenseData = labels.map((l) => yearMap[l].expense);
      profitData = labels.map((l, i) => incomeData[i] - expenseData[i]);
    }

    if (chart) {
      chart.destroy();
    }
    const ctx = document.getElementById("statistic-chart").getContext("2d");
    if (typeof window.Chart === "undefined") {
      alert(
        "Chart.js library is not loaded. Please include it in your project."
      );
      return;
    }
    chart = new window.Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Pemasukan",
            data: incomeData,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#6366f1",
            borderWidth: 3,
          },
          {
            label: "Pengeluaran",
            data: expenseData,
            borderColor: "#f59e42",
            backgroundColor: "rgba(245,158,66,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#f59e42",
            borderWidth: 3,
          },
          {
            label: "Profit",
            data: profitData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.08)",
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: "#10b981",
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2.5,
        plugins: {
          legend: { position: "top", labels: { font: { size: 15 }, color: "#222" } },
          title: {
            display: true,
            text: "Statistik Keuangan",
            font: { size: 20, weight: "bold" },
            color: "#2563eb"
          },
          tooltip: {
            backgroundColor: "#fff",
            titleColor: "#2563eb",
            bodyColor: "#222",
            borderColor: "#6366f1",
            borderWidth: 1,
            callbacks: {
              label: function (context) {
                return (
                  context.dataset.label + ": " + formatNumber(context.parsed.y)
                );
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text:
                mode === "minggu"
                  ? "Minggu"
                  : mode === "bulan"
                  ? "Bulan"
                  : "Tahun",
              font: { size: 15, weight: "bold" },
              color: "#2563eb"
            },
            ticks: { font: { size: 13 }, color: "#222" },
            grid: { color: "#e5e7eb" }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Nominal (Rp)", font: { size: 15, weight: "bold" }, color: "#2563eb" },
            ticks: {
              font: { size: 13 },
              color: "#222",
              callback: function (value) {
                return formatNumber(value);
              },
            },
            grid: { color: "#e5e7eb" }
          },
        },
      },
    });

    let totalIncome = incomeData.reduce((a, b) => a + b, 0);
    let totalExpense = expenseData.reduce((a, b) => a + b, 0);
    let profit = totalIncome - totalExpense;
    document.getElementById("stat-summary").innerHTML = `
      <span><b style="color:#6366f1;">Total Pemasukan:</b> <span style="color:#222;">${formatNumber(totalIncome)}</span></span>
      <span><b style="color:#f59e42;">Total Pengeluaran:</b> <span style="color:#222;">${formatNumber(totalExpense)}</span></span>
      <span><b style="color:#10b981;">Profit:</b> <span style="color:#222;">${formatNumber(profit)}</span></span>
    `;

    renderTopSummary(year, month);
  }

  document.getElementById("stat-year").onchange = function () {
    let year = this.value;
    let monthSel = document.getElementById("stat-month");
    let months = getMonthsForYear(year);
    monthSel.innerHTML =
      `<option value="">Semua</option>` +
      months.map((m) => `<option value="${m}">${m}</option>`).join("");
    if (months.length > 0) {
      monthSel.value = months[0];
    } else {
      monthSel.value = "";
    }
    renderChart();
  };
  document.getElementById("stat-month").onchange = renderChart;
  document.getElementById("stat-mode").onchange = renderChart;
  renderChart();
};

// === UTANG PIUTANG ===
utangPiutangBtn.onclick = async function () {
  let invoices = (await getAllInvoices()).map(normalizeInvoice);

  // Filter invoice yang masih ada sisa belum terbayar
  let utangInvoices = invoices.filter((inv) => (inv.unpaidAmount || 0) > 0);

  // Sort by tanggal nota terbaru
  utangInvoices.sort((a, b) => (b.invoiceDate > a.invoiceDate ? 1 : -1));

  // Ringkasan total piutang
  let totalUnpaid = utangInvoices.reduce(
    (sum, inv) => sum + (inv.unpaidAmount || 0),
    0
  );

  let html = `
        
        <div style="margin-bottom:12px;">
            <b>Total Piutang:</b> <span style="color:#e74c3c;font-size:1.2em;">${formatNumber(
              totalUnpaid
            )}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Tanggal Nota</th>
                    <th>Nomor Nota</th>
                    <th>Pelanggan</th>
                    <th>Pesanan</th>
                    <th>Total</th>
                    <th>Terbayar</th>
                    <th>Belum Terbayar</th>
                    <th>Dateline</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${utangInvoices
                  .map(
                    (inv) => `
                    <tr>
                        <td>${inv.invoiceDate || "-"}</td>
                        <td>${inv.invoiceNumber || "-"}</td>
                        <td>${inv.customerName || "-"}</td>
                        <td>${inv.orderName || "-"}</td>
                        <td style="text-align:right;">${formatNumber(
                          inv.totalPrice
                        )}</td>
                        <td style="text-align:right;">${formatNumber(
                          inv.paidAmount
                        )}</td>
                        <td style="text-align:right;color:#e74c3c;font-weight:bold;">${formatNumber(
                          inv.unpaidAmount
                        )}</td>
                        <td>${inv.dateline || "-"}</td>
                        <td>
                            <button class="pay-utang-btn" data-no="${
                              inv.invoiceNumber
                            }" style="background:#27ae60;color:#fff;padding:2px 10px;border-radius:3px;">Bayar</button>
                            <button class="view-invoice-btn" data-no="${
                              inv.invoiceNumber
                            }" style="background:#007bff;color:#fff;padding:2px 10px;border-radius:0.2px;margin-left:4px;">Lihat</button>
                        </td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>
        <div style="margin-top:10px;font-size:0.95em;color:#888;">
            <i>Hanya menampilkan nota yang belum lunas. Klik "Bayar" untuk mencatat pembayaran tambahan.</i>
        </div>
    `;
  // Tambahkan judul dengan box dan rata tengah, huruf kapital semua
  const titleBox = `
    <div style="
      text-align:center;
      background:#e74c3c;
      color:#fff;
      font-weight:bold;
      font-size:1.25em;
      letter-spacing:0.08em;
      padding:14px 0 12px 0;
      border-radius:8px;
      margin-bottom:18px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
    ">
      UTANG PIUTANG
    </div>
  `;
  showModal(titleBox, html);

  // Event tombol bayar
  document.querySelectorAll(".pay-utang-btn").forEach((btn) => {
    btn.onclick = async function () {
      const invoiceNumber = btn.dataset.no;
      const inv = await getInvoiceByNumber(invoiceNumber);
      if (!inv) return alert("Invoice tidak ditemukan!");
      // Tampilkan form pembayaran
      let unpaid = normalizeNumber(inv.unpaidAmount);
      let paid = normalizeNumber(inv.paidAmount);
      let total = normalizeNumber(inv.totalPrice);
      let html = `
                <h3>Pembayaran Nota: ${inv.invoiceNumber}</h3>
                <div><b>Pelanggan:</b> ${inv.customerName || "-"}</div>
                <div><b>Pesanan:</b> ${inv.orderName || "-"}</div>
                <div><b>Total:</b> ${formatNumber(total)}</div>
                <div><b>Terbayar:</b> ${formatNumber(paid)}</div>
                <div><b>Belum Terbayar:</b> <span style="color:#e74c3c;">${formatNumber(
                  unpaid
                )}</span></div>
                <form id="pay-utang-form" style="margin-top:10px;">
                    <label>Nominal Pembayaran:</label>
                    <input type="number" id="pay-utang-amount" min="1" max="${unpaid}" value="${unpaid}" required style="width:120px;">
                    <button type="submit" style="margin-left:8px;">Bayar</button>
                </form>
            `;
      showModal("Pembayaran Piutang", html);

      document.getElementById("pay-utang-form").onsubmit = async function (e) {
        e.preventDefault();
        let payAmount =
          Number(document.getElementById("pay-utang-amount").value) || 0;
        if (payAmount <= 0 || payAmount > unpaid) {
          alert("Nominal pembayaran tidak valid!");
          return;
        }
        // Update paidAmount dan unpaidAmount
        let newPaid = paid + payAmount;
        let newUnpaid = Math.max(
          total - newPaid - (Number(inv.discount) || 0),
          0
        );
        let newChange = Math.max(
          newPaid + (Number(inv.discount) || 0) - total,
          0
        );
        let updated = {
          ...inv,
          paidAmount: newPaid,
          unpaidAmount: newUnpaid,
          changeAmount: newChange,
        };
        await saveInvoiceToFirebase(updated);
        alert("Pembayaran berhasil dicatat.");
        closeModalFunc();
        utangPiutangBtn.onclick(); // Refresh daftar
      };
    };
  });

  // Event tombol lihat
  document.querySelectorAll(".view-invoice-btn").forEach((btn) => {
    btn.onclick = async function () {
      const invoiceNumber = btn.dataset.no;
      const inv = await getInvoiceByNumber(invoiceNumber);
      if (inv) {
        showModal("Lihat Invoice", renderInvoiceView(inv));
      }
    };
  });
};

const searchBar = document.getElementById("search-bar");
const searchResults = document.getElementById("search-results");

function highlightKeyword(text, keyword) {
  if (!keyword) return text;
  // Highlight all words in the query (split by space)
  const words = keyword.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  let result = text;
  words.forEach((word) => {
    if (!word) return;
    const re = new RegExp(
      `(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    result = result.replace(re, "<mark>$1</mark>");
  });
  return result;
}

// Helper: check if all query words exist in a string (case-insensitive)
function allWordsIn(str, qWords) {
  str = (str || "").toLowerCase();
  return qWords.every((word) => str.includes(word));
}

// Helper: check if all query words exist in any of the array of strings
function anyFieldAllWords(fields, qWords) {
  return fields.some((f) => allWordsIn(f, qWords));
}

searchBar.addEventListener("input", async function () {
  const q = this.value.trim().toLowerCase();
  if (!q) {
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
    return;
  }
  // Fetch ALL invoices and expenses from Firebase (not filtered by month/year)
  let invoices = await getAllInvoices();
  let expenses = await getAllExpenses();
  let results = [];

  // Split query into words for better matching
  const qWords = q.split(/\s+/).filter(Boolean);

  // INVOICE SEARCH
  invoices.forEach((inv) => {
    const fields = [
      inv.customerName || "",
      inv.orderName || "",
      inv.invoiceNumber || "",
      inv.invoiceDate || "",
      inv.dateline || ""
    ];
    let foundInMain = anyFieldAllWords(fields, qWords);

    // Cari item yang cocok
    let matchedItems = [];
    (inv.items || []).forEach((item) => {
      const itemFields = [
        item.name || "",
        item.size || "",
        item.unit || "",
        (item.qty || "").toString(),
        (item.price || "").toString()
      ];
      if (anyFieldAllWords(itemFields, qWords)) {
        matchedItems.push(item);
      }
    });

    if (foundInMain || matchedItems.length > 0) {
      // Tampilkan info invoice utama SAJA, tanpa tabel item
      let invInfo = `
        <div style="font-size:1em;">
          <b>Invoice:</b> <span style="color:#007bff">${highlightKeyword(inv.invoiceNumber || "-", q)}</span>
          <span style="color:#888;">|</span>
          <b>Pelanggan:</b> ${highlightKeyword(inv.customerName || "-", q)}
          <span style="color:#888;">|</span>
          <b>Pesanan:</b> ${highlightKeyword(inv.orderName || "-", q)}
          <span style="color:#888;">|</span>
          <b>Tanggal:</b> ${highlightKeyword(inv.invoiceDate || "-", q)}
        </div>
      `;
      results.push({
        type: "invoice",
        label: invInfo,
        ref: inv.invoiceNumber,
        date: inv.invoiceDate || ""
      });
    }
  });

  // EXPENSE SEARCH
  expenses.forEach((exp) => {
    const fields = [
      exp.supplier || "",
      exp.type || "",
      exp.date || ""
    ];
    let foundInMain = anyFieldAllWords(fields, qWords);

    // Cari item yang cocok
    let matchedItems = [];
    (exp.items || []).forEach((item) => {
      const itemFields = [
        item.name || "",
        item.unit || "",
        (item.qty || "").toString(),
        (item.price || "").toString()
      ];
      if (anyFieldAllWords(itemFields, qWords)) {
        matchedItems.push(item);
      }
    });

    if (foundInMain || matchedItems.length > 0) {
      // Tampilkan info expense utama SAJA, tanpa tabel item
      let expInfo = `
        <div style="font-size:1em;">
          <b>Pengeluaran:</b> <span style="color:#e67e22">${highlightKeyword(exp.date || "-", q)}</span>
          <span style="color:#888;">|</span>
          <b>Jenis:</b> ${highlightKeyword(exp.type || "-", q)}
          <span style="color:#888;">|</span>
          <b>Supplier:</b> ${highlightKeyword(exp.supplier || "-", q)}
        </div>
      `;
      results.push({
        type: "expense",
        label: expInfo,
        ref: exp.date + "|" + exp.supplier + "|" + exp.type,
        date: exp.date || ""
      });
    }
  });

  // Urutkan hasil: yang terbaru (tanggal lebih besar) di atas
  results.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  if (!results.length) {
    searchResults.innerHTML =
      '<div style="padding:8px;">Tidak ditemukan.</div>';
    searchResults.style.display = "block";
    return;
  }

  searchResults.innerHTML = results
    .map(
      (r) =>
        `<div class="search-result-item" data-type="${r.type}" data-ref="${r.ref}" style="padding:8px 8px 8px 4px;cursor:pointer;border-bottom:0.2px solid #eee;background:#fff;">
          ${r.label}
        </div>`
    )
    .join("");
  searchResults.style.display = "block";
});

searchResults.addEventListener("click", async function (e) {
  const item = e.target.closest(".search-result-item");
  if (!item) return;
  const type = item.dataset.type;
  const ref = item.dataset.ref;
  searchResults.style.display = "none";
  searchBar.value = "";
  if (type === "invoice") {
    const inv = await getInvoiceByNumber(ref);
    if (inv) {
      fillInvoiceData(inv);
      window.scrollTo({ top: 0, behavior: "smooth" });
      const container = document.querySelector(".invoice-container");
      if (container) {
        container.style.boxShadow = "0 0 0 4px #007bff";
        setTimeout(() => {
          container.style.boxShadow = "";
        }, 1200);
      }
    }
  } else if (type === "expense") {
    showExpenseForm();
    setTimeout(async () => {
      let expenses = await getAllExpenses();
      const [date, supplier, typeVal] = ref.split("|");
      const exp = expenses.find(
        (e) => e.date === date && e.supplier === supplier && e.type === typeVal
      );
      if (exp) {
        document.getElementById("expense-date").value = exp.date;
        document.getElementById("expense-supplier").value = exp.supplier;
        const expenseType = document.getElementById("expense-type");
        const expenseTypeManual = document.getElementById(
          "expense-type-manual"
        );
        let found = false;
        for (let i = 0; i < expenseType.options.length; i++) {
          if (expenseType.options[i].value === exp.type) {
            expenseType.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) {
          expenseType.value = "Lain-lain";
          expenseTypeManual.style.display = "inline-block";
          expenseTypeManual.value = exp.type;
        } else {
          expenseTypeManual.style.display = "none";
          expenseTypeManual.value = "";
        }
        const expenseItemsBody = document.getElementById("expense-items-body");
        expenseItemsBody.innerHTML = "";
        (exp.items || []).forEach((item) => {
          const tr = document.createElement("tr");
            tr.innerHTML = `
                  <td><input type="text" class="expense-item-name" value="${
                    item.name || ""
                  }" required></td>
                  <td><input type="number" class="expense-item-qty" value="${
                    item.qty || 1
                  }" min="0" step="any" required style="width:60px;"></td>
                  <td>
                    <select class="expense-item-unit" style="width:70px;">
                      ${satuanList
                        .map(
                        (s) =>
                          `<option value="${s}"${
                          item.unit === s ? " selected" : ""
                          }>${s}</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                  <td><input type="number" class="expense-item-price" value="${
                    item.price || 0
                  }" min="0" step="any" required style="width:90px;"></td>
                  <td><input type="number" class="expense-item-discount" value="${
                    item.discount || 0
                  }" min="0" step="any" style="width:70px;" title="Diskon per barang"></td>
                  <td class="expense-item-total">0</td>
                  <td>
                    <button type="button" class="remove-expense-item" title="Hapus" style="background:none;border:none;cursor:pointer;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
                      <rect x="5" y="8" width="10" height="8" rx="2" fill="#e74c3c"/>
                      <rect x="8" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
                      <rect x="10.5" y="10" width="1.5" height="5" rx="0.7" fill="#fff"/>
                      <rect x="3" y="6" width="14" height="2" rx="1" fill="#e74c3c"/>
                      <rect x="7" y="3" width="6" height="2" rx="1" fill="#e74c3c"/>
                    </svg>
                    </button>
                  </td>
                `;
          expenseItemsBody.appendChild(tr);
          tr.querySelectorAll("input, select").forEach((input) => {
            input.addEventListener("input", () => {
              let total = 0;
              expenseItemsBody.querySelectorAll("tr").forEach((tr2) => {
                const qty =
                  Number(tr2.querySelector(".expense-item-qty").value) || 0;
                const price =
                  Number(tr2.querySelector(".expense-item-price").value) || 0;
                const discount = Number(tr2.querySelector(".expense-item-discount")?.value) || 0;
                const subtotal = Math.max(qty * price - discount, 0);
                tr2.querySelector(".expense-item-total").textContent =
                  formatNumber(subtotal);
                total += subtotal;
              });
              document.getElementById("expense-amount").value = total;
            });
          });
          tr.querySelector(".remove-expense-item").onclick = () => {
            tr.remove();
            let total = 0;
            expenseItemsBody.querySelectorAll("tr").forEach((tr2) => {
              const qty =
                Number(tr2.querySelector(".expense-item-qty").value) || 0;
              const price =
                Number(tr2.querySelector(".expense-item-price").value) || 0;
              const discount = Number(tr2.querySelector(".expense-item-discount")?.value) || 0;
              const subtotal = Math.max(qty * price - discount, 0);
              tr2.querySelector(".expense-item-total").textContent =
                formatNumber(subtotal);
              total += subtotal;
            });
            document.getElementById("expense-amount").value = total;
          };
        });
        let total = 0;
        expenseItemsBody.querySelectorAll("tr").forEach((tr2) => {
          const qty = Number(tr2.querySelector(".expense-item-qty").value) || 0;
          const price = Number(tr2.querySelector(".expense-item-price").value) || 0;
          const discount = Number(tr2.querySelector(".expense-item-discount")?.value) || 0;
          const subtotal = Math.max(qty * price - discount, 0);
          tr2.querySelector(".expense-item-total").textContent =
            formatNumber(subtotal);
          total += subtotal;
        });
        document.getElementById("expense-amount").value = total;
        const modal = document.getElementById("modal");
        if (modal) {
          modal.querySelector(".modal-content").style.boxShadow =
            "0 0 0 4px #007bff";
          setTimeout(() => {
            modal.querySelector(".modal-content").style.boxShadow = "";
          }, 1200);
        }
      }
    }, 200);
  }
});

document.addEventListener("click", function (e) {
  if (!searchResults.contains(e.target) && e.target !== searchBar) {
    searchResults.style.display = "none";
  }
});

// Modal functions
function showModal(title, html) {
  modalBody.innerHTML = `<h2>${title}</h2>` + html;
  modal.style.display = "block";
}
function closeModalFunc() {
  modal.style.display = "none";
}
closeModal.onclick = closeModalFunc;
window.onclick = function (event) {
  if (event.target == modal) closeModalFunc();
};

// === Autocomplete Nama Barang ===
const ITEM_NAME_KEY = "item_names_history";

function getItemNameHistory() {
  return JSON.parse(localStorage.getItem(ITEM_NAME_KEY) || "[]");
}

function saveItemNameToHistory(name) {
  if (!name) return;
  let names = getItemNameHistory();
  if (!names.includes(name)) {
    names.push(name);
    localStorage.setItem(ITEM_NAME_KEY, JSON.stringify(names));
  }
}

function createAutocompleteDropdown(input, suggestions) {
  let old = input.parentElement.querySelector(".autocomplete-dropdown");
  if (old) old.remove();
  if (!suggestions.length) return;
  const dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";
  input.parentElement.style.position = "relative";
  suggestions.forEach((name, idx) => {
    const item = document.createElement("div");
    item.textContent = name;
    item.tabIndex = 0;
    item.onmousedown = (e) => {
      e.preventDefault();
      input.value = name;
      input.dispatchEvent(new Event("input"));
      dropdown.remove();
    };
    dropdown.appendChild(item);
  });
  input.parentElement.appendChild(dropdown);

  let activeIdx = -1;
  input.onkeydown = function (e) {
    const items = dropdown.querySelectorAll("div");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      activeIdx = (activeIdx + 1) % items.length;
      items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      activeIdx = (activeIdx - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle("active", i === activeIdx));
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].dispatchEvent(new MouseEvent("mousedown"));
        dropdown.remove();
        e.preventDefault();
      }
    }
  };
  input.onblur = function () {
    setTimeout(() => {
      if (dropdown) dropdown.remove();
    }, 120);
  };
}

function enableItemNameAutocomplete(tr) {
  const input = tr.querySelector(".item-name");
  if (!input) return;
  input.addEventListener("input", function () {
    const val = input.value.trim().toLowerCase();
    if (!val) {
      createAutocompleteDropdown(input, []);
      return;
    }
    const names = getItemNameHistory().filter((n) =>
      n.toLowerCase().includes(val)
    );
    if (names.length === 1 && names[0].toLowerCase() === val) {
      createAutocompleteDropdown(input, []);
      return;
    }
    createAutocompleteDropdown(input, names.slice(0, 15));
  });
  input.addEventListener("blur", function () {
    saveItemNameToHistory(input.value.trim());
  });
}

(function addAutocompleteStyle() {
  if (document.getElementById("autocomplete-style")) return;
  const style = document.createElement("style");
  style.id = "autocomplete-style";
  style.innerHTML = `
    .autocomplete-dropdown div:hover {
        background: #f3f3f3;
    }
    `;
  document.head.appendChild(style);
})();

// Otomatis sinkronisasi invoice dari Firebase saat halaman diload
document.addEventListener("DOMContentLoaded", function () {
  if (typeof syncInvoicesFromFirebase === "function") {
    syncInvoicesFromFirebase();
  }
});

// === PANEL REKAP ITEM & PENGELUARAN ===
const rekapBtn = document.getElementById("rekap-btn");

if (rekapBtn) {
  rekapBtn.onclick = async function () {
    // Ambil semua invoice & expense untuk filter bulan/tahun
    let invoices = (await getAllInvoices()).map(normalizeInvoice);
    let expenses = (await getAllExpenses()).map(normalizeExpense);

    // Ambil daftar bulan-tahun unik dari invoice & expense
    let allMonths = Array.from(
      new Set([
        ...invoices.map((inv) => (inv.invoiceDate || "").slice(0, 7)),
        ...expenses.map((exp) => (exp.date || "").slice(0, 7)),
      ].filter(Boolean))
    ).sort().reverse();

    // Modal: tab Penjualan & Pengeluaran
    let html = `
      <div style="margin-bottom:16px;">
        <button id="rekap-tab-penjualan" class="rekap-tab-btn" style="padding:6px 18px;border-radius:0.2px 0.2pxpx 0 0;border:0.2px solid #007bff;background:#007bff;color:#fff;font-weight:bold;">Penjualan</button>
        <button id="rekap-tab-pengeluaran" class="rekap-tab-btn" style="padding:6px 18px;border-radius:0.2px 0.2pxpx 0 0;border:0.2px solid #e67e22;background:#e67e22;color:#fff;font-weight:bold;margin-left:2px;">Pengeluaran</button>
      </div>
      <div id="rekap-panel-penjualan">
        <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label for="rekap-item-keyword"><b>Kata Kunci:</b></label>
          <input type="text" id="rekap-item-keyword" style="width:180px;" placeholder="Contoh: Kaos Hitam">
          <label for="rekap-item-type" style="margin-left:12px;"><b>Cari Berdasarkan:</b></label>
          <select id="rekap-item-type" style="width:140px;">
            <option value="item">Nama Item</option>
            <option value="customer">Nama Pelanggan</option>
            <option value="order">Nama Pesanan</option>
          </select>
          <label for="rekap-item-month" style="margin-left:12px;"><b>Bulan:</b></label>
          <select id="rekap-item-month" style="width:120px;">
            <option value="">Semua</option>
            ${allMonths
              .map(
                (m) =>
                  `<option value="${m}">${m.replace(
                    /(\d{4})-(\d{2})/,
                    "$2-$1"
                  )}</option>`
              )
              .join("")}
          </select>
          <button id="rekap-item-search" style="margin-left:8px;">Cari</button>
        </div>
        <div id="rekap-item-result" style="margin-top:18px;"></div>
      </div>
      <div id="rekap-panel-pengeluaran" style="display:none;">
        <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
          <label for="rekap-expense-keyword"><b>Kata Kunci:</b></label>
          <input type="text" id="rekap-expense-keyword" style="width:180px;" placeholder="Contoh: Kain Hitam">
          <label for="rekap-expense-type" style="margin-left:12px;"><b>Cari Berdasarkan:</b></label>
          <select id="rekap-expense-type" style="width:170px;">
            <option value="jenis">Jenis Pengeluaran</option>
            <option value="supplier">Nama Supplier</option>
            <option value="item">Nama Barang</option>
          </select>
          <label for="rekap-expense-month" style="margin-left:12px;"><b>Bulan:</b></label>
          <select id="rekap-expense-month" style="width:120px;">
            <option value="">Semua</option>
            ${allMonths
              .map(
                (m) =>
                  `<option value="${m}">${m.replace(
                    /(\d{4})-(\d{2})/,
                    "$2-$1"
                  )}</option>`
              )
              .join("")}
          </select>
          <button id="rekap-expense-search" style="margin-left:8px;">Cari</button>
        </div>
        <div id="rekap-expense-result" style="margin-top:18px;"></div>
      </div>
      <style>
        .rekap-tab-btn.active {
          background: #fff !important;
          color: #007bff !important;
          border-bottom: 0.2px solid #fff !important;
        }
        .rekap-tab-btn {
          border-bottom: 0.2px solid #bbb !important;
        }
        #rekap-panel-penjualan, #rekap-panel-pengeluaran {
          background: #fff;
          border-radius: 0 0 0.2px 0.2px;
          border: 0.2pxpx solid #bbb;
          border-top: none;
          padding: 18px 12px 12px 12px;
        }
      </style>
    `;
    // Tambahkan judul dengan box dan rata tengah, huruf kapital semua
    const titleBox = `
      <div style="
      text-align:center;
      background:#007bff;
      color:#fff;
      font-weight:bold;
      font-size:1.25em;
      letter-spacing:0.08em;
      padding:14px 0 12px 0;
      border-radius:8px;
      margin-bottom:18px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
      ">
      REKAP PENJUALAN & PENGELUARAN
      </div>
    `;
    showModal("", titleBox + html);

    // Tab switching
    document.getElementById("rekap-tab-penjualan").onclick = function () {
      document.getElementById("rekap-panel-penjualan").style.display = "";
      document.getElementById("rekap-panel-pengeluaran").style.display = "none";
      this.classList.add("active");
      document.getElementById("rekap-tab-pengeluaran").classList.remove("active");
    };
    document.getElementById("rekap-tab-pengeluaran").onclick = function () {
      document.getElementById("rekap-panel-penjualan").style.display = "none";
      document.getElementById("rekap-panel-pengeluaran").style.display = "";
      this.classList.add("active");
      document.getElementById("rekap-tab-penjualan").classList.remove("active");
    };

    // --- PENJUALAN ---
    document.getElementById("rekap-item-search").onclick = async function () {
      const keyword = document
        .getElementById("rekap-item-keyword")
        .value.trim()
        .toLowerCase();
      const month = document.getElementById("rekap-item-month").value;
      const type = document.getElementById("rekap-item-type").value;
      if (!keyword) {
        document.getElementById("rekap-item-result").innerHTML =
          "<i>Masukkan kata kunci.</i>";
        return;
      }

      // Filter invoice sesuai bulan
      let filteredInvoices = invoices;
      if (month) {
        filteredInvoices = invoices.filter(
          (inv) => (inv.invoiceDate || "").slice(0, 7) === month
        );
      }

      let matched = [];
      if (type === "item") {
        // Filter item yang mengandung keyword pada nama item
        filteredInvoices.forEach((inv) => {
          (inv.items || []).forEach((item) => {
            if ((item.name || "").toLowerCase().includes(keyword)) {
              matched.push({
                invoice: inv,
                item,
              });
            }
          });
        });
      } else if (type === "customer") {
        // Filter invoice berdasarkan nama pelanggan
        filteredInvoices.forEach((inv) => {
          if ((inv.customerName || "").toLowerCase().includes(keyword)) {
            (inv.items || []).forEach((item) => {
              matched.push({
                invoice: inv,
                item,
              });
            });
          }
        });
      } else if (type === "order") {
        // Filter invoice berdasarkan nama pesanan
        filteredInvoices.forEach((inv) => {
          if ((inv.orderName || "").toLowerCase().includes(keyword)) {
            (inv.items || []).forEach((item) => {
              matched.push({
                invoice: inv,
                item,
              });
            });
          }
        });
      }

      if (!matched.length) {
        document.getElementById("rekap-item-result").innerHTML =
          "<i>Tidak ditemukan penjualan untuk pencarian tersebut.</i>";
        return;
      }

      // Hitung total qty, omset
      let totalQty = 0,
        totalOmset = 0;
      let invoiceNumbers = new Set();
      matched.forEach(({ invoice, item }) => {
        totalQty += Number(item.qty) || 0;
        totalOmset += (Number(item.qty) || 0) * (Number(item.price) || 0);
        invoiceNumbers.add(invoice.invoiceNumber);
      });

      // Tampilkan tabel detail
      let rows = matched
        .map(
          ({ invoice, item }) => `
        <tr>
          <td>${invoice.invoiceDate || "-"}</td>
          <td>${invoice.invoiceNumber || "-"}</td>
          <td>${invoice.customerName || "-"}</td>
          <td>${invoice.orderName || "-"}</td>
          <td>${item.name || "-"}</td>
          <td>${item.size || "-"}</td>
          <td style="text-align:right;">${formatNumber(item.qty)}</td>
          <td style="text-align:right;">${formatNumber(item.price)}</td>
          <td style="text-align:right;">${formatNumber(
            (item.qty || 0) * (item.price || 0)
          )}</td>
        </tr>
      `
        )
        .join("");

      document.getElementById("rekap-item-result").innerHTML = `
        <div style="margin-bottom:10px;">
          <b>Hasil untuk keyword:</b> <span style="color:#007bff">${keyword}</span>
          <b style="margin-left:10px;">Berdasarkan:</b> <span style="color:#007bff">${type === "item" ? "Nama Item" : type === "customer" ? "Nama Pelanggan" : "Nama Pesanan"}</span>
          ${
            month
              ? `&nbsp;|&nbsp;<b>Bulan:</b> <span style="color:#007bff">${month.replace(
                  /(\d{4})-(\d{2})/,
                  "$2-$1"
                )}</span>`
              : ""
          }
        </div>
        <div style="margin-bottom:10px;">
          <b>Total Transaksi:</b> ${invoiceNumbers.size} &nbsp; | &nbsp;
          <b>Total Qty:</b> ${formatNumber(totalQty)} &nbsp; | &nbsp;
          <b>Omset:</b> Rp ${formatNumber(totalOmset)}
        </div>
        <div style="max-height:320px;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:1em;">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>No. Nota</th>
              <th>Pelanggan</th>
              <th>Pesanan</th>
              <th>Nama Barang</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Harga</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        </div>
      `;
    };

    // --- PENGELUARAN ---
    document.getElementById("rekap-expense-search").onclick = async function () {
      const keyword = document
        .getElementById("rekap-expense-keyword")
        .value.trim()
        .toLowerCase();
      const month = document.getElementById("rekap-expense-month").value;
      const type = document.getElementById("rekap-expense-type").value;
      if (!keyword) {
        document.getElementById("rekap-expense-result").innerHTML =
          "<i>Masukkan kata kunci.</i>";
        return;
      }

      // Filter expense sesuai bulan
      let filteredExpenses = expenses;
      if (month) {
        filteredExpenses = expenses.filter(
          (exp) => (exp.date || "").slice(0, 7) === month
        );
      }

      let matched = [];
      if (type === "jenis") {
        // Berdasarkan jenis pengeluaran
        filteredExpenses.forEach((exp) => {
          if ((exp.type || "").toLowerCase().includes(keyword)) {
            (exp.items || []).forEach((item) => {
              matched.push({
                expense: exp,
                item,
              });
            });
          }
        });
      } else if (type === "supplier") {
        // Berdasarkan nama supplier
        filteredExpenses.forEach((exp) => {
          if ((exp.supplier || "").toLowerCase().includes(keyword)) {
            (exp.items || []).forEach((item) => {
              matched.push({
                expense: exp,
                item,
              });
            });
          }
        });
      } else if (type === "item") {
        // Berdasarkan nama barang
        filteredExpenses.forEach((exp) => {
          (exp.items || []).forEach((item) => {
            if ((item.name || "").toLowerCase().includes(keyword)) {
              matched.push({
                expense: exp,
                item,
              });
            }
          });
        });
      }

      if (!matched.length) {
        document.getElementById("rekap-expense-result").innerHTML =
          "<i>Tidak ditemukan pengeluaran untuk pencarian tersebut.</i>";
        return;
      }

      // Hitung total qty, total pengeluaran
      let totalQty = 0,
        totalExpense = 0;
      let expenseDates = new Set();
      matched.forEach(({ expense, item }) => {
        totalQty += Number(item.qty) || 0;
        totalExpense += Math.max((Number(item.qty) || 0) * (Number(item.price) || 0) - (Number(item.discount) || 0), 0);
        expenseDates.add(expense.date + "|" + expense.supplier + "|" + expense.type);
      });

      // Tampilkan tabel detail
      let rows = matched
        .map(
          ({ expense, item }) => `
        <tr>
          <td>${expense.date || "-"}</td>
          <td>${expense.type || "-"}</td>
          <td>${expense.supplier || "-"}</td>
          <td>${item.name || "-"}</td>
          <td style="text-align:right;">${formatNumber(item.qty)}</td>
          <td>${item.unit || "-"}</td>
          <td style="text-align:right;">${formatNumber(item.price)}</td>
          <td style="text-align:right;">${formatNumber(item.discount || 0)}</td>
          <td style="text-align:right;">${formatNumber(
            Math.max((item.qty || 0) * (item.price || 0) - (item.discount || 0), 0)
          )}</td>
        </tr>
      `
        )
        .join("");

      document.getElementById("rekap-expense-result").innerHTML = `
        <div style="margin-bottom:10px;">
          <b>Hasil untuk keyword:</b> <span style="color:#e67e22">${keyword}</span>
          <b style="margin-left:10px;">Berdasarkan:</b> <span style="color:#e67e22">${
            type === "jenis"
              ? "Jenis Pengeluaran"
              : type === "supplier"
              ? "Nama Supplier"
              : "Nama Barang"
          }</span>
          ${
            month
              ? `&nbsp;|&nbsp;<b>Bulan:</b> <span style="color:#e67e22">${month.replace(
                  /(\d{4})-(\d{2})/,
                  "$2-$1"
                )}</span>`
              : ""
          }
        </div>
        <div style="margin-bottom:10px;">
          <b>Total Transaksi:</b> ${expenseDates.size} &nbsp; | &nbsp;
          <b>Total Qty:</b> ${formatNumber(totalQty)} &nbsp; | &nbsp;
          <b>Total Pengeluaran:</b> Rp ${formatNumber(totalExpense)}
        </div>
        <div style="max-height:320px;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:1em;">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Supplier</th>
              <th>Nama Barang</th>
              <th>Qty</th>
              <th>Satuan</th>
              <th>Harga</th>
              <th>Diskon</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        </div>
      `;
    };
  };
}

// === EXPORT KE EXCEL ===
// Tombol Export Laporan
const exportBtn = document.getElementById("export-btn");

if (exportBtn) {
  exportBtn.onclick = async function () {
    // Ambil semua invoice & expense untuk filter bulan/tahun
    let invoices = (await getAllInvoices()).map(normalizeInvoice);
    let expenses = (await getAllExpenses()).map(normalizeExpense);

    // Ambil daftar bulan-tahun unik dari invoice & expense
    let allMonths = Array.from(
      new Set([
        ...invoices.map((inv) => (inv.invoiceDate || "").slice(0, 7)),
        ...expenses.map((exp) => (exp.date || "").slice(0, 7)),
      ].filter(Boolean))
    ).sort().reverse();

    // Modal: Pilih bulan
    let html = `
      <div style="margin-bottom:16px;">
        <label for="export-month"><b>Pilih Bulan:</b></label>
        <select id="export-month" style="width:140px;">
          ${allMonths
            .map(
              (m) =>
                `<option value="${m}">${m.replace(
                  /(\d{4})-(\d{2})/,
                  "$2-$1"
                )}</option>`
            )
            .join("")}
        </select>
        <button id="export-excel-btn" style="margin-left:12px;">Export ke Excel</button>
      </div>
      <div style="font-size:0.95em;color:#888;">
        <i>Data yang diexport berupa ringkasan transaksi penjualan (invoice) dan pengeluaran pada bulan terpilih, sesuai tampilan tabel pembukuan.</i>
      </div>
    `;
    // Tambahkan judul dengan box dan rata tengah, huruf kapital semua
    const titleBox = `
      <div style="
      text-align:center;
      background:#007bff;
      color:#fff;
      font-weight:bold;
      font-size:1.25em;
      letter-spacing:0.08em;
      padding:14px 0 12px 0;
      border-radius:8px;
      margin-bottom:18px;
      text-transform:uppercase;
      box-shadow:0 2px 12px 0 rgba(0,0,0,0.07);
      ">
      EXPORT LAPORAN KE EXCEL
      </div>
    `;
    showModal("", titleBox + html);

    document.getElementById("export-excel-btn").onclick = async function () {
      const month = document.getElementById("export-month").value;
      if (!month) {
        alert("Pilih bulan terlebih dahulu.");
        return;
      }
      // Filter invoice & expense sesuai bulan
      let filteredInvoices = invoices.filter(
        (inv) => (inv.invoiceDate || "").slice(0, 7) === month
      );
      let filteredExpenses = expenses.filter(
        (exp) => (exp.date || "").slice(0, 7) === month
      );

      // Sheet: Pembukuan (sesuai struktur tabel pembukuan)
      let sheet = [
        [
          "Tanggal",
          "Subjek",
          "Keterangan",
          "Masuk",
          "Keluar",
          "Saldo",
        ],
      ];

      // Gabungkan transaksi
      let transactions = [];
      filteredInvoices.forEach((inv) => {
        transactions.push({
          date: inv.invoiceDate,
          type: "INVOICE",
          subjek: inv.customerName || "-",
          keterangan: inv.orderName || "-",
          income: inv.paidAmount || 0,
          expense: 0,
        });
      });
      filteredExpenses.forEach((exp) => {
        const expenseCategory = exp.expenseCategory || exp.type || "-";
        transactions.push({
          date: exp.date,
          type: "EXPENSE",
          subjek: exp.supplier || "-",
          keterangan: expenseCategory,
          income: 0,
          expense: exp.amount || 0,
        });
      });
      // Sort transaksi berdasarkan tanggal dan tipe
      transactions = transactions
        .filter((t) => t.date)
        .sort((a, b) => {
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
          if (a.type === b.type) return 0;
          return a.type === "INVOICE" ? -1 : 1;
        });

      // Hitung saldo awal dari bulan sebelumnya
      function getPreviousMonthSaldo(selectedMonth) {
        if (!selectedMonth) return 0;
        let prevInvoices = invoices.filter(
          (inv) => (inv.invoiceDate || "").slice(0, 7) < selectedMonth
        );
        let prevExpenses = expenses.filter(
          (exp) => (exp.date || "").slice(0, 7) < selectedMonth
        );
        let saldo = 0;
        prevInvoices.forEach((inv) => {
          saldo += Number(inv.paidAmount) || 0;
        });
        prevExpenses.forEach((exp) => {
          saldo -= Number(exp.amount) || 0;
        });
        return saldo;
      }
      let saldoAwal = getPreviousMonthSaldo(month);

      // Saldo berjalan
      let saldo = saldoAwal;
      // Tambahkan saldo awal jika ada transaksi
      if (transactions.length) {
        sheet.push([
          "", "", "Saldo Awal", "", "", saldoAwal
        ]);
      }
      transactions.forEach((t) => {
        saldo += (Number(t.income) || 0) - (Number(t.expense) || 0);
        sheet.push([
          t.date,
          t.subjek,
          t.keterangan,
          t.income ? t.income : "",
          t.expense ? t.expense : "",
          saldo,
        ]);
      });

      // Export ke Excel (pakai SheetJS/xlsx)
      if (typeof XLSX === "undefined") {
        alert("Library XLSX (SheetJS) belum dimuat. Silakan tambahkan di project Anda.");
        return;
      }
      let wb = XLSX.utils.book_new();
      let ws = XLSX.utils.aoa_to_sheet(sheet);
      XLSX.utils.book_append_sheet(wb, ws, "Pembukuan");
      XLSX.writeFile(wb, `Pembukuan_${month}.xlsx`);
      closeModalFunc();
    };
  };
}

updateTotals();
setMockupPreview();
