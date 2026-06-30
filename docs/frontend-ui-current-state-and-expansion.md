# Agent Console 前端与 UI 现状评估及扩展方案

## 1. 文档目的

本文档用于回答两个问题：

1. 当前前端和 UI 展示、操作功能做到什么程度。
2. 接下来应该如何扩展，才能从“可见的控制台雏形”推进到“可验收的 MVP 前端”。

评估基于当前项目文件：

- `frontend/src/app/console/page.tsx`
- `frontend/src/components/`
- `frontend/src/lib/api/`
- `frontend/src/lib/realtime/`
- `frontend/src/stores/consoleStore.ts`
- `frontend/src/types/index.ts`

当前验证命令：

```bash
cd frontend
npm run build
```

当前结果：生产构建未通过。页面代码已经能完成 webpack 编译，但 TypeScript 类型检查失败。

## 2. 总体结论

当前前端已经具备 Agent Console 的主要信息架构：

- 左侧会话列表
- 中间 Agent 对话区
- 右侧 Inspector
- 底部 Timeline / Logs
- SSE 客户端
- WebSocket 控制客户端
- Zustand 状态管理
- shadcn/ui 风格基础组件

但当前还不能算 MVP 前端完成，原因是：

- `npm run build` 仍失败。
- 多数 UI 是“结构完成”，但端到端真实数据联动不足。
- 部分操作按钮已经存在，但缺少成功、失败、等待、重试等完整交互状态。
- 事件 payload 与后端实现不一致时，UI 会出现空数据或状态不同步。
- 文件 Diff、审计记录、Run 恢复等核心工作台能力仍偏弱。

当前阶段更准确的状态是：

```text
UI 框架：已形成
页面布局：已形成
基础操作：部分可用
实时联动：需要统一事件契约
视觉完成度：基础可用，但还不够像成熟工作台
MVP 前端验收：未通过
```

## 3. 当前构建状态

### 3.1 构建命令

```bash
cd frontend
npm run build
```

### 3.2 当前失败点

文件：

```text
frontend/src/lib/realtime/controlSocket.ts
```

位置：

```text
send(type: string, data?: unknown): void {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({ type, ...data }));
  } else {
    this.messageQueue.push({ type, data });
  }
}
```

问题：

```text
Spread types may only be created from object types.
```

原因是 `data` 类型是 `unknown`，TypeScript 不允许直接 `...data`。

### 3.3 修复要求

把 WebSocket payload 类型限制为对象：

```typescript
type ControlPayload = Record<string, unknown>;

send(type: string, data: ControlPayload = {}): void {
  const message = { type, ...data };
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
  } else {
    this.messageQueue.push({ type, data });
  }
}
```

验收：

```bash
cd frontend
npm run build
```

结果必须通过。

## 4. 当前 UI 信息架构

当前 Console 主页面：

```text
frontend/src/app/console/page.tsx
```

页面结构：

```text
+------------------------------------------------+
| Header: Agent Console / connected status / ver |
+--------------+-----------------+---------------+
| Sessions     | Conversation    | Inspector     |
+--------------+-----------------+---------------+
| Timeline / Logs                                |
+------------------------------------------------+
```

### 4.1 优点

- 三栏布局符合 Agent Console 工作台方向。
- Header 中有 WebSocket 连接状态。
- Inspector 用 tabs 区分 Tool Calls、Approvals、Files。
- 底部用 tabs 区分 Timeline 和 Logs。
- 当前布局能承载 MVP 的主要信息。

### 4.2 不足

- Header 信息太少，缺少当前项目、当前 run、模型、运行状态、取消按钮等关键上下文。
- 左侧 SessionSidebar 宽度固定，缺少搜索和 run 状态提示。
- 右侧 Inspector 固定宽度，复杂 JSON、diff、审批内容容易拥挤。
- 底部 Timeline / Logs 高度固定，日志多或 timeline 长时浏览效率不够。
- 移动端和窄屏体验没有明确设计。

## 5. 当前组件能力评估

### 5.1 SessionSidebar

文件：

```text
frontend/src/components/SessionSidebar.tsx
```

已具备：

- 自动初始化项目。
- 加载会话列表。
- 创建会话。
- 删除会话。
- 选择会话。
- 加载和空状态。

不足：

- 没有搜索会话。
- 没有显示会话最近 run 状态。
- 没有显示最后更新时间。
- 删除会话缺少确认和 active run 保护。
- API 失败只写 `console.error`，没有用户可见错误。
- 切换会话时没有完整清理旧 run 的 Inspector、Timeline、Logs 状态。

