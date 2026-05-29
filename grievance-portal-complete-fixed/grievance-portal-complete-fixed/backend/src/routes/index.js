const express = require('express');
const router = express.Router();

// Import controllers
const { register, login, getProfile, updateProfile, changePassword, refreshToken, getNotifications, markNotificationRead } = require('../controllers/authController');
const { markAllNotificationsRead } = require('../controllers/notificationController');
const { submitComplaint, trackComplaint, getMyComplaints, getComplaintDetail, getAssignedComplaints, updateComplaintStatus, getAnalytics } = require('../controllers/complaintController');
const { getAllUsers, createAuthority, getAllComplaints, reassignComplaint, toggleUserStatus, getAllAuthorities, getFullAnalytics } = require('../controllers/adminController');
const { sendChatMessage, getChatHistory, clearChatHistory, getSuggestionForComplaint, getChatbotStatus } = require('../controllers/chatbotController');

// Import middleware
const { verifyToken, authorize, optionalAuth, ROLES } = require('../middleware/auth');
const { registerValidator, loginValidator, complaintValidator, statusUpdateValidator } = require('../middleware/validate');
const { upload } = require('../config/cloudinary');

// ============= AUTH ROUTES =============
const authRouter = express.Router();
authRouter.post('/register', registerValidator, register);
authRouter.post('/login', loginValidator, login);
authRouter.post('/refresh', refreshToken);
authRouter.get('/profile', verifyToken, getProfile);
authRouter.put('/profile', verifyToken, updateProfile);
authRouter.put('/change-password', verifyToken, changePassword);
authRouter.get('/notifications', verifyToken, getNotifications);
authRouter.put('/notifications/read-all', verifyToken, markAllNotificationsRead);
authRouter.put('/notifications/:id/read', verifyToken, markNotificationRead);

// ============= COMPLAINT ROUTES =============
const complaintRouter = express.Router();

// Public tracking
complaintRouter.get('/track/:complaintId', trackComplaint);

// Submit complaint (optional auth for anonymous)
complaintRouter.post('/', optionalAuth, upload.array('attachments', 5), complaintValidator, submitComplaint);

// Citizen routes
complaintRouter.get('/my', verifyToken, authorize(ROLES.CITIZEN), getMyComplaints);
complaintRouter.get('/:id', verifyToken, getComplaintDetail);

// Authority routes
complaintRouter.get('/authority/assigned', verifyToken, authorize(ROLES.PS_OFFICER, ROLES.ACB_OFFICER, ROLES.MUNICIPAL_OFFICER, ROLES.SUPER_ADMIN), getAssignedComplaints);
complaintRouter.put('/:id/status', verifyToken, authorize(ROLES.PS_OFFICER, ROLES.ACB_OFFICER, ROLES.MUNICIPAL_OFFICER, ROLES.SUPER_ADMIN), upload.array('proofs', 3), statusUpdateValidator, updateComplaintStatus);

// Admin analytics
complaintRouter.get('/admin/analytics', verifyToken, authorize(ROLES.SUPER_ADMIN), getAnalytics);

// ============= ADMIN ROUTES =============
const adminRouter = express.Router();
adminRouter.use(verifyToken, authorize(ROLES.SUPER_ADMIN));

adminRouter.get('/users', getAllUsers);
adminRouter.post('/authorities', createAuthority);
adminRouter.put('/users/:id/toggle', toggleUserStatus);
adminRouter.get('/complaints', getAllComplaints);
adminRouter.put('/complaints/:id/reassign', reassignComplaint);
adminRouter.get('/authorities', getAllAuthorities);
adminRouter.get('/analytics', getFullAnalytics);

// Escalation endpoints
const { escalationHandler } = require('../controllers/escalationController');
adminRouter.get('/escalations/stats', escalationHandler);
adminRouter.post('/escalations/manual', escalationHandler);

// ============= CHATBOT ROUTES =============
const chatbotRouter = express.Router();

// Chatbot endpoints (public and authenticated)
chatbotRouter.get('/status', getChatbotStatus);
chatbotRouter.post('/message', sendChatMessage);
chatbotRouter.get('/history', getChatHistory);
chatbotRouter.delete('/history', clearChatHistory);
chatbotRouter.post('/suggest', getSuggestionForComplaint);

// ============= MOUNT ROUTES =============
router.use('/auth', authRouter);
router.use('/complaints', complaintRouter);
router.use('/admin', adminRouter);
router.use('/chatbot', chatbotRouter);

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Grievance Portal API is running.', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// GET /api/test
router.get('/test', (req, res) => {
  res.json({ message: "Backend working" });
});

