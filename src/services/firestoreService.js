import { firestore, auth } from './firebaseInit'; // Uses initialized instances
import { Alert } from 'react-native';

/**
 * Creates a user profile document in Firestore.
 * Typically called after successful user registration.
 * @param {firebase.User} user - The Firebase user object.
 * @param {object} additionalData - Any additional data to store in the profile.
 */
export const createUserProfileDocument = async (user, additionalData = {}) => {
  if (!user) return;

  const userRef = firestore.collection('users').doc(user.uid);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    const { email } = user;
    const createdAt = new Date();
    try {
      await userRef.set({
        uid: user.uid,
        email,
        createdAt,
        level: 1, // Initial overall user level
        xp: 0,    // Initial overall user XP
        xpToNextLevel: 100, // XP needed for overall user level 2
        ...additionalData,
      });
      console.log('User profile created for UID:', user.uid);
    } catch (error) {
      console.error("Error creating user profile:", error);
      Alert.alert('Error', 'Could not create user profile.');
      throw error;
    }
  }
  return userRef;
};

/**
 * Retrieves a user's profile data from Firestore.
 * @param {string} userId - The UID of the user.
 * @param {function} callback - Function to call with the profile data (or null if not found).
 * @returns {function} Unsubscribe function from onSnapshot.
 */
export const getUserProfile = (userId, callback) => {
  if (!userId) {
    callback(null);
    return () => {};
  }
  const userRef = firestore.collection('users').doc(userId);

  const unsubscribe = userRef.onSnapshot(
    (doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      } else {
        console.log('No such user profile!');
        callback(null);
      }
    },
    (error) => {
      console.error("Error fetching user profile:", error);
      Alert.alert('Error', 'Could not fetch user profile.');
      callback(null);
      // throw error; // Avoid throwing in listener, can crash app
    }
  );
  return unsubscribe;
};


// --- MVP Task Management (will be enhanced for skills) ---
const XP_PER_TASK_MVP = 10; // Default XP if no skill XP defined

/**
 * Adds a new task for the current user.
 * Can optionally be linked to a skill.
 * @param {string} title - The title of the task.
 * @param {string|null} skillId - Optional ID of the skill this task contributes to.
 * @param {number|null} skillXpReward - Optional XP reward for the linked skill.
 * @returns {Promise<firebase.firestore.DocumentReference | void>}
 */
export const addTask = async (title, skillId = null, skillXpReward = null) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !title) {
    Alert.alert('Error', 'You must be logged in and provide a title to add a task.');
    return;
  }
  try {
    const taskData = {
        title,
        completed: false,
        xpValue: XP_PER_TASK_MVP, // Overall XP value (can be 0 if only skill XP)
        createdAt: firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
        skillId: skillId, // Link to skill
        skillXpReward: skillXpReward // XP for the skill itself
    };
    const taskRef = await firestore
      .collection('users')
      .doc(currentUser.uid)
      .collection('tasks')
      .add(taskData);
    console.log('Task added with ID:', taskRef.id, "linked to skill:", skillId);
    return taskRef;
  } catch (error) {
    console.error("Error adding task:", error);
    Alert.alert('Error', 'Could not add task.');
    throw error;
  }
};

/**
 * Fetches tasks for the current user.
 * @param {function} callback - Function to call with the array of tasks.
 * @returns {function} Unsubscribe function from onSnapshot.
 */
export const getTasks = (callback) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    callback([]);
    return () => {};
  }

  const tasksQuery = firestore
    .collection('users')
    .doc(currentUser.uid)
    .collection('tasks')
    .where('completed', '==', false)
    .orderBy('createdAt', 'desc');

  const unsubscribe = tasksQuery.onSnapshot(
    (querySnapshot) => {
      const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(tasks);
    },
    (error) => {
      console.error("Error fetching tasks:", error);
      Alert.alert('Error', 'Could not fetch tasks.');
      callback([]);
      // throw error;
    }
  );
  return unsubscribe;
};

/**
 * Marks a task as complete and updates user/skill XP and level.
 * @param {string} taskId - The ID of the task to complete.
 * @returns {Promise<void>}
 */
