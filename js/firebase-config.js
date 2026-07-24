// Firebase 콘솔 > 프로젝트 설정 > 일반 > "내 앱"에서 발급받은 값을 아래에 붙여넣으세요.
// 이 값들은 클라이언트에 공개되어도 안전합니다(비밀키 아님). 실제 접근 제어는
// firestore.rules / storage.rules 로 이루어집니다. 반드시 그 규칙을 함께 설정하세요.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
