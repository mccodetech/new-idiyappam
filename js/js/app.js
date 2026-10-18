import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let storesDataCache = {};
let currentUserId = null;
const defaultRates = { idiyappam: 5, vellappam: 6, palappam: 6, pathiri: 4, porotta: 10, chapati: 8 };

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7);
    ['p-date', 's-date', 'pay-date', 'report-date-input'].forEach(id => {
        const el = document.getElementById(id);
        if(el && !el.value) el.value = today;
    });
    const monthEl = document.getElementById('report-month-input');
    if(monthEl && !monthEl.value) monthEl.value = currentMonth;
}

window.showAlert = (title, msg, isSuccess = true) => {
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-msg').innerText = msg;
    document.getElementById('alert-icon').innerText = isSuccess ? '✅' : '⚠️';
    document.getElementById('custom-alert').classList.remove('hidden');
};

window.closeAlert = () => document.getElementById('custom-alert').classList.add('hidden');

window.togglePassword = () => { 
    const p = document.getElementById('password'); 
    p.type = p.type === 'password' ? 'text' : 'password'; 
};

window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('hidden');
    setTimeout(() => sb.classList.toggle('-translate-x-full'), 10);
};

window.switchTab = (tabName) => {
    ['purchase', 'sales', 'stores', 'store-list', 'reports', 'edit-sales', 'edit-purchase', 'accounts', 'payments'].forEach(t => {
        const el = document.getElementById(`section-${t}`);
        if(el) el.classList.add('hidden');
        const tabEl = document.getElementById(`tab-${t}`);
        if(tabEl) tabEl.className = "py-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-xl hover:bg-slate-800 transition text-xs font-bold";
    });

    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    const targetTab = document.getElementById(`tab-${tabName}`);
    if(targetTab) targetTab.className = "py-3 bg-emerald-600 text-white rounded-xl shadow-lg transition text-xs font-bold";

    const mainTabs = document.getElementById('main-tabs');
    if(tabName === 'purchase' || tabName === 'sales') {
        mainTabs.classList.remove('hidden');
        loadStoresDropdown();
        setDefaultDate();
    } else {
        mainTabs.classList.add('hidden');
        if(tabName === 'stores') { setStoreMode('add'); loadStoresDropdown(); }
        if(tabName === 'store-list') loadStoreList();
        if(tabName === 'reports') { loadStoresDropdown(); toggleReportInputs(); }
        if(tabName === 'accounts') loadAccountsSummary();
        if(tabName === 'payments') loadStoresDropdown();
        if(tabName === 'edit-sales') loadEditList('sales');
        if(tabName === 'edit-purchase') loadEditList('purchases');
    }
};

window.toggleReportInputs = () => {
    const duration = document.getElementById('report-duration').value;
    const dailyBox = document.getElementById('daily-input-container');
    const monthlyBox = document.getElementById('monthly-input-container');
    dailyBox.classList.add('hidden');
    monthlyBox.classList.add('hidden');
    if(duration === 'daily') dailyBox.classList.remove('hidden');
    if(duration === 'monthly') monthlyBox.classList.remove('hidden');
};

window.clearForm = (type) => {
    if(type === 'purchase') {
        document.getElementById('edit-purchase-id').value = '';
        document.getElementById('p-store').value = '';
        document.getElementById('p-paid-amt').value = '';
        document.getElementById('p-form-title').innerText = "പർച്ചേസ് എൻട്രി";
        ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
            document.getElementById(`p-qty-${item}`).value = '';
            document.getElementById(`p-amt-${item}`).innerText = '₹0';
        });
        document.getElementById('p-grand-total').innerText = '₹0';
    } else if(type === 'sales') {
        document.getElementById('edit-sales-id').value = '';
        document.getElementById('s-store').value = '';
        document.getElementById('s-paid-amt').value = '';
        document.getElementById('s-balance-amt').innerText = '₹0';
        document.getElementById('s-form-title').innerText = "സെയിൽസ് / ഓർഡർ";
        ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
            document.getElementById(`s-qty-${item}`).value = '';
            document.getElementById(`s-amt-${item}`).innerText = '₹0';
        });
        document.getElementById('s-grand-total').innerText = '₹0';
    } else if(type === 'payments') {
        document.getElementById('pay-store').value = '';
        document.getElementById('pay-amount').value = '';
    } else if(type === 'stores') {
        document.getElementById('edit-store-id').value = '';
        document.getElementById('store-name').value = '';
        document.getElementById('owner-name').value = '';
        document.getElementById('store-place').value = '';
        document.getElementById('store-phone').value = '';
        document.getElementById('store-opening-balance').value = '';
    }
    setDefaultDate();
    showAlert("റദ്ദാക്കി", "ഫീൽഡുകൾ ക്ലിയർ ചെയ്തിരിക്കുന്നു.", true);
};

