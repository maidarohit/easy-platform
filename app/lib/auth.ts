import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import app from "./firebase";

const auth = getAuth(app);

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);

export default auth;