// Import sendMessage from geminiChatService
const { sendMessage } = require('../services/geminiChatService');

// POST /api/voice-ai
router.post('/voice-ai', async (req, res) => {
  const receiveTime = Date.now();
  console.log(`⏱️ [BACKEND] voice-ai request received at: ${new Date(receiveTime).toISOString()}`);
  
  try {
    // 4. Accept both message and question
    const userMessage = req.body.message || req.body.question;
    console.log(`⏱️ [BACKEND] Received message: "${userMessage}"`);

    // 2. If message is empty
    if (!userMessage || userMessage.trim().length === 0) {
      console.log('⏱️ [BACKEND] Empty message received');
      return res.status(200).json({ reply: "Please say something." });
    }

    const cleanText = userMessage.toLowerCase().trim();

    // 1. Instant greetings
    if (cleanText === 'hi' || cleanText === 'hello' || cleanText === 'hey') {
      console.log(`⏱️ [BACKEND] Instant greeting matched locally: ${cleanText}`);
      return res.status(200).json({ reply: "Hi 👋 How can I help you with city issues today?" });
    }

    if (cleanText === 'how are you') {
      console.log(`⏱️ [BACKEND] Instant how are you matched: ${cleanText}`);
      return res.status(200).json({ reply: "I am doing great! How can I help you today?" });
    }

    if (cleanText === 'thank you' || cleanText === 'thanks') {
      console.log(`⏱️ [BACKEND] Instant greeting matched locally: ${cleanText}`);
      return res.status(200).json({ reply: "You are welcome! Let me know if you need anything else." });
    }

    if (cleanText === 'ok') {
      console.log(`⏱️ [BACKEND] Instant ok matched: ${cleanText}`);
      return res.status(200).json({ reply: "Great! Let me know if you have any questions." });
    }

    // 3. Call Gemini
    console.log(`⏱️ [BACKEND] Calling Gemini AI for message: "${userMessage}"`);
    const replyText = await sendMessage(userMessage, 'anonymous', 'voice');
    console.log(`⏱️ [BACKEND] Gemini AI response received: "${replyText}"`);

    // 14. Return proper JSON response in every case
    return res.status(200).json({ reply: replyText });
  } catch (error) {
    // 8. Add console.log for Gemini errors
    console.error('⏱️ [BACKEND] Gemini error:', error);
    return res.status(500).json({ reply: "Sorry, I encountered an error communicating with my AI brain. Please try again." });
  }
});

// POST /api/chat
router.post('/chat', async (req, res) => {
  const receiveTime = Date.now();
  console.log(`⏱️ [BACKEND] Chatbot request received at: ${new Date(receiveTime).toISOString()}`);
  
  try {
    const userMessage = req.body.message || req.body.question;
    console.log(`⏱️ [BACKEND] Received chat message: "${userMessage}"`);

    if (!userMessage || userMessage.trim().length === 0) {
      return res.status(200).json({ reply: "Please type something." });
    }

    const cleanText = userMessage.toLowerCase().trim();

    // 2. Add fast basic replies without API
    if (cleanText === 'hi' || cleanText === 'hello' || cleanText === 'hey') {
      console.log('💬 Chatbot greeting matched instantly on backend');
      return res.status(200).json({ reply: "Hi 👋 How can I help you with city issues today?" });
    }

    if (cleanText === 'how are you') {
      console.log('💬 Chatbot how are you matched instantly on backend');
      return res.status(200).json({ reply: "I am doing great! How can I help you today?" });
    }

    if (cleanText === 'thank you' || cleanText === 'thanks') {
      console.log('💬 Chatbot thanks matched instantly on backend');
      return res.status(200).json({ reply: "You are welcome! Let me know if you need anything else." });
    }

    if (cleanText === 'ok') {
      console.log('💬 Chatbot ok matched instantly on backend');
      return res.status(200).json({ reply: "Great! Let me know if you have any questions." });
    }

    // Call Gemini with caching, fallbacks, and smart city guidelines
    console.log(`⏱️ [BACKEND] Calling Gemini AI for chat: "${userMessage}"`);
    const replyText = await sendMessage(userMessage, 'anonymous', 'chat');
    console.log(`⏱️ [BACKEND] Gemini AI chat response received: "${replyText}"`);

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('⏱️ [BACKEND] Chat error:', error);
    return res.status(500).json({ reply: "Sorry, I encountered an error communicating with my AI brain. Please try again." });
  }
});

module.exports = router;
