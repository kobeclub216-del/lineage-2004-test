# P05-D48 — 說話之島素材來源分流與年代核對（2026-11-12）

## 本次核對結論

目標是 **Lineage 1 / 天堂 I，2004 年 7 月 1.82**，不是 **Lineage II / 天堂 II**。搜尋「Talking Island Village 2004」會大量出現天堂 II 的 2004 年 Prima Guide、C1 地圖、村莊與 NPC；即使日期為 2004 年，也**完全不能**當作天堂 I 的原版地圖。

### A. 可作天堂 I 歷史佐證（不能直接當可部署素材）

1. Lineage Compendium 2002 年更新彙編：https://lineagecompendium.com/www.lineagecompendium.com/12~archive.html
   - 2002 年更新公告記錄說話之島圖像有顯著變更，並移除稻草人及訓練區。
   - 對 2004 目標版本的含義：**2002 年前的島嶼全圖不可直接當 2004 村莊實景**；須核對更新後畫面。
2. MMORPG.com 2002-10-14 天堂 I 公告：https://www.mmorpg.com/lineage/news/publish-announcement-2000055259
   - 記錄說話之島決鬥場部分座標的普通區／戰鬥區調整。
   - 「訓練區移除」不等於「決鬥場移除」，兩者不能混為一談。
3. LineageDB 地圖索引的 2008 PTT 討論：https://www.ptt.cc/bbs/Lineage/M.1199909288.A.C42.html
   - 有天堂 I 說話之島全圖歷史連結，但文章晚於目標版本四年；**只可作待核對線索**。
4. https://hibiki.org/lineage/ss/index.html
   - 舊年代玩家截圖索引；可用於畫面與物件對照，但每張截圖需單獨確認時間、地點與版本。
5. https://briel.net/lineage3d/map/talkingisland_2.jpg
   - 島嶼標註圖；包含 Training Grounds，可能與 2002 更新後狀態不一致。來源禁止 hotlink，且未取得重製／再散布權限。

### B. 明確排除：不是天堂 I 1.82

- https://lineage2.gg/guides/talking-island-quests/ — 天堂 **II** Prima Guide。
- https://lineage2.gg/pt/guides/human-and-talking-island/ — 天堂 **II**。
- https://linedia.ru/en/wiki/Talking_Island_Village — 天堂 **II**。
- https://www.l2echoes.com/locations/talking-island — 天堂 **II**。
- https://www.lineage2media.com/Downloads/Lineage%20Ii%20-%20Prima%20Game%20Guide%202004.pdf — 天堂 **II**。
- 2026 私服地圖與現代 Classic 資料：不能作為原始 1.82 數據或年代證據。

## 實作素材的驗收條件

- 確認屬於天堂 I，不是天堂 II。
- 版本可核對到 2002 年地圖改版之後、2004 年 7 月附近。
- 圖片能用於遊戲而不只是全島位置示意；需可確認建築、道路、遮擋與可行走區。
- 可依法用於本專案；無權利確認時只能記錄來源，不能下載打包、hotlink 或標記 verified。
- 未取得可用圖片之前，manifest.status 保持 awaiting-verified-assets，絕不改成 ready。

## 下一個有實際畫面價值的工作

先找 2002 更新後的 **天堂 I** 說話之島村莊實機畫面，逐張核對建築、地面、村口和 NPC；再建立可使用的圖層與碰撞座標。此研究檔不代表已取得可部署的原版素材。