扩展方向：

- 增加搜索框。
- 会话行展示最近状态：running、failed、completed。
- 会话行展示最后消息摘要或更新时间。
- 删除增加确认弹窗。
- 失败状态展示 Retry。
- 选择会话时自动恢复最近 run。

### 5.2 ConversationPanel

文件：

```text
frontend/src/components/ConversationPanel.tsx
```

已具备：

- 选中会话后加载历史消息。
- 输入消息并创建 run。
- 本地立即添加用户消息。
- 连接 SSE。
- 展示 streaming content。
- 支持取消 run。
- assistant 消息支持 Markdown 渲染。

不足：

- 缺少多行输入体验。
- 缺少发送失败后的回滚或失败标记。
- 缺少 run 失败的用户可见错误提示。
- 缺少空状态下的行动建议。
- 缺少 interrupt / stop 后的明确状态反馈。
- 没有展示当前 run id、模型、耗时、token 等上下文。
- 历史消息与当前 streaming 消息的合并策略依赖后端事件契约，当前仍需统一。

扩展方向：

- 把输入框升级为 textarea 或 auto-resize composer。
- 增加发送状态：sending、streaming、failed、cancelled。
- 增加重新发送上条消息功能。
- 增加模型选择入口。
- 增加 run 错误 banner。
- 增加消息级操作：复制、重试、查看原始事件。

### 5.3 InspectorPanel

文件：

```text
frontend/src/components/InspectorPanel.tsx
```

已具备：

- Tool Calls tab。
- Approvals tab。
- Files tab。
- Tool call 列表。
- Approval 卡片。
- Approval detail。
- Approve、Reject、Edit & Approve 操作按钮。
- 文件列表卡片。

不足：

- Files tab 中点击文件目前没有打开 diff 详情。
- Approval 操作依赖 WebSocket，但 WebSocket 返回事件名与前端监听不一致时 UI 不会更新。
- Approval 提交时缺少错误提示。
- JSON 编辑失败只写 `console.error`。
- Tool call 和 approval 缺少关联跳转。
- 右侧详情区内容较密，长参数和长结果不够好读。

扩展方向：

- 点击 FileDiffCard 打开 `FileDiffView`。
- Approval JSON 编辑错误显示在 UI 上。
- Approval 操作后显示 pending/loading/success/error 状态。
- Tool call 和 approval 互相跳转。
- 增加 risk level、permission、duration、preview 等视觉层级。
- 对 JSON 参数使用可折叠 viewer 或 Monaco readonly editor。

### 5.4 TimelinePanel

文件：

```text
frontend/src/components/TimelinePanel.tsx
```

已具备：

- 展示 step 列表。
- 根据 step type 显示不同 icon。
- 展示 run status、model、tokens、cost。
- 展示 step 创建和完成时间。

不足：

- 只是线性列表，没有按 run event 类型展示完整过程。
- 没有点击 step 联动 Inspector。
- 没有展示 step duration。
- 没有错误详情。
- 没有 loading / reconnect 状态。
- 没有从后端恢复历史 steps 的主动加载逻辑。

扩展方向：

- 点击 tool_call step 自动选中对应 ToolCall。
- 点击 approval step 自动选中 Approval。
- running step 高亮并显示 spinner。
- failed step 展示错误摘要。
- 增加 duration 计算。
- 增加事件过滤：all、model、tool、approval、error。

### 5.5 FileDiffView

文件：

```text
frontend/src/components/FileDiffView.tsx
```

已具备：

- Dialog 展示 diff。
- 展示文件路径。
- 展示 change type badge。
- 用 `pre` 展示 diff_content。

不足：

- 还没有从 Files tab 点击打开。
- 不是 Monaco Diff Editor。
- 没有行号。
- 没有新增/删除行的颜色高亮。
- 没有文件树或多文件导航。
- 没有 approve patch / reject patch 交互。

扩展方向：

- 第一阶段先实现点击打开和统一 diff 样式。
- 第二阶段接入 Monaco Diff Editor。
- 增加 created / modified / deleted 的视觉区分。
- 增加复制 diff、打开原文件、按文件筛选。

### 5.6 LogsPanel

文件：

```text
frontend/src/components/LogsPanel.tsx
```

已具备：

- 日志列表。
- debug/info/warn/error 过滤。
- 关键词搜索。
- 当前 run 状态 badge。
- 过滤计数。
- Auto-scroll 按钮。

不足：

- Auto-scroll 状态存在，但没有实际滚动到最新日志的逻辑。
- 没有从后端主动加载历史 logs。
- 没有按时间倒序/正序切换。
- 没有展开 metadata。
- 没有复制日志。
- 没有日志级别统计。

