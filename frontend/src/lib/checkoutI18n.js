export const LANGS = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
];

const zhCN = {
  pending: "待付款", paid: "支付成功", expired: "订单已超时", notFound: "订单不存在或已失效",
  ensure: (a) => `请确保实际到账=${a}USDT（含小数尾数），金额不符将无法自动到账`,
  ensureSim: (a) => `请确保实际到账≥${a}USDT，若到账不足将无法自动到账`,
  payWithin: "请在", payWithinSuffix: "内完成付款",
  depositAddr: (n) => `${n}充币地址`, checkChain: (n) => `请认准${n}公链+仔细核对，以免造成损失！`,
  saveQr: "保存二维码", coin: "币种", protocol: "公链协议", amount: "充币数量", orderNo: "订单号", merchant: "收款商户",
  energyTitle: "能量租赁，节省70%矿工费", energyBuyAmount: "快捷购买金额：", rentFee: "租赁费用：", trxAddr: "TRX地址", trxHint: "(先向下方地址转TRX购买能量，后再转U不扣矿工费)",
  trxOnly: "此地址只收 TRX，请勿转 USDT！请勿转 USDT！请勿转 USDT！",
  rentDesc: "租赁说明：因任何一笔 TRC20 转账支出都要支付矿工费（例如：冷钱包转账需消耗 TRX，而交易所一般收取 1U 手续费），但矿工费可以用能量替代（即地址有能量时优先使用能量）。",
  energyRules: [
    ["租赁说明", "因任何一笔TRC20转账支出都要支付矿工费（例如：冷钱包转账需消耗TRX，而交易所一般收取1U手续费），但矿工费可以用能量替代（即地址有能量时优先使用能量）。"],
    ["约节省70%矿工费攻略（交易所的提币除外）", "所以您在充币前可以先花2或4TRX购买6.5万或13.1万的能量，然后系统将自动用该笔能量来抵扣USDT转账的矿工费，每6.5万能量可以抵扣1笔转账（即2TRX的能量可以抵扣原本6.4285TRX矿工费，约节省70%）；因TRC20特殊机制，若转账时的对方收币地址的USDT余额为0，则系统需要消耗双倍矿工费（即13.0285TRX矿工费），则该笔转账也需要消耗双倍能量为13.1万（即4TRX的能量可以抵扣原本13.0285TRX矿工费，约节省70%），详见详细租赁规则。"],
    ["不适用场景", "交易所的提币不消耗TRX矿工费，而是直接扣除USDT手续费，所以租赁能量对交易所的提币无效。"],
    ["能量有效期", "2小时，购买后需尽快使用。"],
  ],
  notesTitle: "充币说明", notes: (n, a, exp) => [
    ["币种限制", `以上地址只支持${n}公链协议的USDT币种（泰达币），请勿充入其他币种，以免造成损失。`],
    ["金额限制", `请务必按以上金额${a}USDT进行充币，超出或低于此金额将无法自动到账，需自行联系商户进行补单。`],
    ["到账时间", "提币到以上地址后，至少需要1个区块链确认才能到账，一般1分钟内完成，请耐心等待区块网络确认。"],
    ["异常处理", "若存在确认超时、错误、大额误充等情形，请联系钱包客服进行人工处理。"],
    ["使用正版", "请务必使用正版浏览器、APP等程序，切勿使用破解版、非官方版本，以免被篡改或被盗。"],
    ["转账地址", "请勿从高风险地址转入，相关地址有高风险拦截及冻结风险，避免影响正常充币流程。"],
    ["区块链记录", "一切交易以官方区块链浏览器记录为准，以上地址的区块链记录链接是", exp],
  ],
  tutorials: "常见教程：", defaultTutorials: ["什么是USDT", "如何购买", "充币多久能到账/如何查询", "充/提币需要手续费吗", "充币没到账要怎么处理"],
  listening: "正在监听链上到账…", keepOpen: "请勿关闭付款页面，付款完成后等待1～3分钟自动到账。", simulate: "模拟支付（演示）", viewTx: "查看链上交易", copied: "已复制", contact: "联系客服",
  demo: "演示订单：此地址为模拟地址，请勿真实转账",
  successSubtitle: "您的付款已确认，感谢您的支付", txHash: "交易哈希", paidTime: "支付时间", returnMerchant: "返回商户", viewOnChain: "查看链上记录", done: "完成", closeHint: "交易已完成，您可以安全关闭此页面", receipt: "下载收据", contactSupport: "联系在线客服", supportNotice: "转错金额或未自动到账？点此联系在线客服", supportTitle: "在线客服", supportInput: "输入消息…", supportSend: "发送", supportDisabled: "该商户暂未开通在线客服", supportEmpty: "有问题随时联系我们，我们会尽快回复",
};

