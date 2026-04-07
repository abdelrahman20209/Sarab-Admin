// 1. استيراد المكتبات
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

// استيراد دالة الإحصائيات
import { updateRealStats } from "./stats.js"; 

// 2. الإعدادات
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

// 3. مراقبة حالة تسجيل الدخول
onAuthStateChanged(auth, (user) => {
  if (user) {
    loadOrders();
    setupEventListeners(); 
  } else {
      console.warn("⚠️ لم يتم تسجيل الدخول بصلاحيات الإدارة");
  }
});

// 4. تحميل الطلبات وتحديث العدادات
function loadOrders() {
  const ordersQuery = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
  );

  onSnapshot(ordersQuery, (snapshot) => {
    const ordersBody = document.getElementById("ordersBody");
    if (!ordersBody) return;

    allOrders = [];
    let pending = 0, shipping = 0, completed = 0;

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const id = docSnap.id;
      allOrders.push({ id, ...order });

      // حساب العدادات بناءً على حالة الطلب
      if (order.status === "pending_payment" || order.status === "pending") pending++;
      if (order.status === "shipped" || order.status === "on_the_way") shipping++;
      if (order.status === "delivered") completed++;
    });

    renderMainOrdersTable(allOrders);
    
    // تصدير البيانات للنافذة العالمية
    window.allOrders = allOrders;
    window.dispatchEvent(new CustomEvent("ordersUpdated", { detail: allOrders }));

    // تحديث الأرقام في اللوحة العلويّة
    updateElementText("pendingCount", pending);
    updateElementText("shippingCount", shipping);
    updateElementText("completedCount", completed);

    // تحديث الرسوم البيانية إذا كانت الدالة موجودة
    if (typeof updateRealStats === "function") {
      updateRealStats("7days");
    }
  });
}

// 5. رسم جدول الطلبات
function renderMainOrdersTable(orders) {
  const ordersBody = document.getElementById("ordersBody");
  if (!ordersBody) return;
  ordersBody.innerHTML = "";

  orders.forEach((order) => {
    const id = order.id;
    const row = document.createElement("tr");
    
    // التعامل مع اختلاف مسميات الحقول في قاعدة البيانات
    const totalPrice = order.totalPrice || order.totalAmount || 0;
    const customerName = order.customerName || order.customerInfo?.name || "زائر";
    const customerPhone = order.customerPhone || order.customerInfo?.phone || "---";
    const itemsCount = (order.cartItems || order.items)?.length || 0;

    row.innerHTML = `
            <td><span class="ref-badge">${order.referenceCode || id.substring(0, 6)}</span></td>
            <td>
                <div class="customer-info">
                    <strong>${customerName}</strong><br>
                    <small>${customerPhone}</small>
                </div>
            </td>
            <td>
                <button class="view-items-btn" onclick="alert('${escapeHTML(formatItems(order.cartItems || order.items))}')">
                     ${itemsCount} منتجات
                </button>
            </td>
            <td class="price-cell">${Number(totalPrice).toLocaleString()} ج.م</td>
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

// 6. دوال مساعدة للواجهة
function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function setupEventListeners() {
  // إغلاق المودال عند الضغط على X
  document.querySelectorAll(".close-modal").forEach(btn => {
      btn.onclick = () => {
          window.closeModal();
          const detailsModal = document.getElementById("detailsModal");
          if(detailsModal) detailsModal.style.display = "none";
      };
  });

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
        window.closeModal();
      } catch (err) {
        console.error("Error updating order:", err);
        alert("فشل التحديث، جرب تاني.");
      }
    };
  }
}

// 7. وظائف المودال (النافذة المنبثقة)
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

// 8. المترجم والمنسق
function translateStatus(s) {
  const map = {
    pending_payment: "انتظار الدفع",
    paid: "تم الدفع",
    shipped: "تم الشحن",
    on_the_way: "في الطريق",
    delivered: "وصل لحضراتكم",
    pending: "قيد المراجعة"
  };
  return map[s] || s;
}

function formatItems(items) {
  return items
    ? items.map((i) => `${i.name} (x${i.quantity})`).join(" | ")
    : "لا يوجد منتجات";
}

function escapeHTML(str) {
  return str?.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[m]);
}

// 9. عرض تفاصيل الطلب (Details Modal)
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

  const displayAddress = order.address || order.customerInfo?.address || order.customerCity || "غير مسجل";

  content.innerHTML = `
        <div class="details-grid-wrapper" dir="rtl" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; padding:10px;">
            <div class="details-section" style="background:#151515; padding:15px; border-radius:8px; border:1px solid #333;">
                <h4 style="color:#ffd700; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:12px;">
                    <i class="fas fa-user"></i> بيانات العميل
                </h4>
                <p><strong>الاسم:</strong> ${order.customerName || order.customerInfo?.name || "غير متوفر"}</p>
                <p><strong>الهاتف:</strong> ${order.customerPhone || order.customerInfo?.phone || "---"}</p>
                <p><strong>العنوان:</strong> <span style="color:#aaa;">${displayAddress}</span></p>
            </div>
            <div class="details-section" style="background:#151515; padding:15px; border-radius:8px; border:1px solid #333;">
                <h4 style="color:#ffd700; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:12px;">
                    <i class="fas fa-money-bill"></i> التفاصيل المالية
                </h4>
                <p><strong>الإجمالي:</strong> ${Number(order.totalPrice || order.totalAmount || 0).toLocaleString()} ج.م</p>
                <p><strong>الحالة الحالية:</strong> <span class="status-tag ${order.status}">${translateStatus(order.status)}</span></p>
                <p><strong>تاريخ الطلب:</strong> ${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('ar-EG') : "---"}</p>
            </div>
        </div>
    `;
}
