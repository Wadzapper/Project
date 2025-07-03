import { auth } from './firebaseInit'; // Uses the initialized auth instance
import { Alert } from 'react-native';
import { createUserProfileDocument } from './firestoreService';

/**
 * Registers a new user with email and password.
 * Creates a user profile document in Firestore upon successful registration.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export const registerUser = async (email, password) => {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    if (userCredential.user) {
      // Create a user profile document in Firestore
      await createUserProfileDocument(userCredential.user);
      // You could pass additional default data here if needed, e.g., displayName
      // await createUserProfileDocument(userCredential.user, { displayName: "New User" });
    }
    // Optional: Send a verification email (configure in Firebase console).
    // await userCredential.user.sendEmailVerification();
    // Alert.alert("Registration Successful", "Please check your email to verify your account.");
    console.log('User registered and profile creation initiated for:', userCredential.user.uid);
    return userCredential;
  } catch (error) {
    console.error("Registration error:", error.message, error.code);
    let friendlyMessage = "Registration failed. Please try again.";
    if (error.code === 'auth/email-already-in-use') {
      friendlyMessage = 'That email address is already in use!';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'That email address is invalid!';
    } else if (error.code === 'auth/weak-password') {
      friendlyMessage = 'Password is too weak. Please choose a stronger password.';
    }
    Alert.alert('Registration Error', friendlyMessage);
    throw error;
  }
};

/**
 * Logs in an existing user with email and password.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {Promise<firebase.auth.UserCredential>}
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log('User logged in:', userCredential.user.uid);
    return userCredential;
  } catch (error) {
    console.error("Login error:", error.message, error.code);
    let friendlyMessage = "Login failed. Please check your credentials.";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { // invalid-credential for newer SDK versions
      friendlyMessage = 'Invalid email or password.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyMessage = 'That email address is invalid!';
    } else if (error.code === 'auth/user-disabled') {
        friendlyMessage = 'This user account has been disabled.';
    }
    Alert.alert('Login Error', friendlyMessage);
    throw error;
  }
};

/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export const logoutUser = async () => {
  try {
    await auth.signOut();
    console.log('User logged out');
  } catch (error) {
    console.error("Logout error:", error.message);
    Alert.alert('Logout Error', 'Failed to log out. Please try again.');
    throw error;
  }
};

/**
 * Attaches a listener to authentication state changes.
 * The callback will receive the user object (or null if logged out).
 * @param {function(firebase.User | null): void} callback - Function to call when auth state changes.
 * @returns {function} Unsubscribe function.
 */
export const onAuthStateChanged = (callback) => {
  return auth.onAuthStateChanged(callback);
};

/**
 * Gets the current authenticated user.
 * @returns {firebase.User | null} The current user object or null.
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};
