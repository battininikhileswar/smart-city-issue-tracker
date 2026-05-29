const { getDb, COLLECTIONS, serverTimestamp, increment, updateDoc } = require('../config/firebase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateComplaintId } = require('../utils/generateId');
const { routeComplaint } = require('../services/routingEngine');
const { notifyComplaintSubmitted, notifyStatusChange } = require('../utils/notifications');
const { uploadToCloudinary } = require('../config/cloudinary');

// ======= Submit Complaint =======
const submitComplaint = asyncHandler(async (req, res) => {
  const { category, subcategory, description, preferredLanguage } = req.body;
  const db = getDb();

  // Parse isAnonymous from string if needed (from FormData)
  const isAnonymous = req.body.isAnonymous === true || req.body.isAnonymous === 'true';

  // Enforce authentication for non-anonymous submissions
  if (!isAnonymous && !req.user) {
    throw new AppError('Authentication required for non-anonymous submissions.', 401);
  }

  // Parse location if it comes as JSON string (from FormData)
  let location;
  try {
    location = typeof req.body.location === 'string' 
      ? JSON.parse(req.body.location) 
      : req.body.location;
  } catch (e) {
    throw new AppError('Invalid location data format', 400);
  }

  // Route to appropriate authority
  const routing = await routeComplaint(category, subcategory, location);
  const complaintId = generateComplaintId(category, location.state);

  // Handle file uploads in parallel with a timeout
  const attachments = [];
  if (req.files && req.files.length > 0) {
    const uploadPromises = req.files.map(async (file) => {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timed out')), 15000)
        );

        const uploadPromise = uploadToCloudinary(file.buffer, {
          folder: `grievance-portal/complaints/${complaintId}`,
          resource_type: file.mimetype.startsWith('video') ? 'video' : 'image',
        });

        // Race between upload and timeout
        const result = await Promise.race([uploadPromise, timeoutPromise]);
        
        return {
          url: result.secure_url,
          publicId: result.public_id,
          type: file.mimetype,
          originalName: file.originalname,
          size: file.size,
        };
      } catch (err) {
        console.error(`❌ File upload failed for ${file.originalname}:`, err.message);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    results.forEach(res => {
      if (res) attachments.push(res);
    });
  }

  // Set escalation deadline (72 hours)
  const escalationDueDate = new Date();
  escalationDueDate.setHours(escalationDueDate.getHours() + 72);

  const complaintData = {
    complaintId,
    category,
    subcategory: subcategory || '',
    description,
    location: {
      address: location.address || '',
      state: location.state?.toLowerCase() || '',
      district: location.district?.toLowerCase() || '',
      pincode: location.pincode || '',
      lat: location.lat ? parseFloat(location.lat) : null,
      lng: location.lng ? parseFloat(location.lng) : null,
    },
    isAnonymous: !!isAnonymous,
    userId: isAnonymous ? null : req.user.id,
    userName: isAnonymous ? 'Anonymous' : req.user.name,
    userEmail: isAnonymous ? null : req.user.email,
    userPhone: isAnonymous ? null : req.user.phone,
    attachments,
    status: 'pending',
    routing: {
      authorityId: routing.authorityId,
      authorityType: routing.authorityType,
      authorityName: routing.authorityName,
      assignedAt: serverTimestamp(),
    },
    statusHistory: [
      {
        status: 'pending',
        remarks: 'Complaint registered and routed to authority.',
        timestamp: new Date().toISOString(),
        updatedBy: 'system',
      },
    ],
    remarks: [],
    proofUploads: [],
    preferredLanguage: preferredLanguage || 'en',
    escalationLevel: 0,
    escalationDue: escalationDueDate.toISOString(),
    isEscalated: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await db.collection(COLLECTIONS.COMPLAINTS).add(complaintData);

  // Increment user complaint count
  if (!isAnonymous && req.user?.id) {
    await db.collection(COLLECTIONS.USERS).doc(req.user.id).update({ complaintsCount: increment(1) });
  }

  // Notify user
  await notifyComplaintSubmitted(req.user, { ...complaintData, id: docRef.id });

  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully. Please save your Complaint ID.',
    data: {
      id: docRef.id,
      complaintId,
      status: 'pending',
      authorityType: routing.authorityType,
      estimatedResolutionTime: '7-14 working days',
    },
  });
});

// ======= Track Complaint (Public - by complaintId) =======
const trackComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const db = getDb();

  const snapshot = await db.collection(COLLECTIONS.COMPLAINTS).where('complaintId', '==', complaintId).limit(1).get();

  if (snapshot.empty) {
    throw new AppError('Complaint not found. Please check your Complaint ID.', 404);
  }

  const doc = snapshot.docs[0];
  const data = doc.data();

  // Return limited info for public tracking (hide sensitive routing details)
  res.json({
    success: true,
    data: {
      complaintId: data.complaintId,
      category: data.category,
      subcategory: data.subcategory,
      status: data.status,
      location: {
        state: data.location.state,
        district: data.location.district,
      },
      statusHistory: data.statusHistory || [],
      remarks: data.remarks || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      authorityType: data.routing?.authorityType,
    },
  });
});

