'use strict';

const { getDb, connect, close } = require('./db');
const { hashPassword } = require('./auth');
const { todayISO, addDaysISO, daysAgoISO, round } = require('./utils');

const DEMO_PASSWORD = 'FitPulse123!';

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261112);
const pick = (items) => items[Math.floor(rng() * items.length)];
const jitter = (amount) => (rng() * 2 - 1) * amount;

const food = (name, calories, protein, carbs, fat, fiber = 0, sugar = 0, sodium = 0, brand = '') => ({
  name,
  brand,
  servingSize: 100,
  servingUnit: 'g',
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugar,
  sodium,
  createdBy: null,
});

const FOODS = [
  food('Oats', 389, 13, 66, 7, 10, 1, 2),
  food('Banana', 89, 1.1, 22.8, 0.3, 2.6, 12.2, 1),
  food('Greek Yogurt', 59, 10, 3.6, 0.4, 0, 3.2, 36),
  food('Blueberries', 57, 0.7, 14.5, 0.3, 2.4, 10, 1),
  food('Eggs', 155, 13, 1.1, 11, 0, 1.1, 124),
  food('Whole Wheat Bread', 247, 13, 41, 3.4, 7, 5, 400),
  food('Avocado', 160, 2, 8.5, 14.7, 6.7, 0.7, 7),
  food('Protein Powder', 400, 80, 10, 5, 2, 3, 300, 'PureFuel'),
  food('Milk', 42, 3.4, 5, 1, 0, 5, 44),
  food('Chicken Breast', 165, 31, 0, 3.6, 0, 0, 74),
  food('Brown Rice', 112, 2.6, 23.5, 0.9, 1.8, 0.4, 5),
  food('Broccoli', 34, 2.8, 6.6, 0.4, 2.6, 1.7, 33),
  food('Olive Oil', 884, 0, 0, 100, 0, 0, 2),
  food('Tuna', 132, 28, 0, 1.3, 0, 0, 47),
  food('Quinoa', 120, 4.4, 21.3, 1.9, 2.8, 0.9, 7),
  food('Spinach', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 79),
  food('Tomato', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5),
  food('Turkey Breast', 189, 29, 0, 7, 0, 0, 60),
  food('Sweet Potato', 86, 1.6, 20.1, 0.1, 3, 4.2, 55),
  food('Salmon', 208, 20, 0, 13, 0, 0, 59),
  food('Beef Steak', 271, 25, 0, 19, 0, 0, 72),
  food('White Rice', 130, 2.7, 28.2, 0.3, 0.4, 0.1, 1),
  food('Shrimp', 99, 24, 0.2, 0.3, 0, 0, 111),
  food('Pasta', 158, 5.8, 30.9, 0.9, 1.8, 0.6, 1),
  food('Almonds', 579, 21.2, 21.6, 49.9, 12.5, 4.4, 1),
  food('Apple', 52, 0.3, 13.8, 0.2, 2.4, 10.4, 1),
  food('Peanut Butter', 588, 25, 20, 50, 6, 9, 17, 'NutHouse'),
  food('Cottage Cheese', 98, 11.1, 3.4, 4.3, 0, 2.7, 364),
  food('Mixed Berries', 57, 0.7, 14.5, 0.3, 2.4, 10, 1),
  food('Dark Chocolate', 546, 4.9, 61, 31, 7, 48, 24),
  food('Orange', 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0),
  food('Cheddar Cheese', 403, 25, 1.3, 33, 0, 0.5, 621),
  food('Hummus', 166, 7.9, 14.3, 9.6, 6, 0.3, 379),
  food('Granola', 471, 10, 64, 20, 7, 24, 26, 'Morning Co'),
];

