// api.js - 封裝 Google Sheets API 互動邏輯

const API = {
    init() {
        console.log("API 模組初始化...");
        // 將由 app.js 觸發流程
    },

    /**
     * 封裝通用的 fetch 請求以呼叫 Google Sheets API
     */
    async fetchSheet(range, method = 'GET', body = null) {
        if (!window.AppState.token) {
            throw new Error("無效的 Token，請重新登入");
        }

        let appendSuffix = '';
        if (range.endsWith(':append')) {
            appendSuffix = ':append';
            range = range.replace(':append', '');
        }

        let url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}${appendSuffix}`;

        const headers = {
            'Authorization': `Bearer ${window.AppState.token}`,
            'Content-Type': 'application/json'
        };

        const options = {
            method,
            headers
        };

        if (body) {
            // 對於寫入操作，加上 valueInputOption
            options.body = JSON.stringify(body);
            if (method === 'PUT' || method === 'POST') {
                url = `${url}?valueInputOption=USER_ENTERED`;
            }
        }

        const response = await fetch(url, options);

        if (response.status === 401) {
            // Token 過期或無效
            throw new Error("UNAUTHORIZED");
        }

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API 錯誤: ${response.status} - ${errText}`);
        }

        return await response.json();
    },

    /**
     * 載入所有必須資料
     */
    async loadData() {
        console.log("從 Google Sheets 載入資料...");
        if (!window.AppState.token) throw new Error("尚未登入");

        // 設定要讀取的範圍，改為 A:Z 確保能讀到新增的較後方欄位
        const ranges = [
            `'${CONFIG.SHEET_RECORDS}'!A:Z`,
            `'${CONFIG.SHEET_SETTINGS}'!A:Z`
        ];
        
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values:batchGet?ranges=${encodeURIComponent(ranges[0])}&ranges=${encodeURIComponent(ranges[1])}`;
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${window.AppState.token}` } });
        
        if (!response.ok) {
            throw new Error("取得資料失敗，請檢查資料表權限或名稱。");
        }
        
        const data = await response.json();
        const valueRanges = data.valueRanges || [];
        
        this.parseRecords(valueRanges[0]?.values || []);
        this.parseSettings(valueRanges[1]?.values || []);
        
        return window.AppState;
    },

    parseRecords(rows) {
        if (rows.length === 0) {
            window.AppState.items = [];
            window.AppState.colMap = {};
            window.AppState.sheetColCount = 12;
            return;
        }

        const headers = rows[0].map(h => (h || '').toString().trim());
        const getIdx = (name) => {
            // 由於使用者的表頭有 "Dropdown" 或 "Number" 等字眼，我們改用 `.includes()` 進行彈性比對
            const idx = headers.findIndex(h => h.includes(name));
            return idx !== -1 ? idx : -1;
        };

        const colMap = {
            id: getIdx('ID'), // 尋找含 ID 的名稱
            name: getIdx('物品名稱'),
            category: getIdx('類別'),
            size: getIdx('尺寸'),
            source: getIdx('來源'),
            price: getIdx('價格'),
            quantity: getIdx('數量'), // 新增數量映射
            status: getIdx('狀態'),
            location: getIdx('放置位置'), // 找到第一個配對的放置位置 (H欄)
            purchaseDate: getIdx('購買日期'),
            openDate: getIdx('開封日期'),
            closeDate: getIdx('結案日期'),
            note: getIdx('備註')
        };
        
        if (colMap.id === -1) colMap.id = 0; // 防呆
        
        // 儲存到全域供存檔時保持寫入欄位一致
        window.AppState.colMap = colMap;
        window.AppState.sheetColCount = headers.length > 11 ? headers.length : 12;

        if (rows.length === 1) {
            window.AppState.items = [];
            return;
        }

        const dataRows = rows.slice(1);
        window.AppState.items = dataRows.map((row, index) => {
            const getVal = (col) => col !== -1 ? (row[col] || '') : '';
            return {
                _rowIndex: index + 2,
                id: getVal(colMap.id),
                name: getVal(colMap.name),
                category: getVal(colMap.category),
                size: getVal(colMap.size),
                source: getVal(colMap.source),
                price: getVal(colMap.price),
                quantity: getVal(colMap.quantity),
                status: getVal(colMap.status),
                purchaseDate: getVal(colMap.purchaseDate),
                openDate: getVal(colMap.openDate),
                closeDate: getVal(colMap.closeDate),
                location: getVal(colMap.location),
                note: getVal(colMap.note)
            };
        });
        
        // 過濾掉完全空白的列 (防範假刪除導致的空資料)
        window.AppState.items = window.AppState.items.filter(item => {
            return item.name !== '' || item.id !== '' || item.category !== '' || item.status !== '';
        });
    },

    parseSettings(rows) {
        if (rows.length <= 1) {
            window.AppState.categories = [];
            window.AppState.sizesClothes = [];
            window.AppState.sizesDiapers = [];
            window.AppState.sources = [];
            return;
        }

        const headers = rows[0].map(h => (h || '').toString().trim());
        const catIdx = headers.findIndex(h => h.includes('類別'));
        const sourceIdx = headers.findIndex(h => h.includes('來源'));
        const clothesIdx = headers.findIndex(h => h.includes('衣服'));
        const diaperIdx = headers.findIndex(h => h.includes('尿布'));

        window.AppState.settingsColMap = {
            category: catIdx !== -1 ? catIdx : 0, 
            clothes: clothesIdx !== -1 ? clothesIdx : 2, 
            diapers: diaperIdx !== -1 ? diaperIdx : 3, 
            source: sourceIdx !== -1 ? sourceIdx : 4 // 預設用 E 欄
        };

        const dataRows = rows.slice(1);
        const categories = [];
        const sizesClothes = [];
        const sizesDiapers = [];
        const sources = [];
        
        dataRows.forEach(row => {
            const getVal = (idx) => idx !== -1 && row[idx] ? row[idx].trim() : '';

            const cat = getVal(window.AppState.settingsColMap.category);
            if (cat) categories.push(cat);

            const source = getVal(window.AppState.settingsColMap.source);
            if (source) sources.push(source);

            const sizeC = getVal(window.AppState.settingsColMap.clothes);
            if (sizeC) sizesClothes.push(sizeC);

            const sizeD = getVal(window.AppState.settingsColMap.diapers);
            if (sizeD) sizesDiapers.push(sizeD);
        });
        
        window.AppState.categories = categories;
        window.AppState.sizesClothes = sizesClothes;
        window.AppState.sizesDiapers = sizesDiapers;
        window.AppState.sources = sources.length > 0 ? sources : ['購買', '親友贈送', '恩典牌', '其他'];
    },

    async syncSettingsColumn(colIndex, arrayData) {
        const values = [];
        for (let i = 0; i < Math.max(arrayData.length, 50); i++) {
            values.push([i < arrayData.length ? arrayData[i] : ""]);
        }
        
        // 轉換 index 到英文字母 A-Z 
        const colLetter = String.fromCharCode(65 + colIndex);
        await this.fetchSheet(`'${CONFIG.SHEET_SETTINGS}'!${colLetter}2:${colLetter}${Math.max(arrayData.length, 50) + 1}`, 'PUT', {
            values: values
        });
    },

    /**
     * 同步類別至 Google Sheets
     */
    async syncCategories() {
        await this.syncSettingsColumn(window.AppState.settingsColMap.category, window.AppState.categories);
    },

    /**
     * 同步來源至 Google Sheets
     */
    async syncSources() {
        await this.syncSettingsColumn(window.AppState.settingsColMap.source, window.AppState.sources);
    },

    itemToArray(item) {
        // 現在我們根據實際的試算表表頭位置，動態產生寫入陣列！
        // 確保不論使用者怎麼調換欄位順序，我們都能對到坑！
        const colMap = window.AppState.colMap || {};
        const length = window.AppState.sheetColCount || 12;
        const rowData = new Array(length).fill('');
        
        if (colMap.id !== undefined && colMap.id !== -1) rowData[colMap.id] = item.id;
        if (colMap.name !== undefined && colMap.name !== -1) rowData[colMap.name] = item.name;
        if (colMap.category !== undefined && colMap.category !== -1) rowData[colMap.category] = item.category;
        if (colMap.size !== undefined && colMap.size !== -1) rowData[colMap.size] = item.size || '';
        if (colMap.source !== undefined && colMap.source !== -1) rowData[colMap.source] = item.source || '';
        if (colMap.price !== undefined && colMap.price !== -1) rowData[colMap.price] = item.price || '';
        if (colMap.quantity !== undefined && colMap.quantity !== -1) rowData[colMap.quantity] = item.quantity || '';
        if (colMap.status !== undefined && colMap.status !== -1) rowData[colMap.status] = item.status;
        if (colMap.purchaseDate !== undefined && colMap.purchaseDate !== -1) rowData[colMap.purchaseDate] = item.purchaseDate || '';
        if (colMap.openDate !== undefined && colMap.openDate !== -1) rowData[colMap.openDate] = item.openDate || '';
        if (colMap.closeDate !== undefined && colMap.closeDate !== -1) rowData[colMap.closeDate] = item.closeDate || '';
        if (colMap.location !== undefined && colMap.location !== -1) rowData[colMap.location] = item.location || '';
        if (colMap.note !== undefined && colMap.note !== -1) rowData[colMap.note] = item.note || '';
        
        return rowData;
    },

    /**
     * 新增單筆物資 (Append)
     */
    async addItem(item) {
        const values = [this.itemToArray(item)];
        // 將範圍放寬到 Z，確保如果是 M欄 (index 12) 等比較後面的欄位也不會被 Google API 截斷
        await this.fetchSheet(`'${CONFIG.SHEET_RECORDS}'!A1:Z1:append`, 'POST', {
            values: values
        });
        // 為了知道剛剛的資料在第幾列，我們需要重新拉取一次，以免本地與遠端斷鏈
        // 但為了效能，可以暫時仰賴後續載入
    },

    /**
     * 更新單筆物資 (PUT to specific row)
     */
    async updateItem(rowIndex, item) {
        const values = [this.itemToArray(item)];
        await this.fetchSheet(`'${CONFIG.SHEET_RECORDS}'!A${rowIndex}:Z${rowIndex}`, 'PUT', {
            values: values
        });
    },

    /**
     * 刪除單筆物資 (Clear row)
     */
    async deleteItem(rowIndex) {
        // 根據欄位數量產生對應大小的空值陣列，覆蓋清除
        const length = window.AppState.sheetColCount || 12;
        const emptyData = [Array(length).fill('')]; 
        await this.fetchSheet(`'${CONFIG.SHEET_RECORDS}'!A${rowIndex}:Z${rowIndex}`, 'PUT', {
            values: emptyData
        });
    }
};
