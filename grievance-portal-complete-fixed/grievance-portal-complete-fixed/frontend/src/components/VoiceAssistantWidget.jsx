import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, Sparkles, X, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSupported = !!SpeechRecognition;

export default function VoiceAssistantWidget() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  const [isEnabled, setIsEnabled] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  // Status: 'disabled' | 'permission_prompt' | 'tap_to_activate' | 'listening_wake' | 'active_listening' | 'speaking' | 'error'
  const [status, setStatus] = useState('disabled');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [heardText, setHeardText] = useState('');
  
  // Dialogue history popup display
  const [dialogue, setDialogue] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your AI Voice Assistant. Say "Hey City" to start talking, or click enable!',
      timestamp: new Date()
    }
  ]);

  const recognitionRef = useRef(null);
  const statusRef = useRef(status);
  const isSpeakingRef = useRef(false);
  
  // Timer Refs for Silence detection and Max Listening limits
  const silenceTimeoutRef = useRef(null);
  const maxListeningTimeoutRef = useRef(null);
  const capturedTextRef = useRef('');
  const isProcessingRef = useRef(false);
  const isEnabledRef = useRef(false);

  const chatEndRef = useRef(null);

  // Keep state ref in sync for event listeners
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // Scroll popup chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogue]);

  // Load permission from localStorage on mount and autostart if previously enabled
  useEffect(() => {
    const savedEnabled = localStorage.getItem('voiceAssistantEnabled') === 'true';
    if (savedEnabled && isSupported) {
      const t = setTimeout(() => {
        autoStartVoiceAssistant();
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  const autoStartVoiceAssistant = async () => {
    setErrorMsg('');
    try {
      setIsEnabled(true);
      if (!recognitionRef.current) {
        initSpeechRecognition();
      }
      
      // Try starting speech recognition directly
      recognitionRef.current.start();
      setStatus('listening_wake');
      console.log('🎙️ Auto-started Speech Recognition successfully from localStorage!');
    } catch (err) {
      console.warn('⚠️ Auto-start blocked by browser or permission not verified:', err);
      setStatus('tap_to_activate');
    }
  };

  // Clean up synthesis and timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const clearAllTimers = () => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (maxListeningTimeoutRef.current) clearTimeout(maxListeningTimeoutRef.current);
  };

  // Text-To-Speech helper
  const speak = (text, onEndCallback) => {
    if ('speechSynthesis' in window) {
      isSpeakingRef.current = true;
      setStatus('speaking');
      
      // Temporarily pause recognition during speech synthesis to prevent self-hearing feedback loops
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Error pausing recognition during speak:', e);
        }
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en-GB') || v.lang.includes('en-US'));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (onEndCallback) {
          onEndCallback();
        } else {
          setStatus('listening_wake');
          startListening();
        }
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setStatus('listening_wake');
        startListening();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Speech Synthesis not supported');
      if (onEndCallback) onEndCallback();
    }
  };

  // Start speech recognition
  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      console.log('🎙️ Speech recognition loop started...');
    } catch (e) {
      console.log('Recognition already active or starting:', e.message);
    }
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    if (!isSupported) return;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true; // Use interim results for real-time visual preview
    rec.lang = navigator.language || 'en-US';

    rec.onstart = () => {
      console.log('🎙️ Microphone active. Status:', statusRef.current);
      if (statusRef.current === 'permission_prompt' || statusRef.current === 'tap_to_activate') {
        setStatus('listening_wake');
      }
    };

    rec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          isFinal = true;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (!activeText.trim()) return;

      console.log('🎙️ transcript detected:', activeText);
      setHeardText(activeText);
      capturedTextRef.current = activeText;

      const currentStatus = statusRef.current;

      // Clear the silence timeout first
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

      if (currentStatus === 'listening_wake') {
        // Continuous wake words: hey city, hi city, city
        const wakeWords = ['hey city', 'hey, city', 'hay city', 'ok city', 'hello city', 'hi city', 'city'];
        const lowerText = activeText.toLowerCase().trim();
        const isWakeWordDetected = wakeWords.some(word => {
          if (word === 'city') {
            return lowerText === 'city' || lowerText.startsWith('city ');
          }
          return lowerText.includes(word);
        });

        if (isWakeWordDetected) {
          console.log('🎯 wake word detected!');
          
          // Check if there is an inline question spoken together after the wake word
          let inlinePrompt = '';
          for (const word of wakeWords) {
            if (lowerText.includes(word)) {
              inlinePrompt = activeText.substring(lowerText.indexOf(word) + word.length).trim();
              break;
            }
          }

          if (inlinePrompt) {
            if (isFinal) {
              console.log('⏱️ Wake word inline prompt final. Sending immediately...');
              triggerSilenceTimeout();
            } else {
              silenceTimeoutRef.current = setTimeout(() => {
                console.log('⏱️ Wake word inline prompt silence timeout triggered!');
                triggerSilenceTimeout();
              }, 700); // 700ms silence timeout
            }
          } else {
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch (e) {}
            }

            // Standalone wake word: prompt the user instantly
            speak('Yes, how can I help you?', () => {
              setStatus('active_listening');
              capturedTextRef.current = '';
              setHeardText('');
              startListening();

              // Add max listening time: listen maximum 4 seconds after wake word
              if (maxListeningTimeoutRef.current) clearTimeout(maxListeningTimeoutRef.current);
              maxListeningTimeoutRef.current = setTimeout(() => {
                console.log('⏱️ Max listening time (4s) reached. Forcing send...');
                triggerSilenceTimeout();
              }, 4000);
            });
          }
        } else {
          // DIRECT MODE: If assistant is active and user speaks any question directly
          if (isFinal) {
            console.log('⏱️ Direct mode final. Sending immediately...');
            triggerSilenceTimeout();
          } else {
            silenceTimeoutRef.current = setTimeout(() => {
              console.log('⏱️ Direct mode silence timeout triggered!');
              triggerSilenceTimeout();
            }, 700); // 700ms silence timeout
          }
        }
      } 
      // ACTIVE LISTENING / QUESTION CAPTURE (After wake word prompt)
      else if (currentStatus === 'active_listening') {
        if (isFinal) {
          console.log('⏱️ Active listening final. Sending immediately...');
          triggerSilenceTimeout();
        } else {
          silenceTimeoutRef.current = setTimeout(() => {
            console.log('⏱️ active listening silence timeout triggered!');
            triggerSilenceTimeout();
          }, 700); // 700ms silence timeout
        }
      }
    };

    rec.onend = () => {
      console.log('🎙️ Speech recognition ended. Checking if we should auto-restart...');
      if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        startListening();
      }
    };

    rec.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
      if (e.error === 'not-allowed') {
        setStatus('error');
        setErrorMsg('Microphone access denied. Please check your browser settings.');
        setIsEnabled(false);
        localStorage.setItem('voiceAssistantEnabled', 'false');
      } else if (e.error === 'no-speech') {
        console.log('Silently restarting recognition after no-speech error...');
        if (isEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          startListening();
        }
      }
    };

    recognitionRef.current = rec;
  };

  const triggerSilenceTimeout = () => {
    clearAllTimers();
    const finalInput = capturedTextRef.current.trim();
    
    if (!finalInput) {
      setStatus('listening_wake');
      startListening();
      return;
    }

    // 13. Call sendTranscriptToAI() automatically after silence timeout
    sendTranscriptToAI(finalInput);
  };

  // 13. sendTranscriptToAI() function
  const sendTranscriptToAI = async (transcript) => {
    // 14. Performance log: Speech end time
    const speechEndTime = Date.now();
    console.log(`⏱️ [PERF] Speech end time: ${new Date(speechEndTime).toLocaleTimeString()}.${speechEndTime % 1000}ms`);

    // 10. Prevent duplicate API calls
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // 17. Clear transcript after sending
    setHeardText('');
    capturedTextRef.current = '';

    // Add user message to dialogue box popup list
    setDialogue(prev => [...prev, { sender: 'user', text: transcript, timestamp: new Date() }]);

    const cleanText = transcript.toLowerCase().trim();

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
      console.log(`💬 Local greeting matched: "${cleanText}"`);
      const responseText = greetingMatches[cleanText];
      setDialogue(prev => [...prev, { sender: 'bot', text: responseText, timestamp: new Date() }]);
      speak(responseText, () => {
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
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
      speak('Going to home page.', () => {
        navigate('/');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    if (loginCmds.some(cmd => cleanText.includes(cmd))) {
      speak('Navigating to the login page.', () => {
        navigate('/login');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    if (reportCmds.some(cmd => cleanText.includes(cmd))) {
      speak('Opening the complaint submission page.', () => {
        navigate('/submit-complaint');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    if (mapCmds.some(cmd => cleanText.includes(cmd))) {
      speak('Opening the complaint form with map view.', () => {
        navigate('/submit-complaint');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    if (dashboardCmds.some(cmd => cleanText.includes(cmd))) {
      speak('Opening your dashboard to view your complaints.', () => {
        navigate('/dashboard');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    if (trackCmds.some(cmd => cleanText.includes(cmd))) {
      speak('Opening the complaint tracking page.', () => {
        navigate('/track');
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
      return;
    }

    // 4. Call Gemini only for real questions
    setIsThinking(true);

    // 8. Add immediate speaking feedback: Speak "One moment." immediately in the background
    speak("One moment.", () => {
      // Keeps thinking status active in UI without starting to listen again
    });

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    // 11. Add request timeout: 8 seconds limit using AbortController
    const abortController = new AbortController();
    let timeoutTimer = setTimeout(() => {
      abortController.abort();
      isProcessingRef.current = false;
      setIsThinking(false);
      setStatus('listening_wake');
      const timeoutText = 'Response is taking longer than usual. Please try again.';
      setDialogue(prev => [...prev, { sender: 'bot', text: timeoutText, timestamp: new Date() }]);
      speak(timeoutText, () => {
        startListening();
      });
    }, 8000);

    // Strip any residual wake words from the question text
    let cleanQuestion = transcript;
    const wakeWords = ['hey city', 'hey, city', 'hay city', 'ok city', 'hello city', 'hi city', 'city'];
    for (const word of wakeWords) {
      if (cleanQuestion.toLowerCase().includes(word)) {
        const index = cleanQuestion.toLowerCase().indexOf(word);
        cleanQuestion = cleanQuestion.substring(index + word.length);
      }
    }
    cleanQuestion = cleanQuestion.trim() || transcript;

    // 14. Performance log: API request start time
    const apiRequestStart = Date.now();
    console.log(`⏱️ [PERF] API request start: ${new Date(apiRequestStart).toLocaleTimeString()}.${apiRequestStart % 1000}ms`);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanQuestion
        }),
        signal: abortController.signal
      });

      clearTimeout(timeoutTimer);
      setIsThinking(false);

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const data = await response.json();

      // 14. Performance logs: Gemini response time & Total response time
      const apiResponseRec = Date.now();
      const geminiResponseTime = apiResponseRec - apiRequestStart;
      const totalResponseTime = apiResponseRec - speechEndTime;
      console.log(`⏱️ [PERF] Gemini response time: ${geminiResponseTime}ms`);
      console.log(`⏱️ [PERF] Total response time: ${totalResponseTime}ms`);

      // 13. Frontend must read data.reply or data.answer
      const aiReply = data.reply || data.answer || 'Sorry, no response text returned.';

      // Show response in chat box
      setDialogue(prev => [...prev, { sender: 'bot', text: aiReply, timestamp: new Date() }]);

      // 9. Start text-to-speech immediately after response comes
      speak(aiReply, () => {
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });

    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('⏱️ Gemini request aborted due to 8s timeout.');
        return; // Timeout already handled by setTimeout callback
      }
      
      clearTimeout(timeoutTimer);
      setIsThinking(false);
      console.error('Gemini voice assistant error:', err);
      const errMsg = 'Sorry, I encountered an error communicating with my AI brain. Please try again.';
      
      setDialogue(prev => [...prev, { sender: 'bot', text: errMsg, timestamp: new Date() }]);
      speak(errMsg, () => {
        isProcessingRef.current = false;
        setStatus('listening_wake');
        startListening();
      });
    }
  };

  // One-time enable / toggle permissions FAB
  const handleEnableToggle = async () => {
    if (isEnabled) {
      setIsEnabled(false);
      setStatus('disabled');
      localStorage.setItem('voiceAssistantEnabled', 'false');
      clearAllTimers();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    setErrorMsg('');
    setStatus('permission_prompt');

    try {
      // Explicitly request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsEnabled(true);
      localStorage.setItem('voiceAssistantEnabled', 'true');
      
      if (!recognitionRef.current) {
        initSpeechRecognition();
      }

      speak('Conversational Voice Assistant active. Ask me anything, or say Hey City to start!', () => {
        setStatus('listening_wake');
        startListening();
      });
    } catch (err) {
      console.error('Microphone access error:', err);
      setStatus('error');
      setErrorMsg('Microphone access denied or not found. Please enable permission.');
      setIsEnabled(false);
      localStorage.setItem('voiceAssistantEnabled', 'false');
    }
  };

  // Browser security gesture bypass
  const handleTapToActivate = async () => {
    setErrorMsg('');
    setStatus('permission_prompt');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsEnabled(true);
      localStorage.setItem('voiceAssistantEnabled', 'true');
      
      if (!recognitionRef.current) {
        initSpeechRecognition();
      }

      speak('Conversational Voice Assistant active. Ask me anything, or say Hey City to start!', () => {
        setStatus('listening_wake');
        startListening();
      });
    } catch (err) {
      console.error('Microphone activation failed:', err);
      setStatus('error');
      setErrorMsg('Microphone access denied or not found. Please enable permission.');
      setIsEnabled(false);
      localStorage.setItem('voiceAssistantEnabled', 'false');
    }
  };

  // Get current status styles
  const getStatusDetails = () => {
    switch (status) {
      case 'disabled':
        return {
          label: 'Voice Assistant Disabled',
          color: 'bg-slate-400 dark:bg-slate-600',
          pulse: '',
          icon: MicOff,
        };
      case 'permission_prompt':
        return {
          label: 'Requesting Mic Permission...',
          color: 'bg-indigo-500',
          pulse: 'animate-pulse',
          icon: Mic,
        };
      case 'tap_to_activate':
        return {
          label: 'Tap to Activate Voice',
          color: 'bg-indigo-600 dark:bg-indigo-500',
          pulse: 'ring-4 ring-indigo-400/50 animate-pulse',
          icon: Mic,
        };
      case 'listening_wake':
        return {
          label: "Active: Say 'Hey City'",
          color: 'bg-blue-600 dark:bg-blue-500',
          pulse: 'ring-4 ring-blue-400/30 animate-pulse',
          icon: Mic,
        };
      case 'active_listening':
        return {
          label: 'Listening for command...',
          color: 'bg-amber-500',
          pulse: 'ring-4 ring-amber-400/50 animate-bounce',
          icon: Mic,
        };
      case 'speaking':
        return {
          label: 'Speaking...',
          color: 'bg-emerald-500',
          pulse: 'ring-4 ring-emerald-400/40 animate-pulse',
          icon: Volume2,
        };
      case 'error':
        return {
          label: 'Error Status',
          color: 'bg-rose-600',
          pulse: '',
          icon: AlertCircle,
        };
      default:
        return {
          label: 'Standby',
          color: 'bg-slate-400',
          pulse: '',
          icon: Mic,
        };
    }
  };

  const activeDetails = getStatusDetails();
  const ActiveIcon = activeDetails.icon;

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-3">
      <AnimatePresence>
        {/* Dialogue / Help Sidebar expanded */}
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            className="absolute bottom-16 left-0 w-80 h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 text-slate-800 dark:text-slate-100 flex flex-col gap-3 font-sans backdrop-blur-md bg-opacity-95 dark:bg-opacity-95"
            aria-live="polite"
          >
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold flex items-center gap-2 text-brand-600 dark:text-brand-400 font-display text-sm">
                <Sparkles size={16} /> Conversational Assistant
              </span>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                aria-label="Close Voice Assistant panel"
              >
                <X size={14} />
              </button>
            </div>

            {/* Error alerts */}
            {errorMsg && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl flex gap-2 items-start text-xs border border-rose-100 dark:border-rose-900/50">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Unsupported Browser Alert */}
            {!isSupported && (
              <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl flex gap-2 items-start text-xs border border-amber-100 dark:border-amber-900/30">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  Speech recognition not supported in this browser. Please try <strong>Google Chrome</strong>.
                </span>
              </div>
            )}

            {/* Conversational dialogue display */}
            <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
              {dialogue.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-tl-none'
                  }`}>
                    <p className="leading-relaxed">{msg.text}</p>
                    <span className="text-[9px] block text-right mt-1 opacity-70">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* 9. Thinking loader */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-tl-none px-3 py-2 text-xs flex items-center gap-2 shadow-sm">
                    <Loader2 size={12} className="animate-spin text-purple-600" />
                    <span className="font-semibold italic">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 16. Live transcript display */}
            {isEnabled && heardText && (
              <div className="px-2 py-1 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 italic">
                <span className="font-semibold block text-[8px] text-slate-400 uppercase tracking-wider">Hearing:</span>
                "{heardText}"
              </div>
            )}

            {/* Quick Guidance Tag */}
            {isSupported && isEnabled && (
              <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 font-sans">
                <HelpCircle size={10} />
                <span>Say <strong>"Hey City, [your question]"</strong></span>
              </div>
            )}

            {/* Action Enable Toggle */}
            {isSupported && (
              <button
                onClick={handleEnableToggle}
                className={`w-full py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs shadow-md ${
                  isEnabled
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white'
                    : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-lg'
                }`}
                aria-label={isEnabled ? 'Disable Voice Assistant' : 'Enable Voice Assistant'}
              >
                {isEnabled ? <MicOff size={14} /> : <Mic size={14} />}
                {isEnabled ? 'Disable Voice Assistant' : 'Enable Voice Assistant'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Browser security autoplay/interaction bypass floating prompt */}
        {status === 'tap_to_activate' && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-16 left-0 bg-slate-900 text-white font-semibold text-[11px] py-2 px-3.5 rounded-xl shadow-2xl flex flex-col gap-1 border border-slate-800 min-w-[240px] font-sans"
          >
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Sparkles size={12} className="animate-pulse" /> Voice Standby Ready
            </span>
            <span className="opacity-90 leading-relaxed text-[10px]">
              For security, browser requires one tap to activate microphone.
            </span>
            <button
              onClick={handleTapToActivate}
              className="mt-1.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition duration-200"
            >
              Tap to Activate Voice
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Status Indicator Button */}
      <div className="relative flex items-center">
        {/* Hover / Status Banner */}
        <span className="absolute left-14 bg-slate-800/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow pointer-events-none md:block hidden font-sans">
          {activeDetails.label}
        </span>

        {/* Floating Indicator FAB */}
        <button
          onClick={() => setShowHelp(prev => !prev)}
          className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg transition-all duration-300 transform hover:scale-105 ${activeDetails.color} ${activeDetails.pulse}`}
          aria-haspopup="true"
          aria-expanded={showHelp}
          aria-label={`Conversational Voice Assistant. Status: ${activeDetails.label}`}
        >
          {status === 'speaking' ? (
            <ActiveIcon size={20} className="animate-pulse" />
          ) : (
            <ActiveIcon size={20} className="transition-transform duration-300" />
          )}
          
          {/* Sparkle badge when enabled */}
          {isEnabled && (
            <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full p-0.5 shadow-md">
              <Sparkles size={8} className="text-white" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
