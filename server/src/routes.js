
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { User, Book, Ticket } = require('./models');
const { classifyTicket, draftResponse } = require('./ai');

const router = express.Router();

// Utility Functions


const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const tokenFor = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

// Authentication Middleware

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(
    /^Bearer\s+/i,
    ''
  );

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: 'Session expired. Please sign in again.',
    });
  }
}

const adminOnly = (req, res, next) =>
  req.user.role === 'admin'
    ? next()
    : res.status(403).json({
        error: 'Admin access required.',
      });

// Validation Schemas

const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(1).max(200),
});

const createSchema = z.object({
  bookId: z.string().optional().nullable(),
  subject: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(6000),
  attachmentName: z.string().max(255).optional(),
});

// Health Check

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'bookleaf-api',
  });
});


// Login
router.post(
  '/auth/login',
  asyncRoute(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Enter a valid email and password.',
      });
    }

    const user = await User.findOne({
      email: parsed.data.email.toLowerCase(),
    });

    if (
      !user ||
      !(await bcrypt.compare(
        parsed.data.password,
        user.passwordHash
      ))
    ) {
      return res.status(401).json({
        error: 'Email or password is incorrect.',
      });
    }

    res.json({
      token: tokenFor(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

// Get Current User
router.get(
  '/auth/me',
  auth,
  asyncRoute(async (req, res) => {
    const user = await User.findById(req.user.sub).select(
      'name email role'
    );

    if (!user) {
      return res.status(401).json({
        error: 'Account no longer exists.',
      });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  })
);

// --------------------------------------------------
// Book Routes
// --------------------------------------------------

router.get(
  '/books',
  auth,
  asyncRoute(async (req, res) => {
    const filter = {};

    if (req.user.role === 'author') {
      filter.author = req.user.sub;
    } else if (req.query.authorId) {
      filter.author = req.query.authorId;
    }

    const books = await Book.find(filter)
      .populate('author', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    res.json(books);
  })
);

// Ticket Routes
// Get Tickets with Filters and Search
router.get(
  '/tickets',
  auth,
  asyncRoute(async (req, res) => {
    const filter = {};

    if (req.user.role === 'author') {
      filter.author = req.user.sub;
    }

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    if (req.query.category && req.query.category !== 'All') {
      filter.category = req.query.category;
    }

    if (req.query.priority && req.query.priority !== 'All') {
      filter.priority = req.query.priority;
    }

    // Date Filters
    if (req.query.from || req.query.to) {
      filter.createdAt = {};

      if (
        req.query.from &&
        !Number.isNaN(Date.parse(req.query.from))
      ) {
        filter.createdAt.$gte = new Date(req.query.from);
      }

      if (
        req.query.to &&
        !Number.isNaN(Date.parse(req.query.to))
      ) {
        const end = new Date(req.query.to);
        end.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = end;
      }
    }

    // Search by Subject, Description, or Book Title
    if (req.query.q) {
      const searchTerm = String(req.query.q);

      filter.$or = [
        {
          subject: {
            $regex: searchTerm,
            $options: 'i',
          },
        },
        {
          description: {
            $regex: searchTerm,
            $options: 'i',
          },
        },
        {
          bookTitle: {
            $regex: searchTerm,
            $options: 'i',
          },
        },
      ];
    }

    const ticketQuery = Ticket.find(filter)
      .populate('author', 'name email')
      .sort({ priority: 1, createdAt: 1 });

    // Hide Internal Notes from Non-Admin Users
    if (req.user.role !== 'admin') {
      ticketQuery.select('-internalNotes');
    }

    const tickets = await ticketQuery.lean();

    // Priority Sorting
    const priorityOrder = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    tickets.sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        new Date(a.createdAt) - new Date(b.createdAt)
    );

    res.json(tickets);
  })
);

// Create Ticket
router.post(
  '/tickets',
  auth,
  asyncRoute(async (req, res) => {
    if (req.user.role !== 'author') {
      return res.status(403).json({
        error: 'Only authors can submit tickets.',
      });
    }

    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error:
          parsed.error.issues[0]?.message ||
          'Please check the ticket details.',
      });
    }

    let book = null;

    if (
      parsed.data.bookId &&
      parsed.data.bookId !== 'general'
    ) {
      book = await Book.findOne({
        _id: parsed.data.bookId,
        author: req.user.sub,
      });

      if (!book) {
        return res.status(400).json({
          error: 'Selected book was not found in your account.',
        });
      }
    }

    const ticket = await Ticket.create({
      author: req.user.sub,
      book: book?._id || null,
      bookTitle: book?.title || 'General / Account Level',
      subject: parsed.data.subject,
      description: parsed.data.description,
      attachmentName: parsed.data.attachmentName || '',
      messages: [],
      status: 'Open',
      category: 'General Inquiry',
      priority: 'Medium',
    });

    // AI Ticket Classification
    const result = await classifyTicket(
      ticket.subject,
      ticket.description
    );

    ticket.category = result.category;
    ticket.priority = result.priority;
    ticket.aiCategory = result.category;
    ticket.aiPriority = result.priority;

    await ticket.save();

    res.status(201).json(ticket);
  })
);

// Ticket Authorization Helper

async function getAuthorizedTicket(id, user) {
  const ticket = await Ticket.findById(id).populate(
    'author',
    'name email'
  );

  if (!ticket) {
    return {
      error: 'Ticket not found.',
      status: 404,
    };
  }

  if (
    user.role !== 'admin' &&
    ticket.author._id.toString() !== user.sub
  ) {
    return {
      error: 'You do not have access to this ticket.',
      status: 403,
    };
  }

  // Prevent Authors from Viewing Internal Notes
  if (user.role !== 'admin') {
    ticket.internalNotes = [];
  }

  return { ticket };
}

// Get Single Ticket
router.get(
  '/tickets/:id',
  auth,
  asyncRoute(async (req, res) => {
    const result = await getAuthorizedTicket(
      req.params.id,
      req.user
    );

    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
      });
    }

    res.json(result.ticket);
  })
);