export const completeTask = async (taskId) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !taskId) {
    Alert.alert('Error', 'User not found or task ID missing.');
    return;
  }

  const taskRef = firestore.collection('users').doc(currentUser.uid).collection('tasks').doc(taskId);
  const userProfileRef = firestore.collection('users').doc(currentUser.uid);

  try {
    await firestore.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      const userProfileDoc = await transaction.get(userProfileRef);

      if (!taskDoc.exists) throw new Error("Task does not exist!");
      if (!userProfileDoc.exists) throw new Error("User profile does not exist!");
      if (taskDoc.data().completed) {
        console.log("Task already completed.");
        return;
      }

      transaction.update(taskRef, { completed: true });

      // Update Overall User XP
      const overallTaskXp = taskDoc.data().xpValue || 0; // Use 0 if only skill XP
      if (overallTaskXp > 0) {
        let currentOverallXp = userProfileDoc.data().xp + overallTaskXp;
        let currentOverallLevel = userProfileDoc.data().level;
        let overallXpToNextLevel = userProfileDoc.data().xpToNextLevel;
        while (currentOverallXp >= overallXpToNextLevel) {
          currentOverallXp -= overallXpToNextLevel;
          currentOverallLevel++;
          overallXpToNextLevel = currentOverallLevel * 100; // MVP overall level logic
        }
        transaction.update(userProfileRef, {
          xp: currentOverallXp,
          level: currentOverallLevel,
          xpToNextLevel: overallXpToNextLevel,
        });
      }

      // Update Skill XP if applicable
      const linkedSkillId = taskDoc.data().skillId;
      const skillXpFromTask = taskDoc.data().skillXpReward;

      if (linkedSkillId && skillXpFromTask > 0) {
        const skillRef = firestore.collection('users').doc(currentUser.uid).collection('skills').doc(linkedSkillId);
        const skillDoc = await transaction.get(skillRef);
        if (skillDoc.exists) {
          let currentSkillXp = skillDoc.data().xp + skillXpFromTask;
          let currentSkillLevel = skillDoc.data().level;
          let skillXpToNextLevel = skillDoc.data().xpToNextLevel;
          // Example skill level progression: skillLevel * 150
          while (currentSkillXp >= skillXpToNextLevel) {
            currentSkillXp -= skillXpToNextLevel;
            currentSkillLevel++;
            skillXpToNextLevel = currentSkillLevel * 150;
          }
          transaction.update(skillRef, {
            xp: currentSkillXp,
            level: currentSkillLevel,
            xpToNextLevel: skillXpToNextLevel,
          });
          console.log(`Skill ${linkedSkillId} XP updated.`);
        } else {
          console.warn(`Skill ${linkedSkillId} not found for XP update.`);
        }
      }
      console.log(`Task ${taskId} completed. User ${currentUser.uid} XP updated.`);
    });
  } catch (error) {
    console.error("Error completing task:", error);
    Alert.alert('Error', `Could not complete task: ${error.message}`);
    throw error;
  }
};


// --- Skill Management ---

/**
 * Adds a new skill for the current user.
 * @param {object} skillData - Object containing skill details (name, category, icon, color).
 * @returns {Promise<firebase.firestore.DocumentReference | void>}
 */
export const addSkill = async (skillData) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !skillData || !skillData.name) {
    Alert.alert('Error', 'You must be logged in and provide a skill name.');
    return;
  }
  try {
    const skillRef = await firestore
      .collection('users')
      .doc(currentUser.uid)
      .collection('skills')
      .add({
        name: skillData.name,
        category: skillData.category || 'General',
        icon: skillData.icon || null,
        color: skillData.color || null,
        xp: 0,
        level: 1,
        xpToNextLevel: 150, // Initial XP for skill level 2 (e.g., level * 150)
        createdAt: firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
      });
    console.log('Skill added with ID:', skillRef.id);
    return skillRef;
  } catch (error) {
    console.error("Error adding skill:", error);
    Alert.alert('Error', 'Could not add skill.');
    throw error;
  }
};

/**
 * Fetches all skills for the current user.
 * @param {function} callback - Function to call with the array of skills.
 * @returns {function} Unsubscribe function from onSnapshot.
 */
export const getSkills = (callback) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    callback([]);
    return () => {};
  }

  const skillsQuery = firestore
    .collection('users')
    .doc(currentUser.uid)
    .collection('skills')
    .orderBy('createdAt', 'desc'); // Or orderBy 'name'

  const unsubscribe = skillsQuery.onSnapshot(
    (querySnapshot) => {
      const skills = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(skills);
    },
    (error) => {
      console.error("Error fetching skills:", error);
      Alert.alert('Error', 'Could not fetch skills.');
      callback([]);
      // throw error;
    }
  );
  return unsubscribe;
};

// TODO: Functions for updating a skill (e.g., name, icon, color)
// TODO: Function for deleting a skill (consider implications for tasks linked to it)