window.setStoreMode = async (mode) => {
    ['add', 'edit', 'delete'].forEach(m => {
        const btn = document.getElementById(`store-mode-${m}`);
        btn.className = "py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition";
    });
    document.getElementById(`store-mode-${mode}`).className = "py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg transition";

    const formContainer = document.getElementById('store-form-container');
    const deleteContainer = document.getElementById('store-delete-container');
    const editSelect = document.getElementById('existing-store-select');
    const formLabel = document.getElementById('store-form-label');
    const actionBtn = document.getElementById('store-action-btn');

    if(mode === 'add') {
        formContainer.classList.remove('hidden');
        deleteContainer.classList.add('hidden');
        editSelect.classList.add('hidden');
        formLabel.innerText = "പുതിയ കട ചേർക്കുക (ADD)";
        actionBtn.innerText = "കട സേവ് ചെയ്യുക";
        actionBtn.className = "flex-1 bg-emerald-600 text-white p-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition";
        document.getElementById('edit-store-id').value = '';
        document.getElementById('store-name').value = '';
        document.getElementById('owner-name').value = '';
        document.getElementById('store-place').value = '';
        document.getElementById('store-phone').value = '';
        document.getElementById('store-opening-balance').value = '';
        ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(i => {
            document.getElementById(`store-rate-${i}`).value = defaultRates[i];
        });
    } else if(mode === 'edit') {
        formContainer.classList.remove('hidden');
        deleteContainer.classList.add('hidden');
        editSelect.classList.remove('hidden');
        formLabel.innerText = "കട എഡിറ്റ് ചെയ്യുക (EDIT)";
        actionBtn.innerText = "മാറ്റങ്ങൾ അപ്ഡേറ്റ് ചെയ്യുക";
        actionBtn.className = "flex-1 bg-blue-600 text-white p-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition";
        await loadStoresForDropdown('existing-store-select');
    } else if(mode === 'delete') {
        formContainer.classList.add('hidden');
        deleteContainer.classList.remove('hidden');
        await loadStoresForDropdown('delete-store-select');
    }
};

async function loadStoresForDropdown(elementId) {
    const select = document.getElementById(elementId);
    select.innerHTML = '<option value="">കട തിരഞ്ഞെടുക്കുക</option>';
    storesDataCache = {};
    const q = query(collection(db, "stores"), where("userId", "==", currentUserId));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
        const data = docSnap.data();
        storesDataCache[docSnap.id] = data;
        select.innerHTML += `<option value="${docSnap.id}">${data.name} (${data.place || 'വിലാസമില്ല'})</option>`;
    });
}

async function loadStoreList() {
    const container = document.getElementById('store-list-container');
    container.innerHTML = "<p class='text-slate-500 text-center py-4'>ലോഡ് ചെയ്യുന്നു...</p>";
    let html = "";
    try {
        const q = query(collection(db, "stores"), where("userId", "==", currentUserId));
        const snap = await getDocs(q);
        
        snap.forEach(docSnap => {
            let data = docSnap.data();
            html += `
                <div class="bg-slate-900 p-4 border border-slate-800 rounded-2xl mb-2.5 shadow-md">
                    <div class="font-extrabold text-emerald-400 text-sm">${data.name}</div>
                    <div class="text-slate-300 text-xs mt-2 space-y-1">
                        <div>ഓണർ: <span class="text-white font-medium">${data.owner || '-'}</span></div>
                        <div>സ്ഥലം: <span class="text-white font-medium">${data.place || '-'}</span></div>
                        <div>ഫോൺ: <span class="text-white font-medium">${data.phone || '-'}</span></div>
                        <div>തുടക്കത്തിലെ ബാലൻസ്: <span class="text-rose-400 font-bold">₹${data.openingBalance || 0}</span></div>
                    </div>
                </div>`;
        });
        container.innerHTML = html || "<p class='text-slate-500 text-center py-4'>കടകൾ ലഭ്യമല്ല. പുതിയ കടകൾ ADD ചെയ്യുക.</p>";
    } catch (error) {
        container.innerHTML = `<p class='text-rose-400 text-center py-4'>ഡാറ്റ ലോഡ് ചെയ്യുന്നതിൽ പിഴവുണ്ടായി: ${error.message}</p>`;
    }
}

window.fillStoreDataForEdit = () => {
    const id = document.getElementById('existing-store-select').value;
    if(!id) return;
    const data = storesDataCache[id];
    document.getElementById('edit-store-id').value = id;
    document.getElementById('store-name').value = data.name || '';
    document.getElementById('owner-name').value = data.owner || '';
    document.getElementById('store-place').value = data.place || '';
    document.getElementById('store-phone').value = data.phone || '';
    document.getElementById('store-opening-balance').value = data.openingBalance || '';
    let rates = data.rates || defaultRates;
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(i => {
        document.getElementById(`store-rate-${i}`).value = rates[i] || defaultRates[i];
    });
};

