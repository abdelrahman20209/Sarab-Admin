// 1. استيراد المكتبات (كما هي)
import {
  initializeApp,
  getApps,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. إعدادات Firebase (كما هي)
const firebaseConfig = {
  apiKey: "AIzaSyD46OEVC7BJZPihUmeWSlMmMjmMoXorn1o",
  authDomain: "sarab-store.firebaseapp.com",
  projectId: "sarab-store",
  storageBucket: "sarab-store.firebasestorage.app",
  messagingSenderId: "629583443040",
  appId: "1:629583443040:web:150fcc4d517fc8f82fbf05",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// 3. الإعدادات والمتغيرات
const IMGBB_API_KEY = "96af28066f391086bdad4447630083a2";
let currentEditId = null;

// --- العناصر من الـ HTML ---
const productForm = document.getElementById("productForm");
const statusMessage = document.getElementById("statusMessage");
const adminProductsList = document.getElementById("admin-products-list");
const hasDiscountSelect = document.getElementById("hasDiscount");
const discountSection = document.getElementById("discountSection");
const prodPriceInput = document.getElementById("prodPrice");
const prodDiscountInput = document.getElementById("prodDiscount");
const pricePreview = document.getElementById("pricePreview");

// --- تحديث السعر تلقائياً ---
const updatePricePreview = () => {
  const price = parseFloat(prodPriceInput.value) || 0;
  const discount = parseFloat(prodDiscountInput.value) || 0;
  if (hasDiscountSelect?.value === "yes" && discount > 0) {
    const finalPrice = price - price * (discount / 100);
    pricePreview.innerText = `السعر النهائي: ${finalPrice.toFixed(0)} ج.م`;
  } else {
    if (pricePreview) pricePreview.innerText = "";
  }
};

hasDiscountSelect?.addEventListener("change", () => {
  discountSection.classList.toggle(
    "hidden-fade",
    hasDiscountSelect.value === "no",
  );
  updatePricePreview();
});

[prodPriceInput, prodDiscountInput].forEach((input) =>
  input?.addEventListener("input", updatePricePreview),
);

// --- وظيفة رفع الصور الاحترافية ---
async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();

    if (data.success) {
      console.log("✅ تم رفع الصورة بنجاح:", data.data.url);
      return data.data.url;
    } else {
      console.error("❌ فشل ImgBB:", data.error.message);
      alert("خطأ من ImgBB: " + data.error.message);
      return null;
    }
  } catch (err) {
    console.error("❌ خطأ في الاتصال بالسيرفر:", err);
    alert("فشل الاتصال بسيرفر رفع الصور. تأكد من الإنترنت.");
    return null;
  }
}

// --- إضافة أو تحديث منتج ---
productForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  btn.innerText = "جاري الحفظ  ... ⏳";

  try {
    const imageFile = document.getElementById("prodImage").files[0];
    let imageUrl = null;

    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (!imageUrl) throw new Error("لم يتم رفع الصورة، توقفت العملية.");
    }

    // --- تجميع بيانات المنتج (تم إضافة الحقول الجديدة هنا) ---
    const productData = {
      name: document.getElementById("prodName").value,
      price: parseFloat(prodPriceInput.value),
      hasDiscount: hasDiscountSelect.value === "yes",
      discountPercentage: parseFloat(prodDiscountInput.value) || 0,
      showInStore: document.getElementById("showInStore").checked,
      showInOffers: document.getElementById("showInOffers").checked,
      inStock: document.getElementById("prodStatus").value === "true",
      stockCount: parseInt(document.getElementById("prodStock").value) || 0,

      // الحقول الجديدة لـ "بطاقة التعريف"
      gender: document.getElementById("prodGender").value,
      description: document.getElementById("prodDescription").value,
      size: document.getElementById("prodSize").value,

      updatedAt: serverTimestamp(),
    };

    if (imageUrl) productData.image = imageUrl;

    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), productData);
      statusMessage.innerHTML =
        "<span style='color:#00ff00'>تم تحديث المنتج بنجاح! ✅</span>";
    } else {
      if (!imageUrl) {
        alert("برجاء اختيار صورة للمنتج الجديد!");
        btn.disabled = false;
        btn.innerText = "إضافة المنتج  🚀";
        return;
      }
      productData.createdAt = serverTimestamp();
      await addDoc(collection(db, "products"), productData);
      statusMessage.innerHTML =
        "<span style='color:#00ff00'>تمت الإضافة ! 🚀</span>";
    }

    productForm.reset();
    currentEditId = null;
    btn.innerText = "إضافة المنتج  🚀";
    loadProducts();
  } catch (error) {
    console.error(error);
    statusMessage.innerHTML =
      "<span style='color:red'>خطأ: " + error.message + "</span>";
  } finally {
    btn.disabled = false;
  }
});

