// app.js - 前端互動邏輯

let tokenClient;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 綁定基礎事件
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('auth-btn').addEventListener('click', handleLogout);

    // 按鈕與 Modal 綁定
    document.getElementById('add-btn').addEventListener('click', () => openItemModal(null));
    document.getElementById('close-modal-btn').addEventListener('click', closeItemModal);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeItemModal);
    
    // 原本全域類別按鈕已移除，剩內部關閉鈕與事件
    document.getElementById('close-category-btn').addEventListener('click', () => {
        document.getElementById('category-modal').classList.remove('active');
    });
    document.getElementById('finish-category-btn').addEventListener('click', () => {
        populateCategoryDropdowns();
        document.getElementById('category-modal').classList.remove('active');
    });
    document.getElementById('add-category-btn').addEventListener('click', addCategory);

    // 來源管理 Modal 綁定
    document.getElementById('close-source-btn').addEventListener('click', () => {
        document.getElementById('source-modal').classList.remove('active');
    });
    document.getElementById('finish-source-btn').addEventListener('click', () => {
        populateSourceDropdown();
        document.getElementById('source-modal').classList.remove('active');
    });
    document.getElementById('add-source-btn').addEventListener('click', addSource);

    // 關閉 Modal 若點擊背景
    window.addEventListener('click', (e) => {
        const itemModal = document.getElementById('item-modal');
        const catModal = document.getElementById('category-modal');
        const srcModal = document.getElementById('source-modal');
        if (e.target === itemModal) closeItemModal();
        if (e.target === catModal) catModal.classList.remove('active');
        if (e.target === srcModal) srcModal.classList.remove('active');
    });

    // 表單變更連動 (類別與尺寸)
    document.getElementById('item-category').addEventListener('change', handleCategoryChange);

    // 表單送出與刪除綁定
    document.getElementById('item-form').addEventListener('submit', handleSaveItem);
    document.getElementById('delete-btn').addEventListener('click', handleDeleteItem);

    // 搜尋功能
    document.getElementById('search-input').addEventListener('input', renderItemList);

    // UI 初始化顯示
    document.getElementById('login-overlay').classList.add('active');
}

/**
 * 處理 Google 登入
 */
function handleLogin() {
    if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') {
        alert("請先在 js/config.js 設定您的 CLIENT_ID 與 SPREADSHEET_ID !");
        return;
    }

    try {
        // 確保 google.accounts.oauth2 已經被載入
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    // 登入成功
                    window.AppState.token = tokenResponse.access_token;
                    onLoginSuccess();
                }
            },
        });
        tokenClient.requestAccessToken();
    } catch (e) {
        console.error("登入初始化失敗: ", e);
        alert("Google 載入失敗，請確認網路連線。");
    }
}

/**
 * 登入成功後的處理
 */
async function onLoginSuccess() {
    document.getElementById('login-overlay').classList.remove('active');
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('auth-btn').style.display = 'inline-block';

    console.log("登入成功，開始取得資料...");
    document.getElementById('item-list').innerHTML = '<li class="loading-state">從 Google Sheets 載入資料中...</li>';

    try {
        await API.loadData();
        renderItemList();
    } catch (error) {
        console.error(error);
        document.getElementById('item-list').innerHTML = `<li class="loading-state" style="color:red;">載入失敗: ${error.message}</li>`;
    }
}

/**
 * 處理登出
 */
function handleLogout() {
    if (window.AppState.token) {
        google.accounts.oauth2.revoke(window.AppState.token, () => {
            console.log('Token revoked');
            window.AppState.token = null;
            document.getElementById('login-overlay').classList.add('active');
            document.getElementById('main-content').style.display = 'none';
            document.getElementById('auth-btn').style.display = 'none';
        });
    }
}

/**
 * 渲染物資清單
 */