// ======= Get My Complaints (Citizen) =======
const getMyComplaints = asyncHandler(async (req, res) => {
  const { status, category, page = 1, limit = 10 } = req.query;
  const db = getDb();

  let query = db.collection(COLLECTIONS.COMPLAINTS).where('userId', '==', req.user.id);

  if (status) query = query.where('status', '==', status);
  if (category) query = query.where('category', '==', category);

  let snapshot;
  try {
    // Try with server-side sorting first
    snapshot = await query.orderBy('createdAt', 'desc').limit(parseInt(limit)).get();
  } catch (error) {
    // If index is missing, fetch and sort in-memory (fallback)
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn('⚠️ Firestore index missing, falling back to in-memory sorting for getMyComplaints');
      snapshot = await query.get();
      // Sort manually
      snapshot.docs.sort((a, b) => {
        const timeA = a.data().createdAt?._seconds || new Date(a.data().createdAt).getTime() || 0;
        const timeB = b.data().createdAt?._seconds || new Date(b.data().createdAt).getTime() || 0;
        return timeB - timeA;
      });
      // Apply limit manually
      snapshot.docs = snapshot.docs.slice(0, parseInt(limit));
    } else {
      throw error;
    }
  }

  const complaints = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      complaintId: data.complaintId,
      category: data.category,
      subcategory: data.subcategory,
      description: data.description?.substring(0, 150) + (data.description?.length > 150 ? '...' : '') || '',
      status: data.status,
      location: { state: data.location?.state, district: data.location?.district },
      attachments: data.attachments?.length || 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  res.json({ success: true, data: { complaints, total: complaints.length, page: parseInt(page) } });
});

// ======= Get Complaint Detail (Owner or Authority) =======
const getComplaintDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const doc = await db.collection(COLLECTIONS.COMPLAINTS).doc(id).get();
  if (!doc.exists) throw new AppError('Complaint not found.', 404);

  const data = doc.data();

  // Access control: citizen can only see own complaints, authority sees assigned ones
  if (req.user.role === 'citizen' && data.userId !== req.user.id) {
    throw new AppError('Access denied.', 403);
  }
  if (['ps_officer', 'acb_officer', 'municipal_officer'].includes(req.user.role)) {
    if (data.routing?.authorityId !== req.user.authorityId) {
      throw new AppError('This complaint is not assigned to your authority.', 403);
    }
  }

  res.json({ success: true, data: { id: doc.id, ...data } });
});