window.saveStoreAction = async () => {
    const storeId = document.getElementById('edit-store-id').value;
    const name = document.getElementById('store-name').value.trim();
    const owner = document.getElementById('owner-name').value.trim();
    const place = document.getElementById('store-place').value.trim();
    const phone = document.getElementById('store-phone').value.trim();
    const openingBalance = Number(document.getElementById('store-opening-balance').value) || 0;
    if(!name || !phone) return showAlert("ശ്രദ്ധിക്കുക", "പേരും ഫോൺ നമ്പറും നൽകുക!", false);

    let rates = {};
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(i => {
        rates[i] = Number(document.getElementById(`store-rate-${i}`).value) || defaultRates[i];
    });

    if(storeId) {
        await updateDoc(doc(db, "stores", storeId), { name, owner, place, phone, openingBalance, rates, userId: currentUserId });
        showAlert("വിജയം", "കട വിജയകരമായി എഡിറ്റ് ചെയ്ത് അപ്ഡേറ്റ് ചെയ്തു!");
    } else {
        await addDoc(collection(db, "stores"), { name, owner, place, phone, openingBalance, rates, userId: currentUserId });
        showAlert("വിജയം", "പുതിയ കട ADD ചെയ്തു!");
    }
    clearForm('stores');
    loadStoresDropdown();
    if(storeId) setStoreMode('edit');
};

window.deleteStoreAction = async () => {
    const storeId = document.getElementById('delete-store-select').value;
    if(!storeId) return showAlert("ശ്രദ്ധിക്കുക", "ഡിലീറ്റ് ചെയ്യാൻ കട തിരഞ്ഞെടുക്കുക!", false);

    const storeName = storesDataCache[storeId]?.name;
    const pCheck = await getDocs(query(collection(db, "purchases"), where("userId", "==", currentUserId), where("store", "==", storeName)));
    const sCheck = await getDocs(query(collection(db, "sales"), where("userId", "==", currentUserId), where("store", "==", storeName)));

    if(!pCheck.empty || !sCheck.empty) {
        return showAlert("മുന്നറിയിപ്പ്", "ഈ കടയുമായി ബന്ധപ്പെട്ട പർച്ചേസ്/സെയിൽസ് ഡാറ്റ നിലവിലുള്ളതിനാൽ കട ഡിലീറ്റ് ചെയ്യാൻ കഴിയില്ല!", false);
    }

    if(confirm("ഈ കട പൂർണ്ണമായി DELETE ചെയ്യണമെന്ന് ഉറപ്പാണോ?")) {
        await deleteDoc(doc(db, "stores", storeId));
        showAlert("വിജയം", "കട ഡിലീറ്റ് ചെയ്തു!");
        setStoreMode('delete');
        loadStoresDropdown();
    }
};

window.loginUser = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if(!email || !password) return showAlert("ശ്രദ്ധിക്കുക", "ഇമെയിലും പാസ്‌വേർഡും നൽകുക!", false);
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch(err) {
        showAlert("ലോഗിൻ പരാജയപ്പെട്ടു", err.message, false);
    }
};

window.registerUser = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if(!email || !password) return showAlert("ശ്രദ്ധിക്കുക", "ഇമെയിലും പാസ്‌വേർഡും നൽകുക!", false);
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showAlert("വിജയം", "അക്കൗണ്ട് വിജയകരമായി ക്രിയേറ്റ് ചെയ്തു!");
    } catch(err) {
        showAlert("രജിസ്ട്രേഷൻ പരാജയം", err.message, false);
    }
};

window.confirmLogout = () => { if(confirm("ലോഗ് ഔട്ട് ചെയ്യണോ?")) signOut(auth); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        
        if (window.innerWidth <= 768) {
            document.getElementById('menu-btn').classList.remove('hidden');
        } else {
            document.getElementById('menu-btn').classList.add('hidden');
        }

        loadStoresDropdown();
        setDefaultDate();
        switchTab('purchase');
    } else {
        currentUserId = null;
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('menu-btn').classList.add('hidden');
    }
});

async function loadStoresDropdown() {
    const pSelect = document.getElementById('p-store');
    const sSelect = document.getElementById('s-store');
    const paySelect = document.getElementById('pay-store');
    const rSelect = document.getElementById('report-store');
    if(pSelect) pSelect.innerHTML = '<option value="">കട തിരഞ്ഞെടുക്കുക</option>';
    if(sSelect) sSelect.innerHTML = '<option value="">കട തിരഞ്ഞെടുക്കുക</option>';
    if(paySelect) paySelect.innerHTML = '<option value="">കട തിരഞ്ഞെടുക്കുക</option>';
    if(rSelect) rSelect.innerHTML = '<option value="">എല്ലാ കടകളും (All Stores)</option>';
    
    storesDataCache = {};
    try {
        const q = query(collection(db, "stores"), where("userId", "==", currentUserId));
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const data = docSnap.data();
            storesDataCache[docSnap.id] = data;
            const opt = `<option value="${data.name}" data-rates='${JSON.stringify(data.rates || defaultRates)}' data-phone="${data.phone}">${data.name}${data.place ? ', '+data.place : ''}</option>`;
            if(pSelect) pSelect.innerHTML += opt;
            if(sSelect) sSelect.innerHTML += opt;
            if(paySelect) paySelect.innerHTML += opt;
            if(rSelect) rSelect.innerHTML += `<option value="${data.name}">${data.name}${data.place ? ', '+data.place : ''}</option>`;
        });
        updateRatesView('p');
        updateRatesView('s');
    } catch(e) {
        console.error("Error loading stores:", e);
    }
}

