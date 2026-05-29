import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Loader } from 'lucide-react';

const ChatbotWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'Hello! I am the Grievance Portal AI Assistant. How can I help you today?',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    setInput('');
    setIsLoading(true);
    setError('');

    // Add user message to chat immediately
    const userMessage = {
      id: messages.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Log Frontend Send Time
    const frontendSendTime = Date.now();
    console.log(`⏱️ [FRONTEND] Chatbot send time: ${new Date(frontendSendTime).toISOString()}`);

    const cleanText = messageText.toLowerCase().trim();

    // 2. Add instant local replies without Gemini
    const greetingMatches = {
      'hi': 'Hi, how can I help you?',
      'hello': 'Hello, how can I help you?',
      'hey': 'Hi, I am listening.',
      'thank you': 'You are welcome.',
      'thanks': 'You are welcome.',
      'who are you': 'I am your Smart City voice assistant.',
      'help': 'You can ask me to report issues, check status, open map, or ask general questions.'
    };

    if (greetingMatches[cleanText]) {
      console.log('💬 Chatbot greeting matched locally');
      setTimeout(() => {
        const botMessage = {
          id: messages.length + 2,
          text: greetingMatches[cleanText],
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 200);
      return;
    }

    // 3. Navigation commands should be instant without Gemini
    const homeCmds = ['home', 'go home', 'go back home', 'main page', 'landing page'];
    const loginCmds = ['login', 'go to login', 'sign in', 'sign-in', 'open login'];
    const reportCmds = ['report issue', 'file complaint', 'new complaint', 'register issue', 'submit complaint', 'report civic'];
    const mapCmds = ['map', 'open map', 'show map', 'view map'];
    const dashboardCmds = ['my complaints', 'check my complaints', 'view complaints', 'check complaints', 'dashboard', 'status', 'check status', 'complaint status'];
    const trackCmds = ['track', 'track by id', 'track complaint', 'track status', 'tracking', 'complaint tracking'];

    if (homeCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: home');
      setTimeout(() => {
        navigate('/');
        const botMessage = {
          id: messages.length + 2,
          text: 'Going to the home page.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    if (loginCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: login');
      setTimeout(() => {
        navigate('/login');
        const botMessage = {
          id: messages.length + 2,
          text: 'Navigating to the login page.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    if (reportCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: report issue');
      setTimeout(() => {
        navigate('/submit-complaint');
        const botMessage = {
          id: messages.length + 2,
          text: 'Opening the complaint submission page.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    if (mapCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: map');
      setTimeout(() => {
        navigate('/submit-complaint');
        const botMessage = {
          id: messages.length + 2,
          text: 'Opening the complaint form with map view.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    if (dashboardCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: dashboard/status');
      setTimeout(() => {
        navigate('/dashboard');
        const botMessage = {
          id: messages.length + 2,
          text: 'Opening your dashboard to view your complaints.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    if (trackCmds.some(cmd => cleanText.includes(cmd))) {
      console.log('🗺️ Chatbot navigation matched locally: track');
      setTimeout(() => {
        navigate('/track');
        const botMessage = {
          id: messages.length + 2,
          text: 'Opening the complaint tracking page.',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
        setIsLoading(false);
      }, 250);
      return;
    }

    // 11. Add request timeout: 8 seconds limit using AbortController
    const abortController = new AbortController();
    let timeoutTimer = setTimeout(() => {
      abortController.abort();
      setIsLoading(false);
      setError('Response is taking longer than usual. Please try again.');
      
      const timeoutText = 'Response is taking longer than usual. Please try again.';
      const botMessage = {
        id: messages.length + 2,
        text: timeoutText,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
    }, 8000);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          userId: localStorage.getItem('userId') || 'anonymous',
        }),
        signal: abortController.signal
      });

      clearTimeout(timeoutTimer);

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Log Frontend Response Received Time
      const frontendRecTime = Date.now();
      console.log(`⏱️ [FRONTEND] Chatbot response received time: ${new Date(frontendRecTime).toISOString()}. Latency: ${frontendRecTime - frontendSendTime}ms`);

      // Add bot response to chat
      const botMessage = {
        id: messages.length + 2,
        text: data.reply || data.answer || (data.data && data.data.assistantResponse) || 'Sorry, no response text returned.',
        sender: 'bot',
        timestamp: new Date(data.data?.timestamp || new Date()),
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('⏱️ Chatbot Gemini request aborted due to 8s timeout.');
        return;
      }

      clearTimeout(timeoutTimer);
      setError('Failed to get response. Please try again.');
      console.error('Chat error:', err);

      const errorMessage = {
        id: messages.length + 2,
        text: 'Sorry, I encountered an error communicating with my AI brain. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-96 h-96 flex flex-col border border-slate-200 dark:border-slate-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex justify-between items-center rounded-t-lg">
            <div>
              <h3 className="font-bold text-lg">AI Grievance Assistant</h3>
              <p className="text-xs opacity-90">Powered by Gemini</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-blue-800 rounded transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-lg rounded-bl-none flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader size={14} className="animate-spin text-blue-600 animate-duration-1000" />
                  <span className="italic font-semibold">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-800">
            {error && (
              <div className="text-red-600 dark:text-red-400 text-xs mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your question..."
                className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded px-3 py-2 transition flex items-center gap-2"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition transform hover:scale-110"
          title="Open Chatbot"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ChatbotWidget;
