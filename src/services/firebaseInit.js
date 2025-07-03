import firebase from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';
// import '@react-native-firebase/functions'; // if you use Cloud Functions
// import '@react-native-firebase/storage'; // if you use Firebase Storage

import { firebaseConfig } from './firebaseConfig'; // Your config details

const initializeFirebase = () => {
  if (!firebase.apps.length) {
    try {
      firebase.initializeApp(firebaseConfig);
      console.log("Firebase initialized successfully!");
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // You might want to throw the error or handle it in a way that
      // informs the user or logs it more robustly.
      // For example, you could set a global state that the app is in an error state.
    }
  } else {
    firebase.app(); // if already initialized, use that one
    console.log("Firebase already initialized.");
  }
};

export default initializeFirebase;

// Call initialization when this module is imported.
// This ensures Firebase is ready as early as possible.
// Alternatively, you could call this explicitly in your App.js or index.js.
initializeFirebase();

// Export individual services if needed elsewhere, though often you'd create
// wrapper functions in other service files (e.g., firebaseAuth.js, firestoreService.js)
export const auth = firebase.auth();
export const firestore = firebase.firestore();
// export const functions = firebase.functions();
// export const storage = firebase.storage();
