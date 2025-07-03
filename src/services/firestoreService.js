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
      // Alert.alert('Error', 'Could not fetch user profile.'); // Avoid alert spam in listener
      callback(null);
    }
  );
  return unsubscribe;
};


// --- MVP Task Management (will be replaced/enhanced by Quests) ---
// We can keep these for simple, non-quest tasks or phase them out.
// For now, let's assume Quests will be the primary way to track larger goals.
// The existing addTask and completeTask will be modified or new ones for Quests created.

const XP_PER_SIMPLE_TASK = 5; // Reduced XP for simple tasks if kept

/**
 * Adds a simple task (not a full quest).
 * @param {string} title - The title of the task.
 * @returns {Promise<firebase.firestore.DocumentReference | void>}
 */
export const addSimpleTask = async (title) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !title) {
    Alert.alert('Error', 'You must be logged in and provide a title to add a task.');
    return;
  }
  try {
    const taskData = {
        title,
        completed: false,
        xpValue: XP_PER_SIMPLE_TASK,
        createdAt: firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
    };
    const taskRef = await firestore
      .collection('users')
      .doc(currentUser.uid)
      .collection('simpleTasks') // Using a different collection for clarity
      .add(taskData);
    console.log('Simple Task added with ID:', taskRef.id);
    return taskRef;
  } catch (error) {
    console.error("Error adding simple task:", error);
    Alert.alert('Error', 'Could not add simple task.');
    throw error;
  }
};

// --- Skill Management ---

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
        xpToNextLevel: 150,
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
    .orderBy('createdAt', 'desc');
  const unsubscribe = skillsQuery.onSnapshot(
    (querySnapshot) => {
      const skills = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(skills);
    }, (error) => {
      console.error("Error fetching skills:", error);
      callback([]);
    });
  return unsubscribe;
};


// --- Quest Management ---

/**
 * Adds a new quest for the current user.
 * @param {object} questData - Object containing quest details.
 * Required: title, type, xpReward.
 * Optional: description, skillIds (array), skillXpRewards (array of {skillId, xp}), subTasks (array of {title, completed}), dueDate.
 * @returns {Promise<firebase.firestore.DocumentReference | void>}
 */
export const addQuest = async (questData) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !questData || !questData.title || !questData.type || !questData.xpReward) {
    Alert.alert('Error', 'Missing required quest data (title, type, XP reward).');
    return;
  }

  try {
    const newQuest = {
      title: questData.title,
      description: questData.description || '',
      type: questData.type, // "Main", "Side", "Daily", "Weekly"
      status: 'active', // Default status
      skillIds: questData.skillIds || [], // Array of skill IDs
      xpReward: questData.xpReward, // Overall XP reward for the quest
      // skillXpRewards: questData.skillXpRewards || [], // Specific XP for each linked skill
      // For simplicity in this version, let's say xpReward is split among linked skills if not specified,
      // or a quest can define a single skillXp value to be applied to all linked skills.
      // Let's assume for now `xpReward` is general, and `skillXpRewards` (if present on questData) is an array of {skillId, xp}
      skillXpDistribution: questData.skillXpDistribution || [], // e.g., [{skillId: 'abc', xp: 50}, {skillId: 'xyz', xp: 30}]
      subTasks: questData.subTasks ? questData.subTasks.map(st => ({ title: st.title, completed: st.completed || false })) : [],
      dueDate: questData.dueDate || null,
      createdAt: firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      userId: currentUser.uid,
    };

    const questRef = await firestore
      .collection('users')
      .doc(currentUser.uid)
      .collection('quests')
      .add(newQuest);
    console.log('Quest added with ID:', questRef.id);
    return questRef;
  } catch (error) {
    console.error("Error adding quest:", error);
    Alert.alert('Error', 'Could not add quest.');
    throw error;
  }
};

/**
 * Fetches quests for the current user, optionally filtered by status.
 * @param {string} statusFilter - e.g., 'active', 'completed', 'all'. Defaults to 'active'.
 * @param {function} callback - Function to call with the array of quests.
 * @returns {function} Unsubscribe function from onSnapshot.
 */
export const getQuests = (statusFilter = 'active', callback) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    callback([]);
    return () => {};
  }

  let questsQuery = firestore
    .collection('users')
    .doc(currentUser.uid)
    .collection('quests');

  if (statusFilter !== 'all') {
    questsQuery = questsQuery.where('status', '==', statusFilter);
  }
  questsQuery = questsQuery.orderBy('createdAt', 'desc');

  const unsubscribe = questsQuery.onSnapshot(
    (querySnapshot) => {
      const quests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(quests);
    },
    (error) => {
      console.error("Error fetching quests:", error);
      Alert.alert('Error', `Could not fetch quests (status: ${statusFilter}).`);
      callback([]);
    }
  );
  return unsubscribe;
};

