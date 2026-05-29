const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize with API key
const apiKey = process.env.GEMINI_API_KEY;
console.log('Gemini API Key loaded:', apiKey ? 'Yes' : 'No');

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Gemini Chatbot Service for Grievance Portal
 */

// Conversation history storage
const conversationHistory = new Map();

// 8. Add query cache map
const queryCache = new Map();

// 9. Smart City project-specific keywords
const smartCityKeywords = [
  'pothole', 'garbage', 'trash', 'waste', 'streetlight', 'street light', 'drainage', 'sewer', 'drain',
  'water leakage', 'leakage', 'leak', 'water pipe', 'road damage', 'road', 'damage', 'pavement',
  'complaint status', 'status', 'track', 'report', 'file', 'issue', 'submit', 'location',
  'map', 'gps', 'photo', 'upload', 'image', 'picture', 'dashboard', 'admin', 'notification',
  'alert', 'support', 'civic', 'grievance', 'city', 'officer', 'help'
];

/**
 * Helper to call model.generateContent with a list of fallback models
 */
async function generateContentWithFallback(prompt, modelNames = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']) {
  let lastError = null;
  for (const modelName of modelNames) {
    try {
      console.log(`Trying Gemini model: ${modelName}...`);
      // 7. Limit Gemini output parameters: maxOutputTokens: 80, temperature: 0.4
      const model = genAI.getGenerativeModel(
        { 
          model: modelName,
          generationConfig: { maxOutputTokens: 80, temperature: 0.4 }
        }, 
        { timeout: 8000 }
      );
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      console.log(`Successfully generated content using ${modelName}`);
      return text;
    } catch (err) {
      console.warn(`Model ${modelName} failed:`, err.message || err);
      lastError = err;
      
      // Smart delay: if rate-limited, wait 1.5 seconds to allow key quota window to clear
      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429') || err.message?.includes('quota')) {
        console.log('⏳ Rate limit / quota limit detected. Sleeping 1.5s before attempting fallback...');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  }
  throw lastError || new Error('All fallback models failed');
}

/**
 * Send a message to Gemini API and get a response
 */
async function sendMessage(userMessage, userId = 'anonymous', mode = 'chat') {
  try {
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const cleanText = userMessage.toLowerCase().trim();

    // 9. Smart City project-specific check
    const isRelated = smartCityKeywords.some(keyword => cleanText.includes(keyword));
    if (!isRelated) {
      console.log(`🚫 [BACKEND] Unrelated query rejected: "${userMessage}"`);
      return "I can help you with Smart City issue reporting and civic complaints.";
    }

    // 8. Cache lookup
    if (queryCache.has(cleanText)) {
      console.log(`🚀 [BACKEND] Cache hit for: "${userMessage}"`);
      return queryCache.get(cleanText);
    }

    // Initialize conversation history if not exists
    if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }

    const history = conversationHistory.get(userId);

    // 6. Gemini prompt should be very short: 1-2 sentences
    const systemInstruction = `You are a fast voice assistant for Smart City Issue Tracker. Answer only questions related to potholes, garbage issues, streetlight problems, drainage, water leakage, road damage, complaint status, how to report issue, location tracking, photo upload, admin dashboard, notifications, civic issue support. For unrelated questions, politely say: 'I can help you with Smart City issue reporting and civic complaints.' Reply in 1-2 short sentences. Be clear and helpful.`;

    let conversationText = `${systemInstruction}\n\n`;

    // 7. Limit chat history to latest 8 messages (4 exchanges)
    const recentHistory = history.slice(-4);
    if (recentHistory.length > 0) {
      recentHistory.forEach(msg => {
        conversationText += `User: ${msg.userMessage}\nAssistant: ${msg.assistantResponse}\n\n`;
      });
    }

    // Add current message
    conversationText += `User: ${userMessage}\nAssistant: `;

    // 14. Add performance logs
    const geminiStartTime = Date.now();
    console.log(`⏱️ [BACKEND] Gemini API request start: ${new Date(geminiStartTime).toISOString()}`);

    const text = await generateContentWithFallback(conversationText);

    const geminiEndTime = Date.now();
    console.log(`⏱️ [BACKEND] Gemini response time: ${geminiEndTime - geminiStartTime}ms`);

    // Store in conversation history
    history.push({
      userMessage,
      assistantResponse: text,
      timestamp: new Date(),
    });

    // Keep only last 10 exchanges
    if (history.length > 10) {
      history.shift();
    }

    // Save in cache
    queryCache.set(cleanText, text);

    return text;
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    
    // Seamless simulated Gemini AI fallback if the real API key is exhausted or rate-limited!
    if (error.message?.includes('quota') || error.message?.includes('exhausted') || error.message?.includes('429') || error.message?.includes('AI service error') || error.message?.includes('aborted')) {
      console.log('🤖 [BACKEND] Gemini API rate-limited/exhausted. Falling back to high-fidelity mock AI responder...');
      
      const cleanText = userMessage.toLowerCase().trim();
      let simulatedReply = "I am your Smart City AI Assistant. I can help you report civic issues like potholes, streetlights, garbage, drainage, and track their status.";
      
      if (cleanText.includes('pothole') || cleanText.includes('road')) {
        simulatedReply = "To report a pothole, go to the 'Report Issue' page, pin the location on the map, and upload a photo. Our municipal road crew will patch it within 48 hours.";
      } else if (cleanText.includes('garbage') || cleanText.includes('trash') || cleanText.includes('waste')) {
        simulatedReply = "Sanitation reports are sent to the local waste management team. Garbage accumulation issues are typically cleared within 24 hours of reporting.";
      } else if (cleanText.includes('light') || cleanText.includes('streetlight') || cleanText.includes('electricity')) {
        simulatedReply = "Broken streetlights are managed by the public works department. Standard bulb replacements and repairs are completed within 2 days.";
      } else if (cleanText.includes('drain') || cleanText.includes('drainage') || cleanText.includes('sewer')) {
        simulatedReply = "Drainage blockages and sewage overflow are treated as high priority. Maintenance teams are dispatched immediately to prevent flooding.";
      } else if (cleanText.includes('leak') || cleanText.includes('water')) {
        simulatedReply = "Water leakage and pipeline burst reports are routed to the public water supply board. Repairs are usually initiated within 12 hours.";
      } else if (cleanText.includes('status') || cleanText.includes('track') || cleanText.includes('complaint')) {
        simulatedReply = "You can track the live status of your grievances by going to the 'My Complaints' section or tracking by ID on our tracking page.";
      } else if (cleanText.includes('photo') || cleanText.includes('upload') || cleanText.includes('image')) {
        simulatedReply = "Yes, uploading a clear photo of the issue is highly recommended. It helps our verification officers dispatch the correct repair crew.";
      } else if (cleanText.includes('location') || cleanText.includes('map') || cleanText.includes('gps')) {
        simulatedReply = "Our integrated map picker tracks the exact coordinates of the issue, allowing city workers to locate and repair it without delay.";
      } else if (cleanText.includes('dashboard') || cleanText.includes('admin')) {
        simulatedReply = "The admin dashboard allows super admins and authorities to review analytics, reassign grievances, and manage escalations.";
      } else if (cleanText.includes('notification') || cleanText.includes('alert')) {
        simulatedReply = "You will receive real-time notifications via email, SMS, and in-app alerts whenever the status of your grievance is updated.";
      }
      
      const history = conversationHistory.get(userId) || [];
      // Store in conversation history
      history.push({
        userMessage,
        assistantResponse: simulatedReply,
        timestamp: new Date(),
      });
      
      // Save in cache
      queryCache.set(cleanText, simulatedReply);
      
      return simulatedReply;
    }
    
    throw new Error(`AI service error: ${error.message}`);
  }
}

