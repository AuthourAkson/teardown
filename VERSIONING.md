# SC-8 版本管理 / Versioning

代码以发布仓库 **https://github.com/AuthourAkson/teardown**（本地 clone：`D:\AgentTestLab\_publish`，分支 `main`）为权威版本库。归档目录 `D:\AgentTestLab\teardown\versions\`。

## 版本划分

| 版本 | git tag / commit | 内容 | 归档 |
|---|---|---|---|
| v1 原始版 | `v1-original-teardown-sc8` / `5d1bb4f` | 最早的简化版 SC-8（旧外壳/旧影片时代），仅作对照 | `versions/v1-original-teardown-sc8-source.zip` / `versions/media/v1-original-film.mp4` |
| v2 opus 精进版 | `v2-opus-refine` / `21ee02e` | opus 第一轮：平甲板躯干、灰关节（后被否定） | `versions/v2-opus-refine-source.zip` / `versions/media/v2-opus-refine-film.mp4` |
| **v3 ours（我方，持续更新）** | **`v3-deepseek-rebuild` / `20c33f1`**（每次定稿 force-move） | 我方重建版：黑关节/象牙白/橙红配色、深色肋骨承载壳+分层白甲、白色头盾、分面装甲钳（钳掌 1.2×、长弯钳指） | `versions/v3-deepseek-rebuild-source.zip` / `versions/media/v3-deepseek-rebuild-film.mp4` |
| v4 opus 第二轮 | `v4-opus-round2` / `9a2f0a5` | opus 2026-11-04 第二轮：按官方 demo "白色胶囊化"（椭圆胶囊腿节、圆润钳囊+玻璃窗、白色分片尾甲+发光橙颈环尾刺、背甲 7 块小圆瓦），包络 2131×1468×1276 | `versions/v4-opus-round2-source.zip` / `versions/media/v4-opus-round2-film.mp4` |
| **v5 opus v9（原创仿生重构）** | **`v5-opus-v9-original` / `ef876aa`** | opus 2026-11-05 第三轮（第七~九轮迭代后的 v9 定稿）：按 `DESIGN-V9.md` 原创仿生科技风重做整机——水滴形宽甲壳+7 片叠瓦背板、多面头盾+中眼/侧眼阵列、连续放样胶囊腿、三片式钳囊+黑弯钳指、白色尾节壳+发光尾刺；约束按用户要求放开（包络 2152×1774×1482 mm） | `versions/v5-opus-v9-original-source.zip` / `versions/media/v5-opus-v9-original-film.mp4` |

> 规则：
> - **我的每一轮小改动**不再新增版本号，直接覆盖 v3 的 tag、zip 和 film（v3 当前指向 `20c33f1`）。
> - **opus 的每一次新版本**单独建一个 `vN-opus-*` tag 并归档，便于与我的版本区分（v2 = 第一轮，v4 = 第二轮，v5 = 第三轮）。
> - 若某轮想单独保留（例如给用户对比），再临时建 tag。

## 每轮定稿流程（Lead 执行）

1. 源码最终化：`sims/scorpion-shared/*.js`、`sims/scorpion-film/*`、`sims/scorpion-live/*`、`sc8-design/SC-8-设计方案.md`。
2. 同步到 `D:\AgentTestLab\_publish` 对应路径。
3. `git add -A && git commit -m "SC-8: <一句话>"` → `git push origin main`。
4. 打 tag（我方 `v3-deepseek-rebuild` force-move；opus 新建 `vN-opus-*`）→ `git push origin --tags`。
5. `git archive --format=zip --output versions/<tag>-source.zip <tag>`；成片复制为 `versions/media/<tag>-film.mp4`。
6. 更新本文件。