/**
 * Updates a specific sub-task's completion status within a quest.
 * @param {string} questId - The ID of the quest.
 * @param {number} subTaskIndex - The index of the sub-task in the subTasks array.
 * @param {boolean} completed - The new completion status.
 * @returns {Promise<void>}
 */
export const updateSubTaskCompletion = async (questId, subTaskIndex, completed) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !questId || subTaskIndex === undefined) {
    Alert.alert('Error', 'Missing required data to update sub-task.');
    return;
  }

  const questRef = firestore.collection('users').doc(currentUser.uid).collection('quests').doc(questId);

  try {
    const questDoc = await questRef.get();
    if (!questDoc.exists) {
      throw new Error("Quest not found.");
    }
    const questData = questDoc.data();
    const subTasks = [...questData.subTasks]; // Create a copy

    if (subTaskIndex < 0 || subTaskIndex >= subTasks.length) {
      throw new Error("Invalid sub-task index.");
    }

    subTasks[subTaskIndex].completed = completed;
    await questRef.update({ subTasks });
    console.log(`Sub-task ${subTaskIndex} for quest ${questId} updated to ${completed}`);

    // Optional: Check if all sub-tasks are complete to auto-complete quest
    // const allSubTasksDone = subTasks.every(st => st.completed);
    // if (allSubTasksDone && questData.status === 'active') {
    //   await completeQuest(questId); // This might cause a loop if completeQuest also calls this
    // }

  } catch (error) {
    console.error("Error updating sub-task:", error);
    Alert.alert('Error', `Could not update sub-task: ${error.message}`);
    throw error;
  }
};


/**
 * Marks a quest as complete and distributes XP.
 * @param {string} questId - The ID of the quest to complete.
 * @returns {Promise<void>}
 */
export const completeQuest = async (questId) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !questId) {
    Alert.alert('Error', 'User not found or quest ID missing.');
    return;
  }

  const questRef = firestore.collection('users').doc(currentUser.uid).collection('quests').doc(questId);
  const userProfileRef = firestore.collection('users').doc(currentUser.uid);

  try {
    await firestore.runTransaction(async (transaction) => {
      const questDoc = await transaction.get(questRef);
      const userProfileDoc = await transaction.get(userProfileRef);

      if (!questDoc.exists) throw new Error("Quest does not exist!");
      if (!userProfileDoc.exists) throw new Error("User profile does not exist!");

      const questData = questDoc.data();
      if (questData.status === 'completed') {
        console.log("Quest already completed.");
        return;
      }

      // Ensure all sub-tasks are completed if any exist
      if (questData.subTasks && questData.subTasks.length > 0) {
        const allSubTasksDone = questData.subTasks.every(st => st.completed);
        if (!allSubTasksDone) {
          throw new Error("Not all sub-tasks are completed for this quest.");
        }
      }

      transaction.update(questRef, {
        status: 'completed',
        completedAt: firestore.FieldValue.serverTimestamp()
      });

      // Update Overall User XP from quest's general xpReward
      const overallQuestXp = questData.xpReward || 0;
      if (overallQuestXp > 0) {
        let currentOverallXp = userProfileDoc.data().xp + overallQuestXp;
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

      // Distribute Skill XP if skillXpDistribution is defined
      if (questData.skillXpDistribution && questData.skillXpDistribution.length > 0) {
        for (const skillReward of questData.skillXpDistribution) {
          if (skillReward.skillId && skillReward.xp > 0) {
            const skillRef = firestore.collection('users').doc(currentUser.uid).collection('skills').doc(skillReward.skillId);
            const skillDoc = await transaction.get(skillRef);
            if (skillDoc.exists) {
              let currentSkillXp = skillDoc.data().xp + skillReward.xp;
              let currentSkillLevel = skillDoc.data().level;
              let skillXpToNextLevel = skillDoc.data().xpToNextLevel;
              while (currentSkillXp >= skillXpToNextLevel) {
                currentSkillXp -= skillXpToNextLevel;
                currentSkillLevel++;
                skillXpToNextLevel = currentSkillLevel * 150; // Skill level logic
              }
              transaction.update(skillRef, {
                xp: currentSkillXp,
                level: currentSkillLevel,
                xpToNextLevel: skillXpToNextLevel,
              });
            }
          }
        }
      }
      // Alternative: if only skillIds are present, distribute overallQuestXp among them or a fixed amount.
      // This part can be complex depending on desired XP logic. The skillXpDistribution is more explicit.

      console.log(`Quest ${questId} completed. User ${currentUser.uid} and relevant skills XP updated.`);
      // TODO: Trigger badge checks for quest completion
    });
  } catch (error) {
    console.error("Error completing quest:", error);
    Alert.alert('Error', `Could not complete quest: ${error.message}`);
    throw error;
  }
};

// TODO: Functions for:
// - Deleting a quest
// - Editing a quest (title, description, due date, skills, subtasks etc.)
// - Failing a quest (e.g., if past due date and not completed, for certain types)
// - Re-activating a recurring quest (e.g., Daily, Weekly)