window.updateRatesView = (type) => {
    const select = document.getElementById(`${type}-store`);
    const opt = select.options[select.selectedIndex];
    let rates = defaultRates;
    if(opt && opt.getAttribute('data-rates')) {
        try { rates = JSON.parse(opt.getAttribute('data-rates')); } catch(e){}
    }
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(i => {
        document.getElementById(`${type}-rate-${i}`).innerText = rates[i] || defaultRates[i];
        calculateRowTotal(type, i);
    });
};

window.calculateRowTotal = (type, item) => {
    const rate = Number(document.getElementById(`${type}-rate-${item}`).innerText) || 0;
    const qty = Number(document.getElementById(`${type}-qty-${item}`).value) || 0;
    const amt = rate * qty;
    document.getElementById(`${type}-amt-${item}`).innerText = `₹${amt}`;

    let grandTotal = 0;
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(i => {
        let r = Number(document.getElementById(`${type}-rate-${i}`).innerText) || 0;
        let q = Number(document.getElementById(`${type}-qty-${i}`).value) || 0;
        grandTotal += r * q;
    });
    document.getElementById(`${type}-grand-total`).innerText = `₹${grandTotal}`;
    if(type === 'sales') calculateBalance();
};

window.calculateBalance = () => {
    let grandTotal = Number(document.getElementById('s-grand-total').innerText.replace('₹','')) || 0;
    let paid = Number(document.getElementById('s-paid-amt').value) || 0;
    let balance = grandTotal - paid;
    document.getElementById('s-balance-amt').innerText = `₹${balance}`;
};

window.savePaymentEntry = async () => {
    const date = document.getElementById('pay-date').value;
    const store = document.getElementById('pay-store').value;
    const type = document.getElementById('pay-type').value;
    const amount = Number(document.getElementById('pay-amount').value) || 0;

    if(!date || !store || amount <= 0) return showAlert("ശ്രദ്ധിക്കുക", "തീയതി, കട, തുക എന്നിവ ശരിയായി നൽകുക!", false);

    await addDoc(collection(db, "payments"), {
        date, store, type, amount, userId: currentUserId, timestamp: new Date()
    });

    showAlert("വിജയം", "പണമിടപാട് വിജയകരമായി സേവ് ചെയ്തു!");
    clearForm('payments');
};