const CATALOG = [
  ['Barbell Bench Press', 'strength', 'chest'],
  ['Incline Dumbbell Press', 'strength', 'chest'],
  ['Overhead Press', 'strength', 'shoulders'],
  ['Cable Fly', 'strength', 'chest'],
  ['Triceps Pushdown', 'strength', 'arms'],
  ['Deadlift', 'strength', 'back'],
  ['Pull-Up', 'strength', 'back'],
  ['Barbell Row', 'strength', 'back'],
  ['Face Pull', 'strength', 'shoulders'],
  ['Hammer Curl', 'strength', 'arms'],
  ['Back Squat', 'strength', 'legs'],
  ['Romanian Deadlift', 'strength', 'legs'],
  ['Leg Press', 'strength', 'legs'],
  ['Walking Lunge', 'strength', 'legs'],
  ['Calf Raise', 'strength', 'legs'],
  ['Plank', 'strength', 'core'],
  ['Russian Twist', 'strength', 'core'],
  ['Mountain Climbers', 'cardio', 'core'],
  ['Burpees', 'cardio', 'full_body'],
  ['Treadmill Intervals', 'cardio', 'full_body'],
  ['Rowing Machine', 'cardio', 'full_body'],
  ['Kettlebell Swing', 'strength', 'full_body'],
  ['Goblet Squat', 'strength', 'legs'],
  ['Push-Up', 'strength', 'chest'],
  ['Lat Pulldown', 'strength', 'back'],
  ['Bicep Curl', 'strength', 'arms'],
  ['Dips', 'strength', 'chest'],
  ['Hip Thrust', 'strength', 'legs'],
  ['Leg Curl', 'strength', 'legs'],
  ['Lateral Raise', 'strength', 'shoulders'],
].map(([name, category, muscleGroup]) => ({ name, category, muscleGroup }));

const ROUTINES = [
  {
    name: 'Push Day — Chest & Shoulders',
    category: 'strength',
    description: 'Heavy horizontal pressing followed by shoulder and triceps volume.',
    tags: ['push', 'upper'],
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: 8, weight: 80, restSeconds: 120, notes: 'Leave one rep in the tank' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10, weight: 28, restSeconds: 90, notes: '' },
      { name: 'Overhead Press', sets: 3, reps: 8, weight: 45, restSeconds: 120, notes: 'Brace hard' },
      { name: 'Cable Fly', sets: 3, reps: 12, weight: 15, restSeconds: 60, notes: 'Squeeze at the top' },
      { name: 'Triceps Pushdown', sets: 3, reps: 12, weight: 25, restSeconds: 60, notes: '' },
    ],
  },
  {
    name: 'Pull Day — Back & Biceps',
    category: 'strength',
    description: 'Posterior chain strength with pulling volume.',
    tags: ['pull', 'upper'],
    exercises: [
      { name: 'Deadlift', sets: 4, reps: 5, weight: 120, restSeconds: 180, notes: 'Reset each rep' },
      { name: 'Pull-Up', sets: 4, reps: 8, weight: 0, restSeconds: 90, notes: 'Bodyweight' },
      { name: 'Barbell Row', sets: 4, reps: 10, weight: 60, restSeconds: 90, notes: '' },
      { name: 'Face Pull', sets: 3, reps: 15, weight: 20, restSeconds: 60, notes: 'Slow eccentric' },
      { name: 'Hammer Curl', sets: 3, reps: 12, weight: 14, restSeconds: 60, notes: '' },
    ],
  },
  {
    name: 'Leg Day',
    category: 'strength',
    description: 'Squat focus with hamstring and glute accessories.',
    tags: ['legs', 'lower'],
    exercises: [
      { name: 'Back Squat', sets: 5, reps: 5, weight: 100, restSeconds: 180, notes: 'Depth over ego' },
      { name: 'Romanian Deadlift', sets: 4, reps: 8, weight: 80, restSeconds: 120, notes: '' },
      { name: 'Leg Press', sets: 4, reps: 12, weight: 180, restSeconds: 90, notes: '' },
      { name: 'Walking Lunge', sets: 3, reps: 12, weight: 20, restSeconds: 90, notes: 'Per leg' },
      { name: 'Calf Raise', sets: 4, reps: 15, weight: 60, restSeconds: 60, notes: 'Pause at the top' },
    ],
  },
  {
    name: 'HIIT & Core',
    category: 'hiit',
    description: 'Short, sharp conditioning circuit — 28 minutes of work.',
    tags: ['conditioning', 'core'],
    exercises: [
      { name: 'Treadmill Intervals', sets: 6, reps: 1, weight: 0, restSeconds: 60, notes: '30s hard / 60s easy' },
      { name: 'Rowing Machine', sets: 3, reps: 1, weight: 0, restSeconds: 60, notes: '250 m pieces' },
      { name: 'Burpees', sets: 3, reps: 15, weight: 0, restSeconds: 45, notes: '' },
      { name: 'Mountain Climbers', sets: 3, reps: 30, weight: 0, restSeconds: 45, notes: '' },
      { name: 'Plank', sets: 3, reps: 1, weight: 0, restSeconds: 45, notes: '45 second hold' },
    ],
  },
  {
    name: 'Full Body Express',
    category: 'strength',
    description: 'Thirty-minute full-body session for busy days.',
    tags: ['full-body', 'conditioning'],
    exercises: [
      { name: 'Kettlebell Swing', sets: 3, reps: 15, weight: 24, restSeconds: 60, notes: '' },
      { name: 'Goblet Squat', sets: 3, reps: 12, weight: 24, restSeconds: 60, notes: '' },
      { name: 'Push-Up', sets: 3, reps: 15, weight: 0, restSeconds: 60, notes: '' },
      { name: 'Plank', sets: 3, reps: 1, weight: 0, restSeconds: 45, notes: '40 second hold' },
    ],
  },
];

