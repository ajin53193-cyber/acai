export const LANGS = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
];

const zhCN = {
  pending: "待付款", paid: "支付成功", expired: "订单已超时", notFound: "订单不存在或已失效",
  ensure: (a) => `请确保实际到账 = ${a} USDT（含小数尾数），金额不符将无法自动上分`,
  ensureSim: (a) => `请确保实际到账 ≥ ${a} USDT，若到账不足将无法自动上分`,
  payWithin: "请在", payWithinSuffix: "内完成付款",
  depositAddr: (n) => `${n} 入币地址`, checkChain: (n) => `请认准 ${n} 公链 + 仔细核对，以免造成损失！`,
  saveQr: "保存 QR", coin: "币种", protocol: "公链协议", amount: "存币数量", orderNo: "订单编号", merchant: "收款商户",
  energyTitle: "能量租赁，节省 70% 矿工费", rentFee: "租赁费用：", trxAddr: "TRX 地址", trxHint: "（先向下方地址转 TRX 购买能量，后再转 U 不扣矿工费）",
  trxOnly: "此地址只收 TRX，请勿转 USDT！请勿转 USDT！请勿转 USDT！",
  rentDesc: "租赁说明：因任何一笔 TRC20 转账支出都要支付矿工费（例如：冷钱包转账需消耗 TRX，而交易所一般收取 1U 手续费），但矿工费可以用能量替代（即地址有能量时优先使用能量）。",
  notesTitle: "注意事项", notes: (n, a, exp) => [
    ["币种限制", `以上地址只支持 ${n} 公链协议的 USDT 币种（泰达币），请勿充入其他币种，以免造成损失。`],
    ["金额限制", `请务必按以上金额 ${a} USDT 进行充币，超出或低于此金额将无法自动上分，需自行联系商户进行补单。`],
    ["到账时间", "提币到以上地址后，至少需要 1 个区块链确认才能到账，一般 1 分钟内完成，请耐心等待区块网络确认。"],
    ["异常处理", "若存在确认超时、错误、大额误充等情形，请联系商户客服进行人工处理。"],
    ["使用正版", "请务必使用正版浏览器、APP 等程序，切勿使用破解版、非官方版本，以免被篡改或被盗。"],
    ["转账地址", "请勿从高风险地址转入，相关地址有高风险拦截及冻结风险，避免影响正常充币流程。"],
    ["区块链记录", "一切交易以官方区块链浏览器记录为准，以上地址的区块链记录链接是", exp],
  ],
  tutorials: "常见教程：", defaultTutorials: ["什么是 USDT", "如何购买", "充币多久能到账 / 如何查询", "充 / 提币需要手续费吗", "充币没到账要怎么处理"],
  listening: "正在监听链上到账…", simulate: "模拟支付（演示）", viewTx: "查看链上交易", copied: "已复制", contact: "联系客服",
  demo: "演示订单：此地址为模拟地址，请勿真实转账",
};

