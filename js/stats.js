// stats.js - المحرك التحليلي المطور لبراند سراب
// التعديل: إضافة ./ لضمان الوصول للملف الجار في نفس الفولدر
import { allOrders } from "./admin2.js";

export function updateRealStats(range = "7days") {
  // استخدام البيانات القادمة من الـ Module أو من النافذة العامة كخطة بديلة
  const orders = window.allOrders || allOrders;
  
  if (!orders || orders.length === 0) {
      console.warn("⚠️ لا توجد بيانات أوردرات لتحليلها حالياً.");
      return;
  }

  // 1. تصفية المبيعات (الأوردرات الصالحة فقط)
  const activeOrders = orders.filter((o) =>
    ["delivered", "shipped", "on_the_way", "paid", "pending_payment"].includes(
      o.status
    )
  );

  const totalRevenue = activeOrders.reduce(
    (sum, o) => sum + Number(o.totalPrice || o.totalAmount || 0),
    0
  );
  
  const avgOrderValue =
    activeOrders.length > 0
      ? Math.round(totalRevenue / activeOrders.length)
      : 0;

  // 2. تحليل المنتجات (الأكثر مبيعاً)
  const productCounts = {};
  orders.forEach((order) => {
    const items = order.cartItems || order.items;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const name = item.name || "عطر مجهول";
        productCounts[name] =
          (productCounts[name] || 0) + Number(item.quantity || 1);
      });
    }
  });

  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 3. معالجة بيانات المنحنى الزمني
  const salesData = processSalesData(orders, range);

  // --- تحديث الأرقام والعدادات في الواجهة ---
  animateValue("totalRevenue", 0, totalRevenue, 1200, " ج.م");
  animateValue("avgOrderValue", 0, avgOrderValue, 1200, " ج.م");
  animateValue(
    "totalCustomers",
    0,
    new Set(orders.map((o) => o.customerPhone || o.id)).size,
    1200,
    ""
  );

  // --- رسم الشارتات (الثلاثة) ---
  renderSalesLineChart(salesData.labels, salesData.values);
  renderProductsPieChart(
    topProducts.map((p) => p[0]),
    topProducts.map((p) => p[1])
  );
  renderOrderStatusChart(orders); 
}

/**
 * رسم شارت حالات الطلبات (المربع الأيسر)
 */
function renderOrderStatusChart(orders) {
  const canvas = document.getElementById("orderStatusChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const statusCounts = {
    pending: 0,
    shipped: 0,
    delivered: 0,
    canceled: 0,
  };

  orders.forEach((o) => {
    // توحيد الحالات لتناسب الشارت
    let s = o.status || "pending";
    if (s === "pending_payment") s = "pending";
    if (s === "on_the_way") s = "shipped";
    
    if (statusCounts.hasOwnProperty(s)) statusCounts[s]++;
  });

  if (window.statusChartInstance) window.statusChartInstance.destroy();

  window.statusChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["قيد الانتظار", "تم الشحن", "تم التوصيل", "ملغي"],
      datasets: [
        {
          data: [
            statusCounts.pending,
            statusCounts.shipped,
            statusCounts.delivered,
            statusCounts.canceled,
          ],
          backgroundColor: ["#ffd700", "#3498db", "#e30613", "#444"],
          borderRadius: 5,
          barThickness: 20,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#222" },
          ticks: { color: "#888", stepSize: 1 },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#ccc", font: { family: "Cairo", size: 10 } },
        },
      },
    },
  });
}

// --- باقي الدوال المساعدة ---

function processSalesData(orders, range) {
  const salesMap = {};
  const now = new Date();
  let daysToTrack = range === "month" ? 30 : range === "6months" ? 180 : range === "year" ? 365 : 7;

  for (let i = 0; i < daysToTrack; i++) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split("T")[0];
    salesMap[key] = 0;
  }

  orders.forEach((order) => {
    let dateObj = null;
    if (order.createdAt?.seconds) {
      dateObj = new Date(order.createdAt.seconds * 1000);
    } else if (order.createdAt) {
      dateObj = new Date(order.createdAt);
    }

    if (dateObj && !isNaN(dateObj)) {
      const key = dateObj.toISOString().split("T")[0];
      if (salesMap.hasOwnProperty(key)) {
        salesMap[key] += Number(order.totalPrice || order.totalAmount || 0);
      }
    }
  });

  const sortedKeys = Object.keys(salesMap).sort();
  const labels = sortedKeys.map((k) => {
    const d = new Date(k);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  });
  const values = sortedKeys.map((k) => salesMap[k]);
  return { labels, values };
}

function renderSalesLineChart(labels, data) {
  const canvas = document.getElementById("salesChart");
  if (!canvas) return;
  if (window.salesChartInstance) window.salesChartInstance.destroy();

  window.salesChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "المبيعات",
        data: data,
        borderColor: "#e30613",
        backgroundColor: "rgba(227, 6, 19, 0.1)",
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#fff",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: "#222" }, ticks: { color: "#888" } },
        x: { grid: { display: false }, ticks: { color: "#888" } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function renderProductsPieChart(labels, data) {
  const canvas = document.getElementById("productsPieChart");
  if (!canvas) return;
  if (window.prodChartInstance) window.prodChartInstance.destroy();

  window.prodChartInstance = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ["#e30613", "#860000", "#ffd700", "#1a1a1a", "#444"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "75%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#ccc", font: { family: "Cairo", size: 11 } },
        },
      },
    },
  });
}

function animateValue(id, start, end, duration, suffix = "") {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const current = Math.floor(progress * (end - start) + start);
    obj.innerHTML = current.toLocaleString("en-US") + suffix;
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}