const MEAL_PLANS = {
  breakfast: [
    [
      ['Oats', 80],
      ['Greek Yogurt', 150],
      ['Blueberries', 100],
    ],
    [
      ['Eggs', 150],
      ['Whole Wheat Bread', 70],
      ['Avocado', 50],
    ],
    [
      ['Protein Powder', 30],
      ['Banana', 120],
      ['Milk', 250],
    ],
    [
      ['Granola', 60],
      ['Greek Yogurt', 170],
      ['Mixed Berries', 80],
    ],
  ],
  lunch: [
    [
      ['Chicken Breast', 180],
      ['Brown Rice', 180],
      ['Broccoli', 120],
      ['Olive Oil', 10],
    ],
    [
      ['Tuna', 150],
      ['Quinoa', 180],
      ['Spinach', 80],
      ['Tomato', 100],
    ],
    [
      ['Turkey Breast', 170],
      ['Sweet Potato', 200],
      ['Spinach', 70],
    ],
    [
      ['Chicken Breast', 170],
      ['Pasta', 190],
      ['Tomato', 120],
      ['Olive Oil', 8],
    ],
  ],
  dinner: [
    [
      ['Salmon', 160],
      ['Sweet Potato', 220],
      ['Broccoli', 120],
    ],
    [
      ['Beef Steak', 170],
      ['White Rice', 180],
      ['Spinach', 100],
    ],
    [
      ['Shrimp', 180],
      ['Pasta', 200],
      ['Tomato', 120],
      ['Olive Oil', 10],
    ],
    [
      ['Chicken Breast', 180],
      ['Quinoa', 170],
      ['Avocado', 60],
    ],
  ],
  snack: [
    [
      ['Protein Powder', 30],
      ['Almonds', 25],
    ],
    [
      ['Apple', 150],
      ['Peanut Butter', 25],
    ],
    [
      ['Cottage Cheese', 150],
      ['Mixed Berries', 100],
    ],
    [
      ['Dark Chocolate', 20],
      ['Orange', 150],
    ],
    [
      ['Hummus', 60],
      ['Whole Wheat Bread', 40],
    ],
  ],
};

function mealEntry(name, grams, meal, date, foodMap) {
  const source = foodMap.get(name);
  const quantity = round(grams / source.servingSize, 2);
  return {
    date,
    meal,
    foodId: source._id,
    foodName: source.name,
    quantity,
    servingSize: source.servingSize,
    servingUnit: source.servingUnit,
    calories: round(source.calories * quantity, 1),
    protein: round(source.protein * quantity, 1),
    carbs: round(source.carbs * quantity, 1),
    fat: round(source.fat * quantity, 1),
    notes: '',
    createdAt: new Date(`${date}T12:00:00Z`),
  };
}