function renderItemList() {
    const listContainer = document.getElementById('item-list');
    listContainer.innerHTML = '';
    
    if (window.AppState.items.length === 0) {
        listContainer.innerHTML = '<li class="loading-state">尚無物資紀錄</li>';
        return;
    }
    
    const keyword = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

    // 反轉陣列，讓最新新增的在上方
    let reversedItems = [...window.AppState.items].reverse();

    // 搜尋過濾
    if (keyword) {
        reversedItems = reversedItems.filter(item => 
            (item.name || '').toLowerCase().includes(keyword) || 
            (item.note || '').toLowerCase().includes(keyword) ||
            (item.category || '').toLowerCase().includes(keyword) ||
            (item.location || '').toLowerCase().includes(keyword)
        );
    }
    
    if (reversedItems.length === 0) {
        listContainer.innerHTML = '<li class="loading-state">找不到符合的物資</li>';
        return;
    }

    reversedItems.forEach(item => {
        const li = document.createElement('li');
        
        let daysText = '';
        if (item.status === '已用完' && item.openDate && item.closeDate) {
            const start = new Date(item.openDate);
            const end = new Date(item.closeDate);
            const diffTime = end - start;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (!isNaN(diffDays) && diffDays >= 0) {
                daysText = `<span class="duration-tag">共使用了 ${diffDays} 天</span>`;
            }
        }
        
        li.innerHTML = `
            <div class="item-header">
                <span class="item-title">${item.name} ${item.quantity && item.quantity > 1 ? `<span style="font-size:0.8rem;color:#888;">(x${item.quantity})</span>` : ''}</span>
                <span class="item-status status-${item.status}">${item.status}</span>
            </div>
            <div class="item-details">
                <span>📂 ${item.category || '未分類'} ${item.size ? '- ' + item.size : ''}</span>
                <span>📍 ${item.location || '未標示位置'}</span>
                ${item.purchaseDate ? `<span>📅 買：${item.purchaseDate}</span>` : ''}
            </div>
            ${item.note ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">備註: ${item.note}</div>` : ''}
            <div>${daysText}</div>
        `;
        // 加入點擊事件，進入第二層編輯資料
        li.addEventListener('click', () => openItemModal(item));
        listContainer.appendChild(li);
    });
}

/**
 * 處理下拉選單渲染
 */
function populateCategoryDropdowns() {
    const catSelect = document.getElementById('item-category');
    const currentVal = catSelect.value;
    
    catSelect.innerHTML = '<option value="">請選擇</option>';
    window.AppState.categories.forEach(cat => {
        catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    
    if (currentVal) {
        catSelect.value = currentVal;
    }
}

/**
 * 處理來源下拉選單渲染
 */
function populateSourceDropdown() {
    const srcSelect = document.getElementById('item-source');
    const currentVal = srcSelect.value;
    
    srcSelect.innerHTML = '<option value="">請選擇</option>';
    window.AppState.sources.forEach(src => {
        srcSelect.innerHTML += `<option value="${src}">${src}</option>`;
    });
    
    if (currentVal) {
        srcSelect.value = currentVal;
    }
}

/**
 * 開啟新增/編輯 Modal
 */
function openItemModal(item) {
    const isEdit = !!item;
    document.getElementById('modal-title').textContent = isEdit ? '編輯物資' : '新增物資';
    document.getElementById('delete-btn').style.display = isEdit ? 'inline-block' : 'none';
    
    // 初始化下拉選項
    populateCategoryDropdowns();
    populateSourceDropdown();

    if (isEdit) {
        document.getElementById('form-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-category').value = item.category;
        handleCategoryChange(); // 觸發連動
        document.getElementById('item-size').value = item.size;
        document.getElementById('item-source').value = item.source || '購買';
        document.getElementById('item-price').value = item.price;
        document.getElementById('item-quantity').value = item.quantity || '1';
        document.getElementById('item-status').value = item.status || '庫存中';
        document.getElementById('item-location').value = item.location;
        document.getElementById('item-purchase-date').value = item.purchaseDate || '';
        document.getElementById('item-open-date').value = item.openDate;
        document.getElementById('item-close-date').value = item.closeDate;
        document.getElementById('item-note').value = item.note;
    } else {
        document.getElementById('item-form').reset();
        document.getElementById('form-id').value = '';
        document.getElementById('size-group').style.display = 'none';
    }

    document.getElementById('item-modal').classList.add('active');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('active');
}

/**
 * 開啟類別管理 Modal
 */
function openCategoryModal() {
    renderCategoryManageList();
    document.getElementById('category-modal').classList.add('active');
}

/**
 * 開啟來源管理 Modal
 */
function openSourceModal() {
    renderSourceManageList();
    document.getElementById('source-modal').classList.add('active');
}

/**
 * 處理類別切換事件
 */
function handleCategoryChange() {
    const cat = document.getElementById('item-category').value;
    const sizeGroup = document.getElementById('size-group');
    const sizeSelect = document.getElementById('item-size');
    sizeSelect.innerHTML = '<option value="">無</option>';

    if (cat === '衣服') {
        sizeGroup.style.display = 'flex';
        window.AppState.sizesClothes.forEach(size => {
            sizeSelect.innerHTML += `<option value="${size}">${size}</option>`;
        });
    } else if (cat === '尿布') {
        sizeGroup.style.display = 'flex';
        window.AppState.sizesDiapers.forEach(size => {
            sizeSelect.innerHTML += `<option value="${size}">${size}</option>`;
        });
    } else {
        sizeGroup.style.display = 'none';
        sizeSelect.value = '';
    }
}

/**
 * 渲染類別管理總覽頁面
 */
function renderCategoryManageList() {
    const list = document.getElementById('manage-category-list');
    list.innerHTML = '';
    window.AppState.categories.forEach((cat, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${cat}</span>
            <button class="delete-cat-btn" data-idx="${index}">刪除</button>
        `;
        list.appendChild(li);
    });

    // 綁定刪除按鈕
    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            deleteCategory(idx);
        });
    });
}

