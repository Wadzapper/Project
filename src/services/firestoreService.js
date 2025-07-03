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
        level: 1, // Initial level
        xp: 0,    // Initial XP
        xpToNextLevel: 100, // XP needed for level 2 (MVP logic)
        // Add other default profile fields here
        ...additionalData,
      });
      console.log('User profile created for UID:', user.uid);
    } catch (error) {
      console.error("Error creating user profile:", error);
      Alert.alert('Error', 'Could not create user profile.');
      throw error;
    }
  }
  return userRef; // Return the reference, or the document data if preferred
};

/**
 * Retrieves a user's profile data from Firestore.
 * @param {string} userId - The UID of the user.
 * @param {function} callback - Function to call with the profile data (or null if not found).
 *                              This allows for real-time updates if onSnapshot is used.
 * @returns {function} Unsubscribe function from onSnapshot, or undefined if get is used.
 */
export const getUserProfile = (userId, callback) => {
  if (!userId) {
    callback(null);
    return () => {}; // Return an empty unsubscribe function
  }
  const userRef = firestore.collection('users').doc(userId);

  // Use onSnapshot for real-time updates to the profile on the UI
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
      throw error;
    }
  );
  return unsubscribe; // Return the unsubscribe function for cleanup
};


// --- MVP Task Management ---
const XP_PER_TASK_MVP = 10; // Simplified XP for MVP

/**
 * Adds a new task for the current user.
 * @param {string} title - The title of the task.
 * @returns {Promise<firebase.firestore.DocumentReference | void>}
 */
export const addTask = async (title) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !title) {
    Alert.alert('Error', 'You must be logged in and provide a title to add a task.');
    return;
  }
  try {
    const taskRef = await firestore
      .collection('users')
      .doc(currentUser.uid)
      .collection('tasks')
      .add({
        title,
        completed: false,
        xpValue: XP_PER_TASK_MVP, // For MVP, fixed XP
        createdAt: firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid, // Store userId for potential broader queries later
      });
    console.log('Task added with ID:', taskRef.id);
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
    .where('completed', '==', false) // Only get uncompleted tasks for MVP dashboard
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
      throw error;
    }
  );
  return unsubscribe;
};

/**
 * Marks a task as complete and updates user XP and level.
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

      if (!taskDoc.exists) {
        throw new Error("Task does not exist!");
      }
      if (!userProfileDoc.exists) {
        throw new Error("User profile does not exist!");
      }

      if (taskDoc.data().completed) {
        console.log("Task already completed.");
        return; // Avoid re-processing if already complete
      }

      transaction.update(taskRef, { completed: true });

      const taskXp = taskDoc.data().xpValue || XP_PER_TASK_MVP;
      let currentXp = userProfileDoc.data().xp + taskXp;
      let currentLevel = userProfileDoc.data().level;
      let xpToNextLevel = userProfileDoc.data().xpToNextLevel;

      // Simple linear level progression for MVP: next level = currentLevel * 100 XP
      while (currentXp >= xpToNextLevel) {
        currentXp -= xpToNextLevel;
        currentLevel++;
        xpToNextLevel = currentLevel * 100;
      }

      transaction.update(userProfileRef, {
        xp: currentXp,
        level: currentLevel,
        xpToNextLevel: xpToNextLevel,
      });
      console.log(`Task ${taskId} completed. User ${currentUser.uid} XP updated.`);
    });
  } catch (error) {
    console.error("Error completing task:", error);
    Alert.alert('Error', `Could not complete task: ${error.message}`);
    throw error;
  }
};
