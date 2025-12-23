import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// 从环境变量读取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 固定的演示用户地址（包含所有8个仿真账号）
const demoUsers = [
  "0x1111111111111111111111111111111111111111", // Alice
  "0x2222222222222222222222222222222222222222", // Bob
  "0x3333333333333333333333333333333333333333", // Carol
  "0x4444444444444444444444444444444444444444", // Dave
  "0x5555555555555555555555555555555555555555", // Erin
  "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", // Satoshi_Fan_2024
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Local_Whale
  "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // Prediction_Oracle
];

function randomUser() {
  return demoUsers[Math.floor(Math.random() * demoUsers.length)];
}

function parseUnits(value, decimals = 18) {
  return ethers.parseUnits(value.toString(), decimals).toString();
}

async function seedTradesAndOrders() {
  console.log("Connecting to Supabase:", supabaseUrl);

  // 1. 获取所有市场映射
  const { data: markets, error: marketError } = await supabase.from("markets_map").select("*");

  if (marketError) {
    console.error("Error fetching markets:", marketError);
    return;
  }

  if (!markets || markets.length === 0) {
    console.log("No markets found in markets_map table.");
    return;
  }

  console.log(`Found ${markets.length} markets. Generating data...`);

  // 2. 获取所有 outcomes
  const { data: outcomes, error: outcomeError } = await supabase
    .from("prediction_outcomes")
    .select("*");

  if (outcomeError) {
    console.error("Error fetching outcomes:", outcomeError);
    return;
  }

  const tradesToInsert = [];
  const ordersToInsert = [];

  // 辅助函数：生成随机价格 (0.3 - 0.7)
  const randomPrice = () => 0.3 + Math.random() * 0.4;

  // 辅助函数：生成随机数量 (1 - 100)
  const randomAmount = () => 1 + Math.random() * 99;

  for (const market of markets) {
    const eventOutcomes = outcomes.filter((o) => o.prediction_id === market.event_id);
    if (eventOutcomes.length === 0) continue;

    // 为每个 outcome 生成数据
    for (const outcome of eventOutcomes) {
      // --- 生成 Trades (历史成交) ---
      // 每个 outcome 生成 3-5 条成交
      const tradeCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < tradeCount; i++) {
        const price = randomPrice();
        const amount = randomAmount();
        const isBuy = Math.random() > 0.5;
        const maker = randomUser();
        let taker = randomUser();
        while (taker === maker) taker = randomUser(); // 确保 maker != taker

        tradesToInsert.push({
          network_id: market.chain_id,
          market_address: market.market,
          outcome_index: outcome.outcome_index,
          price: price.toFixed(4), // Numeric
          amount: amount.toFixed(4), // Numeric
          taker_address: taker,
          maker_address: maker,
          is_buy: isBuy,
          tx_hash: `0xseed_trade_${market.event_id}_${outcome.outcome_index}_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          block_number: 1000000 + i,
          block_timestamp: new Date(
            Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
          ).toISOString(), // 过去7天内
          created_at: new Date().toISOString(),
        });
      }

      // --- 生成 Orders (订单簿深度) ---
      // 买单 (Bids): 价格较低，从 0.1 到 0.45
      const bidCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < bidCount; i++) {
        const price = 0.1 + Math.random() * 0.35; // 0.1 - 0.45
        const amount = randomAmount();
        const maker = randomUser();

        ordersToInsert.push({
          verifying_contract: market.market,
          chain_id: market.chain_id,
          market_key: `${market.chain_id}:${market.event_id}`,
          maker_address: maker,
          maker_salt: Math.floor(Math.random() * 1e15).toString(),
          outcome_index: outcome.outcome_index,
          is_buy: true,
          price: parseUnits(price.toFixed(4)), // uint256 string
          amount: parseUnits(amount.toFixed(4)), // uint256 string
          remaining: parseUnits(amount.toFixed(4)), // 全额剩余
          expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
          signature: "0xseed_signature",
          status: "open",
        });
      }

      // 卖单 (Asks): 价格较高，从 0.55 到 0.9
      const askCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < askCount; i++) {
        const price = 0.55 + Math.random() * 0.35; // 0.55 - 0.9
        const amount = randomAmount();
        const maker = randomUser();

        ordersToInsert.push({
          verifying_contract: market.market,
          chain_id: market.chain_id,
          market_key: `${market.chain_id}:${market.event_id}`,
          maker_address: maker,
          maker_salt: Math.floor(Math.random() * 1e15).toString(),
          outcome_index: outcome.outcome_index,
          is_buy: false,
          price: parseUnits(price.toFixed(4)), // uint256 string
          amount: parseUnits(amount.toFixed(4)), // uint256 string
          remaining: parseUnits(amount.toFixed(4)), // 全额剩余
          expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天后过期
          signature: "0xseed_signature",
          status: "open",
        });
      }
    }
  }

  // 批量插入 Trades
  if (tradesToInsert.length > 0) {
    const { error } = await supabase.from("trades").insert(tradesToInsert);
    if (error) console.error("Error inserting trades:", error);
    else console.log(`Successfully inserted ${tradesToInsert.length} trades.`);
  }

  // 批量插入 Orders
  if (ordersToInsert.length > 0) {
    const { error } = await supabase.from("orders").insert(ordersToInsert);
    if (error) console.error("Error inserting orders:", error);
    else console.log(`Successfully inserted ${ordersToInsert.length} orders.`);
  }
}

seedTradesAndOrders();
