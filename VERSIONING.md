# SC-8 版本管理 / Versioning

本项目的代码以发布仓库 **https://github.com/AuthourAkson/teardown**（本地 clone：`D:\AgentTestLab\_publish`，分支 `main`）为唯一权威版本库。每轮定稿都会 commit + tag + push；同一版本同时生成源码压缩包与成片归档，放在 `D:\AgentTestLab\teardown\versions\`。

## 已归档版本

| 版本 | git tag / commit | 内容 | 源码归档 | 成片归档 |
|---|---|---|---|---|
| v1 原始版 | `v1-original-teardown-sc8` / `5d1bb4f` | 旧版 SC-8 简化模型（Telson 式外壳 + 35 s 版影片时代），仅作对照 | `versions/v1-original-teardown-sc8-source.zip` | `versions/media/v1-original-film.mp4` |
| v2 opus 精进版 | `v2-opus-refine` / `21ee02e` | opus 精修版：平甲板式躯干（后被否定）、灰色关节、控制台/相机标定 | `versions/v2-opus-refine-source.zip` | `versions/media/v2-opus-refine-film.mp4` |
| v3 分段甲壳版 | `v3-segmented-carapace` / `dc3f49c` | 黑关节/象牙白/橙红配色回正；连续圆顶分段背甲；分面装甲钳+可见丝杠；黑端面尾鼓+橙环 | `versions/v3-segmented-carapace-source.zip` | `versions/media/v3-segmented-carapace-film.mp4` |
| v4 头盾+背甲细节（当前） | `v4-head-shield` / `b526b53` | v3 基础上：白色多面头盾+暗色面甲、背甲叠边/中排螺栓/侧肋块/第二道橙线 | `versions/v4-head-shield-source.zip` | `versions/media/v4-head-shield-film.mp4` |

## 下一轮（v5）候选

- 背甲进一步层叠：甲片端部做真实台阶与阴影缝、外露深色肋架/液压杆，按官方 s013/s016 逐帧对照；
- 头盾与颈部的衔接、暗色面甲内的传感器细节；
- 加强官方那种"黑骨架占比"：装甲缝隙处露肋骨与管线；
- 定稿后：同步 `_publish` → commit → tag `v5-...` → push → `git archive` 到 `versions/` → 归档成片。

## 每轮定稿流程（Lead 执行）

1. 源码最终化：`sims/scorpion-shared/*.js`、`sims/scorpion-film/*`、`sims/scorpion-live/*`、`sc8-design/SC-8-设计方案.md`。
2. 同步到 `D:\AgentTestLab\_publish` 对应路径。
3. `git add -A && git commit -m "SC-8: <一句话>"`。
4. `git tag vN-<slug>`；`git push origin main --tags`。
5. `git archive --format=zip --output versions/vN-<slug>-source.zip vN-<slug>`；把成片复制到 `versions/media/vN-<slug>-film.mp4`。
6. 在本文件表格追加一行。

> 说明：轮内的实验性中间稿（例如本轮 v3 之前的 r3b…r3j 迭代）不单独提交；定稿版本一定会入 git + tag + zip。需要保留某个中间稿时，明确说一声，我会在当轮把它 commit 成独立 tag。