扩展方向：

- 实现实际 auto-scroll。
- 打开 run 时调用 logs API。
- 支持 metadata 展开。
- 支持复制单条日志。
- 支持 error-only 快捷过滤。

## 6. 当前操作功能评估

### 6.1 已有操作

| 操作 | 当前状态 |
| --- | --- |
| 打开 Console | 已有入口 |
| 查看连接状态 | 已有 |
| 创建会话 | 已有 |
| 删除会话 | 已有 |
| 选择会话 | 已有 |
| 加载历史消息 | 已有 |
| 发送任务并创建 run | 已有 |
| 接收 SSE 流式输出 | 客户端已有，需后端契约对齐 |
| 取消 run | 有 REST 调用和 WebSocket 能力，需统一 |
| 查看 tool call | UI 已有 |
| 审批 approve/reject/edit | UI 已有，链路需修 |
| 查看文件 diff | 组件已有，入口未接通 |
| 查看日志 | UI 已有，历史加载不足 |

### 6.2 当前最影响体验的问题

1. 构建失败导致无法稳定交付。
2. 事件 contract 不统一导致实时 UI 不可信。
3. 缺少用户可见错误状态。
4. 多数操作缺少 loading/success/error 三态。
5. Inspector 信息密度高，但缺少联动和展开层级。
6. Diff 和 Audit 还没有形成可操作闭环。

## 7. 视觉与交互质量评估

### 7.1 当前视觉风格

当前使用接近 shadcn/ui 默认风格：

- 白底
- 浅灰边框
- 小字号工具界面
- 三栏工作台布局
- lucide icon
- badge 标记状态

这个方向适合 Agent Console，属于安静、工具型、可扫描的基础风格。

### 7.2 当前视觉不足

- 视觉层级偏弱，重要状态不够突出。
- Header 没有承担控制台信息中心的角色。
- Timeline、Logs、Inspector 的密度没有统一节奏。
- Empty state 偏基础，没有帮助用户下一步行动。
- 审批场景没有足够强的风险表达。
- 文件 Diff 没有代码审查工具应有的可读性。

### 7.3 UI 扩展原则

后续扩展时应保持“工作台”风格：

- 信息密度适中，优先可扫描。
- 少做营销式视觉，不做大 hero。
- 状态颜色要语义明确。
- 高风险操作必须视觉上更醒目。
- 所有控制按钮必须有 loading/disabled/error 状态。
- 复杂 JSON、diff、logs 应优先可读和可复制。

## 8. 推荐扩展路线

### Phase 1：前端可构建与真实可用

目标：让前端从“看起来有”变成“能稳定跑”。

开发内容：

1. 修复 `controlSocket.ts` 类型错误。
2. 修复 `next.config.mjs` 中无效的 `api` 配置。
3. 统一 SSE payload 类型。
4. 给所有 API 操作补用户可见错误状态。
5. 会话切换时清理旧 run 状态。
6. Files tab 点击打开 `FileDiffView`。

验收：

```bash
cd frontend
npm run build
```

结果通过。

### Phase 2：核心工作台闭环

目标：让用户能完整完成一次 Agent run。

开发内容：

1. 创建会话。
2. 发送任务。
3. 看到 streaming。
4. Timeline 更新。
5. Tool call 出现在 Inspector。
6. 高风险操作出现 Approval。
7. Approve/Reject/Edit 后 UI 更新。
8. 文件修改出现在 Files tab。
9. Logs 实时出现。

验收：

- 至少有一个端到端演示 run。
- 刷新页面后消息、timeline、diff、logs 能恢复。
- 审批操作不会卡住 UI。

### Phase 3：交互增强

目标：让 UI 更像真实产品，而不是开发 demo。

开发内容：

1. Header 增加当前项目、当前模型、run 状态、耗时、停止按钮。
2. SessionSidebar 增加搜索、状态、更新时间。
3. Conversation 增加 textarea、重试、复制。
4. Timeline 增加 step 点击联动 Inspector。
5. Inspector 增加 JSON viewer、错误提示、操作反馈。
6. Logs 增加 metadata 展开和复制。
7. Diff 增加语法高亮或 Monaco Diff。

验收：

- 用户不用打开浏览器控制台也能理解错误。
- 所有主要按钮都有明确反馈。
- 复杂数据能读、能复制、能定位。

### Phase 4：产品级 UI

目标：达到可给真实用户试用的体验。

开发内容：

