const mongoose = require('mongoose');

// User Schema

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ['author', 'admin'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Book Schema

const bookSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    isbn: String,

    genre: String,

    publicationDate: Date,

    status: {
      type: String,
      default: 'In Production',
    },

    mrp: {
      type: Number,
      default: 0,
    },

    copiesSold: {
      type: Number,
      default: 0,
    },

    royaltyEarned: {
      type: Number,
      default: 0,
    },

    royaltyPaid: {
      type: Number,
      default: 0,
    },

    royaltyPending: {
      type: Number,
      default: 0,
    },

    platform: String,
  },
  {
    timestamps: true,
  }
);

// --------------------------------------------------
// Ticket Message Schema
// --------------------------------------------------

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  senderName: String,

  senderRole: {
    type: String,
    enum: ['author', 'admin', 'system'],
  },

  body: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Internal Note Schema

const noteSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  authorName: String,

  body: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ticket Schema

const ticketSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },

    bookTitle: String,

    subject: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    attachmentName: String,

    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
      index: true,
    },

    category: {
      type: String,
      default: 'General Inquiry',
      index: true,
    },

    priority: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low'],
      default: 'Medium',
      index: true,
    },

    aiCategory: String,

    aiPriority: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    assignedName: String,

    messages: [messageSchema],

    internalNotes: [noteSchema],

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Ticket Indexes

ticketSchema.index({
  status: 1,
  priority: 1,
  createdAt: 1,
});

// Model Exports

const User = mongoose.model('User', userSchema);
const Book = mongoose.model('Book', bookSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = {
  User,
  Book,
  Ticket,
};