// Admin Ticket Management

const updateTicketSchema = z.object({
  status: z
    .enum(['Open', 'In Progress', 'Resolved', 'Closed'])
    .optional(),

  category: z
    .enum([
      'Royalty & Payments',
      'ISBN & Metadata Issues',
      'Printing & Quality',
      'Distribution & Availability',
      'Book Status & Production Updates',
      'General Inquiry',
    ])
    .optional(),

  priority: z
    .enum(['Critical', 'High', 'Medium', 'Low'])
    .optional(),

  assignedToMe: z.boolean().optional(),
});

// Update Ticket
router.patch(
  '/tickets/:id',
  auth,
  adminOnly,
  asyncRoute(async (req, res) => {
    const parsed = updateTicketSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid ticket update.',
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const data = parsed.data;

    if (data.status) {
      ticket.status = data.status;
    }

    if (data.category) {
      ticket.category = data.category;
    }

    if (data.priority) {
      ticket.priority = data.priority;
    }

    if (data.assignedToMe) {
      const admin = await User.findById(req.user.sub);

      if (!admin) {
        return res.status(401).json({
          error: 'Admin account no longer exists.',
        });
      }

      ticket.assignedTo = admin._id;
      ticket.assignedName = admin.name;
    }

    ticket.lastActivityAt = new Date();

    await ticket.save();

    res.json(ticket);
  })
);

// Generate AI Response Draft
router.post(
  '/tickets/:id/ai-draft',
  auth,
  adminOnly,
  asyncRoute(async (req, res) => {
    const result = await getAuthorizedTicket(
      req.params.id,
      req.user
    );

    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
      });
    }

    const draft = await draftResponse(result.ticket);

    res.json({ draft });
  })
);

// Send Admin Response
router.post(
  '/tickets/:id/messages',
  auth,
  adminOnly,
  asyncRoute(async (req, res) => {
    const schema = z.object({
      body: z.string().trim().min(2).max(5000),
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Response must be between 2 and 5000 characters.',
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const admin = await User.findById(req.user.sub);

    if (!admin) {
      return res.status(401).json({
        error: 'Admin account no longer exists.',
      });
    }

    ticket.messages.push({
      sender: admin._id,
      senderName: admin.name,
      senderRole: 'admin',
      body: parsed.data.body,
    });

    if (ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }

    ticket.lastActivityAt = new Date();

    await ticket.save();

    res.status(201).json(ticket);
  })
);

// Add Internal Note
router.post(
  '/tickets/:id/notes',
  auth,
  adminOnly,
  asyncRoute(async (req, res) => {
    const schema = z.object({
      body: z.string().trim().min(2).max(3000),
    });

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Note must be between 2 and 3000 characters.',
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        error: 'Ticket not found.',
      });
    }

    const admin = await User.findById(req.user.sub);

    if (!admin) {
      return res.status(401).json({
        error: 'Admin account no longer exists.',
      });
    }

    ticket.internalNotes.push({
      author: admin._id,
      authorName: admin.name,
      body: parsed.data.body,
    });

    ticket.lastActivityAt = new Date();

    await ticket.save();

    res.status(201).json({
      ok: true,
    });
  })
);

// --------------------------------------------------
// Centralized Error Handler
// --------------------------------------------------

router.use((err, req, res, next) => {
  console.error(err);

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid identifier.',
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'A record with that value already exists.',
    });
  }

  res.status(500).json({
    error: 'Something went wrong. Please try again.',
  });
});

module.exports = {
  router,
  auth,
};