const zhTW = {
  ...zhCN,
  pending: "待付款", paid: "支付成功", expired: "訂單已超時", notFound: "訂單不存在或已失效",
  ensure: (a) => `請確保實際到帳 = ${a} USDT（含小數尾數），金額不符將無法自動到帳`,
  ensureSim: (a) => `請確保實際到帳 ≥ ${a} USDT，若到帳不足將無法自動到帳`,
  payWithin: "請在", payWithinSuffix: "內完成付款",
  depositAddr: (n) => `${n}充幣地址`, checkChain: (n) => `請認準${n}公鏈+仔細核對，以免造成損失！`,
  saveQr: "保存二維碼", coin: "幣種", protocol: "公鏈協議", amount: "充幣數量", orderNo: "訂單號", merchant: "收款商戶",
  energyTitle: "能量租賃，節省 70% 礦工費", energyBuyAmount: "快捷購買金額：", rentFee: "租賃費用：", trxAddr: "TRX 地址", trxHint: "（先向下方地址轉 TRX 購買能量，後再轉 U 不扣礦工費）",
  trxOnly: "此地址只收 TRX，請勿轉 USDT！請勿轉 USDT！請勿轉 USDT！",
  rentDesc: "租賃說明：因任何一筆 TRC20 轉賬支出都要支付礦工費（例如：冷錢包轉賬需消耗 TRX，而交易所一般收取 1U 手續費），但礦工費可以用能量替代（即地址有能量時優先使用能量）。",
  energyRules: [
    ["租賃說明", "因任何一筆TRC20轉賬支出都要支付礦工費（例如：冷錢包轉賬需消耗TRX，而交易所一般收取1U手續費），但礦工費可以用能量替代（即地址有能量時優先使用能量）。"],
    ["約節省70%礦工費攻略（交易所的提幣除外）", "所以您在充幣前可以先花2或4TRX購買6.5萬或13.1萬的能量，然後系統將自動用該筆能量來抵扣USDT轉賬的礦工費，每6.5萬能量可以抵扣1筆轉賬（即2TRX的能量可以抵扣原本6.4285TRX礦工費，約節省70%）；因TRC20特殊機制，若轉賬時的對方收幣地址的USDT餘額為0，則系統需要消耗雙倍礦工費（即13.0285TRX礦工費），則該筆轉賬也需要消耗雙倍能量為13.1萬（即4TRX的能量可以抵扣原本13.0285TRX礦工費，約節省70%），詳見詳細租賃規則。"],
    ["不適用場景", "交易所的提幣不消耗TRX礦工費，而是直接扣除USDT手續費，所以租賃能量對交易所的提幣無效。"],
    ["能量有效期", "2小時，購買後需盡快使用。"],
  ],
  notesTitle: "充幣說明", notes: (n, a, exp) => [
    ["幣種限制", `以上地址只支持 ${n} 公鏈協議的 USDT 幣種（泰達幣），請勿充入其他幣種，以免造成損失。`],
    ["金額限制", `請務必按以上金額 ${a} USDT 進行充幣，超出或低於此金額將無法自動到帳，需自行聯繫商戶進行補單。`],
    ["到賬時間", "提幣到以上地址後，至少需要 1 個區塊鏈確認才能到賬，一般 1 分鐘內完成，請耐心等待區塊網絡確認。"],
    ["異常處理", "若存在確認超時、錯誤、大額誤充等情形，請聯繫商戶客服進行人工處理。"],
    ["使用正版", "請務必使用正版瀏覽器、APP 等程序，切勿使用破解版、非官方版本，以免被篡改或被盜。"],
    ["轉賬地址", "請勿從高風險地址轉入，相關地址有高風險攔截及凍結風險，避免影響正常充幣流程。"],
    ["區塊鏈記錄", "一切交易以官方區塊鏈瀏覽器記錄為準，以上地址的區塊鏈記錄鏈接是", exp],
  ],
  tutorials: "常見教程：", defaultTutorials: ["什麼是 USDT", "如何購買", "充幣多久能到賬 / 如何查詢", "充 / 提幣需要手續費嗎", "充幣沒到賬要怎麼處理"],
  listening: "正在監聽鏈上到賬…", keepOpen: "請勿關閉付款頁面，付款完成後等待1～3分鐘自動到賬。", simulate: "模擬支付（演示）", viewTx: "查看鏈上交易", copied: "已複製", contact: "聯繫客服",
  demo: "演示訂單：此地址為模擬地址，請勿真實轉賬",
  successSubtitle: "您的付款已確認，感謝您的支付", txHash: "交易哈希", paidTime: "支付時間", returnMerchant: "返回商戶", viewOnChain: "查看鏈上記錄", done: "完成", closeHint: "交易已完成，您可以安全關閉此頁面", receipt: "下載收據", contactSupport: "聯繫線上客服", supportNotice: "轉錯金額或未自動到賬？點此聯繫線上客服", supportTitle: "線上客服", supportInput: "輸入訊息…", supportSend: "發送", supportDisabled: "該商戶暫未開通線上客服", supportEmpty: "有問題隨時聯繫我們，我們會盡快回覆",
};