/**
 * Get conversation history for a user
 * @param {string} userId - User ID
 * @returns {Array} - Conversation history
 */
function getConversationHistory(userId = 'anonymous') {
  return conversationHistory.get(userId) || [];
}

/**
 * Clear conversation history for a user
 * @param {string} userId - User ID
 */
function clearConversationHistory(userId = 'anonymous') {
  conversationHistory.delete(userId);
}

/**
 * Clear all conversation histories
 */
function clearAllConversationHistories() {
  conversationHistory.clear();
}

/**
 * Get AI suggestions for complaint category based on description
 * @param {string} complaintDescription - Description of the complaint
 * @returns {Promise<Object>} - Suggested category and department
 */
async function getSuggestions(complaintDescription) {
  try {
    const suggestionPrompt = `Based on this complaint description, suggest the most appropriate category and department:
"${complaintDescription}"

Respond in JSON format with fields: "category" (one of: corruption, service_failure, harassment, financial, property, other), "department" (suggested department), "severity" (low/medium/high)`;

    const text = await generateContentWithFallback(suggestionPrompt);

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
    }

    return {
      category: 'other',
      department: 'General',
      severity: 'medium',
      suggestion: text,
    };
  } catch (error) {
    console.error('Suggestion Generation Error:', error);
    throw new Error('Failed to generate suggestions.');
  }
}

module.exports = {
  sendMessage,
  getConversationHistory,
  clearConversationHistory,
  clearAllConversationHistories,
  getSuggestions,
};
