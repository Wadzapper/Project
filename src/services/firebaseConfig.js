// IMPORTANT: In a real application, this file should be in .gitignore
// and you should use environment variables (e.g., via react-native-dotenv)
// to store your Firebase config details.

// Replace these with your actual Firebase project configuration.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE", // Replace with your actual API key
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // Replace YOUR_PROJECT_ID
  projectId: "YOUR_PROJECT_ID", // Replace YOUR_PROJECT_ID
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // Replace YOUR_PROJECT_ID
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace
  appId: "YOUR_APP_ID", // Replace, e.g., 1:YOUR_MESSAGING_SENDER_ID:web:YOUR_APP_ID_SUFFIX
  measurementId: "G-YOUR_MEASUREMENT_ID" // Optional: For Google Analytics
};

// Note:
// To get these values:
// 1. Go to your Firebase project in the Firebase console (console.firebase.google.com).
// 2. In the project overview, click on "Project settings" (the gear icon).
// 3. Under the "General" tab, scroll down to "Your apps".
// 4. If you haven't added an app yet, click on the web icon (</>) to "Add app" and follow the instructions.
//    Even for React Native, initializing with a web app's config is common for the JS SDK.
// 5. The firebaseConfig object will be displayed there. Copy these values.
// 6. Ensure your Firebase project has Authentication and Firestore enabled and configured.
//    - Authentication: Add Email/Password sign-in method.
//    - Firestore: Create a database (start in test mode for easy development, but secure it with rules before production).
