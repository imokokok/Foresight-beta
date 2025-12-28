const defaultBaseUrl = process.env.SEED_BASE_URL || "http://localhost:3000";
const targetTotal = Number(process.env.SEED_PROPOSAL_COUNT || 24);

const wallets = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
];

const categories = ["General", "Crypto", "AI", "Macro", "DeFi", "Governance"];

const scenarios = [
  {
    title: "2025 美联储降息路径讨论",
    content:
      "围绕 2025 年美联储货币政策路径，讨论市场对全年累计降息次数和节奏的预期，以及对加密资产估值的潜在影响。",
    category: "Macro",
  },
  {
    title: "以太坊坎昆升级后链上活动持续性",
    content:
      "评估以太坊坎昆升级上线后，Rollup 手续费下降是否会在未来 3 个月持续带来日活地址和交易量的结构性提升。",
    category: "Crypto",
  },
  {
    title: "AI Agent 驱动交易策略效果",
    content:
      "讨论在真实资金账户中引入 AI Agent 做决策辅助，对策略胜率、回撤控制和交易频率的实际影响，以及可能的失效场景。",
    category: "AI",
  },
  {
    title: "稳定币监管落地节奏",
    content:
      "围绕主要经济体稳定币监管框架的落地时间表，讨论合规门槛、牌照模式以及对现有算法稳定币的存续影响。",
    category: "DeFi",
  },
  {
    title: "Foresight 治理代币通胀参数调整",
    content:
      "就未来一年协议治理代币的年度通胀率、解锁曲线和社区激励分配比例进行讨论，权衡流动性与长期稀缺性的平衡。",
    category: "Governance",
  },
  {
    title: "加密与宏观相关性阶段性变化",
    content:
      "围绕比特币与纳指、黄金在不同宏观阶段的相关性变化，讨论接下来一个季度是否会出现脱钩或重新高度联动的情形。",
    category: "Macro",
  },
];

function pickWallet(index) {
  return wallets[index % wallets.length];
}

function pickCategory(index) {
  return categories[index % categories.length];
}

function buildScenario(index, n) {
  const base = scenarios[index % scenarios.length];
  const title = `[TEST] ${base.title} #${n}`;
  const content = `${base.content}\n\n本条为提案审核工作台仿真数据，用于模拟真实场景第 ${n} 条。`;
  const category = base.category || pickCategory(index);
  return { title, content, category };
}

async function fetchExistingTestProposals(baseUrl) {
  const res = await fetch(`${baseUrl}/api/forum?eventId=0`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to load existing proposals: ${res.status} ${text}`);
  }
  const data = await res.json();
  const threads = Array.isArray(data.threads) ? data.threads : [];
  return threads.filter((t) => typeof t.title === "string" && t.title.startsWith("[TEST] "));
}

async function createProposal(baseUrl, index) {
  const walletAddress = pickWallet(index);
  const n = index + 1;
  const scenario = buildScenario(index, n);
  const title = scenario.title;
  const content = scenario.content;
  const category = scenario.category;

  const body = {
    eventId: 0,
    title,
    content,
    category,
    walletAddress,
  };

  const res = await fetch(`${baseUrl}/api/forum`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create proposal #${n}: ${res.status} ${text}`);
  }

  const json = await res.json().catch(() => ({}));
  const id = json?.data?.id;
  return { id, title };
}

async function main() {
  const baseUrl = defaultBaseUrl.replace(/\/+$/, "");
  console.log("Seeding proposals via API");
  console.log("Base URL:", baseUrl);
  console.log("Target total test proposals:", targetTotal);

  const existing = await fetchExistingTestProposals(baseUrl);
  console.log("Existing test proposals:", existing.length);

  if (existing.length >= targetTotal) {
    console.log("Target already satisfied, no new proposals created");
    return;
  }

  const toCreate = targetTotal - existing.length;
  console.log("Creating additional proposals:", toCreate);

  for (let i = 0; i < toCreate; i += 1) {
    const globalIndex = existing.length + i;
    try {
      const created = await createProposal(baseUrl, globalIndex);
      console.log("Created proposal", globalIndex + 1, "id:", created.id);
    } catch (e) {
      console.error("Error creating proposal", globalIndex + 1, e);
    }
  }

  console.log("Done");
}

main().catch((e) => {
  console.error("Seed script failed", e);
  process.exit(1);
});
