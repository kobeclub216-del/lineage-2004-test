# 素材盤點與接入狀態

基準為 `506af77`。盤點包含開發分支追蹤檔，以及可見的 D170 原始備份。

| 分類 | 可立即接入或已在用 | 需要少量資料補足 | 缺關鍵素材 |
| --- | --- | --- | --- |
| MAP | 3 組可載入場景配置：說話之島村莊裁切、含商店的較大裁切、吉倫之家場景 | 周邊其他地點仍需核對跨版本位置與碰撞 | 港口及其他新地圖缺可直接使用的圖層、走格或來源組合 |
| NPC | 2 名：潘朵拉、吉倫。木人是測試靶 | — | 其餘居民缺可核對圖集與對話 |
| 怪物 | 1 種：單方向哥布林，25 格，含待機、反擊、受擊、死亡 | 原版掉落與多方向資料仍待核實 | 其他怪物缺可用動畫圖集及對應配置 |
| 人物 | 28 組八方向配置 | 1.82 細部影格時序仍待確認 | — |
| 道具 | 可確認在用的道具圖示包括天幣與治癒藥水；另有光箭魔法圖示 | 匕首、皮夾克有品名與舊版參考價，待核對對應圖示與 1.82 攻防 | 其他未對應道具圖示不可直接入庫 |

Windows 素材清單共 61 件（58 PNG、2 WebP、1 WOFF），其中 PNG 數包含人物、地圖和介面，不能當作道具數。倉庫另有 80 個 SVG，多屬舊地形原型。基準追蹤檔未見原始 MAP／SPR／PAK 或 ZIP／RAR／7z。工作區留存的 D170 ZIP 內有四份 HTML 和一份 README，遊戲頁內嵌素材已由現有清單追蹤。

## 資料版本與本次整合

