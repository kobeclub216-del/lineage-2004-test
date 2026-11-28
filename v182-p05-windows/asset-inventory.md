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

### 歷史怪物數值與本機地圖收集

新版 `tools/windows-decode-maps.bat` 使用 Python 3 與已安裝的 L1MapViewer。雙擊後選原本的 ZIP，或取消 ZIP 選擇後選解壓資料夾，再選 L1MapViewer 執行檔。桌面輸出包含完整格式分類、ID 0 和 4 的 PNG、方向通行表及個別記錄。Python 命令可用 `--ids` 指定其他地圖。

L1MapViewer `364fcff` 的 `export-fullmap` 會渲染地板與物件，但只載入 S32。雖然 `export-passability` 另可解 SEG，本工具以同一組 S32 為兩者輸入，避免把未繪製的區塊當成可行走區。PNG 為合成預覽，還需驗證像素原點、縮放、方向通行表及物件深度才能接入遊戲。索引的副檔名可辨識格式，客戶端版本仍待核實。

`assets/historical-monsters.json` 為七種測試怪物記錄候選來源。地區、發表日期及明確版本各自記錄，資料頁沒有給版本時保留空值。依據兩份史料，Orc／妖魔的 HP 6、EXP 5 互相吻合，仍缺可用的台版戰鬥資料編號、攻擊與掉落機率。候選數據不進入正式戰鬥。

Windows 雙擊 `tools/windows-map-bundle.bat`，選客戶端資料夾和本機 ZIP 儲存位置。需要 Python 3 的 `py.exe`。工具一次收集鬆散的 MAP、S32、SEG 與同目錄的 Tile.idx／Tile.pak 配對，保留地圖相對路徑。也可運行 `py -3 tools/bundle-local-maps.py CLIENT OUTPUT.zip 4 7` 只選特定數字資料夾。輸出可交給現有索引器讀取 S32 前段。ZIP 須留在本機。

PakViewer 可檢視與提取 PAK 成員。本批使用鬆散地圖檔做收集，地圖渲染另有 L1MapViewer 的 S32 檢查、相鄰區塊渲染及圖磚讀取功能。碰撞位元、SEG 變體與地圖進出座標還需對應版本的樣本確認。

### 狩獵測試場怪物名稱

本機批次索引 `Lineage-sprite-batch-E6A55789178E0FEC` 提供以下英文名稱、動畫條目與 SPR 的對照。戰鬥資料編號須另有歷史資料支持，目前均待核實。遊戲內對照表位於 `assets/hunt-monster-catalog.js`。

| 英文索引名稱 | 動畫條目 | SPR | 台版名稱結論 |
| --- | ---: | ---: | --- |
| orc | 56 | 56 | 待核實。早期社群記載妖魔，缺該編號的歷史台版對照。 |
| skeleton archer | 1096 | 1096 | 待核實。2003 年攻略有骷髏弓箭手的名稱，缺該編號的歷史台版對照。 |
| zombie | 52 | 52 | 待核實。2004 年台版社群使用人形殭屍，缺該編號的直接對照。 |
| ogre | 1020 | 1020 | 毆吉。採用 Windows 實機辨識，早期台版音效清單也有同名記錄。 |
| gnoll | 1477 | 1477 | 待核實。 |
| imp | 1152 | 1152 | 待核實。2004 年台版社群有小惡魔之名，缺該編號的直接對照。 |
| dwarf | 54 | 54 | 待核實。2004 年台版社群記載侏儒，缺該編號的直接對照。 |

索引中的 ghoul 條目 144 也指向 SPR 52。測試場按動畫條目、SPR 及索引名稱辨識個體，未設定正式戰鬥數值。

歷史參考：[早期怪物音效清單](https://www.gamez.com.tw/t/topic/5661)、[2003 年法書掉落攻略](https://lineage.17173.com/content/2003-5-16/n895_811196.html)、[2004 年台版版本回顧](https://www.gamez.com.tw/t/topic/38958)、[2004 年怪物屬性討論](https://www.gamez.com.tw/t/topic/26543)。

2003 年的怪物掉落表與 2005 年的新手村攻略可作為歷史旁證。後者列妖魔經驗 5、侏儒體力 30 與經驗 26。骷髏弓箭手的怪物頁列弓、綠色藥水及骨頭碎片等掉落。這些頁面未提供與目前 SPR 條目相連的台版資料編號、完整攻擊與掉落機率，先保留為旁證，測試場數值不轉入正式遊戲。

來源：[2003 年怪物掉落物品表](https://lineage.17173.com/content/2003-1-13/n784_700874.html)、[2005 年新手村攻略](https://lineage.17173.com/content/2005-8-27/n461_377495.html)、[骷髏弓箭手怪物頁](https://lineage.17173.com/mob/2.htm)。

### 本機素材批次提取清單

在 Windows 雙擊 `tools/windows-sprite-batch.bat`，依序選擇原有 PakViewer CLI、客戶端資料夾及同版本匯出的 `list.spr`。工具需要 Python 3 的 `py.exe`，結果存於桌面的 `Lineage-sprite-batch-*`。若尚未匯出 `list.spr`，可用現有 `windows-list-spr-test.bat` 先擷取一次。

預設清單涵蓋 24 個怪物名稱、12 個 NPC 名稱和 8 種職業性別組合。這些是搜尋候選。程式僅從本機索引的唯一名稱匹配讀取編號，重名與找不到的條目會列入 `sprite-batch-plan.json`，供人工核對。若客戶端使用其他語系，可在 `list.spr` 旁放置 `sprite-batch-catalog.json`，欄位使用 `name`、`kind`、`aliases`、`actions`。

本批共用單一去重佇列並保留原始方向、影格編號、時間與事件。相同客戶端路徑和索引再次執行時，會重用該批次目錄中符合完成標記的 PNG。PakViewer 的輸出狀態可查 `frames/report.csv`。規劃列出的方向數來自索引旗標，實際缺檔或解碼錯誤以匯出結果為準。

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
