const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const PORT = process.env.PORT || 3000;

// ----- Mongoose Setup -----
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('Mongo error:', err.message));

// ----- Schemas -----
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String
});

const categorySchema = new mongoose.Schema({
  name: { type: String, unique: true }
});

const questionSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  author: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
  answers: [{
    author: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Question = mongoose.model('Question', questionSchema);

// ----- Auth Middleware -----
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// ----- Seed default categories if empty -----
async function seedCategories() {
  const count = await Category.countDocuments();
  if (count === 0) {
    await Category.insertMany([
      { name: 'JavaScript' },
      { name: 'Node.js' },
      { name: 'Databases' },
      { name: 'Pets' }
    ]);
    console.log('🌱 Seeded default categories');
  }
}
seedCategories();

// ----- Routes: Auth -----
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ message: 'username already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ username, passwordHash });
  res.json({ message: 'registered' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'invalid credentials' });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '2d' });
  res.json({ token, username });
});

// ----- Routes: Categories & Questions -----
app.get('/api/categories', auth, async (req, res) => {
  const categories = await Category.find({}).sort({ name: 1 });
  res.json(categories);
});

app.get('/api/questions', auth, async (req, res) => {
  const { categoryId } = req.query;
  const q = categoryId ? { categoryId } : {};
  const items = await Question.find(q).sort({ createdAt: -1 });
  res.json(items);
});

app.post('/api/questions', auth, async (req, res) => {
  const { categoryId, text } = req.body || {};
  if (!categoryId || !text) return res.status(400).json({ message: 'categoryId and text required' });
  const item = await Question.create({ categoryId, text, author: req.user.username });
  res.json(item);
});

app.post('/api/answers', auth, async (req, res) => {
  const { questionId, text } = req.body || {};
  if (!questionId || !text) return res.status(400).json({ message: 'questionId and text required' });
  const q = await Question.findById(questionId);
  if (!q) return res.status(404).json({ message: 'question not found' });
  q.answers.push({ text, author: req.user.username });
  await q.save();
  res.json(q);
});

// ----- Health Check -----
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ----- Start Server -----
app.listen(PORT, () => console.log('🚀 Server running on http://localhost:' + PORT));

// --- DEV ONLY: Seed default categories once ---
app.post('/api/dev/seed-categories', async (req, res) => {
  try {
    const existing = await Category.countDocuments();
    if (existing > 0) {
      return res.json({ ok: true, message: 'Categories already exist.' });
    }

    await Category.insertMany([
      { name: 'General' },
      { name: 'Help' },
      { name: 'Announcements' },
      { name: 'Off Topic' }
    ]);

    res.json({ ok: true, message: 'Seeded default categories.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'Seed failed.' });
  }
});

