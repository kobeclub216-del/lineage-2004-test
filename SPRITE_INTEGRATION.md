# v0.03-C 騎士動畫素材接入說明

此分支以原有 v0.02 遊戲程式為基礎；不更動 2004 年《天與地》遊戲規則。

## 已核對的參考素材目錄

研究參考： https://github.com/shines871/idle-lineage-class

- `assets/classanim/男騎士/`
- `assets/classanim/男騎士2/`
- `assets/classanim/男騎士F/`
- `assets/classanim/男騎士d3/` 至 `男騎士d7/`
- 各目錄可見 `sword1_idle_0.png` 等站立、`sword1_walk_0.png` 等行走、`sword1_attack_0.png` 等攻擊圖片。

## 接入方式

僅在確認圖片使用權限後，將對應影格放入本專案 `assets/classanim/...`。
目前未將第三方圖片複製、轉存或外連到正式遊戲；圖片缺失時顯示原有測試人物。
程式支援 8 個方向資料夾、13 幀站立、4 幀行走、6 幀攻擊（每方向），實際方向排序尚待逐張視覺驗證。

## 驗收

1. 騎士建立與存檔不變
2. 八方向行走圖不倒轉、無錯誤方向
3. 攻擊朝向目標，揮劍播放完整
4. 圖片不存在時遊戲仍可操作
5. Windows Chrome/Edge 與 iPhone Safari 分別驗收
6. 不合併至 main，直到驗收完成

注意：第三方公開程式庫中的圖片可能有獨立著作權；請先確認權利來源與可用授權。