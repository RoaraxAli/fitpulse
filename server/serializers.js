'use strict';

const idOf = (value) => (value && value.toString ? value.toString() : value || null);

const publicUser = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    username: doc.username,
    name: doc.name,
    avatar: doc.avatar || null,
    bio: doc.bio || '',
    location: doc.location || '',
    isPublic: doc.isPublic !== false,
    createdAt: doc.createdAt || null,
  };
};

const selfUser = (doc) => {
  if (!doc) return null;
  return {
    ...publicUser(doc),
    email: doc.email,
    birthdate: doc.birthdate || null,
    gender: doc.gender || null,
    heightCm: doc.heightCm ?? null,
    unitSystem: doc.unitSystem || 'metric',
    theme: doc.theme || 'dark',
    role: doc.role || 'user',
    settings: doc.settings || {},
    lastLoginAt: doc.lastLoginAt || null,
  };
};

const workout = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    userId: idOf(doc.userId),
    name: doc.name,
    category: doc.category,
    description: doc.description || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    isPublic: Boolean(doc.isPublic),
    isTemplate: Boolean(doc.isTemplate),
    videoUrl: doc.videoUrl || null,
    exercises: (doc.exercises || []).map((ex) => ({
      name: ex.name,
      sets: ex.sets ?? 3,
      reps: ex.reps ?? 10,
      weight: ex.weight ?? 0,
      restSeconds: ex.restSeconds ?? 60,
      notes: ex.notes || '',
    })),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
};

const setVolume = (sets = []) => sets.reduce((sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);

const workoutLog = (doc) => {
  if (!doc) return null;
  const sets = (doc.sets || []).map((s) => ({
    exerciseName: s.exerciseName,
    setNumber: s.setNumber ?? 1,
    reps: s.reps ?? 0,
    weight: s.weight ?? 0,
    notes: s.notes || '',
  }));
  return {
    id: idOf(doc._id),
    userId: idOf(doc.userId),
    workoutId: idOf(doc.workoutId),
    name: doc.name,
    category: doc.category,
    performedAt: doc.performedAt,
    durationMin: doc.durationMin || 0,
    caloriesBurned: doc.caloriesBurned || 0,
    rating: doc.rating || 0,
    notes: doc.notes || '',
    sets,
    volume: Math.round(setVolume(sets)),
    totalSets: sets.length,
    totalReps: sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0),
    createdAt: doc.createdAt || null,
  };
};

const food = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    name: doc.name,
    brand: doc.brand || '',
    servingSize: doc.servingSize ?? 100,
    servingUnit: doc.servingUnit || 'g',
    calories: doc.calories ?? 0,
    protein: doc.protein ?? 0,
    carbs: doc.carbs ?? 0,
    fat: doc.fat ?? 0,
    fiber: doc.fiber ?? 0,
    sugar: doc.sugar ?? 0,
    sodium: doc.sodium ?? 0,
    isCustom: Boolean(doc.createdBy),
  };
};

const nutritionLog = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    userId: idOf(doc.userId),
    date: doc.date,
    meal: doc.meal,
    foodId: idOf(doc.foodId),
    foodName: doc.foodName,
    quantity: doc.quantity ?? 1,
    servingSize: doc.servingSize ?? 100,
    servingUnit: doc.servingUnit || 'g',
    calories: doc.calories ?? 0,
    protein: doc.protein ?? 0,
    carbs: doc.carbs ?? 0,
    fat: doc.fat ?? 0,
    notes: doc.notes || '',
    createdAt: doc.createdAt || null,
  };
};

const measurement = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    measuredOn: doc.measuredOn,
    weightKg: doc.weightKg ?? null,
    bodyFatPct: doc.bodyFatPct ?? null,
    chestCm: doc.chestCm ?? null,
    waistCm: doc.waistCm ?? null,
    hipsCm: doc.hipsCm ?? null,
    armsCm: doc.armsCm ?? null,
    thighsCm: doc.thighsCm ?? null,
    notes: doc.notes || '',
    createdAt: doc.createdAt || null,
  };
};

const metric = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    metric: doc.metric,
    value: doc.value,
    unit: doc.unit || '',
    recordedOn: doc.recordedOn,
    notes: doc.notes || '',
    createdAt: doc.createdAt || null,
  };
};

const goal = (doc) => {
  if (!doc) return null;
  const target = Number(doc.targetValue) || 0;
  const current = Number(doc.currentValue) || 0;
  return {
    id: idOf(doc._id),
    title: doc.title,
    type: doc.type,
    targetValue: target,
    currentValue: current,
    unit: doc.unit || '',
    deadline: doc.deadline || null,
    status: doc.status || 'active',
    progress: target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
};

const notification = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    type: doc.type,
    title: doc.title,
    body: doc.body || '',
    icon: doc.icon || 'bell',
    link: doc.link || '',
    isRead: Boolean(doc.isRead),
    createdAt: doc.createdAt || null,
  };
};

const reminder = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    title: doc.title,
    type: doc.type,
    timeOfDay: doc.timeOfDay,
    days: Array.isArray(doc.days) ? doc.days : [],
    enabled: Boolean(doc.enabled),
    lastFiredAt: doc.lastFiredAt || null,
    createdAt: doc.createdAt || null,
  };
};

const post = (doc, extras = {}) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    title: doc.title,
    body: doc.body,
    category: doc.category || 'general',
    author: doc.author || publicUser(doc.user) || null,
    likes: extras.likes || 0,
    replies: extras.replies || 0,
    likedByMe: Boolean(extras.likedByMe),
    createdAt: doc.createdAt || null,
  };
};

const reply = (doc) => {
  if (!doc) return null;
  return {
    id: idOf(doc._id),
    postId: idOf(doc.postId),
    body: doc.body,
    author: doc.author || publicUser(doc.user) || null,
    createdAt: doc.createdAt || null,
  };
};

module.exports = {
  idOf,
  publicUser,
  selfUser,
  workout,
  workoutLog,
  food,
  nutritionLog,
  measurement,
  metric,
  goal,
  notification,
  reminder,
  post,
  reply,
  setVolume,
};
