// config.js - 存放 Google API 相關設定與全域變數

const CONFIG = {
    // ==== 需填入您自己的設定 ====
    CLIENT_ID: '1022723633160-01o83j054i1pemlbubvvlbf6b945lajk.apps.googleusercontent.com',
    SPREADSHEET_ID: '1U-wMcA3vDR9vT0y6OmanGK_X5KRIlDGzZ-aoLQrgTzE',
    // ========================

    // API Scope
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets',

    // 工作表名稱
    SHEET_RECORDS: '物資紀錄',
    SHEET_SETTINGS: '欄位表',
};

// 全域狀態儲存區
window.AppState = {
    items: [],        // 所有物資紀錄
    categories: [],   // 物資類別
    sizesClothes: [], // 衣服尺寸
    sizesDiapers: [], // 尿布尺寸
    token: null       // OAuth Access Token
};