const zhTW = {
  ...zhCN,
  pending: "待付款", paid: "支付成功", expired: "訂單已超時", notFound: "訂單不存在或已失效",
  ensure: (a) => `請確保實際到帳 = ${a} USDT（含小數尾數），金額不符將無法自動上分`,
  ensureSim: (a) => `請確保實際到帳 ≥ ${a} USDT，若到帳不足將無法自動上分`,
  payWithin: "請在", payWithinSuffix: "內完成付款",
  depositAddr: (n) => `${n} 入幣地址`, checkChain: (n) => `請認準 ${n} 公鏈 + 仔細核對，以免造成損失！`,
  saveQr: "儲存 QR", coin: "幣種", protocol: "公鏈協議", amount: "存幣數量", orderNo: "訂單編號", merchant: "收款商戶",
  energyTitle: "能量租賃，節省 70% 礦工費", rentFee: "租賃費用：", trxAddr: "TRX 地址", trxHint: "（先向下方地址轉 TRX 購買能量，後再轉 U 不扣礦工費）",
  trxOnly: "此地址只收 TRX，請勿轉 USDT！請勿轉 USDT！請勿轉 USDT！",
  rentDesc: "租賃說明：因任何一筆 TRC20 轉賬支出都要支付礦工費（例如：冷錢包轉賬需消耗 TRX，而交易所一般收取 1U 手續費），但礦工費可以用能量替代（即地址有能量時優先使用能量）。",
  notesTitle: "注意事項", notes: (n, a, exp) => [
    ["幣種限制", `以上地址只支持 ${n} 公鏈協議的 USDT 幣種（泰達幣），請勿充入其他幣種，以免造成損失。`],
    ["金額限制", `請務必按以上金額 ${a} USDT 進行充幣，超出或低於此金額將無法自動上分，需自行聯繫商戶進行補單。`],
    ["到賬時間", "提幣到以上地址後，至少需要 1 個區塊鏈確認才能到賬，一般 1 分鐘內完成，請耐心等待區塊網絡確認。"],
    ["異常處理", "若存在確認超時、錯誤、大額誤充等情形，請聯繫商戶客服進行人工處理。"],
    ["使用正版", "請務必使用正版瀏覽器、APP 等程序，切勿使用破解版、非官方版本，以免被篡改或被盜。"],
    ["轉賬地址", "請勿從高風險地址轉入，相關地址有高風險攔截及凍結風險，避免影響正常充幣流程。"],
    ["區塊鏈記錄", "一切交易以官方區塊鏈瀏覽器記錄為準，以上地址的區塊鏈記錄鏈接是", exp],
  ],
  tutorials: "常見教程：", defaultTutorials: ["什麼是 USDT", "如何購買", "充幣多久能到賬 / 如何查詢", "充 / 提幣需要手續費嗎", "充幣沒到賬要怎麼處理"],
  listening: "正在監聽鏈上到賬…", simulate: "模擬支付（演示）", viewTx: "查看鏈上交易", copied: "已複製", contact: "聯繫客服",
  demo: "演示訂單：此地址為模擬地址，請勿真實轉賬",
};

const en = {
  pending: "Awaiting Payment", paid: "Payment Successful", expired: "Order Expired", notFound: "Order not found or expired",
  ensure: (a) => `Please send exactly ${a} USDT (including decimals). Mismatched amounts cannot be credited automatically.`,
  ensureSim: (a) => `Please make sure at least ${a} USDT arrives, otherwise it cannot be credited automatically.`,
  payWithin: "Complete payment within", payWithinSuffix: "",
  depositAddr: (n) => `${n} Deposit Address`, checkChain: (n) => `Make sure you use the ${n} network and double-check the address!`,
  saveQr: "Save QR", coin: "Coin", protocol: "Network", amount: "Amount", orderNo: "Order No.", merchant: "Merchant",
  energyTitle: "Energy rental — save 70% on gas", rentFee: "Rental fee: ", trxAddr: "TRX Address", trxHint: "(Send TRX to the address below to buy energy first, then transfer USDT without gas)",
  trxOnly: "This address accepts TRX ONLY. Do NOT send USDT here!",
  rentDesc: "About rental: every TRC20 transfer costs gas (e.g. cold wallets burn TRX, exchanges charge ~1 USDT). Gas can be replaced by Energy — if the address has energy, it will be used first.",
  notesTitle: "Notes", notes: (n, a, exp) => [
    ["Coin", `This address only accepts USDT on the ${n} network. Do not deposit other coins.`],
    ["Amount", `Send exactly ${a} USDT. Over- or under-payments cannot be credited automatically; contact the merchant to fix.`],
    ["Arrival", "At least 1 block confirmation is required, usually within 1 minute. Please wait for the network."],
    ["Issues", "For timeouts, errors or large mistaken deposits, contact merchant support for manual handling."],
    ["Official apps", "Only use official browsers / apps. Cracked or unofficial versions may be tampered with."],
    ["Source address", "Do not send from high-risk addresses; they may be intercepted or frozen."],
    ["On-chain record", "All transactions are subject to the official block explorer. Address record:", exp],
  ],
  tutorials: "Guides:", defaultTutorials: ["What is USDT", "How to buy", "How long does a deposit take / how to check", "Are there fees", "Deposit not arrived?"],
  listening: "Listening for on-chain payment…", simulate: "Simulate payment (demo)", viewTx: "View on-chain tx", copied: "Copied", contact: "Support",
  demo: "Demo order: this is a simulated address, do not send real funds",
};

export const I18N = { "zh-CN": zhCN, "zh-TW": zhTW, en };
