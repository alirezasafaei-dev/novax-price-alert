import { useState, useRef, useEffect } from 'react';
import { ChatMessage, Asset } from '../types';
import { Send, Sparkles, Bot, User, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIChatProps {
  assets: Asset[];
  language: 'fa' | 'en';
}

export default function AIChat({ assets, language }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-start',
      sender: 'assistant',
      text: language === 'fa' 
        ? `سلام! من دستیار مالی اختصاصی هوشمند شبکه NovaX هستم. 🤖💹
من به قیمت‌های کاملاً زنده بازار کریپتو کارنسی (بایننس) و قیمت‌های ارز آزاد، دلار و مسکوکات طلا در بازار ایران دسترسی دارم.

از من چه سوالی داری؟ می‌توانید سؤالاتی بپرسی مانند:
- "روند سکه امامی و طلای ۱۸ عیار را تحلیل کن"
- "بیت‌کوین در چه موقعیتی است؟ سیگنال تکنیکال صادر کن"
- "نحوه تنظیم هشدارها روی کانال تلگرام به چه صورت است؟"`
        : `Hi there! I am the NovaX Intelligent AI Financial Analyst. 🤖💹
I have access to live Binance cryptocurrency quotes and live USD/Toman and gold prices in Iran.

How can I help you today? You can ask queries like:
- "Analyze Bitcoin technical outlook"
- "Should I buy Gold or Coin right now?"
- "How do I deploy the price notifier on my server?"`,
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isFa = language === 'fa';

  const quickPrompts = isFa ? [
    { text: 'بیت‌کوین رو تحلیل کن', q: 'بیت‌کوین رو تحلیل کن و نظر بده' },
    { text: 'طلای ۱۸ عیار بخرم؟', q: 'نمودار و روند فعلی بازارهای طلا و سکه را تحلیل کن؛ خرید مناسب است؟' },
    { text: 'ربات تلگرام چطوری کار می‌کنه؟', q: 'نحوه استقرار ربات در VPS و تنظیم کرون جاب برای ارسال هشدار قیمت تلگرام را خلاصه بگو' }
  ] : [
    { text: 'Analyze Bitcoin', q: 'Can you analyze the current Bitcoin trend for me?' },
    { text: 'How to deploy bot?', q: 'Briefly explain how to deploy the Telegram price bot on a VPS' },
    { text: 'Toman & Gold Outlook', q: 'What is the technical sentiment for Gold and USD Toman rate?' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          chatHistory: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text
          }))
        })
      });

      const data = await response.json();
      if (response.ok) {
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          text: data.text || 'من پاسخی دریافت نکردم.',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Failed to generate response');
      }
    } catch (err: any) {
      console.error(err);
      // Prefer server-provided error (e.g. geo restriction friendly msg) over generic key hint
      const serverErr = err?.message || (typeof err === "string" ? err : "");
      const useServer = serverErr && !serverErr.toLowerCase().includes("failed to generate");
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: useServer ? serverErr : (isFa 
          ? 'متأسفانه مشکلی در ارتباط با سرور هوش مصنوعی پیش آمد. لطفاً از فعال بودن کلید GEMINI_API_KEY در بخش تنظیمات مطمئن شوید.' 
          : 'Sorry, there was a problem connecting to the AI agent. Please make sure your GEMINI_API_KEY is configured in the secrets menu.'),
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="ai-chat" className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col h-[600px] overflow-hidden relative">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="border-b border-slate-800/70 pb-4 mb-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/10">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-1.5">
              {isFa ? 'دستیار هوش مصنوعی NovaX' : 'NovaX AI Financial Analyst'}
              <span className="text-[10px] bg-slate-800 text-teal-400 font-mono px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <Cpu size={10} />
                GEMINI 2.5
              </span>
            </h3>
            <p className="text-zinc-400 text-xs mt-0.5">
              {isFa ? 'پشتیبان آنلاین تحلیل تکنیکال و فاندامنتال بازار' : 'Real-time contextual market advisor'}
            </p>
          </div>
        </div>

        <div className="flex gap-1 items-center font-mono text-[10px] text-zinc-500 bg-slate-950/40 border border-slate-800/60 px-2.5 py-1 rounded-full">
          <Sparkles size={11} className="text-teal-400 animate-pulse" />
          {isFa ? 'قیمت‌های واقعی همگام‌شده' : 'Real Prices Grounded'}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1 custom-scrollbar relative z-10">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow ${
                isUser ? 'bg-indigo-600 border border-indigo-500/30' : 'bg-slate-800 border border-slate-700/50'
              }`}>
                {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-teal-400" />}
              </div>

              {/* Msg Content */}
              <div className={`p-3.5 rounded-2xl text-sm ${
                isUser 
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-md' 
                  : 'bg-slate-950/60 border border-slate-900 text-zinc-100 rounded-tl-none leading-relaxed'
              }`}>
                <div className="whitespace-pre-line text-sm select-text selection:bg-teal-500/30">
                  {msg.text}
                </div>
                <div className={`text-[9px] mt-2 font-mono text-right ${isUser ? 'text-indigo-200' : 'text-zinc-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-[85%] mr-auto items-center">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-teal-400" />
            </div>
            <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-2xl rounded-tl-none text-sm text-zinc-400">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-200" />
                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce delay-300" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-4 relative z-10 px-1">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.q)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-750 text-indigo-300 transition-all transform hover:scale-[1.01] cursor-pointer"
            >
              🚀 {p.text}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <div className="relative mt-auto z-10">
        <input
          id="chat-input"
          type="text"
          placeholder={isFa ? 'سؤالی در مورد بازار یا ربات بپرسید...' : 'Ask your financial/technical market question...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage(inputText);
          }}
          disabled={isLoading}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3.5 text-white focus:outline-none focus:border-teal-500/50 text-sm disabled:opacity-50"
        />
        <button
          id="btn-chat-send"
          onClick={() => handleSendMessage(inputText)}
          disabled={isLoading || !inputText.trim()}
          className="absolute right-2.5 top-1/2 transform -translate-y-1/2 w-9 h-9 rounded-lg bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 flex items-center justify-center text-white cursor-pointer disabled:opacity-40 transition-all font-semibold"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
