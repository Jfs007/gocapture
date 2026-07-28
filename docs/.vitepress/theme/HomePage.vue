<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import {
  ArrowForwardOutline,
  CheckmarkCircleOutline,
  CheckmarkOutline,
  CodeSlashOutline,
  CopyOutline,
  ExtensionPuzzleOutline,
  GitBranchOutline,
  LinkOutline,
  LocateOutline,
  TerminalOutline,
} from '@vicons/ionicons5'

const copied = ref(false)
const installCommand = 'npm install -g @sep-agent/gocapture'

async function copyInstallCommand() {
  await navigator.clipboard.writeText(installCommand)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1600)
}

const capabilities = [
  {
    icon: LocateOutline,
    label: '页面选区',
    title: '在真实页面上指出修改位置',
    description: '直接框选文案、表单、表格或任意页面区域，让需求和运行时 DOM 一起进入开发流程。',
    tone: 'blue',
  },
  {
    icon: CodeSlashOutline,
    label: '源码上下文',
    title: '把页面证据关联到本地项目',
    description: 'GoCapture 管理页面与项目的绑定，并把选区对应的源码事实交给开发 Agent。',
    tone: 'green',
  },
  {
    icon: LinkOutline,
    label: 'Agent 连接',
    title: '接入 Codex 或 Claude Code',
    description: '项目级保存 Agent 与任务上下文，同一个选区可以继续追加需求，不必反复解释位置。',
    tone: 'coral',
  },
]

const steps = [
  {
    number: '01',
    title: '安装 GoCapture',
    description: '安装 CLI，并让本地服务常驻运行。',
    command: 'npm install -g @sep-agent/gocapture\ngocapture install',
  },
  {
    number: '02',
    title: '加载 Chrome 扩展',
    description: '打开扩展目录，然后在 Chrome 中加载。',
    command: 'gocapture chrome',
  },
  {
    number: '03',
    title: '绑定项目与 Agent',
    description: '在侧边栏选择源码目录，并关联 Codex 或 Claude Code。',
    command: 'gocapture status',
  },
  {
    number: '04',
    title: '框选并提交需求',
    description: '选择页面区域，输入修改要求，后续过程交给开发 Agent。',
    command: '@选区 把登录文案加粗',
  },
]
</script>