const en = {
  pending: "Awaiting Payment", paid: "Payment Successful", expired: "Order Expired", notFound: "Order not found or expired",
  ensure: (a) => `Please send exactly ${a} USDT (including decimals). Mismatched amounts cannot be credited automatically.`,
  ensureSim: (a) => `Please make sure at least ${a} USDT arrives, otherwise it cannot be credited automatically.`,
  payWithin: "Complete payment within", payWithinSuffix: "",
  depositAddr: (n) => `${n} Deposit Address`, checkChain: (n) => `Make sure you use the ${n} network and double-check the address!`,
  saveQr: "Save QR", coin: "Coin", protocol: "Network", amount: "Amount", orderNo: "Order No.", merchant: "Merchant",
  energyTitle: "Energy rental — save 70% on gas", energyBuyAmount: "Quick buy amount: ", rentFee: "Rental fee: ", trxAddr: "TRX Address", trxHint: "(Send TRX to the address below to buy energy first, then transfer USDT without gas)",
  trxOnly: "This address accepts TRX ONLY. Do NOT send USDT here!",
  rentDesc: "About rental: every TRC20 transfer costs gas (e.g. cold wallets burn TRX, exchanges charge ~1 USDT). Gas can be replaced by Energy — if the address has energy, it will be used first.",
  energyRules: [
    ["About rental", "Every TRC20 transfer costs gas (e.g. cold wallets burn TRX, exchanges charge ~1 USDT). Gas can be replaced by Energy — if the address has energy, it is used first."],
    ["Save ~70% on gas (except exchange withdrawals)", "Before depositing, spend 2 or 4 TRX to buy 65,000 or 131,000 energy. The system will automatically use it to cover the USDT transfer gas. Each 65,000 energy covers one transfer (2 TRX of energy replaces ~6.4285 TRX gas, ~70% saved). Due to TRC20 rules, if the recipient's USDT balance is 0, double gas (~13.0285 TRX) is needed, so double energy (131,000 = 4 TRX) is required."],
    ["Not applicable", "Exchange withdrawals do not consume TRX gas (they deduct a USDT fee), so energy rental has no effect on them."],
    ["Energy validity", "2 hours — please use it soon after purchase."],
  ],
  notesTitle: "Deposit Notes", notes: (n, a, exp) => [
    ["Coin", `This address only accepts USDT on the ${n} network. Do not deposit other coins.`],
    ["Amount", `Send exactly ${a} USDT. Over- or under-payments cannot be credited automatically; contact the merchant to fix.`],
    ["Arrival", "At least 1 block confirmation is required, usually within 1 minute. Please wait for the network."],
    ["Issues", "For timeouts, errors or large mistaken deposits, contact merchant support for manual handling."],
    ["Official apps", "Only use official browsers / apps. Cracked or unofficial versions may be tampered with."],
    ["Source address", "Do not send from high-risk addresses; they may be intercepted or frozen."],
    ["On-chain record", "All transactions are subject to the official block explorer. Address record:", exp],
  ],
  tutorials: "Guides:", defaultTutorials: ["What is USDT", "How to buy", "How long does a deposit take / how to check", "Are there fees", "Deposit not arrived?"],
  listening: "Listening for on-chain payment…", keepOpen: "Please keep this page open. Funds arrive automatically within 1–3 minutes after payment.", simulate: "Simulate payment (demo)", viewTx: "View on-chain tx", copied: "Copied", contact: "Support",
  demo: "Demo order: this is a simulated address, do not send real funds",
  successSubtitle: "Your payment has been confirmed. Thank you!", txHash: "Tx Hash", paidTime: "Paid At", returnMerchant: "Return to Merchant", viewOnChain: "View on-chain record", done: "Done", closeHint: "Payment complete — you can safely close this page.", receipt: "Download receipt", contactSupport: "Contact support", supportNotice: "Wrong amount or payment not detected? Contact support here", supportTitle: "Live Support", supportInput: "Type a message…", supportSend: "Send", supportDisabled: "This merchant has not enabled live support", supportEmpty: "Message us anytime, we'll reply shortly",
};