- 村莊及商店場景原清單標為 L1Justice client map/0，屬跨版本素材，確切客戶端版號未核實。
- [巴哈姆特舊《天堂》說話之島百科](https://wiki2.gamer.com.tw/wiki.php?n=1512%3A%E8%AA%AA%E8%A9%B1%E4%B9%8B%E5%B3%B6)支持潘朵拉是商人、吉倫傳授魔法。內容混有後期改版，未作為 1.82 怪物或地圖數據證據。
- [回憶天堂 1.82 網頁版](https://play.forlineage.com/guide/map/0/)可供尋找候選怪物，為現代復刻且部分內容已改版，數字未匯入。
- 潘朵拉對話新增通往既有吉倫場景的開發入口，可原地返回村莊並續用原遭遇與掉落狀態。吉倫場景沿用其原有背景、碰撞及 NPC 圖片，轉成獨立 JSON。本輪沒有新增怪物來源、歷史數值或地圖圖片。

## 新素材批次索引

在倉庫根目錄使用 Python 3.9 或更新版本：

```sh
python tools/index-lineage-assets.py path/to/assets.zip path/to/loose-assets --existing v182-p05-windows/assets/manifest.json --metadata reviewed-assets.json > asset-index.json
```

`--existing` 與 `--metadata` 可省略。索引依 SHA-256 合併同一檔案的來源位置。PNG 讀取標頭尺寸，JSON 檢查可解析性，MAP、SPR 和 WebP 原檔保留待解碼狀態。索引不會解壓到遊戲目錄或將內容發布。

審查註記是以 SHA-256 為鍵的 JSON 物件。每筆包含 `sha256`、`category`（character、monster、npc、map、item、interface）、`source`、`version`、`rights`，以及選填的 `animations`（動作 → 方向 → 影格陣列，每格含 x、y、width、height、ms）。工具檢查圖集邊界，影格與授權仍依來源資料審查。確認地圖的碰撞、出生格與圖層後再接入場景 JSON。

吉倫的 NPC、地面與屋頂三項現有資源已接到共用場景索引。PC 中尚未取得的資源包可以原始 MAP／SPR、相對應的解碼規格或已匯出的 PNG 圖集、影格表及版本和可使用來源補足。

## 跨版本素材與格式

### 本機素材批次提取清單

先用同一版本客戶端的 `list.spr` 和對應的 IDX 檔建立索引，核對名稱與動作後，再用 `tools/plan-spr-export.py` 一次傳入所有已確認的條目編號。每批附客戶端版本、原始編號、動作表、方向順序、影格時間和錨點。未核對的編號先留空。

| 對象 | 同批準備 |
| --- | --- |
| 人物 | 先比對已收錄的男女法師方向／無方向施法，以及各已收錄職業的八方向拾取。只匯出缺少的職業、性別或武器組合，附施法釋放格。 |
| 哥布林及候選怪物 | 哥布林目前已有單方向待機、攻擊、受擊與死亡。優先提取有待機、移動、攻擊、受擊、死亡完整動作的新候選，以及哥布林的移動和方向組合。 |
| 候選 NPC | 已識別名稱、SPR 編號、待機影格、站立錨點及可用的互動資料。 |
| 新狩獵區域 | 同版本的地圖區塊、配對圖磚與物件、碰撞資料、地圖編號和可到達的進出座標。 |

以素材完整度、畫風與使用授權決定是否接入。優先順序不限地區。外部遊戲的數值不納入 1.82 資料。

| 候選來源與版本 | 方向與影格 | 授權查核及結果 |
| --- | --- | --- |
| [L1MapViewer S32 測試區塊](https://github.com/tony1223/L1MapViewer/tree/364fcff15ea019e5a9329170aaf7e245404ebba6/tests/assets/8100)，遊戲版本未標明 | 地圖區塊，無角色動畫 | 倉庫未找到授權檔，測試區塊僅在本機讀取驗證，未收錄。 |
| [Flare Fantasycore 哥布林](https://github.com/flareteam/flare-game/blob/c641d2ac2801617f6be3e327454de39250d489b9/mods/fantasycore/animations/enemies/goblin.txt)，版本以該提交為準 | 8 方向。每方向待機 4、跑步 8、揮擊 3、受傷 2、死亡 6 | [Flare 授權與署名](https://github.com/flareteam/flare-game/wiki/Credits)列出美術整體採 CC BY-SA 3.0 或更新版本。立體渲染風格與既有圖層不同，未接入。 |
| [Isometric Painted Game Assets](https://lpc.opengameart.org/content/isometric-painted-game-assets)，2012 年發布 | 騎士有 4 方向行走，來源頁未列影格數 | 來源頁標註 CC0。卡通畫風與方向完整度不符，未接入。 |

### 解析工具查核

- [Lineage1/l1j-client](https://github.com/Lineage1/l1j-client/tree/83052f6b1c5bda59d4c4cbaf01aa2e72ea409853)，GPL-3.0。公開程式含編號 SPR、配對 IDX／PAK，以及 S32／SEG 讀取路徑。未確認任一客戶端版本與 1.82 檔案完全相容。匯入器只依 S32 格式資訊實作，未引入第三方程式碼或素材。
- [L1MapViewer](https://github.com/tony1223/L1MapViewer/tree/364fcff15ea019e5a9329170aaf7e245404ebba6) 文件列出 S32 圖層及 Tile.idx 圖磚讀取。實際測試 `7fff8000.s32` 可讀取 64 × 64 格的區塊前段，每格兩半，樣本宣告 1 個物件。物件內容、地圖碰撞語意、圖磚與 1.82 相容性仍需核對。

批次指令：`python3 -B tools/index-lineage-assets.py /path/to/pack.zip /path/to/local-assets`。支援 ZIP 與資料夾，依 SHA-256 去重。JSON 可解析，PNG 可讀取圖頭尺寸，S32 可讀取地板值、屬性值及宣告物件數的摘要。輸出 `s32-prefix-read` 只代表前段足夠長且可讀。SPR、PAK、IDX、MAP、SEG、WebP 先索引為待解碼。要接入場景仍需有授權且可配對的圖磚、物件圖層與碰撞資料。