<template>
  <main class="gc-home">
    <header class="gc-nav">
      <a class="gc-brand" :href="withBase('/')">
        <img :src="withBase('/logo.svg')" alt="" width="32" height="32">
        <span>GoCapture</span>
      </a>
      <nav aria-label="主导航">
        <a :href="withBase('/guide/quick-start')">快速开始</a>
        <a :href="withBase('/guide/')">使用指南</a>
        <a href="https://github.com/Jfs007/gocapture" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
      <a class="gc-nav-cta" :href="withBase('/guide/quick-start')">
        开始使用
        <ArrowForwardOutline aria-hidden="true" />
      </a>
    </header>

    <section class="gc-hero">
      <div class="gc-hero-copy">
        <div class="gc-kicker">
          <span></span>
          浏览器选区 × 本地源码 × 开发 Agent
        </div>
        <h1>GoCapture</h1>
        <p class="gc-headline">点选页面，直接交给 Agent 修改源码</p>
        <p class="gc-subtitle">
          不再手动描述“这个按钮在哪”。框选真实页面区域，GoCapture 将页面证据、项目上下文和你的需求交给 Coding Agent。
        </p>
        <div class="gc-hero-actions">
          <a class="gc-button gc-button-primary" :href="withBase('/guide/quick-start')">
            5 分钟开始使用
            <ArrowForwardOutline aria-hidden="true" />
          </a>
          <button class="gc-command" type="button" title="复制安装命令" @click="copyInstallCommand">
            <TerminalOutline aria-hidden="true" />
            <code>{{ installCommand }}</code>
            <CheckmarkOutline v-if="copied" aria-label="已复制" />
            <CopyOutline v-else aria-label="复制" />
          </button>
        </div>
        <div class="gc-proof">
          <span><CheckmarkCircleOutline /> 本地源码优先</span>
          <span><CheckmarkCircleOutline /> 项目级上下文</span>
          <span><CheckmarkCircleOutline /> Codex / Claude Code</span>
        </div>
      </div>

      <div class="gc-product-stage" aria-label="GoCapture 操作界面示意">
        <div class="gc-browser">
          <div class="gc-browser-bar">
            <div class="gc-window-dots"><i></i><i></i><i></i></div>
            <div class="gc-address">app.example.com/login</div>
            <span>业务页面</span>
          </div>
          <div class="gc-page-canvas">
            <div class="gc-page-brand"></div>
            <div class="gc-login-panel">
              <small>WELCOME BACK</small>
              <h3>登录到工作台</h3>
              <label>账号</label>
              <div class="gc-input-line"></div>
              <label>密码</label>
              <div class="gc-input-line"></div>
              <div class="gc-selected-button">
                登 录
                <span class="gc-selection-label">已选中</span>
              </div>
            </div>
          </div>
        </div>

        <aside class="gc-agent-panel">
          <div class="gc-agent-head">
            <div>
              <strong>GoCapture</strong>
              <small>app.example.com</small>
            </div>
            <span class="gc-agent-status">Agent 已连接</span>
          </div>
          <div class="gc-project-row">
            <GitBranchOutline aria-hidden="true" />
            <div>
              <strong>web-console</strong>
              <small>项目与选区已绑定</small>
            </div>
          </div>
          <div class="gc-thread">
            <div class="gc-thread-item">
              <span class="gc-avatar is-user">你</span>
              <p>把登录文案加粗</p>
            </div>
            <div class="gc-thread-item">
              <span class="gc-avatar is-system">G</span>
              <div>
                <strong>源码位置已确认</strong>
                <code>src/views/login/PwdForm.vue:31</code>
              </div>
            </div>
            <div class="gc-thread-item">
              <span class="gc-avatar is-agent">A</span>
              <div>
                <strong>Agent 正在修改</strong>
                <small>读取文件 · 编辑样式 · 验证结果</small>
              </div>
            </div>
          </div>
          <div class="gc-composer">
            <span>@选区 继续把颜色改为绿色</span>
            <b>↑</b>
          </div>
        </aside>
      </div>
    </section>

    <section class="gc-band gc-intro">
      <div class="gc-section-heading">
        <span>核心能力</span>
        <h2>让页面、源码与 Agent 说同一种语言</h2>
        <p>GoCapture 不替代开发 Agent，它负责把浏览器里的真实位置和本地项目上下文准确交接过去。</p>
      </div>
      <div class="gc-capability-grid">
        <article v-for="item in capabilities" :key="item.title" class="gc-capability" :class="`is-${item.tone}`">
          <div class="gc-capability-icon"><component :is="item.icon" /></div>
          <small>{{ item.label }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="gc-band gc-workflow">
      <div class="gc-section-heading is-light">
        <span>工作方式</span>
        <h2>从一句页面需求，到可执行开发任务</h2>
      </div>
      <div class="gc-workflow-line">
        <div class="gc-workflow-step">
          <b>1</b>
          <div><strong>选择页面区域</strong><small>捕获当前 DOM 与页面地址</small></div>
        </div>
        <ArrowForwardOutline class="gc-flow-arrow" />
        <div class="gc-workflow-step">
          <b>2</b>
          <div><strong>绑定本地项目</strong><small>建立页面和源码目录的关系</small></div>
        </div>
        <ArrowForwardOutline class="gc-flow-arrow" />
        <div class="gc-workflow-step">
          <b>3</b>
          <div><strong>关联开发 Agent</strong><small>Codex 或 Claude Code 接管任务</small></div>
        </div>
        <ArrowForwardOutline class="gc-flow-arrow" />
        <div class="gc-workflow-step">
          <b>4</b>
          <div><strong>修改并回传</strong><small>过程与结果在侧边栏持续展示</small></div>
        </div>
      </div>
    </section>

    <section class="gc-band gc-install" id="install">
      <div class="gc-install-copy">
        <div class="gc-section-heading">
          <span>快速安装</span>
          <h2>四步完成本地连接</h2>
          <p>需要 Node.js 20.18.1 或更高版本。macOS 可安装为登录自启服务，其他系统可以前台模式运行。</p>
        </div>
        <a class="gc-text-link" :href="withBase('/guide/quick-start')">
          查看完整安装说明
          <ArrowForwardOutline />
        </a>
      </div>
      <div class="gc-step-list">
        <article v-for="step in steps" :key="step.number" class="gc-step">
          <span>{{ step.number }}</span>
          <div>
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
            <pre><code>{{ step.command }}</code></pre>
          </div>
        </article>
      </div>
    </section>

    <section class="gc-band gc-agents">
      <div class="gc-section-heading">
        <span>连接能力</span>
        <h2>保留你熟悉的开发 Agent</h2>
        <p>Agent 负责理解项目、修改代码与验证结果。GoCapture 只提供更准确的页面入口和持续选区上下文。</p>
      </div>
      <div class="gc-agent-grid">
        <article>
          <div class="gc-agent-mark is-codex">C</div>
          <div>
            <h3>Codex</h3>
            <p>通过 App Server 建立项目任务，持续复用 Thread 上下文。</p>
          </div>
        </article>
        <article>
          <div class="gc-agent-mark is-claude">C</div>
          <div>
            <h3>Claude Code</h3>
            <p>支持沿用本机配置，也可配置 Anthropic 或兼容模型后端。</p>
          </div>
        </article>
        <article>
          <ExtensionPuzzleOutline class="gc-agent-generic" />
          <div>
            <h3>统一连接协议</h3>
            <p>Provider 共享连接、任务、消息与项目绑定能力，便于继续扩展新的 Agent。</p>
          </div>
        </article>
      </div>
    </section>

    <section class="gc-final-cta">
      <div>
        <span>准备开始</span>
        <h2>下一次修改，从页面上直接指出来</h2>
      </div>
      <a class="gc-button gc-button-dark" :href="withBase('/guide/quick-start')">
        阅读快速开始
        <ArrowForwardOutline />
      </a>
    </section>

    <footer class="gc-footer">
      <a class="gc-brand" :href="withBase('/')">
        <img :src="withBase('/logo.svg')" alt="" width="28" height="28">
        <span>GoCapture</span>
      </a>
      <p>浏览器页面选区与本地开发 Agent 之间的连接层。</p>
      <div>
        <a :href="withBase('/guide/')">文档</a>
        <a href="https://github.com/Jfs007/gocapture" target="_blank" rel="noreferrer">GitHub</a>
        <span>MIT License</span>
      </div>
    </footer>
  </main>
</template>