async function loadAccountsSummary() {
    const container = document.getElementById('accounts-list-container');
    container.innerHTML = "<p class='text-slate-500 text-center py-4'>ലോഡ് ചെയ്യുന്നു...</p>";
    let storeAccounts = {};

    const qStores = query(collection(db, "stores"), where("userId", "==", currentUserId));
    const snapStores = await getDocs(qStores);
    snapStores.forEach(doc => {
        let data = doc.data();
        storeAccounts[data.name] = { 
            totalSales: 0, 
            totalGiven: 0, 
            totalReceived: 0, 
            totalPurchase: 0, 
            balance: 0, 
            openingBalance: Number(data.openingBalance || 0),
            firstTxDate: null 
        };
    });

    const qSales = query(collection(db, "sales"), where("userId", "==", currentUserId));
    const snapSales = await getDocs(qSales);
    snapSales.forEach(doc => {
        let d = doc.data();
        if(!storeAccounts[d.store]) {
            storeAccounts[d.store] = { totalSales: 0, totalGiven: 0, totalReceived: 0, totalPurchase: 0, balance: 0, openingBalance: 0, firstTxDate: null };
        }
        storeAccounts[d.store].totalSales += (d.totalAmount || 0);
        storeAccounts[d.store].totalReceived += (d.paidAmount || 0);
        if(!storeAccounts[d.store].firstTxDate || d.date < storeAccounts[d.store].firstTxDate) {
            storeAccounts[d.store].firstTxDate = d.date;
        }
    });

    const qPurchases = query(collection(db, "purchases"), where("userId", "==", currentUserId));
    const snapPurchases = await getDocs(qPurchases);
    snapPurchases.forEach(doc => {
        let d = doc.data();
        if(!storeAccounts[d.store]) {
            storeAccounts[d.store] = { totalSales: 0, totalGiven: 0, totalReceived: 0, totalPurchase: 0, balance: 0, openingBalance: 0, firstTxDate: null };
        }
        storeAccounts[d.store].totalPurchase += (d.totalAmount || 0);
        storeAccounts[d.store].totalReceived += (d.paidAmount || 0);
        if(!storeAccounts[d.store].firstTxDate || d.date < storeAccounts[d.store].firstTxDate) {
            storeAccounts[d.store].firstTxDate = d.date;
        }
    });

    const qPayments = query(collection(db, "payments"), where("userId", "==", currentUserId));
    const snapPayments = await getDocs(qPayments);
    snapPayments.forEach(doc => {
        let d = doc.data();
        if(!storeAccounts[d.store]) {
            storeAccounts[d.store] = { totalSales: 0, totalGiven: 0, totalReceived: 0, totalPurchase: 0, balance: 0, openingBalance: 0, firstTxDate: null };
        }
        if(d.type === 'received') {
            storeAccounts[d.store].totalReceived += (d.amount || 0);
        } else if(d.type === 'given') {
            storeAccounts[d.store].totalGiven += (d.amount || 0);
        }
        if(!storeAccounts[d.store].firstTxDate || d.date < storeAccounts[d.store].firstTxDate) {
            storeAccounts[d.store].firstTxDate = d.date;
        }
    });

    let html = "";
    for(let store in storeAccounts) {
        let acc = storeAccounts[store];
        acc.balance = acc.openingBalance + acc.totalSales - acc.totalReceived - acc.totalPurchase + acc.totalGiven;
        
        html += `
            <div class="bg-slate-900 p-4 border border-slate-800 rounded-2xl mb-2.5 shadow-md">
                <div class="flex justify-between items-center mb-2">
                    <div class="font-extrabold text-emerald-400 text-sm">${store}</div>
                    <div class="text-[11px] text-slate-400">തുടങ്ങിയ തീയതി: <span class="text-white font-bold">${acc.firstTxDate || 'ഇടപാടുകൾ ഇല്ല'}</span></div>
                </div>
                ${acc.openingBalance !== 0 ? `<div class="text-[11px] text-rose-400 font-bold mb-2">തുടക്കത്തിലെ ബാലൻസ് (Opening): ₹${acc.openingBalance}</div>` : ''}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-xs border-t border-slate-800/60 pt-2">
                    <div>ആകെ സെയിൽസ്: <span class="font-bold text-emerald-400">₹${acc.totalSales}</span></div>
                    <div>ആകെ പർച്ചേസ്: <span class="font-bold text-blue-400">₹${acc.totalPurchase}</span></div>
                    <div>ലഭിച്ച തുക: <span class="font-bold text-emerald-400">₹${acc.totalReceived}</span></div>
                    <div>നൽകിയ തുക: <span class="font-bold text-rose-400">₹${acc.totalGiven}</span></div>
                </div>
                <div class="flex justify-between font-bold text-rose-400 mt-3 border-t border-slate-800/60 pt-2 text-xs">
                    <span>ബാക്കി ബാലൻസ് (Closing):</span>
                    <span>₹${acc.balance}</span>
                </div>
            </div>`;
    }
    container.innerHTML = html || "<p class='text-slate-500 text-center py-4'>കടകൾ ലഭ്യമല്ല</p>";
}

window.loadEditList = async (colName) => {
    const container = document.getElementById(colName === 'sales' ? 'edit-sales-list' : 'edit-purchase-list');
    container.innerHTML = "<p class='text-slate-500 text-center py-4'>ലോഡ് ചെയ്യുന്നു...</p>";
    const q = query(collection(db, colName), where("userId", "==", currentUserId));
    const snap = await getDocs(q);
    if(snap.empty) return container.innerHTML = '<p class="text-slate-500 text-center py-4">ഡാറ്റ ലഭ്യമല്ല</p>';

    let html = "";
    snap.forEach(docSnap => {
        const data = docSnap.data();
        html += `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-3.5 border border-slate-800 rounded-xl mb-2 gap-2">
                <div class="text-xs"><b class="text-emerald-400">${data.date}</b> | <span class="text-white">${data.store}</span> (<span class="text-emerald-400 font-bold">₹${data.totalAmount}</span>)</div>
                <div class="flex gap-2 w-full sm:w-auto justify-end">
                    <button onclick="editEntry('${colName}', '${docSnap.id}', '${data.date}', '${data.store}', ${JSON.stringify(data.items).replace(/"/g, '&quot;')}, ${data.paidAmount||0})" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition">EDIT</button>
                    <button onclick="deleteEntry('${colName}', '${docSnap.id}')" class="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition">DELETE</button>
                </div>
            </div>`;
    });
    container.innerHTML = html;
};

window.deleteEntry = async (colName, id) => {
    if(confirm("ഈ എൻട്രി DELETE ചെയ്യണോ?")) {
        await deleteDoc(doc(db, colName, id));
        showAlert("വിജയം", "എൻട്രി DELETE ചെയ്തു!");
        loadEditList(colName);
    }
};

