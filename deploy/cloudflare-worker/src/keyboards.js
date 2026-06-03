export const MAIN_KEYBOARD = {
  keyboard: [
    ["💰 قیمت‌ها", "🔔 تنظیم هشدار"],
    ["📋 هشدارهای من", "❓ راهنما"]
  ],
  resize_keyboard: true,
  one_time_keyboard: false
};

export const MARKET_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "₿ کریپتو", callback_data: "market:crypto" },
      { text: "💵 ارز", callback_data: "market:fiat" },
      { text: "🪙 طلا", callback_data: "market:gold" }
    ],
    [
      { text: "❌ لغو", callback_data: "cancel:alert" },
      { text: "🔙 بازگشت", callback_data: "menu:main" }
    ]
  ]
};

export const CRYPTO_ASSETS = {
  inline_keyboard: [
    [
      { text: "بیت‌کوین (BTC)", callback_data: "asset:BTC" },
      { text: "اتریوم (ETH)", callback_data: "asset:ETH" }
    ],
    [
      { text: "سولانا (SOL)", callback_data: "asset:SOL" },
      { text: "بایننس کوین (BNB)", callback_data: "asset:BNB" }
    ],
    [
      { text: "❌ لغو", callback_data: "cancel:alert" },
      { text: "🔙 بازگشت", callback_data: "back:market" }
    ]
  ]
};

export const FIAT_ASSETS = {
  inline_keyboard: [
    [
      { text: "USD", callback_data: "asset:USD" },
      { text: "EUR", callback_data: "asset:EUR" }
    ],
    [
      { text: "❌ لغو", callback_data: "cancel:alert" },
      { text: "🔙 بازگشت", callback_data: "back:market" }
    ]
  ]
};

export const GOLD_ASSETS = {
  inline_keyboard: [
    [
      { text: "طلای ۱۸ عیار", callback_data: "asset:GOLD_18K" }
    ],
    [
      { text: "سکه امامی", callback_data: "asset:SEKKEH_EMAMI" }
    ],
    [
      { text: "❌ لغو", callback_data: "cancel:alert" },
      { text: "🔙 بازگشت", callback_data: "back:market" }
    ]
  ]
};

export const OPERATOR_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📈 بالاتر از", callback_data: "op:above" },
      { text: "📉 پایین‌تر از", callback_data: "op:below" }
    ],
    [
      { text: "❌ لغو", callback_data: "cancel:alert" },
      { text: "🔙 بازگشت", callback_data: "back:asset" }
    ]
  ]
};

export function confirmAlertKeyboard(alertId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ تایید و فعال‌سازی", callback_data: `confirm:${alertId}` },
        { text: "✏️ اصلاح قیمت", callback_data: "edit:target" }
      ],
      [
        { text: "❌ لغو", callback_data: "cancel:alert" }
      ]
    ]
  };
}

export function alertActionsKeyboard(alertId) {
  return {
    inline_keyboard: [
      [
        { text: "🗑 حذف", callback_data: `delete:${alertId}` }
      ]
    ]
  };
}