1. 增加 Audit Log 页面或抽屉。
2. 增加 Run History 页面。
3. 增加 Approval Inbox 页面。
4. 增加 Settings 页面。
5. 增加 responsive 策略。
6. 增加空状态和引导。
7. 增加快捷键：send、stop、focus composer、open inspector。

验收：

- 非开发者也能理解 Agent 当前在做什么。
- 开发者能快速定位失败工具调用和 diff。
- 敏感操作的风险表达清楚。

## 9. 建议新增页面与组件

### 9.1 页面

建议新增：

```text
frontend/src/app/runs/page.tsx
frontend/src/app/approvals/page.tsx
frontend/src/app/audit/page.tsx
frontend/src/app/settings/page.tsx
```

用途：

| 页面 | 目的 |
| --- | --- |
| Runs | 管理历史 run 和 active run |
| Approvals | 集中处理待审批项 |
| Audit | 查询敏感操作记录 |
| Settings | 配置模型、工具权限、环境变量 |

### 9.2 组件

建议新增：

```text
frontend/src/components/RunStatusBar.tsx
frontend/src/components/RunHeaderControls.tsx
frontend/src/components/SessionSearch.tsx
frontend/src/components/MessageComposer.tsx
frontend/src/components/MessageActions.tsx
frontend/src/components/JsonViewer.tsx
frontend/src/components/AuditLogPanel.tsx
frontend/src/components/ApprovalInbox.tsx
frontend/src/components/RunHistoryList.tsx
```

### 9.3 状态管理扩展

建议在 `consoleStore.ts` 增加：

```typescript
type RequestStatus = "idle" | "loading" | "success" | "error";

interface ConsoleUiState {
  sessionListStatus: RequestStatus;
  messageLoadStatus: RequestStatus;
  runCreateStatus: RequestStatus;
  approvalSubmitStatus: Record<string, RequestStatus>;
  lastError: string | null;
}
```

目的：

- 避免所有失败只进 `console.error`。
- 让 UI 能显示错误、重试和禁用状态。
- 支持多个 approval 同时提交时各自显示 loading。

## 10. 优先级清单

### P0：必须马上做

1. 修复前端 build。
2. 修复 `controlSocket.ts` 的 `unknown` spread 类型错误。
3. 移除 `next.config.mjs` 无效配置。
4. 统一 SSE payload contract。
5. Files tab 接通 `FileDiffView`。
6. 所有审批操作增加用户可见错误提示。

### P1：MVP 前端验收需要

1. 会话切换恢复历史 run 数据。
2. Timeline 点击联动 Inspector。
3. Logs 支持历史加载和 metadata 展开。
4. Diff 支持高亮和文件切换。
5. Header 增加 run 控制和上下文。
6. 空状态和错误状态补齐。

### P2：产品体验增强

1. Runs 页面。
2. Approval Inbox 页面。
3. Audit 页面。
4. Settings 页面。
5. 快捷键。
6. 响应式布局。
7. Monaco Diff Editor。

## 11. 前端 MVP 验收标准

前端达到 MVP，需要同时满足：

- `npm run build` 通过。
- 用户可以创建会话、选择会话、删除会话。
- 用户可以发送任务并看到流式输出。
- run 状态在 Header、Conversation、Timeline 中一致。
- Timeline 能展示 message、tool、approval、error。
- Tool Calls 能展示完整参数、结果、错误、风险等级。
- Approval 能 approve、reject、edit，并显示提交状态。
- Files tab 能打开 diff。
- Logs 能实时展示，并能过滤。
- 刷新页面后能恢复历史消息、timeline、diff、logs。
- 所有失败都能在 UI 上看到，不依赖浏览器 console。

## 12. 不建议现在做的事

当前阶段不建议优先做：

- 大规模视觉重设计。
- 复杂动画。
- 企业级导航体系。
- 多租户管理后台。
- 复杂图形化 DAG 编辑器。
- 插件市场。
- 移动端完整适配。

原因是核心链路还没有完全闭合。现在最有价值的是先把 Agent Console 的真实操作闭环跑通。

## 13. 下一步推荐执行顺序

建议按这个顺序推进：

1. 修复 build。
2. 统一 SSE/WebSocket 事件契约。
3. 完成会话、对话、timeline 的端到端恢复。
4. 接通 Files tab 和 FileDiffView。
5. 统一 approval 操作反馈。
6. 增加 Header run status bar。
7. 增加错误和空状态。
8. 再做 Runs、Approvals、Audit 独立页面。

这个顺序能最短路径把当前前端从“架子搭好了”推进到“真实可试用”。