window.editEntry = (colName, id, date, store, items, paidAmt) => {
    switchTab(colName === 'sales' ? 'sales' : 'purchase');
    if(colName === 'sales') {
        document.getElementById('edit-sales-id').value = id;
        document.getElementById('s-date').value = date;
        document.getElementById('s-store').value = store;
        updateRatesView('s');
        ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
            document.getElementById(`s-qty-${item}`).value = items[item] || '';
            calculateRowTotal('s', item);
        });
        document.getElementById('s-paid-amt').value = paidAmt || '';
        calculateBalance();
        document.getElementById('s-form-title').innerText = "സെയിൽസ് EDIT മോഡ്";
    } else {
        document.getElementById('edit-purchase-id').value = id;
        document.getElementById('p-date').value = date;
        document.getElementById('p-store').value = store;
        updateRatesView('p');
        ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
            document.getElementById(`p-qty-${item}`).value = items[item] || '';
            calculateRowTotal('p', item);
        });
        document.getElementById('p-form-title').innerText = "പർച്ചേസ് EDIT മോഡ്";
    }
    showAlert("ശ്രദ്ധിക്കുക", "ഫീൽഡിൽ ഡാറ്റ ലോഡ് ചെയ്തിട്ടുണ്ട്. മാറ്റങ്ങൾ വരുത്തി വീണ്ടും സേവ് ചെയ്യുക.");
};

window.saveTransaction = async (type) => {
    const editId = document.getElementById(type === 'purchase' ? 'edit-purchase-id' : 'edit-sales-id').value;
    const dateInput = document.getElementById(`${type === 'purchase' ? 'p' : 's'}-date`);
    const storeSelect = document.getElementById(`${type === 'purchase' ? 'p' : 's'}-store`);
    if(!dateInput.value || !storeSelect.value) return showAlert("ശ്രദ്ധിക്കുക", "തീയതിയും കടയും തിരഞ്ഞെടുക്കുക!", false);

    let itemsData = {}, totalAmount = 0;
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
        let qty = Number(document.getElementById(`${type === 'purchase' ? 'p' : 's'}-qty-${item}`).value) || 0;
        let rate = Number(document.getElementById(`${type === 'purchase' ? 'p' : 's'}-rate-${item}`).innerText) || 0;
        itemsData[item] = qty;
        totalAmount += qty * rate;
    });

    if(totalAmount === 0) return showAlert("ശ്രദ്ധിക്കുക", "കുറഞ്ഞത് ഒരു സാധനത്തിന്റെ എങ്കിലും എണ്ണം നൽകുക!", false);

    let paidAmount = type === 'sales' ? (Number(document.getElementById('s-paid-amt').value) || 0) : (Number(document.getElementById('p-paid-amt').value) || 0);
    let balanceAmount = totalAmount - paidAmount;

    const colName = type === 'purchase' ? 'purchases' : 'sales';
    if(editId) {
        await deleteDoc(doc(db, colName, editId)); 
    }

    await addDoc(collection(db, colName), {
        date: dateInput.value, store: storeSelect.value, items: itemsData, totalAmount, paidAmount, balanceAmount, userId: currentUserId, timestamp: new Date()
    });
    
    showAlert("വിജയം", `${type === 'purchase' ? 'പർച്ചേസ്' : 'സെയിൽസ്'} വിജയകരമായി സേവ് ചെയ്തു!`);
    clearForm(type);
};

window.sendWhatsAppOrder = () => {
    const storeSelect = document.getElementById('s-store');
    const store = storeSelect.value;
    const phone = storeSelect.options[storeSelect.selectedIndex]?.getAttribute('data-phone');
    if(!phone || !store) return showAlert("ശ്രദ്ധിക്കുക", "കടയും ഫോൺ നമ്പറും തിരഞ്ഞെടുക്കുക!", false);

    let total = 0, msg = `*ന്യൂ ഇടിയപ്പം കമ്പനി*%0Aകട: ${store}%0A------------------%0A`;
    let hasItems = false;
    ['idiyappam', 'vellappam', 'palappam', 'pathiri', 'porotta', 'chapati'].forEach(item => {
        let qty = Number(document.getElementById(`s-qty-${item}`).value) || 0;
        let rate = Number(document.getElementById(`s-rate-${item}`).innerText) || 0;
        if(qty > 0) {
            hasItems = true;
            let amt = qty * rate;
            total += amt;
            msg += `${item}: ${qty} x ${rate} = ₹${amt}%0A`;
        }
    });
    if(!hasItems) return showAlert("ശ്രദ്ധിക്കുക", "കുറഞ്ഞത് ഒരു സാധനമെങ്കിലും എണ്ണം നൽകുക!", false);

    let paid = Number(document.getElementById('s-paid-amt').value) || 0;
    let balance = total - paid;

    msg += `------------------%0A*ആകെ തുക: ₹${total}*`;
    if(paid > 0) msg += `%0Aലഭിച്ചത്: ₹${paid}%0A*ബാക്കി ബാലൻസ്: ₹${balance}*`;
    msg += `%0Aനന്ദി!`;
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
};