function buildLog(routine, date, weekIndex, userId) {
  const sets = [];
  routine.exercises.forEach((exercise) => {
    for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
      const progression = 1 + weekIndex * 0.012;
      const noisyWeight = exercise.weight ? round(exercise.weight * progression + jitter(1.2) + setNumber * 0.4, 1) : 0;
      let reps = exercise.reps;
      if (rng() < 0.22) reps += 1;
      if (rng() < 0.08) reps -= 1;
      sets.push({
        exerciseName: exercise.name,
        setNumber,
        reps: Math.max(1, reps),
        weight: Math.max(0, noisyWeight),
        notes: '',
      });
    }
  });
  const isCardio = routine.category === 'cardio' || routine.category === 'hiit';
  const durationMin = isCardio ? 26 + Math.round(rng() * 10) : 48 + Math.round(rng() * 25);
  const caloriesBurned = isCardio ? 300 + Math.round(rng() * 130) : 330 + Math.round(rng() * 190);
  return {
    userId,
    workoutId: routine._id,
    name: routine.name,
    category: routine.category,
    performedAt: date,
    durationMin,
    caloriesBurned,
    rating: 3 + Math.round(rng() * 2),
    notes: rng() < 0.18 ? pick(['Felt strong today.', 'Energy dipped mid-session.', 'Great pump.', 'Moved well, no niggles.']) : '',
    sets,
    createdAt: new Date(`${date}T18:30:00Z`),
  };
}