// --- عرض المنتجات للأدمن (كما هي) ---
async function loadProducts() {
  if (!adminProductsList) return;
  adminProductsList.innerHTML = "<p>جاري تحميل المنتجات...</p>";
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    adminProductsList.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
      const p = docSnap.data();
      const id = docSnap.id;
      const card = document.createElement("div");
      card.className = "admin-product-item";
      card.style =
        "background:#151515; padding:15px; margin-bottom:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid #333;";
      card.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="${p.image}" width="60" height="60" style="object-fit:cover; border-radius:5px; border: 1px solid #444;">
                    <div>
                        <h4 style="margin:0; color:white;">${p.name}</h4>
                        <p style="margin:2px 0; color:#aaa; font-size:0.9rem;">${p.price} ج.م</p>
                        <small style="color:${p.showInOffers ? "#e30613" : "#888"}; font-weight:bold;">
                            ${p.showInOffers ? "🔥 عروض حصرية" : "🏠 المتجر الرئيسي"}
                        </small>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="editProduct('${id}')" style="background:#007bff; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">تعديل</button>
                    <button onclick="deleteProduct('${id}')" style="background:#e30613; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">حذف</button>
                </div>
            `;
      adminProductsList.appendChild(card);
    });
  } catch (e) {
    console.error("Error loading products:", e);
  }
}

// --- وظيفة الحذف (كما هي) ---
window.deleteProduct = async (id) => {
  if (
    confirm("هل أنت متأكد من حذف هذا العطر ؟ هذا الإجراء لا يمكن التراجع عنه!")
  ) {
    try {
      await deleteDoc(doc(db, "products", id));
      loadProducts();
    } catch (err) {
      alert("فشل الحذف: " + err.message);
    }
  }
};

// --- وظيفة التعديل (تم إضافة استرجاع الحقول الجديدة) ---
window.editProduct = async (id) => {
  try {
    const docSnap = await getDoc(doc(db, "products", id));
    if (docSnap.exists()) {
      const p = docSnap.data();
      document.getElementById("prodName").value = p.name;
      prodPriceInput.value = p.price;
      hasDiscountSelect.value = p.hasDiscount ? "yes" : "no";
      prodDiscountInput.value = p.discountPercentage;
      document.getElementById("showInStore").checked = p.showInStore;
      document.getElementById("showInOffers").checked = p.showInOffers;
      document.getElementById("prodStatus").value = p.inStock.toString();
      document.getElementById("prodStock").value = p.stockCount;

      // استرجاع الحقول الجديدة عند التعديل
      document.getElementById("prodGender").value = p.gender || "unisex";
      document.getElementById("prodDescription").value = p.description || "";
      document.getElementById("prodSize").value = p.size || "";

      currentEditId = id;
      document.getElementById("addBtn").innerText = "تحديث بيانات العطر ✨";
      discountSection.classList.toggle("hidden-fade", !p.hasDiscount);
      updatePricePreview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (err) {
    alert("فشل تحميل البيانات: " + err.message);
  }
};

loadProducts();