async function fetchFilteredTransactions(duration, selectedDate, selectedMonth, store) {
    let storeOpeningBalance = 0;
    if(store && storesDataCache) {
        for(let id in storesDataCache) {
            if(storesDataCache[id].name === store) {
                storeOpeningBalance = Number(storesDataCache[id].openingBalance || 0);
            }
        }
    }

    let allTransactions = [];

    const qP = query(collection(db, "purchases"), where("userId", "==", currentUserId));
    const pSnap = await getDocs(qP);
    pSnap.forEach(doc => {
        let d = doc.data();
        if(!store || d.store === store) {
            allTransactions.push({ ...d, transType: 'Purchase', sortDate: d.timestamp?.seconds || 0 });
        }
    });

    const qS = query(collection(db, "sales"), where("userId", "==", currentUserId));
    const sSnap = await getDocs(qS);
    sSnap.forEach(doc => {
        let d = doc.data();
        if(!store || d.store === store) {
            allTransactions.push({ ...d, transType: 'Sales', sortDate: d.timestamp?.seconds || 0 });
        }
    });

    const qPay = query(collection(db, "payments"), where("userId", "==", currentUserId));
    const paySnap = await getDocs(qPay);
    paySnap.forEach(doc => {
        let d = doc.data();
        if(!store || d.store === store) {
            allTransactions.push({ ...d, transType: d.type === 'received' ? 'Payment Received' : 'Payment Given', totalAmount: d.amount, sortDate: d.timestamp?.seconds || 0 });
        }
    });

    allTransactions.sort((a, b) => a.sortDate - b.sortDate);

    let runningBalance = storeOpeningBalance;
    let filteredTransactions = [];

    allTransactions.forEach(d => {
        let include = false;
        if(duration === 'all') {
            include = true;
        } else if(duration === 'daily' && d.date === selectedDate) {
            include = true;
        } else if(duration === 'monthly' && d.date.startsWith(selectedMonth)) {
            include = true;
        }

        let netChange = 0;
        if(d.transType === 'Sales') {
            netChange = (d.totalAmount || 0);
        } else if(d.transType === 'Payment Received') {
            netChange = -(d.totalAmount || 0);
        } else if(d.transType === 'Payment Given') {
            netChange = (d.totalAmount || 0);
        } else if(d.transType === 'Purchase') {
            netChange = -(d.totalAmount || 0);
        }

        if(include) {
            runningBalance += netChange;
            filteredTransactions.push({ ...d, currentBalance: runningBalance });
        } else {
            if(duration === 'monthly' && d.date < (selectedMonth + '-01')) {
                runningBalance += netChange;
            } else if(duration === 'daily' && d.date < selectedDate) {
                runningBalance += netChange;
            }
        }
    });

    let calculatedInitialBalance = runningBalance;
    if(duration !== 'all' && filteredTransactions.length > 0) {
        let firstTx = filteredTransactions[0];
        let firstNet = 0;
        if(firstTx.transType === 'Sales') firstNet = (firstTx.totalAmount || 0);
        else if(firstTx.transType === 'Payment Received') firstNet = -(firstTx.totalAmount || 0);
        else if(firstTx.transType === 'Payment Given') firstNet = (firstTx.totalAmount || 0);
        else if(firstTx.transType === 'Purchase') firstNet = -(firstTx.totalAmount || 0);

        calculatedInitialBalance = firstTx.currentBalance - firstNet;
    } else if(duration === 'all') {
        calculatedInitialBalance = storeOpeningBalance;
    }

    return { initialBalance: calculatedInitialBalance, transactions: filteredTransactions, finalBalance: runningBalance };
}

window.previewPDFReport = async () => {
    const duration = document.getElementById('report-duration').value;
    const selectedDate = document.getElementById('report-date-input').value;
    const selectedMonth = document.getElementById('report-month-input').value;
    const store = document.getElementById('report-store').value;
    const box = document.getElementById('report-preview-box');
    const content = document.getElementById('preview-content');
    box.classList.remove('hidden');
    content.innerHTML = "<p class='text-slate-500 text-center py-2'>ലോഡ് ചെയ്യുന്നു...</p>";

    const reportData = await fetchFilteredTransactions(duration, selectedDate, selectedMonth, store);

    let tableHtml = `
        <table class="w-full text-left border-collapse text-[11px] text-slate-200">
            <thead>
                <tr class="bg-emerald-700 text-white">
                    <th class="p-2 border border-slate-800">തീയതി</th>
                    <th class="p-2 border border-slate-800">കട</th>
                    <th class="p-2 border border-slate-800">തരം</th>
                    <th class="p-2 border border-slate-800 text-right">തുക</th>
                    <th class="p-2 border border-slate-800 text-right">ബാലൻസ്</th>
                </tr>
            </thead>
            <tbody>
                <tr class="border-b border-slate-800 bg-slate-900/60">
                    <td class="p-2 border border-slate-800" colspan="3"><b>തുടക്കത്തിലെ ബാലൻസ് (Opening Balance)</b></td>
                    <td class="p-2 border border-slate-800 text-right">-</td>
                    <td class="p-2 border border-slate-800 text-right font-bold text-rose-400">₹${reportData.initialBalance}</td>
                </tr>`;

    reportData.transactions.forEach(d => {
        let isIncome = (d.transType === 'Sales' || d.transType === 'Payment Given');
        let colorClass = isIncome ? 'text-emerald-400' : 'text-rose-400';
        let sign = isIncome ? '+' : '-';
        tableHtml += `
            <tr class="border-b border-slate-800/80 hover:bg-slate-800/50">
                <td class="p-2 border border-slate-800/60">${d.date}</td>
                <td class="p-2 border border-slate-800/60">${d.store}</td>
                <td class="p-2 border border-slate-800/60">${d.transType}</td>
                <td class="p-2 border border-slate-800/60 text-right ${colorClass} font-bold">${sign}₹${d.totalAmount}</td>
                <td class="p-2 border border-slate-800/60 text-right font-bold text-rose-400">₹${d.currentBalance}</td>
            </tr>`;
    });

    tableHtml += `
        <tr class="border-t border-slate-700 bg-slate-900/80">
            <td class="p-2 border border-slate-800" colspan="3"><b>അവസാനത്തെ ബാലൻസ് (Closing Balance)</b></td>
            <td class="p-2 border border-slate-800 text-right">-</td>
            <td class="p-2 border border-slate-800 text-right font-bold text-rose-400">₹${reportData.finalBalance}</td>
        </tr>
        </tbody></table>`;
    content.innerHTML = reportData.transactions.length > 0 ? tableHtml : "<p class='text-slate-500 text-center py-2'>സൂചികയിൽ ഡാറ്റ ലഭ്യമല്ല</p>";
};

