import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// التعديل الوحيد هنا: إضافة ./ لأن الملفين بجوار بعضهما في مجلد js
import { updateRealStats } from "./stats.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyD46OEVC7BJZPihUmeWSlMmMjmMoXorn1o",
  authDomain: "sarab-store.firebaseapp.com",
  projectId: "sarab-store",
  storageBucket: "sarab-store.firebasestorage.app",
  messagingSenderId: "629583443040",
  appId: "1:629583443040:web:150fcc4d517fc8f82fbf05",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export let allOrders = [];
let currentEditingId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadOrders();
    setupEventListeners(); // تشغيل المستمعات فور التأكد من تسجيل الدخول
  }
});

function loadOrders() {
  const ordersQuery = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
  );

  onSnapshot(ordersQuery, (snapshot) => {
    const ordersBody = document.getElementById("ordersBody");
    allOrders = [];
    let pending = 0,
      shipping = 0,
      completed = 0;

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const id = docSnap.id;
      allOrders.push({ id, ...order });

      if (order.status === "pending_payment") pending++;
      if (order.status === "shipped" || order.status === "on_the_way")
        shipping++;
      if (order.status === "delivered") completed++;
    });

    renderMainOrdersTable(allOrders);
    window.allOrders = allOrders;
    window.dispatchEvent(
      new CustomEvent("ordersUpdated", { detail: allOrders }),
    );

    updateElementText("pendingCount", pending);
    updateElementText("shippingCount", shipping);
    updateElementText("completedCount", completed);

    if (typeof updateRealStats === "function") {
      updateRealStats("7days");
    }
  });
}

function renderMainOrdersTable(orders) {
  const ordersBody = document.getElementById("ordersBody");
  if (!ordersBody) return;
  ordersBody.innerHTML = "";

  orders.forEach((order) => {
    const id = order.id;
    const row = document.createElement("tr");
    row.innerHTML = `
            <td><span class="ref-badge">${order.referenceCode || id.substring(0, 6)}</span></td>
            <td>
                <div class="customer-info">
                    <strong>${order.customerName || order.customerInfo?.name || "زائر"}</strong><br>
                    <small>${order.customerPhone || order.customerInfo?.phone || ""}</small>
                </div>
            </td>
            <td>
                <button class="view-items-btn" onclick="alert('${escapeHTML(formatItems(order.cartItems || order.items))}')">
                     ${(order.cartItems || order.items)?.length || 0} منتجات
                </button>
            </td>
            <td class="price-cell">${Number(order.totalPrice || order.totalAmount || 0).toLocaleString()} ج.م</td>
            <td><span class="status-tag ${order.status}">${translateStatus(order.status)}</span></td>
            <td>${order.estimatedArrival || "---"}</td>
            <td class="actions-cell">
                <div style="display:flex; gap:8px; justify-content:center;">
                    <button class="btn-edit" title="تعديل الحالة" onclick="window.openEditModal('${id}', '${order.status}', '${order.estimatedArrival || ""}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-view view-details" data-id="${id}" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        `;
    ordersBody.appendChild(row);
  });
}

function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// دالة إعداد المستمعات (لضمان أنها تعمل بعد تحميل الـ DOM)
function setupEventListeners() {
  const closeBtn = document.querySelector(".close-modal");
  if (closeBtn) closeBtn.onclick = window.closeModal;

  const editForm = document.getElementById("editOrderForm");
  if (editForm) {
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const newStatus = document.getElementById("statusSelect").value;
      const etaVal = document.getElementById("etaInput").value;

      if (!currentEditingId) return;

      const orderRef = doc(db, "orders", currentEditingId);
      try {
        await updateDoc(orderRef, {
          status: newStatus,
          estimatedArrival: etaVal ? `${etaVal} أيام` : "لم يحدد",
        });
        console.log("✅ تم التحديث في Firebase");
        window.closeModal();
      } catch (err) {
        console.error("Error updating order:", err);
        alert("فشل التحديث، جرب تاني.");
      }
    };
  }
}

window.openEditModal = (id, currentStatus, currentEta) => {
  currentEditingId = id;
  const modalId = document.getElementById("modalOrderId");
  if (modalId) modalId.innerText = id.substring(0, 8);

  const statusSelect = document.getElementById("statusSelect");
  const etaInput = document.getElementById("etaInput");

  if (statusSelect) statusSelect.value = currentStatus;
  if (etaInput)
    etaInput.value = currentEta ? currentEta.replace(" أيام", "") : "";

  const modal = document.getElementById("editModal");
  if (modal) modal.style.display = "block";
};

window.closeModal = () => {
  const modal = document.getElementById("editModal");
  if (modal) modal.style.display = "none";
};

function translateStatus(s) {
  const map = {
    pending_payment: "انتظار الدفع",
    paid: "تم الدفع",
    shipped: "تم الشحن",
    on_the_way: "في الطريق",
    delivered: "وصل لحضراتكم",
  };
  return map[s] || s;
}

function formatItems(items) {
  return items
    ? items.map((i) => `${i.name} (x${i.quantity})`).join(" | ")
    : "لا يوجد منتجات";
}

function escapeHTML(str) {
  return str?.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".view-details");
  if (btn) {
    const orderId = btn.getAttribute("data-id");
    const order = allOrders.find((o) => o.id === orderId);
    if (order) {
      const dModal = document.getElementById("detailsModal");
      if (dModal) dModal.style.display = "block";
      renderOrderDetails(order);
    }
  }
});

function renderOrderDetails(order) {
  const content = document.getElementById("orderDetailsContent");
  if (!content) return;

  const displayAddress =
    order.address ||
    (order.customerInfo && order.customerInfo.address) ||
    order.customerCity ||
    (order.customerInfo && order.customerInfo.city) ||
    "غير مسجل";

  content.innerHTML = `
        <div class="details-grid-wrapper" dir="rtl">
            <div class="details-section">
                <h4><i class="fas fa-user"></i> العميل</h4>
                <p><strong>الاسم:</strong> ${order.customerName || order.customerInfo?.name || "غير متوفر"}</p>
                <p><strong>الهاتف:</strong> ${order.customerPhone || order.customerInfo?.phone || "---"}</p>
                <p><strong>العنوان:</strong> <span>${displayAddress}</span></p>
            </div>
            <div class="details-section">
                <h4><i class="fas fa-money-bill"></i> المالية</h4>
                <p><strong>الإجمالي:</strong> ${Number(order.totalPrice || order.totalAmount || 0).toLocaleString()} ج.م</p>
                <p><strong>الحالة:</strong> ${translateStatus(order.status)}</p>
            </div>
        </div>
    `;
}