async function seedDatabase({ reset = false } = {}) {
  const db = getDb();

  if (reset) {
    const collections = await db.listCollections().toArray();
    await Promise.all(collections.map((collection) => db.collection(collection.name).deleteMany({})));
  } else {
    const count = await db.collection('users').countDocuments();
    if (count > 0) return { seeded: false, reason: 'users-exist' };
  }

  const now = new Date();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const userDocs = [
    {
      username: 'alex',
      email: 'alex@fitpulse.app',
      name: 'Alex Carter',
      bio: 'Software engineer chasing a 100 kg bench and a sub-25 5K. Consistency over perfection.',
      location: 'Austin, TX',
      gender: 'male',
      heightCm: 180,
      unitSystem: 'metric',
      theme: 'dark',
      isPublic: true,
      settings: {
        notifyWorkout: true,
        notifyMeal: true,
        notifyGoals: true,
        notifySocial: true,
        notifyEmail: false,
        timezone: 'America/Chicago',
        weekStart: 1,
        calorieGoal: 2400,
        proteinGoal: 165,
        carbsGoal: 260,
        fatGoal: 75,
        waterGoal: 3000,
        stepGoal: 9000,
      },
    },
    {
      username: 'maya',
      email: 'maya@fitpulse.app',
      name: 'Maya Chen',
      bio: 'Meal-prep enthusiast. Strength training 4x per week. Protein first, always.',
      location: 'Seattle, WA',
      gender: 'female',
      heightCm: 165,
      settings: {
        notifyWorkout: true,
        notifyMeal: true,
        notifyGoals: true,
        notifySocial: true,
        notifyEmail: false,
        timezone: 'America/Los_Angeles',
        weekStart: 1,
        calorieGoal: 2000,
        proteinGoal: 140,
        carbsGoal: 210,
        fatGoal: 65,
        waterGoal: 2500,
        stepGoal: 10000,
      },
    },
    {
      username: 'jordan',
      email: 'jordan@fitpulse.app',
      name: 'Jordan Blake',
      bio: 'Powerlifting hobbyist. Deadlift is my therapy. Always happy to talk programming.',
      location: 'Denver, CO',
      gender: 'non_binary',
      heightCm: 178,
      settings: {
        notifyWorkout: true,
        notifyMeal: false,
        notifyGoals: true,
        notifySocial: true,
        notifyEmail: false,
        timezone: 'America/Denver',
        weekStart: 1,
        calorieGoal: 2900,
        proteinGoal: 190,
        carbsGoal: 320,
        fatGoal: 90,
        waterGoal: 3200,
        stepGoal: 7000,
      },
    },
    {
      username: 'priya',
      email: 'priya@fitpulse.app',
      name: 'Priya Nair',
      bio: 'Runner, yogi, occasional lifter. Chasing a faster 5K every season.',
      location: 'Chicago, IL',
      gender: 'female',
      heightCm: 160,
      settings: {
        notifyWorkout: true,
        notifyMeal: true,
        notifyGoals: true,
        notifySocial: true,
        notifyEmail: true,
        timezone: 'America/Chicago',
        weekStart: 1,
        calorieGoal: 2100,
        proteinGoal: 120,
        carbsGoal: 270,
        fatGoal: 60,
        waterGoal: 2600,
        stepGoal: 11000,
      },
    },
  ].map((user, index) => ({
    ...user,
    passwordHash,
    avatar: null,
    birthdate: null,
    role: index === 0 ? 'admin' : 'user',
    createdAt: new Date(Date.now() - 120 * 86400000),
    updatedAt: now,
    lastLoginAt: new Date(Date.now() - 3600000),
  }));

  const insertedUsers = await db.collection('users').insertMany(userDocs);
  const [alex, maya, jordan, priya] = Object.values(insertedUsers.insertedIds);
  const userIds = { alex, maya, jordan, priya };

  const foodResult = await db.collection('foods').insertMany(FOODS);
  const foodIds = Object.values(foodResult.insertedIds);
  const foodMap = new Map(FOODS.map((item, index) => [item.name, { ...item, _id: foodIds[index] }]));

  await db.collection('exerciseCatalog').insertMany(CATALOG);

  // Routines -----------------------------------------------------------------
  const routineDocs = ROUTINES.map((routine) => ({
    userId: null,
    name: routine.name,
    category: routine.category,
    description: routine.description,
    tags: routine.tags,
    isPublic: true,
    isTemplate: true,
    exercises: routine.exercises,
    createdAt: new Date(Date.now() - 100 * 86400000),
    updatedAt: new Date(Date.now() - 10 * 86400000),
  }));
  const insertedRoutines = await db.collection('workouts').insertMany(routineDocs);
  const routines = routineDocs.map((routine, index) => ({
    ...routine,
    _id: Object.values(insertedRoutines.insertedIds)[index],
    exercises: routine.exercises,
  }));

  const mayaRoutine = {
    userId: maya,
    name: 'Upper Body Strength',
    category: 'strength',
    description: 'Balanced upper session with a pull bias.',
    tags: ['upper', 'strength'],
    isPublic: true,
    exercises: [
      { name: 'Bench Press', sets: 4, reps: 6, weight: 45, restSeconds: 120, notes: '' },
      { name: 'Lat Pulldown', sets: 3, reps: 10, weight: 35, restSeconds: 90, notes: '' },
      { name: 'Lateral Raise', sets: 3, reps: 15, weight: 8, restSeconds: 60, notes: '' },
      { name: 'Bicep Curl', sets: 3, reps: 12, weight: 10, restSeconds: 60, notes: '' },
    ],
    createdAt: new Date(Date.now() - 80 * 86400000),
    updatedAt: now,
  };
  const insertedMayaRoutine = await db.collection('workouts').insertOne(mayaRoutine);
  mayaRoutine._id = insertedMayaRoutine.insertedId;

  // Workout logs -------------------------------------------------------------
  const logs = [];
  const today = todayISO();
  for (let offset = 69; offset >= 0; offset -= 1) {
    const date = addDaysISO(today, -offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    let routine = null;
    if (weekday === 1) routine = routines[0];
    else if (weekday === 3) routine = routines[1];
    else if (weekday === 5) routine = routines[2];
    else if (weekday === 6) routine = routines[3];
    if (!routine) continue;
    if (rng() < 0.14) continue;
    logs.push(buildLog(routine, date, Math.floor((69 - offset) / 7), alex));
  }
  // Guarantee a current streak for the dashboard.
  for (let back = 0; back < 3; back += 1) {
    const date = addDaysISO(today, -back);
    if (!logs.some((log) => log.performedAt === date)) {
      logs.push(buildLog(routines[4], date, 9, alex));
    }
  }
  // Some recent activity for the other members.
  [maya, jordan, priya].forEach((userId, index) => {
    for (let back = 1; back <= 4; back += 1) {
      const date = addDaysISO(today, -back * 2 - index);
      logs.push({
        userId,
        workoutId: index === 0 ? mayaRoutine._id : null,
        name: index === 0 ? mayaRoutine.name : ['Deadlift Focus', 'Tempo Run'][index - 1] || 'Conditioning',
        category: index === 2 ? 'cardio' : 'strength',
        performedAt: date,
        durationMin: 40 + index * 8,
        caloriesBurned: 300 + index * 60,
        rating: 4,
        notes: '',
        sets: [{ exerciseName: 'Back Squat', setNumber: 1, reps: 8, weight: 60 + index * 10, notes: '' }],
        createdAt: new Date(`${date}T17:00:00Z`),
      });
    }
  });
  await db.collection('workoutlogs').insertMany(logs);

  // Nutrition ---------------------------------------------------------------
  const nutritionLogs = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = addDaysISO(today, -offset);
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
      const plan = pick(MEAL_PLANS[meal]);
      plan.forEach(([name, grams]) => {
        const variation = 1 + jitter(0.08);
        const adjusted = Math.max(5, Math.round(grams * variation));
        nutritionLogs.push({ userId: alex, ...mealEntry(name, adjusted, meal, date, foodMap) });
      });
    }
  }
  await db.collection('nutritionlogs').insertMany(nutritionLogs);

  // Measurements ------------------------------------------------------------
  const measurements = [];
  for (let week = 0; week < 10; week += 1) {
    const date = addDaysISO(today, -(63 - week * 7));
    measurements.push({
      userId: alex,
      measuredOn: date,
      weightKg: round(84.5 - week * 0.47 + jitter(0.25), 1),
      bodyFatPct: round(22.4 - week * 0.39 + jitter(0.2), 1),
      chestCm: round(104 - week * 0.18 + jitter(0.3), 1),
      waistCm: round(92 - week * 0.82 + jitter(0.3), 1),
      hipsCm: round(99 - week * 0.32 + jitter(0.3), 1),
      armsCm: round(35.9 + week * 0.09 + jitter(0.15), 1),
      thighsCm: round(62 - week * 0.1 + jitter(0.2), 1),
      notes: week === 0 ? 'Starting point for the cut.' : '',
      createdAt: new Date(`${date}T07:30:00Z`),
    });
  }
  await db.collection('measurements').insertMany(measurements);

  // Performance metrics -----------------------------------------------------
  const metrics = [];
  for (let week = 0; week < 10; week += 1) {
    const date = addDaysISO(today, -(63 - week * 7));
    metrics.push({
      userId: alex,
      metric: '5K Run',
      value: round(28.6 - week * 0.46 + jitter(0.12), 2),
      unit: 'min',
      recordedOn: date,
      notes: week === 9 ? 'New personal best.' : '',
      createdAt: new Date(`${date}T08:00:00Z`),
    });
  }
  const benchHistory = [
    [84, 85],
    [56, 90],
    [28, 92.5],
    [0, 95],
  ];
  benchHistory.forEach(([daysAgo, value]) => {
    metrics.push({
      userId: alex,
      metric: 'Bench Press 1RM',
      value,
      unit: 'kg',
      recordedOn: addDaysISO(today, -daysAgo),
      notes: '',
      createdAt: new Date(),
    });
  });
  await db.collection('metrics').insertMany(metrics);

  // Goals -------------------------------------------------------------------
  const goals = [
    {
      userId: alex,
      title: 'Lose 5 kg',
      type: 'weight_loss',
      targetValue: 5,
      currentValue: 4.2,
      startValue: 84.5,
      unit: 'kg',
      deadline: addDaysISO(today, 21),
      status: 'active',
      createdAt: new Date(Date.now() - 64 * 86400000),
      updatedAt: now,
    },
    {
      userId: alex,
      title: 'Bench press 100 kg',
      type: 'strength',
      targetValue: 100,
      currentValue: 95,
      unit: 'kg',
      deadline: addDaysISO(today, 45),
      status: 'active',
      createdAt: new Date(Date.now() - 40 * 86400000),
      updatedAt: now,
    },
    {
      userId: alex,
      title: 'Train 4× every week',
      type: 'workouts',
      targetValue: 40,
      currentValue: 36,
      unit: 'sessions',
      deadline: addDaysISO(today, 28),
      status: 'active',
      createdAt: new Date(Date.now() - 56 * 86400000),
      updatedAt: now,
    },
    {
      userId: alex,
      title: 'Run 5K under 25 minutes',
      type: 'custom',
      targetValue: 25,
      currentValue: 24.2,
      unit: 'min',
      deadline: addDaysISO(today, 60),
      status: 'active',
      createdAt: new Date(Date.now() - 30 * 86400000),
      updatedAt: now,
    },
    {
      userId: alex,
      title: 'Complete 30 workouts',
      type: 'workouts',
      targetValue: 30,
      currentValue: 30,
      unit: 'sessions',
      deadline: addDaysISO(today, -7),
      status: 'completed',
      createdAt: new Date(Date.now() - 90 * 86400000),
      updatedAt: new Date(Date.now() - 8 * 86400000),
    },
  ];
  await db.collection('goals').insertMany(goals);

  // Achievements ------------------------------------------------------------
  const unlockedKeys = ['first_workout', 'workouts_10', 'workouts_25', 'streak_3', 'streak_7', 'first_measurement', 'goal_completed'];
  await db.collection('achievements').insertMany(
    unlockedKeys.map((key, index) => ({ userId: alex, key, unlockedAt: new Date(Date.now() - (70 - index * 8) * 86400000) }))
  );

  // Social ------------------------------------------------------------------
  await db.collection('follows').insertMany([
    { followerId: maya, followingId: alex, createdAt: new Date(Date.now() - 50 * 86400000) },
    { followerId: jordan, followingId: alex, createdAt: new Date(Date.now() - 30 * 86400000) },
    { followerId: priya, followingId: alex, createdAt: new Date(Date.now() - 12 * 86400000) },
    { followerId: alex, followingId: maya, createdAt: new Date(Date.now() - 48 * 86400000) },
    { followerId: alex, followingId: priya, createdAt: new Date(Date.now() - 10 * 86400000) },
    { followerId: maya, followingId: jordan, createdAt: new Date(Date.now() - 20 * 86400000) },
  ]);

  const posts = [
    {
      userId: alex,
      title: 'Week 6 of the cut — down 4.2 kg',
      body:
        'Hit a new low this morning: 80.3 kg, down from 84.5. I have kept protein at 165 g and training volume has stayed flat. The scale is noisy, but the weekly average is moving in the right direction. Two more kilos to go.',
      category: 'progress',
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      userId: maya,
      title: 'High-protein meal prep in under 30 minutes',
      body:
        'Sunday prep: chicken and brown rice bowls, salmon and sweet potato trays, and overnight oats for four breakfasts. Everything roasts at the same temperature, so there is barely any active time. 140 g of protein per day without thinking about it.',
      category: 'nutrition',
      createdAt: new Date(Date.now() - 4 * 86400000),
      updatedAt: new Date(Date.now() - 4 * 86400000),
    },
    {
      userId: jordan,
      title: 'How do you break through a bench plateau?',
      body:
        'Stuck at 95 kg for three weeks. I am running 4x5 and adding a back-off set, sleeping well, eating enough. Considering a deload or swapping to dumbbell pressing for a block. What has worked for you?',
      category: 'question',
      createdAt: new Date(Date.now() - 5 * 86400000),
      updatedAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      userId: priya,
      title: '5K personal best: 24:12',
      body:
        'Six weeks of easy miles plus one interval session per week and the payoff arrived. Took 38 seconds off my previous best. Next target is sub-24. Stay patient, run easy.',
      category: 'progress',
      createdAt: new Date(Date.now() - 7 * 86400000),
      updatedAt: new Date(Date.now() - 7 * 86400000),
    },
    {
      userId: alex,
      title: 'Consistency beats intensity',
      body:
        'The biggest change for me was not a new program. It was showing up four days a week for three months, even on the days I only had 30 minutes. Progress compounds quietly.',
      category: 'motivation',
      createdAt: new Date(Date.now() - 11 * 86400000),
      updatedAt: new Date(Date.now() - 11 * 86400000),
    },
  ];
  const insertedPosts = await db.collection('posts').insertMany(posts);
  const postIds = Object.values(insertedPosts.insertedIds);

  await db.collection('replies').insertMany([
    {
      postId: postIds[0],
      userId: maya,
      body: 'Huge progress! Keeping volume flat while dropping weight is exactly how you keep muscle.',
      createdAt: new Date(Date.now() - 36 * 3600000),
    },
    {
      postId: postIds[0],
      userId: jordan,
      body: 'Nice work. Are you adjusting calories weekly or running a static deficit?',
      createdAt: new Date(Date.now() - 30 * 3600000),
    },
    {
      postId: postIds[2],
      userId: alex,
      body: 'A two-week deload at 70% reset my bench last year. Came back and hit a 5 kg PR.',
      createdAt: new Date(Date.now() - 4 * 86400000),
    },
    {
      postId: postIds[1],
      userId: priya,
      body: 'The overnight oats are a game changer. Adding a spoon of peanut butter for the extra calories.',
      createdAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      postId: postIds[3],
      userId: alex,
      body: 'Congratulations! That sub-24 is going to fall soon.',
      createdAt: new Date(Date.now() - 6 * 86400000),
    },
  ]);

  await db.collection('likes').insertMany([
    { postId: postIds[0], userId: maya, createdAt: new Date() },
    { postId: postIds[0], userId: jordan, createdAt: new Date() },
    { postId: postIds[0], userId: priya, createdAt: new Date() },
    { postId: postIds[1], userId: alex, createdAt: new Date() },
    { postId: postIds[1], userId: priya, createdAt: new Date() },
    { postId: postIds[2], userId: alex, createdAt: new Date() },
    { postId: postIds[3], userId: alex, createdAt: new Date() },
    { postId: postIds[3], userId: maya, createdAt: new Date() },
    { postId: postIds[4], userId: maya, createdAt: new Date() },
  ]);

  // Notifications -----------------------------------------------------------
  const notifications = [
    {
      userId: alex,
      type: 'achievement',
      title: 'Goal crushed',
      body: 'You completed the "Complete 30 workouts" goal. Time to set the next one.',
      icon: 'trophy',
      link: '/progress',
      isRead: false,
      createdAt: new Date(Date.now() - 8 * 86400000),
    },
    {
      userId: alex,
      type: 'social',
      title: 'Maya Chen started following you',
      body: 'Check out their profile and follow back if you like.',
      icon: 'users',
      link: '/community',
      isRead: false,
      createdAt: new Date(Date.now() - 5 * 3600000),
    },
    {
      userId: alex,
      type: 'social',
      title: 'Maya Chen replied to "Week 6 of the cut — down 4.2 kg"',
      body: 'Huge progress! Keeping volume flat while dropping weight is exactly how you keep muscle.',
      icon: 'message',
      link: '/community',
      isRead: false,
      createdAt: new Date(Date.now() - 90 * 60000),
    },
    {
      userId: alex,
      type: 'workout',
      title: 'Workout logged: Full Body Express',
      body: '30 min · 8600 kg volume',
      icon: 'dumbbell',
      link: '/workouts',
      isRead: true,
      createdAt: new Date(Date.now() - 26 * 3600000),
    },
    {
      userId: alex,
      type: 'reminder',
      title: 'Push day at 18:00',
      body: "It's 18:00 — a gentle nudge from FitPulse.",
      icon: 'bell',
      link: '/workouts',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      userId: alex,
      type: 'achievement',
      title: '7-day streak',
      body: 'A full week of consistency. Outstanding!',
      icon: 'flame',
      link: '/progress',
      isRead: true,
      createdAt: new Date(Date.now() - 20 * 86400000),
    },
  ];
  await db.collection('notifications').insertMany(notifications);

  await db.collection('reminders').insertMany([
    { userId: alex, title: 'Morning weigh-in', type: 'custom', timeOfDay: '07:30', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, lastFiredAt: null, createdAt: new Date() },
    { userId: alex, title: 'Push day', type: 'workout', timeOfDay: '18:00', days: [1, 3, 5], enabled: true, lastFiredAt: null, createdAt: new Date() },
    { userId: alex, title: 'Meal prep', type: 'meal', timeOfDay: '12:00', days: [0], enabled: true, lastFiredAt: null, createdAt: new Date() },
    { userId: alex, title: 'Hydrate', type: 'water', timeOfDay: '15:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: false, lastFiredAt: null, createdAt: new Date() },
  ]);

  await db.collection('tickets').insertOne({
    userId: alex,
    type: 'feedback',
    subject: 'Love the analytics view',
    message: 'The weekly volume chart is exactly what I needed. Would love a yearly heatmap next.',
    status: 'open',
    createdAt: new Date(Date.now() - 3 * 86400000),
  });

  return {
    seeded: true,
    users: await db.collection('users').countDocuments(),
    workouts: await db.collection('workouts').countDocuments(),
    logs: await db.collection('workoutlogs').countDocuments(),
    nutrition: await db.collection('nutritionlogs').countDocuments(),
    demo: { username: 'alex', password: DEMO_PASSWORD },
    userIds,
  };
}

async function seedIfEmpty() {
  return seedDatabase();
}

if (require.main === module) {
  (async () => {
    const reset = process.argv.includes('--reset');
    await connect();
    const result = await seedDatabase({ reset });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    await close();
  })().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedDatabase, seedIfEmpty, DEMO_PASSWORD };