window.generatePDFReport = async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const duration = document.getElementById('report-duration').value;
    const selectedDate = document.getElementById('report-date-input').value;
    const selectedMonth = document.getElementById('report-month-input').value;
    const store = document.getElementById('report-store').value;

    let durationText = duration === 'all' ? 'ALL TIME' : duration === 'daily' ? `DATE: ${selectedDate}` : `MONTH: ${selectedMonth}`;
    let storeText = store ? store : 'All Stores';

    doc.setFontSize(14);
    doc.text("New Idiyappam Company - Chembrasseri East", 14, 15);
    doc.setFontSize(10);
    doc.text(`Store: ${storeText}  |  Report Type: ${durationText}`, 14, 22);

    const reportData = await fetchFilteredTransactions(duration, selectedDate, selectedMonth, store);
    let tableRows = [];
    let totalQty = { idiyappam: 0, vellappam: 0, palappam: 0, pathiri: 0, porotta: 0, chapati: 0, amount: 0 };

    tableRows.push(['-', 'Opening Balance', '-', 0, 0, 0, 0, 0, 0, '-', `Rs.${reportData.initialBalance}`]);

    reportData.transactions.forEach(data => {
        let itm = data.items || {};
        totalQty.idiyappam += Number(itm.idiyappam || 0);
        totalQty.vellappam += Number(itm.vellappam || 0);
        totalQty.palappam += Number(itm.palappam || 0);
        totalQty.pathiri += Number(itm.pathiri || 0);
        totalQty.porotta += Number(itm.porotta || 0);
        totalQty.chapati += Number(itm.chapati || 0);
        totalQty.amount += Number(data.totalAmount || 0);

        let isIncome = (data.transType === 'Sales' || data.transType === 'Payment Given');
        let amtPrefix = isIncome ? '+' : '-';

        tableRows.push([
            data.date, 
            data.store, 
            data.transType, 
            itm.idiyappam||0, 
            itm.vellappam||0, 
            itm.palappam||0, 
            itm.pathiri||0, 
            itm.porotta||0, 
            itm.chapati||0, 
            `${amtPrefix}Rs.${data.totalAmount}`, 
            `Rs.${data.currentBalance}`
        ]);
    });

    tableRows.push([
        'TOTAL', '-', '-', 
        totalQty.idiyappam, 
        totalQty.vellappam, 
        totalQty.palappam, 
        totalQty.pathiri, 
        totalQty.porotta, 
        totalQty.chapati, 
        `Rs.${totalQty.amount}`, 
        `Rs.${reportData.finalBalance}`
    ]);

    tableRows.push(['-', 'Closing Balance', '-', '-', '-', '-', '-', '-', '-', '-', `Rs.${reportData.finalBalance}`]);

    doc.autoTable({ 
        startY: 28, 
        head: [['Date', 'Store', 'Type', 'Idiyappam', 'Vellappam', 'Palappam', 'Pathiri', 'Porotta', 'Chapati', 'Amount', 'Balance']], 
        body: tableRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 185, 129] },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 9) {
                let transType = data.row.raw[2];
                if (transType === 'Sales' || transType === 'Payment Given') {
                    data.cell.styles.textColor = [16, 185, 129]; 
                } else {
                    data.cell.styles.textColor = [244, 63, 94]; 
                }
            }
        }
    });

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Final Ledger Balance: Rs.${reportData.finalBalance}`, 14, finalY);
    doc.save(`Ledger_Report_${storeText.replace(/\s+/g, '_')}.pdf`);
};
