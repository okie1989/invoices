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
  "Set",
  "Box",
  "Pack",
  "Liter",
  "Unit",
  "Dus",
  "Kodi",
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
        <td><button class="remove-item" title="Hapus"><span aria-label="Hapus" role="img">🗑️</span></button></td>
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
mockupInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) {
    mockupPreview.style.display = "none";
    mockupDataUrl = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = function (evt) {
    mockupDataUrl = evt.target.result; // <-- DataURL (Base64)
    mockupPreview.src = mockupDataUrl;
    mockupPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// When loading invoice, show mockup preview if exists
function setMockupPreview(dataUrl) {
  if (dataUrl) {
    mockupPreview.src = dataUrl;
    mockupPreview.style.display = "block";
    mockupDataUrl = dataUrl;
  } else {
    mockupPreview.style.display = "none";
    mockupDataUrl = "";
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
        <div id="invoice-preview-controls" style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:10px;">
            <button id="download-invoice-jpg" style="background:#007bff;color:#fff;padding:6px 14px;border-radius:5px;border:none;cursor:pointer;font-size:1em;"><span>⬇️</span> Download JPG</button>
            <button id="share-wa" style="background:#25D366;color:#fff;padding:6px 14px;border-radius:5px;border:none;cursor:pointer;font-size:1em;"><span>🟢</span> Share WhatsApp</button>
        </div>
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
      "Jl.Riau Barat No.21 Kec. Sananwetan Kota Blitar<br>Telp. 082257423324";
    let showAddress = true;
    if (
      businessName.includes("Jl.Riau Barat No.21") ||
      businessName.includes("082257423324")
    ) {
      showAddress = false;
    }
    // Group items by name, but keep order and allow same name with different price/qty
    let groupedRows = [];
    let lastName = null;
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
                    <td style="text-align:left;word-break:break-all;">${
                      row.name !== prevName ? row.name : ""
                    }</td>
                    <td style="text-align:right;">${row.qty}</td>
                    <td style="text-align:right;">${formatNumber(
                      row.price
                    )}</td>
                    <td style="text-align:right;">${formatNumber(
                      row.subtotal
                    )}</td>
                </tr>
            `;
      prevName = row.name;
    });

    let html = `
        <div style="width:50mm;max-width:100vw;font-family:monospace,sans-serif;font-size:10px;line-height:1.3;background:#fff;color:#111;padding:0;margin:0;">
            <div style="text-align:center;margin-bottom:2px;">
                <img src="https://i.imgur.com/75tlt7m.png" alt="Logo" style="width:32px;height:46px;display:block;margin:0 auto 2px auto;" crossOrigin="anonymous" />
            </div>
            <div style="text-align:center;font-weight:bold;font-size:12px;margin-bottom:2px;">${businessName}</div>
            ${
              showAddress
                ? `<div style="text-align:center;margin-bottom:2px;">${address}</div>`
                : ""
            }
            <div style="border-top:1px dashed #222;margin:2px 0 4px 0;"></div>
            <div style="display:flex;justify-content:space-between;">
                <span>Tgl: ${formatDate(data.invoiceDate)}</span>
                <span>No: ${data.invoiceNumber}</span>
            </div>
            <div>Pelanggan: ${data.customerName || "-"}</div>
            <div>Pesanan: ${data.orderName || "-"}</div>
            <div style="border-top:1px dashed #222;margin:2px 0 4px 0;"></div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead>
                    <tr>
                        <th style="text-align:left;">Barang</th>
                        <th style="text-align:left;">Qty</th>
                        <th style="text-align:right;">Harga</th>
                        <th style="text-align:right;">Jml</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                </tbody>
            </table>
            <div style="border-top:1px dashed #222;margin:2px 0 4px 0;"></div>
            <div style="display:flex;justify-content:space-between;">
                <span>Total Qty:</span>
                <span>${totalQty}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Total:</span>
                <span>${formatNumber(total)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Diskon:</span>
                <span>${formatNumber(data.discount || 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Terbayar:</span>
                <span>${formatNumber(data.paidAmount || 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Belum Lunas:</span>
                <span>${formatNumber(data.unpaidAmount || 0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span>Kembalian:</span>
                <span>${formatNumber(data.changeAmount || 0)}</span>
            </div>
            <div style="border-top:1px dashed #222;margin:4px 0;"></div>
            <div style="text-align:center;font-size:10px;margin-top:2px;">
                Terima kasih<br>
                Semoga Berkah dan Manfaat<br>
            </div>
        </div>
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
    border: 1.5px dashed #888;
    border-radius: 8px;
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
    <div class="invoice-container invoice-view" style="max-width:900px;width:95vw;min-width:0;margin:24px auto;">
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
        <h2>Catat Pengeluaran</h2>
        <form id="expense-form" ${
          expenseKey ? `data-expense-key="${expenseKey}"` : ""
        }>
            <div>
                <label>Tanggal:</label>
                <input type="date" id="expense-date" required value="${new Date()
                  .toISOString()
                  .slice(0, 10)}">
            </div>
            <div>
                <label>Jenis Pengeluaran:</label>
                <select id="expense-type" required>
                    <option value="">--Pilih--</option>
                    <option value="Bahan Kain">Bahan Kain</option>
                    <option value="Bahan Sablon">Bahan Sablon</option>
                    <option value="Cetak">Cetak</option>
                    <option value="Kebutuhan Toko">Kebutuhan Toko</option>
                    <option value="Gaji">Gaji</option>
                    <option value="Iuran Wajib">Iuran Wajib</option>
                    <option value="Lain-lain">Lain-lain (Isi Manual)</option>
                </select>
                <input type="text" id="expense-type-manual" placeholder="Isi jenis lain-lain" style="display:none;margin-top:4px;">
            </div>
            <div>
                <label>Nama Supplier:</label>
                <input type="text" id="expense-supplier" required>
            </div>
            <div>
                <label>Rincian Pembelian:</label>
                <table id="expense-items-table" style="width:100%;margin-bottom:8px;">
                    <thead>
                        <tr>
                            <th>Nama Barang</th>
                            <th>Qty</th>
                            <th>Satuan</th>
                            <th>Harga Satuan</th>
                            <th>Jumlah</th>
                            <th>Hapus</th>
                        </tr>
                    </thead>
                    <tbody id="expense-items-body">
                        <!-- Baris barang pengeluaran -->
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="6"><button type="button" id="add-expense-item">Tambah Barang</button></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div>
                <label>Total Pengeluaran (Rp):</label>
                <input type="number" id="expense-amount" required min="0" readonly style="background:#eee;">
            </div>
            <button type="submit" style="margin-top:8px;">Simpan Pengeluaran</button>
        </form>
    `;
  showModal("Pengeluaran Toko", html);

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
            <td class="expense-item-total">0</td>
            <td><button type="button" class="remove-expense-item">Hapus</button></td>
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
      const subtotal = qty * price;
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
      const subtotal = qty * price;
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
    }))
    .filter((i) => i.name && i.qty && i.price >= 0);

  if (!date) {
    alert("Tanggal pengeluaran harus diisi!");
    return;
  }
  if (!type || !supplier || !items.length)
    return alert("Lengkapi semua data dan minimal 1 barang!");

  const amount = items.reduce((sum, i) => sum + i.qty * i.price, 0);

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
                                              item.qty * item.price
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
                        <td><button class="delete-expense" data-idx="${i}" style="background:#e74c3c;color:#fff;padding:2px 8px;font-size:0.9em;border-radius:3px;">Hapus</button></td>
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

  // Tambahan: variabel untuk menyimpan ref item yang diedit
  let lastEditedRef = null;
  let lastEditedType = null;

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
    transactions = transactions
      .filter((t) => t.date)
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    // Hitung saldo berjalan
    let saldo = 0;
    let rows = transactions
      .map((t, idx) => {
        saldo += t.income - t.expense;
        let deleteBtn = "";
        if (t.type === "INVOICE") {
          deleteBtn = `<button class="delete-bk-invoice" data-ref="${t.ref}" title="Hapus Invoice" style="background:#e74c3c;color:#fff;padding:2px 8px;font-size:0.9em;border-radius:3px;">Hapus</button>`;
        } else if (t.type === "EXPENSE") {
          deleteBtn = `<button class="delete-bk-expense" data-key="${t.ref}" title="Hapus Pengeluaran" style="background:#e74c3c;color:#fff;padding:2px 8px;font-size:0.9em;border-radius:3px;">Hapus</button>`;
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
                <td style="text-align:right;">${formatNumber(saldo)}</td>
                <td>${deleteBtn}</td>
            </tr>`;
      })
      .join("");

    let totalIncome = transactions.reduce((sum, t) => sum + (t.income || 0), 0);
    let totalExpense = transactions.reduce(
      (sum, t) => sum + (t.expense || 0),
      0
    );
    let saldoAkhir = saldo;

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
                        <th style="border-bottom:1.5px solid #111;">Tanggal</th>
                        <th style="border-bottom:1.5px solid #111;">Subjek</th>
                        <th style="border-bottom:1.5px solid #111;">Keterangan</th>
                        <th style="border-bottom:1.5px solid #111;">Masuk</th>
                        <th style="border-bottom:1.5px solid #111;">Keluar</th>
                        <th style="border-bottom:1.5px solid #111;">Saldo</th>
                        <th style="border-bottom:1.5px solid #111;">Hapus</th>
                    </tr>
                </thead>
                <tbody>
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
    showModal("Pembukuan", html);

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
        lastEditedRef = t.ref;
        lastEditedType = t.type;
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
                    price: Number(
                      tr2.querySelector(".expense-item-price").value
                    ),
                  }))
                  .filter((i) => i.name && i.qty && i.price >= 0);
                if (!date || !type || !supplier || !items.length)
                  return alert("Lengkapi semua data dan minimal 1 barang!");
                const amount = items.reduce(
                  (sum, i) => sum + i.qty * i.price,
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
  let chart; // Declare chart variable in the parent scope

  // Gabungkan semua tanggal dari invoice dan expense
  let allDates = [
    ...invoices.map((inv) => inv.invoiceDate),
    ...expenses.map((exp) => exp.date),
  ].filter(Boolean);

  // Helper untuk dapatkan minggu ke berapa dalam tahun
  function getWeekNumber(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  // Ambil semua tahun unik
  let allYears = Array.from(new Set(allDates.map((d) => (d || "").slice(0, 4))))
    .filter(Boolean)
    .sort()
    .reverse();
  let currentYear = new Date().getFullYear().toString();
  if (!allYears.includes(currentYear) && allYears.length)
    currentYear = allYears[0];

  // Ambil semua bulan unik di tahun terpilih
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

  // Render filter
  let html = `
        <div style="margin-bottom:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
            <label><b>Tahun:</b>
                <select id="stat-year" style="font-size:1em;margin-left:4px;">
                    ${allYears
                      .map(
                        (y) =>
                          `<option value="${y}"${
                            y === currentYear ? " selected" : ""
                          }>${y}</option>`
                      )
                      .join("")}
                </select>
            </label>
            <label><b>Bulan:</b>
                <select id="stat-month" style="font-size:1em;margin-left:4px;">
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
            </label>
            <label><b>Mode:</b>
                <select id="stat-mode" style="font-size:1em;margin-left:4px;">
                    <option value="minggu">Per Minggu</option>
                    <option value="bulan">Per Bulan</option>
                    <option value="tahun">Per Tahun</option>
                </select>
            </label>
        </div>
        <div style="width:100%;max-width:1200px;margin:0 auto;">
            <canvas id="statistic-chart" height="340"></canvas>
        </div>
        <div id="stat-summary" style="margin-top:18px;font-size:1.1em;"></div>
    `;
  showModal("Statistik Keuangan", html);

  // Tambahkan class khusus agar modal statistik tampil optimal
  setTimeout(() => {
    const modalContent = document.querySelector(".modal-content");
    if (modalContent) {
      modalContent.classList.add("statistic-modal");
    }
    // Paksa Chart.js reflow setelah modal tampil
    setTimeout(() => {
      if (window.Chart && window.Chart.instances) {
        Object.values(window.Chart.instances).forEach((c) => {
          if (c && c.resize) c.resize();
        });
      }
    }, 150);
  }, 50);

  async function renderChart() {
    const year = document.getElementById("stat-year").value;
    const month = document.getElementById("stat-month").value;
    const mode = document.getElementById("stat-mode").value;

    // Filter data sesuai tahun/bulan
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
      // Per minggu dalam bulan/tahun
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
      // Per bulan dalam tahun
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
      // Per tahun
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

    // Destroy chart if exists
    if (chart) {
      chart.destroy();
    }
    const ctx = document.getElementById("statistic-chart").getContext("2d");
    // Ensure Chart.js is available globally
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
            borderColor: "rgba(40,167,69,1)",
            backgroundColor: "rgba(40,167,69,0.15)",
            fill: false,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: "rgba(40,167,69,1)",
            borderWidth: 3,
          },
          {
            label: "Pengeluaran",
            data: expenseData,
            borderColor: "rgba(231,76,60,1)",
            backgroundColor: "rgba(231,76,60,0.15)",
            fill: false,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: "rgba(231,76,60,1)",
            borderWidth: 3,
          },
          {
            label: "Profit",
            data: profitData,
            borderColor: "rgba(52,152,219,1)",
            backgroundColor: "rgba(52,152,219,0.15)",
            fill: false,
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: "rgba(52,152,219,1)",
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2.5,
        plugins: {
          legend: { position: "top", labels: { font: { size: 18 } } },
          title: {
            display: true,
            text: "Statistik Keuangan",
            font: { size: 22 },
          },
          tooltip: {
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
              font: { size: 16 },
            },
            ticks: { font: { size: 15 } },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Nominal (Rp)", font: { size: 16 } },
            ticks: {
              font: { size: 15 },
              callback: function (value) {
                return formatNumber(value);
              },
            },
          },
        },
      },
    });

    // Ringkasan
    let totalIncome = incomeData.reduce((a, b) => a + b, 0);
    let totalExpense = expenseData.reduce((a, b) => a + b, 0);
    let profit = totalIncome - totalExpense;
    document.getElementById("stat-summary").innerHTML = `
            <b>Total Pemasukan:</b> ${formatNumber(totalIncome)} &nbsp; | &nbsp;
            <b>Total Pengeluaran:</b> ${formatNumber(
              totalExpense
            )} &nbsp; | &nbsp;
            <b>Profit:</b> ${formatNumber(profit)}
        `;
  }

  // Event listeners
  document.getElementById("stat-year").onchange = function () {
    // Update bulan sesuai tahun
    let year = this.value;
    let monthSel = document.getElementById("stat-month");
    let months = getMonthsForYear(year);
    monthSel.innerHTML =
      `<option value="">Semua</option>` +
      months.map((m) => `<option value="${m}">${m}</option>`).join("");
    // Set selected month to first available month or empty if none
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
        <h2>Daftar Piutang (Nota Belum Lunas)</h2>
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
                            }" style="background:#007bff;color:#fff;padding:2px 10px;border-radius:3px;margin-left:4px;">Lihat</button>
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
  showModal("Utang Piutang", html);

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

/*
    SEARCH BAR FUNCTIONALITY (ENHANCED)
    - Search covers ALL invoices and expenses, not just those in the current bookkeeping view.
    - Search is THOROUGH: matches if ANY field (including ALL customer names, ALL order names, ALL item names/sizes) contains ALL query words.
    - Handles edge cases: short names, names with spaces, case-insensitive, partial matches.
    - No customer/order name will be missed.
*/
// Only show the matched item(s) for each invoice/expense, not all items
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

  // Build a set of all unique customer names and order names for thoroughness
  let allCustomerNames = new Set();
  let allOrderNames = new Set();

  invoices.forEach((inv) => {
    if (inv.customerName) allCustomerNames.add(inv.customerName);
    if (inv.orderName) allOrderNames.add(inv.orderName);
  });

  // For each invoice, check all relevant fields and all customer/order names
  invoices.forEach((inv) => {
    // Prepare searchable fields (keep original for highlight, lower for search)
    const customerName = inv.customerName || "";
    const orderName = inv.orderName || "";
    const invoiceNumber = inv.invoiceNumber || "";
    const invoiceDate = inv.invoiceDate || "";
    const dateline = inv.dateline || "";
    const itemNamesArr = (inv.items || []).map(
      (i) => (i.name || "") + " " + (i.size || "")
    );
    // Lowercase for search
    const fields = [
      customerName,
      orderName,
      invoiceNumber,
      invoiceDate,
      dateline,
    ];
    // Add all unique customer/order names to fields for search
    allCustomerNames.forEach((n) => fields.push(n));
    allOrderNames.forEach((n) => fields.push(n));
    // Improved: match if ANY field contains ALL query words, or ANY item name/size contains ALL query words
    let matchedItems = [];
    (inv.items || []).forEach((item) => {
      const itemStr = ((item.name || "") + " " + (item.size || "")).trim();
      if (allWordsIn(itemStr, qWords)) {
        matchedItems.push(item);
      }
    });
    let found = anyFieldAllWords(fields, qWords) || matchedItems.length > 0;
    if (found) {
      // Only show matched items (if any), otherwise show invoice info
      let itemHtml = "";
      if (matchedItems.length > 0) {
        itemHtml = matchedItems
          .map(
            (item) =>
              `<div style="margin-left:12px;font-size:0.97em;">
                        <span style="color:#555;">${highlightKeyword(
                          item.name,
                          q
                        )}${
                item.size ? " (" + highlightKeyword(item.size, q) + ")" : ""
              }</span>
                        <span style="color:#888;">Qty: ${item.qty} ${
                item.unit || ""
              }</span>
                    </div>`
          )
          .join("");
      }
      results.push({
        type: "invoice",
        label: `<b>Invoice:</b> ${highlightKeyword(
          invoiceNumber,
          q
        )} - ${highlightKeyword(customerName, q)} - ${highlightKeyword(
          orderName,
          q
        )}${itemHtml}`,
        ref: invoiceNumber,
      });
    }
  });

  // For expenses, also check all fields and all item names
  expenses.forEach((exp) => {
    const supplier = exp.supplier || "";
    const type = exp.type || "";
    const date = exp.date || "";
    const fields = [supplier, type, date];
    let matchedItems = [];
    (exp.items || []).forEach((item) => {
      const itemStr = (item.name || "").trim();
      if (allWordsIn(itemStr, qWords)) {
        matchedItems.push(item);
      }
    });
    let found = anyFieldAllWords(fields, qWords) || matchedItems.length > 0;
    if (found) {
      let itemHtml = "";
      if (matchedItems.length > 0) {
        itemHtml = matchedItems
          .map(
            (item) =>
              `<div style="margin-left:12px;font-size:0.97em;">
                        <span style="color:#555;">${highlightKeyword(
                          item.name,
                          q
                        )}</span>
                        <span style="color:#888;">Qty: ${item.qty} ${
                item.unit || ""
              }</span>
                    </div>`
          )
          .join("");
      }
      results.push({
        type: "expense",
        label: `<b>Pengeluaran:</b> ${highlightKeyword(
          date,
          q
        )} - ${highlightKeyword(type, q)} - ${highlightKeyword(
          supplier,
          q
        )}${itemHtml}`,
        ref: date + "|" + supplier + "|" + type,
      });
    }
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
        `<div class="search-result-item" data-type="${r.type}" data-ref="${r.ref}" style="padding:8px;cursor:pointer;border-bottom:1px solid #eee;">${r.label}</div>`
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
                        <td class="expense-item-total">0</td>
                        <td><button type="button" class="remove-expense-item">Hapus</button></td>
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
                const subtotal = qty * price;
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
              const subtotal = qty * price;
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
          const price =
            Number(tr2.querySelector(".expense-item-price").value) || 0;
          const subtotal = qty * price;
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

updateTotals();
setMockupPreview();