// ======= Get Assigned Complaints (Authority Officers) =======
const getAssignedComplaints = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const db = getDb();

  const authorityId = req.user.authorityId;
  if (!authorityId) throw new AppError('Authority ID not configured for this account.', 400);

  let query = db.collection(COLLECTIONS.COMPLAINTS).where('routing.authorityId', '==', authorityId);

  if (status) query = query.where('status', '==', status);

  let snapshot;
  try {
    snapshot = await query.orderBy('createdAt', 'desc').limit(parseInt(limit)).get();
  } catch (error) {
    if (error.code === 9 || error.message?.includes('index')) {
      console.warn('⚠️ Firestore index missing, falling back to in-memory sorting for getAssignedComplaints');
      snapshot = await query.get();
      snapshot.docs.sort((a, b) => {
        const timeA = a.data().createdAt?._seconds || new Date(a.data().createdAt).getTime() || 0;
        const timeB = b.data().createdAt?._seconds || new Date(b.data().createdAt).getTime() || 0;
        return timeB - timeA;
      });
      snapshot.docs = snapshot.docs.slice(0, parseInt(limit));
    } else {
      throw error;
    }
  }

  const complaints = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  res.json({ success: true, data: { complaints, total: complaints.length } });
});

// ======= Update Complaint Status (Authority) =======
const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  const db = getDb();

  const doc = await db.collection(COLLECTIONS.COMPLAINTS).doc(id).get();
  if (!doc.exists) throw new AppError('Complaint not found.', 404);

  const data = doc.data();

  // Authority can only update assigned complaints
  if (['ps_officer', 'acb_officer', 'municipal_officer'].includes(req.user.role)) {
    if (data.routing?.authorityId !== req.user.authorityId) {
      throw new AppError('Not authorized to update this complaint.', 403);
    }
  }

  // Handle proof file uploads
  const proofUploads = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer, {
        folder: `grievance-portal/proofs/${data.complaintId}`,
      });
      proofUploads.push({ url: result.secure_url, publicId: result.public_id, type: file.mimetype });
    }
  }

  const statusEntry = {
    status,
    remarks: remarks || '',
    timestamp: new Date().toISOString(),
    updatedBy: req.user.name || req.user.id,
    updatedByRole: req.user.role,
  };

  const updates = {
    status,
    latestRemark: remarks || '',
    updatedAt: serverTimestamp(),
    statusHistory: [...(data.statusHistory || []), statusEntry],
  };

  if (remarks) updates.remarks = [...(data.remarks || []), { text: remarks, timestamp: new Date().toISOString(), by: req.user.name }];
  if (proofUploads.length > 0) updates.proofUploads = [...(data.proofUploads || []), ...proofUploads];
  if (status === 'closed') updates.closedAt = serverTimestamp();

  await updateDoc(doc, updates);

  // Notify user
  if (!data.isAnonymous && data.userId) {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(data.userId).get();
    if (userDoc.exists) {
      await notifyStatusChange(userDoc.data(), { ...data, status, latestRemark: remarks });
    }
  }

  // Emit socket event
  if (req.io) {
    req.io.to(`complaint_${id}`).emit('status_updated', { complaintId: id, status, remarks });
  }

  res.json({ success: true, message: 'Status updated successfully.' });
});

// ======= Analytics (Admin) =======
const getAnalytics = asyncHandler(async (req, res) => {
  const db = getDb();

  const [totalSnap, pendingSnap, closedSnap, crimeSnap, corruptionSnap, civicSnap] = await Promise.all([
    db.collection(COLLECTIONS.COMPLAINTS).count().get(),
    db.collection(COLLECTIONS.COMPLAINTS).where('status', '==', 'pending').count().get(),
    db.collection(COLLECTIONS.COMPLAINTS).where('status', '==', 'closed').count().get(),
    db.collection(COLLECTIONS.COMPLAINTS).where('category', '==', 'crime').count().get(),
    db.collection(COLLECTIONS.COMPLAINTS).where('category', '==', 'corruption').count().get(),
    db.collection(COLLECTIONS.COMPLAINTS).where('category', '==', 'civic_issue').count().get(),
  ]);

  res.json({
    success: true,
    data: {
      total: totalSnap.data().count,
      pending: pendingSnap.data().count,
      closed: closedSnap.data().count,
      byCategory: {
        crime: crimeSnap.data().count,
        corruption: corruptionSnap.data().count,
        civic_issue: civicSnap.data().count,
      },
    },
  });
});

module.exports = { submitComplaint, trackComplaint, getMyComplaints, getComplaintDetail, getAssignedComplaints, updateComplaintStatus, getAnalytics };
