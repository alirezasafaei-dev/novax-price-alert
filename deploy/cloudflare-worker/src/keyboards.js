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
      { text: "₿ کریپتو", callback_data: "market:crypto" }
    ],
    [
      { text: "🔙 بازگشت", callback_data: "menu:main" }
    ]
  ]
};

export const CRYPTO_ASSETS = {
  inline_keyboard: [
    [
      { text: "💵 تتر (USDT)", callback_data: "asset:USDT" },
      { text: "🐕 دوج (DOGE)", callback_data: "asset:DOGE" }
    ],
    [
      { text: "🐶 شیبا (SHIB)", callback_data: "asset:SHIB" },
      { text: "⚡ ترون (TRX)", callback_data: "asset:TRX" }
    ],
    [
      { text: "🔷 کاردانو (ADA)", callback_data: "asset:ADA" },
      { text: "🔴 پولکادات (DOT)", callback_data: "asset:DOT" }
    ],
    [
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
      { text: "🔙 بازگشت", callback_data: "back:asset" }
    ]
  ]
};

export function confirmAlertKeyboard(alertId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ تایید و ذخیره", callback_data: `confirm:${alertId}` },
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
      ],
      [
        { text: "🔙 بازگشت", callback_data: "menu:alerts" }
      ]
    ]
  };
}