export const TUTORIAL_CONTENT = [
  `USDT又称为泰达币(USDT)，是由美国Tether公司，为了与美元等值发行的一种代币，即1USDT=1美元，用户可以随时使用USDT与USD进行1:1兑换。为了严格遵守其公司所承诺的1比1保证金，其每增加1枚新的USDT，都会在其银行账户里增加1美元的账户资金，从而保证投资者随用随取的安全性。同时用户可以在 Tether官网平台进行资金查询，以随时监督其资金安全性以保障透明度。

USDT可以被传输、存储、使用，就像BTC、ETH或任何其他加密货币一样，用户可以通过主流交易所或NO钱包来进行交易和存储。

USDT用起来很简单。在全球各大主流交易平台OKX、币安等，可以通过场外交易购买USDT，在币币交易区它可以被用于购买比特币和其它加密货币。USDT也可以非常容易的从交易所移转到任何支持的钱包中。`,
  `通过各大交易所购买：
地址如下：
币安交易所：https://www.binance.com
欧易交易所：https://www.okx.com
Gate交易所：https://www.gate.io

中国大陆翻墙vpn：
Opera浏览器：https://www.opera.com/zh-cn
PandaFan：https://pandafan.website/pricing
NordVPN：https://nordvpn.com/zh`,
  `充值经过一定数量的网络确认就可以到账。网络确认是由区块上的网络矿工进行自动确认的，平台是无法干预区块确认的，所以相应的确认时间是不固定的，每个币种所需的确认数不一样，需要以区块的确认为准。

USDT充币支持TRC20网络，一般10秒左右即可到账。

如果您充值的是TRC20网络的USDT，可以直接通过TRON的区块浏览器查询，经过1个区块确认即代表已经到账。https://tronscan.org/#/`,
  `本平台充币不收取任何手续费，您实际到账金额以链上转账金额为准。

转账时钱包或交易所会收取矿工费（TRC20 约 6–13 TRX，交易所提币一般收取 1 USDT 左右手续费），该费用由您的钱包/交易所收取，与平台无关。使用钱包转账前可通过「能量租赁」购买能量，约节省 70% 矿工费。`,
  `区块链资产转账分为三个步骤：
(1) 提出
(2) 区块确认
(3) 入账

如果您的充值已有区块确认，钱包会直接帮您入账，如果没有入账，您可直接联系客服。

请核对：转账网络是否为订单所示公链、转账金额是否与订单精确金额一致（含小数尾数）、是否在订单有效期内完成转账。`,
];

export const I18N = { "zh-CN": zhCN, "zh-TW": zhTW, en };