/**
 * 新增類別
 */
async function addCategory() {
    const input = document.getElementById('new-category-input');
    const newCat = input.value.trim();
    if (!newCat) return;

    if (window.AppState.categories.includes(newCat)) {
        alert("此類別已經存在！");
        return;
    }

    window.AppState.categories.push(newCat);
    input.value = ''; // 清空輸入框
    renderCategoryManageList();
    
    // 即時更新底下的下拉選單
    populateCategoryDropdowns();

    // 同步到 Sheets
    try {
        await API.syncCategories();
    } catch(e) {
        alert("同步類別失敗：" + e.message);
    }
}

/**
 * 刪除類別
 */
async function deleteCategory(index) {
    if (!confirm(`確定要刪除「${window.AppState.categories[index]}」類別嗎？不會刪除現有物資資料。`)) return;
    
    window.AppState.categories.splice(index, 1);
    renderCategoryManageList();
    
    // 即時更新底下的下拉選單
    populateCategoryDropdowns();

    // 同步到 Sheets
    try {
        await API.syncCategories();
    } catch(e) {
        alert("同步類別失敗：" + e.message);
    }
}

/**
 * 渲染來源管理清單
 */
function renderSourceManageList() {
    const list = document.getElementById('manage-source-list');
    list.innerHTML = '';
    window.AppState.sources.forEach((src, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${src}</span>
            <button class="delete-src-btn" data-idx="${index}">刪除</button>
        `;
        list.appendChild(li);
    });

    // 綁定刪除按鈕
    document.querySelectorAll('.delete-src-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.idx);
            deleteSource(idx);
        });
    });
}

/**
 * 新增來源
 */
async function addSource() {
    const input = document.getElementById('new-source-input');
    const newSrc = input.value.trim();
    if (!newSrc) return;

    if (window.AppState.sources.includes(newSrc)) {
        alert("此來源已經存在！");
        return;
    }

    window.AppState.sources.push(newSrc);
    input.value = '';
    renderSourceManageList();
    populateSourceDropdown();

    try {
        await API.syncSources();
    } catch(e) {
        alert("同步來源失敗：" + e.message);
    }
}

/**
 * 刪除來源
 */
async function deleteSource(index) {
    if (!confirm(`確定要刪除「${window.AppState.sources[index]}」來源嗎？不會刪除現有物資資料。`)) return;
    
    window.AppState.sources.splice(index, 1);
    renderSourceManageList();
    populateSourceDropdown();

    try {
        await API.syncSources();
    } catch(e) {
        alert("同步來源失敗：" + e.message);
    }
}

/**
 * 儲存/新增物資
 */
async function handleSaveItem(e) {
    e.preventDefault(); // 阻止重新整理頁面
    
    const id = document.getElementById('form-id').value;
    const isEdit = !!id;
    const saveBtn = document.getElementById('save-item-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = '儲存中...';

    const itemData = {
        id: id || Date.now().toString(),
        name: document.getElementById('item-name').value,
        category: document.getElementById('item-category').value,
        size: document.getElementById('item-size').value,
        source: document.getElementById('item-source').value,
        price: document.getElementById('item-price').value,
        quantity: document.getElementById('item-quantity').value,
        status: document.getElementById('item-status').value,
        purchaseDate: document.getElementById('item-purchase-date').value,
        openDate: document.getElementById('item-open-date').value,
        closeDate: document.getElementById('item-close-date').value,
        location: document.getElementById('item-location').value,
        note: document.getElementById('item-note').value
    };

    try {
        if (isEdit) {
            const originalItem = window.AppState.items.find(i => i.id === id);
            await API.updateItem(originalItem._rowIndex, itemData);
        } else {
            await API.addItem(itemData);
        }
        
        // 為了確保剛剛新增的項目擁有正確的 _rowIndex 與最新資料，強制從 Google Sheets 重拉一次
        await API.loadData();
        renderItemList();
        closeItemModal();
    } catch (err) {
        alert("儲存失敗: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '儲存';
    }
}

/**
 * 刪除物資
 */
async function handleDeleteItem() {
    const id = document.getElementById('form-id').value;
    if (!id) return;
    
    if (!confirm('確定要刪除此筆紀錄嗎？此動作無法復原。')) return;

    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.disabled = true;
    deleteBtn.textContent = '刪除中...';

    try {
        const itemIndex = window.AppState.items.findIndex(i => i.id === id);
        const item = window.AppState.items[itemIndex];
        
        await API.deleteItem(item._rowIndex);
        
        // 強制拉取最新資料，確保網頁與資料庫同步
        await API.loadData();
        renderItemList();
        closeItemModal();
    } catch (err) {
        alert("刪除失敗: " + err.message);
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '刪除';
    }
}
